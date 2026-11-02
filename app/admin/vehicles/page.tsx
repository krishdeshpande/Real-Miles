"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { SEED_VEHICLES, SeedVehicleDefinition } from "@/lib/data/seed-vehicles";
import {
  Shield,
  Plus,
  Car,
  Bike,
  Fuel,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles
} from "lucide-react";

export default function AdminVehiclesPage() {
  const { user, isAdmin, signInDemoUser } = useAuth();
  const [vehicles, setVehicles] = useState<SeedVehicleDefinition[]>(SEED_VEHICLES);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState<"car" | "bike">("car");
  const [fuelType, setFuelType] = useState("Petrol");
  const [heroPath, setHeroPath] = useState("");
  const [tagline, setTagline] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSlugGen = (m: string, mo: string) => {
    return `${m}-${mo}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!make.trim() || !model.trim()) {
      setStatusMessage({ type: "error", text: "Please provide both Make and Model." });
      return;
    }

    const slug = handleSlugGen(make, model);
    if (vehicles.some((v) => v.slug === slug)) {
      setStatusMessage({ type: "error", text: `Vehicle with slug '${slug}' already exists.` });
      return;
    }

    const newVehicle: SeedVehicleDefinition = {
      id: `v0000001-0000-0000-0000-${String(vehicles.length + 1).padStart(12, "0")}`,
      slug,
      make: make.trim(),
      model: model.trim(),
      category,
      fuel_type: fuelType,
      hero_path: heroPath.trim() || null,
      tagline: tagline.trim() || `${category === "car" ? "Car" : "Motorcycle"} added via admin portal.`,
      created_at: new Date().toISOString(),
    };

    setVehicles([newVehicle, ...vehicles]);
    setMake("");
    setModel("");
    setHeroPath("");
    setTagline("");
    setStatusMessage({
      type: "success",
      text: `Vehicle '${newVehicle.make} ${newVehicle.model}' added successfully to active catalog!`,
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-0.5 text-xs font-semibold text-accent mb-2">
              <Shield className="h-3.5 w-3.5" />
              <span>Admin Console</span>
            </div>
            <h1 className="text-3xl font-extrabold font-heading text-foreground">
              Vehicle Catalog Management
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Add new cars or motorcycles to OwnerLog. Section 5 Spec requires a single one-row insert.
            </p>
          </div>

          {!isAdmin && (
            <button
              onClick={() => signInDemoUser("admin")}
              className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3.5 py-2 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Switch to Lead Admin Mode
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`rounded-xl p-4 text-xs font-medium flex items-center gap-2 border ${
            statusMessage.type === "success"
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Grid: Form on Left, List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-1 rounded-card border border-[var(--surface-border)] bg-surface p-6 space-y-5 h-fit">
          <div className="space-y-1">
            <h2 className="text-base font-bold font-heading text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4 text-accent" />
              Add New Vehicle
            </h2>
            <p className="text-xs text-muted-foreground">
              Uses placeholder gradient if no hero image is provided.
            </p>
          </div>

          <form onSubmit={handleAddVehicle} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                Make / Manufacturer
              </label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="e.g. Mahindra, Honda, Kawasaki"
                required
                className="w-full rounded-xl border border-[var(--surface-border)] bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                Model Name
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Scorpio-N, City, Ninja 300"
                required
                className="w-full rounded-xl border border-[var(--surface-border)] bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as "car" | "bike")}
                  className="w-full rounded-xl border border-[var(--surface-border)] bg-background px-3 py-2.5 text-xs text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="car">Car</option>
                  <option value="bike">Bike</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Typical Fuel
                </label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="w-full rounded-xl border border-[var(--surface-border)] bg-background px-3 py-2.5 text-xs text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Electric">Electric</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                Tagline / Summary
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. D-segment rugged ladder-frame SUV"
                className="w-full rounded-xl border border-[var(--surface-border)] bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                Hero Storage Path (Optional)
              </label>
              <input
                type="text"
                value={heroPath}
                onChange={(e) => setHeroPath(e.target.value)}
                placeholder="leave empty for native gradient"
                className="w-full rounded-xl border border-[var(--surface-border)] bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-xs font-bold text-accent-foreground hover:bg-accent-hover transition-colors shadow-md shadow-accent/10"
            >
              <Plus className="h-4 w-4" />
              Save Vehicle to Catalog
            </button>
          </form>
        </div>

        {/* Existing Vehicles Catalog */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold font-heading text-foreground">
              Current Vehicles Catalog ({vehicles.length})
            </h2>
            <span className="text-xs font-mono text-muted-foreground">
              {vehicles.filter((v) => v.category === "car").length} cars •{" "}
              {vehicles.filter((v) => v.category === "bike").length} bikes
            </span>
          </div>

          <div className="space-y-3">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="rounded-xl border border-[var(--surface-border)] bg-surface p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background border border-[var(--surface-border)] text-muted-foreground shrink-0">
                    {v.category === "car" ? (
                      <Car className="h-4 w-4 text-accent" />
                    ) : (
                      <Bike className="h-4 w-4 text-accent" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-bold text-foreground text-sm">
                        {v.make} {v.model}
                      </h3>
                      <span className="text-[10px] font-mono rounded bg-surface-subtle px-1.5 py-0.5 text-muted-foreground">
                        {v.slug}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {v.tagline}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-mono">
                    <Fuel className="h-3 w-3" />
                    {v.fuel_type}
                  </span>
                  <Link
                    href={`/vehicles/${v.slug}`}
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    View Page →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
