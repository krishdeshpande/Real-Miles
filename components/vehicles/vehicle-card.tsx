"use client";

import React from "react";
import Link from "next/link";
import { Car, Bike, ShieldCheck, ChevronRight, Fuel, ArrowUpRight } from "lucide-react";
import { Vehicle } from "@/lib/types";

interface VehicleCardProps {
  vehicle: Vehicle & {
    tagline?: string;
    vehicle_aggregates?: Array<{
      n_reviews: number;
      verdict_text?: string | null;
    }>;
  };
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const aggregate = vehicle.vehicle_aggregates?.[0];
  const reviewCount = aggregate?.n_reviews || 0;
  const verdict = aggregate?.verdict_text;
  const hasThreshold = reviewCount >= 3;

  return (
    <Link
      href={`/vehicles/${vehicle.slug}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-card border border-[var(--surface-border)] bg-[var(--card)] p-6 transition-all duration-300 hover:border-accent hover:shadow-xl hover:shadow-accent/5 hover:-translate-y-1"
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent uppercase tracking-wide">
              {vehicle.category === "car" ? <Car className="h-3 w-3" /> : <Bike className="h-3 w-3" />}
              {vehicle.category}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--surface-border)] bg-surface-subtle px-2 py-0.5 text-xs text-muted-foreground">
              <Fuel className="h-2.5 w-2.5" />
              {vehicle.fuel_type}
            </span>
          </div>

          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-subtle text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>

        {/* Title */}
        <div>
          <span className="text-xs uppercase font-medium tracking-wider text-muted-foreground font-heading">
            {vehicle.make}
          </span>
          <h3 className="text-xl font-bold text-foreground font-heading group-hover:text-accent transition-colors">
            {vehicle.model}
          </h3>
        </div>

        {/* Tagline / Context */}
        {vehicle.tagline && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {vehicle.tagline}
          </p>
        )}
      </div>

      {/* Owner Count & Verdict snippet */}
      <div className="mt-6 pt-4 border-t border-[var(--surface-border)]">
        {hasThreshold && verdict ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Owner Verdict ({reviewCount} verified)</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 italic">
              &quot;{verdict}&quot;
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground">
                Collecting owner data
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">
                {reviewCount} of 3 reviews needed
              </p>
            </div>
            <span className="text-xs font-semibold text-accent underline group-hover:text-accent-hover">
              Submit review →
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
