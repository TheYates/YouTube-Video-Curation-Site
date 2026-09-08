# Complete Admin Dashboard

## Context

The current `/admin` is a single page with just the URL ingest pipeline. The user wants a full admin site with its own shell, sidebar navigation, and multiple management sections — dashboard overview, video library management, ingest pipeline, category management, subscriber list, and analytics. The admin area needs its own layout (sidebar + topbar) completely separate from the public-facing NavBar.

---

## Architecture

### Routing — nested under `/admin/*`

Update `App.tsx` to use a nested route layout. Admin pages get `AdminLayout` (sidebar shell); public pages keep the existing `NavBar` wrapper.

```
/admin                  → redirect to /admin/dashboard
/admin/dashboard        → AdminDashboard  (stats overview)
/admin/videos           → AdminVideos     (video library table)
/admin/videos/:id       → AdminVideoEdit  (edit single video)
/admin/ingest           → AdminIngest     (URL pipeline — existing logic)
/admin/categories       → AdminCategories (manage categories)
/admin/subscribers      → AdminSubscribers (email list)
/admin/analytics        → AdminAnalytics  (charts/stats)
```

### New files

```
src/
  layouts/
    AdminLayout.tsx       — sidebar + content shell, no public NavBar
  pages/admin/
    AdminDashboard.tsx    — stats cards + recent activity feed
    AdminVideos.tsx       — searchable/filterable video table
    AdminVideoEdit.tsx    — edit form for a single video
    AdminIngest.tsx       — existing pipeline logic, moved here
    AdminCategories.tsx   — category list with add/rename/reorder
    AdminSubscribers.tsx  — mock email subscriber table
    AdminAnalytics.tsx    — stat tiles + bar chart (CSS-only, no lib)
```

---

## 1. `AdminLayout.tsx` — the shell

A two-column layout: fixed left sidebar (240px) + scrollable main content area.

**Sidebar contents:**
- Top: `Signal.` wordmark + `Admin` badge in `font-mono text-[10px]`
- Nav links (icon + label, active state = accent left border + accent text):
  - Dashboard (grid icon)
  - Videos (film icon)
  - Ingest (plus-circle icon)
  - Categories (tag icon)
  - Subscribers (mail icon)
  - Analytics (bar-chart icon)
- Bottom: `← Back to site` link to `/`

Active link detection: `useLocation()` matching `location.pathname`.

Sidebar bg: `var(--color-card)`, border-right: `var(--color-border)`.  
Content area bg: `var(--color-background)`.

**Topbar** (inside content area, not sidebar):  
A thin bar at the top of the content area showing the current section title + a right-aligned breadcrumb or action button (e.g. "New Video" on the Videos page).

---

## 2. `App.tsx` — routing restructure

```tsx
<Routes>
  {/* Public routes — wrapped in NavBar */}
  <Route element={<PublicLayout />}>
    <Route path="/" element={<HomePage />} />
    <Route path="/video/:id" element={<VideoPage />} />
    <Route path="/search" element={<SearchPage />} />
  </Route>

  {/* Admin routes — wrapped in AdminLayout */}
  <Route path="/admin" element={<AdminLayout />}>
    <Route index element={<Navigate to="/admin/dashboard" replace />} />
    <Route path="dashboard" element={<AdminDashboard />} />
    <Route path="videos" element={<AdminVideos />} />
    <Route path="videos/:id" element={<AdminVideoEdit />} />
    <Route path="ingest" element={<AdminIngest />} />
    <Route path="categories" element={<AdminCategories />} />
    <Route path="subscribers" element={<AdminSubscribers />} />
    <Route path="analytics" element={<AdminAnalytics />} />
  </Route>
</Routes>
```

Create `PublicLayout.tsx` — just renders `<NavBar />` + `<Outlet />`. Keeps `App.tsx` clean.

---

## 3. Page-by-page spec

### `AdminDashboard.tsx` — Overview

4 stat cards in a 2×2 grid (sm: 4-col):
- Total Videos (count from `videos` array)
- Categories (count)
- Transcript Words (sum of all `transcript` arrays)
- Subscribers (mock number, e.g. 142)

Each card: large number in `font-display text-4xl`, label in `font-mono text-xs uppercase`, subtle icon.

Below cards: **Recent Activity** feed — last 5 videos added, each row showing thumbnail, title, category badge, date published. Links to `/admin/videos/:id`.

Below that: **Quick Actions** row — buttons for "Ingest new video", "Manage categories", "View analytics".

---

### `AdminVideos.tsx` — Video Library

Full-width table of all videos. Columns:
- Thumbnail (40×28px)
- Title + channel (stacked)
- Category badge
- Duration (formatted mm:ss)
- Published date
- Affiliate links count (badge)
- Actions: Edit button → `/admin/videos/:id`, View button → `/video/:id` (opens in new tab), Delete button (removes from local state with confirmation)

Above table: search input (filters by title/channel client-side) + category dropdown filter.

Pagination: show 10 per page, prev/next buttons. Total count shown.

Empty state: illustrated placeholder if no results match filter.

---

### `AdminVideoEdit.tsx` — Edit Video

Two-column layout: left = form fields, right = preview card.

**Form fields:**
- Title (text input)
- Channel name (text input)
- Category (select dropdown — from `categories`)
- Tags (comma-separated text input, rendered as removable chips below)
- Published date (date input)
- Summary (textarea, 4 rows)
- Takeaways (dynamic list — each takeaway is an input row with a remove button, plus an "Add takeaway" button)
- Affiliate Links section — each link has: label input, URL input, disclosure select (`Affiliate link` | `Sponsored`), remove button. "Add link" button appends a row.

**Right preview:** shows the VideoCard component with live data from the form state.

Save button: updates local state (no backend yet), shows a "Saved." confirmation toast.

---

### `AdminIngest.tsx` — Ingest Pipeline

Existing `AdminPage.tsx` logic moved here verbatim. Same UI, same mock pipeline animation. Ingest button now navigates to `/admin/videos` after publish.

---

### `AdminCategories.tsx` — Category Manager

List of all categories (from `categories` constant). Each row:
- Category name
- Video count badge
- Rename button → inline edit (input replaces label, confirm/cancel)
- Delete button (disabled if videos exist in that category)

"Add category" form at bottom: text input + Add button. Adds to local state.

Drag handles (visual only — no actual drag/drop library needed; just show the ⠿ icon).

---

### `AdminSubscribers.tsx` — Email List

Mock subscriber table. Pre-populated with 12 fake email addresses, join dates, and status (Active / Unsubscribed).

Columns: Email, Joined, Status badge, Unsubscribe action.

Above table: total count + "Export CSV" button (generates a real CSV download from the mock data using a Blob URL).

Search/filter by email.

---

### `AdminAnalytics.tsx` — Analytics

**Stat tiles (top row):** Total Views (mock: 8,420), Avg. Time on Page (mock: 4m 12s), Search Queries (mock: 1,203), Email CTR (mock: 6.4%).

**Videos by Category** — horizontal bar chart, pure CSS (no chart library). Each bar is a `div` with `width` set as a percentage of max, labeled with category name and count.

**Top 5 Videos by Views** — ranked list with mock view counts, thumbnail, title, category.

**Transcript Coverage** — total words transcribed, formatted as "X,XXX words across Y videos."

All data is mock/computed from the existing `videos` array where possible (real counts for videos/categories/transcript words).

---

## 4. Admin visual style

Admin uses the same theme tokens as the public site but with a slightly denser UI:
- Text sizes one step smaller (`text-xs` for labels, `text-sm` for body)
- Tables: `border-collapse`, alternating row hover (`hover:bg-[var(--color-muted)]`)
- Form inputs: same border/bg/focus style as public site
- Buttons: primary = accent fill, secondary = outline (`border border-[var(--color-border)]`), danger = `text-red-600 hover:bg-red-50`
- Status badges: green for Active/Published, yellow for Draft, red for Unsubscribed — all using `font-mono text-[10px] uppercase`

No new dependencies needed — all UI is built from Tailwind utilities and the existing token set.

---

## Files to create/modify

| File | Action |
|---|---|
| `src/layouts/AdminLayout.tsx` | New — sidebar + content shell |
| `src/layouts/PublicLayout.tsx` | New — NavBar + Outlet wrapper |
| `src/pages/admin/AdminDashboard.tsx` | New |
| `src/pages/admin/AdminVideos.tsx` | New |
| `src/pages/admin/AdminVideoEdit.tsx` | New |
| `src/pages/admin/AdminIngest.tsx` | New — existing AdminPage logic moved here |
| `src/pages/admin/AdminCategories.tsx` | New |
| `src/pages/admin/AdminSubscribers.tsx` | New |
| `src/pages/admin/AdminAnalytics.tsx` | New |
| `src/App.tsx` | Restructure routes, add PublicLayout + AdminLayout nesting |
| `src/pages/AdminPage.tsx` | Delete (replaced by AdminIngest) |

---

## Verification

1. `/admin/dashboard` — 4 stat cards show real counts, recent activity lists last 5 videos
2. `/admin/videos` — all 8 mock videos listed; search filters by title; category dropdown filters; Edit navigates to edit page
3. `/admin/videos/v1` — form pre-filled with Ray Dalio video data; edit title → preview card updates live; Save shows confirmation
4. `/admin/ingest` — paste URL → pipeline animates → redirects to /admin/videos
5. `/admin/categories` — categories listed with video counts; add a new one → appears in list
6. `/admin/subscribers` — 12 mock rows; Export CSV downloads a real file
7. `/admin/analytics` — bars render proportionally; top 5 list shows mock view counts
8. Sidebar active state highlights current route correctly
9. Public site (`/`, `/video/:id`) still works — NavBar present, AdminLayout absent

---

# CLAUDE.md + Real Data Migration Plan

## Part A — Update CLAUDE.md

The current `CLAUDE.md` just says `@AGENTS.md`. Replace it with a proper file that documents what this project actually is, what it's for, and what has been built — useful for any AI session that opens the repo cold.

### New `CLAUDE.md` content

```markdown
@AGENTS.md

## Project: Signal — YouTube Curation Site

A content site that curates YouTube videos across multiple categories, giving each one a
synced clickable transcript, AI-generated summary, key takeaways, chapter markers, and a
site-wide full-transcript search. Built with React 19 + Vite 8 + Tailwind CSS v4.

### What exists

- **Pages:** `/` (blog feed), `/video/:id` (article + player), `/search` (full-transcript search), `/admin` (curator ingest, hidden)
- **Components:** NavBar (sticky, progress bar, mobile search), VideoCard, CategoryTabs, TranscriptPane (word-level sync), ChapterList, SummaryPanel (summary + takeaways + affiliate links), ShareBar, EmailCapture (banner/inline, localStorage dismiss), AdSlot (leaderboard/rectangle), RelatedVideos
- **Hook:** `useYouTubePlayer` — loads YouTube IFrame API once, polls currentTime every 250 ms, exposes `seekTo`, `playAt`, `isReady`, `isActive`
- **Data layer:** `src/data/videos.ts` — mock Video array + `getVideoById`, `getVideosByCategory`, `searchVideos`, `getRelatedVideos`. All currently static.
- **Types:** `src/data/types.ts` — `Video`, `Chapter`, `TranscriptWord`, `AffiliateLink`

### Theme

Warm light editorial. Fraunces (display), Inter (body), JetBrains Mono (labels/code).
Accent: `#d7402b` (terracotta red). Background: `#fffdf8` (cream). All color tokens use
`--color-*` prefix in CSS custom properties and `var(--color-*)` in Tailwind classes.

### Current data state

All data is **mock/static**. The next major milestone is migrating to real data:
a backend API (Supabase or similar), YouTube Data API v3 for metadata,
Whisper for transcripts, and an LLM for summaries/chapters.

### Code conventions

- Components: default exports, double-quoted strings (apostrophes safe)
- Tailwind v4: no config file, tokens in `src/index.css` `@theme` block
- CSS vars: always `var(--color-*)` — never `var(--accent)` without the `color-` infix
- No inline styles except for dynamic values (maxHeight transitions, progress bar width)
```

---

## Part B — Real Data Migration: What It Takes

### Context

The site runs entirely on a static mock array in `src/data/videos.ts`. Moving to real data requires: (1) a database to store curated video records, (2) the YouTube Data API for metadata, (3) a transcription service (Whisper) for word-level timestamps, (4) an LLM for summaries/takeaways/chapters, and (5) a React data-fetching layer to replace the current synchronous array lookups. This is a significant backend build — the frontend changes are actually modest.

---

### Stack recommendation

| Layer | Tool | Why |
|---|---|---|
| Database + Auth + Storage | **Supabase** | Postgres + REST/realtime API + Auth out of the box; works well with Vite frontends |
| YouTube metadata | **YouTube Data API v3** | Free, 10,000 quota units/day; fetches title, channel, thumbnail, duration, publishedAt |
| Transcription | **Groq Whisper API** | Free tier — `whisper-large-v3` via Groq, word-level timestamps, extremely fast |
| Summarization / chapters | **Groq LLaMA 3.3 70B** | Free tier — structured JSON output, same quality as paid LLMs for this task |
| Frontend data fetching | **TanStack Query (react-query)** | Caching, loading/error states, background refresh — cleaner than raw `useEffect` |
| Admin pipeline | **Supabase Edge Functions** or **Node.js API route** | Runs the 4-step pipeline (YouTube → Whisper → Claude → DB write) server-side |

#### Free alternatives breakdown

**Transcription (replacing OpenAI Whisper paid API):**
- **Groq** *(recommended)* — serves `whisper-large-v3` free with a generous rate limit. Same model, same accuracy, word-level timestamps. Single API key covers both transcription and summarization. Sign up at console.groq.com.
- **Self-hosted Whisper** — OpenAI released Whisper as open source (`openai/whisper` on GitHub). Run it on any machine. Free forever, but needs a GPU for speed (CPU is slow). Best for a VPS or local dev machine.
- **Deepgram** — free tier: 12,000 minutes/year (~200 hrs). Word-level timestamps supported.
- **AssemblyAI** — free tier: limited hours/month, good accuracy.

**Summarization (replacing Claude paid API):**
- **Groq** *(recommended)* — `llama-3.3-70b-versatile` or `mixtral-8x7b` on free tier. Structured JSON output works well for takeaways + chapters. Same Groq key as above.
- **Google Gemini** — `gemini-1.5-flash` via AI Studio has a free tier (15 req/min, 1M tokens/day). Very capable.
- **Ollama** — run any open model locally (Llama 3, Mistral, etc.) completely free. Best if you have a capable laptop or desktop. No rate limits.
- **Hugging Face Inference API** — free serverless inference for open models; slower cold starts.

#### Recommended free setup (zero cost to start)

Use **Groq** for both transcription and summarization. One account, one API key, free tier is enough for a curator doing a few videos per day. Only cost is Supabase (free tier: 500 MB DB, 2 GB bandwidth) and YouTube Data API (free: 10,000 units/day).

---

### Database schema (Supabase / Postgres)

```sql
-- videos table — mirrors the Video interface
create table videos (
  id            uuid primary key default gen_random_uuid(),
  youtube_id    text not null unique,
  title         text not null,
  channel_name  text not null,
  published_at  date not null,
  duration_sec  integer not null,
  category      text not null,
  thumbnail_url text not null,
  summary       text,
  takeaways     text[],         -- array of bullet strings
  tags          text[],
  created_at    timestamptz default now()
);

-- chapters table
create table chapters (
  id         uuid primary key default gen_random_uuid(),
  video_id   uuid references videos(id) on delete cascade,
  title      text not null,
  start_time numeric not null,  -- seconds
  description text
);

-- transcript_words table
create table transcript_words (
  id         bigserial primary key,
  video_id   uuid references videos(id) on delete cascade,
  text       text not null,
  start_time numeric not null,
  end_time   numeric not null
);

-- affiliate_links table
create table affiliate_links (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid references videos(id) on delete cascade,
  label       text not null,
  url         text not null,
  disclosure  text not null
);
```

Row-level security: videos/chapters/transcript_words are public read; affiliate_links are public read; writes require service-role key (backend only).

---

### Frontend changes needed

The current `src/data/videos.ts` exports synchronous functions. These need to become async hooks backed by Supabase client calls. The `Video` type stays the same — Supabase rows are mapped to it on fetch.

**New files:**
- `src/lib/supabase.ts` — initialise the Supabase client with env vars
- `src/hooks/useVideos.ts` — TanStack Query hooks wrapping Supabase queries

**Hooks to write:**

```ts
useVideos(category: string)          // replaces getVideosByCategory
useVideo(id: string)                 // replaces getVideoById (fetches video + chapters + words + affiliates)
useSearch(query: string)             // replaces searchVideos — can use Postgres full-text search
useRelatedVideos(video: Video)       // replaces getRelatedVideos — ORDER BY shared tags
```

**Pages to update:**

| Page | Change |
|---|---|
| `HomePage.tsx` | Replace `getVideosByCategory(activeCategory)` with `useVideos(activeCategory)` hook; add loading skeleton + error state |
| `VideoPage.tsx` | Replace `getVideoById(id)` with `useVideo(id)` hook; add loading/error |
| `SearchPage.tsx` | Replace `searchVideos(query)` with `useSearch(query)` hook |
| `AdminPage.tsx` | POST to backend pipeline endpoint instead of fake setTimeout delays |

**`src/data/videos.ts`** — keep the mock array for development/fallback; mark it clearly as dev-only. Long-term delete when backend is stable.

---

### Backend pipeline (the real Admin flow)

The 4-step admin pipeline currently fakes each step with `setTimeout`. In production it becomes a real API call:

```
POST /api/ingest { youtubeUrl }
  1. Call YouTube Data API v3 → extract metadata
  2. Download audio → call Whisper API → word-level transcript
  3. Send transcript to Claude → structured JSON: summary, takeaways[], chapters[]
  4. Write all rows to Supabase (video + chapters + transcript_words)
  → return { videoId }
```

This runs server-side (Supabase Edge Function or a small Express/Fastify worker). The frontend just polls or subscribes to the video row appearing.

---

### Environment variables needed

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
# Backend only (never exposed to browser):
SUPABASE_SERVICE_ROLE_KEY=eyJ...
YOUTUBE_API_KEY=AIza...          # free — console.cloud.google.com
GROQ_API_KEY=gsk_...             # free — console.groq.com (Whisper + LLaMA)
# Only needed if you choose Gemini instead of Groq for summaries:
# GOOGLE_AI_API_KEY=AIza...
```

---

### Migration phases (recommended order)

| Phase | What | Effort |
|---|---|---|
| 1 | Set up Supabase project, create tables, seed with mock data | 1–2 hours |
| 2 | Add Supabase client + TanStack Query; wire `useVideos` + `useVideo` into pages | 2–3 hours |
| 3 | Wire `useSearch` with Postgres full-text (`to_tsvector`) | 1 hour |
| 4 | Build the ingest pipeline (Edge Function or Node worker) | 4–8 hours |
| 5 | Wire Admin page to real pipeline endpoint | 1 hour |
| 6 | Remove mock data array | 30 min |

Phases 1–3 can be done in a single session and give you a fully live frontend with real DB-backed data immediately. Phases 4–6 complete the curator workflow.

---

### What stays exactly the same

- All components (NavBar, VideoCard, TranscriptPane, ChapterList, etc.)
- `useYouTubePlayer` hook — already production-ready
- `src/data/types.ts` — the `Video` shape is correct for real data too
- All routing, theming, animations

The data layer swap is surgical — the components never touch `videos.ts` directly; they receive props. Only the pages need updating.

---

### Files to create/modify

| File | Action |
|---|---|
| `CLAUDE.md` | Rewrite with project documentation |
| `src/lib/supabase.ts` | New — Supabase client init |
| `src/hooks/useVideos.ts` | New — TanStack Query hooks |
| `src/pages/HomePage.tsx` | Swap sync call → hook, add loading state |
| `src/pages/VideoPage.tsx` | Swap sync call → hook, add loading state |
| `src/pages/SearchPage.tsx` | Swap sync call → hook |
| `src/pages/AdminPage.tsx` | Wire to real POST endpoint |
| `src/data/videos.ts` | Mark as dev-only, eventually delete |

---

### What we can implement right now (without a backend)

The CLAUDE.md rewrite can be done immediately. For the data layer, we can:
1. Install TanStack Query + Supabase client
2. Write the hooks using the mock array as the data source (same API, no network calls yet)
3. Update all pages to use hooks instead of direct imports

This makes pages ready for real data — just swap the mock calls inside the hooks for Supabase calls when the DB is ready. Zero UI changes required at that point.

---

# Related Videos

## Context

Each video page ends abruptly after the transcript. Adding a "More to read" section at the bottom surfaces related content, keeps users on site, and signals that the curation library is broad. Related videos are scored by shared tags (higher weight) and same category (lower weight), so the results feel genuinely relevant.

---

## 1. `getRelatedVideos` utility — `src/data/videos.ts`

Add a new exported function:

```ts
export function getRelatedVideos(video: Video, limit = 3): Video[] {
  return videos
    .filter((v) => v.id !== video.id)
    .map((v) => {
      const sharedTags = v.tags.filter((t) => video.tags.includes(t)).length
      const sameCategory = v.category === video.category ? 1 : 0
      return { video: v, score: sharedTags * 2 + sameCategory }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.video)
}
```

---

## 2. `RelatedVideos` component — new `src/components/RelatedVideos.tsx`

Props: `videos: Video[]`

Layout: horizontal 3-column grid on `sm+`, single column on mobile. Each card is a `<Link to="/video/:id">` block:
- Thumbnail (16/9 aspect ratio, `object-cover`, rounded-sm)
- Category badge (`font-mono text-xs uppercase text-[var(--color-accent)]`)
- Title (`font-display text-base` leading-snug, hover color transitions to accent)
- Channel name (`font-mono text-xs text-[var(--color-muted-foreground)]`)

Section heading: `"More to Read"` in the same `font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]` style used elsewhere. Divider line above the section (`border-t border-[var(--color-border)] pt-10`).

---

## 3. Wire into `VideoPage.tsx`

Import `getRelatedVideos` and `RelatedVideos`. At the bottom of `VideoDetail`, after the two-column grid, compute `related = getRelatedVideos(video)` and render:

```tsx
{related.length > 0 && (
  <div className="mt-16 border-t border-[var(--color-border)] pt-10">
    <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
      More to Read
    </h2>
    <RelatedVideos videos={related} />
  </div>
)}
```

---

## Files Modified

| File | Change |
|---|---|
| `src/data/videos.ts` | Add `getRelatedVideos` export |
| `src/components/RelatedVideos.tsx` | New component |
| `src/pages/VideoPage.tsx` | Import and render at bottom of `VideoDetail` |

---

## Verification

1. Open any Finance video — 3 related cards appear below the transcript, same-category videos ranked first
2. Click a related card — navigates to that video page, related section refreshes with new relatives
3. Mobile (375px) — cards stack vertically, thumbnails render correctly
4. A video with unique tags (low overlap) — still shows 3 results (falls back to same-category, then any video)

---

# Monetization Layer

## Context

The site needs three revenue mechanisms wired in: an affiliate link system attached to individual videos (shown in the summary panel), an email capture banner (homepage + video pages), and ad slot placeholders (realistic-looking boxes positioned where real display ads would go). Everything is frontend-only; the email form saves to local state and `localStorage`. The affiliate links live in the video data and render below takeaways.

---

## 1. Affiliate Links in Video Data

**Files:** `src/data/types.ts`, `src/data/videos.ts`, `src/components/SummaryPanel.tsx`

### `types.ts` — add interface and extend `Video`

```ts
export interface AffiliateLink {
  label: string       // "Get the book on Amazon →"
  url: string         // full URL (placeholder for now)
  disclosure: string  // "Affiliate link" | "Sponsored"
}

// Add to Video:
affiliateLinks?: AffiliateLink[]
```

### `videos.ts` — seed 2–3 affiliate links per Finance video

Examples for "How the Economic Machine Works":
```ts
affiliateLinks: [
  { label: "Principles by Ray Dalio — Amazon", url: "https://amzn.to/example", disclosure: "Affiliate link" },
  { label: "Open a brokerage account — Interactive Brokers", url: "https://ibkr.com/example", disclosure: "Sponsored" },
]
```

### `SummaryPanel.tsx` — add affiliate links section

Render a third section below takeaways titled "Resources & Links". Each link is an `<a target="_blank">` row with:
- Label text (semibold)
- Disclosure badge (`font-mono text-[10px] uppercase text-[var(--color-muted-foreground)] border border-[var(--color-border)]`)
- External link arrow icon
- Subtle hover: background shifts to `var(--color-muted)`, border-left accent stripe

Props: add `affiliateLinks?: AffiliateLink[]` — only render the section if the array is non-empty.

---

## 2. Email Capture Banner

**File:** new `src/components/EmailCapture.tsx`

A single self-contained component used in two places:

**Homepage** — full-width banner between the hero and category tabs.  
**Video page** — inline block between the summary panel and the transcript section.

### Behaviour
- State: `email`, `submitted`, `dismissed`
- On mount, read `localStorage.getItem("signal-email-dismissed")` — if `"1"`, render nothing.
- Dismiss button sets `localStorage` key and hides the banner.
- Submit: sets `submitted = true`, shows a "You're on the list." confirmation message. No real API call.

### Visual
- Homepage variant (`variant="banner"`): full-width, cream card with a thin red left border, heading + one-line description + email input + button in a horizontal row on desktop, stacked on mobile.
- Video variant (`variant="inline"`): same but smaller, softer, fits between content sections. No left border. Just a simple CTA block.

Props: `variant: "banner" | "inline"`

---

## 3. Ad Slot Placeholders

**File:** new `src/components/AdSlot.tsx`

A styled placeholder that looks like a real ad unit. Renders a box with:
- Dashed border `border border-dashed border-[var(--color-border)]`
- Background `bg-[var(--color-muted)]`
- Centered "Advertisement" label in `font-mono text-xs text-[var(--color-muted-foreground)]`
- Small note: "This space is available for display advertising"

Props: `size: "leaderboard" | "rectangle"`
- `leaderboard` — `w-full h-24` (728×90 equivalent), used in homepage between category tabs and video list
- `rectangle` — `w-full h-64 max-w-xs` (300×250 equivalent), used in video page sidebar below chapters

### Placement
- `HomePage.tsx` — one `<AdSlot size="leaderboard" />` between `<CategoryTabs>` and the video list
- `VideoPage.tsx` — one `<AdSlot size="rectangle" />` below `<ChapterList>` in the sticky aside

---

## Files Modified

| File | Change |
|---|---|
| `src/data/types.ts` | Add `AffiliateLink` interface + `affiliateLinks?` to `Video` |
| `src/data/videos.ts` | Seed affiliate links on Finance videos |
| `src/components/SummaryPanel.tsx` | Add "Resources & Links" section |
| `src/components/EmailCapture.tsx` | New — email capture banner |
| `src/components/AdSlot.tsx` | New — ad placeholder |
| `src/pages/HomePage.tsx` | Add EmailCapture (banner) + AdSlot (leaderboard) |
| `src/pages/VideoPage.tsx` | Add EmailCapture (inline) + AdSlot (rectangle in aside) |

---

## Verification

1. Homepage: email capture banner appears below hero, can be dismissed (refresh → gone), can "subscribe" (shows confirmation)
2. Homepage: leaderboard ad slot visible between category tabs and video list
3. Video page (Finance video): "Resources & Links" section appears in summary panel with affiliate links, each opens in new tab
4. Video page: inline email capture between summary and transcript
5. Video page: rectangle ad slot below chapter list in sidebar
6. Non-Finance video or video without affiliateLinks: no "Resources & Links" section rendered

---

# Theme Overhaul: Warm Light + Fraunces/Inter/JetBrains

## Context

The current dark theme (DM fonts, amber accent, near-black ground) is being replaced with a warm light editorial system: cream background, dark ink foreground, terracotta-red accent (`#d7402b`), Fraunces display serif, Inter body, JetBrains Mono for code/labels. The user supplied the exact CSS to use as `src/index.css`.

This requires two kinds of changes across the codebase:
1. **`src/index.css`** — complete replacement with user-supplied CSS (plus `fadeUp` keyframe and `.page-enter` animation)
2. **All components and pages** — rename every CSS variable reference from `var(--X)` to `var(--color-X)` for color tokens, and fix the one `font-body` reference to `font-sans`. Also fix `text-black` used on accent-colored surfaces (old accent was amber, new is red — foreground is now `#fffdf8` light, not black).

---

## Changes

### 1. `src/index.css` — full replacement

Replace the entire file with the user-supplied CSS, appending:

```css
/* Page enter animation */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.page-enter {
  animation: fadeUp 0.25s ease-out both;
}
```

No `.font-display`, `.font-sans`, `.font-mono` utility classes needed — Tailwind v4's `@theme` block auto-generates `font-display`, `font-sans`, `font-mono` utilities from the `--font-*` tokens.

### 2. Global variable rename (all src/ files except index.css)

Every color token reference changes by adding the `color-` infix:

| Old | New |
|---|---|
| `var(--background)` | `var(--color-background)` |
| `var(--foreground)` | `var(--color-foreground)` |
| `var(--card)` | `var(--color-card)` |
| `var(--card-foreground)` | `var(--color-card-foreground)` |
| `var(--accent)` | `var(--color-accent)` |
| `var(--accent-foreground)` | `var(--color-accent-foreground)` |
| `var(--muted)` | `var(--color-muted)` |
| `var(--muted-foreground)` | `var(--color-muted-foreground)` |
| `var(--border)` | `var(--color-border)` |
| `var(--primary)` | `var(--color-primary)` |
| `var(--primary-foreground)` | `var(--color-primary-foreground)` |

Files to update (every component and page):
- `src/App.tsx`
- `src/components/NavBar.tsx`
- `src/components/VideoCard.tsx`
- `src/components/CategoryTabs.tsx`
- `src/components/ShareBar.tsx`
- `src/components/TranscriptPane.tsx`
- `src/components/ChapterList.tsx`
- `src/components/SummaryPanel.tsx`
- `src/pages/HomePage.tsx`
- `src/pages/VideoPage.tsx`
- `src/pages/SearchPage.tsx`
- `src/pages/AdminPage.tsx`

### 3. Specific fixups

- **`src/components/TranscriptPane.tsx` line 66**: `font-body` → `font-sans`
- **`src/components/CategoryTabs.tsx`**: active tab uses `text-black` (text on old amber accent). Change to `text-[var(--color-accent-foreground)]` since the new accent is red with a light foreground (`#fffdf8`).
- **`src/pages/AdminPage.tsx`**: `bg-[var(--accent)] … text-black` button → change `text-black` to `text-[var(--color-accent-foreground)]`. Same for Search page's submit button.
- **`src/components/NavBar.tsx`**: progress bar uses `bg-[var(--accent)]` → `bg-[var(--color-accent)]`. Mobile "Go" button uses `text-[var(--accent)]` → `text-[var(--color-accent)]`.
- **Shadow on sticky player** (`shadow-[0_4px_24px_rgba(0,0,0,0.7)]`): lighten to `shadow-[0_4px_24px_rgba(0,0,0,0.15)]` — the heavy black shadow looks wrong on a light background.
- **Thumbnail overlay** (`bg-black/30`): keep as-is — it's over the video image, not the page.
- **Player close button** (`bg-black/70`): keep as-is — it's over the video player.

---

## Files Modified

| File | Type of change |
|---|---|
| `src/index.css` | Full replacement |
| `src/App.tsx` | Variable rename |
| `src/components/NavBar.tsx` | Variable rename |
| `src/components/VideoCard.tsx` | Variable rename |
| `src/components/CategoryTabs.tsx` | Variable rename + `text-black` fix |
| `src/components/ShareBar.tsx` | Variable rename |
| `src/components/TranscriptPane.tsx` | Variable rename + `font-body` → `font-sans` |
| `src/components/ChapterList.tsx` | Variable rename |
| `src/components/SummaryPanel.tsx` | Variable rename |
| `src/pages/HomePage.tsx` | Variable rename |
| `src/pages/VideoPage.tsx` | Variable rename + shadow lighten |
| `src/pages/SearchPage.tsx` | Variable rename + `text-black` fix |
| `src/pages/AdminPage.tsx` | Variable rename + `text-black` fix |

---

## Verification

1. Homepage: warm cream background, dark ink text, red accent on category tab and category badges
2. Video card: title hover turns red, not amber
3. Video page: thumbnail loads, click word → player opens smoothly; transcript highlight is red
4. Search: submit button is red with light text; highlight mark is `red/30`
5. Progress bar in nav: red
6. Share buttons: red on hover
7. Admin pipeline step indicators: red checkmarks and spinner
8. No visual `text-black` on red surfaces — all accent-surface text should be cream `#fffdf8`

---

# Polish & UX Improvements

## Context

The core site is functional. This pass focuses on four UX improvements: mobile layout, smoother transitions, a reading progress bar, and share buttons. The goal is to make the site feel finished and professional, not just correct.

---

## 1. Reading Progress Bar

**File:** `src/components/NavBar.tsx`

Add a thin 2px amber bar fixed to the bottom edge of the sticky navbar that fills left-to-right as the user scrolls the page. Uses a `scroll` event listener on `window` with `scrollY / (documentElement.scrollHeight - innerHeight)`.

```tsx
const [progress, setProgress] = useState(0)
useEffect(() => {
  const onScroll = () => {
    const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)
    setProgress(Math.min(1, pct))
  }
  window.addEventListener("scroll", onScroll, { passive: true })
  return () => window.removeEventListener("scroll", onScroll)
}, [])
```

Render as an absolutely positioned div at the bottom of the header, `width: ${progress * 100}%`, `transition: width 100ms linear`.

---

## 2. Share Buttons

**File:** new `src/components/ShareBar.tsx`, used in `src/pages/VideoPage.tsx`

A small row of share actions placed just below the article title/tags on the video page:

- **Copy link** — `navigator.clipboard.writeText(window.location.href)`, shows a "Copied!" flash for 2s
- **Share on X (Twitter)** — opens `https://twitter.com/intent/tweet?url=…&text=<title>` in a new tab
- **Share on LinkedIn** — opens `https://www.linkedin.com/sharing/share-offsite/?url=…`

Icons: minimal inline SVGs, no library needed. Amber on hover. Font mono labels.

---

## 3. Smoother Transitions

### Page transitions
**File:** `src/index.css`

Add a `@keyframes fadeUp` animation and apply it to `main` elements via a `.page-enter` class:

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.page-enter {
  animation: fadeUp 0.25s ease-out both;
}
```

Apply `page-enter` class to the `<main>` in `HomePage.tsx`, `VideoPage.tsx` (`VideoDetail`), `SearchPage.tsx`, and `AdminPage.tsx`.

### Player open/close transition
**File:** `src/pages/VideoPage.tsx` (`VideoDetail`)

Replace abrupt `hidden`/`block` toggle on the player div with a height+opacity transition:

```tsx
// Instead of class toggling hidden/block:
style={{
  maxHeight: playerOpen ? "480px" : "0px",
  opacity: playerOpen ? 1 : 0,
  overflow: "hidden",
  transition: "max-height 0.35s ease, opacity 0.25s ease",
}}
```

Remove the `hidden` / `block` className toggle — control visibility via the style above.

### VideoCard hover
**File:** `src/components/VideoCard.tsx`

Add `transition-colors duration-200` to the article and ensure the title color transition is `duration-200` (already has `transition-colors`, just verify it's smooth).

---

## 4. Mobile Layout

### NavBar (`src/components/NavBar.tsx`)
- Search input: on mobile (`< sm`) collapse to an icon button that expands an overlay input. On `sm+` show the inline search as-is.
- Implementation: `searchOpen` boolean state. When closed, show a magnifier icon button. When open, show a full-width input with a close button.

### VideoCard (`src/components/VideoCard.tsx`)
- Currently `grid-cols-[1fr_200px]` on `sm`. On mobile it stacks (`grid-cols-1`) — thumbnail renders below text. Reorder so thumbnail comes first on mobile using `order-first sm:order-last` on the image div.

### VideoPage (`src/pages/VideoPage.tsx`)
- The two-column `lg:grid-cols-[1fr_260px]` layout already collapses on mobile.
- Chapters aside: on mobile, move chapters above the transcript (currently it renders after in DOM order, which is fine — just verify it renders before the transcript at `< lg`). Add `order-first lg:order-last` to the aside.
- Transcript timestamp gutters (`pl-10`) are already hidden on mobile — keep as-is.

### ShareBar spacing
- On mobile, the share bar wraps gracefully with `flex-wrap gap-3`.

---

## Files to Modify

| File | Change |
|---|---|
| `src/components/NavBar.tsx` | Progress bar + mobile search toggle |
| `src/components/VideoCard.tsx` | Thumbnail order on mobile |
| `src/components/ShareBar.tsx` | New file — share buttons |
| `src/pages/VideoPage.tsx` | Add ShareBar, player transition, chapters mobile order |
| `src/pages/HomePage.tsx` | Add `page-enter` class |
| `src/pages/SearchPage.tsx` | Add `page-enter` class |
| `src/pages/AdminPage.tsx` | Add `page-enter` class |
| `src/index.css` | `fadeUp` keyframe + `.page-enter` |

---

## Verification

1. Desktop: scroll a video page — amber progress bar fills in the nav
2. Desktop: video page — click share → copy link flashes "Copied!", X/LinkedIn open correct URLs
3. Desktop: navigate between pages — subtle fade-up on each page load
4. Desktop: open/close the player — smooth height+opacity animation instead of snap
5. Mobile (375px): nav shows magnifier icon; tap it → full-width search input appears
6. Mobile: VideoCard thumbnail renders above text
7. Mobile: video page chapters appear above transcript

---

# Plan: YouTube Curation Site with Synced Transcripts

## Context

A solo curator wants to paste YouTube URLs and get fully-published video pages with zero manual work. Each page has: an embedded YouTube player, a word-level synced transcript (click → seek), AI-generated summary + key takeaways + chapter markers, and a site-wide full-transcript search bar. Categories start with Finance but expand.

This is a React + Vite frontend-only prototype. The actual AI pipeline (transcription, summarization) requires backend services in production. The prototype ships realistic mock data with full working interactivity — the YouTube IFrame API integration, clickable transcript sync, and search are all real and functional.

---

## Aesthetic

**Stance:** Minimalist, dark-ground editorial. Think Pitchfork meets a fintech terminal. Clean, content-first, deliberate whitespace.

**Palette:**
- Background: `#0a0a0a` (near-black)
- Foreground: `#f0ede6` (warm cream)
- Card: `#141414`
- Primary accent: `#f5a623` (electric amber — interactive elements, highlights, active states)
- Muted: `#1e1e1e`
- Muted foreground: `#6b6b6b`
- Border: `#242424`

**Fonts (Google Fonts via CSS @import):**
- Display headings: `DM Serif Display` — editorial weight, distinctive serif
- Body + UI: `DM Sans` — clean, pairs well
- Timestamps + labels: `DM Mono`

---

## Layout Philosophy

- **Homepage / index** = blog feed. Videos listed as dated posts: thumbnail, category tag, title, channel, one-line excerpt from the AI summary. Newest first. Category tabs filter the feed.
- **Video page** = long-form article. Sticky YouTube player at the top; below it the article unfolds — AI summary, key takeaways, chapter markers, then the full transcript as continuous readable prose with word-level sync highlighting. Feels like reading a piece, not using a tool.
- **Admin** = hidden at `/admin`, not linked from public nav.

---

## Architecture

### Pages (React Router v6)

| Route | Component | Purpose |
|---|---|---|
| `/` | `HomePage` | Blog-feed index with category filter tabs |
| `/video/:id` | `VideoPage` | Long-form article: sticky player + transcript |
| `/search` | `SearchPage` | Full-transcript search results |
| `/admin` | `AdminPage` | Hidden curator paste-URL ingest panel |

### File Structure

```
src/
  App.tsx                    — Router shell, nav bar, dark theme
  index.css                  — @imports (fonts), Tailwind, CSS vars
  pages/
    HomePage.tsx             — Category filter + video grid
    VideoPage.tsx            — Player + transcript sync + summary
    SearchPage.tsx           — Global transcript search
    AdminPage.tsx            — Curator ingest panel
  components/
    NavBar.tsx               — Site-wide nav + search input
    VideoCard.tsx            — Thumbnail card with category badge
    TranscriptPane.tsx       — Word-level synced transcript
    ChapterList.tsx          — Chapter markers with seek-on-click
    SummaryPanel.tsx         — AI summary + key takeaways
    SearchBar.tsx            — Controlled search input
    CategoryTabs.tsx         — Horizontal filter tabs
  hooks/
    useYouTubePlayer.ts      — YouTube IFrame API wrapper (load, seek, poll)
  data/
    videos.ts                — Mock video records with full transcripts
    types.ts                 — TypeScript interfaces
```

---

## Key Technical Details

### YouTube IFrame API Sync

`useYouTubePlayer.ts` wraps the YouTube IFrame API:
- Loads `https://www.youtube.com/iframe_api` once via script injection
- Exposes `playerRef`, `currentTime`, `seekTo(seconds)`
- Polls `player.getCurrentTime()` every 250ms via `setInterval` while playing
- Fires state change events to start/stop the polling interval

`TranscriptPane.tsx`:
- Each word/phrase has a `{ text, startTime, endTime }` shape
- Active word = the one whose `startTime <= currentTime < endTime`
- Active word gets amber highlight + `auto-scroll` via `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`
- Click handler calls `seekTo(word.startTime)`

### Data Model (`types.ts`)

```ts
interface TranscriptWord {
  text: string
  startTime: number   // seconds
  endTime: number
}

interface Chapter {
  title: string
  startTime: number
  description: string
}

interface Video {
  id: string
  youtubeId: string
  title: string
  channelName: string
  publishedAt: string
  durationSeconds: number
  category: string        // "Finance" | "Tech" | "Science" | ...
  thumbnailUrl: string
  summary: string         // AI-generated paragraph
  takeaways: string[]     // 3-5 bullet points
  chapters: Chapter[]
  transcript: TranscriptWord[]
  tags: string[]
}
```

### Site-Wide Search

`SearchPage.tsx` receives `?q=` query param. Searches across:
- `video.title`
- `video.summary`
- `video.transcript` (joined text, then find matching segment index for context snippet)

Returns results with: title, thumbnail, category, matched transcript snippet with query terms bolded, and a link to `/video/:id?t=<matchStartTime>` so the video page opens at the matching moment.

`VideoPage.tsx` reads `?t=` on mount and calls `seekTo(t)` after the player is ready.

### Admin Ingest Panel

`AdminPage.tsx` shows:
1. URL input field (paste a YouTube URL)
2. Mock "Process" button → shows animated pipeline steps:
   - "Fetching video metadata..." ✓
   - "Extracting transcript..." ✓
   - "Generating AI summary..." ✓
   - "Publishing page..." ✓
3. Published video appears in a "Recently Added" list with a link
4. Note explaining that in production this calls a backend worker

The panel uses realistic fake latency (`setTimeout`) to show each step completing, making the workflow tangible for demo/investor purposes.

---

## Mock Data

Provide 6 realistic Finance videos and 2-3 videos each for Tech and Science categories. Each video needs:
- A real YouTube ID for a well-known public video (financial explainers, tech talks)
- ~30-50 transcript words/phrases with realistic timestamps
- A 2-paragraph AI summary
- 4-5 key takeaways
- 3-4 chapters

---

## CSS / Styling

Add to `src/index.css` (before `@import 'tailwindcss'`):
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
```

Define CSS custom properties in `:root` for the dark palette. Use Tailwind utility classes referencing those vars throughout.

---

## Dependencies to Install

- `react-router-dom` (v6) — page routing
- No charting, no heavy deps needed

Install: `pnpm add react-router-dom`

---

## Verification

1. Homepage loads with category tabs (Finance selected) + video grid
2. Click a video card → VideoPage loads with embedded YouTube player
3. Press play → transcript words highlight in sync as video plays
4. Click a transcript word → player seeks to that timestamp
5. Chapter list: click a chapter → player seeks
6. Search bar: type a query → SearchPage shows transcript snippet results
7. Click a search result → VideoPage opens at the matched timestamp (`?t=`)
8. `/admin` → paste a URL → animated pipeline steps complete → video appears in list
9. Test on narrow viewport (~640px) — nav collapses, transcript stacks below player
