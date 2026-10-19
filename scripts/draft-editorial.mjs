// Draft the human editorial note ("Curator's Note") for each video page.
//
//   node scripts/draft-editorial.mjs                 # dry run: drafts printed
//   node scripts/draft-editorial.mjs --limit 5        # dry run, first 5
//   node scripts/draft-editorial.mjs --slug <slug>    # one video
//   node scripts/draft-editorial.mjs --apply          # writes videos.editorial_note
//   node scripts/draft-editorial.mjs --force --apply   # overwrite existing notes
//
// These are DRAFTS: they seed the field so the curator can edit them in
// /admin/videos/[id]. Only rows with an empty editorial_note are touched unless
// --force is passed. Read-only unless --apply. Service role + Groq key from
// scripts/.env.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const limitIdx = process.argv.indexOf("--limit");
const LIMIT =
  limitIdx !== -1 && Number.isFinite(Number(process.argv[limitIdx + 1]))
    ? Number(process.argv[limitIdx + 1])
    : Infinity;
const slugIdx = process.argv.indexOf("--slug");
const ONLY_SLUG = slugIdx !== -1 ? process.argv[slugIdx + 1] : null;

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in scripts/.env");
  process.exit(1);
}
if (!GROQ_API_KEY) {
  console.error("Missing GROQ_API_KEY in scripts/.env");
  process.exit(1);
}

// Mirrors the CHAT_MODELS chain in ingest-core.mjs.
const CHAT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const words = (t) => (t ?? "").trim().split(/\s+/).filter(Boolean).length;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Transcripts are large and Groq meters tokens-per-minute, so a tight loop
// trips 429 quickly. The prompt carries a trimmed transcript and each model is
// retried with backoff before falling through to the next.
const TRANSCRIPT_CHARS = 6000;

async function callGroq(model, prompt) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content:
              "You are a discerning editor writing short, honest notes about long-form videos. Respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (res.ok) return res;
    if (res.status === 429) {
      const wait = 5000 * (attempt + 1);
      console.error(`  groq ${model} 429 — waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    console.error(`  groq ${model} HTTP ${res.status}`);
    return res;
  }
  return null;
}

async function draftNote(v) {
  const prompt =
    `Title: ${v.title}\nChannel: ${v.channel_name}\nSummary: ${v.summary ?? ""}\n\n` +
    `Transcript (may be truncated):\n${(v.transcript_text ?? "").slice(0, TRANSCRIPT_CHARS)}\n\n` +
    `Write a 150-300 word editorial note for the page that hosts this video. Speak ` +
    `directly to a smart friend as the curator: what the video argues, why it earns ` +
    `a place in the library, and the idea worth sitting with. 2-3 short paragraphs ` +
    `separated by blank lines. Plain prose: no headings, no bullet lists, no invented ` +
    `facts. Do not open with "In this video" or use filler like "delve", "tapestry", ` +
    `"navigate the landscape". Return JSON: { "note": "..." }`;
  for (const model of CHAT_MODELS) {
    try {
      const res = await callGroq(model, prompt);
      if (!res || !res.ok) continue;
      const parsed = JSON.parse((await res.json()).choices?.[0]?.message?.content ?? "{}");
      const note = String(parsed.note ?? "").trim();
      if (note) return note;
    } catch (e) {
      console.error(`  groq ${model} failed:`, e.message ?? e);
    }
  }
  return "";
}

let query = sb
  .from("videos")
  .select("id,slug,title,channel_name,summary,transcript_text,editorial_note")
  .order("published_at", { ascending: false });
if (ONLY_SLUG) query = query.eq("slug", ONLY_SLUG);
const { data, error } = await query;
if (error) throw error;

const todo = (data ?? [])
  .filter((v) => FORCE || !(v.editorial_note ?? "").trim())
  .slice(0, LIMIT);

console.log(
  `videos needing an editorial note: ${todo.length}${APPLY ? " (applying)" : " (dry run)"}\n`
);

let drafted = 0;
let failed = 0;
for (const v of todo) {
  const note = await draftNote(v);
  if (!note) {
    console.log(`SKIP ${v.slug} — no draft returned`);
    failed++;
    continue;
  }
  console.log(`${v.slug}  (${words(note)} words)\n  ${note.replace(/\n+/g, " ")}\n`);
  if (APPLY) {
    const { error: uErr } = await sb.from("videos").update({ editorial_note: note }).eq("id", v.id);
    if (uErr) {
      console.error(`  FAILED: ${uErr.message}`);
      failed++;
      continue;
    }
    console.log("  written\n");
  }
  drafted++;
  // Pace the loop so a run doesn't exhaust the per-minute token budget.
  await sleep(2000);
}

console.log(`done: ${drafted} drafted, ${failed} failed/skipped`);
if (!APPLY && drafted) console.log("Dry run. Re-run with --apply to write.");
