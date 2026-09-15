// Discovery worker — finds new videos from the curator's source channels,
// saved searches, and (unofficial) related-video mining, scores relevance
// with one batched Groq call, and stages everything in `video_candidates`
// as `pending`. Nothing is published here — the curator approves in
// /admin/review, and scripts/auto-pipeline.mjs ingests approved rows.
//
// Runs anywhere (official YouTube Data API is IP-agnostic; the Innertube
// related-mining leg is best-effort and simply logs-and-skips on failure).
//
// Usage: node scripts/discover.mjs [--dry-run] [--max-searches N]
//   --dry-run        fetch + score but write nothing to Supabase
//   --max-searches N cap how many saved search queries run this round
//                    (each costs ~100 quota units; default: all enabled)
//
// Env (scripts/.env or process env):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY, GROQ_API_KEY

import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  YOUTUBE_API_KEY,
  GROQ_API_KEY,
} = process.env;

const dryRun = process.argv.includes("--dry-run");
const maxSearchesIdx = process.argv.indexOf("--max-searches");
const maxSearches = maxSearchesIdx >= 0 ? Number(process.argv[maxSearchesIdx + 1]) : Infinity;

if (!dryRun && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Copy scripts/.env.example to scripts/.env.");
  process.exit(1);
}
if (!YOUTUBE_API_KEY) {
  console.error("Missing YOUTUBE_API_KEY.");
  process.exit(1);
}

const sb = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const YT_API = "https://www.googleapis.com/youtube/v3";
// Public Innertube key used by YouTube's own clients (same one yt-dlp and
// supabase/functions/ingest use). Only used for the best-effort related leg.
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const quota = { search: 0, playlistItems: 0, videos: 0, channels: 0 };

// ── YouTube Data API helpers ────────────────────────────────────────────────

async function ytGet(path, params, label, cost) {
  const u = new URL(`${YT_API}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  u.searchParams.set("key", YOUTUBE_API_KEY);
  const res = await fetch(u, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[discover] ${label} HTTP ${res.status}: ${body.slice(0, 300)}`);
    return null;
  }
  quota[label.split(".")[0]] = (quota[label.split(".")[0]] ?? 0) + cost;
  return res.json();
}

// Playlist ID of a channel's uploads: UC… → UU… (documented convention).
function uploadsPlaylistId(channelId) {
  return channelId.startsWith("UC") ? `UU${channelId.slice(2)}` : channelId;
}

// ── Innertube related-videos (unofficial, best-effort) ─────────────────────

// Parse related IDs from both response shapes: legacy compactVideoRenderer
// (richItemRenderer.content too) and the newer lockupViewModel.
function parseRelatedIds(json) {
  const ids = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === "compactVideoRenderer" || (k === "videoRenderer" && v?.videoId)) {
        if (v?.videoId) ids.add(v.videoId);
      } else if (k === "richItemRenderer" && v?.content?.videoRenderer?.videoId) {
        ids.add(v.content.videoRenderer.videoId);
      } else if (k === "lockupViewModel" && v?.contentId) {
        if (String(v?.contentType ?? "").includes("VIDEO") || v?.contentId?.length === 11) {
          ids.add(v.contentId);
        }
      }
      visit(v);
    }
  };
  visit(json);
  return [...ids];
}

async function fetchRelated(youtubeId) {
  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${INNERTUBE_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({
        context: { client: { clientName: "WEB", clientVersion: "2.20240701.00.00", hl: "en", gl: "US" } },
        videoId: youtubeId,
      }),
    });
    if (!res.ok) {
      console.error(`[discover] youtubei/next ${youtubeId} HTTP ${res.status}`);
      return [];
    }
    return parseRelatedIds(await res.json());
  } catch (e) {
    console.error(`[discover] youtubei/next ${youtubeId} failed:`, e?.message ?? e);
    return [];
  }
}

// ── Scoring: one batched Groq call for the whole run ───────────────────────

// Refreshed 2026-09 — mirrors the CHAT_MODELS chain in ingest-core.mjs.
const CHAT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];

async function scoreBatch(videos, siteCategories, siteContext) {
  if (!videos.length || !GROQ_API_KEY) return new Map();
  const lines = videos
    .map(
      (v, i) =>
        `${i}. "${v.title}" — channel: ${v.channel_name ?? "unknown"}; duration: ${Math.round(v.duration_sec / 60)} min; published: ${v.published_at ?? "unknown"}`
    )
    .join("\n");
  const prompt =
    `This curation site publishes thoughtful, lecture-style videos. Site categories: ${siteCategories.join(", ")}. ` +
    `Site context: ${siteContext}\n\nCandidate videos:\n${lines}\n\n` +
    `For EACH numbered video, judge how relevant it is for an editorial site of in-depth explained videos. ` +
    `Return JSON: { "scores": [{ "i": <index>, "score": <0-10 relevance>, "reason": "<one short sentence>", ` +
    `"category": "<one of the site categories, or General>" }] } — one entry per video, same order.`;

  for (const model of CHAT_MODELS) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature: 0.2,
          messages: [
            { role: "system", content: "You are a precise editorial assistant. Always respond with valid JSON only." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) {
        console.error(`[discover] groq chat ${model} HTTP ${res.status}`);
        continue;
      }
      const parsed = JSON.parse((await res.json()).choices?.[0]?.message?.content ?? "{}");
      const out = new Map();
      for (const s of Array.isArray(parsed.scores) ? parsed.scores : []) {
        const i = Number(s.i);
        if (!Number.isInteger(i) || i < 0 || i >= videos.length) continue;
        const score = Math.max(0, Math.min(10, Number(s.score) || 0));
        const cat = String(s.category ?? "General");
        out.set(videos[i].youtube_id, {
          score,
          reason: String(s.reason ?? "").slice(0, 300),
          suggested_category: siteCategories.includes(cat) ? cat : "General",
        });
      }
      console.log(`[discover] scored ${out.size}/${videos.length} candidates via ${model}`);
      return out;
    } catch (e) {
      console.error(`[discover] groq chat ${model} failed:`, e?.message ?? e);
    }
  }
  return new Map();
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `[discover] start${dryRun ? " (dry-run: nothing will be written)" : ""} — ${new Date().toISOString()}`
  );

  // Config: channels + searches (null sb → defaults, for --dry-run).
  let channels = [];
  let searches = [];
  if (sb) {
    const [{ data: ch, error: chErr }, { data: sq, error: sqErr }] = await Promise.all([
      sb.from("source_channels").select("*").eq("enabled", true).order("created_at"),
      sb.from("search_queries").select("*").eq("enabled", true).order("created_at"),
    ]);
    if (chErr || sqErr) {
      console.error(`[discover] config load failed: ${chErr?.message ?? ""} ${sqErr?.message ?? ""}`);
      process.exit(1);
    }
    channels = ch ?? [];
    searches = sq ?? [];
  } else {
    // Minimal defaults so --dry-run works without the DB.
    channels = [
      { id: "dry", channel_id: "UCSHZKyawb77ixDdsGog4iQ", handle: "lexfridman", name: "Lex Fridman", category: "Tech" },
      { id: "dry2", channel_id: "UCYO_jab_esuFRV4b17AJtAw", handle: "3blue1brown", name: "3Blue1Brown", category: "Tech" },
    ];
    searches = [{ id: "dry", query: "monetary policy explained", category: "Finance" }];
  }

  // Existing rows (dedupe): published videos + every candidate ever staged.
  const known = new Set();
  if (sb) {
    for (const [table, col] of [["videos", "youtube_id"], ["video_candidates", "youtube_id"]]) {
      let from = 0;
      for (;;) {
        const { data, error } = await sb.from(table).select(col).range(from, from + 999);
        if (error) {
          console.error(`[discover] dedupe read failed (${table}): ${error.message}`);
          process.exit(1);
        }
        for (const r of data ?? []) known.add(r[col]);
        if ((data?.length ?? 0) < 1000) break;
        from += 1000;
      }
    }
  }
  console.log(`[discover] ${channels.length} channels, ${searches.length} searches, ${known.size} known video IDs`);

  // ── Gather candidate IDs per source ──────────────────────────────────────
  // meta.get(id) → { ..., via, sourceId }; first discovery wins.
  const meta = new Map();
  const addId = (id, via, sourceId) => {
    if (!id || known.has(id) || meta.has(id)) return;
    meta.set(id, { via, sourceId: sourceId ?? null });
  };

  // 1. Channel uploads — 1 quota unit per channel, newest 10.
  let chBudget = 0;
  for (const ch of channels) {
    const pl = await ytGet(
      "playlistItems",
      { part: "contentDetails", playlistId: uploadsPlaylistId(ch.channel_id), maxResults: 10 },
      "playlistItems.list",
      1
    );
    if (!pl) continue;
    const items = pl.items ?? [];
    let fresh = 0;
    for (const it of items) {
      const vid = it?.contentDetails?.videoId;
      if (vid && !known.has(vid)) {
        addId(vid, "channel", ch.id);
        fresh++;
      }
    }
    chBudget++;
    if (items.length && sb) {
      await sb.from("source_channels").update({ last_discovered_at: new Date().toISOString() }).eq("id", ch.id);
    }
    console.log(`[discover] channel @${ch.handle}: ${fresh} new of ${items.length}`);
  }

  // 2. Saved searches — 100 units each; poll with publishedAfter to stay cheap.
  let searchBudget = 0;
  for (const q of searches.slice(0, Number.isFinite(maxSearches) ? maxSearches : searches.length)) {
    const publishedAfter = q.last_polled_at
      ? new Date(new Date(q.last_polled_at).getTime() - 24 * 3600 * 1000).toISOString() // 1d overlap
      : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(); // first poll: 30d window
    const sr = await ytGet(
      "search",
      { part: "id", q: q.query, type: "video", order: "date", publishedAfter, maxResults: 10 },
      "search.list",
      100
    );
    if (!sr) continue;
    let fresh = 0;
    for (const it of sr.items ?? []) {
      if (it?.id?.videoId && !known.has(it.id.videoId)) {
        addId(it.id.videoId, "search", q.id);
        fresh++;
      }
    }
    searchBudget++;
    if (sb) {
      await sb.from("search_queries").update({ last_polled_at: new Date().toISOString() }).eq("id", q.id);
    }
    console.log(`[discover] search "${q.query}": ${fresh} new`);
  }

  // 3. Related mining — unofficial, free; rotate through already-ingested
  // videos so each run explores different neighborhoods.
  let ingestedIds = [];
  if (sb) {
    const { data, error } = await sb
      .from("videos")
      .select("youtube_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) ingestedIds = (data ?? []).map((r) => r.youtube_id);
  } else {
    ingestedIds = ["aircAruvnKk"]; // dry-run stand-in
  }
  const relatedStart = Math.floor(Date.now() / (6 * 3600 * 1000)); // rotates 4×/day
  const relatedBatch = [];
  for (let i = 0; i < 10 && ingestedIds.length; i++) {
    relatedBatch.push(ingestedIds[(relatedStart + i) % ingestedIds.length]);
  }
  let relatedFresh = 0;
  for (const vid of relatedBatch) {
    for (const rid of await fetchRelated(vid)) addId(rid, "related", null);
    relatedFresh++;
  }
  console.log(`[discover] related mining: ${relatedBatch.length} seeds → ${meta.size} total new candidates so far`);

  if (!meta.size) {
    console.log("[discover] nothing new — done.");
    console.log(
      `[discover] quota used: search=${quota.search} playlistItems=${quota.playlistItems} videos=${quota.videos} (est. total units)`
    );
    return;
  }

  // ── Bulk metadata for all new IDs (1 unit per ≤50) ───────────────────────
  const ids = [...meta.keys()];
  const details = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const vr = await ytGet(
      "videos",
      { part: "snippet,contentDetails", id: chunk.join(",") },
      "videos.list",
      1
    );
    for (const item of vr?.items ?? []) {
      const sn = item.snippet ?? {};
      const m = String(item.contentDetails?.duration ?? "PT0S").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const dur =
        Number(m?.[1] ?? 0) * 3600 + Number(m?.[2] ?? 0) * 60 + Number(m?.[3] ?? 0);
      const thumbs = sn.thumbnails ?? {};
      details.push({
        youtube_id: item.id,
        title: sn.title ?? item.id,
        channel_id: sn.channelId ?? null,
        channel_name: sn.channelTitle ?? null,
        duration_sec: dur,
        thumbnail_url:
          thumbs.medium?.url ?? thumbs.high?.url ?? thumbs.default?.url ?? "",
        published_at: (sn.publishedAt ?? "").slice(0, 10) || null,
        ...meta.get(item.id),
      });
    }
  }
  console.log(`[discover] metadata resolved for ${details.length}/${ids.length} candidates`);

  // Skip live/upcoming or absurdly long videos (transcript pipeline caps at
  // 30 min for Whisper; captions still work past that but keep quality high).
  const eligible = details.filter((d) => {
    if (d.duration_sec <= 0 || d.duration_sec > 4 * 3600) {
      console.log(`[discover] skip ${d.youtube_id}: duration ${d.duration_sec}s`);
      return false;
    }
    return true;
  });

  // ── Score (batched Groq calls, chunked to stay under request size limits) ──
  let siteCategories = ["Education", "Finance", "Tech", "Science", "Philosophy"];
  let siteContext = "an editorial curation site for in-depth explained videos";
  if (sb) {
    const { data: catRows } = await sb.from("videos").select("category").limit(1000);
    const uniq = [...new Set((catRows ?? []).map((r) => r.category).filter(Boolean))];
    if (uniq.length) siteCategories = uniq;
    const { data: settings } = await sb.from("app_settings").select("value").eq("key", "site_context").maybeSingle();
    if (settings?.value) siteContext = settings.value;
  }
  const scores = new Map();
  const SCORE_CHUNK = 40; // ~340-item batches exceed Groq's request size limit
  for (let i = 0; i < eligible.length; i += SCORE_CHUNK) {
    const part = await scoreBatch(eligible.slice(i, i + SCORE_CHUNK), siteCategories, siteContext);
    for (const [k, v] of part) scores.set(k, v);
  }

  // ── Write candidates (first discovery source wins) ───────────────────────
  const rows = eligible.map((d) => {
    const s = scores.get(d.youtube_id);
    return {
      youtube_id: d.youtube_id,
      title: d.title,
      channel_id: d.channel_id,
      channel_name: d.channel_name,
      duration_sec: d.duration_sec,
      thumbnail_url: d.thumbnail_url,
      published_at: d.published_at,
      discovered_via: d.via,
      source_id: d.sourceId,
      score: s?.score ?? 5,
      reason: s?.reason ?? (s ? "" : "Unscored (Groq unavailable) — curator judgement call."),
      suggested_category: s?.suggested_category ?? "General",
      status: "pending",
    };
  });

  if (dryRun) {
    console.log(`[discover] DRY RUN — would insert ${rows.length} candidates:`);
    for (const r of [...rows].sort((a, b) => b.score - a.score)) {
      console.log(`  [${r.score.toFixed(1)}] (${r.discovered_via}) ${r.title} — ${r.channel_name ?? "?"} · ${r.reason}`);
    }
  } else {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from("video_candidates").upsert(rows.slice(i, i + 500), {
        onConflict: "youtube_id",
        ignoreDuplicates: true,
      });
      if (error) {
        console.error(`[discover] candidate write failed: ${error.message}`);
        process.exit(1);
      }
    }
    console.log(`[discover] staged ${rows.length} candidates as pending (dedupe-safe upsert)`);
  }

  console.log(
    `[discover] quota used: search=${quota.search} (×${searchBudget}) playlistItems=${quota.playlistItems} (×${chBudget}) videos=${quota.videos} — est. ${quota.search + quota.playlistItems + quota.videos} units`
  );
}

main().catch((e) => {
  console.error("[discover] fatal:", e);
  process.exit(1);
});
