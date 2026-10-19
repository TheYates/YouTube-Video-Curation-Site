import type { Metadata } from "next";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { getRelatedVideos, getVideo, getVideoListings } from "../../../../lib/videos";
import { buildTranscriptPayload } from "../../../../lib/transcript-payload";
import { videoJsonLd, safeJson, CURATOR } from "../../../../lib/schema";
import { truncateWords } from "../../../../lib/text";
import VideoDetail from "../../../../components/video-detail";
import RelatedVideos from "../../../../components/related-videos";

export const revalidate = 3600;

// Metadata and page run in parallel for the same slug — dedup the fetch so
// the video + transcript load once, not twice.
const getCachedVideo = cache(getVideo);

// This is what makes the route ISR-capable. Without it Next classifies
// /video/[slug] as fully dynamic and ignores `revalidate` entirely — every
// request re-rendered on the server and answered `cache-control: no-store`,
// which is what made cold pages so expensive for Googlebot. Listing paths here
// flips the route to prerendered + ISR, and slugs that only appear after this
// build are still rendered once and then served from the ISR cache (verified
// against `next start`).
//
// getVideoListings() already excludes rows with no transcript, so only pages
// with real content are prerendered, and the cap keeps build time bounded as
// the catalogue grows.
const PRERENDER_LIMIT = 100;

export async function generateStaticParams() {
  const listings = await getVideoListings().catch(() => []);
  return listings.slice(0, PRERENDER_LIMIT).map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const video = await getCachedVideo(slug).catch(() => null);
  if (!video) return { title: "Video not found" };
  // Word-boundary truncation: a hard slice(0, 160) cut mid-word and could leave
  // a trailing space, which is exactly what a SERP snippet shows.
  // The curator's own write-up leads the snippet when it exists — it is the
  // one description Google can't find anywhere else on the web.
  const description = truncateWords(
    video.editorialNote ||
      video.summary ||
      `Full transcript, summary and chapters for "${video.title}" by ${video.channelName}.`,
    155
  );
  return {
    title: video.title,
    description,
    // <meta name="author">: the curator, by name.
    authors: [{ name: CURATOR.name, url: CURATOR.url }],
    alternates: { canonical: `/video/${video.slug}` },
    openGraph: {
      title: video.title,
      description,
      type: "article",
      // The page's own publish date is when it was curated, not when the
      // source was uploaded to YouTube (which can be years earlier).
      publishedTime: new Date(video.curatedAt).toISOString(),
      modifiedTime: new Date(video.curatedAt).toISOString(),
      // article:author is a profile URL per the OG spec, not a name — the
      // curator's profile, so the page is attributed to a person rather than
      // the source channel (which is already named on-page and in the
      // VideoObject). Next's openGraph.authors only accepts strings/URLs.
      authors: [CURATOR.url],
      tags: video.tags,
      images: [{ url: video.thumbnailUrl, width: 1280, height: 720, alt: video.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: video.title,
      description,
      images: [video.thumbnailUrl],
    },
  };
}

export default async function VideoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const video = await getVideo(slug).catch(() => null);
  if (!video) notFound();
  // Old /video/<uuid> links (and any non-canonical slug) permanently point
  // at the frozen slug — keeps shared links and Google's index intact.
  //
  // Deliberately no searchParams here: awaiting it in a server component opts
  // the route into dynamic rendering, which silently voids `revalidate` above
  // and makes every Googlebot hit a cold server render + cold Supabase query.
  // The cost is that a legacy /video/<uuid>?t=300 link loses its seek on the
  // redirect — the video still loads. ?t= on a canonical URL is read
  // client-side in VideoDetail.
  if (slug !== video.slug) {
    permanentRedirect(`/video/${video.slug}`);
  }

  const related = await getRelatedVideos(video).catch(() => []);

  // Split the transcript off the video handed to the client component: word
  // text ships once (as compact paragraph text) instead of twice, and the
  // per-word {startTime,endTime} objects never reach the flight payload.
  const { transcript, ...videoMeta } = video;
  const transcriptPayload = buildTranscriptPayload(transcript);

  // One @graph carries the VideoObject (with Clip key moments) and the
  // breadcrumb trail: one script tag, two linked entities, and the publisher
  // resolved by @id against the site-wide Organization node in the layout.
  const jsonLd = videoJsonLd(video);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(jsonLd) }}
      />
      <VideoDetail video={videoMeta} transcript={transcriptPayload} />
      {related.length > 0 && (
        <div className="mx-auto max-w-5xl px-6">
          <div className="mt-16 border-t border-(--color-border) pt-10 pb-16">
            <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-(--color-accent)">
              More to Read
            </h2>
            <RelatedVideos videos={related} />
          </div>
        </div>
      )}
    </>
  );
}
