import { useState } from "react"
import { useVideos, useCategories } from "../hooks/useVideos"
import VideoCard from "../components/VideoCard"
import CategoryTabs from "../components/CategoryTabs"
import EmailCapture from "../components/EmailCapture"
import { NEWSLETTER_ENABLED } from "../lib/env"
import AdSlot from "../components/AdSlot"

function VideoCardSkeleton() {
  return (
    <div className="mb-6 animate-pulse rounded-sm border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_200px]">
        <div className="space-y-3">
          <div className="h-3 w-24 rounded bg-[var(--color-muted)]" />
          <div className="h-5 w-3/4 rounded bg-[var(--color-muted)]" />
          <div className="h-4 w-full rounded bg-[var(--color-muted)]" />
          <div className="h-4 w-2/3 rounded bg-[var(--color-muted)]" />
        </div>
        <div className="aspect-video w-full rounded-sm bg-[var(--color-muted)]" />
      </div>
    </div>
  )
}

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState("Finance")
  const { data: filtered = [], isPending, isError } = useVideos(activeCategory)
  const { data: allVideos = [] } = useVideos("All")
  const { data: cats = ["All"] } = useCategories()

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
            {allVideos.length} videos · {cats.length - 1} categories
          </span>
        </div>
      </div>

      {NEWSLETTER_ENABLED && <EmailCapture variant="banner" />}

      <div className="mb-8">
        <CategoryTabs
          categories={cats}
          active={activeCategory}
          onChange={setActiveCategory}
        />
      </div>

      <div className="mb-8">
        <AdSlot size="leaderboard" />
      </div>

      <div>
        {isPending ? (
          <div>
            {Array.from({ length: 3 }).map((_, i) => (
              <VideoCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <p className="py-16 text-center text-[var(--color-muted-foreground)]">
            Something went wrong loading videos.
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-[var(--color-muted-foreground)]">No videos in this category yet.</p>
        ) : (
          filtered.map((video) => <VideoCard key={video.id} video={video} />)
        )}
      </div>
    </main>
  )
}
