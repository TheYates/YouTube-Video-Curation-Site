// Backfill chapter frames for videos ingested before frame extraction.
//   node scripts/backfill-frames.mjs [--youtube-id=XXX] [--force] [--apply]
// Chapters that already have image_url are skipped unless --force.
// --apply writes to the DB; without it this is a dry run.
//
// Prerequisite (once): run supabase/migrations/20260908_chapter_frames.sql
// in the Supabase SQL editor (adds chapters.image_url / frame_time).

import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

import youtubedl from "youtube-dl-exec";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";
import { extractChapterFrames } from "./frames.mjs";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const onlyArg = process.argv.find((a) => a.startsWith("--youtube-id="));
const ONLY_YT = onlyArg ? onlyArg.split("=")[1] : null;

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in scripts/.env.");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

let videoQuery = sb.from("videos").select("id,youtube_id,title");
if (ONLY_YT) videoQuery = videoQuery.eq("youtube_id", ONLY_YT);
const { data: videos, error: vErr } = await videoQuery;
if (vErr) {
  console.error(`fetch videos: ${vErr.message}`);
  process.exit(1);
}

console.log(APPLY ? "APPLY mode — writing." : "Dry run — no writes (add --apply).");
for (const v of videos ?? []) {
  const { data: chapters, error: chErr } = await sb
    .from("chapters")
    .select("id,title,start_time,image_url")
    .eq("video_id", v.id)
    .order("start_time");
  if (chErr) {
    console.error(`${v.youtube_id}: chapter fetch failed (${chErr.message}) — migration run?`);
    continue;
  }
  if (!chapters?.length) {
    console.log(`${v.youtube_id}: no chapters, skipped`);
    continue;
  }
  const missing = chapters.map((c, i) => (c.image_url && !FORCE ? -1 : i)).filter((i) => i >= 0);
  if (!missing.length) {
    console.log(`${v.youtube_id}: all ${chapters.length} frames present`);
    continue;
  }
  console.log(`${v.youtube_id} "${(v.title ?? "").slice(0, 45)}": capturing ${missing.length}/${chapters.length} frames…`);
  if (!APPLY) continue;
  let info = null;
  try {
    info = await youtubedl(`https://www.youtube.com/watch?v=${v.youtube_id}`, {
      dumpSingleJson: true,
      noWarnings: true,
      skipDownload: true,
    });
  } catch (e) {
    console.error(`  yt-dlp info failed: ${String(e?.stderr ?? e?.message ?? e).slice(0, 200)}`);
    continue;
  }
  const frames = await extractChapterFrames(
    sb,
    SUPABASE_URL,
    v.youtube_id,
    info,
    missing.map((i) => chapters[i].start_time),
    tmpdir(),
  );
  for (let k = 0; k < missing.length; k++) {
    const f = frames[k];
    if (!f) continue;
    const { error: upErr } = await sb
      .from("chapters")
      .update({ image_url: f.imageUrl, frame_time: f.frameTime })
      .eq("id", chapters[missing[k]].id);
    console.log(`  ch${missing[k]} @${f.frameTime}s: ${upErr ? "UPDATE FAILED: " + upErr.message : "ok"}`);
  }
}
console.log("done.");
