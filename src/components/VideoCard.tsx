import { Link } from "react-router-dom"
import type { Video } from "../data/types"

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}

interface Props {
  video: Video
}

export default function VideoCard({ video }: Props) {
  return (
    <article className="group border-b border-[var(--color-border)] py-8 first:pt-0">
      <Link to={`/video/${video.id}`} className="block">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_200px]">
          <div className="flex flex-col justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
                  {video.category}
                </span>
                <span className="text-[var(--color-border)]">·</span>
                <span className="font-mono text-xs text-[var(--color-muted-foreground)]">{formatDate(video.publishedAt)}</span>
              </div>
              <h2 className="font-display text-2xl leading-snug text-[var(--color-foreground)] transition-colors group-hover:text-[var(--color-accent)]">
                {video.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)] line-clamp-2">
                {video.summary.slice(0, 180)}…
              </p>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-[var(--color-muted-foreground)]">{video.channelName}</span>
              <span className="font-mono text-xs text-[var(--color-muted-foreground)]">{formatDuration(video.durationSeconds)}</span>
              <div className="flex gap-2">
                {video.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[var(--color-border)] px-2 py-0.5 font-mono text-xs text-[var(--color-muted-foreground)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="order-first aspect-video overflow-hidden rounded-sm bg-[var(--color-muted)] sm:order-last sm:aspect-auto">
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              onError={(e) => {
                const img = e.currentTarget
                if (img.dataset.fbk) return
                img.dataset.fbk = "1"
                img.src = img.src.replace(/maxresdefault|sddefault/, "hqdefault")
              }}
              className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        </div>
      </Link>
    </article>
  )
}
