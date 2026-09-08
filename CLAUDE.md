@AGENTS.md

## Project: Signal — YouTube Curation Site

A content site that curates YouTube videos across multiple categories, giving each one a
synced clickable transcript, AI-generated summary, key takeaways, chapter markers, and a
site-wide full-transcript search. Built with React 19 + Vite 8 + Tailwind CSS v4.

### Routes

| Path | Component | Notes |
|---|---|---|
| `/` | `HomePage` | Blog feed with category filter tabs |
| `/video/:id` | `VideoPage` | Article + sticky YouTube player + transcript |
| `/search` | `SearchPage` | Full-transcript search (`?q=`) |
| `/admin/*` | `AdminLayout` | Full admin dashboard — sidebar shell |
| `/admin/dashboard` | `AdminDashboard` | Stats cards + recent activity |
| `/admin/videos` | `AdminVideos` | Video library table |
| `/admin/videos/:id` | `AdminVideoEdit` | Edit metadata, takeaways, affiliate links |
| `/admin/ingest` | `AdminIngest` | URL paste pipeline |
| `/admin/categories` | `AdminCategories` | Manage categories |
| `/admin/subscribers` | `AdminSubscribers` | Email list + CSV export |
| `/admin/analytics` | `AdminAnalytics` | Stats tiles + category bar chart |

### Layout structure

- **Public routes** wrapped in `src/layouts/PublicLayout.tsx` (renders NavBar + Outlet)
- **Admin routes** wrapped in `src/layouts/AdminLayout.tsx` (fixed sidebar 224px + content area; no public NavBar)

### What exists

**Components:** `NavBar` (sticky, progress bar, mobile search), `VideoCard`, `CategoryTabs`,
`TranscriptPane` (word-level sync), `ChapterList`, `SummaryPanel` (summary + takeaways + affiliate links),
`ShareBar`, `EmailCapture` (banner/inline, localStorage dismiss), `AdSlot` (leaderboard/rectangle),
`RelatedVideos`

**Hook:** `useYouTubePlayer` — loads YouTube IFrame API once, polls currentTime every 250 ms,
exposes `seekTo`, `playAt`, `isReady`, `isActive`

**Data layer:** `src/data/videos.ts` — mock Video array + `getVideoById`, `getVideosByCategory`,
`searchVideos`, `getRelatedVideos`. All currently static.

**Types:** `src/data/types.ts` — `Video`, `Chapter`, `TranscriptWord`, `AffiliateLink`

### Theme

Warm light editorial. Fraunces (display), Inter (body), JetBrains Mono (labels/code).
Accent: `#d7402b` (terracotta red). Background: `#fffdf8` (cream). All color tokens use
`--color-*` prefix in CSS custom properties and `var(--color-*)` in Tailwind classes.

### Current data state

All data is **mock/static**. Migration path: Supabase (DB) + YouTube Data API v3 (metadata)
+ Groq Whisper (transcription, free tier) + Groq LLaMA 3.3 70B (summaries, free tier).

### Code conventions

- Components: default exports, double-quoted strings (apostrophes safe)
- Tailwind v4: no config file, tokens in `src/index.css` `@theme` block
- CSS vars: always `var(--color-*)` — never `var(--accent)` without the `color-` infix
- No inline styles except for dynamic values (maxHeight transitions, progress bar width)
- Admin pages live in `src/pages/admin/`, layouts in `src/layouts/`
