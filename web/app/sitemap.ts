import type { MetadataRoute } from "next";
import { getVideoListings } from "../lib/videos";

export const revalidate = 3600;

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

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
  try {
    const videos = await getVideoListings();
    for (const [i, v] of videos.entries()) {
      entries.push({
        url: `${base}/video/${v.slug}`,
        lastModified: new Date(v.publishedAt),
      });
      // The feed changes when a new video lands, so the homepage borrows the
      // newest publish date (listings come back newest-first).
      if (i === 0) entries[0].lastModified = new Date(v.publishedAt);
    }
  } catch {
    // Supabase unreachable at build time — sitemap still emits static routes.
  }
  return entries;
}
