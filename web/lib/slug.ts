// Canonical slugify for public video URLs (/video/<slug>).
// Slugs are frozen at publish time — retitles never change them.
// Keep in sync with slugifyTitle in scripts/ingest-core.mjs and
// supabase/functions/ingest/index.ts (same algorithm, three runtimes).
//
// Truncation is word-complete: a plain slice(0, 60) produced URLs like
// "...-on-every-pc-tha" and "...-no-zoh", which read as broken and split the
// final keyword. We cut at the last word boundary before 60 and then keep the
// word that straddles it, up to a 70-character ceiling, so the slug still ends
// on a real word.
const MAX_SLUG = 60;
const MAX_SLUG_WITH_TAIL = 70;

export function slugifyTitle(title: string): string {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) return "video";
  if (normalized.length <= MAX_SLUG) return normalized;

  let end = MAX_SLUG;
  const boundary = normalized.lastIndexOf("-", MAX_SLUG);
  // `> 20` keeps a pathological title from collapsing to a two-word slug.
  if (boundary > 20) end = boundary;

  const nextBoundary = normalized.indexOf("-", end + 1);
  const wordEnd = nextBoundary === -1 ? normalized.length : nextBoundary;
  if (wordEnd <= MAX_SLUG_WITH_TAIL) end = wordEnd;

  return normalized.slice(0, end).replace(/-+$/, "") || "video";
}
