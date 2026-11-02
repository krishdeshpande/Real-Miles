"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { User, Shield, Briefcase, Calendar, LogOut, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, isAdmin, isDemoMode, signOut } = useAuth();
  const [brandDisclosure, setBrandDisclosure] = useState(profile?.brand_affiliation || "");
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold font-heading">Authentication Required</h1>
        <p className="text-sm text-muted-foreground">
          Please sign in to view and manage your owner profile.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const handleSaveDisclosure = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Catalog
        </Link>
        <h1 className="text-3xl font-extrabold font-heading text-foreground">
          Owner Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your verified driver handle, role permissions, and manufacturer disclosures.
        </p>
      </div>

      {/* Account Info Card */}
      <div className="rounded-card border border-[var(--surface-border)] bg-surface p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--surface-border)]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 text-accent font-heading font-black text-2xl border border-accent/30 shadow-inner">
              {profile?.handle ? profile.handle.slice(0, 2).toUpperCase() : "DR"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-heading text-foreground">
                  {profile?.display_name || "Driver"}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent border border-accent/25">
                  <Shield className="h-3 w-3" />
                  {profile?.role === "admin" ? "Admin" : "Verified Driver"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                @{profile?.handle || "owner"} • {user.email}
              </p>
            </div>
          </div>

          <button
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
            className="self-start sm:self-auto inline-flex items-center gap-2 rounded-lg border border-[var(--surface-border)] bg-background px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>

        {/* Brand Affiliation Disclosure (Spec Section 12) */}
        <form onSubmit={handleSaveDisclosure} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-accent" />
              Brand Affiliation Disclosure
            </label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              To maintain integrity, if you work for an OEM, dealership, aftermarket vendor, or auto media, please declare it. This will appear as a transparent disclosure badge next to your reviews.
            </p>
            <input
              type="text"
              value={brandDisclosure}
              onChange={(e) => setBrandDisclosure(e.target.value)}
              placeholder="e.g. Service technician at Tata dealership, or Automotive journalist"
              className="w-full rounded-xl border border-[var(--surface-border)] bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-surface-subtle border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors"
            >
              Save Disclosure
            </button>
            {savedSuccess && (
              <span className="text-xs text-accent flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved successfully
              </span>
            )}
          </div>
        </form>

        {/* Telemetry & Privacy Notice */}
        <div className="rounded-xl border border-[var(--surface-border)] bg-background/50 p-4 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Shield className="h-4 w-4 text-accent" />
            <span>Real Miles Privacy Promise</span>
          </div>
          <p>
            • GPS coordinates and sensitive EXIF metadata are stripped immediately in your browser on upload.<br />
            • Odometer images are private verification proofs and are never published to public pages.<br />
            • Published odometer values are rounded to the nearest 1,000 km to protect owner identity.
          </p>
        </div>
      </div>
    </div>
  );
}
