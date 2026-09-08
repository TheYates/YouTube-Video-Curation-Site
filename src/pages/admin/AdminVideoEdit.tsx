import { useState, useEffect } from "react"
import { useParams, Navigate, Link } from "react-router-dom"
import { useVideo, useCategories } from "../../hooks/useVideos"
import type { AffiliateLink } from "../../data/types"

function InputField({ label, value, onChange, type = "text", rows }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  rows?: number
}) {
  const base = {
    borderColor: "var(--color-border)",
    background: "var(--color-muted)",
    color: "var(--color-foreground)",
  }
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
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
  )
}

export default function AdminVideoEdit() {
  const { id } = useParams<{ id: string }>()
  const { data: video, isPending } = useVideo(id ?? "")
  const { data: cats = ["All"] } = useCategories()

  const [title, setTitle] = useState("")
  const [channel, setChannel] = useState("")
  const [category, setCategory] = useState("")
  const [tagsInput, setTagsInput] = useState("")
  const [publishedAt, setPublishedAt] = useState("")
  const [summary, setSummary] = useState("")
  const [takeaways, setTakeaways] = useState<string[]>([])
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLink[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!video) return
    setTitle(video.title)
    setChannel(video.channelName)
    setCategory(video.category)
    setTagsInput(video.tags.join(", "))
    setPublishedAt(video.publishedAt)
    setSummary(video.summary)
    setTakeaways(video.takeaways)
    setAffiliateLinks(video.affiliateLinks ?? [])
  }, [video])

  if (isPending) {
    return <p className="py-16 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>Loading video…</p>
  }
  if (!video) return <Navigate to="/admin/videos" replace />

  const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function updateTakeaway(i: number, val: string) {
    setTakeaways((prev) => prev.map((t, idx) => (idx === i ? val : t)))
  }
  function removeTakeaway(i: number) {
    setTakeaways((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateLink(i: number, field: keyof AffiliateLink, val: string) {
    setAffiliateLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)))
  }
  function removeLink(i: number) {
    setAffiliateLinks((prev) => prev.filter((_, idx) => idx !== i))
  }

  const inputBase = {
    borderColor: "var(--color-border)",
    background: "var(--color-muted)",
    color: "var(--color-foreground)",
  }

  return (
    <div className="flex gap-8">
      {/* Form */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <InputField label="Title" value={title} onChange={setTitle} />
          </div>
          <InputField label="Channel Name" value={channel} onChange={setChannel} />
          <div>
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-sm border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
              style={inputBase}
            >
              {cats.filter((c) => c !== "All").map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <InputField label="Tags (comma-separated)" value={tagsInput} onChange={setTagsInput} />
          <InputField label="Published Date" value={publishedAt} onChange={setPublishedAt} type="date" />
          <div className="col-span-2">
            <InputField label="Summary" value={summary} onChange={setSummary} rows={4} />
          </div>
        </div>

        {/* Tags preview */}
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

        {/* Takeaways */}
        <div>
          <label className="mb-3 block font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
            Key Takeaways
          </label>
          <div className="space-y-2">
            {takeaways.map((t, i) => (
              <div key={i} className="flex gap-2">
                <span className="mt-2.5 font-mono text-xs flex-shrink-0" style={{ color: "var(--color-accent)" }}>
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

        {/* Affiliate links */}
        <div>
          <label className="mb-3 block font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
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
            onClick={() => setAffiliateLinks((prev) => [...prev, { label: "", url: "", disclosure: "Affiliate link" }])}
            className="mt-2 font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-accent)]"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            + Add Link
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={handleSave}
            className="rounded-sm px-6 py-2.5 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
          >
            Save Changes
          </button>
          {saved && (
            <span className="font-mono text-xs" style={{ color: "var(--color-accent)" }}>
              Saved.
            </span>
          )}
          <Link
            to="/admin/videos"
            className="ml-auto font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-foreground)]"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            ← Back to Library
          </Link>
        </div>
      </div>

      {/* Preview card */}
      <div className="hidden xl:block w-72 flex-shrink-0">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
          Card Preview
        </p>
        <div
          className="rounded-sm border overflow-hidden"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          <img
            src={video.thumbnailUrl}
            alt={title}
            onError={(e) => {
              const img = e.currentTarget
              if (img.dataset.fbk) return
              img.dataset.fbk = "1"
              img.src = img.src.replace(/maxresdefault|sddefault/, "hqdefault")
            }}
            className="w-full object-cover"
            style={{ aspectRatio: "16/9" }}
          />
          <div className="p-4">
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>
              {category}
            </span>
            <h3 className="mt-1 font-display text-base leading-snug" style={{ color: "var(--color-foreground)" }}>
              {title || "Untitled"}
            </h3>
            <p className="mt-1 font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
              {channel}
            </p>
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border px-2 py-0.5 font-mono text-[10px]"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
