/**
 * In-browser audio extractor and poster thumbnail generator (Spec Section 3 & 4).
 * Extracts mono 16 kHz audio from video files, lazy-loading ffmpeg.wasm with native Web Audio fallback.
 * Generates video poster thumbnails client-side.
 */

export interface ExtractionResult {
  audioBlob: Blob;
  audioFilename: string;
  durationSeconds: number;
  method: "ffmpeg" | "web-audio" | "original-fallback";
  notice?: string;
}

/**
 * Encodes Float32Array PCM samples to a standard 16-bit Mono WAV Blob at specified sample rate.
 */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + samples.length * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // Format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // format chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono channel
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * 1 * 2)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // Data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, samples.length * 2, true);

  // Write PCM audio samples clamped to 16-bit
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

/**
 * Native Browser Web Audio API Extractor:
 * Fast, asynchronous, zero-CDN, decodes video audio stream to 16 kHz mono WAV.
 */
async function extractAudioViaWebAudio(
  videoBlob: Blob,
  onProgress?: (percent: number, stage: string) => void
): Promise<{ blob: Blob; duration: number }> {
  onProgress?.(20, "Decoding audio track with browser engine...");
  const arrayBuffer = await videoBlob.arrayBuffer();

  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();

  const duration = decodedBuffer.duration;
  const targetSampleRate = 16000;
  const numberOfSamples = Math.floor(duration * targetSampleRate);

  onProgress?.(60, "Resampling to 16 kHz mono audio...");

  // Use OfflineAudioContext for clean hardware-independent resampling
  const offlineCtx = new OfflineAudioContext(1, numberOfSamples, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const channelData = renderedBuffer.getChannelData(0);

  onProgress?.(90, "Packaging audio payload...");
  const wavBlob = encodeWav(channelData, targetSampleRate);

  return { blob: wavBlob, duration };
}

interface FFmpegInstance {
  load(config: { coreURL: string; wasmURL: string }): Promise<void>;
  writeFile(name: string, data: Uint8Array): Promise<void>;
  exec(args: string[]): Promise<number>;
  readFile(name: string): Promise<Uint8Array>;
}

function loadSelfHostedScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Document not available"));
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Extracts mono 16 kHz audio from video files.
 * Lazy-loads ffmpeg.wasm if available in /public/ffmpeg/, otherwise falls back
 * to Web Audio API, and finally to uploading original video.
 */
export async function extractAudioFromVideo(
  videoFile: File | Blob,
  onProgress?: (percent: number, stage: string) => void
): Promise<ExtractionResult> {
  onProgress?.(10, "Initializing audio extraction pipeline...");

  // 1. Try lazy-loading ffmpeg.wasm from /public/ffmpeg/ if present
  try {
    if (typeof window !== "undefined") {
      const coreCheck = await fetch("/ffmpeg/ffmpeg-core.js", { method: "HEAD" });
      if (coreCheck.ok) {
        onProgress?.(25, "Loading single-threaded ffmpeg.wasm engine...");
        // If ffmpeg-core files exist under /public/ffmpeg/, load self-hosted bundle
        let FFmpegConstructor = (window as unknown as { FFmpeg?: new () => FFmpegInstance }).FFmpeg;
        if (!FFmpegConstructor) {
          await loadSelfHostedScript("/ffmpeg/ffmpeg.js");
          FFmpegConstructor = (window as unknown as { FFmpeg?: new () => FFmpegInstance }).FFmpeg;
        }

        if (FFmpegConstructor) {
          const ffmpeg = new FFmpegConstructor();
          await ffmpeg.load({
            coreURL: "/ffmpeg/ffmpeg-core.js",
            wasmURL: "/ffmpeg/ffmpeg-core.wasm",
          });

          onProgress?.(50, "Transcoding audio to 16 kHz mono with ffmpeg...");
          const fileData = new Uint8Array(await videoFile.arrayBuffer());
          await ffmpeg.writeFile("input.mp4", fileData);
          await ffmpeg.exec(["-i", "input.mp4", "-vn", "-ar", "16000", "-ac", "1", "-b:a", "64k", "output.mp3"]);

          const outputData = await ffmpeg.readFile("output.mp3");
          const outBuf = new ArrayBuffer(outputData.byteLength);
          new Uint8Array(outBuf).set(outputData);
          const outputBlob = new Blob([outBuf], { type: "audio/mpeg" });

          return {
            audioBlob: outputBlob,
            audioFilename: "extracted-audio.mp3",
            durationSeconds: 0,
            method: "ffmpeg",
          };
        }
      }
    }
  } catch (ffmpegErr) {
    console.warn("ffmpeg.wasm load notice (falling back to native Web Audio API):", ffmpegErr);
  }

  // 2. Fallback to Browser Native Web Audio API
  try {
    if (typeof window !== "undefined" && (window.AudioContext || (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext)) {
      const { blob, duration } = await extractAudioViaWebAudio(videoFile, onProgress);
      return {
        audioBlob: blob,
        audioFilename: "extracted-audio.wav",
        durationSeconds: duration,
        method: "web-audio",
        notice: "Extracted mono 16 kHz audio using browser audio engine.",
      };
    }
  } catch (webAudioErr) {
    console.warn("Web Audio API extraction failed (falling back to original video upload):", webAudioErr);
  }

  // 3. Graceful Fallback: Upload original video directly to transcription route
  return {
    audioBlob: videoFile,
    audioFilename: videoFile instanceof File ? videoFile.name : "video.mp4",
    durationSeconds: 0,
    method: "original-fallback",
    notice: "Browser extraction unavailable; uploading media directly for transcription.",
  };
}

/**
 * Captures a video frame client-side to generate a video poster thumbnail.
 */
export async function captureVideoThumbnail(
  videoFile: File | Blob,
  seekSeconds = 1.0
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("Video thumbnail capture requires a browser DOM."));
      return;
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(videoFile);
    video.src = objectUrl;

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(seekSeconds, Math.max(0.1, video.duration / 2));
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Unable to create canvas context for thumbnail."));
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) {
            resolve({ blob, dataUrl, width: canvas.width, height: canvas.height });
          } else {
            reject(new Error("Failed to convert thumbnail canvas to blob."));
          }
        },
        "image/jpeg",
        0.85
      );
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to decode video frame for thumbnail."));
    };
  });
}
