import { Fragment, useEffect, useMemo, useRef } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import type { Chapter } from "../lib/types";
import {
  lastIndexAtOrBefore,
  wordOffsets,
  type TranscriptPayload,
} from "../lib/transcript-payload";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface RenderedParagraph {
  text: string;
  starts: number[];
  /** Character offset of each word in `text`; empty when it can't be trusted. */
  offsets: number[];
  /** Index of this paragraph's first word in the flat transcript. */
  flatStart: number;
}

// "Already played" styling for whole paragraphs. Painted as a flat muted
// gradient clipped to the glyphs, so the read-along dimming survives without
// wrapping every word in its own element.
const PLAYED_STYLE: CSSProperties = {
  color: "transparent",
  backgroundImage:
    "linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
};

interface CaretPointSource {
  caretPositionFromPoint?: (
    x: number,
    y: number
  ) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
}

// Offset of the clicked caret position, measured in characters from the start
// of `el`. Measuring with a Range (rather than the raw offsetNode/offset) keeps
// the answer correct whether the paragraph is one text node or has been split
// around the active word. Returns null when the browser gives us nothing
// usable, so callers can fall back.
function caretCharOffset(el: HTMLElement, x: number, y: number): number | null {
  const doc = document as Document & CaretPointSource;
  let node: Node | null = null;
  let offset = 0;
  if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  } else if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(x, y);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE || !el.contains(node)) return null;
  const measured = document.createRange();
  measured.setStart(el, 0);
  measured.setEnd(node, offset);
  return measured.toString().length;
}

// One <p> of plain text per paragraph, one click handler for the whole
// transcript. The previous version rendered a <button> per word — 3,870 of them
// on a typical page — which cost ~180 bytes of markup per word and a DOM to
// match. Clicks are resolved to a word with the caret API instead.
export default function TranscriptPane({
  payload,
  chapters = [],
  currentTime,
  isActive,
  onWordClick,
}: {
  payload: TranscriptPayload;
  chapters?: Chapter[];
  currentTime: number;
  // True once the player has started (playing or paused). Gates the active
  // highlight + read dimming so the first word isn't lit up on page load.
  isActive: boolean;
  onWordClick: (startTime: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const paragraphs = useMemo<RenderedParagraph[]>(() => {
    let flatStart = 0;
    return payload.paragraphs.map((text, pi) => {
      const starts = payload.starts[pi] ?? [];
      const offsets = wordOffsets(text);
      const rendered: RenderedParagraph = {
        text,
        starts,
        // If the text didn't round-trip to the same word count — only possible
        // if a word contained a space — the offsets can't be aligned to the
        // starts. Drop them and fall back to paragraph-level seeking for this
        // paragraph rather than seeking to the wrong word.
        offsets: offsets.length === starts.length ? offsets : [],
        flatStart,
      };
      flatStart += starts.length;
      return rendered;
    });
  }, [payload]);

  const flatStarts = useMemo(() => paragraphs.flatMap((p) => p.starts), [paragraphs]);

  // Which word is currently playing, and where that lands in the paragraph list.
  const { activePara, activeWord } = useMemo(() => {
    const flat = isActive ? lastIndexAtOrBefore(flatStarts, currentTime) : -1;
    if (flat < 0) return { activePara: -1, activeWord: -1 };
    for (let pi = 0; pi < paragraphs.length; pi++) {
      const p = paragraphs[pi];
      if (flat < p.flatStart + p.starts.length) {
        return { activePara: pi, activeWord: flat - p.flatStart };
      }
    }
    return { activePara: -1, activeWord: -1 };
  }, [isActive, currentTime, flatStarts, paragraphs]);

  // Scrolled by lookup rather than a ref on the active paragraph: pointing a
  // single ref at whichever paragraph is active detaches it from the previous
  // one mid-commit, so it can end up null by the time this effect runs.
  useEffect(() => {
    if (activePara < 0) return;
    const el = containerRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activePara]);

  // Chapter figures lead the paragraph containing their start time.
  const figuresByPara = useMemo(() => {
    const paraStarts = paragraphs.map((p) => p.starts[0]);
    const map = new Map<number, Chapter[]>();
    for (const ch of chapters) {
      if (!ch.imageUrl) continue;
      let pi = paraStarts.length - 1;
      for (let k = 0; k < paraStarts.length; k++) {
        if (ch.startTime < paraStarts[k]) {
          pi = Math.max(0, k - 1);
          break;
        }
      }
      const list = map.get(pi) ?? [];
      list.push(ch);
      map.set(pi, list);
    }
    return map;
  }, [chapters, paragraphs]);

  function handleParagraphClick(e: ReactMouseEvent<HTMLParagraphElement>, pi: number) {
    // Don't hijack a drag-selection: people copy transcript text.
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;

    const para = paragraphs[pi];
    if (!para || para.starts.length === 0) return;
    // No caret info (older engines) or unusable offsets → top of paragraph.
    const charOffset = caretCharOffset(e.currentTarget, e.clientX, e.clientY);
    const idx =
      charOffset === null || para.offsets.length === 0
        ? 0
        : Math.max(0, lastIndexAtOrBefore(para.offsets, charOffset));
    onWordClick(para.starts[idx] ?? para.starts[0]);
  }

  return (
    <div
      ref={containerRef}
      className="space-y-5 text-base leading-8 text-(--color-foreground)"
    >
      {paragraphs.map((para, pi) => {
        const paraStart = para.starts[0];
        const isCurrent = pi === activePara;
        const activeStart =
          isCurrent && activeWord >= 0 && para.offsets.length > 0
            ? para.offsets[activeWord]
            : undefined;
        // The active word runs to the next space (or the paragraph end).
        const spaceAfter = activeStart === undefined ? -1 : para.text.indexOf(" ", activeStart);
        const activeEnd =
          activeStart === undefined ? undefined : spaceAfter === -1 ? para.text.length : spaceAfter;

        // Whole paragraph already played? Paint it flat muted. Current
        // paragraph? Gradient that stops after the spoken word. This replaces
        // per-word "played" classes with one inline style per paragraph.
        let style: CSSProperties | undefined;
        if (isActive && activePara >= 0) {
          if (pi < activePara) {
            style = PLAYED_STYLE;
          } else if (isCurrent && activeEnd !== undefined) {
            const cut = (activeEnd / Math.max(1, para.text.length)) * 100;
            style = {
              color: "transparent",
              backgroundImage: `linear-gradient(90deg, var(--color-muted-foreground) 0 ${cut}%, var(--color-foreground) ${cut}% 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            };
          }
        }

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
              {/* One control per paragraph (keyboard + hover affordance)
                  instead of one per word — see handleParagraphClick for the
                  pointer path. */}
              <button
                onClick={() => onWordClick(paraStart)}
                className="absolute -left-10 top-1 hidden font-mono text-xs text-(--color-muted-foreground) opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:block"
                title={`Jump to ${formatTime(paraStart)}`}
              >
                {formatTime(paraStart)}
              </button>
              <p
                data-p={pi}
                data-active={isCurrent ? "true" : undefined}
                onClick={(e) => handleParagraphClick(e, pi)}
                style={style}
                className="inline cursor-pointer"
              >
                {activeStart !== undefined && activeEnd !== undefined ? (
                  <>
                    {para.text.slice(0, activeStart)}
                    <span className="text-(--color-accent)">
                      {para.text.slice(activeStart, activeEnd)}
                    </span>
                    {para.text.slice(activeEnd)}
                  </>
                ) : (
                  para.text
                )}
              </p>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
