"use client";

import React, { useState } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import {
  Car,
  Bike,
  Fuel,
  ShieldCheck,
  PlusCircle,
  MessageSquare,
  Wrench,
  BarChart3,
  Film,
  ArrowLeft,
  ChevronRight,
  Info,
  Calendar,
  Gauge,
  Sparkles
} from "lucide-react";
import { SEED_VEHICLES } from "@/lib/data/seed-vehicles";
import { VehicleHeroPlaceholder } from "@/components/vehicles/vehicle-hero-placeholder";

type TabKey = "reviews" | "issues" | "chat" | "specs";

export default function VehicleDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [activeTab, setActiveTab] = useState<TabKey>("reviews");

  const vehicle = SEED_VEHICLES.find((v) => v.slug === slug);

  if (!vehicle) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold font-heading">Vehicle Not Found</h1>
        <p className="text-muted-foreground text-sm">
          The requested vehicle slug &quot;{slug}&quot; is not in the OwnerLog catalog.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Launch Catalog
        </Link>
      </div>
    );
  }

  // M1 Empty State Defaults: 0 reviews
  const reviewCount = 0;
  const threshold = 3;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/#launch-vehicles" className="hover:text-foreground">Vehicles</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{vehicle.make} {vehicle.model}</span>
      </nav>

      {/* Vehicle Hero Header */}
      <VehicleHeroPlaceholder
        make={vehicle.make}
        model={vehicle.model}
        category={vehicle.category}
        fuelType={vehicle.fuel_type}
        heroPath={vehicle.hero_path}
        className="min-h-[220px] sm:min-h-[260px]"
      />

      {/* Primary Verdict Card (Section 9 Spec) */}
      <section className="rounded-card border border-[var(--surface-border)] bg-[var(--surface)] p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/20 text-accent">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold font-heading text-foreground">
                Owner Verdict
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Synthesized strictly from published owner data. Requires at least {threshold} verified owner reviews.
            </p>
          </div>

          <Link
            href={`/reviews/new?vehicle=${vehicle.slug}`}
            className="self-start sm:self-auto inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-foreground hover:bg-accent-hover transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Review this {vehicle.category}
          </Link>
        </div>

        {/* 0 of 3 Progress state */}
        <div className="rounded-xl border border-[var(--surface-border)] bg-background/50 p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Collecting owner data: {reviewCount} of {threshold} reviews
            </span>
            <span className="font-mono text-muted-foreground">
              {Math.round((reviewCount / threshold) * 100)}% complete
            </span>
          </div>

          <div className="h-2 w-full rounded-full bg-surface-subtle overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, (reviewCount / threshold) * 100)}%` }}
            />
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            We never generate synthetic verdicts before verified owners share their telemetry. Once {threshold} owners
            post odometer-verified reviews, our deterministic engine aggregates ratings, fuel efficiency buckets, and top mechanical issues.
          </p>
        </div>
      </section>

      {/* Reel Player Area (Section 11 Spec - Empty State for M1) */}
      <section className="rounded-card border border-[var(--surface-border)] bg-surface-subtle/50 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-[var(--surface-border)] text-muted-foreground">
            <Film className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground font-heading">
              Vertical Reel Preview (9:16)
            </h3>
            <p className="text-xs text-muted-foreground">
              Client-side canvas short reels will render dynamic metric animations from structured owner clips.
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-muted-foreground px-3 py-1 rounded bg-surface border border-[var(--surface-border)]">
          Awaiting video submissions
        </span>
      </section>

      {/* Tabs Navigation (Section 13 Spec) */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b border-[var(--surface-border)] overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab("reviews")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "reviews"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Reviews ({reviewCount})
          </button>

          <button
            onClick={() => setActiveTab("issues")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "issues"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wrench className="h-4 w-4" />
            Issues & Reliability
          </button>

          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "chat"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Ask the Owners
          </button>

          <button
            onClick={() => setActiveTab("specs")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "specs"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Specs of Ownership
          </button>
        </div>

        {/* Tab 1: Reviews */}
        {activeTab === "reviews" && (
          <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-surface/30 p-12 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-subtle text-muted-foreground border border-[var(--surface-border)]">
              <ShieldCheck className="h-6 w-6 text-accent" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-semibold text-foreground font-heading">
                No owner reviews yet for {vehicle.make} {vehicle.model}
              </h3>
              <p className="text-xs text-muted-foreground">
                Do you drive this {vehicle.category}? Share your honest voice note, text, or video review to help Indian buyers.
              </p>
            </div>
            <Link
              href={`/reviews/new?vehicle=${vehicle.slug}`}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Submit the First Review
            </Link>
          </div>
        )}

        {/* Tab 2: Issues */}
        {activeTab === "issues" && (
          <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-surface/30 p-12 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-subtle text-muted-foreground border border-[var(--surface-border)]">
              <Wrench className="h-6 w-6 text-accent" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-semibold text-foreground font-heading">
                No issues reported yet
              </h3>
              <p className="text-xs text-muted-foreground">
                Ranked component failures, clutch wear, electrical faults, and resolution percentages will automatically appear as owner reviews are verified.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Ask the Owners */}
        {activeTab === "chat" && (
          <div className="rounded-2xl border border-[var(--surface-border)] bg-surface p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold font-heading text-foreground">
                  Ask {vehicle.make} {vehicle.model} Owners
                </h3>
                <p className="text-xs text-muted-foreground">
                  RAG chatbot powered exclusively by verified owner review chunks.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--surface-border)] bg-background/60 p-6 text-center space-y-3">
              <p className="text-xs text-muted-foreground max-w-lg mx-auto">
                OwnerLog refuses to answer questions when evidence is thin or absent (spec section 10).
                Submit a review for this vehicle to teach the system about its real-world behaviour!
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <Link
                  href={`/reviews/new?vehicle=${vehicle.slug}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Knowledge as an Owner
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Specs of Ownership */}
        {activeTab === "specs" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-card border border-[var(--surface-border)] bg-surface p-6 space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold font-heading text-sm">
                <Gauge className="h-4 w-4 text-accent" />
                Real-World Fuel Efficiency
              </div>
              <p className="text-xs text-muted-foreground">
                Median kmpl grouped by City-Heavy, Highway-Heavy, and Mixed conditions.
              </p>
              <div className="rounded-lg border border-[var(--surface-border)] bg-background/50 p-6 text-center text-xs text-muted-foreground">
                Awaiting owner telemetry
              </div>
            </div>

            <div className="rounded-card border border-[var(--surface-border)] bg-surface p-6 space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold font-heading text-sm">
                <Calendar className="h-4 w-4 text-accent" />
                Annual Service Costs (INR)
              </div>
              <p className="text-xs text-muted-foreground">
                Median yearly maintenance expenses and typical range reported by owners.
              </p>
              <div className="rounded-lg border border-[var(--surface-border)] bg-background/50 p-6 text-center text-xs text-muted-foreground">
                Awaiting owner telemetry
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
