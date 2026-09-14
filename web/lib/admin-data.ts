import type { SupabaseClient } from "@supabase/supabase-js";

// Browser-side admin queries (anon key; the edge middleware guarantees the
// caller is an allow-listed curator). Kept lightweight: no transcripts.
// Writes never happen here — mutations go through the `curate` edge function
// (service role + ADMIN_EMAILS allow-list server-side).

export interface AdminVideo {
  id: string;
  slug: string;
  youtubeId: string;
  title: string;
  channelName: string;
  publishedAt: string;
  createdAt: string;
  durationSeconds: number;
  category: string;
  thumbnailUrl: string;
  affiliateCount: number;
  wordCount: number;
  chapterCount: number;
}

export async function listAdminVideos(sb: SupabaseClient): Promise<AdminVideo[]> {
  const { data, error } = await sb
    .from("videos")
    .select("id,slug,youtube_id,title,channel_name,published_at,created_at,duration_sec,category,thumbnail_url,chapters(id),affiliate_links(id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    id: string;
    slug: string;
    youtube_id: string;
    title: string;
    channel_name: string;
    published_at: string;
    created_at: string;
    duration_sec: number;
    category: string;
    thumbnail_url: string;
    chapters: { id: string }[] | null;
    affiliate_links: { id: string }[] | null;
  }>;
  const counts = await Promise.all(
    rows.map((r) =>
      sb
        .from("transcript_words")
        .select("id", { count: "exact", head: true })
        .eq("video_id", r.id)
    )
  );
  return rows.map((r, i) => ({
    id: r.id,
    slug: r.slug,
    youtubeId: r.youtube_id,
    title: r.title,
    channelName: r.channel_name,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    durationSeconds: Number(r.duration_sec),
    category: r.category,
    thumbnailUrl: r.thumbnail_url,
    affiliateCount: r.affiliate_links?.length ?? 0,
    wordCount: counts[i].count ?? 0,
    chapterCount: r.chapters?.length ?? 0,
  }));
}

export interface AdminVideoDetail {
  id: string;
  youtubeId: string;
  title: string;
  channelName: string;
  publishedAt: string;
  category: string;
  thumbnailUrl: string;
  summary: string;
  takeaways: string[];
  tags: string[];
  chapters: {
    id: string;
    title: string;
    startTime: number;
    description: string;
    imageUrl: string | null;
    frameTime: number | null;
  }[];
  affiliateLinks: { label: string; url: string; disclosure: string }[];
}

export async function getAdminVideoDetail(
  sb: SupabaseClient,
  id: string
): Promise<AdminVideoDetail | null> {
  const { data, error } = await sb
    .from("videos")
    .select("*, chapters(*), affiliate_links(*)")
    .order("start_time", { referencedTable: "chapters" })
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as {
    id: string;
    youtube_id: string;
    title: string;
    channel_name: string;
    published_at: string;
    category: string;
    thumbnail_url: string;
    summary: string | null;
    takeaways: string[] | null;
    tags: string[] | null;
    chapters: {
      id: string;
      title: string;
      start_time: number;
      description: string | null;
      image_url: string | null;
      frame_time: number | null;
    }[] | null;
    affiliate_links: { label: string; url: string; disclosure: string }[] | null;
  };
  return {
    id: row.id,
    youtubeId: row.youtube_id,
    title: row.title,
    channelName: row.channel_name,
    publishedAt: row.published_at,
    category: row.category,
    thumbnailUrl: row.thumbnail_url,
    summary: row.summary ?? "",
    takeaways: row.takeaways ?? [],
    tags: row.tags ?? [],
    chapters: (row.chapters ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      startTime: Number(c.start_time),
      description: c.description ?? "",
      imageUrl: c.image_url ?? null,
      frameTime: c.frame_time != null ? Number(c.frame_time) : null,
    })),
    affiliateLinks: (row.affiliate_links ?? []).map((a) => ({
      label: a.label,
      url: a.url,
      disclosure: a.disclosure,
    })),
  };
}

export async function getAdminCategories(sb: SupabaseClient): Promise<string[]> {
  const { data, error } = await sb.from("videos").select("category").limit(5000);
  if (error) throw error;
  const uniq = Array.from(
    new Set(((data ?? []) as { category: string }[]).map((r) => r.category))
  ).sort();
  return ["All", ...uniq];
}

export interface PageViewStats {
  viewsByVideo: Record<string, number>;
  totalViews: number;
  viewsLast30d: number;
  trackingLive: boolean;
}

// ── Discovery pipeline: review queue + sources ─────────────────────────────

export type CandidateStatus = "pending" | "approved" | "rejected" | "ingested" | "failed";

export interface VideoCandidate {
  id: string;
  youtubeId: string;
  title: string;
  channelId: string | null;
  channelName: string | null;
  durationSeconds: number;
  thumbnailUrl: string;
  publishedAt: string | null;
  discoveredVia: string;
  score: number;
  reason: string;
  suggestedCategory: string;
  status: CandidateStatus;
  attempts: number;
  createdAt: string;
}

function mapCandidate(r: {
  id: string;
  youtube_id: string;
  title: string;
  channel_id: string | null;
  channel_name: string | null;
  duration_sec: number;
  thumbnail_url: string;
  published_at: string | null;
  discovered_via: string;
  score: number;
  reason: string;
  suggested_category: string;
  status: string;
  attempts: number;
  created_at: string;
}): VideoCandidate {
  return {
    id: r.id,
    youtubeId: r.youtube_id,
    title: r.title,
    channelId: r.channel_id,
    channelName: r.channel_name,
    durationSeconds: Number(r.duration_sec),
    thumbnailUrl: r.thumbnail_url,
    publishedAt: r.published_at,
    discoveredVia: r.discovered_via,
    score: Number(r.score),
    reason: r.reason,
    suggestedCategory: r.suggested_category,
    status: r.status as CandidateStatus,
    attempts: r.attempts,
    createdAt: r.created_at,
  };
}

export async function listCandidates(
  sb: SupabaseClient,
  statuses: CandidateStatus[],
  limit = 100
): Promise<VideoCandidate[]> {
  const { data, error } = await sb
    .from("video_candidates")
    .select("*")
    .in("status", statuses)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Parameters<typeof mapCandidate>[0][]).map(mapCandidate);
}

export async function countPendingCandidates(sb: SupabaseClient): Promise<number> {
  const { count, error } = await sb
    .from("video_candidates")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}

export interface SourceChannelRow {
  id: string;
  channelId: string;
  handle: string;
  name: string;
  category: string;
  description: string;
  builtin: boolean;
  enabled: boolean;
  lastDiscoveredAt: string | null;
}

export async function listSourceChannels(sb: SupabaseClient): Promise<SourceChannelRow[]> {
  const { data, error } = await sb
    .from("source_channels")
    .select("*")
    .order("category")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    channelId: String(r.channel_id),
    handle: String(r.handle),
    name: String(r.name),
    category: String(r.category),
    description: String(r.description ?? ""),
    builtin: r.builtin === true,
    enabled: r.enabled === true,
    lastDiscoveredAt: (r.last_discovered_at as string | null) ?? null,
  }));
}

export interface SearchQueryRow {
  id: string;
  query: string;
  category: string;
  enabled: boolean;
  lastPolledAt: string | null;
}

export async function listSearchQueries(sb: SupabaseClient): Promise<SearchQueryRow[]> {
  const { data, error } = await sb
    .from("search_queries")
    .select("*")
    .order("category")
    .order("query");
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    query: String(r.query),
    category: String(r.category),
    enabled: r.enabled === true,
    lastPolledAt: (r.last_polled_at as string | null) ?? null,
  }));
}

export async function getPageViewStats(sb: SupabaseClient): Promise<PageViewStats> {
  try {
    const PAGE = 1000;
    const viewsByVideo: Record<string, number> = {};
    let totalViews = 0;
    let viewsLast30d = 0;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from("page_views")
        .select("video_id,viewed_at")
        .order("viewed_at")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as { video_id: string; viewed_at: string }[];
      for (const r of rows) {
        viewsByVideo[r.video_id] = (viewsByVideo[r.video_id] ?? 0) + 1;
        totalViews++;
        if (new Date(r.viewed_at).getTime() >= cutoff) viewsLast30d++;
      }
      if (rows.length < PAGE) break;
    }
    return { viewsByVideo, totalViews, viewsLast30d, trackingLive: true };
  } catch {
    return { viewsByVideo: {}, totalViews: 0, viewsLast30d: 0, trackingLive: false };
  }
}
