// The card's YouTube songs, heard only (the players stay out of sight). There can be two: the song in the
// background (volume 40) and the instrument's (volume 100); the story makes sure only one plays at a time.
// A player is made as soon as its link is known, so a tap can start it straight away (phones only allow that in a tap).
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

// A song that one address refuses sometimes plays from the other.
const HOSTS = ['https://www.youtube-nocookie.com', 'https://www.youtube.com'];

export class TubePlayer {
  constructor({ onEnd = () => {}, onFail = () => {}, volume = 100, loop = false } = {}) {
    Object.assign(this, { onEnd, onFail, volume, loop });
    this.el = document.createElement('div');
    this.el.className = 'tube-box';
    // never display:none, and at YouTube's smallest allowed size: browsers don't run a hidden or tiny player properly
    this.el.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;overflow:hidden;opacity:.01;pointer-events:none;z-index:-1';
    document.body.append(this.el);
    this.player = null; this.song = null; this.ready = false; this.wantPlay = false; this.muted = false; this.host = 0;
    // a tap made before the player was ready can't start it on a phone: the next tap does
    document.addEventListener('pointerup', () => { if (this.wantPlay && this.ready && ![1, 3].includes(this.player?.getPlayerState?.())) this.player.playVideo(); }, { passive: true });
  }

  /** Get the player ready for this link ('' removes it). */
  prepare(link) {
    const song = parseYouTube(link);
    if (song?.id === this.song?.id && song?.start === this.song?.start) return;
    this.destroy();
    this.song = song;
    this.host = 0;
    if (song) this._mount(song);
  }

  _mount(song) {
    const q = new URLSearchParams({ enablejsapi: 1, playsinline: 1, rel: 0, controls: 0, iv_load_policy: 3, fs: 0, start: song.start, origin: location.origin, widget_referrer: location.origin + location.pathname });
    const frame = document.createElement('iframe');
    frame.width = frame.height = 200;
    frame.title = 'Song';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    // YouTube refuses players that don't say which site they are on (some in-app browsers send nothing by default)
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.src = `${HOSTS[this.host]}/embed/${song.id}?${q}`;
    this.el.replaceChildren(frame);
    loadApi().then((YT) => {
      if (this.song !== song) return;
      this.player = new YT.Player(frame, {
        events: {
          onReady: () => { this.ready = true; this.player.setVolume(this.volume); if (this.muted) this.player.mute(); if (this.wantPlay) this.player.playVideo(); },
          onStateChange: (e) => {
            if (e.data !== 0) return;
            if (this.loop && this.wantPlay) { this.player.seekTo(song.start, true); this.player.playVideo(); return; }
            this.wantPlay = false; this.onEnd();
          },
          onError: (e) => this._failed(song, e.data),
        },
      });
    }).catch(() => this._failed(song, 0));
  }

  _failed(song, code) {
    if (this.song !== song) return;
    try { this.player?.destroy(); } catch { /* already gone */ }
    this.player = null; this.ready = false;
    if (code && this.host < HOSTS.length - 1) { this.host += 1; this._mount(song); return; }
    this.wantPlay = false;
    this.onFail(code);
  }

  get available() { return !!this.song; }
  get wanted() { return this.wantPlay; }
  // (kept for the story's chapters: the player is never shown)
  show() {}
  play() {
    if (!this.song) return false;
    this.wantPlay = true;
    if (this.ready) { this.player.setVolume(this.volume); this.player.playVideo(); }
    return true;
  }
  stop() { this.wantPlay = false; if (this.ready) this.player.pauseVideo(); }
  setMuted(m) { this.muted = m; if (this.ready) (m ? this.player.mute() : this.player.unMute()); }
  destroy() {
    this.wantPlay = false; this.ready = false;
    try { this.player?.destroy(); } catch { /* already gone */ }
    this.player = null; this.song = null;
    this.el.replaceChildren();
  }
}
