import { Link } from "react-router-dom"
import { useVideos, usePageViews } from "../../hooks/useVideos"

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export default function AdminAnalytics() {
  const { data: videos = [], isPending: videosPending, isError } = useVideos("All")
  const { data: views = { viewsByVideo: {}, totalViews: 0, viewsLast30d: 0, trackingLive: false }, isPending: viewsPending } = usePageViews()

  const totalWords = videos.reduce((acc, v) => acc + v.transcript.length, 0)
  const totalChapters = videos.reduce((acc, v) => acc + v.chapters.length, 0)
  const chaptersWithFrames = videos.reduce(
    (acc, v) => acc + v.chapters.filter((c) => c.imageUrl).length,
    0
  )
  const recentVideos = videos.filter(
    (v) => Date.now() - new Date(v.publishedAt).getTime() < THIRTY_DAYS_MS
  ).length

  const statTiles = [
    {
      label: "Total Views",
      value: views.totalViews.toLocaleString(),
      delta: views.trackingLive
        ? `${views.viewsLast30d.toLocaleString()} in last 30 days`
        : "tracking not set up yet",
    },
    {
      label: "Total Videos",
      value: String(videos.length),
      delta: recentVideos > 0 ? `+${recentVideos} published in last 30 days` : "no new videos in 30 days",
    },
    {
      label: "Transcript Words",
      value: totalWords.toLocaleString(),
      delta: videos.length ? `avg ${Math.round(totalWords / videos.length).toLocaleString()}/video` : "no videos yet",
    },
    {
      label: "Chapters",
      value: String(totalChapters),
      delta: totalChapters
        ? `${Math.round((chaptersWithFrames / totalChapters) * 100)}% with frame stills`
        : "no chapters yet",
    },
  ]

  const categoryMap: Record<string, number> = {}
  for (const v of videos) {
    categoryMap[v.category] = (categoryMap[v.category] ?? 0) + 1
  }
  const categoryCounts = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])
  const maxCat = Math.max(1, ...categoryCounts.map(([, n]) => n))

  const topVideos = [...videos]
    .sort((a, b) => (views.viewsByVideo[b.id] ?? 0) - (views.viewsByVideo[a.id] ?? 0))
    .slice(0, 5)

  if (videosPending || viewsPending) {
    return <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>Loading analytics…</p>
  }
  if (isError) {
    return <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>Something went wrong loading analytics.</p>
  }
  return (
    <div className="space-y-10">
      {!views.trackingLive && (
        <div className="rounded-sm border border-amber-500/50 bg-amber-500/10 px-4 py-3">
          <p className="text-xs leading-relaxed text-amber-700">
            View tracking isn’t set up yet — run{" "}
            <code className="font-mono">supabase/migrations/20260908_page_views.sql</code>{" "}
            in the Supabase SQL editor. Views start accumulating from the next video page visit.
          </p>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statTiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-sm border p-5"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
          >
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
              {tile.label}
            </p>
            <p className="font-display text-3xl" style={{ color: "var(--color-foreground)" }}>
              {tile.value}
            </p>
            <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--color-accent)" }}>
              {tile.delta}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Videos by category bar chart */}
        <div>
          <h2 className="mb-5 font-mono text-xs uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>
            Videos by Category
          </h2>
          <div
            className="rounded-sm border p-5 space-y-4"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
          >
            {categoryCounts.length === 0 && (
              <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                No videos yet — ingest one to see the breakdown.
              </p>
            )}
            {categoryCounts.map(([cat, count]) => (
              <div key={cat}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-mono text-xs" style={{ color: "var(--color-foreground)" }}>{cat}</span>
                  <span className="font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    {count} video{count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--color-muted)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(count / maxCat) * 100}%`,
                      background: "var(--color-accent)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 videos by real views */}
        <div>
          <h2 className="mb-5 font-mono text-xs uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>
            Top Videos by Views
          </h2>
          <div
            className="rounded-sm border overflow-hidden"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
          >
            {topVideos.length === 0 && (
              <p className="px-4 py-6 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                No videos yet.
              </p>
            )}
            {topVideos.map((video, i) => (
              <Link
                key={video.id}
                to={`/admin/videos/${video.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-muted)]"
                style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}
              >
                <span
                  className="w-5 flex-shrink-0 font-display text-lg leading-none text-right"
                  style={{ color: i === 0 ? "var(--color-accent)" : "var(--color-border)" }}
                >
                  {i + 1}
                </span>
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  onError={(e) => {
                    const img = e.currentTarget
                    if (img.dataset.fbk) return
                    img.dataset.fbk = "1"
                    img.src = img.src.replace(/maxresdefault|sddefault/, "hqdefault")
                  }}
                  className="h-9 w-14 flex-shrink-0 rounded-sm object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm" style={{ color: "var(--color-foreground)" }}>
                    {video.title}
                  </p>
                  <span
                    className="font-mono text-[10px] uppercase"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {video.category}
                  </span>
                </div>
                <span className="flex-shrink-0 font-mono text-xs tabular-nums" style={{ color: "var(--color-muted-foreground)" }}>
                  {(views.viewsByVideo[video.id] ?? 0).toLocaleString()} views
                </span>
              </Link>
            ))}
          </div>
          {views.trackingLive && views.totalViews === 0 && topVideos.length > 0 && (
            <p className="mt-2 font-mono text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
              Tracking is live — open any video page and these counts start moving.
            </p>
          )}
        </div>
      </div>

      {/* Transcript coverage */}
      <div
        className="rounded-sm border px-6 py-5 flex items-center justify-between"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
            Transcript Coverage
          </p>
          <p className="font-display text-2xl" style={{ color: "var(--color-foreground)" }}>
            {totalWords.toLocaleString()} words
          </p>
          <p className="font-mono text-xs mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>
            across {videos.length} videos — avg {videos.length ? Math.round(totalWords / videos.length).toLocaleString() : 0} words/video
          </p>
        </div>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--color-accent)", opacity: 0.5 }}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      </div>
    </div>
  )
}
