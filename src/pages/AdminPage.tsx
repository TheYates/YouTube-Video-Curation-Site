import { useState } from "react"
import { Link } from "react-router-dom"
import { videos } from "../data/videos"

type StepStatus = "idle" | "running" | "done"

interface Step {
  label: string
  status: StepStatus
}

const INITIAL_STEPS: Step[] = [
  { label: "Fetching video metadata", status: "idle" },
  { label: "Extracting transcript via Whisper", status: "idle" },
  { label: "Generating AI summary & chapters", status: "idle" },
  { label: "Publishing page", status: "idle" },
]

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:embed\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export default function AdminPage() {
  const [url, setUrl] = useState("")
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS)
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const [published, setPublished] = useState<typeof videos>([])
  const [error, setError] = useState("")

  function runPipeline() {
    const ytId = extractYouTubeId(url)
    if (!ytId) {
      setError("Could not parse a YouTube video ID from that URL. Try pasting the full URL.")
      return
    }
    setError("")
    setProcessing(true)
    setDone(false)
    const fresh = INITIAL_STEPS.map((s) => ({ ...s, status: "idle" as StepStatus }))
    setSteps(fresh)

    const delays = [800, 1800, 2800, 3600]
    delays.forEach((delay, i) => {
      setTimeout(() => {
        setSteps((prev) => prev.map((s, idx) => ({
          ...s,
          status: idx < i ? "done" : idx === i ? "running" : "idle",
        })))
      }, delay - 600)
      setTimeout(() => {
        setSteps((prev) => prev.map((s, idx) => ({
          ...s,
          status: idx <= i ? "done" : "idle",
        })))
        if (i === delays.length - 1) {
          setProcessing(false)
          setDone(true)
          const fakeVideo = videos[Math.floor(Math.random() * videos.length)]
          setPublished((prev) => [{ ...fakeVideo, id: `admin-${Date.now()}`, youtubeId: ytId }, ...prev])
          setUrl("")
        }
      }, delay)
    })
  }

  return (
    <main className="page-enter mx-auto max-w-2xl px-6 py-16">
      <div className="mb-12">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">Curator Tools</p>
        <h1 className="font-display text-4xl text-[var(--color-foreground)]">Ingest a Video</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Paste a YouTube URL. The pipeline fetches metadata, extracts the transcript, generates an AI summary and chapter
          markers, then publishes the page — zero manual editing required.
        </p>
      </div>

      <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-[var(--color-muted-foreground)]">
          YouTube URL
        </label>
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !processing && url && runPipeline()}
            placeholder="https://www.youtube.com/watch?v=…"
            disabled={processing}
            className="flex-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-foreground)] placeholder-[var(--color-muted-foreground)] outline-none transition-colors focus:border-[var(--color-accent)] disabled:opacity-50"
          />
          <button
            onClick={runPipeline}
            disabled={processing || !url.trim()}
            className="rounded-sm bg-[var(--color-accent)] px-5 py-3 font-mono text-xs uppercase tracking-widest text-[var(--color-accent-foreground)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {processing ? "Processing…" : "Process"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        )}

        {(processing || done) && (
          <div className="mt-6 space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-4 flex-shrink-0 text-center">
                  {step.status === "done" && (
                    <svg className="inline text-[var(--color-accent)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                  {step.status === "running" && (
                    <span className="inline-block h-3 w-3 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
                  )}
                  {step.status === "idle" && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-border)]" />
                  )}
                </span>
                <span
                  className={[
                    "text-sm",
                    step.status === "done" ? "text-[var(--color-foreground)]" : "text-[var(--color-muted-foreground)]",
                  ].join(" ")}
                >
                  {step.label}
                  {step.status === "running" && "…"}
                </span>
              </div>
            ))}
          </div>
        )}

        {done && (
          <div className="mt-4 rounded-sm border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 px-4 py-3">
            <p className="text-sm text-[var(--color-accent)]">Page published successfully.</p>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-sm border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3">
        <p className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          <span className="text-[var(--color-foreground)]">Production note:</span> This UI calls a backend worker that runs the
          YouTube Data API, Whisper transcription, and an LLM summarization chain. The result is written to the database
          and the CDN edge cache is purged automatically.
        </p>
      </div>

      {published.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
            Recently Added
          </h2>
          <div className="space-y-3">
            {published.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-sm border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--color-foreground)]">{v.title}</p>
                  <p className="font-mono text-xs text-[var(--color-muted-foreground)]">youtube.com/watch?v={v.youtubeId}</p>
                </div>
                <Link
                  to={`/video/${v.id}`}
                  className="ml-4 flex-shrink-0 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)] hover:underline"
                >
                  View →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
