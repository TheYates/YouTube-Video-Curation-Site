import type { MetadataRoute } from "next";
import { getVideos } from "../lib/videos";

export const revalidate = 3600;

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/search`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
  try {
    const videos = await getVideos("All");
    for (const v of videos) {
      entries.push({
        url: `${base}/video/${v.id}`,
        lastModified: new Date(v.publishedAt),
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  } catch {
    // Supabase unreachable at build time — sitemap still emits static routes.
  }
  return entries;
}
