// The walkman's YouTube song, heard as background music only (the player itself is kept out of sight).
// It is made as soon as the song chapter opens, so the tap on "play" can start it straight away
// (phones only allow that inside a tap).
import { parseYouTube } from '../core/youtube.js';

let api = null;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  api ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => { api = null; reject(new Error('YouTube could not load.')); };
    document.head.append(script);
  });
  return api;
}

export class TubePlayer {
  constructor({ onEnd = () => {}, onFail = () => {} } = {}) {
    Object.assign(this, { onEnd, onFail });
    this.el = document.createElement('div');
    this.el.id = 'tube';
    this.el.hidden = true;
    document.getElementById('ui').append(this.el);
    this.player = null; this.song = null; this.ready = false; this.wantPlay = false; this.muted = false;
  }

  /** Get the player ready for this link ('' removes it). */
  prepare(link) {
    const song = parseYouTube(link);
    if (song?.id === this.song?.id && song?.start === this.song?.start) return;
    this.destroy();
    this.song = song;
    if (!song) return;
    const mount = document.createElement('div');
    this.el.replaceChildren(mount);
    loadApi().then((YT) => {
      if (this.song !== song) return;
      this.player = new YT.Player(mount, {
        host: 'https://www.youtube-nocookie.com',
        width: 256, height: 144, videoId: song.id,
        playerVars: { playsinline: 1, rel: 0, start: song.start, controls: 1, iv_load_policy: 3, fs: 0, modestbranding: 1 },
        events: {
          onReady: () => { this.ready = true; this.player.setVolume(100); if (this.muted) this.player.mute(); if (this.wantPlay) this.player.playVideo(); },
          onStateChange: (e) => { if (e.data === 0) { this.wantPlay = false; this.onEnd(); } },
          onError: () => { this.wantPlay = false; this.onFail(); },
        },
      });
    }).catch(() => this.onFail());
  }

  get available() { return !!this.song; }
  show(on) { this.el.hidden = !on || !this.song; }
  play() {
    if (!this.song) return false;
    this.wantPlay = true; this.show(true);
    if (this.ready) { this.player.setVolume(100); this.player.playVideo(); }
    return true;
  }
  stop() { this.wantPlay = false; if (this.ready) this.player.pauseVideo(); }
  setMuted(m) { this.muted = m; if (this.ready) (m ? this.player.mute() : this.player.unMute()); }
  destroy() {
    this.wantPlay = false; this.ready = false;
    try { this.player?.destroy(); } catch { /* already gone */ }
    this.player = null; this.song = null;
    this.el.replaceChildren(); this.el.hidden = true;
  }
}
