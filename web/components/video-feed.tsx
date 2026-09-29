"use client";

import { useCallback, useEffect, useState } from "react";
import type { Video } from "../lib/types";
import CategoryTabs from "./category-tabs";
import VideoCard from "./video-card";

// The feed is a client island so the homepage can stay statically rendered
// with ISR instead of re-rendering on every crawler hit (see
// app/(public)/page.tsx). Every card is present in the server-rendered HTML,
// so Google still sees all video links — filtering only hides them in the DOM
// after hydration.
export default function VideoFeed({
  videos,
  categories,
}: {
  videos: Video[];
  categories: string[];
}) {
  const [active, setActive] = useState("All");

  // ?category= is read on mount and mirrored with replaceState rather than
  // taken from the server, so old and shared links (/?category=Tech) keep
  // working without dragging the route back into dynamic rendering.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("category");
    if (param && categories.includes(param)) setActive(param);
  }, [categories]);

  const select = useCallback((cat: string) => {
    setActive(cat);
    const url = new URL(window.location.href);
    if (cat === "All") url.searchParams.delete("category");
    else url.searchParams.set("category", cat);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const filtered = active === "All" ? videos : videos.filter((v) => v.category === active);

  return (
    <>
      <div className="mb-8">
        <CategoryTabs categories={categories} active={active} onSelect={select} />
      </div>

      <div>
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-(--color-muted-foreground)">
            No videos in this category yet.
          </p>
        ) : (
          filtered.map((video) => <VideoCard key={video.id} video={video} />)
        )}
      </div>
    </>
  );
}
