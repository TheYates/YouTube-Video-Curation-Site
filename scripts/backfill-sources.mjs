// One-time backfill: loads the /admin/sources PRESEED channel list (and any
// localStorage overrides from the old page) into the new `source_channels`
// table, resolving each @handle to its real UC… channel ID via the official
// API (`channels.list?forHandle`, 1 quota unit each).
//
// Usage: node scripts/backfill-sources.mjs
// Env: scripts/.env — SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY

import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !YOUTUBE_API_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / YOUTUBE_API_KEY in scripts/.env.");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Mirrors the PRESEED list that shipped in web/app/admin/(panel)/sources/page.tsx.
const PRESEED = [
  { name: "Ray Dalio", handle: "raydalio", category: "Finance", description: "Macro economics, debt cycles, investing principles" },
  { name: "Ben Felix", handle: "BenFelixCSI", category: "Finance", description: "Evidence-based personal finance, factor investing" },
  { name: "Patrick Boyle", handle: "patrickboyle01", category: "Finance", description: "Dry analytical finance, derivatives, macro" },
  { name: "The Plain Bagel", handle: "ThePlainBagel", category: "Finance", description: "Accessible investing explainers" },
  { name: "Andrej Karpathy", handle: "AndrejKarpathy", category: "Tech", description: "Neural networks, LLMs, AI research" },
  { name: "3Blue1Brown", handle: "3blue1brown", category: "Tech", description: "Math & CS visual explainers" },
  { name: "Fireship", handle: "Fireship", category: "Tech", description: "Fast-paced dev content" },
  { name: "Kurzgesagt", handle: "kurzgesagt", category: "Science", description: "Animated science explainers, big ideas" },
  { name: "PBS Space Time", handle: "pbsspacetime", category: "Science", description: "Physics, cosmology, university level" },
  { name: "Veritasium", handle: "veritasium", category: "Science", description: "Counterintuitive science, experiments" },
  { name: "Einzelganger", handle: "Einzelganger", category: "Philosophy", description: "Stoicism, Nietzsche, existentialism" },
  { name: "Academy of Ideas", handle: "academyofideas", category: "Philosophy", description: "Philosophy of great thinkers, animated" },
  { name: "The School of Life", handle: "theschooloflife", category: "Philosophy", description: "Practical philosophy, psychology" },
];

async function resolveChannelId(handle) {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${YOUTUBE_API_KEY}`
  );
  if (!res.ok) {
    console.error(`  @${handle}: channels.list HTTP ${res.status}`);
    return null;
  }
  return (await res.json()).items?.[0]?.id ?? null;
}

let ok = 0;
let skipped = 0;
let failed = 0;
for (const ch of PRESEED) {
  const { data: existing } = await sb
    .from("source_channels")
    .select("id")
    .eq("handle", ch.handle)
    .maybeSingle();
  if (existing) {
    console.log(`  @${ch.handle}: already present, skipping`);
    skipped++;
    continue;
  }
  const channelId = await resolveChannelId(ch.handle);
  if (!channelId) {
    console.error(`  @${ch.handle}: could not resolve channel ID`);
    failed++;
    continue;
  }
  const { error } = await sb.from("source_channels").upsert(
    { channel_id: channelId, handle: ch.handle, name: ch.name, category: ch.category, description: ch.description, builtin: true, enabled: true },
    { onConflict: "channel_id" }
  );
  if (error) {
    console.error(`  @${ch.handle}: insert failed — ${error.message}`);
    failed++;
    continue;
  }
  console.log(`  @${ch.handle}: ${channelId} ✓`);
  ok++;
}

console.log(`[backfill] done: ${ok} added, ${skipped} skipped, ${failed} failed`);
if (failed > 0) process.exit(1);
