// IndexNow submitter — notifies Bing/Yandex/Seznam about new or changed URLs so
// they recrawl sooner (Google does not participate; it uses its own discovery).
//
// Best-effort by design: a network or config failure must never fail an ingest.
// The key is public — it is served at /<key>.txt (web/public/<key>.txt) and the
// endpoint verifies that file before accepting a submission, so the site must
// be deployed for pings to be accepted (HTTP 403 = key file missing).
//
// Env (scripts/.env): SITE_URL (deployed origin, e.g.
// https://curateur-ashy.vercel.app) and optionally INDEXNOW_KEY to rotate the
// key. If SITE_URL is unset the current production fallback is used.

import { pathToFileURL } from "node:url";

const KEY = process.env.INDEXNOW_KEY ?? "1244baf298f938e625a46d29dfe69672";
const FALLBACK_ORIGIN = "https://curateur-ashy.vercel.app";

function siteOrigin() {
  const explicit = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  return (explicit || FALLBACK_ORIGIN).replace(/\/+$/, "");
}

function toAbsolute(input) {
  const p = String(input ?? "").trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  return `${siteOrigin()}${p.startsWith("/") ? p : `/${p}`}`;
}

// paths: a path ("/video/my-slug") or absolute URL, or an array of either.
export async function pingIndexNow(paths) {
  const urlList = (Array.isArray(paths) ? paths : [paths]).map(toAbsolute).filter(Boolean);
  if (!urlList.length) return { ok: false, reason: "no urls" };
  const origin = siteOrigin();
  const body = {
    host: new URL(origin).host,
    key: KEY,
    keyLocation: `${origin}/${KEY}.txt`,
    urlList,
  };
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    // 200/202 accepted; 422 one+ URLs rejected; 403 key file not found; 429 throttled.
    if (res.status === 200 || res.status === 202) {
      console.log(`[indexnow] submitted ${urlList.length} url(s) — HTTP ${res.status}`);
      return { ok: true, status: res.status };
    }
    console.error(`[indexnow] rejected: HTTP ${res.status} (${await res.text().catch(() => "")})`);
    return { ok: false, status: res.status };
  } catch (e) {
    console.error(`[indexnow] request failed: ${e?.message ?? e}`);
    return { ok: false, reason: String(e?.message ?? e) };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const { default: dotenv } = await import("dotenv");
  dotenv.config({ path: new URL("./.env", import.meta.url) });
  const args = process.argv.slice(2);
  let urls = args.filter((a) => !a.startsWith("--"));
  if (args.includes("--sitemap")) {
    try {
      const res = await fetch(`${siteOrigin()}/sitemap.xml`);
      const xml = await res.text();
      urls = [...urls, ...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])];
    } catch (e) {
      console.error(`[indexnow] could not fetch sitemap: ${e?.message ?? e}`);
    }
  }
  if (!urls.length) {
    console.log("usage: node scripts/indexnow.mjs <path-or-url>... [--sitemap]");
    process.exit(1);
  }
  const result = await pingIndexNow(urls);
  process.exit(result.ok ? 0 : 1);
}
