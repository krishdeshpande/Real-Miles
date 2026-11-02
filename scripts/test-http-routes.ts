/**
 * HTTP-Level Integration Test Suite
 * Tests actual HTTP responses by sending real fetch requests to the Next.js server.
 */

async function runHttpTests() {
  const PORT = process.env.TEST_PORT || "3005";
  const BASE_URL = `http://localhost:${PORT}`;

  console.log(`Executing HTTP tests against ${BASE_URL}...\n`);

  const results: Array<{ test: string; expected: number; actual: number; passed: boolean; note?: string }> = [];

  async function recordTest(
    name: string,
    expected: number,
    fn: () => Promise<Response>
  ) {
    try {
      const res = await fn();
      const passed = res.status === expected;
      results.push({ test: name, expected, actual: res.status, passed });
      const mark = passed ? "PASS" : "FAIL";
      console.log(`[${mark}] ${name} -> Expected HTTP ${expected}, Got HTTP ${res.status}`);
      return res;
    } catch (err) {
      results.push({ test: name, expected, actual: 0, passed: false, note: String(err) });
      console.log(`[FAIL] ${name} -> Network error: ${err}`);
      return null;
    }
  }

  // 1. Unauthenticated Requests (Must all return 401)
  console.log("--- 1. Testing Unauthenticated Route Rejections (Expected 401) ---");

  await recordTest("POST /api/reviews/draft without auth", 401, () =>
    fetch(`${BASE_URL}/api/reviews/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicle_id: "v0000001-0000-0000-0000-000000000001" }),
    })
  );

  await recordTest("GET /api/reviews/:id without auth", 401, () =>
    fetch(`${BASE_URL}/api/reviews/test-draft-id`, { method: "GET" })
  );

  await recordTest("PATCH /api/reviews/:id without auth", 401, () =>
    fetch(`${BASE_URL}/api/reviews/test-draft-id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: "new text" }),
    })
  );

  await recordTest("POST /api/reviews/:id/transcribe without auth", 401, () =>
    fetch(`${BASE_URL}/api/reviews/test-draft-id/transcribe`, { method: "POST" })
  );

  await recordTest("POST /api/reviews/:id/extract without auth", 401, () =>
    fetch(`${BASE_URL}/api/reviews/test-draft-id/extract`, { method: "POST" })
  );

  await recordTest("POST /api/uploads/sign without auth", 401, () =>
    fetch(`${BASE_URL}/api/uploads/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "audio.webm",
        mimeType: "audio/webm",
        kind: "audio",
        sizeBytes: 1000,
      }),
    })
  );

  // 2. User A creates review, User B attempts unauthorized access (Expected 403)
  console.log("\n--- 2. Testing Cross-User Access Control (Expected 403) ---");
  const userAHeaders = { "Content-Type": "application/json", "x-user-id": "user-a-123" };
  const userBHeaders = { "Content-Type": "application/json", "x-user-id": "user-b-456" };

  const createRes = await fetch(`${BASE_URL}/api/reviews/draft`, {
    method: "POST",
    headers: userAHeaders,
    body: JSON.stringify({
      vehicle_id: "v0000001-0000-0000-0000-000000000001",
      raw_text: "User A review text",
    }),
  });
  const createJson = await createRes.json();
  const reviewAId = createJson.data?.id;

  if (reviewAId) {
    await recordTest("User B GET User A's unpublished draft", 403, () =>
      fetch(`${BASE_URL}/api/reviews/${reviewAId}`, {
        method: "GET",
        headers: userBHeaders,
      })
    );

    await recordTest("User B PATCH User A's draft", 403, () =>
      fetch(`${BASE_URL}/api/reviews/${reviewAId}`, {
        method: "PATCH",
        headers: userBHeaders,
        body: JSON.stringify({ raw_text: "Hijacked by User B" }),
      })
    );
  } else {
    console.error("Failed to seed initial User A review for cross-user test.");
  }

  // 3. Zod Payload Validation on PATCH (Expected 400)
  console.log("\n--- 3. Testing Zod Validation on Invalid PATCH (Expected 400) ---");
  if (reviewAId) {
    await recordTest("PATCH review with invalid model_year type", 400, () =>
      fetch(`${BASE_URL}/api/reviews/${reviewAId}`, {
        method: "PATCH",
        headers: userAHeaders,
        body: JSON.stringify({ model_year: "two_thousand_twenty" }),
      })
    );
  }

  // 4. Upload Sign Validation (Oversized, Wrong Mime, Overlength Audio - Expected 400)
  console.log("\n--- 4. Testing Upload Sign Rejections (Expected 400) ---");
  await recordTest("Upload sign: oversized audio (>25MB)", 400, () =>
    fetch(`${BASE_URL}/api/uploads/sign`, {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        filename: "giant.mp3",
        mimeType: "audio/mpeg",
        kind: "audio",
        sizeBytes: 30 * 1024 * 1024,
      }),
    })
  );

  await recordTest("Upload sign: wrong mime type (application/x-msdownload)", 400, () =>
    fetch(`${BASE_URL}/api/uploads/sign`, {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        filename: "malware.exe",
        mimeType: "application/x-msdownload",
        kind: "audio",
        sizeBytes: 5000,
      }),
    })
  );

  await recordTest("Upload sign: over-length audio (>180s)", 400, () =>
    fetch(`${BASE_URL}/api/uploads/sign`, {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        filename: "speech.mp3",
        mimeType: "audio/mpeg",
        kind: "audio",
        sizeBytes: 5000,
        durationSeconds: 240,
      }),
    })
  );

  await recordTest("Upload sign: oversized video (>50MB)", 400, () =>
    fetch(`${BASE_URL}/api/uploads/sign`, {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        filename: "giant-video.mp4",
        mimeType: "video/mp4",
        kind: "video",
        sizeBytes: 60 * 1024 * 1024,
        durationSeconds: 45,
      }),
    })
  );

  await recordTest("Upload sign: over-length video (>60s)", 400, () =>
    fetch(`${BASE_URL}/api/uploads/sign`, {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        filename: "long-video.mp4",
        mimeType: "video/mp4",
        kind: "video",
        sizeBytes: 15 * 1024 * 1024,
        durationSeconds: 90,
      }),
    })
  );

  await recordTest("Upload sign: oversized photo (>5MB)", 400, () =>
    fetch(`${BASE_URL}/api/uploads/sign`, {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        filename: "giant-photo.jpg",
        mimeType: "image/jpeg",
        kind: "photo",
        sizeBytes: 8 * 1024 * 1024,
      }),
    })
  );

  // 5. Rate Limit on Submissions (5 per day allowed, 6th triggers 429)
  console.log("\n--- 5. Testing Draft Submission Rate Limiting (5 allowed, 6th triggers 429) ---");
  const rateTestUser = `rate-limit-user-${Date.now()}`;
  const rateHeaders = { "Content-Type": "application/json", "x-user-id": rateTestUser };

  for (let i = 1; i <= 5; i++) {
    const res = await fetch(`${BASE_URL}/api/reviews/draft`, {
      method: "POST",
      headers: rateHeaders,
      body: JSON.stringify({ vehicle_id: "v0000001-0000-0000-0000-000000000001" }),
    });
    console.log(`  Submission #${i}: HTTP ${res.status}`);
  }

  await recordTest("Submission #6 triggers rate limit", 429, () =>
    fetch(`${BASE_URL}/api/reviews/draft`, {
      method: "POST",
      headers: rateHeaders,
      body: JSON.stringify({ vehicle_id: "v0000001-0000-0000-0000-000000000001" }),
    })
  );

  // 6. Security Check: Mock-extracted review cannot be published (Expected 400)
  console.log("\n--- 6. Testing Mock Review Publishing Prohibition (Expected 400) ---");
  const mockReviewRes = await fetch(`${BASE_URL}/api/reviews/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": "mock-pub-test-user" },
    body: JSON.stringify({ vehicle_id: "v0000001-0000-0000-0000-000000000001", raw_text: "sample" }),
  });
  const mockReviewJson = await mockReviewRes.json();
  const mockRevId = mockReviewJson.data?.id;

  if (mockRevId) {
    // First attach mock structured data
    await fetch(`${BASE_URL}/api/reviews/${mockRevId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-id": "mock-pub-test-user" },
      body: JSON.stringify({
        structured: {
          schema_version: 1,
          mock: true,
          km_driven: 10000,
          ownership_months: 6,
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
          missing_fields: [],
        },
      }),
    });

    // Now attempt to publish via PATCH
    await recordTest("Attempting to publish mock review via PATCH route", 400, () =>
      fetch(`${BASE_URL}/api/reviews/${mockRevId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": "mock-pub-test-user" },
        body: JSON.stringify({ status: "published" }),
      })
    );
  }

  console.log("\n=== HTTP TEST SUMMARY ===");
  const allPassed = results.every((r) => r.passed);
  console.log(`Total tests: ${results.length}, Passed: ${results.filter((r) => r.passed).length}, Failed: ${results.filter((r) => !r.passed).length}`);

  if (!allPassed) {
    process.exit(1);
  }
}

runHttpTests();
