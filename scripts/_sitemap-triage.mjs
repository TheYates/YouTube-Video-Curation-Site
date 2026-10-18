// TEMP analysis — tier every curated video by whether it deserves to be
// advertised to Google in sitemap.xml on a zero-authority domain. Read-only.
// Output is what plans/sitemap-triage.md documents.
//
// Rubric (rule-based so it is reproducible and arguable):
//   CUT    — too little unique indexable text (stub), duplicates another page,
//            or is a dated news item whose value decays.
//   ADVERTISE (Tier A) — >= 2000 transcript words, source >= 10 min, durable
//            topic, capped at 24. Manual overrides are listed explicitly below.
//   HOLD (Tier B) — real page, just not worth the first round of crawl budget.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── tunable thresholds ──
const STUB_WORDS = 1000; // below this the page is mostly boilerplate
const TIER_A_WORDS = 2000; // enough spoken text to read as a real resource
const TIER_A_CAP = 24; // how many URLs we ask Google to prioritise first
const TIER_A_MIN_MINS = 10; // a 4-minute clip rarely reads as a resource

// Dated or news-bound: these decay, and Google re-judges a decayed page harshly.
const DECAYING = new Map([
  ["lg-says-were-fake-news", "general news broadcast; no durable query"],
  ["exposing-a-global-ai-slop-empire-ruining-the-internet-for-pr", "news-cycle investigative piece"],
  ["50c-heat-heres-why-you-shouldnt-strip-down", "tied to a specific heatwave event"],
  ["how-to-use-claude-code-for-free-in-2026", "year-stamped; expires with the calendar"],
]);
// Same topic curated twice — keep the deeper page, drop the other.
const DUPLICATE_OF = new Map([
  ["why-desert-people-wear-more-clothes-in-extreme-heat", "duplicate of ...-heat-2 (deeper page kept)"],
]);
// Long, but depth alone is not merit: these are demoted out of the mechanical
// top-24 by hand. They stay live and internally linked.
const DEMOTED_TO_HOLD = new Map([
  [
    "how-to-host-multiple-websites-on-one-server-step-by-step",
    "long only because the transcript narrates terminal commands; no durable query",
  ],
  [
    "the-rise-and-fall-of-realplayer-media-player-on-every-pc-tha",
    "title and slug are truncated mid-word; a bad <title> whatever the content",
  ],
]);
const CUT_OVERRIDES = new Map([
  ["the-corniest-people-ever", "entertainment listicle; no durable query; vaguest category"],
]);
// Durable, high-intent pages that the word-count proxy under-ranks.
const PROMOTED_TO_A = new Set([
  "i-built-chatgpt-from-scratch",
  "when-compounding-works-against-you",
  "casually-explained-social-status",
]);

const { data: videos, error } = await sb
  .from("videos")
  .select("id,slug,title,channel_name,published_at,duration_sec,category,summary,takeaways,transcript_text")
  .order("published_at", { ascending: false });
if (error) throw error;

const words = (t) => (t ? t.trim().split(/\s+/).length : 0);

const rows = (videos ?? []).map((v) => {
  const wc = words(v.transcript_text);
  const mins = Math.round(v.duration_sec / 60);
  const cuts = [];
  if (!v.transcript_text) cuts.push("no transcript — nothing unique to index");
  if (wc > 0 && wc < STUB_WORDS) cuts.push(`stub: only ${wc} transcript words`);
  if (mins < 5) cuts.push(`source is only ${mins} min`);
  if (DECAYING.has(v.slug)) cuts.push(`decaying: ${DECAYING.get(v.slug)}`);
  if (DUPLICATE_OF.has(v.slug)) cuts.push(`duplicate: ${DUPLICATE_OF.get(v.slug)}`);
  if (CUT_OVERRIDES.has(v.slug)) cuts.push(`override: ${CUT_OVERRIDES.get(v.slug)}`);
  return {
    slug: v.slug,
    title: v.title,
    channel: v.channel_name.trim(),
    category: v.category,
    published: v.published_at,
    mins,
    words: wc,
    sumLen: (v.summary ?? "").trim().length,
    takeaways: (v.takeaways ?? []).length,
    cuts,
  };
});

const cut = rows.filter((r) => r.cuts.length > 0);
const pool = rows.filter((r) => r.cuts.length === 0 && !DEMOTED_TO_HOLD.has(r.slug));
const forced = pool.filter((r) => PROMOTED_TO_A.has(r.slug));
const ranked = pool
  .filter((r) => !PROMOTED_TO_A.has(r.slug) && r.words >= TIER_A_WORDS && r.mins >= TIER_A_MIN_MINS)
  .sort((a, b) => b.words - a.words);
const tierA = [...forced, ...ranked].slice(0, TIER_A_CAP);
const tierASet = new Set(tierA.map((r) => r.slug));
const tierB = [
  ...rows.filter((r) => DEMOTED_TO_HOLD.has(r.slug)),
  ...pool.filter((r) => !tierASet.has(r.slug)),
];

const show = (label, list, note) => {
  console.log(`\n═══ ${label}: ${list.length} ═══  ${note}\n`);
  for (const r of list) {
    console.log(
      `  ${String(r.words).padStart(5)}w ${String(r.mins).padStart(3)}m  ${r.category.padEnd(13)} ${r.slug}`
    );
    console.log(`                          ${r.channel} — ${r.title}`);
    for (const c of r.cuts) console.log(`                          ↳ ${c}`);
    if (DEMOTED_TO_HOLD.has(r.slug)) console.log(`                          ↳ demoted: ${DEMOTED_TO_HOLD.get(r.slug)}`);
  }
};

show("TIER A — advertise in sitemap now", tierA, "ranked by depth, then hand-overridden");
show("TIER C — cut from sitemap", cut, "stub / duplicate / decaying");
show("TIER B — hold (live + linked, not advertised yet)", tierB, "real but unproven");

console.log(`\n── totals ──`);
console.log(`  total videos:       ${rows.length}`);
console.log(`  Tier A (advertise): ${tierA.length}`);
console.log(`  Tier B (hold):      ${tierB.length}`);
console.log(`  Tier C (cut):       ${cut.length}`);
console.log(`  check A+B+C:        ${tierA.length + tierB.length + cut.length}`);
console.log(`  sitemap locs:       ${rows.length + 5} → ${tierA.length + 5}`);
