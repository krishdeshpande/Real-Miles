import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/server-auth";
import { getStorageProvider, getRateLimiter } from "@/lib/repository";
import { ApiResponse } from "@/lib/types";

const SignUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  kind: z.enum(["audio", "photo", "video", "odometer"]),
  sizeBytes: z.number().positive(),
  durationSeconds: z.number().positive().optional(),
});

// Spec Section 3 limits:
// video: up to 60s and 50MB
// audio: up to 3 min (180s) and 25MB
// photos/odometer: up to 8 per review at 5MB each
const MAX_SIZES = {
  audio: 25 * 1024 * 1024, // 25 MB
  photo: 5 * 1024 * 1024,  // 5 MB
  video: 50 * 1024 * 1024, // 50 MB
  odometer: 5 * 1024 * 1024, // 5 MB
};

const ALLOWED_MIME_TYPES = {
  audio: ["audio/wav", "audio/webm", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/x-m4a", "audio/aac"],
  photo: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  odometer: ["image/jpeg", "image/png", "image/webp"],
};

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ uploadUrl: string; storagePath: string }>>> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required to upload media." }, { status: 401 });
  }

  // Rate limit: 20 upload signs per hour
  const rateLimiter = getRateLimiter();
  const rl = await rateLimiter.checkLimit(`upload_sign:${user.id}`, 20, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Upload rate limit reached. Please wait before requesting another upload slot." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON request body." }, { status: 400 });
  }

  const parseResult = SignUploadSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { ok: false, error: `Validation error: ${parseResult.error.errors.map((e) => e.message).join(", ")}` },
      { status: 400 }
    );
  }

  const { filename, mimeType, kind, sizeBytes, durationSeconds } = parseResult.data;

  // Validate size
  const maxSize = MAX_SIZES[kind];
  if (sizeBytes > maxSize) {
    return NextResponse.json(
      { ok: false, error: `File size exceeds allowed limit of ${maxSize / (1024 * 1024)}MB for ${kind}.` },
      { status: 400 }
    );
  }

  // Validate audio duration if provided
  if (kind === "audio" && durationSeconds && durationSeconds > 180) {
    return NextResponse.json(
      { ok: false, error: "Audio review exceeds maximum allowed duration of 3 minutes." },
      { status: 400 }
    );
  }

  // Validate video duration if provided (Spec Section 3 & Scope: 60s cap)
  if (kind === "video" && durationSeconds && durationSeconds > 60) {
    return NextResponse.json(
      { ok: false, error: "Video review exceeds maximum allowed duration of 60 seconds." },
      { status: 400 }
    );
  }

  // Validate mime type
  const allowed = ALLOWED_MIME_TYPES[kind];
  if (!allowed.some((m) => mimeType.toLowerCase().startsWith(m.toLowerCase()) || m.toLowerCase() === mimeType.toLowerCase())) {
    return NextResponse.json(
      { ok: false, error: `Unsupported media format '${mimeType}' for ${kind}. Allowed: ${allowed.join(", ")}` },
      { status: 400 }
    );
  }

  const bucket = kind === "odometer" ? "odometers" : "reviews";
  const storage = getStorageProvider();

  try {
    const endpoint = await storage.getUploadEndpoint(bucket, filename);
    return NextResponse.json({ ok: true, data: endpoint });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: `Failed to generate upload URL: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
