// Canonical slugify for public video URLs (/video/<slug>).
// Slugs are frozen at publish time — retitles never change them.
// Keep in sync with slugifyTitle in scripts/ingest.mjs and
// supabase/functions/ingest/index.ts (same algorithm, three runtimes).

export function slugifyTitle(title: string): string {
  const stem = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return stem || "video";
}
