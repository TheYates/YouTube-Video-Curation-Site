import { groupParagraphs } from "./transcript";
import type { TranscriptWord } from "./types";

// The transcript as it crosses the server → client boundary.
//
// Why not TranscriptWord[]: every prop handed to a client component is
// serialized into the RSC flight payload, on top of the HTML that prop
// rendered. A 3,800-word transcript as {text,startTime,endTime} objects is
// ~285 KB per page — eight times the size of the rendered transcript, and by
// far the largest thing Googlebot had to download per video URL.
//
// So: word text travels once, as paragraph text, and end times are dropped. A
// word's end is the next word's start, and holding the last started word
// highlighted reads better through pauses than blinking the highlight off.
export interface TranscriptPayload {
  /** One entry per paragraph: that paragraph's words joined by single spaces. */
  paragraphs: string[];
  /** Word start times in seconds, one entry per word, ascending. */
  starts: number[][];
}

// 10 ms resolution — imperceptible when seeking, and it keeps the numbers short.
function toTenths(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}

export function buildTranscriptPayload(transcript: TranscriptWord[]): TranscriptPayload {
  const paragraphs: string[] = [];
  const starts: number[][] = [];
  for (const words of groupParagraphs(transcript)) {
    paragraphs.push(words.map((w) => w.text).join(" "));
    starts.push(words.map((w) => toTenths(w.startTime)));
  }
  return { paragraphs, starts };
}

/** Character offset of each word within a paragraph's joined text. */
export function wordOffsets(text: string): number[] {
  const offsets: number[] = [];
  let pos = 0;
  for (const word of text.split(" ")) {
    offsets.push(pos);
    pos += word.length + 1;
  }
  return offsets;
}

/**
 * Index of the last value at or before `time` (values must be ascending), or
 * -1 when `time` precedes them all. Used both for "which word is playing" and
 * for "which word did the reader click".
 */
export function lastIndexAtOrBefore(values: number[], time: number): number {
  let lo = 0;
  let hi = values.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}
