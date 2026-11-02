import { test, describe } from "node:test";
import assert from "node:assert";
import { StructuredReviewSchema, EvidenceItem } from "../lib/schema/review";
import { verifyEvidenceQuotes } from "../lib/schema/quote-verifier";

describe("Milestone 2: Structured Review Schema Validation", () => {
  test("accepts valid complete review payload", () => {
    const validData = {
      schema_version: 1,
      mock: false,
      ownership_months: 14,
      km_driven: 18500,
      usage_mix: { city_pct: 60, highway_pct: 30, offroad_pct: 10 },
      real_mileage: { value: 11.5, unit: "kmpl", conditions: "mixed, AC on" },
      service: { avg_annual_cost_inr: 14000, visits: 3, experience_rating: 4, notes: "" },
      issues: [{ component: "clutch", severity: 3, description: "heavy in traffic", first_seen_month: 2, resolved: false, cost_inr: null }],
      ratings: { comfort: 4, performance: 5, reliability: 3, build_quality: 4, service_experience: 4, value_for_money: 3 },
      pros: ["strong highway stability"],
      cons: ["heavy clutch"],
      would_buy_again: "yes",
      would_change: "softer clutch",
      best_for: ["weekend touring"],
      avoid_if: ["daily bumper to bumper commute"],
      one_line_verdict: "Capable highway cruiser with a heavy clutch in traffic.",
      highlight: null,
      field_confidence: { km_driven: 0.9, real_mileage: 0.6 },
      evidence: [{ field: "issues[0]", quote: "heavy in traffic", start_s: 31.2, end_s: 36.0 }],
      missing_fields: [],
    };

    const parsed = StructuredReviewSchema.parse(validData);
    assert.strictEqual(parsed.schema_version, 1);
    assert.strictEqual(parsed.km_driven, 18500);
    assert.strictEqual(parsed.would_buy_again, "yes");
  });

  test("accepts minimal schema with null fields and marks missing_fields", () => {
    const minimalData = {
      schema_version: 1,
      mock: true,
      ownership_months: null,
      km_driven: null,
      usage_mix: null,
      real_mileage: null,
      service: null,
      issues: [],
      ratings: null,
      pros: [],
      cons: [],
      would_buy_again: null,
      would_change: null,
      best_for: [],
      avoid_if: [],
      one_line_verdict: null,
      highlight: null,
      field_confidence: {},
      evidence: [],
      missing_fields: ["km_driven", "ownership_months", "real_mileage"],
    };

    const parsed = StructuredReviewSchema.parse(minimalData);
    assert.strictEqual(parsed.km_driven, null);
    assert.strictEqual(parsed.mock, true);
    assert.strictEqual(parsed.missing_fields.length, 3);
  });

  test("rejects invalid rating scores outside 1-5", () => {
    const invalidRatingData = {
      schema_version: 1,
      ratings: {
        comfort: 6, // Invalid: exceeds max 5
        performance: 4,
        reliability: 0, // Invalid: below min 1
        build_quality: 3,
        service_experience: 3,
        value_for_money: 3,
      },
    };

    const result = StructuredReviewSchema.safeParse(invalidRatingData);
    assert.strictEqual(result.success, false);
  });

  test("rejects invalid would_buy_again values", () => {
    const invalidBuyAgain = {
      schema_version: 1,
      would_buy_again: "definitely_not", // Invalid enum
    };

    const result = StructuredReviewSchema.safeParse(invalidBuyAgain);
    assert.strictEqual(result.success, false);
  });
});

describe("Milestone 2: Verbatim Evidence Quote Verification", () => {
  const sourceText = "I have owned the Thar for two years. The highway ride is rock solid, but the clutch is super heavy in bumper to bumper traffic.";
  const transcript = "Mileage in Bangalore traffic is roughly 10.5 kmpl with air conditioning running continuously.";

  test("preserves genuine verbatim quote from raw text", () => {
    const evidence: EvidenceItem[] = [
      { field: "pros[0]", quote: "highway ride is rock solid", start_s: null, end_s: null },
    ];

    const result = verifyEvidenceQuotes(evidence, [sourceText, transcript]);
    assert.strictEqual(result.verified.length, 1);
    assert.strictEqual(result.dropped.length, 0);
    assert.strictEqual(result.verified[0].quote, "highway ride is rock solid");
  });

  test("preserves genuine verbatim quote from audio transcript", () => {
    const evidence: EvidenceItem[] = [
      { field: "real_mileage", quote: "roughly 10.5 kmpl with air conditioning", start_s: 5.2, end_s: 9.1 },
    ];

    const result = verifyEvidenceQuotes(evidence, [sourceText, transcript]);
    assert.strictEqual(result.verified.length, 1);
    assert.strictEqual(result.dropped.length, 0);
  });

  test("DROPS fabricated quote that does not appear in source content", () => {
    const evidence: EvidenceItem[] = [
      { field: "issues[0]", quote: "the gearbox failed completely on the highway", start_s: null, end_s: null },
    ];

    const result = verifyEvidenceQuotes(evidence, [sourceText, transcript]);
    assert.strictEqual(result.verified.length, 0);
    assert.strictEqual(result.dropped.length, 1);
    assert.match(result.dropped[0].reason, /Fabricated quote/);
  });

  test("DROPS quotes that exceed 25 words", () => {
    const longQuote = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three twenty-four twenty-five twenty-six";
    const evidence: EvidenceItem[] = [
      { field: "cons[0]", quote: longQuote, start_s: null, end_s: null },
    ];

    const result = verifyEvidenceQuotes(evidence, [longQuote]);
    assert.strictEqual(result.verified.length, 0);
    assert.strictEqual(result.dropped.length, 1);
    assert.match(result.dropped[0].reason, /exceeds 25 words/);
  });
});
