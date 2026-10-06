import { getVideoCards } from "../../lib/videos";
import { siteUrl } from "../../lib/site-url";

// Route handlers are dynamic by default in Next 15, which would mean a Supabase
// round-trip and a server render on every aggregator poll. force-static +
// revalidate serves a cached document instead, the same treatment the public
// pages get.
export const dynamic = "force-static";
export const revalidate = 900;

// Plenty for feed readers and aggregators without shipping the whole catalogue
// on every poll.
const FEED_LIMIT = 50;

const FEED_TITLE = "Signal — the best ideas, word for word";
const FEED_DESCRIPTION =
  "Hand-picked YouTube videos, transcribed and analysed. Click any word in a transcript to jump to that exact moment.";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(): Promise<Response> {
  const base = siteUrl();
  // Already newest-first from the data layer.
  const videos = await getVideoCards("All").catch(() => []);
  const items = videos.slice(0, FEED_LIMIT);

  // Falls back to now for an empty library, so the document is still valid.
  const lastBuildDate = items[0]?.publishedAt
    ? new Date(items[0].publishedAt).toUTCString()
    : new Date().toUTCString();

  const itemXml = items.map((video) => {
    const url = `${base}/video/${video.slug}`;
    return [
      "    <item>",
      `      <title>${escapeXml(video.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${new Date(video.publishedAt).toUTCString()}</pubDate>`,
      `      <category>${escapeXml(video.category)}</category>`,
      `      <description>${escapeXml(video.summary)}</description>`,
      "    </item>",
    ].join("\n");
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(FEED_TITLE)}</title>`,
    `    <link>${base}</link>`,
    `    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />`,
    `    <description>${escapeXml(FEED_DESCRIPTION)}</description>`,
    "    <language>en-us</language>",
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    ...itemXml,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=900, stale-while-revalidate=86400",
    },
  });
}
