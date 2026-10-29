// The photo window (as on 56moments.com/vinyl-art-set): the picture inside its real frame — a polaroid
// with its caption, or the cassette label — with a 3×3 grid. Drag to move it, pinch / wheel / slider to
// zoom, pick another shape, type the caption, then save. Resolves with
// { blob (new cropped WebP/JPEG, or null when the picture wasn't touched), caption, remove } or null (cancelled).
import { pickImage, encodeCanvas } from './media.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SHAPES = [['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4]];

function loadURL(url) {
  return new Promise((res) => { if (!url) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
}
async function loadFile(file) {
  const url = URL.createObjectURL(file);
  const img = await loadURL(url);
  if (!img) throw new Error('Could not read the picture.');
  return img;
}

export async function openCropper({ url = '', file = null, aspect = null, caption = null, canRemove = false, maxSide = 1280, title = '' } = {}) {
  let img = file ? await loadFile(file) : await loadURL(url);
  let touched = !!file;
  let shape = aspect || 1;
  if (!aspect && img) shape = SHAPES.reduce((b, s) => (Math.abs(Math.log(s[1] / (img.width / img.height))) < Math.abs(Math.log(b / (img.width / img.height))) ? s[1] : b), 1);

  const dlg = document.createElement('dialog');
  dlg.className = 'crop-dialog';
  dlg.innerHTML = `
    <p class="crop-title">${esc(title)}</p>
    <div class="crop-frame ${caption != null ? 'polaroid' : 'label'}">
      <div class="crop-window"><img alt="" draggable="false"><div class="crop-grid"></div><button type="button" class="crop-empty" data-a="pick">🖼<span>Choose a picture</span></button></div>
      ${caption != null ? `<input class="crop-caption" maxlength="120" placeholder="Caption under the picture" value="${esc(caption)}" aria-label="Caption under the picture">` : ''}
    </div>
    <p class="crop-hint">Drag to position, zoom in or out</p>
    <div class="crop-tools">
      ${aspect ? '' : `<div class="crop-shapes">${SHAPES.map(([n, v]) => `<button type="button" data-shape="${v}">${n}</button>`).join('')}</div>`}
      <input type="range" class="crop-zoom" min="1" max="4" step="0.01" value="1" aria-label="Zoom">
    </div>
    <div class="crop-actions">
      <button type="button" data-a="pick" class="crop-quiet">🖼 Change picture</button>
      ${canRemove ? '<button type="button" data-a="remove" class="crop-quiet">Remove</button>' : ''}
      <button type="button" data-a="cancel">Cancel</button>
      <button type="button" data-a="save" class="crop-main">Save</button>
    </div>`;
  document.body.append(dlg);
  const win = dlg.querySelector('.crop-window'), pic = win.querySelector('img'), zoom = dlg.querySelector('.crop-zoom');
  let W = 0, H = 0, base = 1, z = 1, tx = 0, ty = 0;

  const clamp = () => {
    const sc = base * z, iw = img.width * sc, ih = img.height * sc;
    tx = Math.min(0, Math.max(W - iw, tx)); ty = Math.min(0, Math.max(H - ih, ty));
  };
  const draw = () => {
    dlg.classList.toggle('empty', !img);
    if (!img) return;
    clamp();
    pic.style.transform = `translate(${tx}px, ${ty}px) scale(${base * z})`;
  };
  const layout = (keepCentre = true) => {
    const maxW = Math.min(320, innerWidth * 0.72), maxH = Math.min(380, innerHeight * 0.46);
    const cx = img ? (W / 2 - tx) / (base * z) : 0, cy = img ? (H / 2 - ty) / (base * z) : 0;
    W = Math.min(maxW, maxH * shape); H = W / shape;
    win.style.width = `${W}px`; win.style.height = `${H}px`;
    dlg.querySelectorAll('[data-shape]').forEach((b) => b.classList.toggle('on', Math.abs(+b.dataset.shape - shape) < 1e-3));
    if (!img) return draw();
    pic.src = img.src; pic.style.width = `${img.width}px`; pic.style.height = `${img.height}px`;
    base = Math.max(W / img.width, H / img.height);
    if (keepCentre && cx) { tx = W / 2 - cx * base * z; ty = H / 2 - cy * base * z; } else { z = 1; zoom.value = 1; tx = (W - img.width * base) / 2; ty = (H - img.height * base) / 2; }
    draw();
  };
  const zoomTo = (nz, px = W / 2, py = H / 2) => {
    nz = Math.min(4, Math.max(1, nz));
    const k = nz / z; tx = px - (px - tx) * k; ty = py - (py - ty) * k; z = nz; zoom.value = z; touched = true; draw();
  };

  // drag / pinch
  const pts = new Map(); let pinch = 0;
  win.addEventListener('pointerdown', (e) => { if (!img || e.target.closest('button')) return; win.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); pinch = 0; });
  win.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) { tx += e.clientX - p[0]; ty += e.clientY - p[1]; touched = true; draw(); }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = win.getBoundingClientRect();
      if (pinch) zoomTo(z * d / pinch, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
      pinch = d;
    }
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
  win.addEventListener('pointerup', up); win.addEventListener('pointercancel', up);
  win.addEventListener('wheel', (e) => { if (!img) return; e.preventDefault(); const r = win.getBoundingClientRect(); zoomTo(z * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  zoom.addEventListener('input', () => zoomTo(+zoom.value));
  dlg.querySelectorAll('[data-shape]').forEach((b) => b.addEventListener('click', () => { shape = +b.dataset.shape; touched = true; layout(true); }));

  return new Promise((resolve) => {
    const done = (v) => { dlg.close(); dlg.remove(); removeEventListener('resize', onResize); resolve(v); };
    const onResize = () => layout(true);
    addEventListener('resize', onResize);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    dlg.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'cancel') return done(null);
      if (a === 'remove') return done({ blob: null, caption: dlg.querySelector('.crop-caption')?.value ?? null, remove: true });
      if (a === 'pick') {
        const f = await pickImage(); if (!f) return;
        try { img = await loadFile(f); touched = true; if (!aspect) shape = SHAPES.reduce((b, s) => (Math.abs(Math.log(s[1] / (img.width / img.height))) < Math.abs(Math.log(b / (img.width / img.height))) ? s[1] : b), 1); layout(false); } catch { /* keep the old one */ }
        return;
      }
      if (a === 'save') {
        const cap = dlg.querySelector('.crop-caption')?.value.trim() ?? null;
        if (!img || !touched) return done({ blob: null, caption: cap, remove: false });
        const btn = e.target.closest('button'); btn.disabled = true; btn.textContent = 'Saving…';
        const sc = base * z, sw = W / sc, sh = H / sc, k = Math.min(1, maxSide / Math.max(sw, sh));
        const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
        const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, -tx / sc, -ty / sc, sw, sh, 0, 0, c.width, c.height);
        try { done({ blob: await encodeCanvas(c), caption: cap, remove: false }); } catch { done(null); }
      }
    });
    dlg.showModal();
    layout(false);
  });
}
