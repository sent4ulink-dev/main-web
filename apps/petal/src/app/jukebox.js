import { parseYouTube } from "../core/youtube.js";

// The Music Isle's song from YouTube. Near the island it plays in the
// background, as loud as you are near; it plays on through the dance, and
// pauses as you walk away. The player stays out of sight (still full size, so
// YouTube plays it as usual) and only comes up while the song can't get going
// by itself: some phones want a tap on ▶ the first time, and YouTube may show
// an ad first or ask if you are still there. If YouTube can't play a song at
// all (its owner turned embedding off, or it is private), the gramophone's
// own waltz plays.

const SIZE = 200;
const SHOW_AT = 0.35; // how near the island (0..1) before it plays
const STUCK = 3000; // ms the song may stand still before the player comes up
const ENDED = 0;
const PLAYING = 1;
const BUFFERING = 3;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
};

let api = null;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  api ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      api = null;
      reject(new Error("YouTube could not load."));
    };
    document.head.append(script);
  });
  return api;
}

export function createJukebox({ host = document.body, onFail = () => {}, onPlay = () => {} } = {}) {
  const panel = el("section", "jukebox tucked");
  panel.inert = true;
  panel.setAttribute("aria-label", "Music Isle song");
  const mount = el("div", "");
  const screen = el("div", "jukebox-screen");
  screen.append(mount);
  const title = el("p", "jukebox-title");
  panel.append(el("div", "jukebox-head", "🎵 Music Isle"), screen, title, el("p", "jukebox-hint", "Press ▶ to start your song"));
  host.append(panel);

  let song = null; // { id, start }
  let player = null;
  let ready = false;
  let failed = false;
  let state = -1;
  let near = false; // near the island with the sound on: the song should play
  let dancing = false;
  let volume = 60;
  let heard = 0; // when the song was last heard getting on (ms)
  let lastTime = -1;
  let lifted = false;
  let announced = false; // its name shown, this time near

  function fail() {
    failed = true;
    near = false;
    lift(false);
    onFail("This song cannot be played here — the gramophone will play its own waltz.");
  }

  function create() {
    if (player || !song) return;
    loadApi().then((YT) => {
      if (player || !song) return;
      player = new YT.Player(mount, {
        host: "https://www.youtube-nocookie.com",
        width: SIZE,
        height: SIZE,
        videoId: song.id,
        playerVars: { playsinline: 1, rel: 0, start: song.start, controls: 1, iv_load_policy: 3, fs: 0 },
        events: {
          onReady: () => {
            ready = true;
            heard = performance.now();
            apply();
          },
          onStateChange: (event) => {
            state = event.data;
            if (state === PLAYING) {
              const data = player.getVideoData?.();
              if (data?.title) title.textContent = data.title;
            }
            if (state === ENDED) apply(); // round again at once
          },
          onError: fail,
        },
      });
    }).catch(fail);
  }

  // Play while near, else pause. On the island the song goes round and round;
  // in a dance its end ends the dance, and it starts again after.
  function apply() {
    if (!ready || failed || !player) return;
    if (near) {
      player.setVolume(volume);
      if (state === ENDED) {
        if (!dancing) {
          player.seekTo(song.start, true);
          player.playVideo();
        }
      } else if (state !== PLAYING && state !== BUFFERING) {
        player.playVideo();
      }
    } else if (state === PLAYING || state === BUFFERING) {
      player.pauseVideo();
    }
  }

  // Is the song getting on? When it should be playing but has stood still for
  // a few seconds, the player comes up so you can see why (and tap ▶).
  function watch() {
    const now = performance.now();
    const time = ready ? player.getCurrentTime?.() ?? 0 : 0;
    const moving = state === PLAYING && time !== lastTime;
    lastTime = time;
    const resting = state === ENDED && dancing; // it ended the dance
    if (!near || !ready || resting || moving || state === BUFFERING || document.visibilityState !== "visible") heard = now;
    lift(now - heard > STUCK);
    // Once it is really playing, its name shows for a moment.
    if (state === PLAYING && !title.textContent) title.textContent = player.getVideoData?.()?.title || "";
    if (moving && !announced && title.textContent) {
      announced = true;
      if (!dancing) onPlay(title.textContent);
    }
  }

  // The player comes up (at the top, over the island) or tucks away again.
  function lift(on) {
    if (on === lifted) return;
    lifted = on;
    panel.classList.toggle("tucked", !on);
    panel.inert = !on;
    document.body.classList.toggle("jukebox-on", on);
  }

  // A tap anywhere may be what the browser wants before it plays.
  const nudge = () => {
    if (near && state !== PLAYING && state !== BUFFERING) apply();
  };
  const taps = ["pointerup", "touchend", "keydown"];
  for (const type of taps) window.addEventListener(type, nudge, true);

  return {
    // The song (a YouTube link; empty: the gramophone's own waltz).
    setSong(link) {
      const next = parseYouTube(link);
      if (next?.id === song?.id && next?.start === song?.start) return;
      song = next;
      failed = false;
      announced = false;
      heard = performance.now();
      title.textContent = "";
      if (!song) {
        near = false;
        lift(false);
        player?.stopVideo();
        return;
      }
      if (player && ready) player.cueVideoById({ videoId: song.id, startSeconds: song.start });
      apply();
    },
    // closeness: 0..1 how near the island; enabled: sound is on; level: music volume 0..1.
    update({ near: closeness = 0, dancing: dance = false, enabled = true, level = 0.6 } = {}) {
      dancing = Boolean(dance);
      volume = Math.round(100 * clamp(level, 0, 1) * (dancing ? 1 : clamp(0.3 + 0.7 * closeness, 0, 1)));
      const next = Boolean(song) && !failed && enabled && (dancing || closeness > SHOW_AT);
      if (next !== near) {
        near = next;
        heard = performance.now();
        if (near) create();
        else announced = false;
      }
      apply();
      watch();
    },
    // From a tap (the Dance button): play now, while the tap still counts.
    play() {
      heard = performance.now();
      apply();
    },
    // The island's music is the song (the gramophone's waltz stays quiet).
    get active() { return Boolean(song) && !failed && near; },
    get playing() { return Boolean(song) && !failed && (state === PLAYING || state === BUFFERING); },
    dispose() {
      for (const type of taps) window.removeEventListener(type, nudge, true);
      player?.destroy?.();
      panel.remove();
      document.body.classList.remove("jukebox-on");
    },
  };
}
