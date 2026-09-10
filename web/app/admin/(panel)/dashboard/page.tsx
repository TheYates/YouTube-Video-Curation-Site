"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { listAdminVideos, type AdminVideo } from "@/lib/admin-data";

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function AdminDashboardPage() {
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [cats, setCats] = useState<string[]>(["All"]);
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setPending(false);
      setFailed(true);
      return;
    }
    listAdminVideos(sb)
      .then((rows) => {
        setVideos(rows);
        setCats(["All", ...Array.from(new Set(rows.map((r) => r.category))).sort()]);
        setPending(false);
      })
      .catch(() => {
        setPending(false);
        setFailed(true);
      });
  }, []);

  const totalWords = videos.reduce((acc, v) => acc + v.wordCount, 0);
  const totalChapters = videos.reduce((acc, v) => acc + v.chapterCount, 0);
  const recentVideos = [...videos]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 5);

  const statCards = [
    { label: "Total Videos", value: String(videos.length) },
    { label: "Categories", value: String(cats.length - 1) },
    { label: "Transcript Words", value: totalWords.toLocaleString() },
    { label: "Chapters", value: totalChapters.toLocaleString() },
  ];

  if (pending) {
    return (
      <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        Loading dashboard…
      </p>
    );
  }
  if (failed) {
    return (
      <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        Something went wrong loading dashboard data.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-sm border p-5"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
          >
            <p
              className="mb-2 font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              {card.label}
            </p>
            <p className="font-display text-4xl" style={{ color: "var(--color-foreground)" }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h2
          className="mb-4 font-mono text-xs uppercase tracking-widest"
          style={{ color: "var(--color-accent)" }}
        >
          Recent Activity
        </h2>
        <div
          className="rounded-sm border overflow-hidden"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          {recentVideos.map((video, i) => (
            <Link
              key={video.id}
              href={`/admin/videos/${video.id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-muted)]"
              style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}
            >
              <span className="font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                {formatDuration(video.durationSeconds)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm" style={{ color: "var(--color-foreground)" }}>
                  {video.title}
                </p>
                <p className="font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                  {video.channelName} · {video.wordCount.toLocaleString()} words
                </p>
              </div>
              <span
                className="rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase"
                style={{ background: "var(--color-muted)", color: "var(--color-accent)" }}
              >
                {video.category}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
