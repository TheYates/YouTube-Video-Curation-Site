# Sitemap triage — which of the 69 curated videos should we advertise to Google?

**Context:** `curateur-ashy.vercel.app` sits at 0 indexed / 70 not indexed in Search Console.
The site is ~3 weeks old with no inbound links. Current `sitemap.xml` advertises **74 URLs**
(69 videos + homepage/about/contact/privacy/disclosure).

**Bottom line:** narrow the advertised set from 74 → **29** (24 videos + 5 static). Not because
the other 45 pages are *bad* — because on a zero-authority domain you are asking Google to
trust you, and the cheapest way to earn that trust is to make a small, dense, obviously-useful
claim instead of a broad, uniform one. Nothing here is deleted, de-indexed, or removed from the
site: cut pages stay live and stay internally linked.

**Honest caveat up front, unchanged from earlier analysis:** this does not *fix* indexing.
Authority is the binding constraint and no sitemap change supplies it. What this does is stop
diluting the little signal you have, and it is reversible.

---

## 1. How this was measured

Read-only queries against production Supabase (`scripts/_sitemap-triage.mjs`,
`scripts/_sitemap-audit.mjs`), plus a fetch of the live `sitemap.xml` and two live video pages.
No writes.

**Reproducing this:** `node scripts/_sitemap-triage.mjs` prints the three tiers below. The
thresholds, the decaying/duplicate slug lists, and every hand override are declared as named
constants at the top of that file, so each judgement can be argued with. Output: Tier A 24,
Tier B 31, Tier C 14 — `A + B + C = 69`, all rows accounted for.

| signal | source | why it matters |
|---|---|---|
| `transcript_text` word count | `videos` | the only genuinely unique indexable text on the page |
| `summary`, `takeaways` | `videos` | the editorial layer that distinguishes us from YouTube |
| `chapters` (+ image, description) | `chapters` | page richness / visual substance |
| `tags` | `videos` | topic clustering and related-video quality |
| `published_at`, `duration_sec`, `category`, `channel_name` | `videos` | durability and substance of the source |

## 2. What the data actually shows

Five things that changed the recommendation:

1. **The editorial layer is uniform and machine-generated — so it cannot rank the pages.**
   All 69 have a summary (181–469 chars, median 298) and 4–5 takeaways. Not one is missing.
   These are not the discriminating signal I expected; "has analysis" is true of everything.
2. **Chapters are uniformly rich.** 315 chapters total, **99% have images**, **100% have
   descriptions**. Only one video (`13-free-websites-that-find-whats-hidden`) has none.
3. **`tags` is an empty array `[]` on all 69 videos** (verified: 0 null, 0 populated).
   This has a concrete consequence — see §6.
4. **Zero affiliate links.** No monetization yet, so there is no revenue argument for indexing
   any particular page.
5. **45 of 69 videos come from channels that appear exactly once.** The catalog is a long tail
   of one-off sources: the top 6 channels supply 24 videos, the other 45 come from distinct,
   mostly obscure channels (`igor`, `neo`, `Soon`, `Fish1n`, `Rohtu`, `inkly`, `SR Stick`…).

**The consequence:** since analysis and chapters are constant, the only variables that actually
differ are **how much unique text the page carries** (transcript depth) and **whether the topic
stays valuable over time**. Those two are the rubric.

## 3. Rubric

Deliberately rule-based so it is reproducible and arguable:

- **CUT** — the page has too little unique indexable text to justify a URL (stub), duplicates
  another page we already ship, or is a dated news item whose value decays.
  - stub floor: `< 1000` transcript words
  - duplicate: same topic curated twice
  - decaying: news-cycle / year-stamped / event-tied
- **ADVERTISE (Tier A)** — `>= 2000` transcript words, source at least 10 minutes, durable
  topic, then capped at **24** so the ask is small.
- **HOLD (Tier B)** — a real page, just not worth spending the first round of crawl budget on.

---

## 4. Tier A — advertise in the sitemap now (24)

Ranked by transcript depth, then overridden by hand where depth and durable demand disagree
(overrides marked ⚠ and justified below).

| # | URL slug | Channel | Words | Why it earns a URL |
|---|---|---|---|---|
| 1 | `the-most-valuable-youtube-training-youll-ever-watch` | Jake Trinder | 8,922 | Longest transcript on the site; an evergreen craft/training topic |
| 2 | `is-spider-web-really-stronger-than-steel` | Veritasium | 5,095 | Durable science question, high-name-recognition source |
| 3 | `why-wall-street-is-ignoring-big-techs-debt` | Patrick Boyle | 5,010 | Evergreen finance explainer, authoritative source |
| 4 | `why-desert-people-wear-more-clothes-in-extreme-heat-2` | SR Stick | 4,583 | Deeper of the duplicate pair; the non-`-2` page is cut |
| 5 | `neuroscientist-explains-worst-vs-best-dopamine-habits` | Tj Power | 4,496 | Durable self-improvement query |
| 6 | `tailwind-css-vs-stylex-why-people-are-switching` | ByteGrad | 4,270 | Developer-tool comparison; lasting search intent |
| 7 | `why-skepticism-is-crucial-today-the-wisdom-of-xenophanes` | Einzelgänger | 4,211 | Philosophy anchor of the largest channel cluster |
| 8 | `ais-hidden-debt-problem-explained` | The Plain Bagel | 4,190 | Evergreen AI-economics explainer |
| 9 | `does-being-a-good-person-even-matter` | Chill Review | 3,980 | Durable ethics question |
| 10 | `how-git-actually-works` | Coder Coder | 3,813 | Strong developer query; already the best-performing page |
| 11 | `why-men-fear-women` | Academy of Ideas | 3,550 | Durable psychology/ideas topic |
| 12 | `how-to-make-money-with-google-adsense-using-ai-no-code-web-a` | Charlie Chang | 3,409 | Monetization how-to with lasting demand |
| 13 | `the-most-disturbing-theories-explained` | Davmanity | 3,496 | Durable "theories" genre |
| 14 | `but-what-is-a-neural-network-deep-learning-chapter-1` | 3Blue1Brown | 3,357 | Canonical ML explainer; strongest topical authority signal |
| 15 | `feeling-lost-the-samurai-had-an-answer-bushido-philosophy` | Einzelgänger | 3,096 | Evergreen philosophy |
| 16 | `how-to-become-unconquerable-senecas-stoicism` | Einzelgänger | 3,083 | Evergreen philosophy, high search demand |
| 17 | `the-dark-philosophy-behind-looksmaxxing` | Einzelgänger | 3,005 | Evergreen, culturally current |
| 18 | `ai-killed-the-app-economy` | Kenny Gunderman | 3,004 | Durable tech-economics argument |
| 19 | `who-you-marry-is-a-financial-decision` | Ben Felix | 2,888 | Strong evergreen personal-finance query |
| 20 | `the-7-levels-of-wealth` | Shain Isley | 2,881 | Durable finance framing |
| 21 | `i-dont-want-kids-and-apparently-thats-a-problem` | Einzelgänger | 2,877 | Evergreen social commentary |
| 22 ⚠ | `i-built-chatgpt-from-scratch` | Green Code | 2,791 | **Added** — high-intent developer query; outranked only by longer, weaker pages |
| 23 ⚠ | `when-compounding-works-against-you` | Ben Felix | 2,830 | **Added** — strong evergreen finance query from a credible source |
| 24 ⚠ | `casually-explained-social-status` | Casually Explained | 2,198 | **Added** — durable topic, recognisable channel |

**Demoted from the mechanical top-24 (all stay live and linked):**

- `how-to-host-multiple-websites-on-one-server-step-by-step` (5,712w) → HOLD. Long because the
  transcript narrates terminal commands. Hyper-specific, no durable query, and the page competes
  head-on with the source video for the same keywords with none of its authority.
- `the-rise-and-fall-of-realplayer-media-player-on-every-pc-tha` (3,466w) → HOLD, pending a
  metadata fix. The content is plausibly durable (tech-history/nostalgia), but the title is
  **100 characters** — which SERPs truncate — and the slug is cut off mid-word (`…-pc-tha`
  instead of `…-pc-that-buffered-…`). Publishing a malformed canonical URL at Google is not worth
  it when the fix is two strings. This is the **prime promotion candidate** once the title and
  slug are corrected; it is a deliberate, reversible hold, not a verdict on the content.
- `the-corniest-people-ever` (4,707w) → CUT. Long, but an entertainment listicle with no durable
  query, in the vague `General` category, from a one-off channel.

## 5. Tier C — cut from the sitemap (14), with reasoning

Cut = remove the `<loc>`. The page stays live, stays reachable from the feed, search, and related
lists. This is a priority signal, not a deletion.

| URL slug | Words | Why it is cut |
|---|---|---|
| `what-if-gravity-was-10-stronger` | 211 | Stub. 1-minute source with ~200 words — nothing unique to index |
| `how-antidepressants-work` | 204 | Stub. 1-minute source; the page is effectively a thumbnail plus boilerplate |
| `how-do-submarines-know-where-they-are` | 309 | Stub. 2-minute source; no substance to justify a URL |
| `free-business-email-with-your-own-domain-in-8-minutes-no-zoh` | 638 | Stub. 4-minute tool tutorial; the transcript is mostly UI narration |
| `why-socrates-hated-democracy` | 642 | Stub. 4-minute source |
| `how-sugar-is-made-how-its-made` | 821 | Stub. Below the floor; the video is the artefact, not the text |
| `your-bodys-molecular-machines` | 903 | Stub. Below the floor |
| `overpopulation-the-human-explosion-explained` | 996 | Stub. Just below the floor at 7 minutes |
| `why-desert-people-wear-more-clothes-in-extreme-heat` | 2,071 | Duplicate. Same topic as `…-heat-2`, which is the deeper page (4,583w vs 2,071w) |
| `lg-says-were-fake-news` | 8,108 | Decaying. General news broadcast — long, but no durable query |
| `exposing-a-global-ai-slop-empire-ruining-the-internet-for-pr` | 1,180 | Decaying. News-cycle investigative piece; also thin at 7 minutes |
| `50c-heat-heres-why-you-shouldnt-strip-down` | 2,198 | Decaying. Tied to one specific heatwave event |
| `how-to-use-claude-code-for-free-in-2026` | 2,506 | Decaying. Year-stamped — the promise expires with the calendar, then the title reads as stale |
| `the-corniest-people-ever` | 4,707 | No durable query; vaguest category; one-off channel (override, §4) |

## 6. What surfaced along the way (separate from the sitemap question)

**A verified bug: every video in a category shows the identical related block.**
`scoreRelated` (`web/lib/video-utils.ts`) scores `sharedTags * 2 + sameCategory`. Because `tags`
is empty on all 69 rows, the tag term is always `0`, every candidate ties, and the stable sort
falls back to database order — so the same three videos win every time.

Verified against production: `/video/how-git-actually-works` and
`/video/tailwind-css-vs-stylex-why-people-are-switching` (both Education) emit **byte-identical**
related sets — `ais-hidden-debt-problem-explained`, `how-i-got-402-million-facebook-views-in-30-days`,
`how-to-make-money-with-google-adsense-using-ai-no-code-web-a`.

Two consequences, both bad:

- 69 pages each carry a near-duplicate element rather than a genuinely varied internal link graph,
  which wastes the strongest crawl-diversity signal the site has.
- Related links are a real UX feature and are currently not related to anything.

**Other findings:**

- `Davmanity ` is stored with a trailing space (`channel_name`) — worth a data cleanup.
- `the-rise-and-fall-of-realplayer-media-player-on-every-pc-tha` has a **100-character title**
  and a **slug truncated mid-word** (`…-pc-tha`). Both are cosmetic-cum-indexing defects and both
  are trivially fixable at ingest.
- `tags` being empty also means the `discover.mjs` topic clustering and any future
  tag-based hub pages have nothing to build on.
- `13-free-websites-that-find-whats-hidden` is the only video with zero chapters.

## 7. What this change does *and does not* do

**Mechanics worth being precise about:** `sitemap.xml` is a *hint*, not a gate. Measured against
production, the homepage currently server-renders an `ItemList` of **69 `ListItem`s** and **69
distinct `/video/` links**, so every page stays discoverable no matter what the sitemap says.
Cutting the sitemap reshapes *priority*; it does not reduce *discovery*.

To actually shrink the site's crawl footprint you would also have to reduce the internal link
surface — cap the homepage `ItemList` to the Tier A set and paginate the feed. That is a bigger,
more opinionated change with its own tradeoffs (deep pages lose internal link equity), and I would
do it as a separate decision, not bundled into this one.

**What I will not recommend:** adding `noindex` to the cut pages. They are linked from the
homepage; a `noindex` page still absorbs crawl budget and passes nothing, which is strictly worse
than leaving it indexable-but-deprioritised. If a page later proves genuinely worthless, remove
the page and 301 it — don't `noindex` it.

## 8. Recommended next steps

1. **Apply the triage** — make `getVideoListings()` emit the Tier A set (24 + 5 static = 29 locs).
   Needs a durable way to express membership: a `sitemap_priority` / `is_featured` column beats a
   hard-coded slug list, and it lets the curator promote pages from `/admin`.
2. **Fix the related-video bug** — populate `tags` at ingest, or fall back to scoring on
   title/tag word overlap so different pages get different related sets. This is the single
   highest-value internal-linking fix available.
3. **Then do the off-code work** — none of the above substitutes for inbound links.
