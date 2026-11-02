-- Enable pgvector extension for review chunk semantic search
create extension if not exists vector;

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  display_name text,
  avatar_path text,
  brand_affiliation text default null,
  role text default 'user' not null check (role in ('user', 'admin')),
  created_at timestamptz default now() not null
);

-- 2. Vehicles Table
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  make text not null,
  model text not null,
  category text not null check (category in ('car', 'bike')),
  fuel_type text not null,
  hero_path text,
  created_at timestamptz default now() not null
);

-- 3. Reviews Table
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  variant text,
  model_year int,
  purchase_month date,
  status text not null default 'draft' check (status in ('draft', 'pending_verification', 'published', 'rejected', 'removed')),
  processing_state text not null default 'uploaded' check (processing_state in ('uploaded', 'transcribing', 'extracting', 'needs_confirm', 'confirmed', 'failed')),
  source_types text[] default '{}',
  transcript text,
  transcript_segments jsonb default '[]'::jsonb,
  raw_text text,
  structured jsonb default '{}'::jsonb,
  structured_version int default 1,
  followups jsonb default '[]'::jsonb,
  verification_status text not null default 'none' check (verification_status in ('none', 'auto_verified', 'manual_pending', 'manual_verified', 'rejected')),
  is_demo boolean not null default false,
  helpful_count int not null default 0,
  created_at timestamptz default now() not null,
  published_at timestamptz
);

-- 4. Review Media Table
create table if not exists public.review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  kind text not null check (kind in ('video', 'audio', 'photo', 'odometer')),
  storage_path text not null,
  duration_s numeric,
  sha256 text,
  exif jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);

-- Unique index for odometer sha256 to block reuse of one odometer photo across reviews
create unique index if not exists idx_review_media_odometer_sha256
  on public.review_media (sha256)
  where kind = 'odometer' and sha256 is not null;

-- 5. Review Chunks Table (Vector Embeddings)
create table if not exists public.review_chunks (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  kind text not null,
  content text not null,
  source_start_s numeric,
  source_end_s numeric,
  embedding vector(768),
  created_at timestamptz default now() not null
);

-- Cosine index for review chunks vector search
create index if not exists idx_review_chunks_embedding
  on public.review_chunks using hnsw (embedding vector_cosine_ops);

-- 6. Vehicle Aggregates Table
create table if not exists public.vehicle_aggregates (
  vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
  n_reviews int not null default 0,
  stats jsonb default '{}'::jsonb,
  verdict_text text,
  verdict_n int default 0,
  verdict_updated_at timestamptz
);

-- 7. Comments Table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now() not null
);

-- 8. Reports Table
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('review', 'comment')),
  target_id uuid not null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz default now() not null
);

-- 9. Chat Sessions & Messages
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb default '[]'::jsonb,
  created_at timestamptz default now() not null
);

-- 10. Rate Limits Table
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);

-- Security Definer Helper for Role Checking
create or replace function public.is_admin(user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
begin
  if user_id is null then
    return false;
  end if;
  select role into user_role from public.profiles where id = user_id;
  return user_role = 'admin';
end;
$$;

-- Function: Semantic Chunk Search
create or replace function public.match_chunks (
  query_embedding vector(768),
  match_threshold float default 0.3,
  match_count int default 8,
  filter_vehicle_id uuid default null
)
returns table (
  id uuid,
  review_id uuid,
  vehicle_id uuid,
  kind text,
  content text,
  source_start_s numeric,
  source_end_s numeric,
  similarity float
)
language sql stable
as $$
  select
    rc.id,
    rc.review_id,
    rc.vehicle_id,
    rc.kind,
    rc.content,
    rc.source_start_s,
    rc.source_end_s,
    1 - (rc.embedding <=> query_embedding) as similarity
  from public.review_chunks rc
  inner join public.reviews r on rc.review_id = r.id
  where r.status = 'published'
    and (filter_vehicle_id is null or rc.vehicle_id = filter_vehicle_id)
    and 1 - (rc.embedding <=> query_embedding) > match_threshold
  order by rc.embedding <=> query_embedding
  limit match_count;
$$;

-- Trigger: create profile automatically when a new user signs up via auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text;
  generated_handle text;
begin
  raw_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  generated_handle := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '_', 'g')) || '_' || substr(new.id::text, 1, 4);

  insert into public.profiles (id, handle, display_name, avatar_path, role)
  values (
    new.id,
    generated_handle,
    coalesce(raw_name, 'Driver'),
    new.raw_user_meta_data->>'avatar_url',
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.reviews enable row level security;
alter table public.review_media enable row level security;
alter table public.review_chunks enable row level security;
alter table public.vehicle_aggregates enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.rate_limits enable row level security;

-- RLS Policies

-- Profiles: Anyone can read, users can update their own profile, admins can manage all
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Vehicles: Viewable by everyone, insert/update/delete only by admin
create policy "Vehicles are viewable by everyone"
  on public.vehicles for select using (true);

create policy "Admins can insert vehicles"
  on public.vehicles for insert with check (public.is_admin(auth.uid()));

create policy "Admins can update vehicles"
  on public.vehicles for update using (public.is_admin(auth.uid()));

create policy "Admins can delete vehicles"
  on public.vehicles for delete using (public.is_admin(auth.uid()));

-- Reviews:
-- Anyone can read published, non-removed reviews
-- Users can view and edit their own reviews (including drafts)
-- Admins can view and edit all reviews
create policy "Published reviews are viewable by everyone"
  on public.reviews for select using (
    (status = 'published') or
    (auth.uid() = user_id) or
    public.is_admin(auth.uid())
  );

create policy "Users can insert their own reviews"
  on public.reviews for insert with check (auth.uid() = user_id);

create policy "Users can update their own reviews"
  on public.reviews for update using (
    auth.uid() = user_id or public.is_admin(auth.uid())
  );

create policy "Users can delete their own draft reviews"
  on public.reviews for delete using (
    (auth.uid() = user_id and status = 'draft') or public.is_admin(auth.uid())
  );

-- Review Media:
-- Non-odometer media for published reviews is public
-- Odometer media is private: only review author and admins can view
create policy "Review media viewable by author, admin, or public if non-odometer"
  on public.review_media for select using (
    kind != 'odometer' and exists (
      select 1 from public.reviews r
      where r.id = review_id and r.status = 'published'
    )
    or exists (
      select 1 from public.reviews r
      where r.id = review_id and (r.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

create policy "Users can insert media for their own reviews"
  on public.review_media for insert with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and (r.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

-- Review Chunks:
-- Viewable for published reviews or by admin
create policy "Review chunks viewable for published reviews"
  on public.review_chunks for select using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.status = 'published'
    ) or public.is_admin(auth.uid())
  );

create policy "Review chunks manageable by review owner or admin"
  on public.review_chunks for all using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and (r.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

-- Vehicle Aggregates:
create policy "Vehicle aggregates are viewable by everyone"
  on public.vehicle_aggregates for select using (true);

create policy "Vehicle aggregates manageable by service role and admin"
  on public.vehicle_aggregates for all using (
    public.is_admin(auth.uid()) or auth.role() = 'service_role'
  );

-- Comments:
create policy "Comments on published reviews are viewable by everyone"
  on public.comments for select using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.status = 'published'
    )
  );

create policy "Authenticated users can post comments"
  on public.comments for insert with check (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on public.comments for delete using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- Reports:
create policy "Authenticated users can create reports"
  on public.reports for insert with check (auth.uid() = reporter_id);

create policy "Admins can view and manage reports"
  on public.reports for all using (public.is_admin(auth.uid()));

-- Chat Sessions & Messages:
create policy "Chat sessions viewable by session owner"
  on public.chat_sessions for select using (
    user_id is null or auth.uid() = user_id or public.is_admin(auth.uid())
  );

create policy "Anyone can create a chat session"
  on public.chat_sessions for insert with check (
    user_id is null or auth.uid() = user_id
  );

create policy "Chat messages viewable by session creator"
  on public.chat_messages for select using (
    exists (
      select 1 from public.chat_sessions cs
      where cs.id = session_id and (cs.user_id is null or cs.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

create policy "Chat messages can be added to valid sessions"
  on public.chat_messages for insert with check (
    exists (
      select 1 from public.chat_sessions cs
      where cs.id = session_id and (cs.user_id is null or cs.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

-- Rate limits:
create policy "Rate limits manageable by service role or internal functions"
  on public.rate_limits for all using (true);
