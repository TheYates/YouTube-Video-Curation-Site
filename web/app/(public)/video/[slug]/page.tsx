import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getRelatedVideos, getVideo } from "../../../../lib/videos";
import VideoDetail from "../../../../components/video-detail";
import RelatedVideos from "../../../../components/related-videos";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const video = await getVideo(slug).catch(() => null);
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  const video = await getVideo(slug).catch(() => null);
  if (!video) notFound();
  // Old /video/<uuid> links (and any non-canonical slug) permanently point
  // at the frozen slug — keeps shared links and Google's index intact.
  if (slug !== video.slug) {
    permanentRedirect(`/video/${video.slug}${t ? `?t=${t}` : ""}`);
  }

  const tParam = Number(t ?? 0) || 0;
  const related = await getRelatedVideos(video).catch(() => []);

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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
      />
      <VideoDetail video={video} tParam={tParam} />
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
