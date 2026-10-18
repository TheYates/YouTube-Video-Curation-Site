// Word-boundary truncation for SERP descriptions and card summaries.
//
// A hard slice(0, n) cuts mid-word and can leave a dangling space or comma
// ("...HEAD, and merges "), which reads like scraped text in a result snippet.
// Cut on the last whitespace before the limit, drop punctuation left hanging at
// the seam, and mark the elision.
export function truncateWords(input: string, max = 155): string {
  const text = (input ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // Only honour the boundary if it doesn't collapse the text to nothing (a
  // single unbroken token longer than max has no good cut).
  if (lastSpace > 0) cut = cut.slice(0, lastSpace);
  cut = cut.replace(/[\s,;:—–-]+$/u, "");
  return `${cut}…`;
}
