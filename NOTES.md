Probing with the anon key — expecting the gateway to refuse.

Lockdown verified live. The anon probe returned:

"fnVersion": 3 → the new code is deployed and serving.
403 "Forbidden: curator allow-list only." → anonymous callers are rejected.
One nuance worth knowing: it’s a 403 from the function, not a 401 from the gateway — the anon key is a validly signed JWT (just with the anon role and no email), so it passes signature validation and dies on the allow-list check. That’s the defense-in-depth working exactly as designed: even a valid token without a listed email gets nothing, before a single YouTube/Groq call is spent.

Last mile is yours — the positive path needs your session: stop the local relay (else the UI prefers it and never touches cloud), paste any already-ingested URL in /admin/ingest, and hit “Try cloud ingest anyway” in the relay-down panel. Expect success (dedupe or fresh row). If you get the 403 instead, the ADMIN_EMAILS secret doesn’t match your login address — fix the secret value, redeploy the function, retry.




Audit passed — submission-ready, no code changes needed:

Sitemap: 23 URLs (21 videos + home + search), all on the prod domain, all with lastmod. Every sampled video URL returns 200 with full SSR content.
Robots: allows all, points at the prod sitemap.
One honest footnote: I caught two genuine timeouts on stone-cold hits (fresh deploy + idle functions + cold Supabase). Warm responses run 3–4s, which Google tolerates and ISR caching covers for crawlers. If Search Console later flags “server errors” systematically rather than occasionally, that’s a hosting-tier conversation (Vercel compute warmth / Supabase pooling), not a code bug.
Your Search Console runbook:

Add property → URL prefix → https://curateur-ashy.vercel.app/ → verify via DNS TXT at your registrar (cleanest — no code, survives redeploys; HTML-file verification would need a public/ file and re-submit on rebuilds).
Sitemaps (left nav) → add sitemap.xml → expect “Success / Discovered: 23” within a day.
URL Inspection → paste 2–3 video URLs → Request indexing (seeds the queue instead of waiting for discovery).
Then leave it alone for 1–2 weeks — check Coverage (all 21 indexed?) and Performance (which queries surface?). That data decides what comes next: more videos in winning categories, not guesses.
Nothing to commit — the working tree is untouched.