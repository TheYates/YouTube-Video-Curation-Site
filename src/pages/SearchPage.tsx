import { useState, useEffect } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { useSearch } from "../hooks/useVideos"

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-[var(--color-accent)]/20 text-[var(--color-foreground)]">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get("q") ?? ""
  const [inputValue, setInputValue] = useState(query)

  useEffect(() => {
    setInputValue(query)
  }, [query])

  const { data: results = [], isFetching } = useSearch(query)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (inputValue.trim()) {
      setSearchParams({ q: inputValue.trim() })
    }
  }

  return (
    <main className="page-enter mx-auto max-w-5xl px-6 py-12">
      <div className="mb-10">
        <h1 className="mb-6 font-display text-4xl text-[var(--color-foreground)]">Search Transcripts</h1>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search every word of every transcript…"
            className="flex-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-foreground)] placeholder-[var(--color-muted-foreground)] outline-none transition-colors focus:border-[var(--color-accent)]"
            autoFocus
          />
          <button
            type="submit"
            className="rounded-sm bg-[var(--color-accent)] px-6 py-3 font-mono text-xs uppercase tracking-widest text-[var(--color-accent-foreground)] transition-opacity hover:opacity-80"
          >
            Search
          </button>
        </form>
      </div>

      {query && (
        <div className="mb-6">
          <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
            {isFetching ? (
              "Searching…"
            ) : (
              <>
                {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
                <span className="text-[var(--color-foreground)]">&ldquo;{query}&rdquo;</span>
              </>
            )}
          </p>
        </div>
      )}

      {!isFetching && results.length === 0 && query && (
        <div className="py-20 text-center">
          <p className="text-2xl text-[var(--color-muted-foreground)]">No matches found.</p>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Try different keywords — search checks titles, summaries, and full transcripts.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {results.map((result, i) => (
          <Link
            key={i}
            to={`/video/${result.video.id}${result.matchTime > 0 ? `?t=${Math.floor(result.matchTime)}` : ""}`}
            className="group block rounded-sm border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition-colors hover:border-[var(--color-accent)]/40"
          >
            <div className="flex gap-4">
              <div className="hidden flex-shrink-0 sm:block">
                <img
                  src={result.video.thumbnailUrl}
                  alt={result.video.title}
                  onError={(e) => {
                    const img = e.currentTarget
                    if (img.dataset.fbk) return
                    img.dataset.fbk = "1"
                    img.src = img.src.replace(/maxresdefault|sddefault/, "hqdefault")
                  }}
                  className="h-16 w-28 rounded-sm object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
                    {result.video.category}
                  </span>
                  <span className="text-[var(--color-border)]">·</span>
                  <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
                    {result.matchIn === "transcript" ? `transcript @ ${formatTime(result.matchTime)}` : "summary"}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-[var(--color-foreground)] transition-colors group-hover:text-[var(--color-accent)]">
                  {result.video.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted-foreground)] line-clamp-2">
                  …<Highlight text={result.snippet} query={query} />…
                </p>
                {result.matchTime > 0 && (
                  <p className="mt-2 font-mono text-xs text-[var(--color-accent)]">
                    ↗ Jump to {formatTime(result.matchTime)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
