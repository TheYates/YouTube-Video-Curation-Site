import { Fragment, useEffect, useRef } from "react";
import type { Chapter, TranscriptWord } from "../lib/types";
import { groupParagraphs } from "../lib/transcript";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TranscriptPane({
  transcript,
  chapters = [],
  currentTime,
  isActive,
  onWordClick,
}: {
  transcript: TranscriptWord[];
  chapters?: Chapter[];
  currentTime: number;
  // True once the player has started (playing or paused). Gates the active
  // highlight + read dimming so the first word isn't lit up on page load.
  isActive: boolean;
  onWordClick: (startTime: number) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const activeIdx = isActive
    ? transcript.findIndex((w) => currentTime >= w.startTime && currentTime < w.endTime)
    : -1;

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeIdx]);

  // Paragraph boundaries snap forward to sentence ends (see lib/transcript),
  // so a paragraph never starts with a continuation like "else."
  const paragraphs = groupParagraphs(transcript);

  // Chapter figures lead the paragraph containing their start time.
  const paraStarts = paragraphs.map((p) => p[0].startTime);
  const figuresByPara = new Map<number, Chapter[]>();
  for (const ch of chapters) {
    if (!ch.imageUrl) continue;
    let pi = paraStarts.length - 1;
    for (let k = 0; k < paraStarts.length; k++) {
      if (ch.startTime < paraStarts[k]) {
        pi = Math.max(0, k - 1);
        break;
      }
    }
    const list = figuresByPara.get(pi) ?? [];
    list.push(ch);
    figuresByPara.set(pi, list);
  }

  let wordIndex = 0;

  return (
    <div className="space-y-5 text-base leading-8 text-(--color-foreground)">
      {paragraphs.map((para, pi) => {
        const paraStart = para[0].startTime;
        return (
          <Fragment key={pi}>
            {(figuresByPara.get(pi) ?? []).map((ch, fi) => {
              const t = ch.frameTime ?? ch.startTime;
              return (
                <figure
                  key={fi}
                  className="overflow-hidden rounded-sm border border-(--color-border)"
                >
                  <button
                    onClick={() => onWordClick(t)}
                    className="block w-full cursor-pointer"
                    title={`Play from ${formatTime(t)} — ${ch.title}`}
                  >
                    <img
                      src={ch.imageUrl ?? ""}
                      alt={`Video still: ${ch.title}`}
                      loading="lazy"
                      className="aspect-video w-full bg-(--color-muted) object-cover"
                    />
                  </button>
                  <figcaption className="flex items-baseline gap-2 px-3 py-2">
                    <span className="font-mono text-xs tabular-nums text-(--color-accent)">
                      {formatTime(t)}
                    </span>
                    <span className="truncate text-sm text-(--color-muted-foreground)">
                      {ch.title}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
            <div className="group relative">
              <button
                onClick={() => onWordClick(paraStart)}
                className="absolute -left-10 top-1 hidden font-mono text-xs text-(--color-muted-foreground) opacity-0 transition-opacity group-hover:opacity-100 sm:block"
                title={`Jump to ${formatTime(paraStart)}`}
              >
                {formatTime(paraStart)}
              </button>
              <p className="inline">
                {para.map((word) => {
                  const idx = wordIndex++;
                  const isCurrent = idx === activeIdx;
                  return (
                    <button
                      key={idx}
                      ref={isCurrent ? activeRef : null}
                      onClick={() => onWordClick(word.startTime)}
                      className={[
                        "rounded-sm px-0.5 py-0.5 font-sans text-base leading-8 transition-all cursor-pointer",
                        isCurrent
                          ? "bg-(--color-accent) text-(--color-accent-foreground)"
                          : "hover:bg-(--color-muted) hover:text-(--color-foreground)",
                        !isCurrent && isActive && currentTime > word.endTime
                          ? "text-(--color-muted-foreground)"
                          : "text-(--color-foreground)",
                      ].join(" ")}
                    >
                      {word.text}
                    </button>
                  );
                })}
              </p>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
