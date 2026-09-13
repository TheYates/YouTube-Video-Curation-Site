import type { Metadata } from "next";
import Link from "next/link";
import { searchVideos } from "../../../lib/videos";
import SearchForm from "../../../components/search-form";

export const metadata: Metadata = {
  title: "Search Transcripts",
  description: "Search every word of every transcript on Signal.",
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(
    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
  );
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-(--color-accent)/20 text-(--color-foreground)">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? await searchVideos(query).catch(() => []) : [];

  return (
    <main className="page-enter mx-auto max-w-5xl px-6 py-12">
      <div className="mb-10">
        <h1 className="mb-6 font-display text-4xl text-(--color-foreground)">Search Transcripts</h1>
        <SearchForm initialQuery={query} />
      </div>

      {query && (
        <div className="mb-6">
          <p className="font-mono text-xs text-(--color-muted-foreground)">
            {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
            <span className="text-(--color-foreground)">&ldquo;{query}&rdquo;</span>
          </p>
        </div>
      )}

      {!results.length && query && (
        <div className="py-20 text-center">
          <p className="text-2xl text-(--color-muted-foreground)">No matches found.</p>
          <p className="mt-2 text-sm text-(--color-muted-foreground)">
            Try different keywords — search checks titles, summaries, and full transcripts.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {results.map((result, i) => (
          <Link
            key={i}
            href={`/video/${result.video.slug}${result.matchTime > 0 ? `?t=${Math.floor(result.matchTime)}` : ""}`}
            className="group block rounded-sm border border-(--color-border) bg-(--color-card) p-5 transition-colors hover:border-(--color-accent)/40"
          >
            <div className="flex gap-4">
              <div className="flex-1 min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-xs uppercase tracking-widest text-(--color-accent)">
                    {result.video.category}
                  </span>
                  <span className="text-(--color-border)">·</span>
                  <span className="font-mono text-xs text-(--color-muted-foreground)">
                    {result.matchIn === "transcript"
                      ? `transcript @ ${formatTime(result.matchTime)}`
                      : "summary"}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-(--color-foreground) transition-colors group-hover:text-(--color-accent)">
                  {result.video.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-(--color-muted-foreground) line-clamp-2">
                  …<Highlight text={result.snippet} query={query} />…
                </p>
                {result.matchTime > 0 && (
                  <p className="mt-2 font-mono text-xs text-(--color-accent)">
                    ↗ Jump to {formatTime(result.matchTime)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
