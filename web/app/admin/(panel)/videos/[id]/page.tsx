"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { getAdminCategories, getAdminVideoDetail } from "@/lib/admin-data";
import AdminSkeleton from "@/components/admin-skeleton";

const RELAY_URL = process.env.NEXT_PUBLIC_INGEST_RELAY_URL ?? "http://127.0.0.1:8931";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  rows?: number;
}) {
  const base = {
    borderColor: "var(--color-border)",
    background: "var(--color-muted)",
    color: "var(--color-foreground)",
  };
  return (
    <div>
      <label
        className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        {label}
      </label>
      {rows ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-sm border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
          style={base}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-sm border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
          style={base}
        />
      )}
    </div>
  );
}

interface AffiliateLink {
  label: string;
  url: string;
  disclosure: string;
}

export default function AdminVideoEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cats, setCats] = useState<string[]>(["All"]);

  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [summary, setSummary] = useState("");
  const [takeaways, setTakeaways] = useState<string[]>([]);
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLink[]>([]);
  const [chapters, setChapters] = useState<
    { title: string; startTime: number; imageUrl: string | null; frameTime: number | null }[]
  >([]);
  const [youtubeId, setYoutubeId] = useState("");
  const [frameTimes, setFrameTimes] = useState<Record<number, string>>({});
  const [frameUrls, setFrameUrls] = useState<Record<number, string>>({});
  const [frameBusy, setFrameBusy] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    Promise.all([getAdminVideoDetail(sb, id), getAdminCategories(sb)])
      .then(([video, c]) => {
        if (!video) {
          setNotFound(true);
          return;
        }
        setTitle(video.title);
        setChannel(video.channelName);
        setCategory(video.category);
        setTagsInput(video.tags.join(", "));
        setPublishedAt(video.publishedAt);
        setSummary(video.summary);
        setTakeaways(video.takeaways);
        setAffiliateLinks(video.affiliateLinks);
        setChapters(video.chapters);
        setYoutubeId(video.youtubeId);
        setCats(c);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setNotFound(true);
      });
  }, [id]);

  if (loading) {
    return <AdminSkeleton variant="form" />;
  }
  if (notFound) {
    router.replace("/admin/videos");
    return null;
  }

  const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

  function handleSave() {
    toast.success("Changes saved");
  }

  function updateTakeaway(i: number, val: string) {
    setTakeaways((prev) => prev.map((t, idx) => (idx === i ? val : t)));
  }
  function removeTakeaway(i: number) {
    setTakeaways((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function regenerateFrame(chapterIndex: number) {
    const ch = chapters[chapterIndex];
    if (!ch) return;
    const raw = frameTimes[chapterIndex] ?? String(ch.frameTime ?? ch.startTime ?? 0);
    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp) || timestamp < 0) {
      toast.error("Frame time must be a number of seconds >= 0.");
      return;
    }
    setFrameBusy((prev) => ({ ...prev, [chapterIndex]: true }));
    try {
      const res = await fetch(`${RELAY_URL}/chapter-frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeId, chapterIndex, timestamp }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Frame capture failed (HTTP ${res.status})`);
      setFrameUrls((prev) => ({ ...prev, [chapterIndex]: body.imageUrl }));
      setFrameTimes((prev) => ({ ...prev, [chapterIndex]: String(body.frameTime) }));
      toast.success(`Frame updated at ${body.frameTime}s`);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `${e.message} — is the relay running (npm run ingest:serve)?`
          : "Frame capture failed."
      );
    } finally {
      setFrameBusy((prev) => ({ ...prev, [chapterIndex]: false }));
    }
  }

  function updateLink(i: number, field: keyof AffiliateLink, val: string) {
    setAffiliateLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));
  }
  function removeLink(i: number) {
    setAffiliateLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  const inputBase = {
    borderColor: "var(--color-border)",
    background: "var(--color-muted)",
    color: "var(--color-foreground)",
  };

  return (
    <div className="flex gap-8">
      <div className="flex-1 min-w-0 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <InputField label="Title" value={title} onChange={setTitle} />
          </div>
          <InputField label="Channel Name" value={channel} onChange={setChannel} />
          <div>
            <label
              className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-sm border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
              style={inputBase}
            >
              {cats
                .filter((c) => c !== "All")
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>
          <InputField label="Tags (comma-separated)" value={tagsInput} onChange={setTagsInput} />
          <InputField label="Published Date" value={publishedAt} onChange={setPublishedAt} type="date" />
          <div className="col-span-2">
            <InputField label="Summary" value={summary} onChange={setSummary} rows={4} />
          </div>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border px-3 py-0.5 font-mono text-xs"
                style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div>
          <label
            className="mb-3 block font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Key Takeaways
          </label>
          <div className="space-y-2">
            {takeaways.map((t, i) => (
              <div key={i} className="flex gap-2">
                <span
                  className="mt-2.5 font-mono text-xs shrink-0"
                  style={{ color: "var(--color-accent)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <input
                  type="text"
                  value={t}
                  onChange={(e) => updateTakeaway(i, e.target.value)}
                  className="flex-1 rounded-sm border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
                  style={inputBase}
                />
                <button
                  onClick={() => removeTakeaway(i)}
                  className="px-2 text-red-500 hover:text-red-700 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setTakeaways((prev) => [...prev, ""])}
            className="mt-2 font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)]"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            + Add Takeaway
          </button>
        </div>

        <div>
          <label
            className="mb-3 block font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Affiliate Links
          </label>
          <div className="space-y-3">
            {affiliateLinks.map((link, i) => (
              <div
                key={i}
                className="rounded-sm border p-3 space-y-2"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={link.label}
                    onChange={(e) => updateLink(i, "label", e.target.value)}
                    placeholder="Label"
                    className="flex-1 rounded-sm border px-3 py-1.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
                    style={inputBase}
                  />
                  <select
                    value={link.disclosure}
                    onChange={(e) => updateLink(i, "disclosure", e.target.value)}
                    className="rounded-sm border px-3 py-1.5 text-sm outline-none"
                    style={inputBase}
                  >
                    <option value="Affiliate link">Affiliate link</option>
                    <option value="Sponsored">Sponsored</option>
                  </select>
                  <button
                    onClick={() => removeLink(i)}
                    className="px-2 text-red-500 hover:text-red-700 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(i, "url", e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-sm border px-3 py-1.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
                  style={inputBase}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              setAffiliateLinks((prev) => [...prev, { label: "", url: "", disclosure: "Affiliate link" }])
            }
            className="mt-2 font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)]"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            + Add Link
          </button>
        </div>

        {chapters.length > 0 && (
          <div>
            <label
              className="mb-3 block font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              Chapter Frames
            </label>
            <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
              Stills auto-captured at each chapter start. Nudge the timestamp and regenerate to pick a
              better frame. Requires the local relay (<code className="font-mono">npm run ingest:serve</code>).
            </p>
            <div className="space-y-3">
              {chapters.map((ch, i) => {
                const img = frameUrls[i] ?? ch.imageUrl ?? null;
                const t = frameTimes[i] ?? String(ch.frameTime ?? ch.startTime);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-sm border p-3"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    {img ? (
                      <img
                        src={img}
                        alt=""
                        className="aspect-video w-24 shrink-0 rounded-sm bg-[var(--color-muted)] object-cover"
                      />
                    ) : (
                      <div
                        className="flex aspect-video w-24 shrink-0 items-center justify-center rounded-sm font-mono text-[10px]"
                        style={{ background: "var(--color-muted)", color: "var(--color-muted-foreground)" }}
                      >
                        no frame
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                        {ch.title}
                      </p>
                      <p className="font-mono text-xs tabular-nums" style={{ color: "var(--color-muted-foreground)" }}>
                        chapter at {formatTime(ch.startTime)}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={t}
                      onChange={(e) => setFrameTimes((prev) => ({ ...prev, [i]: e.target.value }))}
                      title="Frame timestamp (seconds)"
                      className="w-20 rounded-sm border px-2 py-1.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
                      style={inputBase}
                    />
                    <button
                      onClick={() => regenerateFrame(i)}
                      disabled={frameBusy[i]}
                      className="rounded-sm px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-opacity hover:opacity-80 disabled:opacity-40"
                      style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
                    >
                      {frameBusy[i] ? "…" : "Refresh"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={handleSave}
            className="rounded-sm px-6 py-2.5 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
          >
            Save Changes
          </button>
          <Link
            href="/admin/videos"
            className="ml-auto font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-foreground)]"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            ← Back to Library
          </Link>
        </div>
      </div>
    </div>
  );
}
