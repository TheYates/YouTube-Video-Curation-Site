import { Outlet, NavLink, Link, useLocation } from "react-router-dom"

const navItems = [
  {
    to: "/admin/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: "/admin/videos",
    label: "Videos",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="m10 9 5 3-5 3V9z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    to: "/admin/ingest",
    label: "Ingest",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    to: "/admin/categories",
    label: "Categories",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    to: "/admin/subscribers",
    label: "Subscribers",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m2 7 10 7 10-7" />
      </svg>
    ),
  },
  {
    to: "/admin/analytics",
    label: "Analytics",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
  },
]

const sectionTitles: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/videos": "Video Library",
  "/admin/ingest": "Ingest Video",
  "/admin/categories": "Categories",
  "/admin/subscribers": "Subscribers",
  "/admin/analytics": "Analytics",
}

export default function AdminLayout() {
  const location = useLocation()
  const title =
    Object.entries(sectionTitles).find(([path]) => location.pathname.startsWith(path))?.[1] ?? "Admin"

  return (
    <div className="flex min-h-screen" style={{ background: "var(--color-background)" }}>
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 flex w-56 flex-col border-r z-30"
        style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
      >
        {/* Brand */}
        <div className="flex flex-col gap-1 px-5 py-5 border-b" style={{ borderColor: "var(--color-border)" }}>
          <Link to="/" className="font-display text-lg leading-none" style={{ color: "var(--color-foreground)" }}>
            Signal<span style={{ color: "var(--color-accent)" }}>.</span>
          </Link>
          <span
            className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm w-fit"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
          >
            Admin
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors",
                  isActive
                    ? "border-l-2 pl-[10px]"
                    : "border-l-2 border-transparent pl-[10px] hover:bg-[var(--color-muted)]",
                ].join(" ")
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      borderColor: "var(--color-accent)",
                      color: "var(--color-accent)",
                      background: "var(--color-muted)",
                    }
                  : { color: "var(--color-muted-foreground)" }
              }
            >
              {item.icon}
              <span className="font-mono text-xs uppercase tracking-wide">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Back to site */}
        <div className="px-3 py-4 border-t" style={{ borderColor: "var(--color-border)" }}>
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wide transition-colors hover:text-[var(--color-foreground)]"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to site
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col pl-56">
        {/* Topbar */}
        <header
          className="sticky top-0 z-20 flex items-center justify-between px-8 py-4 border-b"
          style={{ background: "var(--color-background)", borderColor: "var(--color-border)" }}
        >
          <h1 className="font-display text-xl" style={{ color: "var(--color-foreground)" }}>
            {title}
          </h1>
          {location.pathname === "/admin/videos" && (
            <Link
              to="/admin/ingest"
              className="flex items-center gap-2 rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-widest transition-opacity hover:opacity-80"
              style={{ background: "var(--color-accent)", color: "var(--color-accent-foreground)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Ingest Video
            </Link>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
