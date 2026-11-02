"use client";

import React, { useState } from "react";
import { StructuredReview } from "@/lib/schema/review";
import {
  ShieldAlert,
  Check,
  Star,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Lock
} from "lucide-react";

interface StructuredCardEditorProps {
  initialData: StructuredReview;
  onSave: (updated: StructuredReview) => Promise<void>;
  vehicleName: string;
}

export function StructuredCardEditor({ initialData, onSave, vehicleName }: StructuredCardEditorProps) {
  const [data, setData] = useState<StructuredReview>(initialData);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const updateField = async <K extends keyof StructuredReview>(key: K, value: StructuredReview[K]) => {
    const updated = { ...data, [key]: value };
    setData(updated);
    setSaving(true);
    setSaveStatus("Saving changes...");
    try {
      await onSave(updated);
      setSaveStatus("Changes saved");
      setTimeout(() => setSaveStatus(null), 2000);
    } catch {
      setSaveStatus("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleRatingChange = async (ratingKey: string, score: number) => {
    const currentRatings = data.ratings || {
      comfort: null,
      performance: null,
      reliability: null,
      build_quality: null,
      service_experience: null,
      value_for_money: null,
    };
    const updatedRatings = { ...currentRatings, [ratingKey]: score };
    await updateField("ratings", updatedRatings);
  };

  const handleAddPro = async (newPro: string) => {
    if (!newPro.trim()) return;
    const updatedPros = [...(data.pros || []), newPro.trim()];
    await updateField("pros", updatedPros);
  };

  const handleRemovePro = async (index: number) => {
    const updatedPros = [...(data.pros || [])];
    updatedPros.splice(index, 1);
    await updateField("pros", updatedPros);
  };

  const handleAddCon = async (newCon: string) => {
    if (!newCon.trim()) return;
    const updatedCons = [...(data.cons || []), newCon.trim()];
    await updateField("cons", updatedCons);
  };

  const handleRemoveCon = async (index: number) => {
    const updatedCons = [...(data.cons || [])];
    updatedCons.splice(index, 1);
    await updateField("cons", updatedCons);
  };

  return (
    <div className="space-y-8">
      {/* Mock Data Warning Banner (Spec Requirement) */}
      {data.mock && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="font-semibold">Mock data, not from a real model</span>
          </div>
          <span className="text-[11px] text-amber-400/80 font-mono hidden sm:inline">
            Blocked from publishing until real extraction runs
          </span>
        </div>
      )}

      {/* Editor Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--surface-border)]">
        <div>
          <h2 className="text-xl font-bold font-heading text-foreground">
            Structured Owner Record: {vehicleName}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verify or correct every extracted metric inline. Empty fields appear as &quot;Not mentioned&quot;.
          </p>
        </div>

        {saveStatus && (
          <span className="text-xs font-mono text-accent animate-pulse self-start sm:self-auto">
            {saveStatus}
          </span>
        )}
      </div>

      {/* Core Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Kilometers Driven */}
        <div className="rounded-xl border border-[var(--surface-border)] bg-background/60 p-4 space-y-1.5">
          <label className="text-[11px] uppercase font-mono tracking-wider text-muted-foreground">
            Kilometers Driven
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={data.km_driven ?? ""}
              onChange={(e) => updateField("km_driven", e.target.value ? parseInt(e.target.value, 10) : null)}
              placeholder="Not mentioned"
              className="w-full bg-surface border border-[var(--surface-border)] rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground focus:border-accent focus:outline-none"
            />
            <span className="text-xs text-muted-foreground font-mono">km</span>
          </div>
        </div>

        {/* Ownership Duration */}
        <div className="rounded-xl border border-[var(--surface-border)] bg-background/60 p-4 space-y-1.5">
          <label className="text-[11px] uppercase font-mono tracking-wider text-muted-foreground">
            Ownership Duration
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={data.ownership_months ?? ""}
              onChange={(e) => updateField("ownership_months", e.target.value ? parseInt(e.target.value, 10) : null)}
              placeholder="Not mentioned"
              className="w-full bg-surface border border-[var(--surface-border)] rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground focus:border-accent focus:outline-none"
            />
            <span className="text-xs text-muted-foreground font-mono">months</span>
          </div>
        </div>

        {/* Real-World Fuel Economy */}
        <div className="rounded-xl border border-[var(--surface-border)] bg-background/60 p-4 space-y-1.5">
          <label className="text-[11px] uppercase font-mono tracking-wider text-muted-foreground">
            Real Fuel Economy
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              value={data.real_mileage?.value ?? ""}
              onChange={(e) =>
                updateField("real_mileage", {
                  value: e.target.value ? parseFloat(e.target.value) : null,
                  unit: "kmpl",
                  conditions: data.real_mileage?.conditions || "mixed",
                })
              }
              placeholder="Not mentioned"
              className="w-full bg-surface border border-[var(--surface-border)] rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground focus:border-accent focus:outline-none"
            />
            <span className="text-xs text-muted-foreground font-mono">kmpl</span>
          </div>
        </div>
      </div>

      {/* Would Buy Again */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-background/60 p-5 space-y-3">
        <label className="text-xs font-semibold text-foreground block">
          Would you buy this vehicle again?
        </label>
        <div className="flex items-center gap-3">
          {(["yes", "maybe", "no"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => updateField("would_buy_again", choice)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                data.would_buy_again === choice
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "bg-surface border border-[var(--surface-border)] text-muted-foreground hover:text-foreground"
              }`}
            >
              {choice}
            </button>
          ))}
          {data.would_buy_again === null && (
            <span className="text-xs text-muted-foreground italic">Not mentioned</span>
          )}
        </div>
      </div>

      {/* Numerical Ratings (1 to 5) */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-background/60 p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Ratings (1 to 5)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { key: "comfort", label: "Ride Comfort" },
            { key: "performance", label: "Engine Performance" },
            { key: "reliability", label: "Mechanical Reliability" },
            { key: "build_quality", label: "Fit & Finish" },
            { key: "service_experience", label: "Service Experience" },
            { key: "value_for_money", label: "Value For Money" },
          ].map(({ key, label }) => {
            const currentScore = data.ratings?.[key as keyof typeof data.ratings] ?? null;
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono text-foreground font-bold">
                    {currentScore !== null ? `${currentScore}/5` : "Not mentioned"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingChange(key, star)}
                      className={`h-7 w-7 rounded-md border text-xs font-bold transition-all ${
                        currentScore !== null && star <= currentScore
                          ? "bg-accent/20 border-accent text-accent"
                          : "bg-surface border-[var(--surface-border)] text-muted-foreground hover:border-zinc-500"
                      }`}
                    >
                      {star}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pros & Cons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pros */}
        <div className="rounded-xl border border-[var(--surface-border)] bg-background/60 p-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">
            Verified Positives (Pros)
          </h3>
          <div className="space-y-2">
            {(data.pros || []).map((pro, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface text-xs">
                <span>{pro}</span>
                <button
                  type="button"
                  onClick={() => handleRemovePro(idx)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <input
              type="text"
              placeholder="+ Type a pro and press Enter"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddPro(e.currentTarget.value);
                  e.currentTarget.value = "";
                }
              }}
              className="w-full rounded-lg border border-[var(--surface-border)] bg-surface px-3 py-2 text-xs placeholder:text-muted-foreground focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Cons */}
        <div className="rounded-xl border border-[var(--surface-border)] bg-background/60 p-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive">
            Verified Negatives (Cons)
          </h3>
          <div className="space-y-2">
            {(data.cons || []).map((con, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface text-xs">
                <span>{con}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCon(idx)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <input
              type="text"
              placeholder="+ Type a con and press Enter"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCon(e.currentTarget.value);
                  e.currentTarget.value = "";
                }
              }}
              className="w-full rounded-lg border border-[var(--surface-border)] bg-surface px-3 py-2 text-xs placeholder:text-muted-foreground focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Reported Mechanical Issues */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-background/60 p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Reported Component Issues
        </h3>
        {(!data.issues || data.issues.length === 0) ? (
          <p className="text-xs text-muted-foreground italic">No mechanical or build issues reported.</p>
        ) : (
          <div className="space-y-2">
            {data.issues.map((issue, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-[var(--surface-border)] bg-surface text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground uppercase">{issue.component}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-subtle text-muted-foreground">
                    Severity: {issue.severity}/5
                  </span>
                </div>
                <p className="text-muted-foreground">{issue.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* One-Line Verdict */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-background/60 p-5 space-y-2">
        <label className="text-xs font-semibold text-foreground block">
          One-Line Owner Verdict
        </label>
        <input
          type="text"
          value={data.one_line_verdict || ""}
          onChange={(e) => updateField("one_line_verdict", e.target.value)}
          placeholder="e.g. Robust highway companion that demands patience in congested city traffic."
          className="w-full rounded-lg border border-[var(--surface-border)] bg-surface px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
        />
      </div>

      {/* Evidence Quotes Verified Verbatim */}
      {data.evidence && data.evidence.length > 0 && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-2">
          <span className="text-[11px] font-semibold text-accent uppercase tracking-wider block">
            Verbatim Evidence Quotes ({data.evidence.length} verified)
          </span>
          <div className="space-y-1.5">
            {data.evidence.map((ev, idx) => (
              <div key={idx} className="text-xs text-foreground/90 italic border-l-2 border-accent pl-2.5">
                &quot;{ev.quote}&quot; <span className="text-[10px] text-muted-foreground not-italic font-mono">({ev.field})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Publish Button (Disabled for M2 per Spec Scope) */}
      <div className="pt-4 border-t border-[var(--surface-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-muted-foreground">
          Step 4 complete. Review is saved in draft mode.
        </div>
        <button
          type="button"
          disabled={true}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-surface-subtle border border-[var(--surface-border)] px-6 py-3 text-xs font-bold text-muted-foreground cursor-not-allowed opacity-75"
        >
          <Lock className="h-3.5 w-3.5" />
          Verification comes next
        </button>
      </div>
    </div>
  );
}
