import { Link } from "react-router-dom"
import { useVideos } from "../../hooks/useVideos"

const statTiles = [
  { label: "Total Views", value: "8,420", delta: "+12% this month" },
  { label: "Avg. Time on Page", value: "4m 12s", delta: "+0:18 vs last month" },
  { label: "Search Queries", value: "1,203", delta: "343 unique queries" },
  { label: "Email CTR", value: "6.4%", delta: "industry avg: 2.1%" },
]

// Mock view counts (no view tracking in the DB yet). Keyed by video id;
// unknown ids fall back to 0 views.
const mockViews: Record<string, number> = {
  v1: 2140, v2: 1870, v3: 1420, v4: 1280, v5: 980,
  v6: 720, v7: 540, v8: 310,
}

export default function AdminAnalytics() {
  const { data: videos = [], isPending, isError } = useVideos("All")

  const totalWords = videos.reduce((acc, v) => acc + v.transcript.length, 0)

  const categoryMap: Record<string, number> = {}
  for (const v of videos) {
    categoryMap[v.category] = (categoryMap[v.category] ?? 0) + 1
  }
  const categoryCounts = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])
  const maxCat = Math.max(1, ...categoryCounts.map(([, n]) => n))

  const topVideos = [...videos]
    .sort((a, b) => (mockViews[b.id] ?? 0) - (mockViews[a.id] ?? 0))
    .slice(0, 5)

  if (isPending) {
    return <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>Loading analytics…</p>
  }
  if (isError) {
    return <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>Something went wrong loading analytics.</p>
  }
  return (
    <div className="space-y-10">
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

        {/* Top 5 videos */}
        <div>
          <h2 className="mb-5 font-mono text-xs uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>
            Top Videos by Views
          </h2>
          <div
            className="rounded-sm border overflow-hidden"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
          >
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
                  {(mockViews[video.id] ?? 0).toLocaleString()} views
                </span>
              </Link>
            ))}
          </div>
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
