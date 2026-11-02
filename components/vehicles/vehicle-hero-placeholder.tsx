"use client";

import React from "react";
import { Car, Bike, Fuel, Sparkles } from "lucide-react";

interface VehicleHeroProps {
  make: string;
  model: string;
  category: "car" | "bike";
  fuelType: string;
  heroPath?: string | null;
  className?: string;
}

export function VehicleHeroPlaceholder({
  make,
  model,
  category,
  fuelType,
  heroPath,
  className = "",
}: VehicleHeroProps) {
  if (heroPath) {
    return (
      <div className={`relative overflow-hidden rounded-2xl border border-[var(--surface-border)] ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroPath}
          alt={`${make} ${model}`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>
    );
  }

  // Generative aesthetic placeholder gradient per vehicle
  // Distinct deterministic color cues
  const gradients: Record<string, string> = {
    "mahindra-thar": "from-amber-950/60 via-stone-900 to-zinc-950",
    "tata-harrier": "from-blue-950/60 via-slate-900 to-zinc-950",
    "hyundai-creta": "from-emerald-950/60 via-zinc-900 to-zinc-950",
    "bmw-330li": "from-indigo-950/70 via-neutral-900 to-zinc-950",
    "ktm-390-adventure-s": "from-orange-950/70 via-stone-900 to-zinc-950",
    "re-himalayan-450": "from-teal-950/60 via-zinc-900 to-zinc-950",
    "re-classic-350": "from-red-950/60 via-stone-900 to-zinc-950",
    "ktm-390-duke": "from-orange-900/60 via-neutral-900 to-zinc-950",
  };

  const key = `${make.toLowerCase()}-${model.toLowerCase()}`.replace(/\s+/g, "-");
  const bgGradient = gradients[key] || "from-zinc-900 via-stone-900 to-zinc-950";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-gradient-to-br ${bgGradient} p-6 sm:p-8 flex flex-col justify-between ${className}`}
    >
      {/* Background geometric accents */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      
      {/* Subtle grid pattern */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #a3e635 1px, transparent 0)",
          backgroundSize: "24px 24px"
        }}
      />

      {/* Top row badges */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent uppercase tracking-wider">
            {category === "car" ? <Car className="h-3.5 w-3.5" /> : <Bike className="h-3.5 w-3.5" />}
            {category}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--surface-border)] bg-surface/80 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur-sm">
            <Fuel className="h-3 w-3 text-muted-foreground" />
            {fuelType}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">
          Verified Spec
        </span>
      </div>

      {/* Center vehicle visual branding */}
      <div className="relative z-10 my-8 sm:my-10">
        <p className="text-xs font-semibold tracking-wider uppercase text-accent font-heading">
          {make}
        </p>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-heading mt-1">
          {model}
        </h2>
      </div>

      {/* Bottom meta note */}
      <div className="relative z-10 flex items-center justify-between text-xs text-muted-foreground border-t border-white/5 pt-3">
        <span className="flex items-center gap-1.5 text-zinc-400">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Native placeholder gradient
        </span>
        <span className="font-mono text-[11px] text-zinc-500">
          Real Miles Catalog
        </span>
      </div>
    </div>
  );
}
