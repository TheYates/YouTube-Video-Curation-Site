"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import {
  getPageViewStats,
  listAdminVideos,
  type AdminVideo,
  type PageViewStats,
} from "@/lib/admin-data";
import ThumbImage from "@/components/thumb-image";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function AdminAnalyticsPage() {
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [views, setViews] = useState<PageViewStats>({
    viewsByVideo: {},
    totalViews: 0,
    viewsLast30d: 0,
    trackingLive: false,
  });
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setPending(false);
      setFailed(true);
      return;
    }
    Promise.all([listAdminVideos(sb), getPageViewStats(sb)])
      .then(([rows, stats]) => {
        setVideos(rows);
        setViews(stats);
        setPending(false);
      })
      .catch(() => {
        setPending(false);
        setFailed(true);
      });
  }, []);

  const totalWords = videos.reduce((acc, v) => acc + v.wordCount, 0);
  const totalChapters = videos.reduce((acc, v) => acc + v.chapterCount, 0);
  const recentVideos = videos.filter(
    (v) => Date.now() - new Date(v.publishedAt).getTime() < THIRTY_DAYS_MS
  ).length;

  const statTiles = [
    {
      label: "Total Views",
      value: views.totalViews.toLocaleString(),
      delta: views.trackingLive
        ? `${views.viewsLast30d.toLocaleString()} in last 30 days`
        : "tracking not set up yet",
    },
    {
      label: "Total Videos",
      value: String(videos.length),
      delta:
        recentVideos > 0
          ? `+${recentVideos} published in last 30 days`
          : "no new videos in 30 days",
    },
    {
      label: "Transcript Words",
      value: totalWords.toLocaleString(),
      delta: videos.length
        ? `avg ${Math.round(totalWords / videos.length).toLocaleString()}/video`
        : "no videos yet",
    },
    {
      label: "Chapters",
      value: String(totalChapters),
      delta: totalChapters ? `across ${videos.length} videos` : "no chapters yet",
    },
  ];

  const categoryMap: Record<string, number> = {};
  for (const v of videos) {
    categoryMap[v.category] = (categoryMap[v.category] ?? 0) + 1;
  }
  const categoryCounts = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...categoryCounts.map(([, n]) => n));

  const topVideos = [...videos]
    .sort((a, b) => (views.viewsByVideo[b.id] ?? 0) - (views.viewsByVideo[a.id] ?? 0))
    .slice(0, 5);

  if (pending) {
    return (
      <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        Loading analytics…
      </p>
    );
  }
  if (failed) {
    return (
      <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        Something went wrong loading analytics.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {!views.trackingLive && (
        <div className="rounded-sm border border-amber-500/50 bg-amber-500/10 px-4 py-3">
          <p className="text-xs leading-relaxed text-amber-700">
            View tracking isn’t set up yet — run{" "}
            <code className="font-mono">supabase/migrations/20260908_page_views.sql</code> in the
            Supabase SQL editor. Views start accumulating from the next video page visit.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statTiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-sm border p-5"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
          >
            <p
              className="mb-2 font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              {tile.label}
            </p>
            <p className="font-display text-3xl" style={{ color: "var(--color-foreground)" }}>
              {tile.value}
            </p>
            <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--color-accent)" }}>
              {tile.delta}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2
            className="mb-5 font-mono text-xs uppercase tracking-widest"
            style={{ color: "var(--color-accent)" }}
          >
            Videos by Category
          </h2>
          <div
            className="rounded-sm border p-5 space-y-4"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
          >
            {categoryCounts.length === 0 && (
              <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                No videos yet — ingest one to see the breakdown.
              </p>
            )}
            {categoryCounts.map(([cat, count]) => (
              <div key={cat}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-mono text-xs" style={{ color: "var(--color-foreground)" }}>
                    {cat}
                  </span>
                  <span className="font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    {count} video{count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-muted)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(count / maxCat) * 100}%`, background: "var(--color-accent)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2
            className="mb-5 font-mono text-xs uppercase tracking-widest"
            style={{ color: "var(--color-accent)" }}
          >
            Top Videos by Views
          </h2>
          <div
            className="rounded-sm border overflow-hidden"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
          >
            {topVideos.length === 0 && (
              <p className="px-4 py-6 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                No videos yet.
              </p>
            )}
            {topVideos.map((video, i) => (
              <Link
                key={video.id}
                href={`/admin/videos/${video.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-muted)]"
                style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}
              >
                <span
                  className="w-5 shrink-0 font-display text-lg leading-none text-right"
                  style={{ color: i === 0 ? "var(--color-accent)" : "var(--color-border)" }}
                >
                  {i + 1}
                </span>
                <ThumbImage
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="h-9 w-14 shrink-0 rounded-sm object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm" style={{ color: "var(--color-foreground)" }}>
                    {video.title}
                  </p>
                  <span className="font-mono text-[10px] uppercase" style={{ color: "var(--color-accent)" }}>
                    {video.category}
                  </span>
                </div>
                <span
                  className="shrink-0 font-mono text-xs tabular-nums"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  {(views.viewsByVideo[video.id] ?? 0).toLocaleString()} views
                </span>
              </Link>
            ))}
          </div>
          {views.trackingLive && views.totalViews === 0 && topVideos.length > 0 && (
            <p className="mt-2 font-mono text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
              Tracking is live — open any video page and these counts start moving.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
