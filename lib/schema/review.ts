import { z } from "zod";

export const UsageMixSchema = z.object({
  city_pct: z.number().min(0).max(100).nullable().default(null),
  highway_pct: z.number().min(0).max(100).nullable().default(null),
  offroad_pct: z.number().min(0).max(100).nullable().default(null),
});

export const RealMileageSchema = z.object({
  value: z.number().positive().nullable().default(null),
  unit: z.enum(["kmpl", "km/kWh"]).nullable().default("kmpl"),
  conditions: z.string().nullable().default(null),
});

export const ServiceHistorySchema = z.object({
  avg_annual_cost_inr: z.number().int().nonnegative().nullable().default(null),
  visits: z.number().int().nonnegative().nullable().default(null),
  experience_rating: z.number().int().min(1).max(5).nullable().default(null),
  notes: z.string().nullable().default(null),
});

export const IssueItemSchema = z.object({
  component: z.string(),
  severity: z.number().int().min(1).max(5),
  description: z.string(),
  first_seen_month: z.number().int().nullable().default(null),
  resolved: z.boolean().default(false),
  cost_inr: z.number().int().nonnegative().nullable().default(null),
});

export const RatingsSchema = z.object({
  comfort: z.number().int().min(1).max(5).nullable().default(null),
  performance: z.number().int().min(1).max(5).nullable().default(null),
  reliability: z.number().int().min(1).max(5).nullable().default(null),
  build_quality: z.number().int().min(1).max(5).nullable().default(null),
  service_experience: z.number().int().min(1).max(5).nullable().default(null),
  value_for_money: z.number().int().min(1).max(5).nullable().default(null),
});

export const HighlightSchema = z.object({
  start_s: z.number().min(0),
  end_s: z.number().min(0),
  reason: z.string(),
});

export const EvidenceItemSchema = z.object({
  field: z.string(),
  quote: z.string().max(300),
  start_s: z.number().min(0).nullable().default(null),
  end_s: z.number().min(0).nullable().default(null),
});

export const StructuredReviewSchema = z.object({
  schema_version: z.literal(1).default(1),
  mock: z.boolean().default(false),
  ownership_months: z.number().int().min(0).nullable().default(null),
  km_driven: z.number().int().min(0).nullable().default(null),
  usage_mix: UsageMixSchema.nullable().default(null),
  real_mileage: RealMileageSchema.nullable().default(null),
  service: ServiceHistorySchema.nullable().default(null),
  issues: z.array(IssueItemSchema).default([]),
  ratings: RatingsSchema.nullable().default(null),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  would_buy_again: z.enum(["yes", "no", "maybe"]).nullable().default(null),
  would_change: z.string().nullable().default(null),
  best_for: z.array(z.string()).default([]),
  avoid_if: z.array(z.string()).default([]),
  one_line_verdict: z.string().nullable().default(null),
  highlight: HighlightSchema.nullable().default(null),
  field_confidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
  evidence: z.array(EvidenceItemSchema).default([]),
  missing_fields: z.array(z.string()).default([]),
});

export type StructuredReview = z.infer<typeof StructuredReviewSchema>;
export type UsageMix = z.infer<typeof UsageMixSchema>;
export type RealMileage = z.infer<typeof RealMileageSchema>;
export type ServiceHistory = z.infer<typeof ServiceHistorySchema>;
export type IssueItem = z.infer<typeof IssueItemSchema>;
export type Ratings = z.infer<typeof RatingsSchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
