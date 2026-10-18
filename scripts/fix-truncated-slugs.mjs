// One-off repair: slugs that the original 60-character slice cut mid-word.
//
//   node scripts/fix-truncated-slugs.mjs          # dry run, prints the plan
//   node scripts/fix-truncated-slugs.mjs --apply  # writes the new slugs
//
// Slugs are frozen at publish time, so this only touches rows whose stored slug
// is a *character prefix* of the normalised title and continues into another
// letter ("...-every-pc-tha"), i.e. rows the old truncator actually damaged.
// Whole-word cuts are left alone.
//
// The old URLs keep working through web/lib/slug-redirects.ts — add each pair
// printed under "redirect map" there before deploying.
//
// Read-only unless --apply is passed. Service role from scripts/.env.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

const APPLY = process.argv.includes("--apply");

function normalizeTitle(title) {
  return String(title ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Keep byte-identical to slugifyTitle in web/lib/slug.ts and
// supabase/functions/ingest/index.ts.
function slugifyTitle(title) {
  const normalized = normalizeTitle(title);
  if (!normalized) return "video";
  if (normalized.length <= 60) return normalized;
  let end = 60;
  const boundary = normalized.lastIndexOf("-", 60);
  if (boundary > 20) end = boundary;
  const nextBoundary = normalized.indexOf("-", end + 1);
  const wordEnd = nextBoundary === -1 ? normalized.length : nextBoundary;
  if (wordEnd <= 70) end = wordEnd;
  return normalized.slice(0, end).replace(/-+$/, "") || "video";
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb
  .from("videos")
  .select("id,slug,title,published_at")
  .order("published_at");
if (error) throw error;

const rows = data ?? [];
const taken = new Set(rows.map((r) => r.slug));
const candidates = [];

for (const row of rows) {
  const normalized = normalizeTitle(row.title);
  if (!normalized || !normalized.startsWith(row.slug)) continue;
  const nextChar = normalized[row.slug.length];
  // Whole-word cut (hyphen follows) or already the full title: leave it.
  if (!nextChar || !/[a-z0-9]/.test(nextChar)) continue;
  const next = slugifyTitle(row.title);
  if (next === row.slug) continue;
  if (taken.has(next)) {
    console.error(`SKIP ${row.slug}: target ${next} is already taken`);
    continue;
  }
  candidates.push({ id: row.id, from: row.slug, to: next });
}

console.log(`mid-word slugs: ${candidates.length}`);
for (const c of candidates) console.log(`  ${c.from}\n    -> ${c.to}`);

if (candidates.length) {
  console.log("\nredirect map (web/lib/slug-redirects.ts):");
  for (const c of candidates) console.log(`  "${c.from}":\n    "${c.to}",`);

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write these slugs.");
  } else {
    for (const c of candidates) {
      const { error: updateError } = await sb.from("videos").update({ slug: c.to }).eq("id", c.id);
      if (updateError) {
        console.error(`FAILED ${c.from} -> ${c.to}: ${updateError.message}`);
        process.exitCode = 1;
      } else {
        console.log(`updated ${c.from} -> ${c.to}`);
      }
    }
  }
}
