"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { curate } from "@/lib/curate-client";
import {
  listSourceChannels,
  listSearchQueries,
  listAdminVideos,
  type SourceChannelRow,
  type SearchQueryRow,
} from "@/lib/admin-data";

const CATEGORIES = ["Finance", "Tech", "Science", "Philosophy", "News", "Education", "General"];

function relative(ts: string | null): string {
  if (!ts) return "never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminSourcesPage() {
  const [channels, setChannels] = useState<SourceChannelRow[]>([]);
  const [queries, setQueries] = useState<SearchQueryRow[]>([]);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [dbMissing, setDbMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Add-channel form
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [category, setCategory] = useState("Finance");
  const [description, setDescription] = useState("");

  // Add-query form
  const [query, setQuery] = useState("");
  const [queryCategory, setQueryCategory] = useState("Finance");

  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    try {
      const [ch, qs] = await Promise.all([listSourceChannels(sb), listSearchQueries(sb)]);
      setChannels(ch);
      setQueries(qs);
      try {
        const cats = await listAdminVideos(sb);
        const live = [...new Set(cats.map((v) => v.category))].filter((c) => c && c !== "All");
        setCategories([...new Set([...live, ...CATEGORIES])]);
      } catch {
        // category enrichment is best-effort
      }
      setDbMissing(false);
    } catch {
      setDbMissing(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddChannel(e: React.FormEvent) {
    e.preventDefault();
    const cleanHandle = handle.trim().replace(/^@/, "");
    if (!cleanHandle) {
      toast.error("Channel handle is required.");
      return;
    }
    if (channels.some((c) => c.handle.toLowerCase() === cleanHandle.toLowerCase())) {
      toast.error("That channel is already on the list.");
      return;
    }
    setBusy(true);
    const res = await curate({
      action: "add-channel",
      handle: cleanHandle,
      name: name.trim() || undefined,
      category,
      description: description.trim() || undefined,
    });
    setBusy(false);
    if (!res) return;
    toast.success(`Added ${String(res.name ?? cleanHandle)} — discovery picks it up on the next run.`);
    setName("");
    setHandle("");
    setDescription("");
    load();
  }

  async function handleRemoveChannel(ch: SourceChannelRow) {
    setBusy(true);
    const res = await curate({ action: "remove-channel", id: ch.id });
    setBusy(false);
    if (!res) return;
    setChannels((prev) => prev.filter((c) => c.id !== ch.id));
    toast.success(`Removed ${ch.name}`);
  }

  async function handleToggleChannel(ch: SourceChannelRow) {
    setBusy(true);
    const res = await curate({ action: "toggle-channel", id: ch.id, enabled: !ch.enabled });
    setBusy(false);
    if (!res) return;
    setChannels((prev) => prev.map((c) => (c.id === ch.id ? { ...c, enabled: !ch.enabled } : c)));
  }

  async function handleAddQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      toast.error("Type a search query.");
      return;
    }
    setBusy(true);
    const res = await curate({ action: "add-query", query: query.trim(), category: queryCategory });
    setBusy(false);
    if (!res) return;
    toast.success("Search saved — discovery polls it on each run.");
    setQuery("");
    load();
  }

  async function handleRemoveQuery(q: SearchQueryRow) {
    setBusy(true);
    const res = await curate({ action: "remove-query", id: q.id });
    setBusy(false);
    if (!res) return;
    setQueries((prev) => prev.filter((x) => x.id !== q.id));
    toast.success("Search removed.");
  }

  async function handleToggleQuery(q: SearchQueryRow) {
    setBusy(true);
    const res = await curate({ action: "toggle-query", id: q.id, enabled: !q.enabled });
    setBusy(false);
    if (!res) return;
    setQueries((prev) => prev.map((x) => (x.id === q.id ? { ...x, enabled: !q.enabled } : x)));
  }

  const grouped = [...new Set(channels.map((c) => c.category))];
  const inputBase = {
    borderColor: "var(--color-border)",
    background: "var(--color-muted)",
    color: "var(--color-foreground)",
  };

  return (
    <div className="max-w-3xl space-y-10">
      {dbMissing && (
        <div className="rounded-sm border border-amber-500/50 bg-amber-500/10 px-4 py-3">
          <p className="text-xs leading-relaxed text-amber-700">
            The discovery tables aren&apos;t set up yet. Run the migration{" "}
            <code className="font-mono">supabase/migrations/20260914_discovery_queue.sql</code> in the
            Supabase SQL editor, then backfill the defaults with{" "}
            <code className="font-mono">npm run sources:backfill</code>.
          </p>
        </div>
      )}

      {/* ── Source channels ── */}
      <div>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
          Every run of the discovery worker polls the latest uploads of each enabled channel and
          stages new videos in the <Link href="/admin/review" className="underline hover:text-[var(--color-accent)]" style={{ color: "var(--color-foreground)" }}>review queue</Link>.
        </p>

        {loading ? (
          <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>Loading…</p>
        ) : (
          grouped.map((cat) => (
            <div key={cat} className="mb-6">
              <h2
                className="mb-3 font-mono text-xs uppercase tracking-widest"
                style={{ color: "var(--color-accent)" }}
              >
                {cat}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {channels
                  .filter((c) => c.category === cat)
                  .map((ch) => (
                    <div
                      key={ch.id}
                      className="rounded-sm border p-4 space-y-2"
                      style={{
                        borderColor: "var(--color-border)",
                        background: "var(--color-card)",
                        opacity: ch.enabled ? 1 : 0.5,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold" style={{ color: "var(--color-foreground)" }}>
                          {ch.name}
                        </p>
                        <span
                          className="shrink-0 rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase"
                          style={{ background: "var(--color-muted)", color: "var(--color-accent)" }}
                        >
                          {ch.category}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
                        {ch.description}
                      </p>
                      <p className="font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                        @{ch.handle} · last polled {relative(ch.lastDiscoveredAt)}
                      </p>
                      <div className="flex items-center gap-3 pt-1">
                        <a
                          href={`https://www.youtube.com/channel/${ch.channelId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)]"
                          style={{ color: "var(--color-foreground)" }}
                        >
                          Browse →
                        </a>
                        <button
                          onClick={() => handleToggleChannel(ch)}
                          disabled={busy}
                          className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)] disabled:opacity-40"
                          style={{ color: "var(--color-muted-foreground)" }}
                        >
                          {ch.enabled ? "Pause" : "Resume"}
                        </button>
                        <button
                          onClick={() => handleRemoveChannel(ch)}
                          disabled={busy}
                          className="ml-auto font-mono text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}

        <div
          className="rounded-sm border p-5 space-y-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          <label
            className="block font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Add Channel
          </label>
          <form onSubmit={handleAddChannel} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Channel name (optional)"
              className="rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
              style={inputBase}
            />
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@channelname"
              className="rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
              style={inputBase}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
              style={inputBase}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One line — why it's good for Signal"
              className="rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
              style={inputBase}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-sm px-5 py-2.5 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40 sm:col-span-2"
              style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
            >
              Add Channel
            </button>
          </form>
        </div>
      </div>

      {/* ── Saved searches ── */}
      <div className="border-t pt-8" style={{ borderColor: "var(--color-border)" }}>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
          Saved searches are polled each run (newest matches only, via{" "}
          <code className="font-mono">publishedAfter</code>). Each costs ~100 YouTube quota units, so
          keep the list small.
        </p>

        {queries.length > 0 && (
          <div className="mb-5 space-y-2">
            {queries.map((q) => (
              <div
                key={q.id}
                className="flex items-center gap-3 rounded-sm border px-4 py-2.5"
                style={{
                  borderColor: "var(--color-border)",
                  background: "var(--color-card)",
                  opacity: q.enabled ? 1 : 0.5,
                }}
              >
                <span
                  className="shrink-0 rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase"
                  style={{ background: "var(--color-muted)", color: "var(--color-accent)" }}
                >
                  {q.category}
                </span>
                <span className="truncate text-sm" style={{ color: "var(--color-foreground)" }}>
                  {q.query}
                </span>
                <span className="ml-auto shrink-0 font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                  polled {relative(q.lastPolledAt)}
                </span>
                <button
                  onClick={() => handleToggleQuery(q)}
                  disabled={busy}
                  className="shrink-0 font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)] disabled:opacity-40"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  {q.enabled ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => handleRemoveQuery(q)}
                  disabled={busy}
                  className="shrink-0 font-mono text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className="rounded-sm border p-5 space-y-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          <label
            className="block font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Add Saved Search
          </label>
          <form onSubmit={handleAddQuery} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. monetary policy explained"
              className="rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
              style={inputBase}
            />
            <select
              value={queryCategory}
              onChange={(e) => setQueryCategory(e.target.value)}
              className="rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
              style={inputBase}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="rounded-sm px-5 py-2.5 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40 sm:col-span-2"
              style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
            >
              Save Search
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
