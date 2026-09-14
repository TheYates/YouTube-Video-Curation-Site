"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { getAdminCategories, listAdminVideos } from "@/lib/admin-data";
import AdminSkeleton from "@/components/admin-skeleton";

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState<string[] | null>(null);
  const [base, setBase] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newCat, setNewCat] = useState("");
  const [pending, setPending] = useState(true);
  const [threshold, setThreshold] = useState("3");
  const [thresholdSaved, setThresholdSaved] = useState("3");
  const [savingThreshold, setSavingThreshold] = useState(false);

  const RELAY_URL =
    process.env.NEXT_PUBLIC_INGEST_RELAY_URL ?? "http://127.0.0.1:8931";

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setPending(false);
      return;
    }
    Promise.all([
      getAdminCategories(sb),
      listAdminVideos(sb),
      sb.from("app_settings").select("value").eq("key", "min_category_videos").maybeSingle(),
    ])
      .then(([c, videos, setting]) => {
        const b = c.filter((x) => x !== "All");
        setBase(b);
        const m: Record<string, number> = {};
        for (const v of videos) m[v.category] = (m[v.category] ?? 0) + 1;
        setCounts(m);
        const current = (setting.data as { value: string } | null)?.value ?? "3";
        setThreshold(current);
        setThresholdSaved(current);
        setPending(false);
      })
      .catch(() => setPending(false));
  }, []);

  async function saveThreshold() {
    const n = Number(threshold);
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      toast.error("Threshold must be a whole number between 1 and 20.");
      return;
    }
    setSavingThreshold(true);
    try {
      const res = await fetch(`${RELAY_URL}/setting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "min_category_videos", value: String(n) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Save failed (HTTP ${res.status})`);
      setThresholdSaved(String(n));
      toast.success(`Public sections now need ${n}+ videos`);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `${e.message} — is the relay running (npm run ingest:serve)?`
          : "Save failed."
      );
    } finally {
      setSavingThreshold(false);
    }
  }

  const list = cats ?? base;

  function startEdit(cat: string) {
    setEditing(cat);
    setEditValue(cat);
  }

  function confirmEdit(oldName: string) {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    if (list.includes(trimmed) && trimmed !== oldName) {
      toast.error("A category with that name already exists.");
      return;
    }
    setCats(list.map((c) => (c === oldName ? trimmed : c)));
    setEditing(null);
    toast.success(`Renamed to “${trimmed}”`);
  }

  function handleDelete(cat: string) {
    if ((counts[cat] ?? 0) > 0) return;
    setCats(list.filter((c) => c !== cat));
    toast.success(`Deleted “${cat}”`);
  }

  function handleAdd() {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (list.includes(trimmed)) {
      toast.error("Category already exists.");
      return;
    }
    setCats([...list, trimmed]);
    setNewCat("");
    toast.success(`Added “${trimmed}”`);
  }

  if (pending) {
    return <AdminSkeleton variant="list" />;
  }

  return (
    <div className="max-w-lg space-y-8">
      <div
        className="rounded-sm border overflow-hidden"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        {list.length === 0 ? (
          <p className="py-10 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
            No categories yet.
          </p>
        ) : (
          list.map((cat, i) => {
            const count = counts[cat] ?? 0;
            const isEditing = editing === cat;
            return (
              <div
                key={cat}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-muted)]"
                style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}
              >
                <span
                  className="flex-shrink-0 cursor-grab select-none text-lg leading-none"
                  style={{ color: "var(--color-border)" }}
                >
                  ⠿
                </span>

                {isEditing ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmEdit(cat);
                        if (e.key === "Escape") setEditing(null);
                      }}
                      className="flex-1 rounded-sm border px-3 py-1.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
                      style={{
                        borderColor: "var(--color-border)",
                        background: "var(--color-muted)",
                        color: "var(--color-foreground)",
                      }}
                    />
                    <button
                      onClick={() => confirmEdit(cat)}
                      className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)]"
                      style={{ color: "var(--color-muted-foreground)" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="font-mono text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                      {cat}
                    </span>
                    <span
                      className="rounded-sm px-2 py-0.5 font-mono text-[10px]"
                      style={{ background: "var(--color-muted)", color: "var(--color-accent)" }}
                    >
                      {count} video{count !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => startEdit(cat)}
                      className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)]"
                      style={{ color: "var(--color-muted-foreground)" }}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      disabled={count > 0}
                      title={count > 0 ? "Remove all videos first" : "Delete category"}
                      className="font-mono text-xs text-red-500 transition-colors hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      <div>
        <label
          className="mb-2 block font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          Add Category
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="e.g. Psychology"
            className="flex-1 rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-muted)",
              color: "var(--color-foreground)",
            }}
          />
          <button
            onClick={handleAdd}
            disabled={!newCat.trim()}
            className="rounded-sm px-5 py-2.5 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
          >
            Add
          </button>
        </div>
      </div>

      <div
        className="rounded-sm border p-5 space-y-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <label
          className="block font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          Public sections threshold
        </label>
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
          A category earns a homepage tab once it holds this many videos. Thin sections stay
          reachable by URL, search, and related videos. Requires the local relay.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={20}
            step={1}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-20 rounded-sm border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-muted)",
              color: "var(--color-foreground)",
            }}
          />
          <button
            onClick={saveThreshold}
            disabled={savingThreshold || threshold === thresholdSaved}
            className="rounded-sm px-5 py-2 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
          >
            {savingThreshold ? "Saving…" : "Save"}
          </button>
          <span className="font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
            currently {thresholdSaved}
          </span>
        </div>
      </div>

      <div
        className="rounded-sm border px-4 py-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-muted)" }}
      >
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
          Categories with existing videos cannot be deleted. Rename them freely — video assignments will follow.
          Order here is visual only; the homepage always sorts alphabetically.
        </p>
      </div>
    </div>
  );
}
