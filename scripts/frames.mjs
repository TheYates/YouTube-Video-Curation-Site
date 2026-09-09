// Shared chapter-frame extraction: real video frames via yt-dlp + ffmpeg,
// uploaded to the public `frames` Supabase Storage bucket.
// Used by scripts/ingest.mjs, scripts/backfill-frames.mjs, and the
// POST /chapter-frame relay endpoint. Best-effort everywhere: any failure
// returns null so ingest never fails because of images.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// Smallest <=360p MP4 video stream: cheap remote seeks, fine for 16:9 stills.
export function pickFrameSourceUrl(info) {
  const vids = ((info ?? {}).formats ?? []).filter(
    (f) => f.url && f.ext === "mp4" && f.vcodec && f.vcodec !== "none" && (f.height ?? 0) <= 360,
  );
  if (!vids.length) return null;
  vids.sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  return (vids.find((f) => f.acodec === "none") ?? vids[0]).url ?? null;
}

// Single frame grab with fast (keyframe) seek. Accuracy ±2s is fine —
// chapter starts are AI-approximate anyway.
export function grabFrame(mediaUrl, seconds, outPath) {
  try {
    const r = spawnSync(
      "ffmpeg",
      ["-y", "-v", "error", "-ss", String(Math.max(0, seconds)), "-i", mediaUrl, "-frames:v", "1", "-q:v", "4", outPath],
      { timeout: 120000 },
    );
    return r.status === 0 && existsSync(outPath);
  } catch {
    return false;
  }
}

export function publicFrameUrl(supabaseUrl, storagePath) {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/frames/${storagePath}`;
}

// Upload (upsert) one JPEG; returns the public URL or null.
export async function uploadFrame(sb, supabaseUrl, storagePath, filePath) {
  try {
    const bytes = readFileSync(filePath);
    const { error } = await sb.storage.from("frames").upload(storagePath, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) {
      console.error(`frame upload failed (${storagePath}): ${error.message}`);
      return null;
    }
    return publicFrameUrl(supabaseUrl, storagePath);
  } catch (e) {
    console.error(`frame upload failed (${storagePath}):`, e.message ?? e);
    return null;
  }
}

// Capture + upload frames for each timestamp. Returns an array aligned with
// `timestamps`: { imageUrl, frameTime } or null per entry.
export async function extractChapterFrames(sb, supabaseUrl, youtubeId, info, timestamps, tmpDir, onLog = console.log) {
  const results = timestamps.map(() => null);
  const mediaUrl = pickFrameSourceUrl(info);
  if (!mediaUrl) {
    console.error("frames skipped: no <=360p mp4 stream in info JSON");
    return results;
  }
  const { join } = await import("node:path");
  for (let i = 0; i < timestamps.length; i++) {
    const t = Math.max(0, Number(timestamps[i] ?? 0));
    const tmp = join(tmpDir, `frame-${youtubeId}-ch${i}-${Date.now()}.jpg`);
    try {
      if (!grabFrame(mediaUrl, t, tmp)) {
        console.error(`frame ch${i} @${t}s: ffmpeg grab failed`);
        continue;
      }
      const storagePath = `${youtubeId}/ch${i}.jpg`;
      const imageUrl = await uploadFrame(sb, supabaseUrl, storagePath, tmp);
      if (imageUrl) {
        results[i] = { imageUrl, frameTime: t };
        onLog(`frame ch${i} @${t}s ok`);
      }
    } finally {
      const { unlinkSync } = await import("node:fs");
      try {
        unlinkSync(tmp);
      } catch {}
    }
  }
  return results;
}
