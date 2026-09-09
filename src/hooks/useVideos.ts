import { useQuery } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { searchInVideos, scoreRelated } from "../lib/videoUtils"
import type { SearchHit, Video } from "../data/types"
import { getSupabase } from "../lib/supabase"

// ── Supabase row shapes (snake_case, as returned by PostgREST) ──

interface ChapterRow {
  title: string
  start_time: number
  description: string | null
  image_url: string | null
  frame_time: number | null
}

interface WordRow {
  text: string
  start_time: number
  end_time: number
}

interface AffiliateRow {
  label: string
  url: string
  disclosure: string
}

interface VideoRow {
  id: string
  youtube_id: string
  title: string
  channel_name: string
  published_at: string
  duration_sec: number
  category: string
  thumbnail_url: string
  summary: string | null
  takeaways: string[] | null
  tags: string[] | null
  chapters: ChapterRow[] | null
  transcript_words: WordRow[] | null
  affiliate_links: AffiliateRow[] | null
}

function mapRowToVideo(row: VideoRow): Video {
  return {
    id: row.id,
    youtubeId: row.youtube_id,
    title: row.title,
    channelName: row.channel_name,
    publishedAt: row.published_at,
    durationSeconds: Number(row.duration_sec),
    category: row.category,
    thumbnailUrl: row.thumbnail_url,
    summary: row.summary ?? "",
    takeaways: row.takeaways ?? [],
    chapters: (row.chapters ?? []).map((c) => ({
      title: c.title,
      startTime: Number(c.start_time),
      description: c.description ?? "",
      imageUrl: c.image_url ?? null,
      frameTime: c.frame_time != null ? Number(c.frame_time) : null,
    })),
    transcript: (row.transcript_words ?? []).map((w) => ({
      text: w.text,
      startTime: Number(w.start_time),
      endTime: Number(w.end_time),
    })),
    tags: row.tags ?? [],
    affiliateLinks: (row.affiliate_links ?? []).map((a) => ({
      label: a.label,
      url: a.url,
      disclosure: a.disclosure,
    })),
  }
}

// transcript_words is deliberately NOT embedded: embedded selects are capped
// by the project's max-rows setting (default 1000), so long transcripts are
// paged separately with range() — the documented pattern.
const FULL_VIDEO_SELECT = "*, chapters(*), affiliate_links(*)"

async function fetchTranscriptWords(sb: SupabaseClient, videoId: string): Promise<WordRow[]> {
  const PAGE = 1000
  const all: WordRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("transcript_words")
      .select("text,start_time,end_time")
      .eq("video_id", videoId)
      .order("start_time")
      .order("id")
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as WordRow[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

async function attachTranscripts(sb: SupabaseClient, rows: VideoRow[]): Promise<Video[]> {
  return Promise.all(
    rows.map(async (row) => {
      const words = await fetchTranscriptWords(sb, row.id)
      return mapRowToVideo({ ...row, transcript_words: words })
    }),
  )
}

let warnedNoClient = false
function warnNoClient() {
  if (!warnedNoClient) {
    warnedNoClient = true
    console.warn(
      "[data] Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Returning empty data.",
    )
  }
}

async function fetchVideosByCategory(category: string): Promise<Video[]> {
  const sb = getSupabase()
  if (!sb) {
    warnNoClient()
    return []
  }
  let query = sb
    .from("videos")
    .select(FULL_VIDEO_SELECT)
    .order("published_at", { ascending: false })
    .order("start_time", { referencedTable: "chapters" })
  if (category !== "All") query = query.eq("category", category)
  const { data, error } = await query
  if (error) throw error
  return attachTranscripts(sb, (data ?? []) as VideoRow[])
}

async function fetchVideo(id: string): Promise<Video | null> {
  const sb = getSupabase()
  if (!sb) {
    warnNoClient()
    return null
  }
  const { data, error } = await sb
    .from("videos")
    .select(FULL_VIDEO_SELECT)
    .order("start_time", { referencedTable: "chapters" })
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const [video] = await attachTranscripts(sb, [data as VideoRow])
  return video
}

async function fetchSearch(query: string): Promise<SearchHit[]> {
  const sb = getSupabase()
  if (!sb) {
    warnNoClient()
    return []
  }
  // Server-side candidate filter: full-text over title/summary/transcript.
  const { data: idRows, error: idError } = await sb
    .from("videos")
    .select("id")
    .textSearch("transcript_tsv", query, { type: "websearch", config: "english" })
  if (idError) throw idError
  const ids = ((idRows ?? []) as { id: string }[]).map((r) => r.id)
  if (ids.length === 0) return []
  const { data, error } = await sb
    .from("videos")
    .select(FULL_VIDEO_SELECT)
    .order("start_time", { referencedTable: "chapters" })
    .in("id", ids)
  if (error) throw error
  const vids = await attachTranscripts(sb, (data ?? []) as VideoRow[])
  return searchInVideos(vids, query)
}

async function fetchRelated(video: Video): Promise<Video[]> {
  const sb = getSupabase()
  if (!sb) {
    warnNoClient()
    return []
  }
  const { data, error } = await sb
    .from("videos")
    .select(FULL_VIDEO_SELECT)
    .order("start_time", { referencedTable: "chapters" })
    .neq("id", video.id)
  if (error) throw error
  const vids = await attachTranscripts(sb, (data ?? []) as VideoRow[])
  return scoreRelated(vids, video)
}

async function fetchCategories(): Promise<string[]> {
  const sb = getSupabase()
  if (!sb) {
    warnNoClient()
    return ["All"]
  }
  const { data, error } = await sb.from("videos").select("category").limit(5000)
  if (error) throw error
  const uniq = Array.from(
    new Set(((data ?? []) as { category: string }[]).map((r) => r.category)),
  ).sort()
  return ["All", ...uniq]
}

export function useVideos(category: string) {
  return useQuery({
    queryKey: ["videos", category],
    queryFn: () => fetchVideosByCategory(category),
  })
}

export function useVideo(id: string) {
  return useQuery({
    queryKey: ["video", id],
    queryFn: () => fetchVideo(id),
    enabled: Boolean(id),
  })
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () => fetchSearch(query),
    enabled: query.trim().length > 0,
  })
}

export function useRelatedVideos(video: Video | undefined) {
  return useQuery({
    queryKey: ["related", video?.id ?? null],
    queryFn: () => fetchRelated(video as Video),
    enabled: Boolean(video),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  })
}

// ── Page-view analytics (real view tracking; see migration 20260908) ──

export interface PageViewStats {
  viewsByVideo: Record<string, number>
  totalViews: number
  viewsLast30d: number
  // False when the page_views table doesn't exist yet (migration not run)
  // or Supabase isn't configured — callers show zeroed stats + setup hint.
  trackingLive: boolean
}

const EMPTY_STATS: PageViewStats = {
  viewsByVideo: {},
  totalViews: 0,
  viewsLast30d: 0,
  trackingLive: false,
}

async function fetchPageViews(): Promise<PageViewStats> {
  const sb = getSupabase()
  if (!sb) {
    warnNoClient()
    return EMPTY_STATS
  }
  try {
    const PAGE = 1000
    const viewsByVideo: Record<string, number> = {}
    let totalViews = 0
    let viewsLast30d = 0
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from("page_views")
        .select("video_id,viewed_at")
        .order("viewed_at")
        .range(from, from + PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as { video_id: string; viewed_at: string }[]
      for (const r of rows) {
        viewsByVideo[r.video_id] = (viewsByVideo[r.video_id] ?? 0) + 1
        totalViews++
        if (new Date(r.viewed_at).getTime() >= cutoff) viewsLast30d++
      }
      if (rows.length < PAGE) break
    }
    return { viewsByVideo, totalViews, viewsLast30d, trackingLive: true }
  } catch {
    // Table missing (migration not run) or RLS — zeroed stats, hint shown.
    return EMPTY_STATS
  }
}

export function usePageViews() {
  return useQuery({
    queryKey: ["page-views"],
    queryFn: fetchPageViews,
    staleTime: 60_000,
  })
}

// Fire-and-forget view beacon: one row per video per browser session.
// Safe to call before the migration runs (the insert just fails silently).
export function logPageView(videoId: string) {
  try {
    const key = `viewed:${videoId}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, "1")
    const sb = getSupabase()
    if (!sb) return
    sb.from("page_views")
      .insert({ video_id: videoId })
      .then(({ error }) => {
        if (error) sessionStorage.removeItem(key)
      })
  } catch {
    // sessionStorage unavailable (SSR/private mode) — skip tracking.
  }
}
