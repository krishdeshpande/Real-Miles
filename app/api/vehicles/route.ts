import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SEED_VEHICLES } from "@/lib/data/seed-vehicles";

const QuerySchema = z.object({
  category: z.enum(["car", "bike"]).optional(),
  query: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    category: url.searchParams.get("category") || undefined,
    query: url.searchParams.get("query") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid query parameters." },
      { status: 400 }
    );
  }

  const { category, query } = parsed.data;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      if (supabase) {
        let q = supabase
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
              verdict_n
            )
          `)
          .order("make", { ascending: true });

        if (category) {
          q = q.eq("category", category);
        }

        const { data, error } = await q;

        if (!error && data && data.length > 0) {
          let filtered = data;
          if (query) {
            const lowerQ = query.toLowerCase();
            filtered = data.filter(
              (v) =>
                v.make.toLowerCase().includes(lowerQ) ||
                v.model.toLowerCase().includes(lowerQ) ||
                v.slug.toLowerCase().includes(lowerQ)
            );
          }
          return NextResponse.json({ ok: true, data: filtered });
        }
      }
    } catch (err) {
      console.error("Supabase vehicle list error:", err);
    }
  }

  // Fallback to SEED_VEHICLES
  let vehicles = SEED_VEHICLES.map((v) => ({
    ...v,
    vehicle_aggregates: [
      {
        n_reviews: 0,
        stats: {},
        verdict_text: null,
        verdict_n: 0,
      },
    ],
  }));

  if (category) {
    vehicles = vehicles.filter((v) => v.category === category);
  }

  if (query) {
    const lowerQ = query.toLowerCase();
    vehicles = vehicles.filter(
      (v) =>
        v.make.toLowerCase().includes(lowerQ) ||
        v.model.toLowerCase().includes(lowerQ) ||
        v.slug.toLowerCase().includes(lowerQ)
    );
  }

  return NextResponse.json({ ok: true, data: vehicles });
}
