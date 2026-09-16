// TEMP probe — inspect transcript granularity for a video
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const YT_ID = process.argv[2] ?? "eW8574N_aOE";
const { data: vids } = await sb.from("videos").select("id,title,youtube_id").eq("youtube_id", YT_ID);
const v = vids?.[0];
if (!v) {
  console.log("video not found for", YT_ID);
  process.exit(0);
}
console.log("video:", v.title, v.id);

const { count } = await sb
  .from("transcript_words")
  .select("*", { count: "exact", head: true })
  .eq("video_id", v.id);
console.log("transcript_words rows:", count);

const { data: rows } = await sb
  .from("transcript_words")
  .select("text,start_time,end_time")
  .eq("video_id", v.id)
  .order("start_time")
  .limit(8);
for (const r of rows ?? []) {
  console.log(
    `[${r.start_time.toFixed(2)} → ${r.end_time.toFixed(2)}] (${(r.end_time - r.start_time).toFixed(2)}s)`,
    JSON.stringify(r.text)
  );
}

const { data: chs } = await sb
  .from("chapters")
  .select("title,start_time,image_url,frame_time")
  .eq("video_id", v.id)
  .order("start_time");
console.log("\nchapters:");
for (const c of chs ?? []) {
  console.log(`  ${c.start_time}s frame_time=${c.frame_time} img=${c.image_url ? "yes" : "no"} — ${c.title}`);
}

// Compare with a known-good video (first published one)
const { data: good } = await sb
  .from("videos")
  .select("id,title,youtube_id")
  .order("published_at", { ascending: false })
  .limit(10);
console.log("\nrecent videos:", good?.map((g) => `${g.youtube_id} — ${g.title.slice(0, 50)}`).join("\n"));
