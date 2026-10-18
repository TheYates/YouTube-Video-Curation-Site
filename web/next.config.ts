import path from "node:path";
import type { NextConfig } from "next";
import { VIDEO_SLUG_REDIRECTS } from "./lib/slug-redirects";

const nextConfig: NextConfig = {
  // Monorepo-adjacent layout (root + web/ lockfiles, plus a stray one in
  // C:\Users\PC) confuses Next's workspace-root inference — pin it here.
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  async redirects() {
    // Corrected slugs (see lib/slug-redirects.ts). Query strings such as ?t=
    // are preserved by Next's redirect handling.
    return Object.entries(VIDEO_SLUG_REDIRECTS).map(([from, to]) => ({
      source: `/video/${from}`,
      destination: `/video/${to}`,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        // /admin is behind middleware and already redirects anonymous callers,
        // but a redirect target can still be crawled. Say noindex explicitly
        // so the panel never becomes indexable noise.
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default nextConfig;
