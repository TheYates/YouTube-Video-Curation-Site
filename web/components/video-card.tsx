import Link from "next/link";
import type { Video } from "../lib/types";
import ThumbImage from "./thumb-image";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export default function VideoCard({ video }: { video: Video }) {
  return (
    <article className="group border-b border-(--color-border) py-8 first:pt-0">
      <Link href={`/video/${video.id}`} className="block">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_200px]">
          <div className="flex flex-col justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-widest text-(--color-accent)">
                  {video.category}
                </span>
                <span className="text-(--color-border)">·</span>
                <span
                  className="font-mono text-xs text-(--color-muted-foreground)"
                  title="Original YouTube upload date"
                >
                  Uploaded {formatDate(video.publishedAt)}
                </span>
              </div>
              <h2 className="font-display text-2xl leading-snug text-(--color-foreground) transition-colors group-hover:text-(--color-accent)">
                {video.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-(--color-muted-foreground) line-clamp-2">
                {video.summary.slice(0, 180)}…
              </p>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-(--color-muted-foreground)">{video.channelName}</span>
              <span className="font-mono text-xs text-(--color-muted-foreground)">
                {formatDuration(video.durationSeconds)}
              </span>
              <div className="flex gap-2">
                {video.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-(--color-border) px-2 py-0.5 font-mono text-xs text-(--color-muted-foreground)"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="order-first aspect-video overflow-hidden rounded-sm bg-(--color-muted) sm:order-last sm:aspect-auto">
            <ThumbImage
              src={video.thumbnailUrl}
              alt={video.title}
              className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </div>
      </Link>
    </article>
  );
}
