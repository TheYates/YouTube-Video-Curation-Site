import { useEffect, useRef } from "react"
import type { TranscriptWord } from "../data/types"

interface Props {
  transcript: TranscriptWord[]
  currentTime: number
  onWordClick: (startTime: number) => void
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

export default function TranscriptPane({ transcript, currentTime, onWordClick }: Props) {
  const activeRef = useRef<HTMLButtonElement | null>(null)

  const activeIdx = transcript.findIndex(
    (w) => currentTime >= w.startTime && currentTime < w.endTime
  )

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [activeIdx])

  // Group words into paragraph-like chunks by gap in timing (> 3s gap = new paragraph)
  const paragraphs: TranscriptWord[][] = []
  let current: TranscriptWord[] = []
  for (let i = 0; i < transcript.length; i++) {
    current.push(transcript[i])
    const next = transcript[i + 1]
    if (!next || next.startTime - transcript[i].endTime > 3) {
      paragraphs.push(current)
      current = []
    }
  }

  let wordIndex = 0

  return (
    <div className="space-y-5 text-base leading-8 text-[var(--color-foreground)]">
      {paragraphs.map((para, pi) => {
        const paraStart = para[0].startTime
        return (
          <div key={pi} className="group relative">
            <button
              onClick={() => onWordClick(paraStart)}
              className="absolute -left-10 top-1 hidden font-mono text-xs text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 sm:block"
              title={`Jump to ${formatTime(paraStart)}`}
            >
              {formatTime(paraStart)}
            </button>
            <p className="inline">
              {para.map((word) => {
                const idx = wordIndex++
                const isActive = idx === activeIdx
                return (
                  <button
                    key={idx}
                    ref={isActive ? activeRef : null}
                    onClick={() => onWordClick(word.startTime)}
                    className={[
                      "rounded-sm px-0.5 py-0.5 font-sans text-base leading-8 transition-all cursor-pointer",
                      isActive
                        ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                        : "hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
                      !isActive && currentTime > word.endTime
                        ? "text-[var(--color-muted-foreground)]"
                        : "text-[var(--color-foreground)]",
                    ].join(" ")}
                  >
                    {word.text}
                  </button>
                )
              })}
            </p>
          </div>
        )
      })}
    </div>
  )
}
