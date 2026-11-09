// The editor's preview: the card itself, live, in a frame beside the form (not a picture of it). The frame is
// the size of a real phone or computer screen, so the card lays itself out exactly as they will see it,
// scaled down to fit the dock; on a small dock it zooms in on the part the step is about. It is a look, not a
// place to tap: the editor drives it (embed.js is the card's side).
const DEVICES = { phone: { w: 390, h: 844 }, computer: { w: 1280, h: 800 } };

export class LivePreview {
  constructor({ src, device = innerWidth < 900 ? 'phone' : 'computer' }) {
    this.device = device;
    this.el = document.createElement('div');
    this.el.className = 'ez-live';
    this.el.innerHTML = '<iframe title="Live preview of the card" tabindex="-1" aria-hidden="true"></iframe><div class="ez-live-wait">Starting the desktop for the preview…</div>';
    this.frame = this.el.querySelector('iframe');
    this.api = null; this.want = null; this.content = null; this._dpr = 0;
    this._size();
    this.frame.src = src;
    this._waitForCard();
  }

  /** The card in the frame is ready once it has set itself up (window.__ez). */
  _waitForCard() {
    const t0 = Date.now();
    const poll = () => {
      if (this.disposed) return;
      const api = this.frame.contentWindow?.__ez;
      if (api) {
        this.api = api; this.el.classList.add('ready');
        if (this.content) api.setContent(this.content);
        if (this.want) api.show(this.want.scene, this.want.sub);
        this._applyDpr();
        return;
      }
      if (Date.now() - t0 > 120000) { this.el.querySelector('.ez-live-wait').textContent = 'The preview couldn’t start. Your words are still saved.'; return; }
      setTimeout(poll, 150);
    };
    poll();
  }

  show(scene, sub = null) { this.want = { scene, sub }; this.api?.show(scene, sub); }
  /** The words as typed: handed over a moment after typing pauses (the card redraws what shows them). */
  update(content) {
    this.content = JSON.parse(JSON.stringify(content));
    clearTimeout(this._t);
    this._t = setTimeout(() => this.api?.setContent(this.content), 160);
  }
  flush() { clearTimeout(this._t); if (this.content) this.api?.setContent(this.content); }
  async picture() { this.flush(); return this.api ? this.api.picture() : null; }

  setDevice(d) {
    if (!DEVICES[d] || d === this.device) return;
    this.device = d;
    this._size();
    setTimeout(() => this.api?.reframe(), 60);   // (once the frame has its new size)
  }
  _size() { const D = DEVICES[this.device]; this.frame.style.width = `${D.w}px`; this.frame.style.height = `${D.h}px`; }

  /** Scale the screen into `w`×`h`; on a small dock, `crop` (% of a phone screen) is shown instead of all of it. */
  fit(w, h, { crop = null } = {}) {
    if (!w || !h) return;
    const D = DEVICES[this.device];
    const whole = Math.min(w / D.w, h / D.h);
    const r = crop && this.device === 'phone' && whole < 0.6 ? crop : { x: 0, y: 0, w: 100, h: 100 };
    const rw = (D.w * r.w) / 100, rh = (D.h * r.h) / 100, s = Math.min(w / rw, h / rh);
    this.el.style.width = `${Math.round(rw * s)}px`; this.el.style.height = `${Math.round(rh * s)}px`;
    this.frame.style.transform = `translate(${(-D.w * r.x * s) / 100}px, ${(-D.h * r.y * s) / 100}px) scale(${s})`;
    this.scale = s;
    this._applyDpr();
  }
  /** Drawn only as sharp as it is shown (a scaled-down frame needs fewer pixels: lighter on the phone). */
  _applyDpr() {
    if (!this.api || !this.scale) return;
    const v = Math.round(Math.min(2, Math.max(0.75, this.scale * (devicePixelRatio || 1))) * 4) / 4;
    if (v !== this._dpr) { this._dpr = v; this.api.dpr(v); }
  }

  dispose() { this.disposed = true; clearTimeout(this._t); this.api = null; this.frame.src = 'about:blank'; this.el.remove(); }
}
