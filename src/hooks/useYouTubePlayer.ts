import { useEffect, useRef, useState, useCallback } from "react"

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          videoId: string
          playerVars?: Record<string, unknown>
          events?: {
            onReady?: (event: { target: YTPlayer }) => void
            onStateChange?: (event: { data: number }) => void
          }
        }
      ) => YTPlayer
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YTPlayer {
  getCurrentTime(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  destroy(): void
  getPlayerState(): number
}

let apiLoaded = false
let apiCallbacks: (() => void)[] = []

function loadYouTubeAPI(onReady: () => void) {
  if (apiLoaded) {
    onReady()
    return
  }
  apiCallbacks.push(onReady)
  if (document.getElementById("yt-api-script")) return
  const script = document.createElement("script")
  script.id = "yt-api-script"
  script.src = "https://www.youtube.com/iframe_api"
  document.head.appendChild(script)
  window.onYouTubeIframeAPIReady = () => {
    apiLoaded = true
    apiCallbacks.forEach((cb) => cb())
    apiCallbacks = []
  }
}

export function useYouTubePlayer(youtubeId: string, containerId: string) {
  const playerRef = useRef<YTPlayer | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [isActive, setIsActive] = useState(false) // playing or paused (not ended/unstarted)

  const startPolling = useCallback(() => {
    if (intervalRef.current) return
    intervalRef.current = setInterval(() => {
      if (playerRef.current) {
        setCurrentTime(playerRef.current.getCurrentTime())
      }
    }, 250)
  }, [])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const seekTo = useCallback((seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true)
      setCurrentTime(seconds)
    }
  }, [])

  const playAt = useCallback((seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true)
      playerRef.current.playVideo()
      setCurrentTime(seconds)
      setIsActive(true)
    }
  }, [])

  useEffect(() => {
    let destroyed = false

    loadYouTubeAPI(() => {
      if (destroyed) return
      playerRef.current = new window.YT.Player(containerId, {
        videoId: youtubeId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            if (!destroyed) setIsReady(true)
          },
          onStateChange: (event) => {
            if (destroyed) return
            const { PLAYING, PAUSED } = window.YT.PlayerState
            if (event.data === PLAYING) {
              setIsActive(true)
              startPolling()
            } else if (event.data === PAUSED) {
              setIsActive(true)
              stopPolling()
              if (playerRef.current) setCurrentTime(playerRef.current.getCurrentTime())
            } else {
              stopPolling()
              if (playerRef.current) setCurrentTime(playerRef.current.getCurrentTime())
            }
          },
        },
      })
    })

    return () => {
      destroyed = true
      stopPolling()
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [youtubeId, containerId, startPolling, stopPolling])

  return { currentTime, seekTo, playAt, isReady, isActive }
}
