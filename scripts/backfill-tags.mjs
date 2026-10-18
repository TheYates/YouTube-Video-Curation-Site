// Backfill video tags that the ingest pipeline used to leave empty.
//
//   node scripts/backfill-tags.mjs                 # dry run: prints proposed tags
//   node scripts/backfill-tags.mjs --limit 10      # dry run, first 10 only
//   node scripts/backfill-tags.mjs --apply         # writes tags to videos.tags
//
// Why: `tags` was hardcoded to [] at ingest (`scripts/ingest-core.mjs`,
// `supabase/functions/ingest`), so `scoreRelated` scored every candidate the
// same and every page in a category emitted the identical related block. Ingest
// now derives tags; this tags the rows that predate the fix.
//
// Read-only unless --apply. Service role + Groq key from scripts/.env.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

const APPLY = process.argv.includes("--apply");
const limitIdx = process.argv.indexOf("--limit");
const LIMIT =
  limitIdx !== -1 && Number.isFinite(Number(process.argv[limitIdx + 1]))
    ? Number(process.argv[limitIdx + 1])
    : Infinity;

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

function cleanTags(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const t of raw) {
    const tag = String(t ?? "").toLowerCase().trim().replace(/\s+/g, " ").slice(0, 32);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
    if (out.length >= 6) break;
  }
  return out;
}

async function tagOne(video) {
  const prompt =
    `Title: ${video.title}\nChannel: ${video.channel_name}\nSummary: ${video.summary ?? ""}\n\n` +
    `Return JSON: { "tags": ["3-6 lowercase topical tags"] }. ` +
    `Tags are broad subject keywords (e.g. "finance", "psychology", "ai", "stoicism", "health"), ` +
    `not the channel name, not the video title.`;
  for (const model of CHAT_MODELS) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "You assign concise topical tags. Respond with valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) {
        console.error(`  groq ${model} HTTP ${res.status}`);
        continue;
      }
      const parsed = JSON.parse((await res.json()).choices?.[0]?.message?.content ?? "{}");
      const tags = cleanTags(parsed.tags);
      if (tags.length) return tags;
    } catch (e) {
      console.error(`  groq ${model} failed:`, e.message ?? e);
    }
  }
  return [];
}

const { data, error } = await sb
  .from("videos")
  .select("id,slug,title,channel_name,summary,tags")
  .order("published_at", { ascending: false });
if (error) throw error;

const todo = (data ?? [])
  .filter((v) => !Array.isArray(v.tags) || v.tags.length === 0)
  .slice(0, LIMIT);

console.log(`videos needing tags: ${todo.length}${APPLY ? " (applying)" : " (dry run)"}\n`);

let tagged = 0;
let failed = 0;
for (const v of todo) {
  const tags = await tagOne(v);
  if (!tags.length) {
    console.log(`SKIP ${v.slug} — no tags returned`);
    failed++;
    continue;
  }
  console.log(`${v.slug}\n  -> ${tags.join(", ")}`);
  if (APPLY) {
    const { error: uErr } = await sb.from("videos").update({ tags }).eq("id", v.id);
    if (uErr) {
      console.error(`  FAILED: ${uErr.message}`);
      failed++;
      continue;
    }
    console.log("  written");
  }
  tagged++;
}

console.log(`\ndone: ${tagged} tagged, ${failed} failed/skipped`);
if (!APPLY && tagged) console.log("Dry run. Re-run with --apply to write.");
