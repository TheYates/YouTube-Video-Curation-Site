import type { Metadata } from "next";
import { getCategories, getVideos } from "../../lib/videos";
import CategoryTabs from "../../components/category-tabs";
import VideoCard from "../../components/video-card";
import AdSlot from "../../components/ad-slot";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "The best ideas, word for word",
  description:
    "Hand-picked YouTube videos, transcribed and analysed. Click any word in a transcript to jump to that exact moment.",
  alternates: { canonical: "/" },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [allVideos, cats] = await Promise.all([getVideos("All"), getCategories()]);
  // No param → show everything (an empty default would serve crawlers a blank feed).
  const activeCategory = category && cats.includes(category) ? category : "All";
  const filtered =
    activeCategory === "All" ? allVideos : allVideos.filter((v) => v.category === activeCategory);

  return (
    <main className="page-enter mx-auto max-w-5xl px-6 py-12">
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

      <div className="mb-8">
        <AdSlot size="leaderboard" />
      </div>

      <div className="mb-8">
        <CategoryTabs categories={cats} active={activeCategory} />
      </div>

      <div>
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-(--color-muted-foreground)">
            No videos in this category yet.
          </p>
        ) : (
          filtered.map((video) => <VideoCard key={video.id} video={video} />)
        )}
      </div>
    </main>
  );
}
