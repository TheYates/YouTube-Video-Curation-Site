-- Page-view tracking for real analytics. Run once in the Supabase SQL editor
-- (Dashboard → SQL). One row per video page mount (the frontend dedupes
-- repeat views per browser session via sessionStorage).

create table page_views (
  id        bigserial primary key,
  video_id  uuid references videos(id) on delete cascade not null,
  viewed_at timestamptz default now() not null
);
create index page_views_video_idx on page_views (video_id);
create index page_views_at_idx on page_views (viewed_at);

alter table page_views enable row level security;

-- Public read (analytics page uses the anon key).
create policy "Public read page_views" on page_views for select using (true);

-- Anonymous append-only inserts: anyone can log a view, but no one can
-- read/update/delete through this policy (reads use the policy above).
create policy "Anonymous log page_views" on page_views for insert with check (true);
