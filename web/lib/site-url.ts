// Single source of truth for the site's public origin — used by sitemap.xml,
// robots.txt, the RSS feed, and <link rel="alternate"> in the layout metadata.
//
// NEXT_PUBLIC_SITE_URL wins. If it is ever missing in production we fall back
// to the domain Vercel serves the project on rather than to localhost, so a
// forgotten env var degrades to the correct host instead of quietly shipping
// http://localhost:3000 URLs to Google.
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  // Set by Vercel on every deployment ("example.com", no protocol).
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
