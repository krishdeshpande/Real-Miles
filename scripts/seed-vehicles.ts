import { createClient } from "@supabase/supabase-js";
import { SEED_VEHICLES } from "../lib/data/seed-vehicles";

async function seedVehicles() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn("NOTICE: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in environment.");
    console.warn("Skipping remote DB seed. The application will use local seed vehicle fallbacks.");
    return;
  }

  console.log(`Connecting to Supabase at: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, serviceKey);

  console.log(`Seeding ${SEED_VEHICLES.length} vehicles into 'vehicles' table...`);

  for (const v of SEED_VEHICLES) {
    const { error } = await supabase.from("vehicles").upsert(
      {
        id: v.id,
        slug: v.slug,
        make: v.make,
        model: v.model,
        category: v.category,
        fuel_type: v.fuel_type,
        hero_path: v.hero_path || null,
        created_at: v.created_at,
      },
      { onConflict: "slug" }
    );

    if (error) {
      console.error(`Failed to upsert vehicle ${v.slug}:`, error.message);
    } else {
      console.log(`Upserted ${v.category}: ${v.make} ${v.model} (${v.slug})`);
    }

    // Initialize vehicle_aggregates entry if missing
    const { error: aggErr } = await supabase.from("vehicle_aggregates").upsert(
      {
        vehicle_id: v.id,
        n_reviews: 0,
        stats: {},
        verdict_text: null,
        verdict_n: 0,
      },
      { onConflict: "vehicle_id" }
    );

    if (aggErr) {
      console.warn(`  Aggregate record init notice for ${v.slug}:`, aggErr.message);
    }
  }

  console.log("Vehicle seeding completed successfully.");
}

seedVehicles().catch((err) => {
  console.error("Fatal error during seeding:", err);
  process.exit(1);
});
