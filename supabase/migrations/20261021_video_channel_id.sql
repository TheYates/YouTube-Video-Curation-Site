-- Source-channel identifier for the video's `author` node.
--
-- The video page's JSON-LD VideoObject.author must name a real Person with a
-- `url` (Google reports "Missing field url" otherwise). A channel name alone
-- can't be resolved to a URL, so we keep the YouTube channel id that ingest
-- already reads from the same videos.list?part=snippet response, and build
-- https://www.youtube.com/channel/<id> from it.
--
-- Writes go through the ingest pipeline (service role). Applied via
-- `supabase db push` (or run once in the Supabase SQL editor).

alter table videos add column if not exists channel_id text;
