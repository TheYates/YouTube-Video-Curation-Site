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
  publishedAt: string;
  // When the video entered the library (videos.created_at) — the page's own
  // publish/modify date. publishedAt stays the original YouTube upload.
  curatedAt: string;
  durationSeconds: number;
  category: string;
  thumbnailUrl: string;
  summary: string;
  takeaways: string[];
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
