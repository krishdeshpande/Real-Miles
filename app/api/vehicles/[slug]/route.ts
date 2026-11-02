import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SEED_VEHICLES } from "@/lib/data/seed-vehicles";

const ParamsSchema = z.object({
  slug: z.string().min(1),
});

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const parseResult = ParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid vehicle slug parameter." },
      { status: 400 }
    );
  }

  const { slug } = parseResult.data;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      if (supabase) {
        const { data: vehicle, error } = await supabase
          .from("vehicles")
          .select(`
            id,
            slug,
            make,
            model,
            category,
            fuel_type,
            hero_path,
            created_at,
            vehicle_aggregates (
              n_reviews,
              stats,
              verdict_text,
              verdict_n,
              verdict_updated_at
            )
          `)
          .eq("slug", slug)
          .single();

        if (error || !vehicle) {
          // Check fallback seed
          const seedMatch = SEED_VEHICLES.find((v) => v.slug === slug);
          if (seedMatch) {
            return NextResponse.json({
              ok: true,
              data: {
                ...seedMatch,
                aggregates: {
                  n_reviews: 0,
                  stats: {},
                  verdict_text: null,
                  verdict_n: 0,
                },
              },
            });
          }
          return NextResponse.json(
            { ok: false, error: `Vehicle '${slug}' not found.` },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ok: true,
          data: vehicle,
        });
      }
    } catch (err: unknown) {
      console.error("Database query failed:", err);
    }
  }

  // Fallback to in-memory seed vehicles
  const seedMatch = SEED_VEHICLES.find((v) => v.slug === slug);
  if (!seedMatch) {
    return NextResponse.json(
      { ok: false, error: `Vehicle '${slug}' not found.` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      ...seedMatch,
      aggregates: {
        n_reviews: 0,
        stats: {},
        verdict_text: null,
        verdict_n: 0,
      },
    },
  });
}
