"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchForm({ initialQuery = "" }: { initialQuery?: string }) {
  const [value, setValue] = useState(initialQuery);
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim()) {
      router.push(`/search?q=${encodeURIComponent(value.trim())}`);
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-3">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search every word of every transcript…"
        className="flex-1 rounded-sm border border-(--color-border) bg-(--color-muted) px-4 py-3 text-sm text-(--color-foreground) placeholder-(--color-muted-foreground) outline-none transition-colors focus:border-(--color-accent)"
        autoFocus
      />
      <button
        type="submit"
        className="rounded-sm bg-(--color-accent) px-6 py-3 font-mono text-xs uppercase tracking-widest text-(--color-accent-foreground) transition-opacity hover:opacity-80"
      >
        Search
      </button>
    </form>
  );
}
