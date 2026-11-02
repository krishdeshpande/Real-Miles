import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server-auth";
import { getRepository, getRateLimiter } from "@/lib/repository";
import { getLLMProvider } from "@/lib/providers/llm";
import { ProviderError } from "@/lib/providers/errors";
import { SEED_VEHICLES } from "@/lib/data/seed-vehicles";
import { verifyEvidenceQuotes } from "@/lib/schema/quote-verifier";
import { ApiResponse, Review } from "@/lib/types";

export const maxDuration = 60; // 60s per Spec Section 3
export const dynamic = "force-dynamic";

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
    return NextResponse.json({ ok: false, error: "Unauthorized access to this review draft." }, { status: 403 });
  }

  // Rate limit: 10 calls per hour per user
  const rateLimiter = getRateLimiter();
  const rl = await rateLimiter.checkLimit(`transcribe_extract:${user.id}`, 10, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Hourly rate limit reached for AI processing. Please wait before retrying." },
      { status: 429 }
    );
  }

  // Resolve vehicle context
  const vehicle = SEED_VEHICLES.find((v) => v.id === review.vehicle_id || v.slug === review.vehicle_id) || {
    make: "Vehicle",
    model: "Model",
    category: "car" as const,
  };

  // Build combined source content with prompt-injection defense delimiters
  const sources: string[] = [];
  if (review.raw_text && review.raw_text.trim()) {
    sources.push(`[Written Notes]: ${review.raw_text.trim()}`);
  }
  if (review.transcript && review.transcript.trim()) {
    sources.push(`[Audio Transcript]: ${review.transcript.trim()}`);
  }

  const combinedContent = sources.join("\n\n");
  if (!combinedContent) {
    return NextResponse.json(
      { ok: false, error: "No review content found. Please provide text or audio before extraction." },
      { status: 400 }
    );
  }

  await repo.updateReview(id, { processing_state: "extracting" });

  try {
    const llm = getLLMProvider();
    const result = await llm.extractStructuredReview(combinedContent, {
      make: vehicle.make,
      model: vehicle.model,
      category: vehicle.category,
    });

    // Check if classifier rejected the review
    if ("error" in result) {
      await repo.updateReview(id, { processing_state: "failed" });
      return NextResponse.json(
        {
          ok: false,
          error: `The submitted content was not recognized as an ownership review of the ${vehicle.make} ${vehicle.model}. Please describe your real driving experience, fuel economy, or issues.`,
          code: "NOT_A_REVIEW",
        },
        { status: 422 }
      );
    }

    const structuredResult = result;

    // Verify evidence quotes verbatim against source content
    const { verified: verifiedEvidence, dropped: droppedQuotes } = verifyEvidenceQuotes(
      structuredResult.evidence || [],
      [review.raw_text, review.transcript]
    );

    if (droppedQuotes.length > 0) {
      console.warn(
        `[Quote Verification] Dropped ${droppedQuotes.length} fabricated or non-verbatim quote(s):`,
        droppedQuotes.map((d) => d.item.quote)
      );
    }

    const cleanedStructured = {
      ...structuredResult,
      evidence: verifiedEvidence,
    };

    // Update review and advance processing state to needs_confirm
    const updated = await repo.updateReview(id, {
      structured: cleanedStructured,
      processing_state: "needs_confirm",
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
      { ok: false, error: `Extraction error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
