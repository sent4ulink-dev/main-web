import { useEffect, useRef, useState, type ReactNode } from "react";
import { youtubeId } from "../shared/youtube";

export function PixelHeart() {
  return (
    <svg
      className="pixel-heart"
      viewBox="0 0 16 15"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path
        fill="#a52d48"
        d="M2 1h4v1h4V1h4v1h1v2h1v5h-2v2h-2v2h-2v1H6v-1H4v-2H2V9H0V4h1V2h1Z"
      />
      <path
        fill="#e4516e"
        d="M2 3h4v1h4V3h4v2h1v3h-2v2h-2v2H9v1H7v-1H5v-2H3V8H1V5h1Z"
      />
      <path fill="#f68196" d="M3 3h3v2h4V3h3v3h1v2h-2v2h-2v2H7v-2H5V8H3Z" />
      <path fill="#ffb0bf" d="M3 3h3v2H4v2H3ZM11 3h2v2h-2Z" />
    </svg>
  );
}

export function MusicPlayer({
  title,
  muted,
  onMute,
  editing,
  youtubeUrl,
  onUrlChange,
  onSave,
  busy,
  running,
  playRequest,
}: {
  title: ReactNode;
  muted: boolean;
  onMute: () => void;
  editing: boolean;
  youtubeUrl: string;
  onUrlChange: (value: string) => void;
  onSave: () => void;
  busy: boolean;
  running: boolean;
  playRequest: number;
}) {
  const [playing, setPlaying] = useState(false),
    [progress, setProgress] = useState(0),
    [replay, setReplay] = useState(0);
  const youtubeFrame = useRef<HTMLIFrameElement>(null);
  const video = youtubeId(youtubeUrl);
  const sendYouTube = (command: string, args: unknown[] = []) => {
    youtubeFrame.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: command, args }),
      "https://www.youtube-nocookie.com",
    );
  };
  useEffect(() => {
    if (playRequest) setPlaying(true);
  }, [playRequest]);
  useEffect(() => {
    if (!running) setPlaying(false);
  }, [running]);
  useEffect(() => {
    if (!video) return;
    sendYouTube(playing && running ? "playVideo" : "pauseVideo");
    sendYouTube(muted ? "mute" : "unMute");
  }, [playing, running, muted, video]);
  useEffect(() => {
    if (!playing || muted || video || !running) return;
    let audio: AudioContext | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      audio = new AudioContext();
      void audio.resume().catch(() => {});
      let beat = 0;
      const melody = [
        523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 783.99, 659.25,
        523.25, 587.33, 392,
      ];
      const play = () => {
        if (!audio) return;
        const oscillator = audio.createOscillator(),
          gain = audio.createGain(),
          at = audio.currentTime;
        oscillator.type = "sine";
        oscillator.frequency.value = melody[beat % melody.length];
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.035, at + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.65);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.7);
        setProgress((((beat % melody.length) + 1) / melody.length) * 100);
        beat++;
      };
      play();
      timer = setInterval(play, 450);
    } catch {
      setPlaying(false);
    }
    return () => {
      if (timer) clearInterval(timer);
      if (audio) void audio.close().catch(() => {});
    };
  }, [playing, muted, replay, video, running]);
  return (
    <div className="wmp-shell">
      {editing && (
        <div className="music-editor">
          <label className="field">
            YouTube song link
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={youtubeUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              maxLength={500}
            />
          </label>
          <small>
            Leave empty to use the built-in melody. Some videos do not allow
            embedding.
          </small>
          <button
            className="primary"
            disabled={busy || (!!youtubeUrl && !video)}
            onClick={onSave}
          >
            Save &amp; Play
          </button>
        </div>
      )}
      <div className="wmp-main">
        <aside className="wmp-sidebar" aria-label="Media views">
          <strong>Now Playing</strong>
          <span>Media Guide</span>
          <span>Media Library</span>
          <span>Radio Tuner</span>
          <span>Copy to CD</span>
          <span>Skin Chooser</span>
          <span className="wmp-mark">▶</span>
        </aside>
        <div className="wmp-content">
          <div className="track-heading">
            <small>NOW PLAYING</small>
            <div>{title}</div>
          </div>
          {video && !editing && running ? (
            <div className="youtube-player">
              <iframe
                ref={youtubeFrame}
                key={`${video}-${playRequest}`}
                title="YouTube song player"
                aria-hidden="true"
                tabIndex={-1}
                src={`https://www.youtube-nocookie.com/embed/${video}?enablejsapi=1&autoplay=${playRequest ? 1 : 0}&playsinline=1`}
                allow="autoplay; encrypted-media"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => {
                  if (playing && running) sendYouTube("playVideo");
                  if (muted) sendYouTube("mute");
                }}
              />
              <span className="youtube-audio-label">YouTube audio</span>
              <a
                href={`https://www.youtube.com/watch?v=${video}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in YouTube ↗
              </a>
            </div>
          ) : null}
          <Visualizer
            playing={running && (playing || !!video)}
            compact={false}
          />
          <div className="wmp-status">
            {video
              ? "YouTube audio · use the controls below"
              : playing
                ? "Playing · Our little melody"
                : "Ready · Our little melody"}
            <span>Alchemy: Ribbon</span>
          </div>
        </div>
      </div>
      <>
        <div className="player-seek" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="player-controls">
          <button
            className="player-play"
            aria-label={playing ? "Pause soundtrack" : "Play soundtrack"}
            onClick={() => {
              setPlaying((current) => !current);
            }}
          >
            {playing ? "Ⅱ" : "▶"}
          </button>
          <button
            aria-label="Stop soundtrack"
            onClick={() => {
              setPlaying(false);
              setProgress(0);
              if (video) sendYouTube("stopVideo");
            }}
          >
            ■
          </button>
          <button
            aria-label="Restart soundtrack"
            onClick={() => {
              setProgress(0);
              setReplay((r) => r + 1);
              setPlaying(true);
              if (video) sendYouTube("seekTo", [0, true]);
            }}
          >
            ↤
          </button>
          <span>{muted ? "Muted" : playing ? "Playing" : "Ready"}</span>
          <button
            aria-label={muted ? "Unmute soundtrack" : "Mute soundtrack"}
            onClick={onMute}
          >
            {muted ? "♪̸" : "♫"}
          </button>
          <div className="volume-bars" aria-hidden="true">
            ▁▂▃▅▆
          </div>
        </div>
      </>
    </div>
  );
}

function Visualizer({
  playing,
  compact,
}: {
  playing: boolean;
  compact: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current,
      ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    let frame = 0;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (time: number) => {
      const t = playing && !reduce ? time / 2800 : 1;
      const w = element.width,
        h = element.height;
      ctx.fillStyle = "#080613";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.globalCompositeOperation = "screen";
      for (let band = 0; band < 36; band++) {
        ctx.beginPath();
        for (let i = 0; i <= 180; i++) {
          const a = (i / 180) * Math.PI * 2;
          const r =
            26 +
            band * 2.9 +
            Math.sin(a * 3 + t * 2 + band / 11) * (12 + band / 2);
          const x = Math.cos(a + t * 0.28) * r * 1.55;
          const y = Math.sin(a + t * 0.28) * r * 0.85;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = `hsla(${(band * 4 + t * 20 + 270) % 360}, 90%, 60%, .45)`;
        ctx.lineWidth = 2.8;
        ctx.stroke();
      }
      ctx.restore();
      if (playing && !reduce) frame = requestAnimationFrame(draw);
    };
    draw(0);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  return (
    <div className={`visualizer ${compact ? "compact" : ""}`}>
      <canvas
        ref={canvas}
        width={640}
        height={320}
        aria-label="Animated ribbon music visualization"
      />
      <span>Alchemy · Ribbon</span>
    </div>
  );
}
