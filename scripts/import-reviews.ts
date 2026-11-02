/**
 * Partner review importer script (Spec Section 16)
 * Loads real reviews from CSV or JSON files supplied by partner communities
 * (with contributor consent), flagged source = 'imported' and verification_status = 'none'.
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { StructuredReviewSchema } from "../lib/schema/review";

interface RawImportRecord {
  vehicle_slug: string;
  user_handle?: string;
  variant?: string;
  model_year?: number;
  raw_text?: string;
  transcript?: string;
  structured_data?: Record<string, unknown>;
}

async function runImport() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log("Usage: tsx scripts/import-reviews.ts <path-to-file.json>");
    console.log("Flagged with: source = 'imported', verification_status = 'none'");
    return;
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn("⚠️ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Printing dry-run report:");
    const fileContent = fs.readFileSync(resolvedPath, "utf-8");
    const records = JSON.parse(fileContent) as RawImportRecord[];
    console.log(`Parsed ${records.length} records successfully for import.`);
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const fileContent = fs.readFileSync(resolvedPath, "utf-8");
  const records = JSON.parse(fileContent) as RawImportRecord[];

  console.log(`Importing ${records.length} partner reviews...`);

  for (let idx = 0; idx < records.length; idx++) {
    const item = records[idx];
    // 1. Resolve vehicle
    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles")
      .select("id")
      .eq("slug", item.vehicle_slug)
      .single();

    if (vErr || !vehicle) {
      console.warn(`[Skip #${idx + 1}] Vehicle slug '${item.vehicle_slug}' not found in database.`);
      continue;
    }

    // 2. Validate structured data if provided
    let validatedStructured = {};
    if (item.structured_data) {
      const parsed = StructuredReviewSchema.safeParse(item.structured_data);
      if (parsed.success) {
        validatedStructured = parsed.data;
      }
    }

    // 3. Insert imported review
    const { error: insErr } = await supabase.from("reviews").insert({
      vehicle_id: vehicle.id,
      user_id: "00000000-0000-0000-0000-000000000001", // System / partner ingest account
      variant: item.variant || null,
      model_year: item.model_year || null,
      status: "published",
      processing_state: "confirmed",
      source_types: ["imported"],
      raw_text: item.raw_text || null,
      transcript: item.transcript || null,
      structured: validatedStructured,
      verification_status: "none", // Explicitly unverified as mandated by spec
      is_demo: false,
      published_at: new Date().toISOString(),
    });

    if (insErr) {
      console.error(`[Error #${idx + 1}] Insert failed:`, insErr.message);
    } else {
      console.log(`[Imported #${idx + 1}] Successfully added imported review for ${item.vehicle_slug}`);
    }
  }

  console.log("Import pipeline complete.");
}

runImport().catch((err) => {
  console.error("Fatal import error:", err);
  process.exit(1);
});
