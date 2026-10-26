// One-off live audit (2026-10): fetch every sitemap URL and measure the signals
// Google weighs when deciding "discovered -> crawled -> indexed".
//   - HTTP status, canonical, meta robots, title/description lengths
//   - parsed visible word count (thin-content proxy)
//   - JSON-LD types present
//   - inbound internal <a href> count from every other page (discovery paths)
// Usage: node scripts/_indexability-audit.mjs [origin]
// SAFE to delete after use — touches nothing, reads only.

const ORIGIN = (process.argv[2] ?? process.env.SITE_URL ?? "https://curateur-ashy.vercel.app").replace(/\/+$/, "");

async function jfetch(url, init = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { redirect: "follow", signal: controller.signal, ...init });
  } finally {
    clearTimeout(t);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Sitemap
const smRes = await jfetch(`${ORIGIN}/sitemap.xml`);
const xml = await smRes.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`sitemap.xml HTTP ${smRes.status} — ${urls.length} URLs`);

// 2. Page fetch + rough text/link extraction
function parsePage(html) {
  const strip = (s) => s.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const noScripts = strip(html);
  const links = [...noScripts.matchAll(/<a\b[^>]*href="([^"#][^"]*)"/gi)]
    .map((m) => m[1])
    .map((h) => {
      try {
        const abs = new URL(h, ORIGIN);
        if (abs.origin !== ORIGIN) return null;
        return abs.pathname.replace(/\/+$/, "") || "/";
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const robots = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i)?.[1] ?? null;
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i)?.[1] ?? null;
  const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "").trim();
  const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? "").trim();
  const ldTypes = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[\s\S]*?<\/script>/gi)].flatMap((m) =>
    [...m[0].matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((t) => t[1])
  );
  // main-ish content: drop <head> and mark uaer chrome, count words on the rest
  const bodyText = html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");
  const words = bodyText.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w) && w.length > 2).length;
  return { links, robots, canonical, title, desc, ldTypes, words };
}

const pages = new Map();
const queue = [...urls];
const results = [];
async function worker() {
  while (queue.length) {
    const url = queue.shift();
    try {
      const res = await jfetch(url);
      const html = res.ok ? await res.text() : "";
      const p = parsePage(html);
      const entry = {
        url,
        status: res.status,
        ...p,
        html,
      };
      results.push(entry);
      pages.set(url, entry);
    } catch (e) {
      results.push({ url, status: 0, error: String(e?.message ?? e), links: [], words: 0 });
      pages.set(url, { links: [] });
    }
    await sleep(60); // be gentle with prod
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

// 3. Inbound internal-link map
const inbound = new Map(urls.map((u) => [u, 0]));
const linkSources = new Map(urls.map((u) => [u, []]));
for (const page of results) {
  if (!page.links) continue;
  const from = new URL(page.url).pathname;
  for (const target of page.links) {
    const abs = `${ORIGIN}${target === "/" ? "" : target}`;
    if (inbound.has(abs) && abs !== new URL(page.url).origin + new URL(page.url).pathname.replace(/\/+$/, "")) {
      // count self-links too but skip exactself below; simpler: skip same path
      if (target === from) continue;
      inbound.set(abs, (inbound.get(abs) ?? 0) + 1);
      linkSources.get(abs)?.push(from);
    }
  }
}

// 4. Duplicate-content probes
const descByPath = new Map();
const summaries = [];
for (const r of results) {
  const path = new URL(r.url).pathname;
  if (r.desc) descByPath.set(r.desc, (descByPath.get(r.desc) ?? 0) + 1);
}

// 5. Report
const sections = { video: [], category: [], other: [] };
for (const r of results) {
  const path = new URL(r.url).pathname;
  if (path.startsWith("/video/")) sections.video.push(r);
  else if (path.startsWith("/category/")) sections.category.push(r);
  else sections.other.push(r);
}

const line = (r) => {
  const path = new URL(r.url).pathname;
  const inboundCount = inbound.get(r.url) ?? 0;
  const canonOk = !r.canonical || r.canonical.startsWith(ORIGIN);
  return {
    path,
    status: r.status,
    words: r.words ?? 0,
    inbound: inboundCount,
    title: r.title?.length ?? 0,
    desc: r.desc?.length ?? 0,
    ld: [...new Set(r.ldTypes ?? [])].join(","),
    robots: r.robots ?? "",
    canonicalOk: canonOk,
  };
};

console.log("\n=== PER-SECTION AGGREGATES ===");
for (const [name, rows] of Object.entries(sections)) {
  const stats = rows.map(line);
  const wordCounts = stats.map((s) => s.words).sort((a, b) => a - b);
  const wmin = wordCounts[0] ?? 0,
    wmed = wordCounts[Math.floor(wordCounts.length / 2)] ?? 0,
    wmax = wordCounts[wordCounts.length - 1] ?? 0;
  console.log(
    `${name}: ${rows.length} pages | words min/med/max ${wmin}/${wmed}/${wmax} | non-200 ${stats.filter((s) => s.status !== 200).length} | missing-desc ${stats.filter((s) => !s.desc).length} | inbound=0 ${stats.filter((s) => s.inbound === 0).length}`
  );
}

console.log("\n=== ORPHANS (0 internal inbound links) ===");
for (const r of results) {
  const c = line(r);
  if (c.inbound === 0 && r.status === 200) console.log(`${c.path} (${c.words}w)`);
}

console.log("\n=== THINNEST PAGES (lowest word counts) ===");
results
  .map(line)
  .filter((s) => s.status === 200)
  .sort((a, b) => a.words - b.words)
  .slice(0, 15)
  .forEach((s) => console.log(`${s.words}w  in=${s.inbound}  ${s.path}  ld=[${s.ld}]`));

console.log("\n=== NON-200 / CANONICAL / ROBOTS ISSUES ===");
for (const r of results) {
  const c = line(r);
  if (c.status !== 200 || !c.canonicalOk || c.robots) {
    console.log(`${c.path} status=${c.status} canonicalOk=${c.canonicalOk} robots="${c.robots}"`);
  }
}

console.log("\n=== DUPLICATE META DESCRIPTIONS (shared by >1 page) ===");
for (const [d, n] of descByPath) {
  if (n > 1) console.log(`${n}×  "${d.slice(0, 90)}…"`);
}

console.log("\n=== JSON-LD COVERAGE ===");
for (const [name, rows] of Object.entries(sections)) {
  const noLd = rows.filter((r) => !(r.ldTypes ?? []).length).length;
  const types = {};
  for (const r of rows) for (const t of new Set(r.ldTypes ?? [])) types[t] = (types[t] ?? 0) + 1;
  console.log(`${name}: missing=${noLd} types=${JSON.stringify(types)}`);
}

console.log("\n=== LINK DENSITY (internal links out, per section) ===");
for (const [name, rows] of Object.entries(sections)) {
  const counts = rows.map((r) => (r.links ?? []).length).sort((a, b) => a - b);
  console.log(`${name}: min/med/max out-links ${counts[0]}/${counts[Math.floor(counts.length / 2)]}/${counts[counts.length - 1]}`);
}
