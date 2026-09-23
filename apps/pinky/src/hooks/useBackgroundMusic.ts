import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Covers watch?v=, youtu.be/, embed/, and shorts/ URLs. */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export function useBackgroundMusic(url: string) {
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<any>(null);
  const containerIdRef = useRef(`yt-bg-player-${Math.random().toString(36).slice(2)}`);
  const pendingPlayRef = useRef(false);
  const videoId = extractYouTubeId(url);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;

    const container = document.createElement('div');
    container.id = containerIdRef.current;
    Object.assign(container.style, {
      position: 'fixed',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      opacity: '0',
      pointerEvents: 'none',
      bottom: '0',
      right: '0'
    });
    document.body.appendChild(container);

    loadYouTubeApi().then(() => {
      if (cancelled) return;
      playerRef.current = new window.YT.Player(containerIdRef.current, {
        videoId,
        width: 1,
        height: 1,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1 },
        events: {
          onReady: () => {
            if (pendingPlayRef.current) playerRef.current?.playVideo?.();
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              playerRef.current?.seekTo(0);
              playerRef.current?.playVideo();
            }
            setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
          }
        }
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
      container.remove();
    };
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;
    const startOnInteraction = () => {
      pendingPlayRef.current = true;
      playerRef.current?.playVideo?.();
    };
    window.addEventListener('click', startOnInteraction, { once: true });
    window.addEventListener('touchstart', startOnInteraction, { once: true });
    window.addEventListener('keydown', startOnInteraction, { once: true });
    return () => {
      window.removeEventListener('click', startOnInteraction);
      window.removeEventListener('touchstart', startOnInteraction);
      window.removeEventListener('keydown', startOnInteraction);
    };
  }, [videoId]);

  const stop = useCallback(() => {
    pendingPlayRef.current = false;
    playerRef.current?.pauseVideo?.();
  }, []);

  return { isPlaying: Boolean(videoId) && isPlaying, hasVideo: Boolean(videoId), stop };
}
