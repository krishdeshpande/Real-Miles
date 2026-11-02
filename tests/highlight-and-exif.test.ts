import { test, describe } from "node:test";
import assert from "node:assert";
import { clampHighlight, MIN_HIGHLIGHT_DURATION, MAX_HIGHLIGHT_DURATION } from "../lib/video/highlight";
import { stripExifGpsFromBuffer } from "../lib/media/photo-processor";
import { StructuredReviewSchema } from "../lib/schema/review";

describe("Milestone 3: Highlight Clamping (Spec Section 7 & 13)", () => {
  test("returns null for null, undefined, or invalid highlight", () => {
    assert.strictEqual(clampHighlight(null, 60), null);
    assert.strictEqual(clampHighlight(undefined, 60), null);
    assert.strictEqual(clampHighlight({ start_s: NaN, end_s: 10 }, 60), null);
    assert.strictEqual(clampHighlight({ start_s: 10, end_s: 20 }, 0), null);
    assert.strictEqual(clampHighlight({ start_s: 10, end_s: 20 }, -5), null);
  });

  test("clamps span shorter than 8 seconds to minimum 8 seconds", () => {
    // 5-second span (10 to 15) should expand to 8s (10 to 18)
    const clamped = clampHighlight({ start_s: 10, end_s: 15, reason: "Quick clip" }, 60);
    assert.notStrictEqual(clamped, null);
    assert.strictEqual(clamped!.start_s, 10);
    assert.strictEqual(clamped!.end_s, 18);
    assert.strictEqual(clamped!.end_s - clamped!.start_s, MIN_HIGHLIGHT_DURATION);
  });

  test("clamps span longer than 25 seconds to maximum 25 seconds", () => {
    // 35-second span (5 to 40) should clamp to 25s (5 to 30)
    const clamped = clampHighlight({ start_s: 5, end_s: 40, reason: "Long clip" }, 60);
    assert.notStrictEqual(clamped, null);
    assert.strictEqual(clamped!.start_s, 5);
    assert.strictEqual(clamped!.end_s, 30);
    assert.strictEqual(clamped!.end_s - clamped!.start_s, MAX_HIGHLIGHT_DURATION);
  });

  test("clamps negative start time to 0", () => {
    const clamped = clampHighlight({ start_s: -5, end_s: 10 }, 60);
    assert.notStrictEqual(clamped, null);
    assert.strictEqual(clamped!.start_s, 0);
    assert.strictEqual(clamped!.end_s, 10);
  });

  test("clamps end time to mediaDuration when exceeding video boundary", () => {
    // Media duration is 20s, highlight requested 15 to 25
    const clamped = clampHighlight({ start_s: 15, end_s: 25 }, 20);
    assert.notStrictEqual(clamped, null);
    assert.ok(clamped!.end_s <= 20);
    assert.ok(clamped!.start_s >= 0);
    // Span must still respect MIN_HIGHLIGHT_DURATION if total media >= 8s
    assert.strictEqual(clamped!.end_s - clamped!.start_s, MIN_HIGHLIGHT_DURATION);
    assert.strictEqual(clamped!.end_s, 20);
    assert.strictEqual(clamped!.start_s, 12);
  });

  test("preserves valid highlight spans between 8 and 25 seconds", () => {
    const clamped = clampHighlight({ start_s: 12.5, end_s: 24.5, reason: "Exhaust sound" }, 60);
    assert.notStrictEqual(clamped, null);
    assert.strictEqual(clamped!.start_s, 12.5);
    assert.strictEqual(clamped!.end_s, 24.5);
    assert.strictEqual(clamped!.reason, "Exhaust sound");
  });
});

describe("Milestone 3: Photo EXIF Stripping (Spec Section 6 & 13)", () => {
  test("passes through non-JPEG buffers safely", () => {
    const nonJpeg = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]); // PNG header
    const result = stripExifGpsFromBuffer(nonJpeg);
    assert.strictEqual(result.gpsRemoved, false);
    assert.deepStrictEqual(result.buffer, nonJpeg);
  });

  test("strips GPS metadata from JPEG buffer while extracting timestamp", () => {
    // Construct a mock JPEG buffer with SOI + APP1 containing GPS and timestamp + EOI
    const soi = Buffer.from([0xff, 0xd8]);
    const eoi = Buffer.from([0xff, 0xd9]);

    // Construct an APP1 marker: 0xFF, 0xE1, length (2 bytes BE), content
    const dateStr = "2026:03:15 14:30:00";
    const app1Payload = Buffer.concat([
      Buffer.from("Exif\0\0"),
      Buffer.from("II*\0"), // TIFF header
      Buffer.from([0x08, 0x00, 0x00, 0x00]), // IFD0 offset
      Buffer.from(`DateTimeOriginal\0${dateStr}\0`),
      Buffer.from("GPS Info tag: "),
      Buffer.from([0x88, 0x25]), // Tag 0x8825 (GPSInfo tag in EXIF)
      Buffer.from("GPS Latitude: 18.5204 N, Longitude: 73.8567 E"),
    ]);

    const app1Length = app1Payload.length + 2;
    const lengthBuf = Buffer.alloc(2);
    lengthBuf.writeUInt16BE(app1Length, 0);

    const app1Segment = Buffer.concat([
      Buffer.from([0xff, 0xe1]),
      lengthBuf,
      app1Payload,
    ]);

    const fullJpeg = Buffer.concat([soi, app1Segment, eoi]);

    // Verify mock JPEG starts with GPS indicator before processing
    assert.ok(fullJpeg.includes(Buffer.from("GPS")));
    assert.ok(fullJpeg.includes(Buffer.from([0x88, 0x25])));

    // Process buffer
    const result = stripExifGpsFromBuffer(fullJpeg);

    // 1. Assert GPS was flagged and removed
    assert.strictEqual(result.gpsRemoved, true);

    // 2. Assert GPS tag and string are scrubbed from cleaned buffer
    assert.ok(!result.buffer.includes(Buffer.from("GPS Latitude")));
    assert.ok(!result.buffer.includes(Buffer.from([0x88, 0x25])));

    // 3. Assert capture timestamp is preserved in ISO format
    assert.strictEqual(result.timestamp, "2026-03-15T14:30:00Z");

    // 4. Assert JPEG SOI and EOI remain intact
    assert.strictEqual(result.buffer[0], 0xff);
    assert.strictEqual(result.buffer[1], 0xd8);
    assert.strictEqual(result.buffer[result.buffer.length - 2], 0xff);
    assert.strictEqual(result.buffer[result.buffer.length - 1], 0xd9);
  });
});

describe("Milestone 3: Review Schema Highlight Integration", () => {
  test("accepts highlight in StructuredReviewSchema", () => {
    const reviewWithHighlight = {
      schema_version: 1,
      mock: true,
      ownership_months: 12,
      km_driven: 15000,
      usage_mix: null,
      real_mileage: null,
      service: null,
      issues: [],
      ratings: null,
      pros: [],
      cons: [],
      would_buy_again: null,
      would_change: null,
      best_for: [],
      avoid_if: [],
      one_line_verdict: "Great vehicle",
      highlight: {
        start_s: 12.0,
        end_s: 24.5,
        reason: "Engine sound and hill climb",
      },
      field_confidence: {},
      evidence: [],
      missing_fields: [],
    };

    const parsed = StructuredReviewSchema.parse(reviewWithHighlight);
    assert.notStrictEqual(parsed.highlight, null);
    assert.strictEqual(parsed.highlight!.start_s, 12.0);
    assert.strictEqual(parsed.highlight!.end_s, 24.5);
    assert.strictEqual(parsed.highlight!.reason, "Engine sound and hill climb");
  });
});
