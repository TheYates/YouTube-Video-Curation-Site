"use client";

import Link from "next/link";
import { categorySlug } from "../lib/category";

// Controlled component: VideoFeed owns the active category so the homepage can
// stay statically rendered, and a plain left-click is intercepted to filter in
// place. The href still points at the real category hub page, which is what
// lets crawlers discover /category/* from the homepage — the filtered view
// exists only in the DOM and exposes no new URL to follow.
export default function CategoryTabs({
  categories,
  active,
  onSelect,
}: {
  categories: string[];
  active: string;
  onSelect: (category: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-px">
      {categories.map((cat) => {
        const href = cat === "All" ? "/" : `/category/${categorySlug(cat)}`;
        return (
          <Link
            key={cat}
            href={href}
            onClick={(e) => {
              // Let modified clicks open a new tab/window as usual.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              onSelect(cat);
            }}
            className={[
              "shrink-0 rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors",
              active === cat
                ? "bg-(--color-accent) text-(--color-accent-foreground)"
                : "text-(--color-muted-foreground) hover:text-(--color-foreground)",
            ].join(" ")}
          >
            {cat}
          </Link>
        );
      })}
    </div>
  );
}
