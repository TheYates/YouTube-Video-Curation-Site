"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { curate } from "@/lib/curate-client";
import { listCandidates, type VideoCandidate } from "@/lib/admin-data";

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
  onDecide: (id: string, approve: boolean) => void;
  busy: boolean;
}) {
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
          width={168}
          height={94}
          className="rounded-sm object-cover"
          style={{ width: 168, height: 94 }}
        />
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <a
            href={`https://www.youtube.com/watch?v=${c.youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold leading-snug hover:text-[var(--color-accent)] transition-colors"
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
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => onDecide(c.id, true)}
            disabled={busy}
            className="rounded-sm px-4 py-1.5 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
          >
            Approve
          </button>
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

export default function AdminReviewPage() {
  const [pending, setPending] = useState<VideoCandidate[]>([]);
  const [decided, setDecided] = useState<VideoCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbMissing, setDbMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showDecided, setShowDecided] = useState(false);

  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    try {
      const [p, d] = await Promise.all([
        listCandidates(sb, ["pending"], 200),
        listCandidates(sb, ["approved", "rejected", "ingested", "failed"], 50),
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

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    const res = await curate({ action: approve ? "approve-candidate" : "reject-candidate", id });
    setBusyId(null);
    if (!res) return; // toast already shown
    const moved = pending.find((c) => c.id === id);
    setPending((prev) => prev.filter((c) => c.id !== id));
    if (moved) {
      setDecided((prev) => [
        { ...moved, status: approve ? "approved" : "rejected" },
        ...prev,
      ]);
    }
    // Sidebar badge listens for this and re-counts the queue.
    window.dispatchEvent(new CustomEvent("signal:queue-updated"));
    toast.success(approve ? "Approved — the next scheduled run (or npm run auto) will ingest it." : "Rejected.");
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

  return (
    <div className="max-w-3xl space-y-8">
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
        Videos discovered from your source channels, saved searches, and related-video mining.
        Nothing goes public until you approve it — the scheduled auto-pipeline ingests approved
        candidates on your machine (<code className="font-mono">npm run auto</code>).
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
          <div className="space-y-3">
            {pending.map((c) => (
              <CandidateCard key={c.id} c={c} onDecide={decide} busy={busyId === c.id} />
            ))}
          </div>
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
            <div className="space-y-2">
              {decided.map((c) => {
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
          )}
        </div>
      )}
    </div>
  );
}
