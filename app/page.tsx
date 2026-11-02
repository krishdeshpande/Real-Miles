"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search, PlusCircle, ShieldCheck, Sparkles, Filter, Car, Bike } from "lucide-react";
import { SEED_VEHICLES } from "@/lib/data/seed-vehicles";
import { VehicleCard } from "@/components/vehicles/vehicle-card";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "car" | "bike">("all");

  const filteredVehicles = useMemo(() => {
    return SEED_VEHICLES.filter((vehicle) => {
      const matchesCategory =
        activeCategory === "all" || vehicle.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        vehicle.make.toLowerCase().includes(q) ||
        vehicle.model.toLowerCase().includes(q) ||
        vehicle.tagline.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, activeCategory]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-gradient-to-b from-surface via-surface/80 to-background p-8 sm:p-14 text-center sm:text-left">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-72 w-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1 text-xs font-semibold text-accent">
            <ShieldCheck className="h-4 w-4" />
            <span>Anti-Marketing, Real Indian Owner Telemetry</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground font-heading">
            Automobile forum depth. <br />
            <span className="text-accent underline decoration-accent/30">Structured, faster</span>, verified.
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
            Anyone can read. Only verified owners can review. We convert video, audio, photos, and voice notes
            into structured owner records with zero dealership PR.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/reviews/new"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-base font-bold text-accent-foreground shadow-lg shadow-accent/20 hover:bg-accent-hover transition-all duration-200"
            >
              <PlusCircle className="h-5 w-5" />
              Share Your Ownership
            </Link>
            <Link
              href="#launch-vehicles"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--surface-border)] bg-surface px-6 py-3.5 text-base font-medium text-foreground hover:bg-surface-subtle transition-colors"
            >
              Explore 8 Launch Vehicles
            </Link>
          </div>
        </div>
      </section>

      {/* Vehicles Directory Section */}
      <section id="launch-vehicles" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-foreground">
              Launch Vehicles
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select any vehicle to read structured verdicts, reliability reports, and ask owner questions.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface border border-[var(--surface-border)] self-start sm:self-auto">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeCategory === "all"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All (8)
            </button>
            <button
              onClick={() => setActiveCategory("car")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeCategory === "car"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Car className="h-3.5 w-3.5" />
              Cars (4)
            </button>
            <button
              onClick={() => setActiveCategory("bike")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeCategory === "bike"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bike className="h-3.5 w-3.5" />
              Bikes (4)
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search make or model (e.g. Thar, Duke 390, Himalayan, Creta)..."
            className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] pl-12 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {/* 8 Vehicles Grid */}
        {filteredVehicles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredVehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={{
                  ...vehicle,
                  vehicle_aggregates: [
                    {
                      n_reviews: 0,
                      verdict_text: null,
                    },
                  ],
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-surface/50 p-12 text-center">
            <p className="text-base font-medium text-foreground">No vehicles found matching &quot;{searchQuery}&quot;</p>
            <p className="text-xs text-muted-foreground mt-1">Try searching for Thar, Creta, Harrier, Duke, or Himalayan</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("all");
              }}
              className="mt-4 text-xs font-semibold text-accent underline"
            >
              Reset filters
            </button>
          </div>
        )}
      </section>

      {/* Latest Reviews Feed (Empty State for M1) */}
      <section className="space-y-6 pt-4 border-t border-[var(--surface-border)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold font-heading text-foreground">
              Latest Owner Submissions
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Live chronological stream of verified owner experiences across India.
            </p>
          </div>
          <Link
            href="/reviews/new"
            className="text-xs font-semibold text-accent hover:underline hidden sm:block"
          >
            Post a review →
          </Link>
        </div>

        <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-surface/40 p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-subtle text-muted-foreground border border-[var(--surface-border)]">
            <Sparkles className="h-6 w-6 text-accent" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-semibold text-foreground font-heading">
              No owner reviews published yet
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We never fabricate demo reviews without marking them. Be the first verified owner to submit your raw experience, voice note, or video.
            </p>
          </div>
          <Link
            href="/reviews/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Submit First Review
          </Link>
        </div>
      </section>
    </div>
  );
}
