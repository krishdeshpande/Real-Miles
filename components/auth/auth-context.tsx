"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Profile } from "@/lib/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

interface UserInfo {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

interface AuthContextType {
  user: UserInfo | null;
  profile: Profile | null;
  isAdmin: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  signInWithOtp: (email: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInDemoUser: (role?: "user" | "admin", email?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_STORAGE_KEY = "realmiles_demo_auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isSupabase = isSupabaseConfigured();

  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "admin@realmiles.local,krish@realmiles.local")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  const isAdmin = Boolean(
    (user?.email && adminEmails.includes(user.email.toLowerCase())) ||
    profile?.role === "admin"
  );

  const fetchProfile = useCallback(async (userId: string, email?: string) => {
    const supabase = createClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.warn("Could not fetch profile:", error.message);
        // Create fallback profile if not found
        return {
          id: userId,
          handle: email ? email.split("@")[0] : `user_${userId.slice(0, 5)}`,
          display_name: email ? email.split("@")[0] : "Verified Owner",
          avatar_path: null,
          role: (email && adminEmails.includes(email.toLowerCase()) ? "admin" : "user") as "user" | "admin",
          created_at: new Date().toISOString(),
        } as Profile;
      }
      return data as Profile;
    } catch {
      return null;
    }
  }, [adminEmails]);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      if (isSupabase) {
        const p = await fetchProfile(user.id, user.email);
        if (p) setProfile(p);
      }
    }
  }, [user, isSupabase, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setIsLoading(true);
      const supabase = createClient();

      if (supabase && isSupabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (mounted && session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email,
              user_metadata: session.user.user_metadata,
            });
            const p = await fetchProfile(session.user.id, session.user.email);
            if (mounted && p) setProfile(p);
          }

          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
              if (!mounted) return;
              if (session?.user) {
                setUser({
                  id: session.user.id,
                  email: session.user.email,
                  user_metadata: session.user.user_metadata,
                });
                const p = await fetchProfile(session.user.id, session.user.email);
                if (mounted && p) setProfile(p);
              } else {
                setUser(null);
                setProfile(null);
              }
            }
          );

          return () => {
            subscription.unsubscribe();
          };
        } catch (err) {
          console.error("Auth init error:", err);
        }
      } else {
        // Fallback demo auth from local storage
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem(DEMO_STORAGE_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              setUser(parsed.user);
              setProfile(parsed.profile);
            } catch {
              localStorage.removeItem(DEMO_STORAGE_KEY);
            }
          }
        }
      }

      if (mounted) setIsLoading(false);
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, [isSupabase, fetchProfile]);

  const signInWithOtp = async (email: string) => {
    const supabase = createClient();
    if (!supabase || !isSupabase) {
      // Local fallback sign in
      await signInDemoUser("user", email);
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signInWithGoogle = async () => {
    const supabase = createClient();
    if (!supabase || !isSupabase) {
      await signInDemoUser("user", "google.driver@realmiles.local");
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signInDemoUser = async (role: "user" | "admin" = "user", customEmail?: string) => {
    const email = customEmail || (role === "admin" ? "admin@realmiles.local" : "driver@realmiles.local");
    const id = role === "admin" ? "00000000-0000-0000-0000-000000000001" : "00000000-0000-0000-0000-000000000002";
    const demoUser: UserInfo = {
      id,
      email,
      user_metadata: { full_name: role === "admin" ? "Lead Admin" : "Verified Owner" },
    };
    const demoProfile: Profile = {
      id,
      handle: email.split("@")[0],
      display_name: role === "admin" ? "Lead Admin" : "Verified Owner",
      avatar_path: null,
      role,
      created_at: new Date().toISOString(),
    };

    setUser(demoUser);
    setProfile(demoProfile);
    if (typeof window !== "undefined") {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ user: demoUser, profile: demoProfile }));
      document.cookie = `realmiles_demo_session=${id}; path=/; SameSite=Lax`;
    }
  };

  const signOut = async () => {
    const supabase = createClient();
    if (supabase && isSupabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(DEMO_STORAGE_KEY);
      document.cookie = "realmiles_demo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        isLoading,
        isDemoMode: !isSupabase,
        signInWithOtp,
        signInWithGoogle,
        signInDemoUser,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
