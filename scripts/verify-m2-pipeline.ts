/**
 * Milestone 2 Pipeline Verification Script
 * Exercises the repository, mock extraction, quote verification,
 * and review updating logic in DATA_MODE=local.
 */

import { LocalReviewRepository, LocalRateLimiter, LocalStorageProvider } from "../lib/repository";
import { MockLLMProvider } from "../lib/providers/llm";
import { MockSTTProvider } from "../lib/providers/stt";
import { verifyEvidenceQuotes } from "../lib/schema/quote-verifier";

async function verifyM2Pipeline() {
  console.log("=== EXECUTING MILESTONE 2 PIPELINE VERIFICATION ===");

  const repo = new LocalReviewRepository();
  const rateLimiter = new LocalRateLimiter();
  const storage = new LocalStorageProvider();
  const llm = new MockLLMProvider();
  const stt = new MockSTTProvider();

  // 1. Rate limiter test
  console.log("\n[Test 1] Rate Limiter check (5 submissions per day)...");
  const rl1 = await rateLimiter.checkLimit("test-user-rate-check", 5, 86400);
  console.log(`  Allowed: ${rl1.allowed}, Remaining: ${rl1.remaining}`);
  if (!rl1.allowed) throw new Error("Rate limit failed unexpectedly on first request.");

  // 2. Draft creation
  console.log("\n[Test 2] Creating review draft for Mahindra Thar...");
  const draft = await repo.createDraft({
    user_id: "00000000-0000-0000-0000-000000000002",
    vehicle_id: "v0000001-0000-0000-0000-000000000001",
    variant: "LX Diesel 4x4",
    model_year: 2023,
    purchase_month: "2023-04",
    raw_text:
      "I have driven my Thar for 18,500 km over 14 months. Real mileage is 11.5 kmpl with AC on. The clutch is super heavy in bumper to bumper traffic. Highway ride is rock solid.",
    source_types: ["text", "audio"],
  });
  console.log(`  Created draft id: ${draft.id}, Status: ${draft.status}, Processing State: ${draft.processing_state}`);

  // 3. Storage upload endpoint
  console.log("\n[Test 3] Requesting upload slot...");
  const uploadInfo = await storage.getUploadEndpoint("reviews", "test-audio.webm");
  console.log(`  Upload URL: ${uploadInfo.uploadUrl}, Storage Path: ${uploadInfo.storagePath}`);

  // 4. Transcription
  console.log("\n[Test 4] Mock STT transcription...");
  const sttResult = await stt.transcribeAudio(new Uint8Array([1, 2, 3]));
  console.log(`  Transcript length: ${sttResult.transcript.length} chars, Segments: ${sttResult.segments.length}`);

  // 5. Extraction
  console.log("\n[Test 5] Mock LLM extraction with quote verification...");
  const extractionResult = await llm.extractStructuredReview(draft.raw_text || "", {
    make: "Mahindra",
    model: "Thar",
    category: "car",
  });

  if ("error" in extractionResult) {
    throw new Error("Unexpected rejection during mock review extraction");
  }

  console.log(`  Extracted mock flag: ${extractionResult.mock}`);
  console.log(`  KM Driven: ${extractionResult.km_driven}, Real Mileage: ${extractionResult.real_mileage?.value}`);
  console.log(`  Issues detected: ${extractionResult.issues.map((i) => i.component).join(", ")}`);

  // Verify quotes
  const { verified, dropped } = verifyEvidenceQuotes(extractionResult.evidence || [], [draft.raw_text]);
  console.log(`  Quotes Verified: ${verified.length}, Dropped: ${dropped.length}`);

  // 6. Persist structured record
  console.log("\n[Test 6] Updating draft with structured data and transitioning state to needs_confirm...");
  const updatedReview = await repo.updateReview(draft.id, {
    structured: {
      ...extractionResult,
      evidence: verified,
    },
    processing_state: "needs_confirm",
  });
  console.log(`  Updated review processing_state: ${updatedReview.processing_state}`);

  // 7. Verify mock review CANNOT be published
  console.log("\n[Test 7] Verifying security constraint: Mock-extracted review CANNOT be published...");
  let blocked = false;
  try {
    await repo.updateReview(draft.id, { status: "published" });
  } catch (err: unknown) {
    blocked = true;
    console.log(`  Successfully caught and blocked publish attempt: ${(err as Error).message}`);
  }
  if (!blocked) {
    throw new Error("SECURITY FAILURE: Mock review was allowed to be published!");
  }

  console.log("\n=== ALL MILESTONE 2 PIPELINE CHECKS PASSED SUCCESSFULLY ===");
}

verifyM2Pipeline().catch((err) => {
  console.error("Pipeline verification failed:", err);
  process.exit(1);
});
