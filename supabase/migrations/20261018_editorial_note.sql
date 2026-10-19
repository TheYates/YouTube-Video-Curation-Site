-- Human-written editorial note per video page — the "thick" layer that makes a
-- Curataur page more than a transcript. Nullable: pages without one render
-- exactly as before. 150–300 words, curator voice, drafted then edited in
-- /admin/videos/[id]. Writes go through the `curate` edge function (service role).
alter table videos add column if not exists editorial_note text;
