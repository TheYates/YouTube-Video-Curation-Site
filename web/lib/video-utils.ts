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

export function scoreRelated(list: Video[], video: Video, limit = 3): Video[] {
  return list
    .filter((v) => v.id !== video.id)
    .map((v) => {
      const sharedTags = v.tags.filter((t) => video.tags.includes(t)).length;
      const sameCategory = v.category === video.category ? 1 : 0;
      return { video: v, score: sharedTags * 2 + sameCategory };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.video);
}
