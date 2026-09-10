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

export async function getVideo(id: string): Promise<Video | null> {
  const sb = await getServerSupabase();
  const { data, error } = await sb
    .from("videos")
    .select(FULL_VIDEO_SELECT)
    .order("start_time", { referencedTable: "chapters" })
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [video] = await attachTranscripts(sb, [data as VideoRow]);
  return video;
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
