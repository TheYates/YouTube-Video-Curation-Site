import { useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { queryClient } from "./lib/queryClient"
import PublicLayout from "./layouts/PublicLayout"
import AdminLayout from "./layouts/AdminLayout"
import HomePage from "./pages/HomePage"
import VideoPage from "./pages/VideoPage"
import SearchPage from "./pages/SearchPage"
import AdminDashboard from "./pages/admin/AdminDashboard"
import AdminVideos from "./pages/admin/AdminVideos"
import AdminVideoEdit from "./pages/admin/AdminVideoEdit"
import AdminIngest from "./pages/admin/AdminIngest"
import AdminSources from "./pages/admin/AdminSources"
import AdminCategories from "./pages/admin/AdminCategories"
import AdminSubscribers from "./pages/admin/AdminSubscribers"
import AdminAnalytics from "./pages/admin/AdminAnalytics"
import AdminLogin from "./pages/admin/AdminLogin"
import { NEWSLETTER_ENABLED } from "./lib/env"
import { AuthProvider, useAuth } from "./lib/auth"

// New page/fragment NEVER inherits the previous page's scroll position.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

// Gate for everything under /admin: resolving session → spinner, logged
// out → login (with return path), signed-in but not allow-listed → login
// with a rejection flag (the login page signs them straight back out).
function ProtectedAdmin() {
  const { user, isAdmin, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <p className="py-24 text-center font-mono text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        Checking session…
      </p>
    )
  }
  if (!user || !isAdmin) {
    const next = encodeURIComponent(location.pathname + location.search)
    const suffix = user && !isAdmin ? "&rejected=1" : ""
    return <Navigate to={`/admin/login?next=${next}${suffix}`} replace />
  }
  return <AdminLayout />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
        <ScrollToTop />
        <div className="min-h-full bg-[var(--color-background)] text-[var(--color-foreground)]">
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--color-card)",
                color: "var(--color-foreground)",
                border: "1px solid var(--color-border)",
              },
            }}
          />
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/video/:id" element={<VideoPage />} />
              <Route path="/search" element={<SearchPage />} />
            </Route>

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedAdmin />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="videos" element={<AdminVideos />} />
              <Route path="videos/:id" element={<AdminVideoEdit />} />
              <Route path="ingest" element={<AdminIngest />} />
              <Route path="sources" element={<AdminSources />} />
              <Route path="categories" element={<AdminCategories />} />
              {NEWSLETTER_ENABLED && <Route path="subscribers" element={<AdminSubscribers />} />}
              <Route path="analytics" element={<AdminAnalytics />} />
            </Route>
          </Routes>
        </div>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
