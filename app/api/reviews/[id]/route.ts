import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/server-auth";
import { getRepository } from "@/lib/repository";
import { StructuredReviewSchema } from "@/lib/schema/review";
import { ApiResponse, Review } from "@/lib/types";

const PatchReviewSchema = z.object({
  structured: StructuredReviewSchema.optional(),
  raw_text: z.string().max(6000).nullable().optional(),
  variant: z.string().nullable().optional(),
  model_year: z.number().int().nullable().optional(),
  purchase_month: z.string().nullable().optional(),
  status: z.enum(["draft", "pending_verification", "published", "rejected", "removed"]).optional(),
  processing_state: z
    .enum(["uploaded", "transcribing", "extracting", "needs_confirm", "confirmed", "failed"])
    .optional(),
  video_url: z.string().nullable().optional(),
  poster_url: z.string().nullable().optional(),
  photo_urls: z.array(z.string()).optional(),
  media: z
    .array(
      z.object({
        kind: z.enum(["video", "audio", "photo", "odometer"]),
        storage_path: z.string(),
        duration_s: z.number().nullable().optional(),
        timestamp: z.string().nullable().optional(),
      })
    )
    .optional(),
});

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<Review>>> {
  const { id } = params;
  const repo = getRepository();

  const review = await repo.getReviewById(id);

  // If review is published, anyone can view it publicly
  if (review && review.status === "published") {
    return NextResponse.json({ ok: true, data: review });
  }

  // Unpublished drafts and non-existent IDs require authentication (prevents ID enumeration)
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Authentication required to view unpublished drafts." },
      { status: 401 }
    );
  }

  if (!review) {
    return NextResponse.json({ ok: false, error: "Review not found." }, { status: 404 });
  }

  const isOwner = review.user_id === user.id;
  const isAdmin = user.role === "admin";

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized access to this review draft." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, data: review });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<Review>>> {
  const { id } = params;
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required to edit review." }, { status: 401 });
  }

  const repo = getRepository();
  const existing = await repo.getReviewById(id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Review not found." }, { status: 404 });
  }

  const isOwner = existing.user_id === user.id;
  const isAdmin = user.role === "admin";

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized to modify this review draft." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON in request body." }, { status: 400 });
  }

  const parsed = PatchReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: `Validation error: ${parsed.error.errors.map((e) => e.message).join(", ")}` },
      { status: 400 }
    );
  }

  // Security check: Mock-extracted reviews cannot be published
  if (parsed.data.status === "published" && (existing.structured?.mock || parsed.data.structured?.mock)) {
    return NextResponse.json(
      { ok: false, error: "Mock-extracted reviews are prohibited from being published. Real model verification is required." },
      { status: 400 }
    );
  }

  try {
    const updated = await repo.updateReview(id, parsed.data);
    return NextResponse.json({ ok: true, data: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: `Failed to update review: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
