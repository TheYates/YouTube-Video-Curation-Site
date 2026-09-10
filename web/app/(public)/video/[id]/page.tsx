import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRelatedVideos, getVideo } from "../../../../lib/videos";
import VideoDetail from "../../../../components/video-detail";
import RelatedVideos from "../../../../components/related-videos";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const video = await getVideo(id).catch(() => null);
  if (!video) return { title: "Video not found" };
  const description = video.summary
    ? video.summary.slice(0, 160)
    : `Full transcript, summary and chapters for "${video.title}" by ${video.channelName}.`;
  return {
    title: video.title,
    description,
    alternates: { canonical: `/video/${id}` },
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
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
  const video = await getVideo(id).catch(() => null);
  if (!video) notFound();

  const tParam = Number(t ?? 0) || 0;
  const related = await getRelatedVideos(video).catch(() => []);

  return (
    <>
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
