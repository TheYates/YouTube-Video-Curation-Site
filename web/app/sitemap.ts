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

  for (const [i, v] of videos.entries()) {
    entries.push({
      url: `${base}/video/${v.slug}`,
      lastModified: new Date(v.publishedAt),
    });
    // The feed changes when a new video lands, so the homepage borrows the
    // newest publish date (listings come back newest-first).
    if (i === 0) entries[0].lastModified = new Date(v.publishedAt);
  }

  // Category hubs — the crawlable landing pages that replaced the client-side
  // filter on the homepage. lastModified borrows the newest video in the
  // category, because adding a video is the only thing that actually changes a
  // hub; anything else would be a fabricated timestamp.
  //
  // Only categories above the curator's minimum-size threshold are advertised
  // (getPublicCategories applies it), which matches the nav: thin sections stay
  // reachable but aren't put forward.
  const newestByCategory = new Map<string, string>();
  for (const v of videos) {
    const current = newestByCategory.get(v.category);
    if (!current || v.publishedAt > current) newestByCategory.set(v.category, v.publishedAt);
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
