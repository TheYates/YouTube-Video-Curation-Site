import type { TranscriptWord } from "../data/types"

// A word ends a sentence if it closes with terminal punctuation,
// optionally followed by a closing quote/bracket.
const SENTENCE_END_RE = /[.!?…]["'”’)\]]?$/

const LONG_PAUSE = 2.5 //s — always a paragraph break
const BREATH_PAUSE = 0.8 //s — a break, but only at a sentence end
const SOFT_CAP = 90 // words — prefer a break, snapped to a sentence end
const LOOKAHEAD = 25 // words — how far to scan for a sentence end
const HARD_CAP = 115 // words — never grow a paragraph past this

function isSentenceEnd(text: string): boolean {
  return SENTENCE_END_RE.test(text)
}

// Group words into readable paragraphs. Breaks trigger on a long pause, a
// breath pause at a sentence end, or the soft word cap — but the boundary
// always snaps FORWARD to the next sentence end (bounded by LOOKAHEAD, with
// HARD_CAP as the backstop), so a paragraph never starts with a sentence
// continuation like "else." or "the background."
export function groupParagraphs(transcript: TranscriptWord[]): TranscriptWord[][] {
  const paragraphs: TranscriptWord[][] = []
  let start = 0

  const extendsTo = (trigger: number): number => {
    if (isSentenceEnd(transcript[trigger].text)) return trigger
    const limit = Math.min(trigger + LOOKAHEAD, transcript.length - 1, start + HARD_CAP - 1)
    for (let k = trigger + 1; k <= limit; k++) {
      if (isSentenceEnd(transcript[k].text)) return k
    }
    return Math.min(trigger, start + HARD_CAP - 1)
  }

  let i = 0
  while (i < transcript.length) {
    const next = transcript[i + 1]
    const gap = next ? next.startTime - transcript[i].endTime : Infinity
    const softCapHit = i - start + 1 >= SOFT_CAP
    if (!next || gap > LONG_PAUSE || (isSentenceEnd(transcript[i].text) && gap > BREATH_PAUSE) || softCapHit) {
      const end = extendsTo(i)
      paragraphs.push(transcript.slice(start, end + 1))
      start = end + 1
      i = end + 1
    } else {
      i++
    }
  }
  return paragraphs
}
