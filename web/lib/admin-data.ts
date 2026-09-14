import type { SupabaseClient } from "@supabase/supabase-js";

// Browser-side admin queries (anon key; the edge middleware guarantees the
// caller is an allow-listed curator). Kept lightweight: no transcripts.

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
