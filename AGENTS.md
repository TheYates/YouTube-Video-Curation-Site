# Signal — YouTube Video Curation Site

Next.js 15 (App Router) + Tailwind CSS v4 + Supabase. Production lives in `web/`
(deployed to Vercel with Root Directory `web/`); repo root holds local
ingest/maintenance tooling only (never deployed).

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `web/app/` - Next.js routes: `(public)/` (feed, `/video/[id]`, `/search`), `admin/` (login + `(panel)` shell and pages), `sitemap.ts`, `robots.ts`
- `web/components/` - Presentational components + client islands (`video-detail`, `site-header`, `transcript-pane`)
- `web/lib/` - Server data layer (`videos.ts`), Supabase browser/server clients, `transcript.ts` (paragraphing), `auth-client.ts`
- `web/middleware.ts` - Edge gate for `/admin/*` (session + `ADMIN_EMAILS` allow-list, fail closed)
- `web/package.json` - App dependencies and `dev`/`build`/`start` scripts (own `pnpm-lock.yaml`)
- `scripts/` - Local ingest pipeline run from the curator's machine (YouTube blocks datacenter IPs): `ingest.mjs` (single/batch CLI), `serve-ingest.mjs` (localhost relay for the admin UI), `clean-transcripts.mjs`, `backfill-frames.mjs`, `frames.mjs`, `ensure-ytdlp.mjs`
- `scripts/.env` - Tooling secrets (service-role key lives here, never in the browser)
- `supabase/` - `schema.sql`, `migrations/`, edge `functions/ingest` (cloud fallback)
- `package.json` (root) - Tooling-only deps (`@supabase/supabase-js`, `dotenv`, `youtube-dl-exec`); scripts are `ingest`, `ingest:serve`, `transcripts:clean`, `frames:backfill`
- `.mise.toml` - Toolchain versions for Node.js and pnpm
- `vercel.json` - Legacy SPA rewrite for the retired Vite deployment; ignored once Root Directory is `web/`

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
