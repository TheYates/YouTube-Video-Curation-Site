// POST { youtubeUrl } → { id, youtubeId, words, chapters, transcriptSource, aiOk }.
// Pipeline: YouTube Data API (metadata) → captions via youtubei player API
// (word timings, server-tolerant; watch-page scrape as fallback) → Groq
// Whisper fallback (best-effort audio) → Groq LLaMA (summary/takeaways/
// chapters) → Supabase write via service role (bypasses RLS).
//
// Every stage logs (visible in Supabase function logs) and the response
// reports transcriptSource ("captions" | "whisper" | "none") and aiOk, so the
// admin UI can warn instead of silently publishing hollow rows.
//
// Deploy:  supabase functions deploy ingest
// Secrets: supabase secrets set YOUTUBE_API_KEY=... GROQ_API_KEY=...
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Retry with backoff for YouTube's datacenter rate-limiting (429s) and
// transient 403s. Returns null after all attempts; logs each failure.
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  label: string,
  delays = [1500, 4000],
): Promise<Response | null> {
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(url, init)
      if (res.ok) return res
      console.error(`[ingest] ${label} HTTP ${res.status} (attempt ${attempt + 1})`)
    } catch (e) {
      console.error(`[ingest] ${label} network error (attempt ${attempt + 1}):`, e)
    }
    if (attempt < delays.length) await sleep(delays[attempt])
  }
  return null
}

// Deployment marker — bump on every ship. Lets callers verify which
// revision is live without writing rows (the dedupe probe returns it).
const FN_VERSION = 3;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ fnVersion: FN_VERSION, ...body }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:v=|vi=|shorts\/|live\/|embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function iso8601ToSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

// Public URL slug (/video/<slug>), frozen at publish — retitles never change
// it. Keep in sync with web/lib/slug.ts and scripts/ingest.mjs.
function slugifyTitle(title: string): string {
  const stem = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "")
  return stem || "video"
}

// YouTube numeric category → our editorial buckets. Unknown → "General"
// (the curator can recategorize; categories are derived dynamically).
const YT_CATEGORY_MAP: Record<string, string> = {
  "27": "Education",
  "28": "Science",
  "25": "News",
  "24": "Entertainment",
  "22": "People",
  "20": "Gaming",
  "17": "Sports",
  "10": "Music",
}

// Balanced-bracket JSON extractor for values embedded in watch-page HTML
// (regex alone breaks on nested braces).
function extractJsonArray(html: string, key: string): unknown | null {
  const idx = html.indexOf(`"${key}":`)
  if (idx < 0) return null
  const start = html.indexOf("[", idx)
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === "\\") esc = true
      else if (ch === '"') inStr = false
    } else {
      if (ch === '"') inStr = true
      else if (ch === "[") depth++
      else if (ch === "]") {
        depth--
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(start, i + 1))
          } catch {
            return null
          }
        }
      }
    }
  }
  return null
}

interface TimedWord {
  text: string
  startTime: number
  endTime: number
}

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string
}

interface AudioFormat {
  mimeType?: string
  bitrate?: number
  url?: string
}

// Public Innertube key used by YouTube's own clients (same one yt-dlp uses).
// The youtubei player endpoint answers reliably from servers, unlike the
// watch page which often serves bot-checks to datacenter IPs.
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"

interface PlayerData {
  captionTracks: CaptionTrack[]
  adaptiveFormats: AudioFormat[]
}

async function fetchPlayerJson(youtubeId: string): Promise<PlayerData | null> {
  try {
    const res = await fetchWithRetry(
      `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA },
        body: JSON.stringify({
          context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", hl: "en", gl: "US" } },
          videoId: youtubeId,
        }),
      },
      `youtubei:${youtubeId}`,
    )
    if (!res) return null
    const j = await res.json()
    const status = j?.playabilityStatus?.status ?? "UNKNOWN"
    if (status !== "OK") {
      console.error(`[ingest] playability ${status} for ${youtubeId}:`, j?.playabilityStatus?.reason ?? "")
      return null
    }
    return {
      captionTracks: j?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [],
      adaptiveFormats: j?.streamingData?.adaptiveFormats ?? [],
    }
  } catch (e) {
    console.error("[ingest] youtubei fetch failed:", e)
    return null
  }
}

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null
  const en = tracks.filter((t) => (t.languageCode ?? "").toLowerCase().startsWith("en"))
  return (
    en.find((t) => !t.kind) ??
    tracks.find((t) => !t.kind) ??
    en.find((t) => t.kind === "asr") ??
    tracks.find((t) => t.kind === "asr") ??
    tracks[0]
  )
}

// Non-speech tokens: [music], [applause], (laughter), ♪, etc.
const SFX_RE = /^\[.*\]$|^\(.*\)$|^♪+$/
function cleanSegText(raw: unknown): string {
  // YouTube prefixes speaker-change lines with ">>" (" >> [music]").
  const text = String(raw ?? "").replace(/\s+/g, " ").trim().replace(/^>>\s*/, "")
  if (!text || text === "\n" || text === ">>" || SFX_RE.test(text)) return ""
  return text
}

// Manual captions preferred, auto (kind=asr) second. Manual json3 segs carry
// per-seg timings; auto-caption segs don't, so each seg gets an even slice
// of its event span — preserving spoken order with distinct start/end times.
async function wordsFromTracks(tracks: CaptionTrack[]): Promise<TimedWord[] | null> {
  const track = pickTrack(tracks)
  if (!track) return null
  try {
    const capRes = await fetch(`${track.baseUrl}&fmt=json3`, {
      headers: { "User-Agent": UA },
    })
    if (!capRes.ok) {
      console.error(`[ingest] timedtext HTTP ${capRes.status}`)
      return null
    }
    const j = await capRes.json()
    const words: TimedWord[] = []
    const events = ((j.events ?? []) as Array<{
      tStartMs?: number
      dDurationMs?: number
      segs?: Array<{ utf8?: string; tStartMs?: number; dDurationMs?: number }>
    }>).filter((ev) => ev.segs?.length)
    events.forEach((ev, ei) => {
      const evStart = (ev.tStartMs ?? 0) / 1000
      let span = (ev.dDurationMs ?? 0) / 1000
      if (!span || !Number.isFinite(span)) {
        const next = events.slice(ei + 1).find((e) => (e.tStartMs ?? 0) / 1000 > evStart)
        span = next ? next.tStartMs! / 1000 - evStart : 2
        if (!span || span <= 0 || !Number.isFinite(span)) span = 2
      }
      const kept = (ev.segs ?? [])
        .map((seg) => ({ text: cleanSegText(seg.utf8), seg }))
        .filter((k) => k.text)
      const slice = span / Math.max(kept.length, 1)
      kept.forEach(({ text, seg }, si) => {
        const hasOwn = Number.isFinite(seg.tStartMs) && Number.isFinite(seg.dDurationMs)
        if (hasOwn) {
          const start = ((ev.tStartMs ?? 0) + seg.tStartMs!) / 1000
          words.push({ text, startTime: start, endTime: start + seg.dDurationMs! / 1000 })
        } else {
          words.push({
            text,
            startTime: evStart + si * slice,
            endTime: evStart + (si + 1) * slice,
          })
        }
      })
    })
    return words.length ? words : null
  } catch (e) {
    console.error("[ingest] timedtext fetch/parse failed:", e)
    return null
  }
}

// Watch-page scrape fallback for when youtubei yields no tracks.
async function captionsFromHtml(youtubeId: string): Promise<TimedWord[] | null> {
  try {
    const watch = await fetchWithRetry(
      `https://www.youtube.com/watch?v=${youtubeId}`,
      { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" } },
      `watch:${youtubeId}`,
    )
    if (!watch) return null
    const html = await watch.text()
    const tracks = extractJsonArray(html, "captionTracks") as CaptionTrack[] | null
    if (!tracks?.length) {
      console.error(`[ingest] no captionTracks in watch page for ${youtubeId}`)
      return null
    }
    return await wordsFromTracks(tracks)
  } catch (e) {
    console.error("[ingest] watch page scrape failed:", e)
    return null
  }
}

// Whisper via Groq on a directly-fetched audio stream. Best-effort only:
// YouTube throttles non-player audio fetches, so this frequently 403s.
// Skipped for videos over 15 min to stay memory-safe.
async function transcribeWithWhisper(
  formats: AudioFormat[],
  durationSec: number,
  groqKey: string,
): Promise<TimedWord[] | null> {
  try {
    if (durationSec > 900) {
      console.error("[ingest] whisper skipped: video over 15 min")
      return null
    }
    const audio = formats
      .filter((f) => f.url && (f.mimeType ?? "").startsWith("audio/"))
      .sort((a, b) => (a.bitrate ?? 0) - (b.bitrate ?? 0))[0]
    if (!audio?.url) {
      console.error("[ingest] whisper skipped: no audio stream url")
      return null
    }
    const audioRes = await fetchWithRetry(audio.url, { headers: { "User-Agent": UA } }, "audio")
    if (!audioRes?.body) {
      console.error("[ingest] audio fetch failed")
      return null
    }
    const buf = await audioRes.arrayBuffer()
    for (const model of ["whisper-large-v3-turbo", "whisper-large-v3"]) {
      try {
        const form = new FormData()
        form.append("file", new Blob([buf], { type: "audio/mp4" }), "audio.mp4")
        form.append("model", model)
        form.append("response_format", "verbose_json")
        form.append("timestamp_granularities[]", "word")
        const tr = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${groqKey}` },
          body: form,
        })
        if (!tr.ok) {
          console.error(`[ingest] groq whisper ${model} HTTP ${tr.status}`)
          continue
        }
        const j = await tr.json()
        const words: TimedWord[] = ((j.words ?? []) as Array<{
          word: string
          start: number
          end: number
        }>)
          .map((w) => ({ text: cleanSegText(w.word), startTime: w.start, endTime: w.end }))
          .filter((w) => w.text)
        if (words.length) return words
      } catch (e) {
        console.error(`[ingest] groq whisper ${model} failed:`, e)
      }
    }
    return null
  } catch (e) {
    console.error("[ingest] whisper failed:", e)
    return null
  }
}

interface AiResult {
  summary: string
  takeaways: string[]
  chapters: { title: string; startTime: number; description: string }[]
  ok: boolean
}

async function summarize(
  title: string,
  channel: string,
  transcriptText: string,
  groqKey: string,
): Promise<AiResult> {
  const fallback: AiResult = {
    summary: `${title} by ${channel}.`,
    takeaways: [],
    chapters: [],
    ok: false,
  }
  const prompt =
    `Video: "${title}" by ${channel}.\n\nTranscript (may be truncated):\n` +
    `${transcriptText.slice(0, 12000)}\n\nReturn JSON: { "summary": "2-3 sentence editorial summary", ` +
    `"takeaways": ["4-5 crisp bullets"], "chapters": [{ "title": "...", "startTime": <seconds>, ` +
    `"description": "..." }] } with 3-5 chapters spread across the video.`
  // Refreshed 2026-09: Groq retired the llama-3.x chat IDs (HTTP 404).
  // Verified live via GET /models; first model that answers wins.
  for (const model of ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: "You are a precise editorial assistant. Always respond with valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
        }),
      })
      if (!res.ok) {
        console.error(`[ingest] groq chat ${model} HTTP ${res.status}`)
        continue
      }
      const j = await res.json()
      const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}")
      return {
        summary: String(parsed.summary ?? fallback.summary),
        takeaways: Array.isArray(parsed.takeaways)
          ? parsed.takeaways.map(String).slice(0, 6)
          : [],
        chapters: Array.isArray(parsed.chapters)
          ? parsed.chapters.slice(0, 8).map((c: { title?: unknown; startTime?: unknown; description?: unknown }) => ({
              title: String(c.title ?? "Chapter"),
              startTime: Number(c.startTime ?? 0),
              description: String(c.description ?? ""),
            }))
          : [],
        ok: true,
      }
    } catch (e) {
      console.error(`[ingest] groq chat ${model} failed:`, e)
    }
  }
  return fallback
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS })
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405)

  const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY")
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!YOUTUBE_API_KEY || !GROQ_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    return json(
      {
        error:
          "Server misconfigured: missing API keys. Run: supabase secrets set YOUTUBE_API_KEY=... GROQ_API_KEY=...",
      },
      500,
    )
  }

  let youtubeUrl = ""
  try {
    youtubeUrl = (await req.json()).youtubeUrl ?? ""
  } catch {
    return json({ error: "Expected JSON body { youtubeUrl }" }, 400)
  }
  const youtubeId = extractYouTubeId(youtubeUrl)
  if (!youtubeId) {
    return json({ error: "Could not parse a YouTube video ID from that URL." }, 400)
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY)

  // Curator auth: the gateway (verify_jwt) already rejected anonymous calls,
  // but defense in depth — verify the caller's email against the allow-list
  // (ADMIN_EMAILS secret, same addresses as the web app). Runs before any
  // YouTube/Groq quota is spent.
  const authHeader = req.headers.get("authorization") ?? ""
  const callerJwt = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : ""
  if (!callerJwt) {
    return json({ error: "Missing user session. Sign in to /admin first." }, 401)
  }
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser(callerJwt)
  const allowList = (Deno.env.get("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const callerEmail = user?.email?.toLowerCase() ?? ""
  if (userErr || !user || !allowList.includes(callerEmail)) {
    console.error(`[ingest] forbidden for ${callerEmail || "unknown"}: ${userErr?.message ?? "not allow-listed"}`)
    return json({ error: "Forbidden: curator allow-list only." }, 403)
  }

  // Idempotent: re-ingesting the same URL returns the existing row.
  const { data: existing } = await sb
    .from("videos")
    .select("id")
    .eq("youtube_id", youtubeId)
    .maybeSingle()
  if (existing) return json({ id: existing.id, youtubeId, deduped: true })

  // 1. Metadata (official API — reliable).
  const metaRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${youtubeId}&key=${YOUTUBE_API_KEY}`,
  )
  if (!metaRes.ok) {
    return json(
      { error: `YouTube API error (HTTP ${metaRes.status}). Check YOUTUBE_API_KEY / quota.` },
      502,
    )
  }
  const meta = await metaRes.json()
  const item = meta.items?.[0]
  if (!item) return json({ error: "Video not found (private, deleted, or bad ID)." }, 404)
  const sn = item.snippet ?? {}
  const thumbs = sn.thumbnails ?? {}
  const thumb =
    thumbs.maxres?.url ??
    thumbs.sddefault?.url ??
    thumbs.high?.url ??
    thumbs.medium?.url ??
    thumbs.default?.url ??
    ""
  const durationSec = iso8601ToSeconds(item.contentDetails?.duration ?? "PT0S")
  const category = YT_CATEGORY_MAP[String(sn.categoryId ?? "")] ?? "General"
  console.log(`[ingest] metadata ok: "${sn.title}" (${durationSec}s, ${category})`)

  // 2. Transcript: youtubei captions → watch-page scrape → Whisper.
  const player = await fetchPlayerJson(youtubeId)
  let words: TimedWord[] | null = null
  let transcriptSource = "none"
  if (player && player.captionTracks.length) {
    words = await wordsFromTracks(player.captionTracks)
  }
  if (!words) {
    console.error("[ingest] youtubei captions empty, trying watch-page scrape")
    words = await captionsFromHtml(youtubeId)
  }
  if (words) {
    transcriptSource = "captions"
    console.log(`[ingest] captions ok: ${words.length} words`)
  } else {
    console.error("[ingest] no captions; trying whisper fallback")
    words = await transcribeWithWhisper(player?.adaptiveFormats ?? [], durationSec, GROQ_API_KEY)
    if (words) {
      transcriptSource = "whisper"
      console.log(`[ingest] whisper ok: ${words.length} words`)
    } else {
      // No hollow rows: the curator's machine (local relay / CLI script)
      // can fetch captions from a residential IP where datacenter IPs fail.
      console.error("[ingest] no transcript at all — aborting (not writing a hollow row)")
      return json(
        {
          error:
            "No transcript obtained — YouTube blocked this server's network (youtubei 403 / watch 429). " +
            "Use the local ingest relay (npm run ingest:serve) or node scripts/ingest.mjs from your machine.",
          transcriptSource: "none",
          aiOk: false,
        },
        422,
      )
    }
  }
  const transcriptText = (words ?? [])
    .map((w) => w.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()

  // 3. Summary / takeaways / chapters.
  const ai = await summarize(sn.title ?? youtubeId, sn.channelTitle ?? "", transcriptText, GROQ_API_KEY)
  console.log(`[ingest] ai ok=${ai.ok}, chapters=${ai.chapters.length}`)

  // 4. Write (service role bypasses RLS). Slug is frozen at publish.
  const stem = slugifyTitle(sn.title ?? youtubeId)
  let slug = stem
  for (let n = 2; ; n++) {
    const { data: clash } = await sb.from("videos").select("id").eq("slug", slug).maybeSingle()
    if (!clash) break
    slug = `${stem}-${n}`
  }
  const { data: videoRow, error: vErr } = await sb
    .from("videos")
    .insert({
      youtube_id: youtubeId,
      slug,
      title: sn.title ?? youtubeId,
      channel_name: sn.channelTitle ?? "Unknown",
      published_at: (sn.publishedAt ?? new Date().toISOString()).slice(0, 10),
      duration_sec: durationSec,
      category,
      thumbnail_url: thumb,
      summary: ai.summary,
      takeaways: ai.takeaways,
      tags: [],
      transcript_text: transcriptText || null,
    })
    .select("id")
    .single()
  if (vErr || !videoRow) {
    return json({ error: `Database write failed: ${vErr?.message ?? "unknown"}` }, 500)
  }
  const vid = videoRow.id as string

  if (ai.chapters.length) {
    await sb.from("chapters").insert(
      ai.chapters.map((c) => ({
        video_id: vid,
        title: c.title,
        start_time: c.startTime,
        description: c.description,
      })),
    )
  }
  const wordRows = (words ?? []).map((w) => ({
    video_id: vid,
    text: w.text,
    start_time: w.startTime,
    end_time: w.endTime,
  }))
  for (let i = 0; i < wordRows.length; i += 1000) {
    const { error: wErr } = await sb
      .from("transcript_words")
      .insert(wordRows.slice(i, i + 1000))
    if (wErr) return json({ error: `Transcript write failed: ${wErr.message}`, id: vid }, 500)
  }

  console.log(`[ingest] done: ${vid} /video/${slug} (${wordRows.length} words, source=${transcriptSource})`)
  return json({
    id: vid,
    slug,
    youtubeId,
    words: wordRows.length,
    chapters: ai.chapters.length,
    transcriptSource,
    aiOk: ai.ok,
  })
})
