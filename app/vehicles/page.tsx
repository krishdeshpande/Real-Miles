"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Car, Bike, ArrowLeft } from "lucide-react";
import { SEED_VEHICLES } from "@/lib/data/seed-vehicles";
import { VehicleCard } from "@/components/vehicles/vehicle-card";

export default function VehiclesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<"all" | "car" | "bike">("all");

  const filtered = useMemo(() => {
    return SEED_VEHICLES.filter((v) => {
      const matchCat = category === "all" || v.category === category;
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.fuel_type.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [searchQuery, category]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
        <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-foreground">
          Vehicle Directory
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Explore the launch catalog of cars and bikes covered by Real Miles.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by make, model, or fuel type..."
            className="w-full rounded-xl border border-[var(--surface-border)] bg-surface pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-[var(--surface-border)] self-stretch sm:self-auto justify-center">
          <button
            onClick={() => setCategory("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              category === "all" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({SEED_VEHICLES.length})
          </button>
          <button
            onClick={() => setCategory("car")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              category === "car" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Car className="h-3 w-3" />
            Cars
          </button>
          <button
            onClick={() => setCategory("bike")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              category === "bike" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bike className="h-3 w-3" />
            Bikes
          </button>
        </div>
      </div>

      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {filtered.map((v) => (
          <VehicleCard
            key={v.id}
            vehicle={{
              ...v,
              vehicle_aggregates: [{ n_reviews: 0, verdict_text: null }],
            }}
          />
        ))}
      </div>
    </div>
  );
}
