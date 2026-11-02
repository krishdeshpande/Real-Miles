"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { Mail, ArrowRight, ShieldCheck, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, isDemoMode, signInWithOtp, signInWithGoogle, signInDemoUser } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20 text-accent">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">You are signed in</h1>
          <p className="text-sm text-muted-foreground mt-1">Logged in as {user.email || "Verified Owner"}</p>
        </div>
        <div className="flex justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground"
          >
            Go to Launch Catalog
          </Link>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--surface-border)] bg-surface px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface-subtle"
          >
            View Profile
          </Link>
        </div>
      </div>
    );
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setMessage({ type: "error", text: "Please enter a valid email address." });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const { error } = await signInWithOtp(email);
    setIsSubmitting(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      if (isDemoMode) {
        setMessage({ type: "success", text: "Signed in successfully in local preview mode!" });
        router.push("/");
      } else {
        setMessage({
          type: "success",
          text: "Check your email inbox for the magic sign-in link!",
        });
      }
    }
  };

  const handleGoogle = async () => {
    setIsSubmitting(true);
    const { error } = await signInWithGoogle();
    setIsSubmitting(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else if (isDemoMode) {
      router.push("/");
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:py-24 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent mb-2">
          <ShieldCheck className="h-4 w-4" />
          <span>Verified Ownership Community</span>
        </div>
        <h1 className="text-3xl font-extrabold font-heading text-foreground tracking-tight">
          Sign In to Real Miles
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Sign in via magic email link or Google. Verified owners can submit reviews and participate in reliability telemetry.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-xl p-4 text-xs font-medium flex items-start gap-2.5 border ${
            message.type === "success"
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Auth Card */}
      <div className="rounded-card border border-[var(--surface-border)] bg-surface p-6 sm:p-8 space-y-6 shadow-xl">
        {/* Magic Link Form */}
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full rounded-xl border border-[var(--surface-border)] bg-background pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-accent-foreground hover:bg-accent-hover transition-colors disabled:opacity-50 shadow-md shadow-accent/10"
          >
            {isSubmitting ? "Sending..." : "Continue with Email"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--surface-border)]" />
          </div>
          <span className="relative bg-surface px-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            or continue with
          </span>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-[var(--surface-border)] bg-background py-3 text-sm font-medium text-foreground hover:bg-surface-subtle transition-colors disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Google Account
        </button>

        {/* Quick Demo Switcher (Strictly gated to development + NEXT_PUBLIC_DEMO_LOGIN=true) */}
        {process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEMO_LOGIN === "true" && (
          <div className="pt-4 border-t border-[var(--surface-border)] space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-accent" />
              Quick Demo Sign In (Development Only)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  await signInDemoUser("user");
                  router.push("/");
                }}
                className="rounded-lg border border-[var(--surface-border)] bg-surface-subtle p-2 text-xs font-semibold text-foreground hover:border-accent transition-colors text-left"
              >
                <div>Verified Owner</div>
                <div className="text-[10px] text-muted-foreground">driver@realmiles.local</div>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await signInDemoUser("admin");
                  router.push("/");
                }}
                className="rounded-lg border border-accent/40 bg-accent/10 p-2 text-xs font-semibold text-accent hover:border-accent transition-colors text-left"
              >
                <div>Lead Admin</div>
                <div className="text-[10px] text-muted-foreground">admin@realmiles.local</div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
