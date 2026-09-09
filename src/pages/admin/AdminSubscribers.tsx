import { useState } from "react"
import { toast } from "sonner"

interface Subscriber {
  id: string
  email: string
  joinedAt: string
  status: "Active" | "Unsubscribed"
}

const MOCK_SUBSCRIBERS: Subscriber[] = [
  { id: "s1",  email: "alex.morgan@gmail.com",     joinedAt: "2025-08-14", status: "Active" },
  { id: "s2",  email: "priya.nair@outlook.com",    joinedAt: "2025-08-21", status: "Active" },
  { id: "s3",  email: "james.whitfield@icloud.com",joinedAt: "2025-09-02", status: "Active" },
  { id: "s4",  email: "lin.chen@protonmail.com",   joinedAt: "2025-09-08", status: "Active" },
  { id: "s5",  email: "obi.eze@gmail.com",         joinedAt: "2025-09-15", status: "Active" },
  { id: "s6",  email: "sara.goldstein@yahoo.com",  joinedAt: "2025-09-22", status: "Unsubscribed" },
  { id: "s7",  email: "tomasz.krol@gmail.com",     joinedAt: "2025-10-01", status: "Active" },
  { id: "s8",  email: "mia.johnson@hey.com",       joinedAt: "2025-10-09", status: "Active" },
  { id: "s9",  email: "ravi.sharma@gmail.com",     joinedAt: "2025-10-18", status: "Active" },
  { id: "s10", email: "fatima.al-rashid@me.com",   joinedAt: "2025-10-25", status: "Active" },
  { id: "s11", email: "carlos.mendes@gmail.com",   joinedAt: "2025-11-03", status: "Unsubscribed" },
  { id: "s12", email: "yuki.tanaka@icloud.com",    joinedAt: "2025-11-11", status: "Active" },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function downloadCSV(rows: Subscriber[]) {
  const header = "Email,Joined,Status"
  const lines = rows.map((r) => `${r.email},${r.joinedAt},${r.status}`)
  const csv = [header, ...lines].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "signal-subscribers.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminSubscribers() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>(MOCK_SUBSCRIBERS)
  const [search, setSearch] = useState("")

  const filtered = subscribers.filter((s) =>
    !search || s.email.toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = subscribers.filter((s) => s.status === "Active").length

  function toggleStatus(id: string) {
    setSubscribers((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === "Active" ? "Unsubscribed" : "Active" } : s
      )
    )
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="font-display text-3xl" style={{ color: "var(--color-foreground)" }}>
            {activeCount}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
            Active subscribers
          </p>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            className="rounded-sm border py-2 pl-9 pr-4 text-sm outline-none transition-colors w-56"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-muted)",
              color: "var(--color-foreground)",
            }}
          />
        </div>
        <button
          onClick={() => {
            downloadCSV(filtered)
            toast.success(`Exported ${filtered.length} subscriber${filtered.length !== 1 ? "s" : ""} to CSV`)
          }}
          className="flex items-center gap-2 rounded-sm border px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-sm border overflow-hidden"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
              {["Email", "Joined", "Status", "Action"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                  No subscribers match your search.
                </td>
              </tr>
            ) : (
              filtered.map((sub, i) => (
                <tr
                  key={sub.id}
                  className="transition-colors hover:bg-[var(--color-muted)]"
                  style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}
                >
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--color-foreground)" }}>
                    {sub.email}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    {formatDate(sub.joinedAt)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                      style={{
                        background: sub.status === "Active"
                          ? "color-mix(in srgb, #22c55e 15%, transparent)"
                          : "color-mix(in srgb, #ef4444 12%, transparent)",
                        color: sub.status === "Active" ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleStatus(sub.id)}
                      className="font-mono text-xs uppercase tracking-wide transition-colors hover:text-[var(--color-foreground)]"
                      style={{ color: "var(--color-muted-foreground)" }}
                    >
                      {sub.status === "Active" ? "Unsubscribe" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        {filtered.length} of {subscribers.length} subscriber{subscribers.length !== 1 ? "s" : ""} shown
      </p>
    </div>
  )
}
