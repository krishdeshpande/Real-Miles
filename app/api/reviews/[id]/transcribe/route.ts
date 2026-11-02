import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/server-auth";
import { getRepository, getStorageProvider, getRateLimiter } from "@/lib/repository";
import { getSTTProvider } from "@/lib/providers/stt";
import { ProviderError } from "@/lib/providers/errors";
import { ApiResponse, Review } from "@/lib/types";

export const maxDuration = 60; // 60s per Spec Section 3 & 4
export const dynamic = "force-dynamic";

const TranscribeRequestSchema = z.object({
  storagePath: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<Review>>> {
  const { id } = params;
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const repo = getRepository();
  const review = await repo.getReviewById(id);
  if (!review) {
    return NextResponse.json({ ok: false, error: "Review not found." }, { status: 404 });
  }

  if (review.user_id !== user.id && user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Unauthorized access to this review." }, { status: 403 });
  }

  // Rate limit: 10 transcribe and extract calls per hour per user (Scope item 6)
  const rateLimiter = getRateLimiter();
  const rl = await rateLimiter.checkLimit(`transcribe_extract:${user.id}`, 10, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Hourly rate limit reached for AI processing. Please wait before retrying." },
      { status: 429 }
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional if storage path is already linked
  }
  const parsed = TranscribeRequestSchema.safeParse(body);
  const storagePath = parsed.success ? parsed.data.storagePath : undefined;

  // Mark status as transcribing
  await repo.updateReview(id, { processing_state: "transcribing" });

  try {
    const stt = getSTTProvider();

    let audioBuffer: Buffer;
    if (storagePath) {
      const storage = getStorageProvider();
      audioBuffer = await storage.downloadFile("reviews", storagePath);
    } else {
      // In text-only mode or when no audio path is provided, skip transcription
      const updated = await repo.updateReview(id, {
        processing_state: "extracting",
      });
      return NextResponse.json({ ok: true, data: updated });
    }

    const { transcript, segments } = await stt.transcribeAudio(audioBuffer);

    // Update review with transcript and advance to extracting
    const updated = await repo.updateReview(id, {
      transcript,
      transcript_segments: segments,
      processing_state: "extracting",
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err: unknown) {
    await repo.updateReview(id, { processing_state: "failed" });

    if (err instanceof ProviderError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: err.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { ok: false, error: `Transcription failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
