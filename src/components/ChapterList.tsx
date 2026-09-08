import type { Chapter } from "../data/types"

interface Props {
  chapters: Chapter[]
  currentTime: number
  onSeek: (seconds: number) => void
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

export default function ChapterList({ chapters, currentTime, onSeek }: Props) {
  const activeIdx = chapters.reduce((best, ch, i) => {
    return currentTime >= ch.startTime ? i : best
  }, 0)

  return (
    <ol className="space-y-1">
      {chapters.map((ch, i) => {
        const isActive = i === activeIdx
        return (
          <li key={i}>
            <button
              onClick={() => onSeek(ch.startTime)}
              className={[
                "w-full rounded-sm px-3 py-2.5 text-left transition-colors",
                isActive ? "bg-[var(--color-muted)]" : "hover:bg-[var(--color-muted)]/50",
              ].join(" ")}
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs tabular-nums text-[var(--color-accent)]">
                  {formatTime(ch.startTime)}
                </span>
                <span
                  className={[
                    "text-sm font-medium",
                    isActive ? "text-[var(--color-foreground)]" : "text-[var(--color-muted-foreground)]",
                  ].join(" ")}
                >
                  {ch.title}
                </span>
              </div>
              <p className="mt-0.5 pl-12 text-xs text-[var(--color-muted-foreground)] line-clamp-1">
                {ch.description}
              </p>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
