// TEMP audit — reconcile the live sitemap against the database, and measure the
// signals that actually vary between pages (tags, chapter images/descriptions).
// Read-only.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: new URL("./.env", import.meta.url) });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SITE = "https://curateur-ashy.vercel.app";

// ── live sitemap vs DB ──
const res = await fetch(`${SITE}/sitemap.xml`);
const xml = await res.text();
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const sitemapVideo = locs.filter((u) => u.includes("/video/")).map((u) => u.split("/video/")[1]);
console.log(`sitemap: status=${res.status} bytes=${xml.length} locs=${locs.length} videoLocs=${sitemapVideo.length}`);
const nonVideo = locs.filter((u) => !u.includes("/video/")).map((u) => u.replace(SITE, "") || "/");
console.log(`non-video locs (${nonVideo.length}): ${nonVideo.join(", ")}`);

const { data: db, error } = await sb.from("videos").select("id,slug,transcript_text");
if (error) throw error;
const dbSlugs = new Set((db ?? []).map((r) => r.slug));
const smSlugs = new Set(sitemapVideo);
const missingFromSitemap = [...dbSlugs].filter((s) => !smSlugs.has(s));
const inSitemapNotDb = [...smSlugs].filter((s) => !dbSlugs.has(s));
console.log(`\nDB rows=${dbSlugs.size}  inSitemap=${smSlugs.size}`);
console.log(`in DB but NOT in sitemap (${missingFromSitemap.length}):`);
for (const s of missingFromSitemap) {
  const row = db.find((r) => r.slug === s);
  console.log(`   ${s}   transcript_text=${row?.transcript_text ? "present" : "NULL"}`);
}
console.log(`in sitemap but NOT in DB (${inSitemapNotDb.length}): ${inSitemapNotDb.join(", ") || "none"}`);

// ── tags: null vs empty array ──
const { data: tagRows } = await sb.from("videos").select("slug,tags").limit(500);
const nullTags = (tagRows ?? []).filter((r) => r.tags === null).length;
const emptyTags = (tagRows ?? []).filter((r) => Array.isArray(r.tags) && r.tags.length === 0).length;
console.log(`\ntags: NULL=${nullTags}  emptyArray=${emptyTags}  populated=${(tagRows ?? []).length - nullTags - emptyTags}`);

// ── chapter richness ──
const { data: ch } = await sb.from("chapters").select("video_id,description,image_url");
const total = (ch ?? []).length;
const withImg = (ch ?? []).filter((c) => c.image_url).length;
const withDesc = (ch ?? []).filter((c) => c.description && c.description.trim()).length;
console.log(`chapters: total=${total}  withImage=${withImg} (${Math.round((withImg / total) * 100)}%)  withDescription=${withDesc} (${Math.round((withDesc / total) * 100)}%)`);
const byVideo = new Map();
for (const c of ch ?? []) byVideo.set(c.video_id, (byVideo.get(c.video_id) ?? 0) + 1);
const noChapters = (db ?? []).filter((v) => !byVideo.has(v.id));
console.log(`videos with zero chapters: ${noChapters.length} ${noChapters.map((v) => v.slug).join(", ")}`);

// ── affiliate links ──
const { data: aff } = await sb.from("affiliate_links").select("video_id");
const affVideos = new Set((aff ?? []).map((a) => a.video_id));
console.log(`videos with affiliate links: ${affVideos.size} / ${dbSlugs.size}`);
