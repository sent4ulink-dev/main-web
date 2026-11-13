// The step-by-step editor shared by the sent4u cards: a step-by-step form (real text boxes, not text edited
// inside the 3D scene). This card's copy is in English and its preview is the card itself, live: the real
// scene running beside the form (see live-preview.js), turning to the part each step is about, with whatever
// is typed appearing on it at once. No framework and no build step: the card gives it its steps and four
// functions (see openEasyEditor). One master copy lives with the store's tools; each card keeps its own copy.

const STYLE = `
.ez,.ez *{box-sizing:border-box;margin:0;-webkit-tap-highlight-color:transparent}
.ez{--ez-bg:#12110f;--ez-card:#1b1a16;--ez-ink:#f3efe7;--ez-soft:#a9a397;--ez-line:rgba(243,239,231,.17);--ez-acc:#e4572e;--ez-acc-soft:rgba(228,87,46,.18);--ez-ok:#5fc998;--ez-warn:#ff9270;--ez-mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;--ez-serif:"Cormorant Garamond",Georgia,"Times New Roman",serif;
  position:fixed;left:0;top:0;right:0;height:var(--ez-vh,100dvh);z-index:2147483000;display:flex;flex-direction:column;background:var(--ez-bg);color:var(--ez-ink);color-scheme:dark;
  font:15px/1.45 "IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;text-align:left;-webkit-font-smoothing:antialiased;-webkit-user-select:text;user-select:text;touch-action:manipulation;pointer-events:auto}
.ez button{font:inherit;color:inherit;cursor:pointer;border:0;background:none}
.ez-top{flex:none;display:flex;align-items:center;gap:10px;padding:10px 14px;padding-top:max(10px,env(safe-area-inset-top))}
.ez-brand{font-family:var(--ez-serif);font-style:italic;font-weight:600;font-size:20px;line-height:1.1;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ez-status{flex:none;font-family:var(--ez-mono);font-size:11px;color:var(--ez-soft);white-space:nowrap}
.ez-status.ok{color:var(--ez-ok)}.ez-status.bad{color:var(--ez-warn);font-weight:600}
.ez-x{flex:none;width:32px;height:32px;border-radius:3px;border:1px solid var(--ez-line)!important;font-size:14px;line-height:1}
.ez-steps{flex:none;display:flex;overflow-x:auto;padding:0 8px;border-bottom:1px solid var(--ez-line);scrollbar-width:none}
.ez-steps::-webkit-scrollbar{display:none}
.ez-pill{flex:none;display:flex;align-items:baseline;gap:5px;padding:9px 8px 8px;font-family:var(--ez-mono);font-size:12px;font-weight:500;color:var(--ez-soft);white-space:nowrap;border-bottom:2px solid transparent!important;margin-bottom:-1px}
.ez-pill i{font-style:normal;font-size:10.5px;opacity:.75}
.ez-pill.on{color:var(--ez-ink);border-bottom-color:var(--ez-acc)!important}.ez-pill.on i{color:var(--ez-acc);opacity:1}
.ez-pill.done i{color:var(--ez-acc);opacity:1}
.ez-main{flex:1;min-height:0;display:flex;flex-direction:column}
.ez-scroll{flex:1 1 56%;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:16px 16px 20px}
.ez-in{max-width:620px;margin:0 auto}
.ez-title{font-family:var(--ez-serif);font-style:italic;font-size:31px;line-height:1.08;font-weight:600;margin-bottom:5px}
.ez-hint{color:var(--ez-soft);font-size:14px;margin-bottom:6px}
.ez-card{border-top:1px solid var(--ez-line);padding-top:13px;margin-top:15px}
.ez-card h4{font-size:15px;font-weight:600}.ez-card>p{color:var(--ez-soft);font-size:13px;margin-top:1px}
.ez-f{margin-top:13px}.ez-card>.ez-f:first-child{margin-top:0}
.ez-l{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-family:var(--ez-mono);font-size:12px;font-weight:500;color:var(--ez-ink);margin-bottom:6px}
.ez-l small{font-weight:400;font-size:10.5px;color:var(--ez-soft);flex:none}
.ez input[type=text],.ez input[type=date],.ez textarea{width:100%;display:block;border:1px solid var(--ez-line);border-radius:3px;background:var(--ez-card);color:var(--ez-ink);padding:11px 12px;font-size:16px;line-height:1.35;font-family:inherit;outline:none;-webkit-appearance:none;appearance:none;-webkit-user-select:text;user-select:text}
.ez input::placeholder,.ez textarea::placeholder{color:#7d786d}
.ez input:focus,.ez textarea:focus{border-color:var(--ez-acc);box-shadow:inset 0 0 0 1px var(--ez-acc)}
.ez textarea{min-height:84px;resize:vertical}
.ez-help{font-size:12.5px;color:var(--ez-soft);margin-top:5px}
.ez-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.ez-chip{padding:6px 9px;border-radius:3px;border:1px solid var(--ez-line)!important;color:var(--ez-soft)!important;font-size:12.5px;line-height:1.25;text-align:left}
.ez-more{margin-top:13px;border-top:1px dashed var(--ez-line);padding-top:11px}.ez-more summary{cursor:pointer;font-family:var(--ez-mono);font-size:12px;font-weight:500;color:var(--ez-soft)}
.ez-photos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.ez-photo{position:relative;display:block;width:100%;aspect-ratio:4/5;border:1px dashed rgba(243,239,231,.38);border-radius:3px;background:var(--ez-card) center/cover no-repeat;overflow:hidden;cursor:pointer}
.ez-photo.has{border-style:solid;border-color:var(--ez-line)}
.ez-photo input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:0}
.ez-photo span{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-family:var(--ez-mono);font-size:11.5px;font-weight:500;color:var(--ez-soft);pointer-events:none;text-align:center;padding:6px}
.ez-photo span b{font-size:22px;line-height:1;font-weight:400;color:var(--ez-acc)}.ez-photo.has span{display:none}
.ez-photo.busy span{display:flex;background:rgba(18,17,15,.78)}
.ez-rm{position:absolute;right:5px;top:5px;width:28px;height:28px;border-radius:3px;background:rgba(18,17,15,.82)!important;color:#fff!important;font-size:12px;z-index:2}
.ez-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:9px 16px;border-radius:3px;font-weight:600!important;border:1px solid var(--ez-line)!important}
.ez-btn.main{background:var(--ez-acc)!important;border-color:var(--ez-acc)!important;color:#12110f!important}
.ez-btn.dark{background:var(--ez-ink)!important;border-color:var(--ez-ink)!important;color:#12110f!important}
.ez-btn:disabled{opacity:.5}
.ez-dock{flex:0 0 48%;min-height:0;display:flex;flex-direction:column;background:#0a0a08;border-top:1px solid var(--ez-line);padding:7px 10px 8px}
.ez-dock-l{flex:none;display:flex;align-items:center;gap:10px;color:var(--ez-soft);font-family:var(--ez-mono);font-size:10.5px;font-weight:500;margin-bottom:6px}
.ez-dock-l>span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ez-dock-l>span::before{content:"";display:inline-block;width:6px;height:6px;margin-right:6px;background:var(--ez-acc);vertical-align:1px;animation:ez-rec 1.6s ease-in-out infinite}
@keyframes ez-rec{50%{opacity:.25}}
.ez-dock-l button{color:var(--ez-soft);font-family:var(--ez-mono);font-size:10.5px;font-weight:500}
.ez-dock-l [data-big]{text-decoration:underline;text-underline-offset:2px}
.ez-dev{display:flex;border:1px solid var(--ez-line);border-radius:3px;overflow:hidden}
.ez-dev button{padding:3px 8px}.ez-dev button.on{background:var(--ez-acc-soft);color:var(--ez-ink)}
.ez-stage{flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center}
.ez-live{position:relative;overflow:hidden;border-radius:3px;background:#000;flex:none}
.ez-live iframe{position:absolute;left:0;top:0;border:0;transform-origin:0 0;pointer-events:none;background:#000}
.ez-live-wait{position:absolute;inset:0;display:grid;place-items:center;padding:12px;text-align:center;color:var(--ez-soft);font-family:var(--ez-mono);font-size:11.5px;background:#0a0a08;transition:opacity .5s}
.ez-live.ready .ez-live-wait{opacity:0;pointer-events:none}
.ez-shot{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:#0a0a08}
.ez-shot.on{display:flex}.ez-shot img{max-width:100%;max-height:100%;border-radius:3px;display:block}
.ez-dock.big{position:fixed;inset:0;z-index:5;flex:none;padding:12px;padding-top:max(12px,env(safe-area-inset-top))}
.ez-nav{flex:none;display:flex;gap:9px;padding:9px 12px;padding-bottom:max(9px,env(safe-area-inset-bottom));border-top:1px solid var(--ez-line)}
.ez-nav .ez-btn{flex:1}.ez-nav .back{flex:0 0 34%}
.ez.kb .ez-steps,.ez.kb .ez-nav,.ez.kb .ez-title,.ez.kb .ez-hint{display:none}
.ez.kb .ez-top{padding-top:6px;padding-bottom:6px}.ez.kb .ez-scroll{padding-top:8px}.ez.kb .ez-card:first-of-type{border-top:0;margin-top:0;padding-top:0}
.ez-end{display:flex;flex-direction:column;gap:9px;margin-top:13px}
.ez-copy{display:flex;gap:7px;margin-top:8px}.ez-copy input{flex:1;font-size:13px!important;padding:9px 10px!important;min-width:0}
.ez-sheet{position:fixed;inset:0;z-index:6;display:grid;place-items:center;background:rgba(0,0,0,.66);padding:20px}
.ez-sheet>div{background:var(--ez-card);border:1px solid var(--ez-line);border-radius:3px;padding:18px;max-width:380px;width:100%}.ez-sheet h4{font-family:var(--ez-serif);font-style:italic;font-size:24px;line-height:1.1;font-weight:600;margin-bottom:7px}.ez-sheet p{color:var(--ez-soft);margin-bottom:13px;font-size:14px}.ez-sheet .ez-end{margin-top:0}
.ez-loading{flex:1;display:grid;place-items:center;color:var(--ez-soft);font-family:var(--ez-mono);font-size:13px;text-align:center;padding:24px}
@media (min-width:900px){
  .ez-main{flex-direction:row}.ez-scroll{flex:1 1 42%;padding:26px}.ez-dock{flex:0 0 58%;border-top:0;border-left:1px solid var(--ez-line);padding:14px}
  .ez-steps{padding:0 14px}.ez-title{font-size:38px}
  .ez-nav{justify-content:center}.ez-nav .ez-btn{flex:0 1 240px}.ez-nav .back{flex:0 1 160px}
}
`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (v) => JSON.parse(JSON.stringify(v));
const getPath = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) {
  const keys = String(p).split('.'), last = keys.pop();
  const t = keys.reduce((a, k) => { if (a[k] == null) a[k] = /^\d+$/.test(k) ? [] : {}; return a[k]; }, o);
  t[last] = v;
}

/** A picked picture, at most `max` px on its longer side, as WebP (JPEG where the browser can't write WebP, e.g. Safari). */
export async function shrinkImage(file, { max = 1280, quality = 0.82 } = {}) {
  const decode = async (blob) => {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { /* older Safari */ }
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode')); i.src = URL.createObjectURL(blob); });
  };
  let src;
  try { src = await decode(file); } catch {
    // an iPhone/Mac HEIC photo in a browser that can't read it: converted here, only when it is needed
    if (!/hei[cf]/i.test(`${file.type} ${file.name}`)) throw new Error('Couldn’t read that picture. Please choose a JPG or PNG.');
    try {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js'; s.onload = res; s.onerror = rej; document.head.append(s); });
      src = await decode(await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 }));
    } catch { throw new Error('Couldn’t convert that HEIC photo. Please choose a JPG or PNG.'); }
  }
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height); src.close?.();
  const encode = (type, q) => new Promise((res) => c.toBlob(res, type, q));
  let blob = await encode('image/webp', quality);
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg', quality);
  // the card servers take at most about 900 KB per picture
  for (let q = quality - 0.14; blob && blob.size > 650e3 && q > 0.3; q -= 0.14) blob = await encode(blob.type, q);
  if (!blob) throw new Error('Couldn’t prepare that picture.');
  return blob;
}

/**
 * Opens the editor over the card.
 *   title                 the card's name
 *   steps                 [{ id, pill, title, hint, cards: [{ title, hint, fields: [...], more: [...] }], preview | previews }]
 *   load()                → { content, canEdit, finished } fresh from wherever the card keeps it
 *   save(content, { finish }) resolves when stored (a conflict is the card's to settle; see saveKeepingLatest)
 *   live                  the live preview (live-preview.js): the card itself, running in the dock
 *   canFinish             offer "finish for good" (not on test links)
 *   end                   the last step's own card: { title, text, button, run() → a link to show }
 * Fields: { type: 'text'|'textarea'|'date'|'photos'|'custom', path or get/set, label, max, hint, placeholder, suggest: [...], pv (which preview) }
 *   photos: { slots, url(n), store(n, file), drop(n) } — the card's own picture frames
 *   custom: { mount(el, { status, preview(p | null) }) → { flush() → Promise<saved?> } } — a part of the form the card draws itself
 * Preview: { scene, sub, crop: { x, y, w, h } (% of a phone screen, used when the dock is small) } | { picture(content) → Blob }
 * Closes with cfg.done(saved).
 */
export function openEasyEditor(cfg) {
  if (document.querySelector('.ez')) return;
  if (!document.getElementById('ez-style')) { const s = document.createElement('style'); s.id = 'ez-style'; s.textContent = STYLE; document.head.append(s); const f = document.createElement('link'); f.rel = 'stylesheet'; f.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,600&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap'; document.head.append(f); }
  const root = document.createElement('div');
  root.className = 'ez'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Edit the card');
  root.innerHTML = `<div class="ez-top"><b class="ez-brand">${esc(cfg.title)}</b><span class="ez-status" role="status"></span><button type="button" class="ez-x" aria-label="Close">✕</button></div><div class="ez-loading">Loading…</div>`;
  document.body.append(root);
  cfg.onOpen?.();
  // what happens in here stays in here: the card's own key and touch controls don't see it
  for (const type of ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove', 'touchend', 'wheel', 'paste', 'input', 'click']) root.addEventListener(type, (e) => e.stopPropagation());
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  const $ = (s) => root.querySelector(s);
  const statusEl = $('.ez-status');
  const status = (text, cls = '') => { statusEl.textContent = text; statusEl.className = `ez-status ${cls}`; };

  // the on-screen keyboard shrinks the visible page: the editor follows it, and the preview stays above the keyboard
  const vv = window.visualViewport;
  const fit = () => {
    const h = vv ? vv.height : innerHeight;
    root.style.setProperty('--ez-vh', `${h}px`);
    root.style.top = vv ? `${vv.offsetTop}px` : '0';
    root.classList.toggle('kb', h < screen.height * 0.62 && innerWidth < 900 && /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || ''));
    layoutPreview();
  };

  let content = null, stepIndex = 0, activePv = 0, dirty = false, saved = false, saving = null, again = false, timer = 0, closed = false;
  let mounted = [], override = null;   // the card's own parts of this step's form; where one of them points the preview
  const step = () => cfg.steps[stepIndex];
  const previewOf = (s = step()) => override || (s.previews ? s.previews[activePv] || s.previews[0] : s.preview);
  const read = (f) => (f.get ? f.get(content) : getPath(content, f.path));
  const write = (f, v) => { if (f.set) f.set(content, v); else setPath(content, f.path, v); };

  // ── saving: quietly after each pause in typing ──
  const changed = () => { dirty = true; status('Not saved yet…'); clearTimeout(timer); timer = setTimeout(saveNow, 1400); };
  async function saveNow(finish = false) {
    clearTimeout(timer);
    if (saving) { again = true; return saving; }
    if (!dirty && !finish) return true;
    status('Saving…'); dirty = false;
    saving = (async () => {
      try { await cfg.save(clone(content), { finish }); saved = true; status('Saved ✓', 'ok'); return true; }
      catch (e) { dirty = true; status(`Couldn’t save: ${e.message || 'connection problem'}`, 'bad'); clearTimeout(timer); timer = setTimeout(saveNow, 8000); return false; }
      finally { saving = null; if (again) { again = false; if (dirty) saveNow(); } }
    })();
    return saving;
  }
  addEventListener('beforeunload', guard);
  function guard(e) { if (dirty && !closed) { e.preventDefault(); e.returnValue = ''; } }

  async function close() {
    if (dirty && !await saveNow()) { if (!confirm('Your last changes aren’t saved. Close anyway?')) return; dirty = false; }
    if (saving) await saving;
    const parts = await Promise.all(mounted.map((m) => m.flush?.()));
    if (parts.includes(false) && !confirm('Some changes to the guest list aren’t saved. Close anyway?')) return;
    if (parts.length) saved = true;
    closed = true;
    removeEventListener('beforeunload', guard);
    vv?.removeEventListener('resize', fit); vv?.removeEventListener('scroll', fit);
    cfg.live?.dispose();
    root.remove();
    document.documentElement.style.overflow = prevOverflow;
    cfg.done?.(saved);
  }
  $('.ez-x').onclick = close;

  // ── the preview: the card itself, live, at the part this step is about (or a picture drawn from the words) ──
  let shotTimer = 0, shotN = 0, shotURL = '';
  function showPreview() {
    const p = previewOf(), live = cfg.live, dock = $('.ez-dock');
    if (!dock || !live) return;
    const shot = $('.ez-shot');
    if (p.scene) live.show(p.scene, p.sub);
    shot.classList.toggle('on', !!p.picture);
    if (p.picture) paintPicture(p);
    layoutPreview();
  }
  function layoutPreview() {
    const stage = $('.ez-stage'); if (!stage || !cfg.live) return;
    const p = previewOf();
    cfg.live.fit(stage.clientWidth, stage.clientHeight, { crop: $('.ez-dock').classList.contains('big') ? null : p.crop });
  }
  // a picture drawn from the words (the saved picture), redrawn a moment after typing stops
  function paintPicture(p) {
    clearTimeout(shotTimer);
    const img = $('.ez-shot img'), shown = !!img.getAttribute('src');
    shotTimer = setTimeout(async () => {
      const n = ++shotN;
      let blob = null;
      try { blob = await p.picture(content); } catch (e) { console.warn('preview', e); }
      if (!blob || n !== shotN || !previewOf().picture) return;
      if (shotURL) URL.revokeObjectURL(shotURL);
      shotURL = URL.createObjectURL(blob); img.src = shotURL;
    }, shown ? 600 : 1800);   // (the first time, the scene gets a moment to arrive)
  }
  const typed = () => { cfg.live?.update(content); if (previewOf().picture) paintPicture(previewOf()); };

  // ── fields ──
  const count = (el, f, v) => { if (el) { el.textContent = f.max ? `${[...String(v)].length} / ${f.max}` : ''; } };
  function fieldHTML(f, key) {
    const label = f.label ? `<label class="ez-l" for="ez-${key}"><span>${esc(f.label)}</span><small data-n="${key}"></small></label>` : '';
    const help = f.hint ? `<p class="ez-help">${esc(f.hint)}</p>` : '';
    const chips = f.suggest ? `<div class="ez-chips">${f.suggest.map((t, i) => `<button type="button" class="ez-chip" data-sg="${key}:${i}">${esc(t)}</button>`).join('')}</div>` : '';
    switch (f.type) {
      case 'textarea': return `<div class="ez-f">${label}<textarea id="ez-${key}" data-f="${key}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}"></textarea>${help}${chips}</div>`;
      case 'date': return `<div class="ez-f">${label}<input id="ez-${key}" data-f="${key}" type="date">${help}</div>`;
      case 'photos': return `<div class="ez-f">${label}<div class="ez-photos">${[...Array(f.slots).keys()].map((n) => `<label class="ez-photo" data-ph="${key}:${n}"><input type="file" accept="image/*" aria-label="Photo ${n + 1}"><span><b>＋</b>Photo ${n + 1}</span></label>`).join('')}</div>${help}</div>`;
      case 'custom': return `<div class="ez-f" data-cu="${key}"></div>`;
      default: return `<div class="ez-f">${label}<input id="ez-${key}" data-f="${key}" type="text" placeholder="${esc(f.placeholder || '')}" autocomplete="off">${help}${chips}</div>`;
    }
  }

  function focusField(f) {
    if (f.pv != null && f.pv !== activePv) { activePv = f.pv; showPreview(); }
  }

  function renderStep() {
    const s = step(), scroll = $('.ez-scroll'), fields = [];
    for (const m of mounted) m.flush?.();
    mounted = []; override = null;
    activePv = 0;
    const add = (f) => { fields.push(f); return fieldHTML(f, fields.length - 1); };
    const cards = s.cards.map((c) => `<section class="ez-card">${c.title ? `<h4>${esc(c.title)}</h4>` : ''}${c.hint ? `<p>${esc(c.hint)}</p>` : ''}${c.title || c.hint ? '<div style="height:10px"></div>' : ''}${c.fields.map(add).join('')}${c.more ? `<details class="ez-more"><summary>${esc(c.moreLabel || 'More words')}</summary>${c.more.map(add).join('')}</details>` : ''}</section>`).join('');
    const last = stepIndex === cfg.steps.length - 1;
    scroll.innerHTML = `<div class="ez-in"><h2 class="ez-title">${esc(s.title)}</h2>${s.hint ? `<p class="ez-hint">${esc(s.hint)}</p>` : ''}${cards}${last ? endHTML() : ''}</div>`;
    scroll.scrollTop = 0;
    fields.forEach((f, i) => {
      const box = scroll.querySelector(`[data-f="${i}"]`), n = scroll.querySelector(`[data-n="${i}"]`);
      if (box) {
        box.value = read(f) ?? '';
        count(n, f, box.value);
        box.addEventListener('focus', () => { focusField(f); setTimeout(() => { fit(); box.scrollIntoView({ block: 'nearest' }); }, 280); });
        box.addEventListener('blur', () => setTimeout(fit, 120));
        box.addEventListener('input', () => {
          if (f.max && [...box.value].length > f.max) box.value = [...box.value].slice(0, f.max).join('');
          write(f, box.value); count(n, f, box.value); typed(); changed();
        });
      }
      scroll.querySelectorAll(`[data-sg^="${i}:"]`).forEach((b, k) => b.addEventListener('click', () => { write(f, f.suggest[k]); if (box) { box.value = f.suggest[k]; count(n, f, box.value); } focusField(f); typed(); changed(); }));
      scroll.querySelectorAll(`[data-ph^="${i}:"]`).forEach((ph) => mountPhoto(ph, f, +ph.dataset.ph.split(':')[1]));
      // a card's own part of the form (the guest list): it saves on its own, and may point the preview elsewhere
      const cu = scroll.querySelector(`[data-cu="${i}"]`);
      if (cu) mounted.push(f.mount(cu, { status, preview: (p) => { override = p; showPreview(); } }) || {});
    });
    if (last) bindEnd();
    $('.ez-steps').innerHTML = cfg.steps.map((t, i) => `<button type="button" class="ez-pill${i === stepIndex ? ' on' : i < stepIndex ? ' done' : ''}" data-go="${i}"><i>${String(i + 1).padStart(2, '0')}</i>${esc(t.pill)}</button>`).join('');
    $('.ez-steps .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    $('.ez-nav').innerHTML = `${stepIndex ? '<button type="button" class="ez-btn back" data-nav="-1">Back</button>' : ''}${last ? '<button type="button" class="ez-btn main" data-nav="done">Save and see it</button>' : '<button type="button" class="ez-btn main" data-nav="1">Next</button>'}`;
    showPreview();
  }

  /** One of the card's picture frames: pick a picture to hang, ✕ to take it down. */
  function mountPhoto(box, f, n) {
    const input = box.querySelector('input'), label = box.querySelector('span');
    const paint = () => {
      const url = f.url(n);
      box.classList.toggle('has', !!url);
      box.style.backgroundImage = url ? `url("${url}")` : 'none';
      box.querySelector('.ez-rm')?.remove();
      if (!url) return;
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'ez-rm'; x.textContent = '✕'; x.setAttribute('aria-label', `Take photo ${n + 1} down`);
      x.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        status('Taking it down…');
        try { await f.drop(n); status('Taken down ✓', 'ok'); } catch (err) { status(err.message || 'Couldn’t take it down.', 'bad'); }
        paint();
      });
      box.append(x);
    };
    paint();
    box.addEventListener('click', () => focusField(f));
    input.addEventListener('change', async () => {
      const file = input.files?.[0]; input.value = '';
      if (!file) return;
      focusField(f);
      box.classList.add('busy'); label.innerHTML = 'Hanging it…';
      try { await f.store(n, file); status('Up on the wall ✓', 'ok'); } catch (e) { status(e.message || 'Couldn’t add that picture.', 'bad'); }
      finally { box.classList.remove('busy'); label.innerHTML = `<b>＋</b>Photo ${n + 1}`; paint(); }
    });
  }

  function endHTML() {
    const e = cfg.end;
    return `${cfg.deadlineText?.() ? `<p class="ez-help" style="margin-top:12px">${esc(cfg.deadlineText())}</p>` : ''}${e ? `<section class="ez-card"><h4>${esc(e.title)}</h4><p>${esc(e.text)}</p><div class="ez-end"><button type="button" class="ez-btn dark" data-end="link">${esc(e.button)}</button></div><div class="ez-copy" hidden><input type="text" readonly aria-label="Link"><button type="button" class="ez-btn dark" data-end="copy">Copy</button></div>${e.open ? `<div class="ez-end" data-open-row hidden><button type="button" class="ez-btn main" data-end="open">${esc(e.open)}</button></div>` : ''}</section>` : ''}${cfg.canFinish ? '<section class="ez-card"><h4>Finish for good</h4><p>Once finished, the wording can’t be edited again (the guest list stays yours to run). Only press this when everything is ready.</p><div class="ez-end"><button type="button" class="ez-btn" data-end="finish">Finish for good</button></div></section>' : ''}`;
  }
  function bindEnd() {
    const scroll = $('.ez-scroll');
    scroll.querySelector('[data-end="link"]')?.addEventListener('click', async (e) => {
      const b = e.currentTarget, row = scroll.querySelector('.ez-copy');
      b.disabled = true;
      try {
        row.querySelector('input').value = await cfg.end.run(); row.hidden = false; b.hidden = true;
        const open = scroll.querySelector('[data-open-row]'); if (open) open.hidden = false;
      }
      catch (err) { status(err.message || 'Couldn’t make the link.', 'bad'); b.disabled = false; }
    });
    // (the demo: its guest link opens here, as a guest of the same demonstration)
    scroll.querySelector('[data-end="open"]')?.addEventListener('click', () => { location.href = scroll.querySelector('.ez-copy input').value; });
    scroll.querySelector('[data-end="copy"]')?.addEventListener('click', async (e) => {
      const input = scroll.querySelector('.ez-copy input');
      try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand('copy'); }
      e.target.textContent = 'Copied ✓';
    });
    scroll.querySelector('[data-end="finish"]')?.addEventListener('click', () => {
      const sheet = document.createElement('div');
      sheet.className = 'ez-sheet';
      sheet.innerHTML = '<div><h4>Finish for good?</h4><p>Everything you have now is saved. After that, the wording can’t be edited again.</p><div class="ez-end"><button type="button" class="ez-btn main" data-s="yes">Yes, finish it</button><button type="button" class="ez-btn" data-s="no">No, keep editing</button></div></div>';
      root.append(sheet);
      sheet.addEventListener('click', async (e) => {
        const c = e.target.closest('[data-s]')?.dataset.s; if (!c) return;
        if (c === 'no') return sheet.remove();
        e.target.disabled = true;
        dirty = true;
        if (await saveNow(true)) { saved = true; sheet.remove(); close(); } else sheet.remove();
      });
    });
  }

  function goTo(i) {
    if (i < 0 || i >= cfg.steps.length) return;
    if (dirty) saveNow();
    stepIndex = i; renderStep();
  }

  function build() {
    root.querySelector('.ez-loading').remove();
    const devices = cfg.live ? `<div class="ez-dev" role="group" aria-label="Show it as on">${['phone', 'computer'].map((d) => `<button type="button" data-dev="${d}"${cfg.live.device === d ? ' class="on"' : ''}>${d === 'phone' ? 'Phone' : 'Computer'}</button>`).join('')}</div>` : '';
    root.insertAdjacentHTML('beforeend', `<nav class="ez-steps" aria-label="Steps"></nav><div class="ez-main"><div class="ez-scroll"></div><div class="ez-dock"><div class="ez-dock-l"><span>Live preview</span>${devices}<button type="button" data-big>Full screen</button></div><div class="ez-stage"><div class="ez-shot"><img alt="The saved picture"></div></div></div></div><div class="ez-nav"></div>`);
    if (cfg.live) $('.ez-stage').prepend(cfg.live.el);
    $('.ez-steps').addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) goTo(+g.dataset.go); });
    $('.ez-nav').addEventListener('click', (e) => {
      const n = e.target.closest('[data-nav]')?.dataset.nav; if (!n) return;
      if (n === 'done') { dirty = true; saveNow().then(close); return; }
      goTo(stepIndex + +n);
    });
    $('[data-big]').addEventListener('click', (e) => {
      const big = $('.ez-dock').classList.toggle('big');
      e.target.textContent = big ? 'Back to the form' : 'Full screen';
      layoutPreview();
    });
    $('.ez-dock-l').addEventListener('click', (e) => {
      const d = e.target.closest('[data-dev]')?.dataset.dev; if (!d || !cfg.live) return;
      root.querySelectorAll('[data-dev]').forEach((b) => b.classList.toggle('on', b.dataset.dev === d));
      cfg.live.setDevice(d); layoutPreview();
    });
    new ResizeObserver(layoutPreview).observe($('.ez-stage'));
    cfg.live?.update(content);
    renderStep();
    fit();
  }

  vv?.addEventListener('resize', fit); vv?.addEventListener('scroll', fit);
  fit();
  (async () => {
    try {
      const d = await cfg.load();
      content = d.content;
      if (d.canEdit === false || d.finished) {
        $('.ez-loading').innerHTML = `<div><h3 style="font-size:18px;margin-bottom:6px">${d.finished ? 'This card’s wording is finished' : 'The time to edit has ended'}</h3><p>The wording can only be read now.</p></div>`;
        return;
      }
      build();
    } catch (e) {
      $('.ez-loading').innerHTML = `<div><p style="margin-bottom:12px">${esc(e.message || 'Couldn’t load.')}</p><button type="button" class="ez-btn main" data-r>Try again</button></div>`;
      $('[data-r]').onclick = () => { closed = true; root.remove(); document.documentElement.style.overflow = prevOverflow; openEasyEditor(cfg); };
    }
  })();
}

/**
 * Saves against a revision number without ever showing "changed in another window": when the server says the
 * page's revision is old (a second tab, a phone and a laptop, a reply lost on a bad connection), the newest
 * revision is fetched and the save goes again, keeping what is on screen.
 */
export function saveKeepingLatest({ save, latest, getRevision, setRevision, onSaved }) {
  return async (content, opts) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const d = await save(content, getRevision(), opts);
        setRevision(d.revision); onSaved?.(d);
        return d;
      } catch (e) {
        if (e.status !== 409 || attempt >= 2) throw e;
        const now = await latest();
        setRevision(now.revision);
      }
    }
  };
}
