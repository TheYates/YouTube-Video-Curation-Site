import { Link } from "react-router-dom"
import { useVideos, useCategories } from "../../hooks/useVideos"

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, "0")}`
}

const quickActions = [
  { label: "Ingest New Video", to: "/admin/ingest" },
  { label: "Manage Categories", to: "/admin/categories" },
  { label: "View Analytics", to: "/admin/analytics" },
]

export default function AdminDashboard() {
  const { data: videos = [], isPending, isError } = useVideos("All")
  const { data: cats = ["All"] } = useCategories()

  const totalWords = videos.reduce((acc, v) => acc + v.transcript.length, 0)
  const totalChapters = videos.reduce((acc, v) => acc + v.chapters.length, 0)
  const recentVideos = [...videos]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 5)

  const statCards = [
    {
      label: "Total Videos",
      value: videos.length,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="m10 9 5 3-5 3V9z" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      label: "Categories",
      value: cats.length - 1,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
          <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      label: "Transcript Words",
      value: totalWords.toLocaleString(),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      ),
    },
    {
      // Newsletter is disabled for now — chapters is the real fourth metric.
      label: "Chapters",
      value: totalChapters.toLocaleString(),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      ),
    },
  ]

  if (isPending) {
    return <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>Loading dashboard…</p>
  }
  if (isError) {
    return <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>Something went wrong loading dashboard data.</p>
  }
  return (
    <div className="space-y-10">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-sm border p-5"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
                {card.label}
              </span>
              <span style={{ color: "var(--color-accent)" }}>{card.icon}</span>
            </div>
            <p className="font-display text-4xl" style={{ color: "var(--color-foreground)" }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="mb-4 font-mono text-xs uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>
          Recent Activity
        </h2>
        <div
          className="rounded-sm border overflow-hidden"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          {recentVideos.map((video, i) => (
            <Link
              key={video.id}
              to={`/admin/videos/${video.id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-muted)]"
              style={{ borderTop: i > 0 ? `1px solid var(--color-border)` : undefined }}
            >
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                onError={(e) => {
                  const img = e.currentTarget
                  if (img.dataset.fbk) return
                  img.dataset.fbk = "1"
                  img.src = img.src.replace(/maxresdefault|sddefault/, "hqdefault")
                }}
                className="h-10 w-16 flex-shrink-0 rounded-sm object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                  {video.title}
                </p>
                <p className="font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                  {video.channelName} · {formatDuration(video.durationSeconds)}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span
                  className="rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                  style={{ background: "var(--color-muted)", color: "var(--color-accent)" }}
                >
                  {video.category}
                </span>
                <span className="font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                  {formatDate(video.publishedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-4 font-mono text-xs uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="rounded-sm border px-5 py-3 font-mono text-xs uppercase tracking-widest transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
