-- Site-wide curator settings (key/value). Read publicly, written only via
-- the service role (local relay POST /setting). Run once in the Supabase
-- SQL editor (Dashboard → SQL).

create table app_settings (
  key   text primary key,
  value text not null
);

alter table app_settings enable row level security;

-- Public read (the homepage needs the threshold anonymously).
create policy "Public read app_settings" on app_settings for select using (true);

-- No insert/update/delete policies on purpose: only the service role
-- (ingest relay) writes; anon has read-only access.

-- Seed: minimum videos before a category earns a public nav tab.
insert into app_settings (key, value) values ('min_category_videos', '3')
on conflict (key) do nothing;
