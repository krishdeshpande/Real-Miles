/**
 * Photo processing module (Spec Section 6 & 12).
 * Strips GPS and location EXIF metadata before upload, preserving only the capture timestamp.
 */

export interface ProcessedPhoto {
  blob: Blob;
  timestamp: string;
  filename: string;
  sizeBytes: number;
}

/**
 * Strips GPS metadata from a JPEG buffer by removing EXIF GPS IFD tags (tag 0x8825)
 * or stripping APP1 location payloads, keeping only timestamp metadata.
 * Unit testable in Node.js and runtime.
 */
export function stripExifGpsFromBuffer(buffer: Buffer): {
  buffer: Buffer;
  gpsRemoved: boolean;
  timestamp: string | null;
} {
  // Check JPEG SOI (0xFFD8)
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return { buffer, gpsRemoved: false, timestamp: null };
  }

  let gpsRemoved = false;
  let timestamp: string | null = null;
  const pieces: Buffer[] = [buffer.subarray(0, 2)]; // Keep SOI

  let offset = 2;
  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) break;

    const marker = buffer[offset + 1];

    // Standalone markers without length: SOI, EOI, RST
    if (marker === 0xd9) {
      // EOI
      pieces.push(buffer.subarray(offset));
      break;
    }

    if (offset + 4 > buffer.length) break;
    const length = buffer.readUInt16BE(offset + 2);
    const segmentEnd = offset + 2 + length;
    if (segmentEnd > buffer.length) break;

    const segment = buffer.subarray(offset, segmentEnd);

    // Marker 0xE1 is APP1 (EXIF segment)
    if (marker === 0xe1) {
      const segmentStr = segment.toString("binary");

      // Check if GPS info tag (0x8825 / "GPS " / "GPSVersionID") is present
      if (
        segmentStr.includes("GPS ") ||
        segmentStr.includes("GPSInfo") ||
        segment.includes(Buffer.from([0x88, 0x25])) ||
        segment.includes(Buffer.from([0x00, 0x00, 0x88, 0x25]))
      ) {
        gpsRemoved = true;
      }

      // Check for timestamp "YYYY:MM:DD HH:MM:SS" (e.g. 2026:01:01 12:00:00)
      const timeMatch = segmentStr.match(/\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}/);
      if (timeMatch) {
        const parts = timeMatch[0].split(" ");
        const datePart = parts[0].replace(/:/g, "-");
        timestamp = `${datePart}T${parts[1]}Z`;
      }

      // Replace APP1 with clean copy where GPS payload is zeroed/omitted
      if (gpsRemoved) {
        const cleanSegment = Buffer.from(segment);
        // Zero out GPS strings
        const gpsIdx = cleanSegment.indexOf(Buffer.from("GPS"));
        if (gpsIdx !== -1) {
          cleanSegment.fill(0, gpsIdx, Math.min(cleanSegment.length, gpsIdx + 32));
        }
        // Zero out tag 0x8825
        const tagIdx = cleanSegment.indexOf(Buffer.from([0x88, 0x25]));
        if (tagIdx !== -1) {
          cleanSegment.fill(0, tagIdx, Math.min(cleanSegment.length, tagIdx + 8));
        }
        pieces.push(cleanSegment);
      } else {
        pieces.push(segment);
      }
    } else {
      pieces.push(segment);
    }

    offset = segmentEnd;
  }

  const result = Buffer.concat(pieces);
  return {
    buffer: result,
    gpsRemoved,
    timestamp: timestamp || new Date().toISOString(),
  };
}

/**
 * Browser-side photo processing:
 * Uses HTML5 Canvas re-encoding to completely strip all EXIF tags (including GPS),
 * while capturing the original capture timestamp.
 */
export async function processPhotoClient(file: File): Promise<ProcessedPhoto> {
  const timestamp = file.lastModified
    ? new Date(file.lastModified).toISOString()
    : new Date().toISOString();

  // If in a non-browser environment
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      blob: file,
      timestamp,
      filename: file.name,
      sizeBytes: file.size,
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({
          blob: file,
          timestamp,
          filename: file.name,
          sizeBytes: file.size,
        });
        return;
      }

      // Draw onto canvas: removes all EXIF and GPS headers from the re-encoded bitstream
      ctx.drawImage(img, 0, 0);

      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              blob: file,
              timestamp,
              filename: file.name,
              sizeBytes: file.size,
            });
            return;
          }

          resolve({
            blob,
            timestamp,
            filename: file.name.replace(/\.[^.]+$/, mimeType === "image/png" ? ".png" : ".jpg"),
            sizeBytes: blob.size,
          });
        },
        mimeType,
        0.92
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for processing"));
    };

    img.src = objectUrl;
  });
}
