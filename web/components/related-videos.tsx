import Link from "next/link";
import type { Video } from "../lib/types";
import ThumbImage from "./thumb-image";

export default function RelatedVideos({ videos }: { videos: Video[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {videos.map((video) => (
        <Link key={video.id} href={`/video/${video.slug}`} className="group block">
          <div className="overflow-hidden rounded-sm" style={{ aspectRatio: "16/9" }}>
            <ThumbImage
              src={video.thumbnailUrl}
              alt={video.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="mt-3">
            <p className="font-mono text-xs uppercase tracking-widest text-(--color-accent)">
              {video.category}
            </p>
            <h3 className="mt-1 font-display text-base leading-snug text-(--color-foreground) transition-colors group-hover:text-(--color-accent)">
              {video.title}
            </h3>
            <p className="mt-1 font-mono text-xs text-(--color-muted-foreground)">
              {video.channelName}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
