import { StructuredReview } from "@/lib/schema/review";

export type UserRole = "user" | "admin";

export interface Profile {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_path: string | null;
  brand_affiliation?: string | null;
  role: UserRole;
  created_at: string;
}

export type VehicleCategory = "car" | "bike";

export interface Vehicle {
  id: string;
  slug: string;
  make: string;
  model: string;
  category: VehicleCategory;
  fuel_type: string;
  hero_path?: string | null;
  created_at: string;
}

export type ReviewStatus = "draft" | "pending_verification" | "published" | "rejected" | "removed";
export type ProcessingState = "uploaded" | "transcribing" | "extracting" | "needs_confirm" | "confirmed" | "failed";
export type VerificationStatus = "none" | "auto_verified" | "manual_pending" | "manual_verified" | "rejected";

export interface TranscriptSegment {
  id?: number;
  start: number;
  end: number;
  text: string;
}

export interface ReviewMediaItem {
  id?: string;
  kind: "video" | "audio" | "photo" | "odometer";
  storage_path: string;
  duration_s?: number | null;
  timestamp?: string | null;
}

export interface Review {
  id: string;
  user_id: string;
  vehicle_id: string;
  variant?: string | null;
  model_year?: number | null;
  purchase_month?: string | null;
  status: ReviewStatus;
  processing_state: ProcessingState;
  source_types: string[];
  transcript?: string | null;
  transcript_segments?: TranscriptSegment[] | null;
  raw_text?: string | null;
  structured?: StructuredReview | null;
  structured_version: number;
  media?: ReviewMediaItem[];
  video_url?: string | null;
  poster_url?: string | null;
  photo_urls?: string[];
  followups?: Array<{
    question: string;
    target_field: string;
    answer?: string;
    skipped?: boolean;
  }> | null;
  verification_status: VerificationStatus;
  is_demo: boolean;
  helpful_count: number;
  created_at: string;
  published_at?: string | null;
  profiles?: Profile;
  vehicles?: Vehicle;
}

export interface AggregateStats {
  weighted_ratings?: {
    comfort: number;
    performance: number;
    reliability: number;
    build_quality: number;
    service_experience: number;
    value_for_money: number;
    sample_sizes: Record<string, number>;
  };
  would_buy_again?: {
    yes_pct: number;
    maybe_pct: number;
    no_pct: number;
    total: number;
  };
  mileage_by_usage?: {
    city_heavy?: { median: number; n: number };
    highway_heavy?: { median: number; n: number };
    mixed?: { median: number; n: number };
  };
  service_cost?: {
    median_annual_inr: number;
    min_inr: number;
    max_inr: number;
    n: number;
  };
  top_issues?: Array<{
    component: string;
    count: number;
    share_pct: number;
    mean_severity: number;
    share_unresolved_pct: number;
  }>;
  best_for?: string[];
  avoid_if?: string[];
}

export interface VehicleAggregate {
  vehicle_id: string;
  n_reviews: number;
  stats: AggregateStats;
  verdict_text?: string | null;
  verdict_n: number;
  verdict_updated_at?: string | null;
}

export type ApiResponse<T> = 
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };
