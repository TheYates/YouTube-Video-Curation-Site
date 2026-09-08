import type { AffiliateLink } from "../data/types"

interface Props {
  summary: string
  takeaways: string[]
  affiliateLinks?: AffiliateLink[]
}

export default function SummaryPanel({ summary, takeaways, affiliateLinks }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
          AI Summary
        </h3>
        <p className="text-base leading-relaxed text-[var(--color-muted-foreground)]">{summary}</p>
      </div>

      <div>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
          Key Takeaways
        </h3>
        <ul className="space-y-3">
          {takeaways.map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-px flex-shrink-0 font-mono text-xs text-[var(--color-accent)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm leading-relaxed text-[var(--color-foreground)]">{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {affiliateLinks && affiliateLinks.length > 0 && (
        <div>
          <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
            Resources &amp; Links
          </h3>
          <ul className="space-y-2">
            {affiliateLinks.map((link, i) => (
              <li key={i}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-sm border-l-2 border-transparent px-3 py-2.5 transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-muted)]"
                >
                  <span className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-accent)] transition-colors">
                      {link.label}
                    </span>
                    <span className="ml-2 inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)] border border-[var(--color-border)]">
                      {link.disclosure}
                    </span>
                  </span>
                  <svg
                    className="flex-shrink-0 text-[var(--color-muted-foreground)] group-hover:text-[var(--color-accent)] transition-colors"
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  >
                    <path d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
