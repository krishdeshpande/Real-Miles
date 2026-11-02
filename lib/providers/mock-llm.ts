import { StructuredReview, StructuredReviewSchema } from "@/lib/schema/review";

export function generateMockStructuredExtraction(
  inputText: string,
  vehicleName: string
): StructuredReview | { error: "not_a_review" } {
  const lower = inputText.toLowerCase();

  // 1. Check for non-review content
  const autoKeywords = [
    "car", "bike", "motorcycle", "vehicle", "drive", "ride", "mileage",
    "km", "engine", "service", "clutch", "gear", "brake", "highway", "city",
    "thar", "harrier", "creta", "duke", "himalayan", "classic", "bmw", "suspension"
  ];
  const hasAutoContext = autoKeywords.some((k) => lower.includes(k));

  if (!hasAutoContext && inputText.length < 50) {
    return { error: "not_a_review" };
  }

  // 2. Extract km_driven using regex
  let kmDriven: number | null = null;
  const kmMatch = lower.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:km|kms|kilometer|kilometres)/);
  if (kmMatch) {
    kmDriven = parseInt(kmMatch[1].replace(/,/g, ""), 10);
  }

  // 3. Extract ownership months
  let ownershipMonths: number | null = null;
  const monthMatch = lower.match(/(\d+)\s*(?:month|months)/);
  const yearMatch = lower.match(/(\d+)\s*(?:year|years|yr|yrs)/);
  if (monthMatch) {
    ownershipMonths = parseInt(monthMatch[1], 10);
  } else if (yearMatch) {
    ownershipMonths = parseInt(yearMatch[1], 10) * 12;
  }

  // 4. Extract real mileage
  let realMileageVal: number | null = null;
  const mileageMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:kmpl|km\/l|kmp)/);
  if (mileageMatch) {
    realMileageVal = parseFloat(mileageMatch[1]);
  }

  // 5. Extract issues
  const issues = [];
  const evidence = [];

  if (lower.includes("clutch")) {
    const clutchIdx = lower.indexOf("clutch");
    const snippetStart = Math.max(0, clutchIdx - 15);
    const snippetEnd = Math.min(inputText.length, clutchIdx + 30);
    const verbatimQuote = inputText.slice(snippetStart, snippetEnd).trim();

    issues.push({
      component: "clutch",
      severity: 3,
      description: "Heavy clutch operation observed in dense city traffic.",
      first_seen_month: 2,
      resolved: false,
      cost_inr: null,
    });

    if (verbatimQuote.length > 0) {
      evidence.push({
        field: "issues[0]",
        quote: verbatimQuote.slice(0, 100),
        start_s: null,
        end_s: null,
      });
    }
  }

  if (lower.includes("rattle") || lower.includes("vibration") || lower.includes("noise")) {
    issues.push({
      component: "cabin build",
      severity: 2,
      description: "Minor vibration or interior trim rattle over rough roads.",
      first_seen_month: 3,
      resolved: false,
      cost_inr: null,
    });
  }

  // 6. Would buy again
  let wouldBuyAgain: "yes" | "no" | "maybe" | null = "yes";
  if (lower.includes("would not buy") || lower.includes("regret") || lower.includes("terrible")) {
    wouldBuyAgain = "no";
  } else if (lower.includes("not sure") || lower.includes("mixed feelings") || lower.includes("maybe")) {
    wouldBuyAgain = "maybe";
  }

  // 7. Pros & Cons
  const pros: string[] = [];
  const cons: string[] = [];

  if (lower.includes("highway") || lower.includes("stability") || lower.includes("power")) {
    pros.push("Strong highway stability and power delivery");
  }
  if (lower.includes("comfortable") || lower.includes("comfort")) {
    pros.push("Plush ride comfort on uneven roads");
  }
  if (pros.length === 0) {
    pros.push(`Solid road presence and driving dynamics for the ${vehicleName}`);
  }

  if (lower.includes("heavy") || lower.includes("stiff")) {
    cons.push("Stiff ride or heavy controls in stop-and-go traffic");
  }
  if (lower.includes("fuel") || lower.includes("mileage") || lower.includes("thirsty")) {
    cons.push("Fuel consumption increases sharply during city traffic");
  }
  if (cons.length === 0) {
    cons.push("Service center turnaround time could be better");
  }

  // 8. Missing fields calculation
  const missingFields: string[] = [];
  if (kmDriven === null) missingFields.push("km_driven");
  if (ownershipMonths === null) missingFields.push("ownership_months");
  if (realMileageVal === null) missingFields.push("real_mileage.value");
  missingFields.push("service.avg_annual_cost_inr");

  const structured: StructuredReview = {
    schema_version: 1,
    mock: true, // Marked explicitly as mock
    ownership_months: ownershipMonths ?? 12,
    km_driven: kmDriven ?? 12000,
    usage_mix: {
      city_pct: 60,
      highway_pct: 35,
      offroad_pct: 5,
    },
    real_mileage: realMileageVal
      ? { value: realMileageVal, unit: "kmpl", conditions: "mixed city and highway" }
      : { value: 12.5, unit: "kmpl", conditions: "mixed, AC on" },
    service: {
      avg_annual_cost_inr: 8500,
      visits: 2,
      experience_rating: 4,
      notes: "Routine scheduled periodic service",
    },
    issues,
    ratings: {
      comfort: 4,
      performance: 4,
      reliability: 4,
      build_quality: 4,
      service_experience: 3,
      value_for_money: 4,
    },
    pros,
    cons,
    would_buy_again: wouldBuyAgain,
    would_change: "Slightly lighter clutch and improved infotainment responsiveness",
    best_for: ["Highway touring", "Weekend road trips"],
    avoid_if: ["Daily bumper to bumper city crawling only"],
    one_line_verdict: `A dependable ${vehicleName} that shines on open roads with honest ownership compromises.`,
    highlight: {
      start_s: 12.0,
      end_s: 24.5,
      reason: "Owner describes heavy clutch in traffic and real-world fuel economy",
    },
    field_confidence: {
      km_driven: kmDriven ? 0.95 : 0.5,
      real_mileage: realMileageVal ? 0.9 : 0.5,
    },
    evidence,
    missing_fields: missingFields,
  };

  return StructuredReviewSchema.parse(structured);
}
