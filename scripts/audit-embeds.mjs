// Read-only audit: which library videos can actually be embedded off-YouTube?
//
// YouTube's oEmbed endpoint answers 401 when the owner disabled playback on
// other sites (and for age-gated videos), which is exactly the state that makes
// the on-site player show "Playback on other websites has been disabled". The
// page falls back to a YouTube link, but a curator usually wants to know before
// investing in a transcript.
//
//   node scripts/audit-embeds.mjs
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb
  .from("videos")
  .select("slug,youtube_id,title")
  .order("published_at", { ascending: false });
if (error) throw error;

const rows = data ?? [];
const blocked = [];

for (let i = 0; i < rows.length; i += 8) {
  const batch = rows.slice(i, i + 8);
  const results = await Promise.all(
    batch.map(async (row) => {
      const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${row.youtube_id}`
      )}`;
      try {
        const res = await fetch(url);
        return { row, status: res.status };
      } catch (e) {
        return { row, status: 0, error: e.message };
      }
    })
  );
  for (const r of results) {
    if (r.status !== 200) blocked.push(r);
  }
}

console.log(`checked ${rows.length} videos | cannot embed: ${blocked.length}`);
for (const b of blocked) {
  console.log(`  ${b.row.slug}  (${b.row.youtube_id})  status=${b.status}`);
}
