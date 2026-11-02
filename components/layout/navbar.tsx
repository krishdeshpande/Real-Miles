"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { useTheme } from "@/components/theme/theme-provider";
import { Car, Sun, Moon, PlusCircle, Shield, User, LogOut, Search, Menu, X } from "lucide-react";

export function Navbar() {
  const { user, profile, isAdmin, isDemoMode, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLocalMode = process.env.NEXT_PUBLIC_DATA_MODE === "local";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--surface-border)] bg-[var(--background)]/90 backdrop-blur-md">
      {/* Persistent Local Mode Banner (Spec Requirement) */}
      {isLocalMode && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-center text-xs font-semibold text-amber-400 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span>Local mode: data is not backed up</span>
        </div>
      )}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground font-heading font-black text-xl shadow-lg shadow-accent/20 transition-transform group-hover:scale-105">
              RM
            </div>
            <div>
              <div className="font-heading font-bold text-lg tracking-tight text-foreground flex items-center gap-1.5">
                {process.env.NEXT_PUBLIC_APP_NAME || "Real Miles"}
                {isDemoMode && (
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30">
                    Preview
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Verified Indian vehicle owner data</p>
            </div>
          </Link>
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/vehicles"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
          >
            All Vehicles
          </Link>

          {isAdmin && (
            <Link
              href="/admin/vehicles"
              className="flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover transition-colors px-3 py-1.5"
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}

          <Link
            href="/reviews/new"
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:bg-accent-hover transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Share Your Ownership
          </Link>

          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--surface-border)] bg-surface text-foreground hover:bg-surface-subtle transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-[var(--surface-border)]">
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-surface-subtle transition-colors text-sm"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold text-xs border border-accent/40">
                  {profile?.handle ? profile.handle.slice(0, 2).toUpperCase() : "ME"}
                </div>
                <span className="font-medium text-foreground max-w-[120px] truncate">
                  {profile?.display_name || profile?.handle || "My Account"}
                </span>
              </Link>
              <button
                onClick={() => signOut()}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-surface-subtle"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-lg border border-[var(--surface-border)] bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-subtle transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--surface-border)] bg-surface text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--surface-border)] bg-surface text-foreground"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[var(--surface-border)] bg-[var(--surface)] px-4 py-4 space-y-3">
          <Link
            href="/vehicles"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-foreground"
          >
            All Vehicles
          </Link>
          <Link
            href="/reviews/new"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground"
          >
            <PlusCircle className="h-4 w-4" />
            Share Your Ownership
          </Link>

          {isAdmin && (
            <Link
              href="/admin/vehicles"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 py-2 text-sm font-medium text-accent"
            >
              <Shield className="h-4 w-4" />
              Admin Dashboard
            </Link>
          )}

          {user ? (
            <div className="pt-3 border-t border-[var(--surface-border)] flex items-center justify-between">
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold text-xs border border-accent/40">
                  {profile?.handle ? profile.handle.slice(0, 2).toUpperCase() : "ME"}
                </div>
                <span>{profile?.display_name || "Profile"}</span>
              </Link>
              <button
                onClick={() => {
                  signOut();
                  setMobileMenuOpen(false);
                }}
                className="text-xs text-destructive flex items-center gap-1 font-medium"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-center rounded-lg border border-[var(--surface-border)] py-2 text-sm font-medium text-foreground"
            >
              Sign In
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
