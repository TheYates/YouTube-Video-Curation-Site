"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { getAdminCategories, listAdminVideos } from "@/lib/admin-data";

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState<string[] | null>(null);
  const [base, setBase] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newCat, setNewCat] = useState("");
  const [pending, setPending] = useState(true);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setPending(false);
      return;
    }
    Promise.all([getAdminCategories(sb), listAdminVideos(sb)])
      .then(([c, videos]) => {
        const b = c.filter((x) => x !== "All");
        setBase(b);
        const m: Record<string, number> = {};
        for (const v of videos) m[v.category] = (m[v.category] ?? 0) + 1;
        setCounts(m);
        setPending(false);
      })
      .catch(() => setPending(false));
  }, []);

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
    return (
      <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        Loading categories…
      </p>
    );
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
