"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function SiteHeader() {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Reading progress belongs to long-form video pages only.
  const showProgress = pathname.startsWith("/video/");

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) mobileInputRef.current?.focus();
  }, [searchOpen]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery("");
      setSearchOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-(--color-border) bg-(--color-background)/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
        <Link href="/" className="shrink-0">
          <span className="font-display text-xl font-normal tracking-tight text-(--color-foreground)">
            Signal<span className="text-(--color-accent)">.</span>
          </span>
        </Link>

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="hidden flex-1 items-center sm:flex">
          <div className="relative w-full max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--color-muted-foreground)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transcripts…"
              className="w-full rounded-sm border border-(--color-border) bg-(--color-muted) py-2 pl-9 pr-4 text-sm text-(--color-foreground) placeholder-(--color-muted-foreground) outline-none transition-colors focus:border-(--color-accent)"
            />
          </div>
        </form>

        <div className="flex flex-1 items-center justify-end gap-3 sm:flex-none sm:justify-start">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center text-(--color-muted-foreground) transition-colors hover:text-(--color-foreground) sm:hidden"
            aria-label="Search"
          >
            {searchOpen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            )}
          </button>

          <nav className="hidden items-center gap-6 text-sm text-(--color-muted-foreground) sm:flex">
            <Link href="/" className="transition-colors hover:text-(--color-foreground)">
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
        className="border-t border-(--color-border) sm:hidden"
      >
        <form onSubmit={handleSearch} className="flex items-center gap-3 px-6 py-3">
          <span className="text-(--color-muted-foreground)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <input
            ref={mobileInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcripts…"
            className="flex-1 bg-transparent text-sm text-(--color-foreground) placeholder-(--color-muted-foreground) outline-none"
          />
          {query && (
            <button type="submit" className="font-mono text-xs text-(--color-accent)">
              Go
            </button>
          )}
        </form>
      </div>

      {/* Reading progress bar — video pages only, inset from the viewport edges */}
      {showProgress && (
        <div
          className="absolute bottom-0 left-6 right-6 h-[2px] rounded-full bg-(--color-accent)"
          style={{ width: `calc(${progress * 100}% - ${progress * 48}px)`, transition: "width 100ms linear" }}
        />
      )}
    </header>
  );
}
