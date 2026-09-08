// Full ingest pipeline, run from a clean network (your machine — YouTube
// blocks Supabase Edge Function IPs, so the transcript leg lives here).
// Metadata (YouTube Data API) → captions (yt-dlp, json3 word timings) →
// Groq LLaMA (summary/chapters, model fallback chain) → Supabase write.
//
// Usage: node scripts/ingest.mjs <youtube-url> [--force]
//   --force wipes any existing row for the video (even healthy ones) and
//   re-ingests. Without it, healthy rows are kept; hollow rows (0 transcript
//   words) are automatically deleted and reprocessed.
//
// Env (scripts/.env — see .env.example — or process env):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY, GROQ_API_KEY

import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

import youtubedl from "youtube-dl-exec";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY, GROQ_API_KEY } = process.env;
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY, GROQ_API_KEY })) {
  if (!v) {
    console.error(`Missing env ${k}. Copy scripts/.env.example to scripts/.env and fill it in.`);
    process.exit(1);
  }
}

const url = process.argv[2];
const force = process.argv.includes("--force");
if (!url) {
  console.error("Usage: node scripts/ingest.mjs <youtube-url> [--force]");
  process.exit(1);
}

function extractYouTubeId(u) {
  const patterns = [
    /(?:v=|vi=|shorts\/|live\/|embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = u.match(p);
    if (m) return m[1];
  }
  return null;
}

function iso8601ToSeconds(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

const YT_CATEGORY_MAP = {
  27: "Education",
  28: "Science",
  25: "News",
  24: "Entertainment",
  22: "People",
  20: "Gaming",
  17: "Sports",
  10: "Music",
};

const CHAT_MODELS = ["llama-3.3-70b-versatile", "openai/gpt-oss-20b", "llama-3.1-8b-instant"];

const youtubeId = extractYouTubeId(url);
if (!youtubeId) {
  console.error("Could not parse a YouTube video ID from that URL.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Idempotent: keep healthy rows, auto-repair hollow ones (0 transcript words).
const { data: existing } = await sb.from("videos").select("id").eq("youtube_id", youtubeId).maybeSingle();
if (existing) {
  const { count } = await sb.from("transcript_words").select("id", { count: "exact", head: true }).eq("video_id", existing.id);
  if ((count ?? 0) > 0 && !force) {
    console.log(`Already ingested with transcript: ${existing.id}`);
    process.exit(0);
  }
  console.log(`Reprocessing ${existing.id} (${force ? "--force" : "hollow row"})…`);
  const { error: delErr } = await sb.from("videos").delete().eq("id", existing.id);
  if (delErr) {
    console.error(`Delete failed: ${delErr.message}`);
    process.exit(1);
  }
}

// 1. Metadata (official API).
const metaRes = await fetch(
  `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${youtubeId}&key=${YOUTUBE_API_KEY}`,
);
if (!metaRes.ok) {
  console.error(`YouTube API error (HTTP ${metaRes.status}). Check YOUTUBE_API_KEY / quota.`);
  process.exit(1);
}
const item = (await metaRes.json()).items?.[0];
if (!item) {
  console.error("Video not found (private, deleted, or bad ID).");
  process.exit(1);
}
const sn = item.snippet ?? {};
const thumbs = sn.thumbnails ?? {};
const thumb =
  thumbs.maxres?.url ?? thumbs.sddefault?.url ?? thumbs.high?.url ??
  thumbs.medium?.url ?? thumbs.default?.url ?? "";
const durationSec = iso8601ToSeconds(item.contentDetails?.duration ?? "PT0S");
const category = YT_CATEGORY_MAP[String(sn.categoryId ?? "")] ?? "General";
console.log(`metadata ok: "${sn.title}" (${durationSec}s, ${category})`);

// 2. Captions via yt-dlp (subtitle track URLs straight from the info JSON —
// no files written). Manual English preferred, auto-generated second.
let words = [];
try {
  const info = await youtubedl(url, { dumpSingleJson: true, noWarnings: true });
  const pick = (groups) => {
    for (const g of groups) {
      if (!g) continue;
      const hit = g.find((f) => f.ext === "json3") ?? g[0];
      if (hit) return hit;
    }
    return null;
  };
  const subs = info.subtitles ?? {};
  const auto = info.automatic_captions ?? {};
  const subLangs = Object.keys(subs);
  const autoLangs = Object.keys(auto);
  const track =
    pick([subs.en]) ?? pick([auto.en]) ??
    pick(subLangs.map((l) => subs[l])) ?? pick(autoLangs.map((l) => auto[l]));
  if (!track) {
    console.error("yt-dlp: no caption tracks listed for this video.");
  } else {
    console.log(`caption track: ${track.name ?? track.ext} (${track.ext})`);
    const capRes = await fetch(track.url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!capRes.ok) {
      console.error(`caption download HTTP ${capRes.status}`);
    } else {
      const j = await capRes.json();
      for (const ev of j.events ?? []) {
        if (!ev.segs) continue;
        for (const seg of ev.segs) {
          const text = seg.utf8 ?? "";
          if (!text || text === "\n") continue;
          const start = ((ev.tStartMs ?? 0) + (seg.tStartMs ?? 0)) / 1000;
          words.push({ text, startTime: start, endTime: start + (seg.dDurationMs ?? 0) / 1000 });
        }
      }
    }
  }
} catch (e) {
  console.error("yt-dlp failed:", e.message ?? e);
}
if (!words.length) {
  console.error("No transcript obtained — aborting (not writing a hollow row).");
  process.exit(1);
}
console.log(`captions ok: ${words.length} words`);
const transcriptText = words.map((w) => w.text).join(" ").replace(/\s+/g, " ").trim();

// 3. Summary / takeaways / chapters (first model that answers wins).
const prompt =
  `Video: "${sn.title}" by ${sn.channelTitle}.\n\nTranscript (may be truncated):\n` +
  `${transcriptText.slice(0, 12000)}\n\nReturn JSON: { "summary": "2-3 sentence editorial summary", ` +
  `"takeaways": ["4-5 crisp bullets"], "chapters": [{ "title": "...", "startTime": <seconds>, ` +
  `"description": "..." }] } with 3-5 chapters spread across the video.`;
let ai = null;
for (const model of CHAT_MODELS) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        temperature: 0.3,
        messages: [
          { role: "system", content: "You are a precise editorial assistant. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`groq chat ${model} HTTP ${res.status}`);
      continue;
    }
    const parsed = JSON.parse((await res.json()).choices?.[0]?.message?.content ?? "{}");
    ai = {
      summary: String(parsed.summary ?? ""),
      takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways.map(String).slice(0, 6) : [],
      chapters: Array.isArray(parsed.chapters)
        ? parsed.chapters.slice(0, 8).map((c) => ({
            title: String(c.title ?? "Chapter"),
            startTime: Number(c.startTime ?? 0),
            description: String(c.description ?? ""),
          }))
        : [],
    };
    console.log(`ai ok via ${model}: ${ai.chapters.length} chapters`);
    break;
  } catch (e) {
    console.error(`groq chat ${model} failed:`, e.message ?? e);
  }
}
if (!ai) {
  console.error("All Groq models failed — aborting.");
  process.exit(1);
}

// 4. Write (service role bypasses RLS).
const { data: videoRow, error: vErr } = await sb
  .from("videos")
  .insert({
    youtube_id: youtubeId,
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
  .single();
if (vErr || !videoRow) {
  console.error(`Database write failed: ${vErr?.message ?? "unknown"}`);
  process.exit(1);
}
if (ai.chapters.length) {
  await sb.from("chapters").insert(
    ai.chapters.map((c) => ({ video_id: videoRow.id, title: c.title, start_time: c.startTime, description: c.description })),
  );
}
const wordRows = words.map((w) => ({ video_id: videoRow.id, text: w.text, start_time: w.startTime, end_time: w.endTime }));
for (let i = 0; i < wordRows.length; i += 1000) {
  const { error: wErr } = await sb.from("transcript_words").insert(wordRows.slice(i, i + 1000));
  if (wErr) {
    console.error(`Transcript write failed: ${wErr.message} (video id: ${videoRow.id})`);
    process.exit(1);
  }
}
console.log(`done: ${videoRow.id} (${wordRows.length} words, ${ai.chapters.length} chapters)`);
