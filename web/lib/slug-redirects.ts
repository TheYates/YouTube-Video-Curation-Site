// One-time slug corrections (2026-10).
//
// The original slugify cut at 60 characters wherever that landed, so six public
// URLs ended mid-word ("...-every-pc-tha", "...-no-zoh"). Those URLs were
// indexed, so they keep pointing at the corrected canonical slug forever.
//
// Slugs are otherwise frozen at publish; only a defect like this justifies a
// rename. The words are cut on boundaries now (see lib/slug.ts), so no new
// entries should accumulate here.
//
// Consumed by next.config.ts `redirects()` — a permanent (308) redirect,
// which Google treats the same as a 301 for ranking purposes.
export const VIDEO_SLUG_REDIRECTS: Record<string, string> = {
  // Duplicate-content merge (2026-10): two rows curated the same video topic.
  // The deeper page (4,583 words) absorbed the thinner page's clean URL; the
  // thinner row was removed (scripts/merge-duplicates.mjs). The old "-2" URL
  // was live and indexed, so it points at the surviving page.
  "why-desert-people-wear-more-clothes-in-extreme-heat-2":
    "why-desert-people-wear-more-clothes-in-extreme-heat",
  "exposing-a-global-ai-slop-empire-ruining-the-internet-for-pr":
    "exposing-a-global-ai-slop-empire-ruining-the-internet-for-profit",
  "the-rise-and-fall-of-realplayer-media-player-on-every-pc-tha":
    "the-rise-and-fall-of-realplayer-media-player-on-every-pc-that",
  "the-cure-for-the-sickness-of-modern-society-henry-david-thor":
    "the-cure-for-the-sickness-of-modern-society-henry-david-thoreau",
  "free-business-email-with-your-own-domain-in-8-minutes-no-zoh":
    "free-business-email-with-your-own-domain-in-8-minutes-no-zoho",
  "how-to-make-money-with-google-adsense-using-ai-no-code-web-a":
    "how-to-make-money-with-google-adsense-using-ai-no-code-web-apps",
  "what-happens-to-your-body-when-you-eat-once-a-day-hour-by-ho":
    "what-happens-to-your-body-when-you-eat-once-a-day-hour-by-hour",
};
