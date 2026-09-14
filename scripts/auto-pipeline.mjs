// Auto pipeline — the scheduled half of the discovery system. Designed for
// one-shot runs from Task Scheduler / cron a few times a day:
//
//   node scripts/auto-pipeline.mjs [--max N] [--discover-only] [--ingest-only]
//
//   1. Discover: poll source channels + saved searches + related mining,
//      score with Groq, stage everything as pending (see discover.mjs).
//   2. Ingest: approved candidates (status='approved', attempts<3) are run
//      through the shared ingest pipeline in score order, up to --max
//      (default 5) per run. Nothing publishes without the curator having
//      approved it in /admin/review.
//
// Env: scripts/.env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// YOUTUBE_API_KEY, GROQ_API_KEY). Ingest uses yt-dlp → must run on a
// residential-IP machine (yours), same as scripts/ingest.mjs.

import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

import { createClient } from "@supabase/supabase-js";
import { ingestOne } from "./ingest-core.mjs";

const args = process.argv.slice(2);
const maxIdx = args.indexOf("--max");
const maxIngest = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 5;
const discoverOnly = args.includes("--discover-only");
const ingestOnly = args.includes("--ingest-only");

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Copy scripts/.env.example to scripts/.env.");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log(`[auto] start ${new Date().toISOString()} (max=${maxIngest})`);

async function main() {
// ── 1. Discover ─────────────────────────────────────────────────────────────
if (!ingestOnly) {
  const r = await spawnDiscover();
  if (r.code !== 0) console.error("[auto] discovery had errors — continuing to ingest leg anyway");
}

async function spawnDiscover() {
  // In-process import would run discover.mjs's own dotenv/main; spawn keeps
  // each leg isolated (a discovery crash never blocks ingest).
  const { spawn } = await import("node:child_process");
  const scriptPath = new URL("discover.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const cwd = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd,
      stdio: "inherit",
      timeout: 10 * 60 * 1000,
    });
    child.on("error", (e) => {
      console.error("[auto] discover spawn failed:", e?.message ?? e);
      resolve({ code: 1 });
    });
    child.on("close", (code) => resolve({ code: code ?? 1 }));
  });
}

// ── 2. Ingest approved candidates ───────────────────────────────────────────
if (discoverOnly) {
  console.log("[auto] --discover-only: skipping ingest leg.");
  process.exit(0);
}

const { data: approved, error } = await sb
  .from("video_candidates")
  .select("id,youtube_id,title,suggested_category,attempts,score")
  .eq("status", "approved")
  .lt("attempts", 3)
  .order("score", { ascending: false })
  .order("created_at", { ascending: true })
  .limit(Math.max(1, maxIngest));

if (error) {
  console.error(`[auto] candidate fetch failed: ${error.message}`);
  process.exit(1);
}

if (!approved?.length) {
  console.log("[auto] no approved candidates waiting — done.");
  process.exit(0);
}

console.log(`[auto] ingesting ${approved.length} approved candidate(s):`);
for (const c of approved) console.log(`  [${Number(c.score).toFixed(1)}] ${c.title}`);

let ok = 0;
let failed = 0;
for (const c of approved) {
  await sb
    .from("video_candidates")
    .update({ attempts: c.attempts + 1 })
    .eq("id", c.id);
  console.log(`=== ${c.youtube_id} "${c.title}" ===`);
  let result;
  try {
    result = await ingestOne(`https://www.youtube.com/watch?v=${c.youtube_id}`, {
      categoryOverride: c.suggested_category && c.suggested_category !== "General" ? c.suggested_category : undefined,
    });
  } catch (e) {
    result = { status: "failed", detail: String(e?.message ?? e) };
  }
  if (result.status === "ok" || result.status === "skipped") {
    ok++;
    await sb
      .from("video_candidates")
      .update({ status: "ingested", decided_at: new Date().toISOString() })
      .eq("id", c.id);
    console.log(`[auto] ingested: /video/${result.slug ?? "?"}`);
  } else {
    failed++;
    const exhausted = c.attempts + 1 >= 3;
    await sb
      .from("video_candidates")
      .update({
        status: exhausted ? "failed" : "approved", // stays approved → retried next run
        reason: `Ingest attempt ${c.attempts + 1} failed: ${String(result.detail ?? "unknown").slice(0, 200)}`,
      })
      .eq("id", c.id);
    console.error(`[auto] failed (${c.attempts + 1}/3): ${result.detail}`);
  }
}

console.log(`[auto] done: ${ok} ingested, ${failed} failed of ${approved.length}`);
process.exitCode = failed > 0 && ok === 0 ? 1 : 0;
}
main().catch((e) => {
  console.error("[auto] fatal:", e);
  process.exitCode = 1;
});
