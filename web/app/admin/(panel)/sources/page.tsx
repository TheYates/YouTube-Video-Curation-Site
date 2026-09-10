"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

interface SourceChannel {
  name: string;
  handle: string;
  category: string;
  description: string;
  builtin: boolean;
}

const PRESEED: SourceChannel[] = [
  { name: "Ray Dalio", handle: "raydalio", category: "Finance", description: "Macro economics, debt cycles, investing principles", builtin: true },
  { name: "Ben Felix", handle: "BenFelixCSI", category: "Finance", description: "Evidence-based personal finance, factor investing", builtin: true },
  { name: "Patrick Boyle", handle: "patrickboyle01", category: "Finance", description: "Dry analytical finance, derivatives, macro", builtin: true },
  { name: "The Plain Bagel", handle: "ThePlainBagel", category: "Finance", description: "Accessible investing explainers", builtin: true },
  { name: "Andrej Karpathy", handle: "AndrejKarpathy", category: "Tech", description: "Neural networks, LLMs, AI research", builtin: true },
  { name: "3Blue1Brown", handle: "3blue1brown", category: "Tech", description: "Math & CS visual explainers", builtin: true },
  { name: "Fireship", handle: "Fireship", category: "Tech", description: "Fast-paced dev content", builtin: true },
  { name: "Kurzgesagt", handle: "kurzgesagt", category: "Science", description: "Animated science explainers, big ideas", builtin: true },
  { name: "PBS Space Time", handle: "pbsspacetime", category: "Science", description: "Physics, cosmology, university level", builtin: true },
  { name: "Veritasium", handle: "veritasium", category: "Science", description: "Counterintuitive science, experiments", builtin: true },
  { name: "Einzelganger", handle: "Einzelganger", category: "Philosophy", description: "Stoicism, Nietzsche, existentialism", builtin: true },
  { name: "Academy of Ideas", handle: "academyofideas", category: "Philosophy", description: "Philosophy of great thinkers, animated", builtin: true },
  { name: "The School of Life", handle: "theschooloflife", category: "Philosophy", description: "Practical philosophy, psychology", builtin: true },
];

const STORAGE_KEY = "signal-source-channels-v1";

interface StoredOverride {
  added: SourceChannel[];
  removed: string[];
}

function loadOverrides(): StoredOverride {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { added: [], removed: [] };
    const parsed = JSON.parse(raw);
    return {
      added: Array.isArray(parsed.added) ? parsed.added : [],
      removed: Array.isArray(parsed.removed) ? parsed.removed : [],
    };
  } catch {
    return { added: [], removed: [] };
  }
}

const keyOf = (c: Pick<SourceChannel, "category" | "handle">) =>
  `${c.category}|${c.handle.toLowerCase()}`;

export default function AdminSourcesPage() {
  const [overrides, setOverrides] = useState<StoredOverride>(loadOverrides);
  const [search, setSearch] = useState("philosophy lecture 2025");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [category, setCategory] = useState("Finance");
  const [description, setDescription] = useState("");

  const persist = (next: StoredOverride) => {
    setOverrides(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode etc. — session-only fallback.
    }
  };

  const channels: SourceChannel[] = [
    ...overrides.added,
    ...PRESEED.filter((c) => !overrides.removed.includes(keyOf(c))),
  ];

  const categories = Array.from(new Set(channels.map((c) => c.category)));
  const inputBase = {
    borderColor: "var(--color-border)",
    background: "var(--color-muted)",
    color: "var(--color-foreground)",
  };

  function openSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) {
      toast.error("Type something to search YouTube for.");
      return;
    }
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, "_blank", "noopener");
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const cleanHandle = handle.trim().replace(/^@/, "");
    if (!name.trim() || !cleanHandle) {
      toast.error("Channel name and handle are required.");
      return;
    }
    if (channels.some((c) => keyOf({ category, handle: cleanHandle }) === keyOf(c))) {
      toast.error("That channel is already on the list.");
      return;
    }
    persist({
      ...overrides,
      added: [
        {
          name: name.trim(),
          handle: cleanHandle,
          category,
          description: description.trim() || "Curator pick",
          builtin: false,
        },
        ...overrides.added,
      ],
    });
    setName("");
    setHandle("");
    setDescription("");
    toast.success(`Added ${name.trim()} to ${category}`);
  }

  function handleRemove(ch: SourceChannel) {
    if (ch.builtin) {
      persist({ ...overrides, removed: [...overrides.removed, keyOf(ch)] });
    } else {
      persist({ ...overrides, added: overrides.added.filter((a) => keyOf(a) !== keyOf(ch)) });
    }
    toast.success(`Removed ${ch.name}`);
  }

  function resetDefaults() {
    persist({ added: [], removed: [] });
    toast.success("Source list reset to defaults");
  }

  return (
    <div className="max-w-3xl space-y-10">
      <div
        className="rounded-sm border p-6 space-y-4"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <label
          className="block font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          Search YouTube for new content →
        </label>
        <form onSubmit={openSearch} className="flex gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="philosophy lecture 2025"
            className="flex-1 rounded-sm border px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
            style={inputBase}
          />
          <button
            type="submit"
            className="rounded-sm px-5 py-3 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
          >
            Search
          </button>
        </form>
      </div>

      {categories.map((cat) => (
        <div key={cat}>
          <h2
            className="mb-4 font-mono text-xs uppercase tracking-widest"
            style={{ color: "var(--color-accent)" }}
          >
            {cat}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {channels
              .filter((c) => c.category === cat)
              .map((ch) => (
                <div
                  key={keyOf(ch)}
                  className="rounded-sm border p-5 space-y-3"
                  style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
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
                    @{ch.handle}
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <a
                      href={`https://www.youtube.com/@${ch.handle}/videos`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)]"
                      style={{ color: "var(--color-foreground)" }}
                    >
                      Browse Latest →
                    </a>
                    <Link
                      href="/admin/ingest"
                      className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)]"
                      style={{ color: "var(--color-muted-foreground)" }}
                    >
                      Ingest from here →
                    </Link>
                    <button
                      onClick={() => handleRemove(ch)}
                      className="ml-auto font-mono text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}

      <div
        className="rounded-sm border p-6 space-y-4"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <div className="flex items-center justify-between">
          <label
            className="block font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Add Channel
          </label>
          <button
            onClick={resetDefaults}
            className="font-mono text-[10px] uppercase tracking-wide transition-colors hover:text-[var(--color-foreground)]"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Reset to defaults
          </button>
        </div>
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Channel name"
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
            {Array.from(new Set([...categories, "Finance", "Tech", "Science", "Philosophy"])).map((c) => (
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
            className="rounded-sm px-5 py-2.5 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80 sm:col-span-2"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
          >
            Add Channel
          </button>
        </form>
      </div>
    </div>
  );
}
