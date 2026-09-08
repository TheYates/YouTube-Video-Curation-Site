import { Link } from "react-router-dom"
import type { Video } from "../data/types"

interface Props {
  videos: Video[]
}

export default function RelatedVideos({ videos }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {videos.map((video) => (
        <Link
          key={video.id}
          to={`/video/${video.id}`}
          className="group block"
        >
          <div className="overflow-hidden rounded-sm" style={{ aspectRatio: "16/9" }}>
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="mt-3">
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
              {video.category}
            </p>
            <h3 className="mt-1 font-display text-base leading-snug text-[var(--color-foreground)] transition-colors group-hover:text-[var(--color-accent)]">
              {video.title}
            </h3>
            <p className="mt-1 font-mono text-xs text-[var(--color-muted-foreground)]">
              {video.channelName}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}
