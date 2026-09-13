-- Human-readable public URLs (/video/<slug>). Slugs are frozen at publish:
-- retitles never change them, so links never break. Applied via
-- `supabase db push` (or run once in the Supabase SQL editor).

alter table videos add column if not exists slug text;

-- Backfill existing rows. SQL-side slugify is ASCII-only (strips diacritics
-- instead of transliterating them); the app slugify handles new rows — both
-- values are frozen after insert, so the styles coexist harmlessly.
-- Duplicates get -2, -3, … suffixes; empty results fall back to 'video'.
with base as (
  select
    id,
    published_at,
    coalesce(
      nullif(
        regexp_replace(
          left(
            regexp_replace(
              regexp_replace(lower(title), '[^a-z0-9\s-]', '', 'g'),
              '[\s_-]+', '-', 'g'
            ),
            60
          ),
          '(^-+|-+$)', '', 'g'
        ),
        ''
      ),
      'video'
    ) as stem
  from videos
  where slug is null
),
ranked as (
  select
    id,
    stem,
    row_number() over (partition by stem order by published_at, id) as rn
  from base
)
update videos v
set slug = case when r.rn = 1 then r.stem else r.stem || '-' || r.rn end
from ranked r
where v.id = r.id;

alter table videos alter column slug set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'videos_slug_unique') then
    alter table videos add constraint videos_slug_unique unique (slug);
  end if;
end $$;
