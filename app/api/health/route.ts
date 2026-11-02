import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const isConfigured = isSupabaseConfigured();
  let dbStatus = "unconfigured_fallback";

  if (isConfigured) {
    try {
      const supabase = await createServerSupabaseClient();
      if (supabase) {
        const { error } = await supabase.from("vehicles").select("id").limit(1);
        dbStatus = error ? `error: ${error.message}` : "connected";
      }
    } catch (err: unknown) {
      dbStatus = `exception: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      supabase_configured: isConfigured,
      database: dbStatus,
      app: process.env.NEXT_PUBLIC_APP_NAME || "OwnerLog",
      version: "0.1.0-M1",
    },
  });
}
