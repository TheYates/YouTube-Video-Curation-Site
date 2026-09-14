// Shared ingest pipeline core — used by scripts/ingest.mjs (CLI) and
// scripts/auto-pipeline.mjs (discovery-driven ingest of approved candidates).
//
// One video: metadata (YouTube Data API) → captions (yt-dlp, json3 word
// timings) → Groq Whisper fallback → Groq LLaMA summary/chapters → Supabase
// write. Console output is load-bearing: scripts/serve-ingest.mjs parses
// these lines ("Already ingested with transcript:", "source=…") — keep them
// byte-identical.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY, GROQ_API_KEY
// (loaded by the entrypoint scripts from scripts/.env or process env).

import youtubedl from "youtube-dl-exec";
import { existsSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

export function extractYouTubeId(u) {
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

// Public URL slug (/video/<slug>), frozen at publish — retitles never change
// it. Keep in sync with web/lib/slug.ts and supabase/functions/ingest/index.ts.
function slugifyTitle(title) {
  const stem = String(title ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return stem || "video";
}

async function uniqueSlug(sb, title) {
  const stem = slugifyTitle(title);
  for (let n = 1; ; n++) {
    const slug = n === 1 ? stem : `${stem}-${n}`;
    const { data } = await sb.from("videos").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
  }
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

// Refreshed 2026-09: Groq retired the llama-3.x chat IDs (HTTP 404).
// Verified live via GET /models; first model that answers wins.
const CHAT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];

// One video's full pipeline. Console output per video is unchanged (the
// relay parses these lines), failures are returned — never process.exit —
// so batch mode can skip and continue.
// opts.categoryOverride: when set, wins over the generic YT category map
// (used by the discovery pipeline to apply the AI's suggested category).
export async function ingestOne(url, opts = {}) {
  const youtubeId = extractYouTubeId(url);
  if (!youtubeId) {
    console.error("Could not parse a YouTube video ID from that URL.");
    return { status: "failed", detail: "Could not parse a YouTube video ID from that URL." };
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY, GROQ_API_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !YOUTUBE_API_KEY || !GROQ_API_KEY) {
    const missing = Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY, GROQ_API_KEY })
      .filter(([, v]) => !v)
      .map(([k]) => k)
      .join(", ");
    console.error(`Missing env ${missing}. Fill them in via scripts/.env or process env.`);
    return { status: "failed", detail: `Missing env: ${missing}` };
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Idempotent: keep healthy rows, auto-repair hollow ones (0 transcript words).
  const { data: existing } = await sb.from("videos").select("id").eq("youtube_id", youtubeId).maybeSingle();
  if (existing) {
    const { count } = await sb.from("transcript_words").select("id", { count: "exact", head: true }).eq("video_id", existing.id);
    if ((count ?? 0) > 0 && !opts.force) {
      console.log(`Already ingested with transcript: ${existing.id}`);
      return { status: "skipped", detail: `Already ingested with transcript: ${existing.id}`, id: existing.id };
    }
    console.log(`Reprocessing ${existing.id} (${opts.force ? "--force" : "hollow row"})…`);
    const { error: delErr } = await sb.from("videos").delete().eq("id", existing.id);
    if (delErr) {
      console.error(`Delete failed: ${delErr.message}`);
      return { status: "failed", detail: `Delete failed: ${delErr.message}` };
    }
  }

  // 1. Metadata (official API).
  const metaRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${youtubeId}&key=${YOUTUBE_API_KEY}`,
  );
  if (!metaRes.ok) {
    const detail = `YouTube API error (HTTP ${metaRes.status}). Check YOUTUBE_API_KEY / quota.`;
    console.error(detail);
    return { status: "failed", detail };
  }
  const item = (await metaRes.json()).items?.[0];
  if (!item) {
    console.error("Video not found (private, deleted, or bad ID).");
    return { status: "failed", detail: "Video not found (private, deleted, or bad ID)." };
  }
  const sn = item.snippet ?? {};
  const thumbs = sn.thumbnails ?? {};
  const thumb =
    thumbs.maxres?.url ?? thumbs.sddefault?.url ?? thumbs.high?.url ??
    thumbs.medium?.url ?? thumbs.default?.url ?? "";
  const durationSec = iso8601ToSeconds(item.contentDetails?.duration ?? "PT0S");
  const category = opts.categoryOverride ?? YT_CATEGORY_MAP[String(sn.categoryId ?? "")] ?? "General";
  console.log(`metadata ok: "${sn.title}" (${durationSec}s, ${category})`);

  // 2. Captions via yt-dlp (subtitle track URLs straight from the info JSON —
  // no files written). Manual English preferred, auto-generated second.
  const binPath = youtubedl?.constants?.YOUTUBE_DL_PATH ?? "node_modules/youtube-dl-exec/bin/yt-dlp(.exe)";
  if (!existsSync(String(binPath))) {
    console.error(
      `yt-dlp binary not found at ${binPath}. Reinstall it with: node node_modules/youtube-dl-exec/scripts/postinstall.js ` +
        `(set GITHUB_TOKEN first if you hit GitHub API rate limits).`,
    );
  }
  // Non-speech tokens: [music], [applause], (laughter), ♪, etc. In caption
  // tracks these are near-always sound effects, never spoken content.
  const SFX_RE = /^\[.*\]$|^\(.*\)$|^♪+$/;
  function cleanSegText(raw) {
    // YouTube prefixes speaker-change lines with ">>" (" >> [music]").
    const text = String(raw ?? "").replace(/\s+/g, " ").trim().replace(/^>>\s*/, "");
    if (!text || text === "\n" || text === ">>" || SFX_RE.test(text)) return "";
    return text;
  }

  let words = [];
  let ytInfo = null; // full info JSON, reused for frame extraction
  try {
    const info = await youtubedl(url, { dumpSingleJson: true, noWarnings: true });
    ytInfo = info;
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
        const events = (j.events ?? []).filter((ev) => ev.segs?.length);
        events.forEach((ev, ei) => {
          const evStart = (ev.tStartMs ?? 0) / 1000;
          // Event span: its own duration, else the gap to the next event,
          // else a 2s fallback. Auto-caption segs carry no per-seg timings,
          // so each seg gets an even slice — preserving spoken order with
          // distinct start/end times (click-to-seek + highlight need these).
          let span = (ev.dDurationMs ?? 0) / 1000;
          if (!span || !Number.isFinite(span)) {
            const next = events.slice(ei + 1).find((e) => (e.tStartMs ?? 0) / 1000 > evStart);
            span = next ? (next.tStartMs / 1000 - evStart) : 2;
            if (!span || span <= 0 || !Number.isFinite(span)) span = 2;
          }
          const kept = ev.segs
            .map((seg) => ({ text: cleanSegText(seg.utf8), seg }))
            .filter((k) => k.text);
          const slice = span / Math.max(kept.length, 1);
          kept.forEach(({ text, seg }, si) => {
            const hasOwn = seg && Number.isFinite(seg.tStartMs) && Number.isFinite(seg.dDurationMs);
            if (hasOwn) {
              // Manual captions: trust the precise per-seg timings.
              const start = ((ev.tStartMs ?? 0) + seg.tStartMs) / 1000;
              words.push({ text, startTime: start, endTime: start + seg.dDurationMs / 1000 });
            } else {
              words.push({
                text,
                startTime: evStart + si * slice,
                endTime: evStart + (si + 1) * slice,
              });
            }
          });
        });
      }
    }
  } catch (e) {
    // youtube-dl-exec throws Error(stderr); a failed spawn (missing binary)
    // has empty stderr, so log every available field — never a blank line.
    console.error("yt-dlp failed:", e?.shortMessage ?? e?.stderr ?? e?.message ?? e);
    if (e?.exitCode !== undefined) console.error(`yt-dlp exitCode: ${e.exitCode}`);
    if (e?.stderr) console.error(`yt-dlp stderr: ${String(e.stderr).slice(0, 2000)}`);
    if (e?.stdout) console.error(`yt-dlp stdout: ${String(e.stdout).slice(0, 2000)}`);
    if (e?.code === "ENOENT" || (!e?.stderr && !e?.message)) {
      console.error(
        "Hint: yt-dlp binary missing or un-runnable? Run: node node_modules/youtube-dl-exec/scripts/postinstall.js " +
          "(set GITHUB_TOKEN if rate-limited), then: yt-dlp.exe --version. " +
          "If YouTube blocks with 'Sign in to confirm', run yt-dlp -U and retry with --extractor-args youtube:player_client=android,web.",
      );
    }
  }
  // Whisper via Groq on yt-dlp-downloaded audio. Only reached when the video
  // has no caption tracks at all (uploaders can disable them). Worst-quality
  // MP3 keeps uploads far under Groq's 25 MB cap (452s ≈ 2-4 MB).
  async function transcribeWithWhisper(youtubeUrl, durationSec) {
    const out = [];
    if (durationSec > 1800) {
      console.error("whisper skipped: video over 30 min");
      return out;
    }
    const tmp = join(tmpdir(), `ingest-${youtubeId}-${Date.now()}.mp3`);
    try {
      await youtubedl(youtubeUrl, {
        extractAudio: true,
        audioFormat: "mp3",
        audioQuality: 9,
        output: tmp,
        noWarnings: true,
      });
      let size = 0;
      try {
        size = statSync(tmp).size;
      } catch {
        console.error("whisper skipped: audio download produced no file (ffmpeg missing?)");
        return out;
      }
      console.log(`whisper audio: ${(size / 1024 / 1024).toFixed(1)} MB`);
      if (size > 24 * 1024 * 1024) {
        console.error("whisper skipped: audio over Groq's 25 MB upload cap");
        return out;
      }
      const audioBytes = readFileSync(tmp);
      for (const model of ["whisper-large-v3-turbo", "whisper-large-v3"]) {
        try {
          const form = new FormData();
          form.append("file", new Blob([audioBytes], { type: "audio/mpeg" }), "audio.mp3");
          form.append("model", model);
          form.append("response_format", "verbose_json");
          form.append("timestamp_granularities[]", "word");
          const tr = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
            body: form,
          });
          if (!tr.ok) {
            console.error(`groq whisper ${model} HTTP ${tr.status}`);
            continue;
          }
          const j = await tr.json();
          for (const w of j.words ?? []) {
            const text = cleanSegText(w.word);
            if (text) out.push({ text, startTime: Number(w.start ?? 0), endTime: Number(w.end ?? 0) });
          }
          if (out.length) {
            console.log(`whisper ok via ${model}: ${out.length} words`);
            break;
          }
        } catch (e) {
          console.error(`groq whisper ${model} failed:`, e.message ?? e);
        }
      }
    } catch (e) {
      console.error("whisper audio download failed:", e?.stderr ?? e?.message ?? e);
    } finally {
      try {
        unlinkSync(tmp);
      } catch {}
    }
    return out;
  }

  let transcriptSource = "captions";
  if (!words.length) {
    console.error("No captions — trying Whisper fallback (audio + Groq)…");
    words = await transcribeWithWhisper(url, durationSec);
    if (words.length) transcriptSource = "whisper";
  }
  if (!words.length) {
    console.error("No transcript obtained — aborting (not writing a hollow row).");
    return { status: "failed", detail: "No transcript obtained — aborting (not writing a hollow row)." };
  }
  console.log(`transcript ok: ${words.length} words (source=${transcriptSource})`);
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
    return { status: "failed", detail: "All Groq models failed — aborting." };
  }

  // 3b. Chapter frames (best-effort; a failed image never fails the ingest).
  // Real video frames via yt-dlp stream URL + ffmpeg, uploaded to Supabase.
  let frameInfos = ai.chapters.map(() => null);
  try {
    const { tmpdir } = await import("node:os");
    const { extractChapterFrames } = await import("./frames.mjs");
    frameInfos = await extractChapterFrames(
      sb,
      SUPABASE_URL,
      youtubeId,
      ytInfo,
      ai.chapters.map((c) => c.startTime),
      tmpdir(),
    );
  } catch (e) {
    console.error("chapter frames skipped:", e.message ?? e);
  }

  // 4. Write (service role bypasses RLS).
  const slug = await uniqueSlug(sb, sn.title ?? youtubeId);
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
    .single();
  if (vErr || !videoRow) {
    const detail = `Database write failed: ${vErr?.message ?? "unknown"}`;
    console.error(detail);
    return { status: "failed", detail };
  }
  if (ai.chapters.length) {
    const { error: cErr } = await sb.from("chapters").insert(
      ai.chapters.map((c, i) => ({
        video_id: videoRow.id,
        title: c.title,
        start_time: c.startTime,
        description: c.description,
        image_url: frameInfos[i]?.imageUrl ?? null,
        frame_time: frameInfos[i]?.frameTime ?? null,
      })),
    );
    if (cErr) {
      // Older DBs may lack the image columns (migration not run) — retry bare.
      console.error(`chapter write with images failed (${cErr.message}); retrying without…`);
      await sb.from("chapters").insert(
        ai.chapters.map((c) => ({ video_id: videoRow.id, title: c.title, start_time: c.startTime, description: c.description })),
      );
    }
  }
  const wordRows = words.map((w) => ({ video_id: videoRow.id, text: w.text, start_time: w.startTime, end_time: w.endTime }));
  for (let i = 0; i < wordRows.length; i += 1000) {
    const { error: wErr } = await sb.from("transcript_words").insert(wordRows.slice(i, i + 1000));
    if (wErr) {
      const detail = `Transcript write failed: ${wErr.message} (video id: ${videoRow.id})`;
      console.error(detail);
      return { status: "failed", detail };
    }
  }
  const frameCount = frameInfos.filter(Boolean).length;
  console.log(`done: ${videoRow.id} /video/${slug} (${wordRows.length} words, ${ai.chapters.length} chapters, ${frameCount} frames, source=${transcriptSource})`);
  return { status: "ok", id: videoRow.id, slug };
}
