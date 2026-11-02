# Real Miles - Assumptions & Design Decisions

> *Historical Note: Formerly titled OwnerLog in initial prototype specifications.*

This document records sensible defaults and choices made according to Section 0.1 of the build specification.

## Milestone 1: Foundation Assumptions

1. **Local Development Without Supabase Credentials**:
   - To enable immediate local evaluation and rapid testing without forcing users to pre-configure remote Supabase cloud credentials first, a lightweight fallback data layer provides in-memory mock authentication and returns the 8 seeded vehicles.
   - As soon as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are provided in `.env.local`, the application automatically switches to live Supabase Postgres and Auth.

2. **Visual Design & Typography**:
   - Primary dark surface: `#09090b` (zinc-950) with card background `#121417` (near-black with subtle cool tint) and border `#27272a`.
   - Electric Accent: Electric Lime (`#84cc16` / `#a3e635`), satisfying WCAG AAA contrast requirements (>11:1 against near-black surfaces).
   - Fonts: Heading uses `Space Grotesk`, body uses `Inter` (configured via Next.js Google Fonts `next/font/google` for zero-layout-shift and privacy).
   - Border radius: Standardized to 16px (`rounded-card` / `rounded-lg`).

3. **Launch Seed Vehicles**:
   - 4 Cars:
     - `mahindra-thar`: Mahindra Thar (4x4 SUV, Diesel/Petrol)
     - `tata-harrier`: Tata Harrier (Mid-size SUV, Diesel)
     - `hyundai-creta`: Hyundai Creta (Compact SUV, Petrol/Diesel)
     - `bmw-330li`: BMW 330Li (Executive Sedan, Petrol)
   - 4 Bikes:
     - `ktm-390-adventure-s`: KTM 390 Adventure S (Dual-sport / Adventure, Petrol)
     - `re-himalayan-450`: Royal Enfield Himalayan 450 (Adventure, Petrol)
     - `re-classic-350`: Royal Enfield Classic 350 (Retro Cruiser, Petrol)
     - `ktm-390-duke`: KTM 390 Duke (Naked Sport, Petrol)
   - Hero images: High-contrast aesthetic SVG / CSS gradient placeholders showing vehicle name and category badge, avoiding copyrighted scraped manufacturer imagery. Admins can upload custom hero photos to the `vehicle_heroes` storage bucket.

4. **Authentication**:
   - Primary production methods: Supabase Auth Magic Link (Email OTP) and Google OAuth.
   - Development fallback: Interactive simulated sign-in for quick local testing and role-switching (regular user vs. admin).
   - Role evaluation: Users listed in `ADMIN_EMAILS` or with `role = 'admin'` in `profiles` obtain admin privileges for queues and vehicle moderation.

5. **API Response Format**:
   - Standard response payload format: `{ ok: true, data: T }` on success, or `{ ok: false, error: string }` on failure with appropriate HTTP status codes.

6. **Free-tier Limits & Provider Isolation**:
   - All AI integrations (LLM, STT, Vision, Embeddings) live behind interfaces under `lib/providers/` to allow seamless swapping between Gemini and Groq without changing application logic.

## Milestone 2: Review Submission, Transcription, Extraction Assumptions

1. **Provider Models & Outdated Default Model Names**:
   - Model names (`LLM_MODEL`, `STT_MODEL`, `EMBED_MODEL`) are read strictly from environment variables and never hardcoded in provider source files.
   - **Outdated Model Notice**: The `LLM_MODEL` and `EMBED_MODEL` values in `.env.example` (and `.env.local`) were written from memory based on initial project notes and must be verified against the providers' live model lists (e.g. Google AI Studio and Groq live documentation) prior to production deployment.

2. **Explicit Mock Providers (Zero Silent Fallbacks)**:
   - When `LLM_MODE=mock` or `STT_MODE=mock` is set, explicit mock engines are used.
   - If `LLM_MODE` or `STT_MODE` is not `mock` and the corresponding API key (`GEMINI_API_KEY`, `GROQ_API_KEY`) is missing, API routes fail immediately with a typed `"Provider not configured"` error response. Mocks **never** activate silently.
   - All structured outputs produced by the mock LLM carry `mock: true`. Reviews with `mock: true` are prohibited in code from being published or embedded.
   - The server refuses to initialize or run with `LLM_MODE=mock` or `STT_MODE=mock` when `NODE_ENV=production`.

3. **Explicit Local Data Mode (`DATA_MODE=local`)**:
   - Local mode stores reviews, transcripts, and structured extraction results in `.data/ownerlog.json`, and uploaded media files in `.data/uploads/`.
   - Local mode is strictly explicit: it activates only when `DATA_MODE=local` is set.
   - If `DATA_MODE` is unset and Supabase is not configured, the app raises a configuration error.
   - The application strictly refuses to boot in production (`NODE_ENV=production`) if `DATA_MODE=local`.
   - A persistent global UI banner warns: *"Local mode: data is not backed up"*.
   - `.data/` is excluded in `.gitignore`.

4. **Verbatim Quote Verification & Prompt Injection Defense**:
   - Owner input (audio transcripts, typed raw text) is treated as untrusted user data and wrapped inside `<owner_content>` delimiters in LLM prompts.
   - Every evidence item quote returned by the model is verified via normalized substring matching against the source text/transcript. Any non-verbatim or fabricated quote is stripped before saving.
   - If the LLM classifies input as non-review (`{"error": "not_a_review"}`), this is passed transparently to the user interface.

