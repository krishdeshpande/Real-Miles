import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/server-auth";
import { getRepository, getRateLimiter } from "@/lib/repository";
import { ApiResponse, Review } from "@/lib/types";

const DraftSchema = z.object({
  vehicle_id: z.string().min(1, "Vehicle selection is required"),
  variant: z.string().nullable().optional(),
  model_year: z.number().int().min(1980).max(new Date().getFullYear() + 1).nullable().optional(),
  purchase_month: z.string().nullable().optional(),
  raw_text: z.string().max(6000, "Text review exceeds 6000 character limit").nullable().optional(),
  source_types: z.array(z.string()).default([]),
  media_path: z.string().nullable().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Review>>> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required to create a review draft." }, { status: 401 });
  }

  // Rate limit: 5 submissions per day per user (Spec section 14 & Scope item 6)
  const rateLimiter = getRateLimiter();
  const rl = await rateLimiter.checkLimit(`review_submit:${user.id}`, 5, 86400);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Submission rate limit reached: Maximum 5 reviews per day allowed per user." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON in request body." }, { status: 400 });
  }

  const parsed = DraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: `Validation error: ${parsed.error.errors.map((e) => e.message).join(", ")}` },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const repo = getRepository();

  try {
    const draft = await repo.createDraft({
      user_id: user.id,
      vehicle_id: data.vehicle_id,
      variant: data.variant || null,
      model_year: data.model_year || null,
      purchase_month: data.purchase_month || null,
      raw_text: data.raw_text || null,
      source_types: data.source_types,
      processing_state: "uploaded",
    });

    return NextResponse.json({ ok: true, data: draft });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: `Failed to create review draft: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
