-- Signal — Supabase schema. Run once in the Supabase SQL editor.
-- Public read on all tables. Writes require the service-role key
-- (ingest worker only); there are deliberately no insert/update/delete policies.

create table videos (
  id            uuid primary key default gen_random_uuid(),
  youtube_id    text not null unique,
  title         text not null,
  channel_name  text not null,
  published_at  date not null,
  duration_sec  integer not null,
  category      text not null,
  thumbnail_url text not null,
  summary       text,
  takeaways     text[],
  tags          text[],
  transcript_text text,
  transcript_tsv tsvector generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(transcript_text, ''))
  ) stored,
  created_at    timestamptz default now()
);

create index videos_category_idx on videos (category);
create index videos_transcript_tsv_idx on videos using gin (transcript_tsv);

create table chapters (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid references videos(id) on delete cascade,
  title       text not null,
  start_time  numeric not null,
  description text
);
create index chapters_video_idx on chapters (video_id);

create table transcript_words (
  id         bigserial primary key,
  video_id   uuid references videos(id) on delete cascade,
  text       text not null,
  start_time numeric not null,
  end_time   numeric not null
);
create index transcript_words_video_idx on transcript_words (video_id);

create table affiliate_links (
  id         uuid primary key default gen_random_uuid(),
  video_id   uuid references videos(id) on delete cascade,
  label      text not null,
  url        text not null,
  disclosure text not null
);
create index affiliate_links_video_idx on affiliate_links (video_id);

alter table videos enable row level security;
alter table chapters enable row level security;
alter table transcript_words enable row level security;
alter table affiliate_links enable row level security;

create policy "Public read videos" on videos for select using (true);
create policy "Public read chapters" on chapters for select using (true);
create policy "Public read transcript_words" on transcript_words for select using (true);
create policy "Public read affiliate_links" on affiliate_links for select using (true);
