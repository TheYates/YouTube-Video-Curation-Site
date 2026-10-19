-- Curator-review marker for the editorial layer. `editorial_note` is seeded as
-- an AI draft by scripts/draft-editorial.mjs; this timestamp is set when a human
-- reviews/edits that note in /admin/videos/[id]. NULL = still an AI draft, so
-- /admin can show editing progress without inferring it from word counts.
--
-- Writes go through the `curate` edge function (service role). Applied via
-- `supabase db push` (or run once in the Supabase SQL editor).

alter table videos add column if not exists editorial_reviewed_at timestamptz;
