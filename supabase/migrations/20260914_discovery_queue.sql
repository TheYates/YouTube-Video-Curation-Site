-- Discovery pipeline: source channels, saved searches, and the review
-- queue of discovered-but-not-yet-ingested videos. Run once in the Supabase
-- SQL editor (Dashboard → SQL).
--
-- Nothing here is publicly writable: no insert/update/delete policies exist,
-- so writes go through the service role only (scripts/discover.mjs locally,
-- the `curate` edge function from the admin UI). Reads are public via RLS —
-- the admin pages use the anon key.

-- ── 1. Source channels (replaces the localStorage list on /admin/sources) ──
create table source_channels (
  id                 uuid primary key default gen_random_uuid(),
  channel_id         text not null unique,          -- YouTube "UC…" channel ID
  handle             text not null,                 -- without the leading @
  name               text not null,
  category           text not null,
  description        text not null default 'Curator pick',
  builtin            boolean not null default false,
  enabled            boolean not null default true,
  last_discovered_at timestamptz,
  created_at         timestamptz not null default now()
);

-- ── 2. Saved discovery searches (polled with publishedAfter=last_polled_at) ──
create table search_queries (
  id             uuid primary key default gen_random_uuid(),
  query          text not null unique,
  category       text not null,
  enabled        boolean not null default true,
  last_polled_at timestamptz,
  created_at     timestamptz not null default now()
);

-- ── 3. Review queue: discovered candidates awaiting the curator ─────────────
-- status: pending → (approved → ingested) | (rejected | failed).
-- failed = approved but ingest attempt failed; retryable by re-approving
-- (the auto-pipeline resets it) or re-approving after attempts < 3.
create table video_candidates (
  id                 uuid primary key default gen_random_uuid(),
  youtube_id         text not null unique,
  title              text not null,
  channel_id         text,
  channel_name       text,
  duration_sec       integer not null default 0,
  thumbnail_url      text not null default '',
  published_at       date,
  discovered_via     text not null default 'search', -- channel | search | related
  source_id          uuid,                           -- FK context only, no cascade needed
  score              numeric(4, 1) not null default 0,
  reason             text not null default '',
  suggested_category text not null default 'General',
  status             text not null default 'pending', -- pending|approved|rejected|ingested|failed
  attempts           integer not null default 0,
  created_at         timestamptz not null default now(),
  decided_at         timestamptz
);

-- The dashboard badge and the review queue both sort/filter on this.
create index video_candidates_status_score_idx on video_candidates (status, score desc);

alter table source_channels enable row level security;
alter table search_queries enable row level security;
alter table video_candidates enable row level security;

create policy "Public read source_channels" on source_channels for select using (true);
create policy "Public read search_queries" on search_queries for select using (true);
create policy "Public read video_candidates" on video_candidates for select using (true);
