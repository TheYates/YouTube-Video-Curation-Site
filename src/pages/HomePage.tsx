import { useState } from "react"
import { videos, categories, getVideosByCategory } from "../data/videos"
import VideoCard from "../components/VideoCard"
import CategoryTabs from "../components/CategoryTabs"
import EmailCapture from "../components/EmailCapture"
import AdSlot from "../components/AdSlot"

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState("Finance")
  const filtered = getVideosByCategory(activeCategory)

  return (
    <main className="page-enter mx-auto max-w-5xl px-6 py-12">
      <div className="mb-12 border-b border-[var(--color-border)] pb-12">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
          Curated Intelligence
        </p>
        <h1 className="font-display text-5xl leading-tight text-[var(--color-foreground)] sm:text-6xl">
          The best ideas,<br />
          <em>word for word.</em>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--color-muted-foreground)]">
          Every video is hand-picked, transcribed, and analysed. Click any word in
          a transcript to jump to that exact moment. Search across every video we
          have ever published.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
            {videos.length} videos · {categories.length - 1} categories
          </span>
        </div>
      </div>

      <EmailCapture variant="banner" />

      <div className="mb-8">
        <CategoryTabs
          categories={categories}
          active={activeCategory}
          onChange={setActiveCategory}
        />
      </div>

      <div className="mb-8">
        <AdSlot size="leaderboard" />
      </div>

      <div>
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-[var(--color-muted-foreground)]">No videos in this category yet.</p>
        ) : (
          filtered.map((video) => <VideoCard key={video.id} video={video} />)
        )}
      </div>
    </main>
  )
}
