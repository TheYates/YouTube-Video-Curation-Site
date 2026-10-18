import type { SearchHit, Video } from "./types";

// Pure matching utilities shared by server search and related-video scoring.

export function searchInVideos(list: Video[], query: string): SearchHit[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();

  return list.flatMap((video) => {
    const results: SearchHit[] = [];

    if (video.title.toLowerCase().includes(q) || video.summary.toLowerCase().includes(q)) {
      const summaryIdx = video.summary.toLowerCase().indexOf(q);
      const snippet =
        summaryIdx >= 0
          ? video.summary.slice(Math.max(0, summaryIdx - 60), summaryIdx + 120)
          : video.summary.slice(0, 150);
      results.push({ video, snippet, matchTime: 0, matchIn: "summary" });
    }

    const transcriptText = video.transcript.map((w) => w.text).join(" ");
    const tIdx = transcriptText.toLowerCase().indexOf(q);
    if (tIdx >= 0) {
      let charCount = 0;
      let matchWord = video.transcript[0];
      for (const word of video.transcript) {
        charCount += word.text.length + 1;
        if (charCount >= tIdx) {
          matchWord = word;
          break;
        }
      }
      const snippet = transcriptText.slice(Math.max(0, tIdx - 60), tIdx + 120);
      results.push({ video, snippet, matchTime: matchWord.startTime, matchIn: "transcript" });
    }

    return results;
  });
}

// Scoring needs words, not characters: "Finance" and "finance," must match.
// Tokens shorter than 4 chars and a small stopword list are dropped so
// "the/how/with" don't create fake relevance between unrelated videos.
const STOPWORDS = new Set([
  "about", "after", "again", "against", "what", "when", "where", "which",
  "while", "with", "your", "yours", "their", "there", "these", "those",
  "this", "that", "from", "into", "only", "other", "than", "then", "them",
  "they", "have", "has", "had", "does", "did", "will", "would", "could",
  "should", "more", "most", "some", "such", "very", "just", "like", "make",
  "made", "over", "under", "here", "were", "been", "being", "because",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    (text ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
  );
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

// Related picker. Tags are the strongest signal (curator-assigned topical
// labels), then category membership, then loose title/summary word overlap.
//
// The overlap terms exist because tags were once empty on every row: with only
// `sharedTags*2 + sameCategory` every candidate in a category tied at 0–1, the
// stable sort fell back to database order, and every page in a category emitted
// the identical related block. Title/summary overlap + a recency tiebreak make
// the selection vary even when tags are sparse, and stay stable when they aren't.
export function scoreRelated(list: Video[], video: Video, limit = 3): Video[] {
  const sourceTitle = tokenize(video.title);
  const sourceSummary = tokenize(video.summary);
  return list
    .filter((v) => v.id !== video.id)
    .map((v) => {
      const sharedTags = v.tags.filter((t) => video.tags.includes(t)).length;
      const sameCategory = v.category === video.category ? 1 : 0;
      const titleOverlap = tokenOverlap(tokenize(v.title), sourceTitle);
      const summaryOverlap = tokenOverlap(tokenize(v.summary), sourceSummary);
      const score =
        sharedTags * 3 + sameCategory * 2 + titleOverlap * 2 + summaryOverlap;
      return { video: v, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Same score (or no signals): newest first, then id, so the order is
      // deterministic and identical pages can't shuffle between requests.
      if (a.video.publishedAt !== b.video.publishedAt) {
        return a.video.publishedAt < b.video.publishedAt ? 1 : -1;
      }
      return a.video.id < b.video.id ? -1 : 1;
    })
    .slice(0, limit)
    .map((r) => r.video);
}
