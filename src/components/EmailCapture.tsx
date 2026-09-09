import { useState, useEffect } from "react"
import { toast } from "sonner"

const DISMISSED_KEY = "signal-email-dismissed"

interface Props {
  variant: "banner" | "inline"
}

export default function EmailCapture({ variant }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [email, setEmail] = useState("")

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === "1") {
      setDismissed(true)
    }
  }, [])

  if (dismissed) return null

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "1")
    setDismissed(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setEmail("")
    toast.success("You're on the list. We'll send the best ideas straight to you.")
  }

  if (variant === "banner") {
    return (
      <div className="relative mb-10 rounded-sm border border-[var(--color-border)] border-l-[3px] border-l-[var(--color-accent)] bg-[var(--color-card)] px-6 py-5">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
          title="Dismiss"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="flex flex-col gap-4 pr-6 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-display text-lg text-[var(--color-foreground)]">Get the best ideas in your inbox</p>
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                Weekly digest of our top curated videos. No noise, unsubscribe any time.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2 sm:flex-shrink-0">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-48 rounded-sm border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder-[var(--color-muted-foreground)] outline-none transition-colors focus:border-[var(--color-accent)]"
              />
              <button
                type="submit"
                className="rounded-sm bg-[var(--color-accent)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--color-accent-foreground)] transition-opacity hover:opacity-80"
              >
                Subscribe
              </button>
            </form>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-5">
      <p className="font-display text-base text-[var(--color-foreground)]">Enjoying this? Get our weekly digest.</p>
      <p className="mt-1 mb-4 text-xs text-[var(--color-muted-foreground)]">
        Top curated videos delivered to your inbox every week.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder-[var(--color-muted-foreground)] outline-none transition-colors focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          className="rounded-sm bg-[var(--color-accent)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--color-accent-foreground)] transition-opacity hover:opacity-80"
        >
          Subscribe
        </button>
      </form>
      <button
        onClick={handleDismiss}
        className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
      >
        No thanks
      </button>
    </div>
  )
}
