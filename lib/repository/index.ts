import fs from "fs";
import path from "path";
import { Review, ReviewStatus, ProcessingState, VerificationStatus } from "@/lib/types";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";

export interface ReviewRepository {
  createDraft(data: Partial<Review>): Promise<Review>;
  getReviewById(id: string): Promise<Review | null>;
  updateReview(id: string, updates: Partial<Review>): Promise<Review>;
  listReviews(filter?: { userId?: string; vehicleId?: string; status?: ReviewStatus }): Promise<Review[]>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface RateLimiter {
  checkLimit(key: string, maxRequests: number, windowSeconds: number): Promise<RateLimitResult>;
}

export interface StorageProvider {
  getUploadEndpoint(bucket: string, filename: string): Promise<{ uploadUrl: string; storagePath: string }>;
  downloadFile(bucket: string, storagePath: string): Promise<Buffer>;
  saveUploadedBuffer(bucket: string, storagePath: string, buffer: Buffer): Promise<string>;
}

// ==============================================================================
// LOCAL REPOSITORY IMPLEMENTATION (DATA_MODE=local)
// ==============================================================================

const DATA_DIR = path.join(process.cwd(), ".data");
const REVIEWS_FILE = path.join(DATA_DIR, "realmiles.json");
const RATE_LIMITS_FILE = path.join(DATA_DIR, "realmiles_rate_limits.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

function ensureLocalDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(REVIEWS_FILE)) {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
  if (!fs.existsSync(RATE_LIMITS_FILE)) {
    fs.writeFileSync(RATE_LIMITS_FILE, JSON.stringify({}, null, 2), "utf-8");
  }
}

export class LocalReviewRepository implements ReviewRepository {
  constructor() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SECURITY VIOLATION: LocalReviewRepository cannot run when NODE_ENV=production.");
    }
    ensureLocalDirs();
  }

  private readAll(): Review[] {
    try {
      const content = fs.readFileSync(REVIEWS_FILE, "utf-8");
      return JSON.parse(content) as Review[];
    } catch {
      return [];
    }
  }

  private writeAll(reviews: Review[]): void {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), "utf-8");
  }

  async createDraft(data: Partial<Review>): Promise<Review> {
    const reviews = this.readAll();
    const newId = `rev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const newReview: Review = {
      id: newId,
      user_id: data.user_id || "00000000-0000-0000-0000-000000000002",
      vehicle_id: data.vehicle_id || "",
      variant: data.variant || null,
      model_year: data.model_year || null,
      purchase_month: data.purchase_month || null,
      status: "draft",
      processing_state: data.processing_state || "uploaded",
      source_types: data.source_types || [],
      raw_text: data.raw_text || null,
      transcript: data.transcript || null,
      transcript_segments: data.transcript_segments || null,
      structured: data.structured || null,
      structured_version: 1,
      media: data.media || [],
      video_url: data.video_url || null,
      poster_url: data.poster_url || null,
      photo_urls: data.photo_urls || [],
      followups: [],
      verification_status: "none",
      is_demo: false,
      helpful_count: 0,
      created_at: new Date().toISOString(),
    };

    reviews.unshift(newReview);
    this.writeAll(reviews);
    return newReview;
  }

  async getReviewById(id: string): Promise<Review | null> {
    const reviews = this.readAll();
    return reviews.find((r) => r.id === id) || null;
  }

  async updateReview(id: string, updates: Partial<Review>): Promise<Review> {
    const reviews = this.readAll();
    const index = reviews.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Review not found: ${id}`);
    }

    const current = reviews[index];

    // Enforce mock review cannot be published in code (Spec Requirement)
    if (updates.status === "published" || current.status === "published") {
      if (current.structured?.mock || updates.structured?.mock) {
        throw new Error("SECURITY POLICY VIOLATION: Mock-extracted reviews are prohibited from being published.");
      }
    }

    const updated: Review = {
      ...current,
      ...updates,
      id: current.id, // prevent changing ID
    };

    reviews[index] = updated;
    this.writeAll(reviews);
    return updated;
  }

  async listReviews(filter?: { userId?: string; vehicleId?: string; status?: ReviewStatus }): Promise<Review[]> {
    let reviews = this.readAll();
    if (filter?.userId) {
      reviews = reviews.filter((r) => r.user_id === filter.userId);
    }
    if (filter?.vehicleId) {
      reviews = reviews.filter((r) => r.vehicle_id === filter.vehicleId);
    }
    if (filter?.status) {
      reviews = reviews.filter((r) => r.status === filter.status);
    }
    return reviews;
  }
}

export class LocalRateLimiter implements RateLimiter {
  constructor() {
    ensureLocalDirs();
  }

  async checkLimit(key: string, maxRequests: number, windowSeconds: number): Promise<RateLimitResult> {
    let store: Record<string, { count: number; windowStart: number }> = {};
    try {
      store = JSON.parse(fs.readFileSync(RATE_LIMITS_FILE, "utf-8"));
    } catch {
      store = {};
    }

    const now = Date.now();
    const record = store[key];

    if (!record || now - record.windowStart > windowSeconds * 1000) {
      store[key] = { count: 1, windowStart: now };
      fs.writeFileSync(RATE_LIMITS_FILE, JSON.stringify(store, null, 2), "utf-8");
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(now + windowSeconds * 1000),
      };
    }

    if (record.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(record.windowStart + windowSeconds * 1000),
      };
    }

    record.count += 1;
    store[key] = record;
    fs.writeFileSync(RATE_LIMITS_FILE, JSON.stringify(store, null, 2), "utf-8");

    return {
      allowed: true,
      remaining: maxRequests - record.count,
      resetAt: new Date(record.windowStart + windowSeconds * 1000),
    };
  }
}

export class LocalStorageProvider implements StorageProvider {
  constructor() {
    ensureLocalDirs();
  }

  async getUploadEndpoint(bucket: string, filename: string): Promise<{ uploadUrl: string; storagePath: string }> {
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${bucket}/${Date.now()}_${cleanFilename}`;
    const uploadUrl = `/api/uploads/local?path=${encodeURIComponent(storagePath)}`;
    return { uploadUrl, storagePath };
  }

  async downloadFile(_bucket: string, storagePath: string): Promise<Buffer> {
    const filePath = path.join(DATA_DIR, "uploads", storagePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local file not found at path: ${storagePath}`);
    }
    return fs.readFileSync(filePath);
  }

  async saveUploadedBuffer(_bucket: string, storagePath: string, buffer: Buffer): Promise<string> {
    const fullPath = path.join(DATA_DIR, "uploads", storagePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, buffer);
    return storagePath;
  }
}

// ==============================================================================
// SUPABASE REPOSITORY IMPLEMENTATION (DATA_MODE=supabase)
// ==============================================================================

export class SupabaseReviewRepository implements ReviewRepository {
  async createDraft(data: Partial<Review>): Promise<Review> {
    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: inserted, error } = await supabase
      .from("reviews")
      .insert({
        user_id: data.user_id,
        vehicle_id: data.vehicle_id,
        variant: data.variant || null,
        model_year: data.model_year || null,
        purchase_month: data.purchase_month || null,
        status: "draft",
        processing_state: data.processing_state || "uploaded",
        source_types: data.source_types || [],
        raw_text: data.raw_text || null,
        transcript: data.transcript || null,
        transcript_segments: data.transcript_segments || null,
        structured: data.structured || null,
        structured_version: 1,
        verification_status: "none",
        is_demo: false,
      })
      .select()
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to create review in Supabase: ${error?.message}`);
    }
    return inserted as Review;
  }

  async getReviewById(id: string): Promise<Review | null> {
    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as Review;
  }

  async updateReview(id: string, updates: Partial<Review>): Promise<Review> {
    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase is not configured.");

    // Enforce mock cannot be published in code
    if (updates.status === "published" && updates.structured?.mock) {
      throw new Error("SECURITY POLICY VIOLATION: Mock-extracted reviews are prohibited from being published.");
    }

    const { data, error } = await supabase
      .from("reviews")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update review in Supabase: ${error?.message}`);
    }
    return data as Review;
  }

  async listReviews(filter?: { userId?: string; vehicleId?: string; status?: ReviewStatus }): Promise<Review[]> {
    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase is not configured.");

    let query = supabase.from("reviews").select("*");
    if (filter?.userId) query = query.eq("user_id", filter.userId);
    if (filter?.vehicleId) query = query.eq("vehicle_id", filter.vehicleId);
    if (filter?.status) query = query.eq("status", filter.status);

    const { data, error } = await query;
    if (error || !data) return [];
    return data as Review[];
  }
}

export class SupabaseRateLimiter implements RateLimiter {
  async checkLimit(key: string, maxRequests: number, windowSeconds: number): Promise<RateLimitResult> {
    const admin = createAdminClient();
    if (!admin) {
      // Fallback in case of misconfiguration
      return { allowed: true, remaining: maxRequests, resetAt: new Date(Date.now() + windowSeconds * 1000) };
    }

    const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * (windowSeconds * 1000)).toISOString();

    const { data, error } = await admin.rpc("increment_rate_limit", {
      p_key: key,
      p_window_start: windowStart,
    });

    if (error) {
      return { allowed: true, remaining: 1, resetAt: new Date(Date.now() + windowSeconds * 1000) };
    }

    const count = typeof data === "number" ? data : 1;
    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetAt: new Date(Date.now() + windowSeconds * 1000),
    };
  }
}

export class SupabaseStorageProvider implements StorageProvider {
  async getUploadEndpoint(bucket: string, filename: string): Promise<{ uploadUrl: string; storagePath: string }> {
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase service client not available.");

    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${Date.now()}_${cleanFilename}`;

    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(storagePath);
    if (error || !data) {
      throw new Error(`Failed to create signed Supabase upload URL: ${error?.message}`);
    }

    return { uploadUrl: data.signedUrl, storagePath };
  }

  async downloadFile(bucket: string, storagePath: string): Promise<Buffer> {
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase service client not available.");

    const { data, error } = await admin.storage.from(bucket).download(storagePath);
    if (error || !data) {
      throw new Error(`Failed to download file from Supabase storage: ${error?.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async saveUploadedBuffer(bucket: string, storagePath: string, buffer: Buffer): Promise<string> {
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase service client not available.");

    const { error } = await admin.storage.from(bucket).upload(storagePath, buffer, { upsert: true });
    if (error) {
      throw new Error(`Failed to upload to Supabase: ${error.message}`);
    }
    return storagePath;
  }
}

// ==============================================================================
// FACTORY FUNCTIONS
// ==============================================================================

export function getRepository(): ReviewRepository {
  const isLocal = process.env.DATA_MODE === "local";

  if (isLocal) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: DATA_MODE=local is forbidden in production.");
    }
    return new LocalReviewRepository();
  }

  return new SupabaseReviewRepository();
}

export function getRateLimiter(): RateLimiter {
  const isLocal = process.env.DATA_MODE === "local";
  if (isLocal) {
    return new LocalRateLimiter();
  }
  return new SupabaseRateLimiter();
}

export function getStorageProvider(): StorageProvider {
  const isLocal = process.env.DATA_MODE === "local";
  if (isLocal) {
    return new LocalStorageProvider();
  }
  return new SupabaseStorageProvider();
}
