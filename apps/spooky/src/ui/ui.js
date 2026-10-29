import * as THREE from 'three';
import credits from '../credits.json';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _right = new THREE.Vector3();

/**
 * DOM overlay. There are no cards or boxes: the chapter text floats in the scene, anchored to the
 * 3D object it talks about (projected every frame), so it drifts with the camera like part of the world.
 */
export class UI {
  constructor(content) {
    this.content = content;
    this.el = {
      intro: $('#intro'), introFloat: $('#intro-float'), chapter: $('#chapter'), card: $('#chapter-card'), eyebrow: $('#ch-eyebrow'), title: $('#ch-title'),
      body: $('#ch-body'), actions: $('#ch-actions'), nav: $('#nav'), navTitle: $('#nav-title'), navDots: $('#nav-dots'),
      navCount: $('#nav-count'), prev: $('#nav-prev'), next: $('#nav-next'), topbar: $('#topbar'), sound: $('#btn-sound'),
      full: $('#btn-full'), creditsBtn: $('#btn-credits'), credits: $('#credits-sheet'), toast: $('#toast'), blow: $('#blow-meter'), finale: $('#finale'),
    };
    this._pos = { chapter: null, intro: null };
    this._fillIntro();
    this._fillCredits();
    document.querySelectorAll('.sheet [data-close]').forEach((b) => b.addEventListener('click', () => this.closeSheets()));
    document.querySelectorAll('.sheet').forEach((s) => s.addEventListener('click', (e) => { if (e.target === s) this.closeSheets(); }));
    addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeSheets(); });
    this.el.creditsBtn.addEventListener('click', () => this.openSheet(this.el.credits));
    this.el.full.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
    });
  }

  _fillIntro() {
    const c = this.content;
    clearInterval(this._wordTimer);
    document.querySelector('[data-intro="title"]').textContent = c.intro.title;
    document.querySelector('[data-intro="name"]').textContent = c.name;
    document.querySelector('[data-intro="prefix"]').textContent = c.intro.prefix;
    const words = c.intro.words;
    const w = document.querySelector('.hand-word');
    w.textContent = words[0];
    let i = 0;
    this._wordTimer = setInterval(() => {
      w.classList.add('out');
      setTimeout(() => { i = (i + 1) % words.length; w.textContent = words[i]; w.classList.remove('out'); }, 350);
    }, 2200);
  }

  _fillCredits() {
    const sec = (title, items) => `<h3>${esc(title)}</h3><ul>${items.map((c) => `<li><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>${c.use ? ` <small>(${esc(c.use)})</small>` : ''} — ${esc(c.authors.join(', '))} · ${esc(c.license)}</li>`).join('')}</ul>`;
    const blender = `<h3>Made in Blender for this Halloween</h3><ul>${credits.blender.map((c) => `<li><strong>${esc(c.name)}</strong> — ${esc(c.detail)}</li>`).join('')}</ul>`;
    $('.credits-list').innerHTML =
      `<p class="lede">Everything here is original work or free to use — CC0, public domain or open licences. Thank you to these creators.</p>` +
      blender +
      (credits.models ? sec('Characters', credits.models) : '') + sec('Sounds', credits.sounds) + sec('Music', credits.music) + sec('Fonts', credits.fonts) + sec('Code', credits.code) +
      `<h3>Original work</h3><p class="lede" style="margin-top:0">${esc(credits.original)}</p>`;
  }

  showIntro(onOpen) {
    this.el.intro.hidden = false;
    const btn = $('#open-gift');
    btn.onclick = () => { btn.disabled = true; onOpen(); };
  }

  hideIntro() {
    this.el.intro.style.transition = 'opacity .8s';
    this.el.intro.style.opacity = '0';
    setTimeout(() => { this.el.intro.hidden = true; clearInterval(this._wordTimer); }, 800);
    this.el.topbar.hidden = false;
  }

  setupNav(chapters, { onPrev, onNext, onJump }) {
    this.chapters = chapters;
    this.el.navDots.innerHTML = chapters.map((c, i) => `<i data-i="${i}" title="${esc(c.navTitle)}"></i>`).join('');
    this.el.prev.onclick = onPrev;
    this.el.next.onclick = onNext;
    this.el.navDots.onclick = (e) => { const i = e.target.dataset?.i; if (i !== undefined) onJump(+i); };
    addEventListener('keydown', (e) => {
      if (this.el.nav.hidden || document.querySelector('.sheet:not([hidden])')) return;
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    });
  }

  updateNav(i) {
    const n = this.chapters.length;
    this.el.nav.hidden = false;
    this.el.navTitle.textContent = this.chapters[i].navTitle;
    this.el.navCount.textContent = `${i + 1}/${n}`;
    [...this.el.navDots.children].forEach((d, k) => { d.classList.toggle('on', k === i); d.classList.toggle('done', k < i); });
    this.el.prev.disabled = i === 0;
    this.el.next.disabled = i === n - 1;
  }

  /** Fill the floating chapter text. It stays invisible until revealCard() (when the camera arrives). */
  showCard({ eyebrow, title, body, actions = [] }, { reveal = false } = {}) {
    const { chapter } = this.el;
    chapter.hidden = false;
    chapter.classList.add('pending');
    this.el.eyebrow.innerHTML = eyebrow || '';
    this.el.title.innerHTML = title || '';
    this.setBody(body || '');
    this.setActions(actions);
    this._pos.chapter = null;
    if (reveal) this.revealCard();
  }

  revealCard() {
    const { chapter, card } = this.el;
    if (chapter.hidden) return;
    chapter.classList.remove('pending');
    card.classList.remove('reveal-in'); void card.offsetWidth; card.classList.add('reveal-in');
  }

  /** Fade the text out without clearing it (e.g. while the camera looks elsewhere). */
  holdCard() { this.el.chapter.classList.add('pending'); }

  setTitle(t) { this.el.title.innerHTML = t; }
  setBody(html) { this.el.body.innerHTML = html; }

  setActions(actions) {
    this.el.actions.innerHTML = '';
    for (const a of actions) {
      const b = document.createElement('button');
      b.className = `btn-float${a.primary ? ' primary' : ''}`;
      if (a.icon) { const s = document.createElement('span'); s.className = 'spark'; s.setAttribute('aria-hidden', 'true'); s.textContent = a.icon; b.appendChild(s); }
      b.appendChild(document.createTextNode(a.label));
      if (a.id) b.id = a.id;
      if (a.disabled) b.disabled = true;
      if (a.hold) {
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('holding'); a.hold(true); });
        const up = () => { b.classList.remove('holding'); a.hold(false); };
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      } else b.addEventListener('click', a.onClick);
      this.el.actions.appendChild(b);
    }
  }

  hideCard() { this.el.chapter.hidden = true; }

  /**
   * Position a floating block beside its 3D anchor.
   * anchor: { at: Vector3, r: metres (object radius), place: 'side'|'below'|'above'|'center', placePortrait }
   */
  _place(el, key, anchor, camera, dt) {
    if (!anchor || !anchor.at) return;
    const w = innerWidth, h = this.stageHeight(), portrait = w / h < 1.1;
    _p.copy(anchor.at).project(camera);
    if (_p.z > 1) return;
    const sx = (_p.x * 0.5 + 0.5) * w, sy = (-_p.y * 0.5 + 0.5) * h;
    _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    _q.copy(anchor.at).addScaledVector(_right, anchor.r || 0).project(camera);
    const rpx = Math.abs(_q.x - _p.x) * 0.5 * w;
    const gap = portrait ? 18 : 34, m = 16;
    if (key === 'chapter') {
      // beside the object, the column narrows to the space there (rather than covering the object)
      const want = (!portrait && (anchor.place || 'side') === 'side') ? Math.min(390, Math.max(w - m - (sx + rpx + gap), sx - rpx - gap - m)) : 0;
      const mw = want >= 190 ? `${Math.floor(want)}px` : '';
      if (el.style.maxWidth !== mw) el.style.maxWidth = mw;
    }
    const bw = el.offsetWidth, bh = el.offsetHeight;
    const top = 64, bottom = (this.el.nav.hidden ? 20 : 100);
    let place = portrait ? (anchor.placePortrait || 'below') : (anchor.place || 'side');
    let x, y;
    if (place === 'side') {
      const rightX = sx + rpx + gap, leftX = sx - rpx - gap - bw;
      if (rightX + bw <= w - m) x = rightX;          // beside it, on the right …
      else if (leftX >= m) x = leftX;                // … or on the left …
      else place = 'below';                          // … or, on a narrow screen, underneath
      y = sy - bh / 2;
    }
    if (place === 'below' || place === 'above') {
      x = sx - bw / 2;
      const below = sy + rpx + gap, above = sy - rpx - gap - bh;
      const fitsBelow = below + bh <= h - bottom, fitsAbove = above >= top;
      y = place === 'below' ? (fitsBelow || !fitsAbove ? below : above) : (fitsAbove || !fitsBelow ? above : below);
    } else if (place === 'center') { x = sx - bw / 2; y = sy - bh / 2; }
    x = Math.min(Math.max(x, m), w - bw - m);
    y = Math.min(Math.max(y, top), h - bh - bottom);
    // glide rather than jump (e.g. when it flips sides)
    const cur = this._pos[key];
    if (!cur) this._pos[key] = { x, y };
    else { const k = 1 - Math.exp(-dt * 10); cur.x += (x - cur.x) * k; cur.y += (y - cur.y) * k; }
    const P = this._pos[key];
    el.style.transform = `translate3d(${P.x.toFixed(1)}px, ${P.y.toFixed(1)}px, 0)`;
  }

  stageHeight() { return innerHeight - (parseFloat(document.documentElement.style.getPropertyValue('--tb')) || 0); }

  /** Called every frame with the current anchors. */
  place(camera, { chapter, intro } = {}, dt = 0.016) {
    if (!this.el.chapter.hidden) this._place(this.el.chapter, 'chapter', chapter, camera, dt);
    if (!this.el.intro.hidden) this._place(this.el.introFloat, 'intro', intro, camera, dt);
  }

  openSheet(el) { this.closeSheets(); el.hidden = false; el.querySelector('[data-close]')?.focus(); }
  closeSheets() {
    let closed = false;
    document.querySelectorAll('.sheet').forEach((s) => { if (!s.hidden) { s.hidden = true; closed = true; } });
    if (closed) this.onSheetClose?.();
  }

  toast(msg, ms = 2600) {
    const t = this.el.toast;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('on'), ms);
  }

  setBlowMeter(v) {
    if (v === null) { this.el.blow.hidden = true; return; }
    this.el.blow.hidden = false;
    this.el.blow.firstElementChild.style.width = `${Math.round(v * 100)}%`;
  }

  showFinale({ onAgain, onCapture }) {
    const f = this.el.finale;
    f.querySelector('.finale-title').innerHTML = `${esc(this.content.finale.title)}, <span data-k="name">${esc(this.content.name)}</span>!`;
    f.querySelector('.finale-sub').innerHTML = `<span data-k="finale.subtitle">${esc(this.content.finale.subtitle)}</span>`;
    f.hidden = false;
    f.querySelector('#watch-again').onclick = onAgain;
    f.querySelector('#capture-moment').onclick = onCapture;
    // hide every word and button so only the scene (fireworks, the name in the stars) is left
    const show = document.getElementById('ui-show');
    const hide = document.getElementById('hide-ui');
    hide.hidden = false;
    hide.onclick = () => { document.body.classList.add('ui-hidden'); show.hidden = false; };
    show.onclick = () => { document.body.classList.remove('ui-hidden'); show.hidden = true; };
  }
  hideFinale() { this.el.finale.hidden = true; document.body.classList.remove('ui-hidden'); document.getElementById('ui-show').hidden = true; document.getElementById('hide-ui').hidden = true; }

  /** Side of the square photo frame in the viewfinder, in CSS px (the camera fov is matched to it). */
  viewfinderSize() {
    const w = innerWidth, h = innerHeight;
    return Math.round(w / h >= 1.1 ? Math.min(h * 0.8, w * 0.62) : Math.min(w * 0.88, h * 0.62));
  }

  /** Show the viewfinder with its shutter button; onShoot fires once, on the press. */
  showViewfinder(onShoot) {
    const vf = document.getElementById('viewfinder');
    const size = () => vf.style.setProperty('--vf', `${this.viewfinderSize()}px`);
    size();
    this._vfResize = size;
    addEventListener('resize', size);
    vf.classList.remove('shot');
    vf.classList.add('spirit');
    vf.hidden = false;
    this.el.nav.style.visibility = 'hidden';
    this.el.topbar.style.visibility = 'hidden';
    const btn = document.getElementById('vf-shutter');
    btn.onclick = () => { btn.onclick = null; onShoot(); };
    btn.focus({ preventScroll: true });
  }
  viewfinderShot() { document.getElementById('viewfinder').classList.add('shot'); }
  hideViewfinder() {
    document.getElementById('viewfinder').hidden = true;
    removeEventListener('resize', this._vfResize);
    this.el.nav.style.visibility = '';
    this.el.topbar.style.visibility = '';
  }

  flash() {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:.9;pointer-events:none;transition:opacity .7s ease-out;z-index:30';
    document.body.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => { d.style.opacity = '0'; }));
    setTimeout(() => d.remove(), 800);
  }

  /** The flash: the screen whites out, then the greeting stays burned into your eyes as it fades. */
  flashbang(lines) {
    const d = document.createElement('div');
    d.className = 'flashbang';
    d.innerHTML = `<div class="fb-after">${lines.map((l, i) => `<p class="${i === 1 ? 'big' : ''}">${esc(l)}</p>`).join('')}</div>`;
    document.body.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('fade')));
    setTimeout(() => d.remove(), 6200);
  }

  /** A line in the corner feed: [who] icon [what] — slides in, fades after a few seconds. */
  feed(left, icon, right, { gold = false } = {}) {
    let box = document.getElementById('killfeed');
    if (!box) { box = document.createElement('div'); box.id = 'killfeed'; box.setAttribute('aria-live', 'polite'); document.getElementById('ui').appendChild(box); }
    const row = document.createElement('div');
    row.className = `kf-row${gold ? ' gold' : ''}`;
    row.innerHTML = `<span class="kf-l">${esc(left)}</span><span class="kf-i" aria-hidden="true">${esc(icon)}</span><span class="kf-r">${esc(right)}</span>`;
    box.appendChild(row);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => row.classList.add('out'), 5200);
    setTimeout(() => row.remove(), 5800);
  }

  /** A lightning flash over everything: a cold double flicker. */
  lightning() {
    const d = document.createElement('div');
    d.className = 'lightning';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 700);
  }

  /** A blood-red flash pulsing in from the edges (the scare). */
  redFlash() {
    const d = document.createElement('div');
    d.className = 'red-flash';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }

  /** The lights go out: the whole screen sinks into the dark (the words too). */
  dim(on) { document.body.classList.toggle('lights-out', on); }

  /** BOO! — huge dripping letters punch in over everything and melt away. */
  boo(text) {
    const d = document.createElement('div');
    d.className = 'boo';
    d.innerHTML = `<span>${esc(text)}</span>`;
    document.getElementById('ui').appendChild(d);
    setTimeout(() => d.classList.add('out'), 1300);
    setTimeout(() => d.remove(), 2400);
  }

  /** A big centred banner, for a few seconds. */
  banner(title, sub = '') {
    const d = document.createElement('div');
    d.className = 'hud-banner';
    d.innerHTML = `<p class="hb-title">${esc(title)}</p>${sub ? `<p class="hb-sub">${esc(sub)}</p>` : ''}`;
    document.getElementById('ui').appendChild(d);
    setTimeout(() => d.classList.add('out'), 3200);
    setTimeout(() => d.remove(), 3900);
  }
}

export { esc };
