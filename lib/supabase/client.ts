import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://your-project-id.supabase.co"
  );
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey && url !== "https://your-project-id.supabase.co") {
    if (!browserClient) {
      browserClient = createBrowserClient(url, anonKey);
    }
    return browserClient;
  }

  // Graceful fallback for local development without live Supabase credentials
  return null;
}
