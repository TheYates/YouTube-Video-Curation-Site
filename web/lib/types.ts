export interface TranscriptWord {
  text: string;
  startTime: number;
  endTime: number;
}

export interface Chapter {
  title: string;
  startTime: number;
  description: string;
  imageUrl?: string | null;
  frameTime?: number | null;
}

export interface AffiliateLink {
  label: string;
  url: string;
  disclosure: string;
}

export interface Video {
  id: string;
  slug: string;
  youtubeId: string;
  title: string;
  channelName: string;
  // YouTube channel id (UC…) of the source channel, used to give the
  // VideoObject.author node a canonical url. Null for rows ingested before
  // ingest started storing it.
  channelId: string | null;
  publishedAt: string;
  // When the video entered the library (videos.created_at) — the page's own
  // publish/modify date. publishedAt stays the original YouTube upload.
  curatedAt: string;
  durationSeconds: number;
  category: string;
  thumbnailUrl: string;
  summary: string;
  takeaways: string[];
  // Human-written editorial note (150–300 words). Empty when not yet written;
  // the video page then falls back to the AI summary exactly as before.
  editorialNote: string;
  chapters: Chapter[];
  transcript: TranscriptWord[];
  tags: string[];
  affiliateLinks?: AffiliateLink[];
}

export interface SearchHit {
  video: Video;
  snippet: string;
  matchTime: number;
  matchIn: string;
}
