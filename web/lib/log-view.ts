import { getBrowserSupabase } from "./supabase-browser";

// Fire-and-forget view beacon: one row per video per browser session.
export function logPageView(videoId: string) {
  try {
    const key = `viewed:${videoId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const sb = getBrowserSupabase();
    if (!sb) return;
    sb.from("page_views")
      .insert({ video_id: videoId })
      .then(({ error }) => {
        if (error) sessionStorage.removeItem(key);
      });
  } catch {
    // sessionStorage unavailable (private mode) — skip tracking.
  }
}
