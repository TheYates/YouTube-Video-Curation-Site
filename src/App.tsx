import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="min-h-full bg-[var(--color-background)] text-[var(--color-foreground)]">
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
              <Route path="subscribers" element={<AdminSubscribers />} />
              <Route path="analytics" element={<AdminAnalytics />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
