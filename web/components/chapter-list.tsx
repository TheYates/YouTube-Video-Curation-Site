import type { Chapter } from "../lib/types";
import ThumbImage from "./thumb-image";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ChapterList({
  chapters,
  currentTime,
  onSeek,
}: {
  chapters: Chapter[];
  currentTime: number;
  onSeek: (seconds: number) => void;
}) {
  const activeIdx = chapters.reduce((best, ch, i) => {
    return currentTime >= ch.startTime ? i : best;
  }, 0);

  return (
    <ol className="space-y-1">
      {chapters.map((ch, i) => {
        const isActive = i === activeIdx;
        return (
          <li key={i}>
            <button
              onClick={() => onSeek(ch.startTime)}
              className={[
                "w-full rounded-sm px-3 py-2.5 text-left transition-colors",
                isActive ? "bg-(--color-muted)" : "hover:bg-(--color-muted)/50",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                {ch.imageUrl && (
                  <ThumbImage
                    src={ch.imageUrl}
                    alt=""
                    className="aspect-video w-16 shrink-0 rounded-sm bg-(--color-muted) object-cover"
                  />
                )}
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="shrink-0 font-mono text-xs tabular-nums text-(--color-accent)">
                    {formatTime(ch.startTime)}
                  </span>
                  <span
                    className={[
                      "truncate text-sm font-medium",
                      isActive
                        ? "text-(--color-foreground)"
                        : "text-(--color-muted-foreground)",
                    ].join(" ")}
                  >
                    {ch.title}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 pl-12 text-xs text-(--color-muted-foreground) line-clamp-1">
                {ch.description}
              </p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
