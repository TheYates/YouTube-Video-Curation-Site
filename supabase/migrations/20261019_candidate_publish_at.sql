-- Publish scheduling for the review queue. A candidate can be approved now but
-- held until publish_at, so the curator can drip-feed a publishing calendar
-- instead of dumping an approved batch all at once.
--
-- NULL = no schedule: publish on the next auto run (the previous behaviour).
-- The auto-pipeline only ingests approved rows whose publish_at has passed.
-- Applied via `supabase db push` (or run once in the Supabase SQL editor).

alter table video_candidates add column if not exists publish_at timestamptz;

-- The auto-pipeline filters on (status, publish_at) every run.
create index if not exists video_candidates_publish_idx on video_candidates (status, publish_at);
