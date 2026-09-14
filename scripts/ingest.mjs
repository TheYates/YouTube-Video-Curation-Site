// Full ingest pipeline, run from a clean network (your machine — YouTube
// blocks Supabase Edge Function IPs, so the transcript leg lives here).
// Thin CLI wrapper around scripts/ingest-core.mjs (the shared pipeline also
// powers scripts/auto-pipeline.mjs for discovery-approved candidates).
//
// Usage: node scripts/ingest.mjs <youtube-url> [more urls...] [--force]
//   Accepts multiple URLs: runs sequentially, skips failures, prints a
//   per-video summary at the end (exit 1 iff any video failed).
//   --force wipes any existing row for the video (even healthy ones) and
//   re-ingests. Without it, healthy rows are kept; hollow rows (0 transcript
//   words) are automatically deleted and reprocessed.
//
// Env (scripts/.env — see .env.example — or process env):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY, GROQ_API_KEY

import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

import { ingestOne } from "./ingest-core.mjs";

const force = process.argv.includes("--force");
const urls = process.argv.slice(2).filter((a) => !a.startsWith("-"));
if (!urls.length) {
  console.error("Usage: node scripts/ingest.mjs <youtube-url> [more urls...] [--force]");
  process.exit(1);
}

// Batch driver: sequential, skip-and-continue. Single-URL runs behave
// exactly as before (same lines, exit 0/1).
const results = [];
for (let i = 0; i < urls.length; i++) {
  if (urls.length > 1) console.log(`=== [${i + 1}/${urls.length}] ${urls[i]} ===`);
  try {
    results.push({ url: urls[i], ...(await ingestOne(urls[i], { force })) });
  } catch (e) {
    const detail = String(e?.message ?? e);
    console.error(`failed: ${detail}`);
    results.push({ url: urls[i], status: "failed", detail });
  }
}
if (urls.length > 1) {
  const n = (s) => results.filter((r) => r.status === s).length;
  console.log(`batch: ${n("ok")} ok, ${n("skipped")} skipped, ${n("failed")} failed`);
  for (const r of results.filter((r) => r.status === "failed")) {
    console.log(`FAILED ${r.url}: ${r.detail}`);
  }
  if (n("failed") > 0) process.exit(1);
}
