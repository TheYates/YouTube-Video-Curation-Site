import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "./supabase-server";
import type { SearchHit, Video } from "./types";
import { scoreRelated, searchInVideos } from "./video-utils";

// ── Supabase row shapes (snake_case, as returned by PostgREST) ──

interface ChapterRow {
  title: string;
  start_time: number;
  description: string | null;
  image_url: string | null;
  frame_time: number | null;
}

interface WordRow {
  text: string;
  start_time: number;
  end_time: number;
}

interface AffiliateRow {
  label: string;
  url: string;
  disclosure: string;
}

interface VideoRow {
  id: string;
  slug: string;
  youtube_id: string;
  title: string;
  channel_name: string;
  published_at: string;
  duration_sec: number;
  category: string;
  thumbnail_url: string;
  summary: string | null;
  takeaways: string[] | null;
  tags: string[] | null;
  chapters: ChapterRow[] | null;
  transcript_words: WordRow[] | null;
  affiliate_links: AffiliateRow[] | null;
}

function mapRowToVideo(row: VideoRow): Video {
  return {
    id: row.id,
    slug: row.slug,
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
  };
}

// transcript_words is deliberately NOT embedded: embedded selects are capped
// by the project's max-rows setting (default 1000), so long transcripts are
// paged separately with range() — the documented pattern.
const FULL_VIDEO_SELECT = "*, chapters(*), affiliate_links(*)";

async function fetchTranscriptWords(
  sb: SupabaseClient,
  videoId: string
): Promise<WordRow[]> {
  const PAGE = 1000;
  const all: WordRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("transcript_words")
      .select("text,start_time,end_time")
      .eq("video_id", videoId)
      .order("start_time")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as WordRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

async function attachTranscripts(
  sb: SupabaseClient,
  rows: VideoRow[]
): Promise<Video[]> {
  return Promise.all(
    rows.map(async (row) => {
      const words = await fetchTranscriptWords(sb, row.id);
      return mapRowToVideo({ ...row, transcript_words: words });
    })
  );
}

export async function getVideos(category = "All"): Promise<Video[]> {
  const sb = await getServerSupabase();
  let query = sb
    .from("videos")
    .select(FULL_VIDEO_SELECT)
    .order("published_at", { ascending: false })
    .order("start_time", { referencedTable: "chapters" });
  if (category !== "All") query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw error;
  return attachTranscripts(sb, (data ?? []) as VideoRow[]);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getVideo(slugOrId: string): Promise<Video | null> {
  const sb = await getServerSupabase();
  // Slug-first; the UUID fallback keeps old /video/<uuid> links working
  // (the page permanently redirects them to the slug). The UUID regex guard
  // avoids a PostgREST 400 comparing uuid = <non-uuid text>.
  const { data: bySlug, error: slugError } = await sb
    .from("videos")
    .select(FULL_VIDEO_SELECT)
    .order("start_time", { referencedTable: "chapters" })
    .eq("slug", slugOrId)
    .maybeSingle();
  if (slugError) throw slugError;
  let data = bySlug;
  if (!data && UUID_RE.test(slugOrId)) {
    const { data: byId, error: idError } = await sb
      .from("videos")
      .select(FULL_VIDEO_SELECT)
      .order("start_time", { referencedTable: "chapters" })
      .eq("id", slugOrId)
      .maybeSingle();
    if (idError) throw idError;
    data = byId;
  }
  if (!data) return null;
  const [video] = await attachTranscripts(sb, [data as VideoRow]);
  return video;
}

export interface VideoListing {
  id: string;
  slug: string;
  publishedAt: string;
}

// Minimal slug list for sitemap.xml — one cheap query, no transcripts.
// (The old sitemap fetched full videos incl. every word and timed out
// Googlebot on cold starts.)
export async function getVideoListings(): Promise<VideoListing[]> {
  const sb = await getServerSupabase();
  const { data, error } = await sb
    .from("videos")
    .select("id,slug,published_at")
    .order("published_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return ((data ?? []) as { id: string; slug: string; published_at: string }[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    publishedAt: r.published_at,
  }));
}

export async function getCategories(): Promise<string[]> {
  const sb = await getServerSupabase();
  const { data, error } = await sb.from("videos").select("category").limit(5000);
  if (error) throw error;
  const uniq = Array.from(
    new Set(((data ?? []) as { category: string }[]).map((r) => r.category))
  ).sort();
  return ["All", ...uniq];
}

// Fallback when app_settings is missing (migration not run yet).
export const DEFAULT_MIN_CATEGORY_VIDEOS = 3;

// Minimum videos before a category earns a public nav tab — curator-set via
// /admin/categories (app_settings.min_category_videos). Thin sections read
// as abandoned to visitors and Google; hidden categories stay reachable via
// direct URL, search, and related videos.
export async function getMinCategoryVideos(): Promise<number> {
  try {
    const sb = await getServerSupabase();
    const { data, error } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "min_category_videos")
      .maybeSingle();
    if (error || !data) return DEFAULT_MIN_CATEGORY_VIDEOS;
    const n = Number((data as { value: string }).value);
    return Number.isInteger(n) && n >= 1 && n <= 20 ? n : DEFAULT_MIN_CATEGORY_VIDEOS;
  } catch {
    return DEFAULT_MIN_CATEGORY_VIDEOS;
  }
}

export async function getPublicCategories(): Promise<string[]> {
  const sb = await getServerSupabase();
  const [catRes, threshold] = await Promise.all([
    sb.from("videos").select("category").limit(5000),
    getMinCategoryVideos(),
  ]);
  if (catRes.error) throw catRes.error;
  const counts = new Map<string, number>();
  for (const r of (catRes.data ?? []) as { category: string }[]) {
    counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  }
  const eligible = [...counts.entries()]
    .filter(([, n]) => n >= threshold)
    .map(([name]) => name)
    .sort();
  return ["All", ...eligible];
}

export async function searchVideos(query: string): Promise<SearchHit[]> {
  const sb = await getServerSupabase();
  // Server-side candidate filter: full-text over title/summary/transcript.
  const { data: idRows, error: idError } = await sb
    .from("videos")
    .select("id")
    .textSearch("transcript_tsv", query, { type: "websearch", config: "english" });
  if (idError) throw idError;
  const ids = ((idRows ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return [];
  const { data, error } = await sb
    .from("videos")
    .select(FULL_VIDEO_SELECT)
    .order("start_time", { referencedTable: "chapters" })
    .in("id", ids);
  if (error) throw error;
  const vids = await attachTranscripts(sb, (data ?? []) as VideoRow[]);
  return searchInVideos(vids, query);
}

export async function getRelatedVideos(video: Video): Promise<Video[]> {
  const sb = await getServerSupabase();
  const { data, error } = await sb
    .from("videos")
    .select(FULL_VIDEO_SELECT)
    .order("start_time", { referencedTable: "chapters" })
    .neq("id", video.id);
  if (error) throw error;
  const vids = await attachTranscripts(sb, (data ?? []) as VideoRow[]);
  return scoreRelated(vids, video);
}
