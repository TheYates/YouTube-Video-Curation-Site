import type { Metadata } from "next";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { getRelatedVideos, getVideo, getVideoListings } from "../../../../lib/videos";
import { buildTranscriptPayload } from "../../../../lib/transcript-payload";
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
  const description = video.summary
    ? video.summary.slice(0, 160)
    : `Full transcript, summary and chapters for "${video.title}" by ${video.channelName}.`;
  return {
    title: video.title,
    description,
    alternates: { canonical: `/video/${video.slug}` },
    openGraph: {
      title: video.title,
      description,
      type: "article",
      publishedTime: video.publishedAt,
      authors: [video.channelName],
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

  // VideoObject structured data: makes pages eligible for video rich
  // results (the "Discovered videos" track in Search Console).
  const dur = Math.max(0, Math.floor(video.durationSeconds));
  const isoDuration = `PT${Math.floor(dur / 3600)}H${Math.floor((dur % 3600) / 60)}M${dur % 60}S`;
  const videoJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.summary ? video.summary.slice(0, 500) : video.title,
    thumbnailUrl: [video.thumbnailUrl],
    uploadDate: new Date(video.publishedAt).toISOString(),
    duration: isoDuration,
    embedUrl: `https://www.youtube.com/embed/${video.youtubeId}`,
    contentUrl: `https://www.youtube.com/watch?v=${video.youtubeId}`,
    author: { "@type": "Person", name: video.channelName },
  };

  // Breadcrumbs give Google an explicit parent path (Home → this video)
  // instead of guessing at site hierarchy from the feed alone. Omitted when
  // no site URL is configured, since a relative `item` is not useful here.
  const siteBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const breadcrumbJsonLd = siteBase
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteBase },
          {
            "@type": "ListItem",
            position: 2,
            name: video.title,
            item: `${siteBase}/video/${video.slug}`,
          },
        ],
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
      />
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      )}
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
