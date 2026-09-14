# Signal — YouTube Video Curation Site

Next.js 15 (App Router) + Tailwind CSS v4 + Supabase. Production lives in `web/`
(deployed to Vercel with Root Directory `web/`); repo root holds local
ingest/maintenance tooling only (never deployed).

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `web/app/` - Next.js routes: `(public)/` (feed, `/video/[id]`, `/search`), `admin/` (login + `(panel)` shell and pages — `review/` is the candidate approval queue, `sources/` manages discovery channels + saved searches from Supabase), `sitemap.ts`, `robots.ts`
- `web/components/` - Presentational components + client islands (`video-detail`, `site-header`, `transcript-pane`)
- `web/lib/` - Server data layer (`videos.ts`), Supabase browser/server clients, `transcript.ts` (paragraphing), `auth-client.ts`
- `web/middleware.ts` - Edge gate for `/admin/*` (session + `ADMIN_EMAILS` allow-list, fail closed)
- `web/package.json` - App dependencies and `dev`/`build`/`start` scripts (own `pnpm-lock.yaml`)
- `scripts/` - Local ingest + discovery pipeline run from the curator's machine (YouTube blocks datacenter IPs): `ingest.mjs` (single/batch CLI wrapper), `ingest-core.mjs` (shared `ingestOne` pipeline — relay parses its console lines, keep them byte-stable), `discover.mjs` (discovery worker: channels + searches + related mining → scores via Groq → `video_candidates`), `auto-pipeline.mjs` (scheduled discover + ingest of approved candidates), `backfill-sources.mjs` (one-time PRESEED import), `serve-ingest.mjs` (localhost relay for the admin UI), `clean-transcripts.mjs`, `backfill-frames.mjs`, `frames.mjs`, `ensure-ytdlp.mjs`
- `scripts/.env` - Tooling secrets (service-role key lives here, never in the browser)
- `supabase/` - `schema.sql`, `migrations/`, edge `functions/ingest` (cloud fallback) + `functions/curate` (admin writes: approve/reject candidates, manage sources/searches)
- `package.json` (root) - Tooling-only deps (`@supabase/supabase-js`, `dotenv`, `youtube-dl-exec`); scripts are `ingest`, `ingest:serve`, `transcripts:clean`, `frames:backfill`, `discover`, `auto`, `sources:backfill`
- Discovery flow: `discover.mjs` stages candidates as `pending` in `video_candidates` (nothing publishes) → curator approves in `/admin/review` → scheduled `npm run auto` (Task Scheduler/cron on the curator's machine) ingests approved rows through `ingest-core.mjs`. Search-discovery polls `search_queries` with `publishedAfter=last_polled_at` (search.list costs 100 quota units); channel polling costs 1 unit per channel via `playlistItems.list` on `UU…` uploads playlists; related mining uses the unofficial `youtubei/v1/next` endpoint (best-effort). Tables: `source_channels`, `search_queries`, `video_candidates` (migration `20260914_discovery_queue.sql`)
- `.mise.toml` - Toolchain versions for Node.js and pnpm
- `web/` is deployed to Vercel with Root Directory `web/` (no root `vercel.json`; the legacy SPA rewrite retired with the Vite app)

## Dependencies

- App (`web/`): Next 15, React 19, `@supabase/ssr` + `@supabase/supabase-js`, `sonner` (all notifications as toasts), Tailwind CSS v4 via `@tailwindcss/postcss`
- Tooling (root): Node scripts only, no framework
- Fonts: `next/font` (Fraunces display, Inter body, JetBrains Mono); theme tokens in `web/app/globals.css` `@theme` block

## Styling

Tailwind CSS v4, no config file. Use utility classes directly in JSX; global CSS and `@theme` customization live in `web/app/globals.css`. CSS vars always use the `color-` infix (`var(--color-*)`). Editorial palette: cream `#fffdf8` background, ink text, terracotta accent `#d7402b`.

## Conventions

- Server components by default; `"use client"` only for islands (player, transcript sync, search inputs, admin interactivity)
- Per-page SEO via `generateMetadata` (`/video/[id]` sets title/description/OG); ISR via `export const revalidate`
- Admin writes go through the service role (relay/edge function), never the anon key
- Components: default exports, double quotes for strings containing apostrophes
- Env: `NEXT_PUBLIC_*` is browser-safe; `ADMIN_EMAILS` and service-role keys are server-only — never leak them into client code or logs
