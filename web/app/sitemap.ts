import type { MetadataRoute } from "next";
import { getPublicCategories, getVideoListings } from "../lib/videos";
import { categorySlug } from "../lib/category";
import { siteUrl } from "../lib/site-url";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = [
    // Homepage without trailing slash to match the canonical Next renders
    // (<link rel="canonical" href="https://<host>">). /search is deliberately
    // excluded: the empty search page has no results and would waste crawl
    // budget that should go to /video/* pages.
    { url: `${base}` },
    // Trust pages — high value for AdSense review and E-E-A-T signals. No
    // lastModified: they aren't touched on any schedule, and a timestamp that
    // changes on every render teaches Google to distrust the field.
    ...["about", "contact", "privacy", "disclosure"].map((p) => ({ url: `${base}/${p}` })),
  ];
  // changeFrequency and priority are omitted throughout: Google ignores both.
  // lastModified is the only hint it acts on, so it appears only where there
  // is a real edit date.

  // Caught per call rather than around the whole block: a categories outage
  // shouldn't also cost us every video URL.
  const [videos, categories] = await Promise.all([
    getVideoListings().catch(() => []),
    getPublicCategories().catch(() => [] as string[]),
  ]);

  // Curation date, not the YouTube upload date: a page added today for a 2013
  // upload changed today, and reporting 2013 teaches Google the field is
  // unreliable (it also made the whole catalogue look stale).
  let newestCurated: string | null = null;
  for (const v of videos) {
    entries.push({
      url: `${base}/video/${v.slug}`,
      lastModified: new Date(v.curatedAt),
    });
    if (!newestCurated || v.curatedAt > newestCurated) newestCurated = v.curatedAt;
  }
  // The feed changes when a new video lands, so the homepage borrows the newest
  // curation date. Listings are ordered by upload date, so take the max rather
  // than trusting position 0.
  if (newestCurated) entries[0].lastModified = new Date(newestCurated);

  // Category hubs — the crawlable landing pages that replaced the client-side
  // filter on the homepage. lastModified borrows the newest video in the
  // category, because adding a video is the only thing that actually changes a
  // hub; anything else would be a fabricated timestamp.
  //
  // getPublicCategories applies the curator's threshold; with the default of 1
  // every real category is advertised, so the sitemap, nav and homepage count
  // agree about how many sections the site actually has.
  const newestByCategory = new Map<string, string>();
  for (const v of videos) {
    const current = newestByCategory.get(v.category);
    if (!current || v.curatedAt > current) newestByCategory.set(v.category, v.curatedAt);
  }
  for (const category of categories) {
    if (category === "All") continue;
    const lastModified = newestByCategory.get(category);
    entries.push({
      url: `${base}/category/${categorySlug(category)}`,
      ...(lastModified ? { lastModified: new Date(lastModified) } : {}),
    });
  }

  return entries;
}
