# Real Miles — Indian Vehicle Owner Community

> Anti-marketing, verified Indian vehicle owner data in the spirit of authentic automobile forums — structured, faster, and mobile-first.

---

## 1. Overview & Architectural Philosophy

Anyone can join and read Real Miles. Only verified owners can submit reviews.
Owners can submit reviews via audio voice notes, dashcam/phone videos, photos, or raw text. The engine transcribes, extracts, validates, and stores a single structured record per owner.

Those records power three primary outputs:
1. **Verdict**: Text summary per vehicle, synthesized purely from aggregated owner data (minimum 3 verified reviews threshold).
2. **Video**: Client-side rendered vertical short (9:16) per vehicle and review.
3. **Chat ("Ask the owners")**: RAG-powered buying advisor and vehicle Q&A using strictly cited owner data chunks.

---

## 2. Milestone 1 (M1 Foundation) Status & Verification

Milestone 1 establishes the foundational architecture:
- ✅ **Next.js 14 App Router** with TypeScript strict mode, Tailwind CSS, Space Grotesk & Inter typography, and electric lime accent on near-black surfaces.
- ✅ **Supabase Database Schema & Migrations** (`supabase/migrations/20260101000000_init.sql` and `20260101000001_storage.sql`) enabling `pgvector`, 11 tables with Row Level Security (RLS), private odometer storage policies, and cosine search indexes.
- ✅ **Provider Abstractions** (`lib/providers/{llm,stt,vision,embed}.ts`) isolating Gemini and Groq behind interfaces with zero hardcoded limits.
- ✅ **Seed Vehicle Catalog** containing the 8 launch vehicles (4 Cars: Mahindra Thar, Tata Harrier, Hyundai Creta, BMW 330Li; 4 Bikes: KTM 390 Adventure S, Royal Enfield Himalayan 450, Royal Enfield Classic 350, KTM 390 Duke).
- ✅ **Dynamic UI Pages**:
  - Home (`/`) with instant search, category filters (All, Cars, Bikes), 8 vehicle cards, and review feeds.
  - Vehicle Page (`/vehicles/[slug]`) with generative gradient heroes, verdict cards with 0-of-3 progress states, and 4 tab views (Reviews, Issues & Reliability, Ask the Owners, Specs of Ownership).
  - Admin Catalog Management (`/admin/vehicles`) for one-row inserts and hero configuration.
  - Owner Auth & Profile (`/auth/login`, `/profile`) with Supabase Magic Link, Google OAuth, and interactive dev/preview modes.
  - System Health endpoint (`/api/health`) for keepalive pings.

### Acceptance Test for M1:
> **Test**: Sign in, see eight vehicles.

#### How to Run and Verify M1:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the local development server**:
   ```bash
   npm run dev
   ```

3. **Verify the Acceptance Test**:
   - Open [http://localhost:3000](http://localhost:3000) in your browser.
   - You will see the **8 launch vehicles** (Mahindra Thar, Tata Harrier, Hyundai Creta, BMW 330Li, KTM 390 Adventure S, Royal Enfield Himalayan 450, Royal Enfield Classic 350, KTM 390 Duke).
   - Click **"Sign In"** in the top navigation.
   - In development/preview mode, enter your email or click **"Quick Demo Sign In"** (as *Verified Owner* or *Lead Admin*).
   - Once signed in, your driver handle appears in the navigation bar and you can browse any of the 8 vehicle pages with clean empty states.
   - Navigate to `/api/health` to confirm the health check returns `{ ok: true, data: { status: "healthy" } }`.

---

## 3. Assumptions & Default Choices (Spec Section 0.1)

See [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) for full details:
1. **Graceful Fallback Mode**: When remote Supabase or AI provider API keys are not yet configured in `.env.local`, the app uses in-memory mock storage so that reviewers can immediately test and evaluate the UI, auth, and vehicle catalogs out of the box.
2. **Design Language**: Dark mode by default using near-black `#09090b` surfaces, 16px border radiuses, and high-contrast electric lime `#a3e635` / `#84cc16` (>11:1 contrast ratio). Includes a toggle to switch to high-contrast light mode.
3. **Vehicle Heroes**: High-contrast CSS/SVG gradient placeholders displaying vehicle name and spec badges. Hotlinking or scraping copyrighted manufacturer images is prohibited.
4. **Partner Ingest**: `scripts/import-reviews.ts` imports external partner reviews flagged with `source = 'imported'` and `verification_status = 'none'`.

---

## 4. Hosting & Free-Tier Plan Notes (Spec Section 3)

- **Vercel Hobby**: Personal and non-commercial use only. Before commercial launch or monetization, migrate to Cloudflare Pages or an upgraded Vercel plan.
- **Supabase Free Tier Keepalive**: Supabase free projects pause after ~7 days of inactivity. A daily GitHub Actions workflow (`.github/workflows/keepalive.yml`) automatically pings `/api/health` at 06:00 UTC to maintain database uptime.

---

## 5. Trust, Safety & Verification Limitations (Spec Section 8 & 18)

- **Odometer Verification Limitation**: Odometer dashboard photo inspection raises the friction and cost for fake reviews significantly, but does not stop a determined faker with forged images.
- **Future Enhancements**: RC book verification, service invoice PDF ingestion, and cross-review anomaly detection.
- **Rate Limits & Caps**: Free tiers enforce rate limits (Groq Whisper, Gemini Flash). The app batches embeddings and extracts audio client-side (mono 16 kHz) to conserve bandwidth and API quotas.

---

## 6. Environment Configuration & Security

> **CRITICAL SECURITY REQUIREMENT:** API keys (`GEMINI_API_KEY`, `GROQ_API_KEY`) and database service role secrets must live exclusively in `.env.local`. They are never committed to version control. The `.gitignore` file strictly excludes all `.env` and `.env.*` files (except the public template `!.env.example`).

To set up your local environment:
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Populate the required values:
   - For rapid local development, keep `DATA_MODE=local`, `LLM_MODE=mock`, `STT_MODE=mock`.
   - For real AI extraction and cloud storage, provide your live keys and set `DATA_MODE=supabase`, `LLM_MODE=real`, `STT_MODE=real`.

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anonymous API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase admin key |
| `GEMINI_API_KEY` | Google AI Studio free tier API key |
| `GROQ_API_KEY` | Groq Whisper and LLM fallback API key |
| `LLM_MODEL` | Default LLM model (`gemini-1.5-flash`) |
| `EMBED_MODEL` | Vector embedding model (`text-embedding-004`) |
| `SHOW_DEMO` | Show demo review labels (`true`/`false`) |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses |
| `NEXT_PUBLIC_APP_NAME` | Application name (`Real Miles`) |

---

## 7. Database Migration & Remote Seeding

To push the database schema to your Supabase project:
1. Paste `supabase/migrations/20260101000000_init.sql` and `supabase/migrations/20260101000001_storage.sql` into the Supabase SQL Editor.
2. Populate `.env.local` with your Supabase credentials.
3. Seed the 8 launch vehicles:
   ```bash
   npm run seed
   ```
