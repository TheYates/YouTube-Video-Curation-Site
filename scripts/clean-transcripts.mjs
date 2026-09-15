// One-off backfill: repairs transcript_words rows written before the
// ingest-time cleaning (SFX filter, trimmed text, event-distributed timings)
// and splits caption-event-sized rows into per-word rows (the web UI needs
// word granularity — see splitIntoWords in ingest-core.mjs).
//
//  node scripts/clean-transcripts.mjs [--dry-run] [--youtube-id=XXX]
//    --dry-run   report only, write nothing (default unless --apply given)
//    --apply     delete + rewrite each video's words and transcript_text
//
// Repair per video (rows fetched in insertion order via bigserial id, which
// recovers the original caption seg order inside tied-timestamp runs):
//   0. videos whose rows already average ~1 token per row (word-level
//      source: manual per-seg captions or Whisper) are skipped untouched
//   1. trim/collapse whitespace, drop empties + sound-effect tokens
//      ([music], [applause], (laughter), ♪, …)
//   2. runs of identical start_time (= one caption event with no per-seg
//      timings) get even slices of the span to the next run's start
//      (fallback 2s), so order is chronological and every word has
//      start < end (click-to-seek + active highlight need this)
//   3. lone words with end <= start get a 0.4s duration
//   4. multi-word rows (caption events) are split into per-word rows with
//      length-proportional time slices
//   5. transcript_text is rebuilt (transcript_tsv regenerates automatically)

import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

import { createClient } from "@supabase/supabase-js";
import { splitIntoWords } from "./ingest-core.mjs";

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

function repair(rows) {
  let dropped = 0;
  const kept = [];
  for (const r of rows) {
    const text = cleanText(r.text);
    if (!text) {
      dropped++;
      continue;
    }
    kept.push({ text, start: Number(r.start_time), end: Number(r.end_time) });
  }
  // Group runs of identical start_time (one caption event).
  let retimed = 0;
  let i = 0;
  while (i < kept.length) {
    let j = i + 1;
    while (j < kept.length && kept[j].start === kept[i].start) j++;
    const runLen = j - i;
    if (runLen > 1) {
      const runStart = kept[i].start;
      const nextStart = j < kept.length ? kept[j].start : NaN;
      let span = nextStart - runStart;
      if (!span || span <= 0 || !Number.isFinite(span)) span = 2;
      const slice = span / runLen;
      for (let k = 0; k < runLen; k++) {
        kept[i + k].start = runStart + k * slice;
        kept[i + k].end = runStart + (k + 1) * slice;
        retimed++;
      }
    } else {
      if (!(kept[i].end > kept[i].start)) {
        kept[i].end = kept[i].start + 0.4;
        retimed++;
      }
    }
    i = j;
  }
  return { words: kept, dropped, retimed };
}

let videoQuery = sb.from("videos").select("id,youtube_id,title");
if (ONLY_YT) videoQuery = videoQuery.eq("youtube_id", ONLY_YT);
const { data: videos, error: vErr } = await videoQuery;
if (vErr) {
  console.error(`fetch videos: ${vErr.message}`);
  process.exit(1);
}

console.log(APPLY ? "APPLY mode — writing changes." : "Dry run — no writes (add --apply to write).");
for (const v of videos ?? []) {
  const rows = await fetchAllWords(v.id);
  // Skip videos already at word granularity — avg tokens per row ≈ 1 means
  // the source was manual per-seg captions or Whisper; rewriting them would
  // only churn rows (and row ids) for no visual change.
  const tokenCount = rows.reduce((a, r) => a + String(r.text ?? "").trim().split(/\s+/).filter(Boolean).length, 0);
  const avgTokens = rows.length ? tokenCount / rows.length : 0;
  if (rows.length && avgTokens <= 1.5) {
    console.log(`${v.youtube_id} "${(v.title ?? "").slice(0, 50)}": already word-level (avg ${avgTokens.toFixed(2)} tokens/row) — skipped`);
    continue;
  }
  const { words, dropped, retimed } = repair(rows);
  const split = splitIntoWords(words.map((w) => ({ text: w.text, startTime: w.start, endTime: w.end })));
  const text = split.map((w) => w.text).join(" ");
  console.log(
    `${v.youtube_id} "${(v.title ?? "").slice(0, 50)}": ${rows.length} → ${split.length} words ` +
      `(dropped ${dropped} SFX/junk, retimed ${retimed}, avg ${avgTokens.toFixed(1)} tokens/row)`,
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
