import { useState, useEffect, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

export default function NavBar() {
  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const navigate = useNavigate()
  const mobileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      setProgress(scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (searchOpen) mobileInputRef.current?.focus()
  }, [searchOpen])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      setQuery("")
      setSearchOpen(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-background)]/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
        <Link to="/" className="flex-shrink-0">
          <span className="font-display text-xl font-normal tracking-tight text-[var(--color-foreground)]">
            Signal<span className="text-[var(--color-accent)]">.</span>
          </span>
        </Link>

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="hidden flex-1 items-center sm:flex">
          <div className="relative w-full max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transcripts…"
              className="w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-muted)] py-2 pl-9 pr-4 text-sm text-[var(--color-foreground)] placeholder-[var(--color-muted-foreground)] outline-none transition-colors focus:border-[var(--color-accent)]"
            />
          </div>
        </form>

        <div className="flex flex-1 items-center justify-end gap-3 sm:flex-none sm:justify-start">
          {/* Mobile search toggle */}
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] sm:hidden"
            aria-label="Search"
          >
            {searchOpen ? <CloseIcon /> : <SearchIcon />}
          </button>

          <nav className="hidden items-center gap-6 text-sm text-[var(--color-muted-foreground)] sm:flex">
            <Link to="/" className="transition-colors hover:text-[var(--color-foreground)]">
              Browse
            </Link>
          </nav>
        </div>
      </div>

      {/* Mobile search overlay */}
      <div
        style={{
          maxHeight: searchOpen ? "60px" : "0px",
          opacity: searchOpen ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.25s ease, opacity 0.2s ease",
        }}
        className="border-t border-[var(--color-border)] sm:hidden"
      >
        <form onSubmit={handleSearch} className="flex items-center gap-3 px-6 py-3">
          <span className="text-[var(--color-muted-foreground)]">
            <SearchIcon />
          </span>
          <input
            ref={mobileInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcripts…"
            className="flex-1 bg-transparent text-sm text-[var(--color-foreground)] placeholder-[var(--color-muted-foreground)] outline-none"
          />
          {query && (
            <button type="submit" className="font-mono text-xs text-[var(--color-accent)]">
              Go
            </button>
          )}
        </form>
      </div>

      {/* Reading progress bar */}
      <div
        className="absolute bottom-0 left-0 h-[2px] bg-[var(--color-accent)]"
        style={{ width: `${progress * 100}%`, transition: "width 100ms linear" }}
      />
    </header>
  )
}
