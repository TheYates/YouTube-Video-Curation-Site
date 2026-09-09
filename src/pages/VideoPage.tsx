import { useState, useEffect, useId, useRef } from "react"
import { useParams, useSearchParams, Link, Navigate } from "react-router-dom"
import { useVideo, useRelatedVideos, logPageView } from "../hooks/useVideos"
import { useYouTubePlayer } from "../hooks/useYouTubePlayer"
import TranscriptPane from "../components/TranscriptPane"
import ChapterList from "../components/ChapterList"
import SummaryPanel from "../components/SummaryPanel"
import ShareBar from "../components/ShareBar"
import EmailCapture from "../components/EmailCapture"
import { NEWSLETTER_ENABLED } from "../lib/env"
import AdSlot from "../components/AdSlot"
import RelatedVideos from "../components/RelatedVideos"
import type { Video } from "../data/types"

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function VideoDetail({ video, tParam }: { video: Video; tParam: number }) {
  const playerId = useId().replace(/:/g, "")
  const playerContainerId = `yt-player-${playerId}`

  const [playerOpen, setPlayerOpen] = useState(false)
  const pendingSeekRef = useRef<number | null>(null)

  const { currentTime, seekTo, playAt, isReady, isActive } = useYouTubePlayer(
    video.youtubeId,
    playerContainerId
  )

  // Real view tracking: one beacon per video per browser session.
  useEffect(() => {
    logPageView(video.id)
  }, [video.id])

  useEffect(() => {
    if (isReady && pendingSeekRef.current !== null) {
      playAt(pendingSeekRef.current)
      pendingSeekRef.current = null
    }
  }, [isReady, playAt])

  useEffect(() => {
    if (tParam > 0) {
      pendingSeekRef.current = tParam
      setPlayerOpen(true)
    }
  }, [tParam])

  function handleWordClick(seconds: number) {
    if (!playerOpen) {
      pendingSeekRef.current = seconds
      setPlayerOpen(true)
    } else if (isReady) {
      playAt(seconds)
    }
  }

  function handleChapterSeek(seconds: number) {
    if (!playerOpen) {
      pendingSeekRef.current = seconds
      setPlayerOpen(true)
    } else if (isReady) {
      seekTo(seconds)
    }
  }

  const isSticky = playerOpen && isActive
  const { data: related = [] } = useRelatedVideos(video)

  return (
    <main className="page-enter mx-auto max-w-5xl px-6 py-10">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        All Videos
      </Link>

      {/* Thumbnail — shown when player is closed */}
      {!playerOpen && (
        <div className="relative mb-10 overflow-hidden rounded-sm bg-[var(--color-muted)]" style={{ aspectRatio: "16/9" }}>
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            onError={(e) => {
              const img = e.currentTarget
              if (img.dataset.fbk) return
              img.dataset.fbk = "1"
              img.src = img.src.replace(/maxresdefault|sddefault/, "hqdefault")
            }}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20" />
          <p className="absolute bottom-4 left-4 font-mono text-xs uppercase tracking-widest text-white/70">
            Click any word or chapter to start playback
          </p>
        </div>
      )}

      {/* YouTube player — smooth open/close; sticky only while active */}
      <div
        className={[
          "-mx-6 px-6",
          isSticky
            ? "sticky top-[65px] z-40 mb-10 bg-[var(--color-background)] pb-4 pt-2 shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
            : "mb-10",
        ].join(" ")}
        style={{
          maxHeight: playerOpen ? "480px" : "0px",
          opacity: playerOpen ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.35s ease, opacity 0.25s ease",
        }}
      >
        <div
          className="relative overflow-hidden rounded-sm bg-black"
          style={{ aspectRatio: "16/9", maxHeight: "420px" }}
        >
          <div id={playerContainerId} className="h-full w-full" />
          <button
            onClick={() => setPlayerOpen(false)}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-sm bg-black/70 text-white/80 transition-colors hover:bg-black hover:text-white"
            title="Close player"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Article header */}
      <div className="mb-10 border-b border-[var(--color-border)] pb-10">
        <div className="mb-3 flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">{video.category}</span>
          <span className="text-[var(--color-border)]">·</span>
          <span className="font-mono text-xs text-[var(--color-muted-foreground)]">{formatDate(video.publishedAt)}</span>
          <span className="text-[var(--color-border)]">·</span>
          <span className="font-mono text-xs text-[var(--color-muted-foreground)]">{video.channelName}</span>
        </div>
        <h1 className="font-display text-4xl leading-tight text-[var(--color-foreground)] sm:text-5xl">{video.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {video.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--color-border)] px-3 py-1 font-mono text-xs text-[var(--color-muted-foreground)]"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-6">
          <ShareBar title={video.title} />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_260px]">
        {/* Chapters — first in DOM on mobile */}
        <aside className="order-first lg:order-last">
          <div className="lg:sticky lg:top-24 space-y-8">
            <div>
              <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">Chapters</h3>
              <ChapterList chapters={video.chapters} currentTime={currentTime} onSeek={handleChapterSeek} />
            </div>
            <AdSlot size="rectangle" />
          </div>
        </aside>

        <div className="order-last space-y-12 lg:order-first">
          <SummaryPanel summary={video.summary} takeaways={video.takeaways} affiliateLinks={video.affiliateLinks} />

          {NEWSLETTER_ENABLED && <EmailCapture variant="inline" />}

          <div>
            <h3 className="mb-6 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
              Full Transcript
              <span className="ml-3 text-[var(--color-muted-foreground)] normal-case tracking-normal">
                — click any word to play
              </span>
            </h3>
            <div className="relative pl-0 sm:pl-10">
              <TranscriptPane
                transcript={video.transcript}
                chapters={video.chapters}
                currentTime={currentTime}
                isActive={isActive}
                onWordClick={handleWordClick}
              />
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-16 border-t border-[var(--color-border)] pt-10">
          <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
            More to Read
          </h2>
          <RelatedVideos videos={related} />
        </div>
      )}
    </main>
  )
}

export default function VideoPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const tParam = Number(searchParams.get("t") ?? 0)
  const { data: video, isPending, isError } = useVideo(id ?? "")

  if (isPending) {
    return (
      <main className="page-enter mx-auto max-w-5xl px-6 py-16">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-40 rounded bg-[var(--color-muted)]" />
          <div className="aspect-video w-full rounded-sm bg-[var(--color-muted)]" />
          <div className="h-10 w-2/3 rounded bg-[var(--color-muted)]" />
          <div className="h-4 w-1/2 rounded bg-[var(--color-muted)]" />
        </div>
      </main>
    )
  }

  if (isError || !video) return <Navigate to="/" replace />
  return <VideoDetail video={video} tParam={tParam} />
}
