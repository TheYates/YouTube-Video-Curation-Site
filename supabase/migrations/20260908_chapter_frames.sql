-- Chapter frame images. Run once in the Supabase SQL editor
-- (Dashboard → SQL). The `frames` storage bucket itself is created by
-- scripts (storage API); this adds the columns + public read policy.

alter table chapters
  add column if not exists image_url text,
  add column if not exists frame_time numeric;

-- Public read for frame images. No insert/update/delete policies on purpose:
-- only the service role (ingest worker) writes; anon has read-only access.
drop policy if exists "Public read frames" on storage.objects;
create policy "Public read frames"
  on storage.objects for select
  using (bucket_id = 'frames');
