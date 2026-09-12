// Local ingest relay — the fix for YouTube blocking Supabase Edge Function
// (datacenter) IPs. Runs on YOUR machine (residential IP) and reuses the
// proven scripts/ingest.mjs pipeline (yt-dlp → Groq → Supabase) verbatim by
// spawning it as a subprocess, then reads back the written row to build the
// same JSON shape the Edge Function returns.
//
// Usage:  npm run ingest:serve   (or: node scripts/serve-ingest.mjs)
//   Binds 127.0.0.1:8931 by default (INGEST_PORT overrides — Windows
//   Hyper-V port exclusions can swallow the old 8917 on some boots).
//   POST http://127.0.0.1:8931/ingest        { "youtubeUrl": "...", "force": false }
//   POST http://127.0.0.1:8931/ingest-batch  { "urls": ["...", ...], "force": false } (NDJSON stream)
//   POST http://127.0.0.1:8931/chapter-frame { "youtubeId": "...", "chapterIndex": 0, "timestamp": 60 }
//   POST http://127.0.0.1:8931/video-delete  { "videoId": "<uuid>" }
//   GET  http://127.0.0.1:8931/health  → { "ok": true, "version": 4, ... }
//
// Security: binds 127.0.0.1 only (localhost, no LAN exposure). If INGEST_TOKEN
// is set in scripts/.env, requests must send header x-ingest-token: <token>.
// Env (scripts/.env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (+ the keys
// ingest.mjs itself needs: YOUTUBE_API_KEY, GROQ_API_KEY).

import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import youtubedl from "youtube-dl-exec";

const PORT = Number(process.env.INGEST_PORT ?? 8931);
const HOST = "127.0.0.1";
const TOKEN = process.env.INGEST_TOKEN ?? "";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in scripts/.env.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function extractYouTubeId(u) {
  const patterns = [
    /(?:v=|vi=|shorts\/|live\/|embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = String(u ?? "").match(p);
    if (m) return m[1];
  }
  return null;
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    // Only the local Vite dev server needs this; localhost-only anyway.
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, x-ingest-token",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

// Single-user admin tool: serialize ingest runs so two pastes can't interleave
// (ingest.mjs deletes + reinserts rows, which races badly).
let queue = Promise.resolve();
function enqueue(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function rowStats(youtubeId) {
  const { data: row } = await sb.from("videos").select("id").eq("youtube_id", youtubeId).maybeSingle();
  if (!row) return null;
  const [{ count: words }, { data: chapters }] = await Promise.all([
    sb.from("transcript_words").select("id", { count: "exact", head: true }).eq("video_id", row.id),
    sb.from("chapters").select("id").eq("video_id", row.id),
  ]);
  return { id: row.id, words: words ?? 0, chapters: chapters?.length ?? 0 };
}

function runIngestScript(youtubeUrl, force) {
  return new Promise((resolve) => {
    let scriptPath = new URL("./ingest.mjs", import.meta.url).pathname;
    // file-URL pathnames are percent-encoded and (on Windows) have a
    // leading slash ("/C:/...") — decode + strip so spawn finds the file.
    try {
      scriptPath = decodeURI(scriptPath);
    } catch {}
    if (process.platform === "win32" && /^\/[A-Za-z]:\//.test(scriptPath)) scriptPath = scriptPath.slice(1);
    const args = [scriptPath, youtubeUrl];
    if (force) args.push("--force");
    let cwd = new URL("..", import.meta.url).pathname;
    // On Windows, file-URL pathnames have a leading slash ("/C:/...") —
    // decode + strip it so spawn finds the directory.
    try {
      cwd = decodeURI(cwd);
    } catch {}
    if (process.platform === "win32" && /^\/[A-Za-z]:\//.test(cwd)) cwd = cwd.slice(1);
    const child = spawn(process.execPath, args, { cwd, timeout: 8 * 60 * 1000 });
    let out = "";
    let err = "";
    child.stdout?.on("data", (d) => {
      out += d;
    });
    child.stderr?.on("data", (d) => {
      err += d;
    });
    child.on("error", (e) => resolve({ code: 1, out, err: err + String(e?.message ?? e) }));
    child.on("close", (code) => resolve({ code: code ?? 1, out, err }));
  });
}

// One video through scripts/ingest.mjs (single-URL mode — output lines the
// relay parses are unchanged). Shared by POST /ingest and /ingest-batch.
async function ingestSingleViaScript(youtubeUrl, force) {
  const youtubeId = extractYouTubeId(youtubeUrl);
  console.log(`[relay] ingest ${youtubeId} (force=${force})…`);
  const { code, out, err } = await runIngestScript(youtubeUrl, force);
  const log = (out + "\n" + err).trim();
  console.log(log.split("\n").slice(-6).join("\n"));
  if (code !== 0) {
    const lines = log.split("\n").filter(Boolean).slice(-4);
    return {
      status: "failed",
      youtubeId,
      detail: lines.join(" | ") || "ingest.mjs failed with no output.",
    };
  }
  const already = /Already ingested with transcript: (\S+)/.exec(out);
  const sourceMatch = /source=(captions|whisper)/.exec(out);
  const stats = await rowStats(youtubeId);
  if (!stats) {
    return { status: "failed", youtubeId, detail: "Script exited 0 but no video row found." };
  }
  const transcriptSource = sourceMatch?.[1] ?? "captions";
  console.log(`[relay] done: ${stats.id} (${stats.words} words, ${stats.chapters} chapters, source=${transcriptSource})`);
  return {
    status: already ? "skipped" : "ok",
    youtubeId,
    id: stats.id,
    words: stats.words,
    chapters: stats.chapters,
    transcriptSource,
    detail: already ? `Already ingested with transcript: ${stats.id}` : undefined,
  };
}

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/health") {
    const binPath = youtubedl?.constants?.YOUTUBE_DL_PATH ?? "";
    // Bump version whenever routes change — the admin UI shows it, so a
    // stale relay (old 404 text, missing routes) is obvious in one glance.
    return send(res, 200, { ok: true, version: 5, routes: ["POST /ingest", "POST /ingest-batch", "POST /chapter-frame", "POST /video-delete", "POST /setting", "GET /health"], ytDlpBinary: binPath ? existsSync(String(binPath)) : false });
  }

  if (req.method === "POST" && url.pathname === "/chapter-frame") {
    if (TOKEN && req.headers["x-ingest-token"] !== TOKEN) {
      return send(res, 401, { error: "Bad or missing x-ingest-token." });
    }
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 100_000) req.destroy();
    });
    req.on("end", () => {
      enqueue(async () => {
        let youtubeId = "";
        let chapterIndex = -1;
        let timestamp = NaN;
        try {
          const body = JSON.parse(raw || "{}");
          youtubeId = extractYouTubeId(body.youtubeUrl ?? body.youtubeId ?? "") ?? String(body.youtubeId ?? "");
          chapterIndex = Number(body.chapterIndex);
          timestamp = Number(body.timestamp);
        } catch {
          return send(res, 400, { error: "Expected JSON { youtubeUrl|youtubeId, chapterIndex, timestamp }." });
        }
        if (!youtubeId || !Number.isInteger(chapterIndex) || chapterIndex < 0 || !Number.isFinite(timestamp) || timestamp < 0) {
          return send(res, 400, { error: "Expected JSON { youtubeUrl|youtubeId, chapterIndex >= 0, timestamp >= 0 }." });
        }
        // Chapters have no index column — nth by start_time is the index.
        const { data: chapters, error: chErr } = await sb
          .from("chapters")
          .select("id,start_time")
          .eq("video_id", (await sb.from("videos").select("id").eq("youtube_id", youtubeId).maybeSingle()).data?.id ?? "")
          .order("start_time");
        if (chErr) return send(res, 500, { error: `Chapter lookup failed: ${chErr.message}` });
        const chRow = (chapters ?? [])[chapterIndex];
        if (!chRow) return send(res, 404, { error: `Chapter ${chapterIndex} not found for ${youtubeId}.` });
        console.log(`[relay] frame ${youtubeId} ch${chapterIndex} @${timestamp}s…`);
        const { tmpdir } = await import("node:os");
        const { default: ytdl } = await import("youtube-dl-exec");
        const { extractChapterFrames } = await import("./frames.mjs");
        const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
        let info = null;
        try {
          info = await ytdl(watchUrl, { dumpSingleJson: true, noWarnings: true, skipDownload: true });
        } catch (e) {
          return send(res, 502, { error: `yt-dlp info fetch failed: ${String(e?.stderr ?? e?.message ?? e).slice(0, 300)}` });
        }
        const [frame] = await extractChapterFrames(sb, SUPABASE_URL, youtubeId, info, [timestamp], tmpdir());
        if (!frame) return send(res, 422, { error: "Frame capture/upload failed (see relay log)." });
        const { error: upErr } = await sb
          .from("chapters")
          .update({ image_url: frame.imageUrl, frame_time: frame.frameTime })
          .eq("id", chRow.id);
        if (upErr) return send(res, 500, { error: `Chapter update failed: ${upErr.message}` });
        console.log(`[relay] frame ok: ${frame.imageUrl}`);
        return send(res, 200, { imageUrl: frame.imageUrl, frameTime: frame.frameTime, chapterIndex });
      }).catch((e) => {
        console.error("[relay] chapter-frame failed:", e);
        try {
          send(res, 500, { error: String(e?.message ?? e) });
        } catch {}
      });
    });
    return;
  }

  // Setting: curator-controlled site settings (service-role write; public
  // read via RLS). Keys are allow-listed + validated — never a generic KV.
  if (req.method === "POST" && url.pathname === "/setting") {
    if (TOKEN && req.headers["x-ingest-token"] !== TOKEN) {
      return send(res, 401, { error: "Bad or missing x-ingest-token." });
    }
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 100_000) req.destroy();
    });
    req.on("end", () => {
      enqueue(async () => {
        let key = "";
        let value = "";
        try {
          const body = JSON.parse(raw || "{}");
          key = String(body.key ?? "");
          value = String(body.value ?? "");
        } catch {
          return send(res, 400, { error: "Expected JSON { key, value }." });
        }
        if (key === "min_category_videos") {
          const n = Number(value);
          if (!Number.isInteger(n) || n < 1 || n > 20) {
            return send(res, 400, { error: "min_category_videos must be an integer 1–20." });
          }
          value = String(n);
        } else {
          return send(res, 400, { error: `Unknown setting: ${key || "(empty)"}.` });
        }
        const { error: upErr } = await sb
          .from("app_settings")
          .upsert({ key, value }, { onConflict: "key" });
        if (upErr) return send(res, 500, { error: `Setting update failed: ${upErr.message}` });
        console.log(`[relay] setting ${key}=${value}`);
        return send(res, 200, { key, value });
      }).catch((e) => {
        console.error("[relay] setting failed:", e);
        try {
          send(res, 500, { error: String(e?.message ?? e) });
        } catch {}
      });
    });
    return;
  }

  // Delete: removes the videos row (Postgres cascades transcript_words,
  // chapters, affiliate_links, page_views) plus the chapter frame images in
  // Storage (no cascade there). Serialized through the same mutex so a
  // delete can never interleave with an ingest of the same video.
  if (req.method === "POST" && url.pathname === "/video-delete") {
    if (TOKEN && req.headers["x-ingest-token"] !== TOKEN) {
      return send(res, 401, { error: "Bad or missing x-ingest-token." });
    }
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 100_000) req.destroy();
    });
    req.on("end", () => {
      enqueue(async () => {
        let videoId = "";
        try {
          videoId = String(JSON.parse(raw || "{}").videoId ?? "");
        } catch {
          return send(res, 400, { error: "Expected JSON { videoId }." });
        }
        if (!videoId) return send(res, 400, { error: "Expected JSON { videoId }." });
        const { data: row, error: rowErr } = await sb
          .from("videos")
          .select("id,youtube_id,title")
          .eq("id", videoId)
          .maybeSingle();
        if (rowErr) return send(res, 500, { error: `Video lookup failed: ${rowErr.message}` });
        if (!row) return send(res, 404, { error: `Video ${videoId} not found.` });
        console.log(`[relay] delete ${row.youtube_id} "${(row.title ?? "").slice(0, 60)}"…`);
        // Storage frames first (no FK cascade into buckets).
        try {
          const { data: files } = await sb.storage.from("frames").list(row.youtube_id);
          if (files?.length) {
            const { error: rmErr } = await sb.storage
              .from("frames")
              .remove(files.map((f) => `${row.youtube_id}/${f.name}`));
            if (rmErr) console.error(`[relay] frame cleanup warning: ${rmErr.message}`);
          }
        } catch (e) {
          console.error(`[relay] frame cleanup warning:`, e?.message ?? e);
        }
        const { error: delErr } = await sb.from("videos").delete().eq("id", row.id);
        if (delErr) return send(res, 500, { error: `Delete failed: ${delErr.message}` });
        console.log(`[relay] deleted ${row.youtube_id}`);
        return send(res, 200, { id: row.id, youtubeId: row.youtube_id });
      }).catch((e) => {
        console.error("[relay] video-delete failed:", e);
        try {
          send(res, 500, { error: String(e?.message ?? e) });
        } catch {}
      });
    });
    return;
  }

  // Batch: sequential NDJSON stream — one JSON line per video as it
  // completes, plus a final { done: true, … } summary line. The whole batch
  // holds one mutex slot so it never interleaves with single ingests.
  if (req.method === "POST" && url.pathname === "/ingest-batch") {
    if (TOKEN && req.headers["x-ingest-token"] !== TOKEN) {
      return send(res, 401, { error: "Bad or missing x-ingest-token." });
    }
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      enqueue(async () => {
        let entryList = [];
        let force = false;
        try {
          const body = JSON.parse(raw || "{}");
          const rawUrls = Array.isArray(body.urls) ? body.urls : body.youtubeUrls ?? [];
          force = body.force === true;
          entryList = [...new Set(rawUrls.map((u) => String(u ?? "").trim()).filter(Boolean))];
        } catch {
          return send(res, 400, { error: "Expected JSON body { urls: string[], force? }." });
        }
        if (!entryList.length) return send(res, 400, { error: "Expected JSON body { urls: string[], force? }." });
        if (entryList.length > 25) return send(res, 400, { error: "Max 25 URLs per batch." });
        res.writeHead(200, {
          "Content-Type": "application/x-ndjson",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "content-type, x-ingest-token",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        });
        // Batches run long — disable the socket timeout for this response.
        res.setTimeout(0);
        const n = entryList.length;
        let ok = 0;
        let skipped = 0;
        let failed = 0;
        for (let i = 0; i < n; i++) {
          const line = await ingestSingleViaScript(entryList[i], force);
          if (line.status === "ok") ok++;
          else if (line.status === "skipped") skipped++;
          else failed++;
          res.write(JSON.stringify({ i, n, url: entryList[i], ...line }) + "\n");
        }
        console.log(`[relay] batch done: ${ok} ok, ${skipped} skipped, ${failed} failed`);
        res.end(JSON.stringify({ done: true, n, ok, skipped, failed }) + "\n");
      }).catch((e) => {
        console.error("[relay] batch failed:", e);
        try {
          res.end(JSON.stringify({ done: true, error: String(e?.message ?? e) }) + "\n");
        } catch {}
      });
    });
    return;
  }

  if (req.method !== "POST" || url.pathname !== "/ingest") {
    return send(res, 404, { error: "POST /ingest, POST /ingest-batch, POST /chapter-frame, POST /video-delete, POST /setting, or GET /health only." });
  }
  if (TOKEN && req.headers["x-ingest-token"] !== TOKEN) {
    return send(res, 401, { error: "Bad or missing x-ingest-token." });
  }

  let raw = "";
  req.on("data", (c) => {
    raw += c;
    if (raw.length > 1_000_000) req.destroy();
  });
  req.on("end", () => {
    enqueue(async () => {
      let youtubeUrl = "";
      let force = false;
      try {
        const body = JSON.parse(raw || "{}");
        youtubeUrl = body.youtubeUrl ?? "";
        force = body.force === true;
      } catch {
        return send(res, 400, { error: "Expected JSON body { youtubeUrl, force? }." });
      }
      const youtubeId = extractYouTubeId(youtubeUrl);
      if (!youtubeId) return send(res, 400, { error: "Could not parse a YouTube video ID from that URL." });
      const line = await ingestSingleViaScript(youtubeUrl, force);
      if (line.status === "failed") {
        return send(res, 422, {
          error: line.detail || "ingest.mjs failed with no output.",
          youtubeId,
          transcriptSource: "none",
          aiOk: false,
        });
      }
      return send(res, 200, {
        id: line.id,
        youtubeId,
        words: line.words,
        chapters: line.chapters,
        transcriptSource: line.transcriptSource,
        aiOk: true,
        ...(line.status === "skipped" ? { deduped: true } : {}),
      });
    }).catch((e) => {
      console.error("[relay] request failed:", e);
      try {
        send(res, 500, { error: String(e?.message ?? e) });
      } catch {}
    });
  });
});

server.on("error", (e) => {
  if (e?.code === "EACCES" || e?.code === "EADDRINUSE") {
    console.error(
      `Cannot bind ${HOST}:${PORT} (${e.code}). Another relay may be running, ` +
        `or Windows reserved the port (Hyper-V exclusions move on reboot). ` +
        `Kill stale relays or set INGEST_PORT to a free port, e.g.: $env:INGEST_PORT=8931; npm run ingest:serve`,
    );
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, HOST, () => {
  console.log(`ingest relay listening on http://${HOST}:${PORT} (localhost only)`);
});
