// Merge duplicate-content pages: a deeper page absorbs the URL of a thinner
// duplicate, and the thinner row is removed.
//
//   node scripts/merge-duplicates.mjs          # dry run: prints the plan
//   node scripts/merge-duplicates.mjs --apply  # performs the merge
//
// Per pair: `keepSlug` is the deeper page that survives; `dropSlug` is the
// thinner duplicate whose URL the survivor takes over. After the merge the
// dropSlug is canonical, and the old keepSlug is 301'd to it via
// web/lib/slug-redirects.ts — add that entry before deploying.
//
// Order of operations is crash-safe: the duplicate's slug is first moved to an
// archive slug (freeing the canonical URL), the survivor takes the canonical
// slug, and only then is the duplicate row deleted. A failure mid-way leaves
// both rows present and recoverable.
//
// Read-only unless --apply. Service role from scripts/.env.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

const APPLY = process.argv.includes("--apply");

const PAIRS = [
  {
    // Deeper page (4,583 transcript words) vs. the thinner same-topic page
    // (2,071 words). See plans/sitemap-triage.md §5 (DUPLICATE_OF).
    keepSlug: "why-desert-people-wear-more-clothes-in-extreme-heat-2",
    dropSlug: "why-desert-people-wear-more-clothes-in-extreme-heat",
  },
];

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const words = (v) => (v.transcript_text ?? "").trim().split(/\s+/).filter(Boolean).length;

for (const { keepSlug, dropSlug } of PAIRS) {
  console.log(`\n── ${dropSlug}  ⟶  ${keepSlug} ──`);

  const { data: keep, error: keepErr } = await sb
    .from("videos")
    .select("id,slug,title,transcript_text")
    .eq("slug", keepSlug)
    .maybeSingle();
  const { data: drop, error: dropErr } = await sb
    .from("videos")
    .select("id,slug,title,transcript_text")
    .eq("slug", dropSlug)
    .maybeSingle();
  if (keepErr) throw keepErr;
  if (dropErr) throw dropErr;

  if (!keep) {
    console.log(`  SKIP: keep row "${keepSlug}" not found (already merged?)`);
    continue;
  }
  if (!drop) {
    console.log(`  SKIP: duplicate row "${dropSlug}" not found (already merged?)`);
    continue;
  }
  if (keep.id === drop.id) {
    console.log("  SKIP: keep and drop resolve to the same row");
    continue;
  }

  console.log(`  keep : ${keep.id}  ${words(keep)}w  ${keep.title}`);
  console.log(`  drop : ${drop.id}  ${words(drop)}w  ${drop.title}`);
  console.log(`  plan : archive "${dropSlug}", move keep → "${dropSlug}", delete drop row`);

  if (!APPLY) continue;

  const archiveSlug = `${dropSlug}-merged-${drop.id.slice(0, 8)}`;

  const { error: aErr } = await sb.from("videos").update({ slug: archiveSlug }).eq("id", drop.id);
  if (aErr) {
    console.error(`  FAILED archiving duplicate slug: ${aErr.message}`);
    process.exitCode = 1;
    continue;
  }
  const { error: mErr } = await sb.from("videos").update({ slug: dropSlug }).eq("id", keep.id);
  if (mErr) {
    console.error(`  FAILED moving keep slug; restoring duplicate…: ${mErr.message}`);
    await sb.from("videos").update({ slug: dropSlug }).eq("id", drop.id);
    process.exitCode = 1;
    continue;
  }
  const { error: dErr } = await sb.from("videos").delete().eq("id", drop.id);
  if (dErr) {
    console.error(`  FAILED deleting duplicate row (survivor already at "${dropSlug}"): ${dErr.message}`);
    process.exitCode = 1;
    continue;
  }
  console.log(`  done : "${keepSlug}" → "${dropSlug}", duplicate removed`);
}

if (!APPLY) {
  console.log("\nDry run. Add the old keepSlug → dropSlug entry to web/lib/slug-redirects.ts,");
  console.log("then re-run with --apply.");
}
