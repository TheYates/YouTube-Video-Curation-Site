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
import AdminCategories from "./pages/admin/AdminCategories"
import AdminSubscribers from "./pages/admin/AdminSubscribers"
import AdminAnalytics from "./pages/admin/AdminAnalytics"
import { NEWSLETTER_ENABLED } from "./lib/env"

// New page/fragment NEVER inherits the previous page's scroll position.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="videos" element={<AdminVideos />} />
              <Route path="videos/:id" element={<AdminVideoEdit />} />
              <Route path="ingest" element={<AdminIngest />} />
              <Route path="categories" element={<AdminCategories />} />
              {NEWSLETTER_ENABLED && <Route path="subscribers" element={<AdminSubscribers />} />}
              <Route path="analytics" element={<AdminAnalytics />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
