/**
 * Milestone 2: Real LLM Extraction Test Script
 * Tests extraction across 3 sample inputs:
 * 1. English text review
 * 2. Hinglish text review
 * 3. Non-review input (must trigger {"error": "not_a_review"})
 *
 * Rules:
 * Must run against the real LLM when a key is present.
 * If GEMINI_API_KEY is missing, prints "SKIPPED: no real key" with a non-zero warning.
 * Never passes silently against a mock.
 */

import { GeminiLLMProvider } from "../lib/providers/llm";
import { verifyEvidenceQuotes } from "../lib/schema/quote-verifier";

const SAMPLE_1_ENGLISH = `
I have driven my Mahindra Thar LX Diesel for 14 months and covered 18,500 km.
The 2.2L mHawk engine is a gem on the highway with massive torque.
Real world fuel economy is 11.5 kmpl in mixed conditions with AC on.
My only real complaint is the heavy clutch in stop-and-go city traffic which causes left knee pain.
Annual service at Mahindra cost me around 14,000 INR for routine fluid changes.
I would definitely buy it again because of the unmatched road presence and touring ability.
`;

const SAMPLE_2_HINGLISH = `
Maine Thar 1 saal pehle li thi aur abhi tak 15000 km chala chuka hoon.
Highway pe gaadi bilkul makhan chalti hai, stability bahut badhiya hai.
Lekin city ke traffic me clutch bahut zyada heavy lagta hai.
Mileage mujhe lagbhag 12 kmpl mil rahi hai AC on karke.
Pehli service free thi, doosri service me 6000 rupaye lage the.
Agar weekend touring karni hai toh best gaadi hai, but daily office commute ke liye avoid karo.
`;

const SAMPLE_3_NON_REVIEW = `
Can you give me a recipe for authentic Italian pasta carbonara with eggs and guanciale?
Make sure to explain how to avoid scrambling the eggs when mixing with cheese.
`;

async function runExtractionTests() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "your-gemini-api-key") {
    console.warn("\n=======================================================");
    console.warn("WARNING: SKIPPED: no real key (GEMINI_API_KEY not configured)");
    console.warn("Real LLM extraction tests require a valid Google AI Studio key.");
    console.warn("Add GEMINI_API_KEY to .env.local to exercise real Gemini Flash.");
    console.warn("=======================================================\n");
    // Exit with non-zero warning code (code 2 = warning/skipped) so it never passes silently
    process.exit(2);
  }

  const model = process.env.LLM_MODEL || "gemini-1.5-flash";
  console.log(`Running extraction tests against real Gemini API (${model})...\n`);

  const llm = new GeminiLLMProvider(apiKey, model);
  const vehicle = { make: "Mahindra", model: "Thar", category: "car" };

  // Test 1: English review
  console.log("--- TEST 1: English Review Extraction ---");
  try {
    const res1 = await llm.extractStructuredReview(SAMPLE_1_ENGLISH, vehicle);
    if ("error" in res1) {
      console.error("Test 1 Failed: Unexpected rejection", res1);
    } else {
      console.log("Test 1 Passed: Valid structured review extracted.");
      console.log(`  KM Driven: ${res1.km_driven}`);
      console.log(`  Mileage: ${res1.real_mileage?.value} ${res1.real_mileage?.unit}`);
      console.log(`  Would Buy Again: ${res1.would_buy_again}`);
      console.log(`  Issues logged: ${res1.issues.length}`);

      const { verified, dropped } = verifyEvidenceQuotes(res1.evidence || [], [SAMPLE_1_ENGLISH]);
      console.log(`  Quotes Verified: ${verified.length}, Dropped: ${dropped.length}`);
    }
  } catch (err) {
    console.error("Test 1 Error:", err);
  }

  // Test 2: Hinglish review
  console.log("\n--- TEST 2: Hinglish Review Extraction ---");
  try {
    const res2 = await llm.extractStructuredReview(SAMPLE_2_HINGLISH, vehicle);
    if ("error" in res2) {
      console.error("Test 2 Failed: Unexpected rejection", res2);
    } else {
      console.log("Test 2 Passed: Hinglish review successfully mapped to English schema.");
      console.log(`  KM Driven: ${res2.km_driven}`);
      console.log(`  Mileage: ${res2.real_mileage?.value} ${res2.real_mileage?.unit}`);
      console.log(`  Pros: ${res2.pros.join(", ")}`);
    }
  } catch (err) {
    console.error("Test 2 Error:", err);
  }

  // Test 3: Non-review prompt injection / unrelated prompt
  console.log("\n--- TEST 3: Non-Review Classification ---");
  try {
    const res3 = await llm.extractStructuredReview(SAMPLE_3_NON_REVIEW, vehicle);
    if ("error" in res3 && res3.error === "not_a_review") {
      console.log("Test 3 Passed: Correctly identified unrelated content and returned {\"error\":\"not_a_review\"}.");
    } else {
      console.error("Test 3 Failed: Non-review was not rejected!", res3);
    }
  } catch (err) {
    console.error("Test 3 Error:", err);
  }
}

runExtractionTests();
