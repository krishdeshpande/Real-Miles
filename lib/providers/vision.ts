export interface OdometerVerificationResult {
  is_dashboard: boolean;
  odometer_km: number | null;
  confidence: number;
}

export interface VisionProvider {
  name: string;
  inspectOdometer(imageBase64: string, mimeType?: string): Promise<OdometerVerificationResult>;
}

export class GeminiVisionProvider implements VisionProvider {
  name = "gemini-vision";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || "";
    this.model = model || process.env.LLM_MODEL || "gemini-1.5-flash";
  }

  async inspectOdometer(imageBase64: string, mimeType = "image/jpeg"): Promise<OdometerVerificationResult> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    const prompt = `Analyze this image for vehicle odometer reading verification.
Return JSON with the following exact structure:
{
  "is_dashboard": boolean, // true if image clearly shows a vehicle dashboard/odometer instrument cluster
  "odometer_km": number or null, // integer number of cumulative kilometers reading displayed, or null if unreadable
  "confidence": number // float between 0.0 and 1.0 representing confidence in detection
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini Vision error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    try {
      const parsed = JSON.parse(text);
      return {
        is_dashboard: Boolean(parsed.is_dashboard),
        odometer_km: typeof parsed.odometer_km === "number" ? Math.round(parsed.odometer_km) : null,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      };
    } catch {
      return {
        is_dashboard: false,
        odometer_km: null,
        confidence: 0,
      };
    }
  }
}

export function getVisionProvider(): VisionProvider {
  return new GeminiVisionProvider();
}
