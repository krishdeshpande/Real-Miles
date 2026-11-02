import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: "user" | "admin";
}

/**
 * Server-side authentication resolution.
 * - In Supabase mode: Strictly derived from `supabase.auth.getUser()`, which validates
 *   the cryptographically signed session token on the server. Client-supplied IDs are ignored.
 * - In Local mode: Only usable in non-production environments (NODE_ENV !== "production").
 *   Requires an explicit `x-user-id` or `Authorization: Bearer <id>` header. If absent, returns null.
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const isLocal = process.env.DATA_MODE === "local";

  if (isLocal) {
    // In production, local demo sessions are strictly disabled
    if (process.env.NODE_ENV === "production") {
      return null;
    }

    // Extract authorization identifier from headers
    const customUserId = request.headers.get("x-user-id");
    const authHeader = request.headers.get("authorization");
    let resolvedId: string | null = customUserId;

    if (!resolvedId && authHeader?.startsWith("Bearer ")) {
      resolvedId = authHeader.substring(7).trim();
    }

    // Also check demo session cookie if set
    if (!resolvedId) {
      const sessionCookie = request.cookies.get("realmiles_demo_session");
      if (sessionCookie?.value) {
        resolvedId = sessionCookie.value;
      }
    }

    // If no credential was provided, the request is unauthenticated
    if (!resolvedId) {
      return null;
    }

    const customRole = (request.headers.get("x-user-role") || "user") as "user" | "admin";
    const customEmail = request.headers.get("x-user-email") || "driver@realmiles.local";

    return {
      id: resolvedId,
      email: customEmail,
      role: customRole,
    };
  }

  // Supabase Auth Mode - Derives user strictly from server-verified session
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  const isAdmin = Boolean(user.email && adminEmails.includes(user.email.toLowerCase()));

  return {
    id: user.id,
    email: user.email,
    role: isAdmin ? "admin" : "user",
  };
}
