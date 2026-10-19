// Backfill videos.channel_id so the video page's JSON-LD `author` node can name
// the source channel with a real url (Google's "Missing field url" advisory).
//
//   node scripts/backfill-channels.mjs            # dry run: prints resolved ids
//   node scripts/backfill-channels.mjs --apply    # writes videos.channel_id
//
// Why: ingest now stores snippet.channelId from the same videos.list?part=snippet
// response it already fetches; rows ingested before that fix have only the
// channel name, which can't be turned into a URL. Resolves them in batches of 50
// (1 quota unit per call). Read-only unless --apply. Service role + YouTube key
// from scripts/.env.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

const APPLY = process.argv.includes("--apply");

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in scripts/.env");
  process.exit(1);
}
if (!YOUTUBE_API_KEY) {
  console.error("Missing YOUTUBE_API_KEY in scripts/.env");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb
  .from("videos")
  .select("id,slug,youtube_id,channel_name,channel_id")
  .order("published_at", { ascending: false });
if (error) throw error;

const todo = (data ?? []).filter((v) => !v.channel_id);
console.log(`videos missing channel_id: ${todo.length}${APPLY ? " (applying)" : " (dry run)"}\n`);

const batches = [];
for (let i = 0; i < todo.length; i += 50) batches.push(todo.slice(i, i + 50));

let resolved = 0;
let unresolved = 0;
for (const batch of batches) {
  const ids = batch.map((v) => v.youtube_id).join(",");
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids}&key=${YOUTUBE_API_KEY}`
  );
  if (!res.ok) {
    console.error(`videos.list HTTP ${res.status} — skipping batch`);
    continue;
  }
  const json = await res.json();
  const byVideoId = new Map((json.items ?? []).map((it) => [it.id, it.snippet?.channelId ?? null]));

  for (const v of batch) {
    const channelId = byVideoId.get(v.youtube_id);
    if (!channelId) {
      console.log(`SKIP ${v.slug} — no channelId (private/removed?)`);
      unresolved++;
      continue;
    }
    console.log(`${v.slug}  (${v.channel_name}) -> ${channelId}`);
    if (APPLY) {
      const { error: uErr } = await sb.from("videos").update({ channel_id: channelId }).eq("id", v.id);
      if (uErr) {
        console.error(`  FAILED: ${uErr.message}`);
        continue;
      }
    }
    resolved++;
  }
}

console.log(`\ndone: ${resolved} resolved, ${unresolved} unresolved`);
if (!APPLY && resolved) console.log("Dry run. Re-run with --apply to write.");
