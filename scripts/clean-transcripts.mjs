// Full rewrite backfill: rebuilds transcript_words for EVERY video in spoken
// order with strictly monotonic timings.
//
// Root cause it fixes: ingest used to spread each caption event over its full
// dDurationMs (which overlaps the next event), and the web reads
// ORDER BY start_time — so each event's tail sorted past the next event's
// head (1-2 words swapped at every boundary, site-wide).
//
// Repair per video (rows fetched in insertion order via bigserial id, which
// IS the spoken order — event/seg order at ingest time):
//   1. trim/collapse whitespace, drop empties + sound-effect tokens
//      ([music], [applause], (laughter), ♪, …)
//   2. split multi-word rows into per-word rows (length-proportional slices —
//      see splitIntoWords in ingest-core.mjs)
//   3. re-anchor per caption EVENT (see repair): each event keeps its start
//      (the trustworthy anchor) and its words are compressed to fit the gap
//      to the next event — no cumulative drift. Lone words with end <= start
//      get a 0.4s duration (0.04s floor inside the monotonic pass). Tail is
//      clamped to videos.duration_sec.
//   4. transcript_text is rebuilt (transcript_tsv regenerates automatically)
//
//  node scripts/clean-transcripts.mjs [--dry-run] [--youtube-id=XXX]
//    --dry-run   report only, write nothing (default unless --apply given)
//    --apply     delete + rewrite each video's words and transcript_text
//
// Safety: back up first in SQL:
//   create table transcript_words_backup_20260916 as select * from transcript_words;
// Canary first: --youtube-id=<id> --apply, check the pane, then full --apply.

import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

import { createClient } from "@supabase/supabase-js";
import { enforceMonotonic, splitIntoWords } from "./ingest-core.mjs";

const APPLY = process.argv.includes("--apply");
const onlyArg = process.argv.find((a) => a.startsWith("--youtube-id="));
const ONLY_YT = onlyArg ? onlyArg.split("=")[1] : null;

const SFX_RE = /^\[.*\]$|^\(.*\)$|^♪+$/;
function cleanText(raw) {
  // YouTube prefixes speaker-change lines with ">>" (" >> [music]").
  const text = String(raw ?? "").replace(/\s+/g, " ").trim().replace(/^>>\s*/, "");
  if (!text || text === "\n" || text === ">>" || SFX_RE.test(text)) return "";
  return text;
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in scripts/.env.");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchAllWords(videoId) {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("transcript_words")
      .select("id,text,start_time,end_time")
      .eq("video_id", videoId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`fetch words: ${error.message}`);
    all.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return all;
}

function repair(rows, durationSec) {
  let dropped = 0;
  const cleaned = [];
  for (const r of rows) {
    const text = cleanText(r.text);
    if (!text) {
      dropped++;
      continue;
    }
    let start = Number(r.start_time);
    let end = Number(r.end_time);
    if (!Number.isFinite(start)) start = 0;
    if (!(end > start)) end = start + 0.4;
    cleaned.push({ text, startTime: start, endTime: end });
  }
  // Split caption-event-sized rows first, so per-word slices inherit the
  // event's span proportionally.
  const split = splitIntoWords(cleaned);

  // Regroup into caption events. A new event starts on a backward time jump
  // (the old overlapping-duration bug) or a clear pause. Event STARTS are
  // the trustworthy anchors (YouTube's tStartMs); within-event spreads are
  // approximate, so each event is compressed to fit the gap to the next
  // event rather than nudged forward word-by-word (which accumulates drift
  // and leaves the karaoke highlight progressively late).
  const PAUSE = 0.8;
  const groups = [];
  let cur = [];
  let prevEnd = -Infinity;
  for (const w of split) {
    if (cur.length && (w.startTime < prevEnd - 0.02 || w.startTime - prevEnd > PAUSE)) {
      groups.push(cur);
      cur = [];
      prevEnd = -Infinity;
    }
    cur.push(w);
    prevEnd = Math.max(prevEnd, Number(w.endTime));
  }
  if (cur.length) groups.push(cur);

  const before = split.map((w) => w.startTime);
  let eventsRescaled = 0;
  groups.forEach((g, gi) => {
    const gStart = g[0].startTime;
    const gOrigEnd = Math.max(...g.map((w) => Number(w.endTime)));
    const origSpan = gOrigEnd - gStart;
    if (!(origSpan > 0)) return;
    const nextStart = gi + 1 < groups.length ? groups[gi + 1][0].startTime : NaN;
    // Available span: up to the next event start, never stretching across
    // it (pauses stay pauses — avail just equals origSpan there).
    let avail = origSpan;
    if (Number.isFinite(nextStart) && nextStart > gStart) avail = Math.min(origSpan, nextStart - gStart);
    if (!(avail > 0)) return;
    if (origSpan > avail + 0.02) {
      // Overflowed event: re-spread its words length-proportionally across
      // the fitted span. (Old intra-event spacing was even-sliced
      // approximation, so nothing true is lost.)
      const fresh = splitIntoWords([
        { text: g.map((w) => w.text).join(" "), startTime: gStart, endTime: gStart + avail },
      ]);
      g.forEach((w, i) => {
        w.startTime = fresh[i].startTime;
        w.endTime = fresh[i].endTime;
      });
      eventsRescaled++;
    }
  });
  // Safety net: should be a near-no-op now (only float dust / tiny overlaps).
  enforceMonotonic(split);
  // Clamp the tail to the video duration so seeks stay in range. Only the
  // end is capped (start anchors are preserved); a tiny overflow past the
  // duration on the final word is left rather than breaking monotonicity.
  if (Number.isFinite(durationSec) && durationSec > 0 && split.length) {
    const last = split[split.length - 1];
    if (last.endTime > durationSec) last.endTime = Math.max(last.startTime + 0.04, durationSec);
  }
  let shifted = 0;
  for (let k = 0; k < split.length; k++) {
    if (Math.abs(split[k].startTime - before[k]) > 0.0005) shifted++;
  }
  return { words: split, dropped, eventsRescaled, shifted };
}

let videoQuery = sb.from("videos").select("id,youtube_id,title,duration_sec");
if (ONLY_YT) videoQuery = videoQuery.eq("youtube_id", ONLY_YT);
const { data: videos, error: vErr } = await videoQuery;
if (vErr) {
  console.error(`fetch videos: ${vErr.message}`);
  process.exit(1);
}

console.log(APPLY ? "APPLY mode — writing changes." : "Dry run — no writes (add --apply to write).");
for (const v of videos ?? []) {
  const rows = await fetchAllWords(v.id);
  const durationSec = Number(v.duration_sec ?? NaN);
  const { words: split, dropped, eventsRescaled, shifted } = repair(rows, durationSec);
  const text = split.map((w) => w.text).join(" ");
  console.log(
    `${v.youtube_id} "${(v.title ?? "").slice(0, 50)}": ${rows.length} → ${split.length} words ` +
      `(dropped ${dropped} SFX/junk, events rescaled ${eventsRescaled}, shifted ${shifted})`,
  );
  if (!APPLY || !split.length) continue;
  const { error: delErr } = await sb.from("transcript_words").delete().eq("video_id", v.id);
  if (delErr) {
    console.error(`  delete failed: ${delErr.message} — SKIPPED`);
    continue;
  }
  const wordRows = split.map((w) => ({ video_id: v.id, text: w.text, start_time: w.startTime, end_time: w.endTime }));
  for (let k = 0; k < wordRows.length; k += 1000) {
    const { error: insErr } = await sb.from("transcript_words").insert(wordRows.slice(k, k + 1000));
    if (insErr) {
      console.error(`  insert failed at ${k}: ${insErr.message} — video left partial!`);
      break;
    }
  }
  const { error: txtErr } = await sb.from("videos").update({ transcript_text: text || null }).eq("id", v.id);
  if (txtErr) console.error(`  transcript_text update failed: ${txtErr.message}`);
  else console.log(`  rewritten + transcript_text updated (${text.length} chars)`);
}
console.log("done.");
