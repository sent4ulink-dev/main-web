import * as THREE from 'three';
import credits from '../credits.json';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _right = new THREE.Vector3();

/**
 * DOM overlay. There are no cards or boxes: the chapter text floats in the scene, anchored to the
 * 3D thing it talks about (projected every frame), so it drifts with the camera like part of the world.
 */
export class UI {
  constructor(content) {
    this.content = content;
    this.el = {
      intro: $('#intro'), introFloat: $('#intro-float'), chapter: $('#chapter'), card: $('#chapter-card'), eyebrow: $('#ch-eyebrow'), title: $('#ch-title'),
      body: $('#ch-body'), actions: $('#ch-actions'), logo: $('#scene-logo'), nav: $('#nav'), navTitle: $('#nav-title'), navDots: $('#nav-dots'),
      navCount: $('#nav-count'), prev: $('#nav-prev'), next: $('#nav-next'), topbar: $('#topbar'), sound: $('#btn-sound'),
      full: $('#btn-full'), creditsBtn: $('#btn-credits'), credits: $('#credits-sheet'), toast: $('#toast'), finale: $('#finale'), bubble: $('#bubble'),
    };
    this._pos = { chapter: null, intro: null, bubble: null };
    this._fillCredits();
    document.querySelectorAll('.sheet [data-close]').forEach((b) => b.addEventListener('click', () => this.closeSheets()));
    document.querySelectorAll('#credits-sheet').forEach((s) => s.addEventListener('click', (e) => { if (e.target === s) this.closeSheets(); }));
    addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeSheets(); });
    this.el.creditsBtn.addEventListener('click', () => this.openSheet(this.el.credits));
    this.el.full.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
    });
    const dlg = $('#share-link-dialog');
    dlg.querySelector('[data-close-link]').onclick = () => dlg.close();
    dlg.querySelector('[data-copy-link]').onclick = async () => {
      const status = dlg.querySelector('.link-status');
      try { await navigator.clipboard.writeText(dlg.querySelector('#share-url').textContent); status.textContent = 'Copied ✓'; }
      catch { status.textContent = 'Couldn’t copy — select the link above and copy it.'; }
    };
    const shareBtn = dlg.querySelector('[data-share-link]');
    if (navigator.share) { shareBtn.hidden = false; shareBtn.onclick = () => navigator.share({ title: `Thanksgiving with ${this.content.family}`, url: dlg.querySelector('#share-url').textContent }).catch(() => {}); }
  }

  /** The words on the porch: "You are invited — Thanksgiving with The Millers". */
  fillIntro({ who = null } = {}) {
    const c = this.content;
    clearInterval(this._wordTimer);
    $('[data-intro="eyebrow"]').textContent = c.intro.eyebrow;
    $('[data-intro="title"]').textContent = c.intro.title;
    $('[data-intro="family"]').textContent = c.family;
    const w = $('.hand-word'), words = c.intro.words;
    w.textContent = words[0];
    let i = 0;
    this._wordTimer = setInterval(() => {
      w.classList.add('out');
      setTimeout(() => { i = (i + 1) % words.length; w.textContent = words[i]; w.classList.remove('out'); }, 350);
    }, 2200);
    const whoEl = $('[data-intro="who"]');
    whoEl.hidden = !who; whoEl.textContent = who || '';
  }

  _fillCredits() {
    const sec = (title, items) => (items?.length ? `<h3>${esc(title)}</h3><ul>${items.map((c) => `<li>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)}${c.use ? ` <small>(${esc(c.use)})</small>` : ''} — ${esc(c.authors.join(', '))} · ${esc(c.license)}</li>`).join('')}</ul>` : '');
    const blender = `<h3>Made in Blender for this card</h3><ul>${credits.blender.map((c) => `<li><strong>${esc(c.name)}</strong> — ${esc(c.detail)}</li>`).join('')}</ul>`;
    $('.credits-list').innerHTML = `<p class="lede">Everything here is original or free to use (CC0, public domain or open licenses). Thank you to these makers.</p>${blender}${sec('Sounds', credits.sounds)}${sec('Music', credits.music)}${sec('Fonts', credits.fonts)}${sec('Code', credits.code)}<h3>Original work</h3><p class="lede" style="margin-top:0">${esc(credits.original)}</p>`;
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
      if (this.el.nav.hidden || document.querySelector('.sheet:not([hidden])') || /input|textarea/i.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable) return;
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
    this.el.body.innerHTML = body || '';
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
  holdCard() { this.el.chapter.classList.add('pending'); }
  /** New words in the chapter text as it stands (shown or still waiting), without playing its entrance again. */
  updateCard({ eyebrow, title, body, actions = [] }) {
    this.el.eyebrow.innerHTML = eyebrow || '';
    this.el.title.innerHTML = title || '';
    this.el.body.innerHTML = body || '';
    this.setActions(actions);
  }
  setTitle(t) { this.el.title.innerHTML = t; }
  setBody(html) { this.el.body.innerHTML = html; }
  setActions(actions) {
    this.el.actions.innerHTML = '';
    for (const a of actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn-float${a.primary ? ' primary' : ''}`;
      if (a.icon) { const s = document.createElement('span'); s.className = 'spark'; s.setAttribute('aria-hidden', 'true'); s.textContent = a.icon; b.appendChild(s); }
      b.appendChild(document.createTextNode(a.label));
      if (a.id) b.id = a.id;
      if (a.disabled) b.disabled = true;
      if (a.hold) {
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('holding'); a.hold(true); });
        const up = () => { b.classList.remove('holding'); a.hold(false); };
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
        b.addEventListener('contextmenu', (e) => e.preventDefault());
      } else b.addEventListener('click', a.onClick);
      this.el.actions.appendChild(b);
    }
  }
  hideCard() { this.el.chapter.hidden = true; }

  /**
   * Position a floating block beside its 3D anchor.
   * anchor: { at: Vector3, r: metres (object radius), place: 'side'|'below'|'above'|'center', placePortrait,
   *           stay: never flip to the other side (the anchor is the subject's edge; the other side would cover it) }
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
      const pl = anchor.place || 'side';
      const want = portrait ? 0 : pl === 'side' ? Math.min(400, Math.max(w - m - (sx + rpx + gap), sx - rpx - gap - m)) : pl === 'left' ? Math.min(400, w * 0.34) : 0;
      const mw = want >= 200 ? `${Math.floor(want)}px` : '';
      if (el.style.maxWidth !== mw) el.style.maxWidth = mw;
    }
    // (the welcome words keep under the brand mark; chapter text may climb past it, and the mark steps aside)
    const top = key === 'intro' && this._logoRect?.height ? Math.max(this._top ?? 64, this._logoRect.bottom + 6) : this._top ?? 64, bottom = (this.el.nav.hidden ? 20 : 96) + (document.body.classList.contains('dressing') ? 150 : 0);
    let place = portrait ? (anchor.placePortrait || 'below') : (anchor.place || 'side');
    if (key === 'chapter') {
      // phones, text kept to one side of its subject: the text gets the room between the subject and the
      // screen edge (the nav below, the top buttons above) and scrolls inside it, rather than covering the subject
      const body = this.el.body;
      let mh = '';
      if (portrait && anchor.stay && (place === 'below' || place === 'above')) {
        const room = place === 'below' ? h - bottom - (sy + rpx + gap) : sy - rpx - gap - top, chrome = el.offsetHeight - body.offsetHeight;
        mh = `${Math.max(150, Math.floor(room - chrome))}px`;
      }
      if (body.style.maxHeight !== mh) body.style.maxHeight = mh;
      const more = body.scrollHeight - body.scrollTop - body.clientHeight > 4;   // fade the bottom edge while there's more to scroll
      if (body.classList.contains('more') !== more) body.classList.toggle('more', more);
    }
    const bw = el.offsetWidth, bh = el.offsetHeight;
    let x, y;
    if (place === 'left') {   // the text down the left of the screen, beside the subject (which sits right of centre)
      x = Math.max(m + 12, w * 0.04); y = sy - bh / 2;
    }
    if (place === 'side') {
      const rightX = sx + rpx + gap, leftX = sx - rpx - gap - bw;
      if (rightX + bw <= w - m) x = rightX;
      else if (leftX >= m) x = leftX;
      else place = 'below';
      y = sy - bh / 2;
    }
    if (place === 'below' || place === 'above') {
      x = sx - bw / 2;
      const below = sy + rpx + gap, above = sy - rpx - gap - bh;
      const fitsBelow = below + bh <= h - bottom, fitsAbove = above >= top;
      y = place === 'below' ? (fitsBelow || !fitsAbove || anchor.stay ? below : above) : (fitsAbove || !fitsBelow || anchor.stay ? above : below);
    } else if (place === 'center') { x = sx - bw / 2; y = sy - bh / 2; }
    x = Math.min(Math.max(x, m), w - bw - m);
    y = Math.min(Math.max(y, top), h - bh - bottom);
    const cur = this._pos[key];
    if (!cur) this._pos[key] = { x, y };
    else { const k = 1 - Math.exp(-dt * 10); cur.x += (x - cur.x) * k; cur.y += (y - cur.y) * k; }
    const P = this._pos[key];
    el.style.transform = `translate3d(${P.x.toFixed(1)}px, ${P.y.toFixed(1)}px, 0)`;
    if (key === 'chapter') {   // text climbing up to the brand mark: the mark steps aside
      const lr = this._logoRect, high = !!lr && P.y < lr.bottom + 4 && P.x < lr.right && P.x + bw > lr.left;
      if (document.body.classList.contains('card-high') !== high) document.body.classList.toggle('card-high', high);
    }
  }

  stageHeight() { return innerHeight - (parseFloat(document.documentElement.style.getPropertyValue('--tb')) || 0); }

  /** Called every frame with the current anchors. */
  place(camera, { chapter, intro, bubble } = {}, dt = 0.016) {
    // the highest floating text may go: under the top buttons, and under the owner's bar when it's showing
    const bar = document.querySelector('.owner-bar:not([hidden]) .owner-btn:not([hidden])')?.parentElement;
    this._top = bar ? Math.max(64, bar.getBoundingClientRect().bottom + 10) : 64;
    this._logoRect = this.el.logo && !this.el.logo.hidden ? this.el.logo.getBoundingClientRect() : null;
    if (!this.el.chapter.hidden) this._place(this.el.chapter, 'chapter', chapter, camera, dt);
    if (!this.el.intro.hidden) this._place(this.el.introFloat, 'intro', intro, camera, dt);
    const b = this.el.bubble;
    if (!b.hidden && bubble) {
      _p.copy(bubble).project(camera);
      const w = innerWidth, h = this.stageHeight();
      const sx = (_p.x * 0.5 + 0.5) * w, sy = (-_p.y * 0.5 + 0.5) * h;
      const x = Math.min(Math.max(sx - b.offsetWidth / 2, 12), w - b.offsetWidth - 12), y = Math.max(12, sy - b.offsetHeight - 14);
      b.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  }

  /** A speech bubble over someone at the table. */
  bubble({ name, text, meta = '' }) {
    const b = this.el.bubble;
    b.innerHTML = `<span class="b-name">${esc(name)}</span><span class="b-text">${esc(text)}</span>${meta ? `<span class="b-meta">${esc(meta)}</span>` : ''}`;
    b.hidden = false; b.classList.remove('out');
  }
  hideBubble() { const b = this.el.bubble; b.classList.add('out'); clearTimeout(this._bT); this._bT = setTimeout(() => { if (b.classList.contains('out')) b.hidden = true; }, 300); }

  openSheet(el) { this.closeSheets(); el.hidden = false; el.querySelector('[data-close]')?.focus(); }
  closeSheets() {
    let closed = false;
    document.querySelectorAll('#credits-sheet').forEach((s) => { if (!s.hidden) { s.hidden = true; closed = true; } });
    if (closed) this.onSheetClose?.();
  }

  /** A small line along the bottom while you do something in the scene (e.g. "tap someone"), with one button. */
  hint(text, action = null) {
    let el = document.getElementById('scene-hint');
    if (!text) { if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement('div'); el.id = 'scene-hint'; el.setAttribute('role', 'status'); document.getElementById('ui').appendChild(el); }
    el.innerHTML = `<span>${esc(text)}</span>${action ? `<button type="button" class="btn-float small">${esc(action.label)}</button>` : ''}`;
    if (action) el.querySelector('button').onclick = action.onClick;
    el.hidden = false;
  }

  /** A photo, big, over everything (tap anywhere to close). */
  lightbox(url) {
    const d = document.createElement('div');
    d.className = 'lightbox';
    d.innerHTML = `<img alt="A family photo" src="${esc(url)}"><button type="button" class="icon-btn" aria-label="Close">✕</button>`;
    const close = () => { d.classList.add('out'); setTimeout(() => d.remove(), 250); };
    d.addEventListener('click', close);
    document.body.appendChild(d);
  }

  toast(msg, ms = 2600) {
    const t = this.el.toast;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('on'), ms);
  }

  /** A link to copy or share (the studio's new card, the host's guest link). */
  showLink(url, { title = 'Your link', note = '' } = {}) {
    const dlg = $('#share-link-dialog');
    dlg.querySelector('#share-link-title').textContent = title;
    if (note) dlg.querySelector('.link-note').textContent = note;
    dlg.querySelector('#share-url').textContent = url;
    dlg.querySelector('.link-status').textContent = '';
    dlg.showModal();
  }

  fillFinale() {
    const f = this.el.finale;
    f.querySelector('.finale-title').innerHTML = `<span data-k="finale.title">${esc(this.content.finale.title)}</span><span class="fam">${esc(this.content.family)}</span>`;
    f.querySelector('.finale-sub').innerHTML = `<span data-k="finale.subtitle">${esc(this.content.finale.subtitle)}</span>`;
  }
  showFinale({ onAgain, onCapture }) {
    const f = this.el.finale;
    this.fillFinale();
    f.hidden = false;
    f.querySelector('#watch-again').onclick = onAgain;
    f.querySelector('#capture-moment').onclick = onCapture;
    const show = $('#ui-show'), hide = $('#hide-ui');
    hide.hidden = false;
    hide.onclick = () => { document.body.classList.add('ui-hidden'); show.hidden = false; };
    show.onclick = () => { document.body.classList.remove('ui-hidden'); show.hidden = true; };
  }
  hideFinale() { this.el.finale.hidden = true; document.body.classList.remove('ui-hidden'); $('#ui-show').hidden = true; $('#hide-ui').hidden = true; }

  /** The camera's frame (the photo's own shape) and its button; onShoot fires once, on the press. */
  showViewfinder(onShoot) {
    const vf = $('#viewfinder');
    const size = () => {
      const w = innerWidth, h = this.stageHeight(), portrait = w / h < 1.1;
      const ar = portrait ? 3 / 4 : 4 / 3;   // the photo's shape
      let fw = Math.min(w * 0.9, (h - 200) * ar), fh = fw / ar;
      if (fh > h * 0.72) { fh = h * 0.72; fw = fh * ar; }
      vf.style.setProperty('--vfw', `${fw}px`); vf.style.setProperty('--vfh', `${fh}px`);
    };
    size();
    this._vfResize = size;
    addEventListener('resize', size);
    vf.classList.remove('shot');
    vf.hidden = false;
    this.el.nav.style.visibility = 'hidden';
    this.el.topbar.style.visibility = 'hidden';
    const btn = $('#vf-shutter');
    btn.onclick = () => { btn.onclick = null; vf.querySelector('.vf-controls').style.opacity = '0'; onShoot(); };
    vf.querySelector('.vf-controls').style.opacity = '';
    btn.focus({ preventScroll: true });
  }
  /** How much of the stage's height the viewfinder's frame covers (the photo is exactly what's inside it). */
  viewfinderFill() { return Math.min(1, (parseFloat($('#viewfinder').style.getPropertyValue('--vfh')) || 0) / this.stageHeight()) || 1; }
  countdown(n) { const c = $('.vf-count'); c.textContent = n; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
  viewfinderShot() { $('#viewfinder').classList.add('shot'); $('.vf-count').textContent = ''; }
  hideViewfinder() {
    $('#viewfinder').hidden = true;
    removeEventListener('resize', this._vfResize);
    this.el.nav.style.visibility = '';
    this.el.topbar.style.visibility = '';
  }

  flash() {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:.92;pointer-events:none;transition:opacity .8s ease-out;z-index:30';
    document.body.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => { d.style.opacity = '0'; }));
    setTimeout(() => d.remove(), 900);
  }

  /** A big centred banner, for a few seconds. */
  banner(title, sub = '') {
    const d = document.createElement('div');
    d.className = 'hud-banner';
    d.innerHTML = `<p class="hb-title">${esc(title)}</p>${sub ? `<p class="hb-sub">${esc(sub)}</p>` : ''}`;
    $('#ui').appendChild(d);
    setTimeout(() => d.classList.add('out'), 3200);
    setTimeout(() => d.remove(), 3900);
  }

  /** The wishbone's tension (null hides it). */
  pullMeter(v) {
    let m = $('.pull-meter');
    if (v === null) { m?.remove(); return; }
    if (!m) { m = document.createElement('div'); m.className = 'pull-meter'; m.innerHTML = '<i></i>'; $('#ui').appendChild(m); }
    m.firstChild.style.width = `${Math.round(v * 100)}%`;
  }
}

export { esc };
