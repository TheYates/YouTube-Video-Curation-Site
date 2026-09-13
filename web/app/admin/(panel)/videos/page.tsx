"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { listAdminVideos, type AdminVideo } from "@/lib/admin-data";
import ThumbImage from "@/components/thumb-image";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const PAGE_SIZE = 10;

const RELAY_URL = process.env.NEXT_PUBLIC_INGEST_RELAY_URL ?? "http://127.0.0.1:8917";

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [cats, setCats] = useState<string[]>(["All"]);
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const filtered = useMemo(
    () =>
      videos.filter((v) => {
        const matchSearch =
          !search ||
          v.title.toLowerCase().includes(search.toLowerCase()) ||
          v.channelName.toLowerCase().includes(search.toLowerCase());
        const matchCat = category === "All" || v.category === category;
        return matchSearch && matchCat;
      }),
    [videos, search, category]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Real delete via the local relay (service role): removes the videos row
  // (Postgres cascades transcript/chapters/links/views) plus Storage frames.
  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`${RELAY_URL}/video-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Delete failed (HTTP ${res.status})`);
      setVideos((prev) => prev.filter((v) => v.id !== id));
      setConfirmDelete(null);
      toast.success("Video deleted from the library");
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `${e.message} — is the relay running (npm run ingest:serve)?`
          : "Delete failed."
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (pending) {
    return (
      <div className="py-20 text-center">
        <p
          className="font-mono text-xs uppercase tracking-widest"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          Loading videos…
        </p>
      </div>
    );
  }
  if (failed) {
    return (
      <div className="py-20 text-center">
        <p
          className="font-mono text-xs uppercase tracking-widest"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          Something went wrong loading videos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title or channel…"
            className="w-full rounded-sm border py-2 pl-9 pr-4 text-sm outline-none transition-colors"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-muted)",
              color: "var(--color-foreground)",
            }}
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="rounded-sm border px-3 py-2 text-sm outline-none"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-muted)",
            color: "var(--color-foreground)",
          }}
        >
          {cats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
          {filtered.length} video{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        className="rounded-sm border overflow-hidden"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        {paged.length === 0 ? (
          <div className="py-20 text-center">
            <p
              className="font-mono text-xs uppercase tracking-widest"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              No videos match your filters
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["Video", "Category", "Duration", "Published", "Links", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((video, i) => (
                <tr
                  key={video.id}
                  className="transition-colors hover:bg-[var(--color-muted)]"
                  style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ThumbImage
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="h-9 w-14 shrink-0 rounded-sm object-cover"
                      />
                      <div className="min-w-0">
                        <p
                          className="truncate max-w-xs font-medium"
                          style={{ color: "var(--color-foreground)" }}
                        >
                          {video.title}
                        </p>
                        <p className="font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                          {video.channelName}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                      style={{ background: "var(--color-muted)", color: "var(--color-accent)" }}
                    >
                      {video.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    {formatDuration(video.durationSeconds)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    {formatDate(video.publishedAt)}
                  </td>
                  <td className="px-4 py-3">
                    {video.affiliateCount ? (
                      <span
                        className="rounded-sm px-2 py-0.5 font-mono text-[10px]"
                        style={{ background: "var(--color-muted)", color: "var(--color-foreground)" }}
                      >
                        {video.affiliateCount}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px]" style={{ color: "var(--color-border)" }}>
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/videos/${video.id}`}
                        className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)]"
                        style={{ color: "var(--color-muted-foreground)" }}
                      >
                        Edit
                      </Link>
                      <span style={{ color: "var(--color-border)" }}>·</span>
                      <a
                        href={`/video/${video.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)]"
                        style={{ color: "var(--color-muted-foreground)" }}
                      >
                        View ↗
                      </a>
                      <span style={{ color: "var(--color-border)" }}>·</span>
                      {confirmDelete === video.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(video.id)}
                            disabled={deletingId === video.id}
                            className="font-mono text-xs text-red-600 hover:underline disabled:opacity-40"
                          >
                            {deletingId === video.id ? "Deleting…" : "Confirm"}
                          </button>
                          <span style={{ color: "var(--color-border)" }}>·</span>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            disabled={deletingId === video.id}
                            className="font-mono text-xs transition-colors hover:text-[var(--color-foreground)] disabled:opacity-40"
                            style={{ color: "var(--color-muted-foreground)" }}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(video.id)}
                          className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-red-600"
                          style={{ color: "var(--color-muted-foreground)" }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="font-mono text-xs uppercase tracking-wide disabled:opacity-30"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            ← Prev
          </button>
          <span className="font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="font-mono text-xs uppercase tracking-wide disabled:opacity-30"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
