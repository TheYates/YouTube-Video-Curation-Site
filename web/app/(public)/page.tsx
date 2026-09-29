import type { Metadata } from "next";
import { getPublicCategories, getVideoCards } from "../../lib/videos";
import VideoFeed from "../../components/video-feed";
import AdSlot from "../../components/ad-slot";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "The best ideas, word for word",
  description:
    "Hand-picked YouTube videos, transcribed and analysed. Click any word in a transcript to jump to that exact moment.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  // No searchParams prop: awaiting it would opt this route into dynamic
  // rendering, which is what kept the page that links every video out of the
  // CDN cache. Category filtering runs client-side in VideoFeed instead.
  // "All" (not an empty default) so crawlers never get a blank feed.
  const [allVideos, cats] = await Promise.all([getVideoCards("All"), getPublicCategories()]);

  // ItemList tells Google these links are one curated collection with an
  // explicit order, rather than a loose set of links on the homepage. Omitted
  // when no site URL is configured.
  const siteBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const itemListJsonLd = siteBase
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: allVideos.map((v, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${siteBase}/video/${v.slug}`,
        })),
      }
    : null;

  return (
    <main className="page-enter mx-auto max-w-5xl px-6 py-12">
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      <div className="mb-12 border-b border-(--color-border) pb-12">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-(--color-accent)">
          Curated Intelligence
        </p>
        <h1 className="font-display text-5xl leading-tight text-(--color-foreground) sm:text-6xl">
          The best ideas,
          <br />
          <em>word for word.</em>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-(--color-muted-foreground)">
          Every video is hand-picked, transcribed, and analysed. Click any word in
          a transcript to jump to that exact moment. Search across every video we
          have ever published.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="font-mono text-xs text-(--color-muted-foreground)">
            {allVideos.length} videos · {cats.length - 1} categories
          </span>
        </div>
      </div>

      <AdSlot size="leaderboard" />

      <VideoFeed videos={allVideos} categories={cats} />
    </main>
  );
}
