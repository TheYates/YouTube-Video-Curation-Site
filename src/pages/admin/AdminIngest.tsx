import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { videos } from "../../data/videos"

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

export default function AdminIngest() {
  const navigate = useNavigate()
  const [url, setUrl] = useState("")
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS)
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
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
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "idle" as StepStatus })))

    const delays = [800, 1800, 2800, 3600]
    delays.forEach((delay, i) => {
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, idx) => ({
            ...s,
            status: idx < i ? "done" : idx === i ? "running" : "idle",
          }))
        )
      }, delay - 600)
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, idx) => ({ ...s, status: idx <= i ? "done" : "idle" }))
        )
        if (i === delays.length - 1) {
          setProcessing(false)
          setDone(true)
          setUrl("")
          setTimeout(() => navigate("/admin/videos"), 1800)
        }
      }, delay)
    })
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
          Paste a YouTube URL. The pipeline fetches metadata, extracts the transcript, generates an AI summary
          and chapter markers, then publishes the page — zero manual editing required.
        </p>
      </div>

      <div
        className="rounded-sm border p-6 space-y-4"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <label className="block font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
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
            className="flex-1 rounded-sm border px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-accent)] disabled:opacity-50"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-muted)",
              color: "var(--color-foreground)",
            }}
          />
          <button
            onClick={runPipeline}
            disabled={processing || !url.trim()}
            className="rounded-sm px-5 py-3 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
          >
            {processing ? "Processing…" : "Process"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}

        {(processing || done) && (
          <div className="space-y-3 pt-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-4 flex-shrink-0 text-center">
                  {step.status === "done" && (
                    <svg className="inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--color-accent)" }}>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                  {step.status === "running" && (
                    <span className="inline-block h-3 w-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }} />
                  )}
                  {step.status === "idle" && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-border)" }} />
                  )}
                </span>
                <span
                  className="text-sm"
                  style={{ color: step.status === "done" ? "var(--color-foreground)" : "var(--color-muted-foreground)" }}
                >
                  {step.label}{step.status === "running" && "…"}
                </span>
              </div>
            ))}
          </div>
        )}

        {done && (
          <div
            className="rounded-sm border px-4 py-3"
            style={{ borderColor: "var(--color-accent)", background: "color-mix(in srgb, var(--color-accent) 8%, transparent)" }}
          >
            <p className="text-sm" style={{ color: "var(--color-accent)" }}>
              Page published. Redirecting to library…
            </p>
          </div>
        )}
      </div>

      <div
        className="rounded-sm border px-4 py-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-muted)" }}
      >
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
          <span style={{ color: "var(--color-foreground)" }}>Production note:</span> This UI calls a backend worker
          that runs the YouTube Data API, Groq Whisper transcription, and a Groq LLaMA summarization chain.
          The result is written to the database and the CDN edge cache is purged automatically.
        </p>
      </div>

      <div className="border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
          Recently in Library
        </p>
        <div className="space-y-2">
          {[...videos].slice(0, 3).map((v) => (
            <div key={v.id} className="flex items-center justify-between">
              <p className="text-sm truncate max-w-xs" style={{ color: "var(--color-foreground)" }}>{v.title}</p>
              <Link
                to={`/admin/videos/${v.id}`}
                className="ml-4 font-mono text-xs transition-colors hover:text-[var(--color-accent)]"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                Edit →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
