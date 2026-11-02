/**
 * Environment security and production guard.
 * Refuses execution if mock providers or local file storage modes are enabled in production.
 */

export function validateEnvironment(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const dataMode = process.env.DATA_MODE;
  const llmMode = process.env.LLM_MODE;
  const sttMode = process.env.STT_MODE;

  if (isProduction) {
    if (dataMode === "local") {
      throw new Error(
        "FATAL SECURITY VIOLATION: DATA_MODE=local is forbidden when NODE_ENV=production. You must configure Supabase."
      );
    }
    if (llmMode === "mock") {
      throw new Error(
        "FATAL CONFIGURATION ERROR: LLM_MODE=mock is forbidden when NODE_ENV=production. Live Gemini credentials required."
      );
    }
    if (sttMode === "mock") {
      throw new Error(
        "FATAL CONFIGURATION ERROR: STT_MODE=mock is forbidden when NODE_ENV=production. Live Groq credentials required."
      );
    }
  }

  // Validate that local mode never activates silently
  if (!dataMode && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      "CONFIGURATION ERROR: Neither Supabase nor DATA_MODE=local is configured. To run locally, explicitly set DATA_MODE=local in .env.local."
    );
  }
}
