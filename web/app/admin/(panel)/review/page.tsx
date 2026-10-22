"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { curate } from "@/lib/curate-client";
import { listCandidates, listDecidedCandidates, type VideoCandidate } from "@/lib/admin-data";

const PAGE_SIZE = 20;

function Pager({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-foreground)] disabled:opacity-30"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        ← Prev
      </button>
      <span className="font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        {page} / {pageCount}
      </span>
      <button
        onClick={() => onPage(Math.min(pageCount, page + 1))}
        disabled={page >= pageCount}
        className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-foreground)] disabled:opacity-30"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        Next →
      </button>
      <span className="font-mono text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
        {from}–{to} of {total}
      </span>
    </div>
  );
}

const fmtDuration = (s: number) => {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
};

const VIA_LABEL: Record<string, string> = {
  channel: "Source channel",
  search: "Saved search",
  related: "Related mining",
};

function CandidateCard({
  c,
  onDecide,
  busy,
}: {
  c: VideoCandidate;
  onDecide: (id: string, approve: boolean, publishAt?: string | null) => void;
  busy: boolean;
}) {
  const [publishAt, setPublishAt] = useState("");
  return (
    <div
      className="rounded-sm border p-4 flex gap-4"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      <a
        href={`https://www.youtube.com/watch?v=${c.youtubeId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 self-start"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={c.thumbnailUrl || `https://i.ytimg.com/vi/${c.youtubeId}/mqdefault.jpg`}
          alt=""
          width={144}
          height={81}
          className="rounded-sm object-cover"
          style={{ width: 144, height: 81 }}
        />
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <a
            href={`https://www.youtube.com/watch?v=${c.youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 text-sm font-bold leading-snug hover:text-[var(--color-accent)] transition-colors"
            style={{ color: "var(--color-foreground)" }}
          >
            {c.title}
          </a>
          <span
            className="shrink-0 rounded-sm px-2 py-0.5 font-mono text-xs font-bold"
            style={{
              background:
                c.score >= 7
                  ? "var(--color-accent)"
                  : c.score >= 4
                    ? "var(--color-muted)"
                    : "var(--color-muted)",
              color: c.score >= 7 ? "var(--color-accent-foreground)" : "var(--color-accent)",
            }}
            title="AI relevance score 0–10"
          >
            {c.score.toFixed(1)}
          </span>
        </div>
        <p className="mt-1 font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
          {c.channelName ?? "unknown channel"} · {fmtDuration(c.durationSeconds)}
          {c.publishedAt ? ` · ${c.publishedAt}` : ""} · {VIA_LABEL[c.discoveredVia] ?? c.discoveredVia}
          {c.suggestedCategory && c.suggestedCategory !== "General" ? ` → ${c.suggestedCategory}` : ""}
        </p>
        {c.reason && (
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
            {c.reason}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            onClick={() => onDecide(c.id, true, publishAt || null)}
            disabled={busy}
            className="rounded-sm px-4 py-1.5 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
          >
            Approve
          </button>
          <label
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide"
            style={{ color: "var(--color-muted-foreground)" }}
            title="Optional: hold this video until the chosen day (blank = publish on the next auto run)"
          >
            Publish on
            <input
              type="date"
              value={publishAt}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setPublishAt(e.target.value)}
              disabled={busy}
              className="rounded-sm border px-2 py-1 font-mono text-xs disabled:opacity-40"
              style={{ borderColor: "var(--color-border)", background: "var(--color-card)", color: "var(--color-foreground)" }}
            />
          </label>
          <button
            onClick={() => onDecide(c.id, false)}
            disabled={busy}
            className="font-mono text-xs uppercase tracking-widest transition-colors hover:text-red-600 disabled:opacity-40"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Reject
          </button>
          <a
            href={`https://www.youtube.com/watch?v=${c.youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto font-mono text-xs transition-colors hover:text-[var(--color-accent)]"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Open on YouTube →
          </a>
        </div>
      </div>
    </div>
  );
}

// Inline reschedule control for an already-approved candidate. Edits stay local
// until Save so a date picker doesn't fire an API call per keystroke; Clear
// removes the hold (the row then publishes on the next auto run).
function ScheduleControl({
  c,
  onSave,
  busy,
}: {
  c: VideoCandidate;
  onSave: (id: string, publishAt: string | null) => void;
  busy: boolean;
}) {
  const saved = c.publishAt ? c.publishAt.slice(0, 10) : "";
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);
  const dirty = value !== saved;
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <label
        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide"
        style={{ color: "var(--color-muted-foreground)" }}
        title="Hold until this day; leave blank to publish on the next run"
      >
        Publish on
        <input
          type="date"
          value={value}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
          className="rounded-sm border px-1.5 py-0.5 font-mono text-[10px] disabled:opacity-40"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)", color: "var(--color-foreground)" }}
        />
      </label>
      {dirty ? (
        <button
          onClick={() => onSave(c.id, value || null)}
          disabled={busy}
          className="font-mono text-[10px] uppercase tracking-wide hover:text-[var(--color-accent)] disabled:opacity-40"
          style={{ color: "var(--color-accent)" }}
        >
          Save
        </button>
      ) : (
        c.publishAt && (
          <button
            onClick={() => onSave(c.id, null)}
            disabled={busy}
            className="font-mono text-[10px] uppercase tracking-wide hover:text-[var(--color-accent)] disabled:opacity-40"
            style={{ color: "var(--color-muted-foreground)" }}
            title="Clear the hold — publish on the next run"
          >
            Clear
          </button>
        )
      )}
    </div>
  );
}

export default function AdminReviewPage() {
  const [pending, setPending] = useState<VideoCandidate[]>([]);
  const [decided, setDecided] = useState<VideoCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbMissing, setDbMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showDecided, setShowDecided] = useState(false);
  const [page, setPage] = useState(1);
  const [decidedPage, setDecidedPage] = useState(1);

  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    try {
      const [p, d] = await Promise.all([
        listCandidates(sb, ["pending"], 1000),
        listDecidedCandidates(sb, ["approved", "rejected", "ingested", "failed"], 200),
      ]);
      setPending(p);
      setDecided(d);
      setDbMissing(false);
    } catch {
      // Migration not run yet (tables missing) — show setup hint.
      setDbMissing(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, approve: boolean, publishAt: string | null = null) {
    setBusyId(id);
    const res = await curate(
      approve
        ? { action: "approve-candidate", id, publish_at: publishAt }
        : { action: "reject-candidate", id }
    );
    setBusyId(null);
    if (!res) return; // toast already shown
    const moved = pending.find((c) => c.id === id);
    setPending((prev) => prev.filter((c) => c.id !== id));
    if (moved) {
      setDecided((prev) => [
        { ...moved, status: approve ? "approved" : "rejected", publishAt: approve ? publishAt : moved.publishAt },
        ...prev,
      ]);
    } else {
      // Re-deciding a row already in the decided list (e.g. Retry on a failed
      // ingest): reflect the new status in place. The function resets attempts,
      // so mirror it here too.
      setDecided((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: approve ? "approved" : "rejected",
                publishAt: approve ? publishAt : c.publishAt,
                attempts: approve ? 0 : c.attempts,
                reason: approve ? "" : c.reason,
              }
            : c
        )
      );
    }
    // Sidebar badge listens for this and re-counts the queue.
    window.dispatchEvent(new CustomEvent("signal:queue-updated"));
    toast.success(
      approve
        ? publishAt
          ? `Approved — scheduled to publish on ${publishAt}.`
          : "Approved — the next scheduled run (or npm run auto) will ingest it."
        : "Rejected."
    );
  }

  async function reschedule(id: string, publishAt: string | null) {
    setBusyId(id);
    const res = await curate({ action: "set-publish-at", id, publish_at: publishAt });
    setBusyId(null);
    if (!res) return; // toast already shown
    const next = (res.publish_at as string | null) ?? null;
    setDecided((prev) => prev.map((c) => (c.id === id ? { ...c, publishAt: next } : c)));
    toast.success(next ? `Scheduled for ${next.slice(0, 10)}.` : "Hold cleared — publishes on the next run.");
  }

  const statusBadge = (s: VideoCandidate["status"]) => {
    const map: Record<VideoCandidate["status"], { label: string; color: string }> = {
      pending: { label: "pending", color: "var(--color-muted-foreground)" },
      approved: { label: "approved — awaiting ingest", color: "var(--color-accent)" },
      ingested: { label: "published", color: "var(--color-foreground)" },
      rejected: { label: "rejected", color: "var(--color-muted-foreground)" },
      failed: { label: "ingest failed ×3", color: "#dc2626" },
    };
    return map[s];
  };

  // Client-side paging (matches /admin/videos). Clamp so deciding the last card
  // on the last page doesn't strand the view on an empty page.
  const pendingPages = Math.max(1, Math.ceil(pending.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pendingPages);
  const pagedPending = pending.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const decidedPages = Math.max(1, Math.ceil(decided.length / PAGE_SIZE));
  const decidedPageSafe = Math.min(decidedPage, decidedPages);
  const pagedDecided = decided.slice((decidedPageSafe - 1) * PAGE_SIZE, decidedPageSafe * PAGE_SIZE);

  return (
    <div className="max-w-6xl space-y-8">
      <p
        className="max-w-3xl text-sm leading-relaxed"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        Videos discovered from your source channels, saved searches, and related-video mining.
        Nothing goes public until you approve it — the scheduled auto-pipeline ingests approved
        candidates on your machine (<code className="font-mono">npm run auto</code>). Approve
        with a date to hold a video for your publishing calendar; leave it blank to publish on
        the next run.
      </p>

      {dbMissing && (
        <div className="rounded-sm border border-amber-500/50 bg-amber-500/10 px-4 py-3">
          <p className="text-xs leading-relaxed text-amber-700">
            The discovery tables aren&apos;t set up yet. Run the migration{" "}
            <code className="font-mono">supabase/migrations/20260914_discovery_queue.sql</code> in the
            Supabase SQL editor, then backfill your source channels with{" "}
            <code className="font-mono">npm run sources:backfill</code>.
          </p>
        </div>
      )}

      <div>
        <h2
          className="mb-4 font-mono text-xs uppercase tracking-widest"
          style={{ color: "var(--color-accent)" }}
        >
          Pending review {pending.length > 0 && `(${pending.length})`}
        </h2>
        {loading ? (
          <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
            Loading…
          </p>
        ) : pending.length === 0 ? (
          <div
            className="rounded-sm border px-4 py-6 text-sm"
            style={{ borderColor: "var(--color-border)", background: "var(--color-muted)", color: "var(--color-muted-foreground)" }}
          >
            Queue is empty. Run <code className="font-mono">npm run discover</code> (or wait for the
            scheduled run) to fetch new candidates.
          </div>
        ) : (
          <>
            <div className="grid gap-3 xl:grid-cols-2">
              {pagedPending.map((c) => (
                <CandidateCard key={c.id} c={c} onDecide={decide} busy={busyId === c.id} />
              ))}
            </div>
            <Pager
              page={pageSafe}
              pageCount={pendingPages}
              total={pending.length}
              onPage={setPage}
            />
          </>
        )}
      </div>

      {!loading && decided.length > 0 && (
        <div className="border-t pt-6" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={() => setShowDecided((v) => !v)}
            className="mb-3 font-mono text-xs uppercase tracking-widest transition-colors hover:text-[var(--color-accent)]"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            {showDecided ? "Hide" : "Show"} recent decisions ({decided.length})
          </button>
          {showDecided && (
            <>
              <div className="space-y-2">
                {pagedDecided.map((c) => {
                const badge = statusBadge(c.status);
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-sm border px-4 py-2.5"
                    style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
                  >
                    <span className="font-mono text-[10px] uppercase shrink-0" style={{ color: badge.color }}>
                      {badge.label}
                    </span>
                    <a
                      href={`https://www.youtube.com/watch?v=${c.youtubeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm hover:text-[var(--color-accent)] transition-colors"
                      style={{ color: "var(--color-foreground)" }}
                    >
                      {c.title}
                    </a>
                    {c.status === "approved" && (
                      <ScheduleControl c={c} onSave={reschedule} busy={busyId === c.id} />
                    )}
                    {c.status === "failed" && c.reason && (
                      <span
                        className="hidden md:inline truncate text-xs"
                        style={{ color: "var(--color-muted-foreground)" }}
                        title={c.reason}
                      >
                        {c.reason}
                      </span>
                    )}
                    {c.status === "failed" && (
                      <button
                        onClick={() => decide(c.id, true)}
                        disabled={busyId === c.id}
                        className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-wide hover:text-[var(--color-accent)] disabled:opacity-40"
                        style={{ color: "var(--color-muted-foreground)" }}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                );
              })}
              </div>
              <Pager
                page={decidedPageSafe}
                pageCount={decidedPages}
                total={decided.length}
                onPage={setDecidedPage}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
