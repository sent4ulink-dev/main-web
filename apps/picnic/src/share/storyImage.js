// "Save image": the last-moment photo as a phone-story picture (1080×1920 PNG), drawn in the browser.
// Logo at the top, the photo cropped square, who / when / from, and a short line at the bottom —
// in the site's own colours and fonts. On phones it opens the share sheet; otherwise it downloads.
import { enDate } from '../util/textures.js';

const W = 1080, H = 1920;
const C = {
  night: '#141235', dusk: '#2b1f5e', plum: '#55306d', glow: 'rgba(255,128,170,0.55)',
  cream: '#fbf3e6', gold: '#f5cf8a', rose: '#ff9fbd', card: 'rgba(16,12,38,0.92)', line: 'rgba(255,170,195,0.7)',
};
const F = { display: 'Caveat, cursive', hand: 'Caveat, cursive', ui: 'Caveat, cursive' };   // the polaroid's handwriting, everywhere

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/).filter(Boolean), lines = [];
  let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}

function fit(ctx, text, weight, size, family, maxW) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 18 && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}

/** 2026 look: a soft aurora gradient mesh, blurred colour blobs, a little film grain and a few stars. */
function background(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1b1446'); g.addColorStop(0.45, '#3a1d63'); g.addColorStop(1, '#7a3a78');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, c] of [[0.15, 0.12, 0.55, 'rgba(255,120,190,0.42)'], [0.95, 0.35, 0.6, 'rgba(120,140,255,0.38)'], [0.3, 0.78, 0.65, 'rgba(255,170,120,0.34)'], [0.85, 0.95, 0.5, 'rgba(255,90,160,0.4)']]) {
    const rg = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * W);
    rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(255,250,240,${0.3 + rnd() * 0.6})`; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, rnd() * 2 + 0.5, 0, Math.PI * 2); ctx.fill(); }
  const img = ctx.getImageData(0, 0, W, H), d = img.data;           // film grain
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
}

/** Frosted-glass pill (no outline). */
function chip(ctx, x, y, text, { size = 30, pad = 26, h = 64, fill = 'rgba(255,255,255,0.14)', color = C.cream, weight = 600 } = {}) {
  ctx.font = `${weight} ${size}px ${F.ui}`;
  const w = ctx.measureText(text).width + pad * 2;
  ctx.fillStyle = fill; roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + pad, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  return w;
}

function sparkle(ctx, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

/**
 * Draw the story picture. photo: a square canvas/image (the captured shot). Returns a canvas.
 */
export async function drawStoryImage({ photo, content, base = '' }) {
  const s = content.share || {};
  const date = new Date(`${content.date.iso}T12:00:00`);
  const texts = [s.brand, s.line, content.name, content.from, enDate(date), 'The last moment · Happy birthday'].filter(Boolean).join(' ');
  await Promise.all([`italic 600 76px ${F.display}`, `700 92px ${F.display}`, `700 64px ${F.hand}`, `600 30px ${F.ui}`].map((f) => document.fonts.load(f, texts).catch(() => {})));
  await document.fonts.ready;
  const logo = s.logo ? await loadImage(`${base}${s.logo}`).catch(() => null) : null;

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  background(ctx);

  // logo
  if (logo && logo.height) { const lh = 74, lw = (logo.width / logo.height) * lh; ctx.drawImage(logo, (W - lw) / 2, 70, lw, lh); }
  else { ctx.textAlign = 'center'; fit(ctx, s.brand || '', 700, 56, F.hand, W - 160); ctx.fillStyle = C.gold; ctx.fillText(s.brand || '', W / 2, 120); }

  // headline: small italic line + the name, big
  ctx.textAlign = 'left';
  ctx.font = `italic 600 60px ${F.display}`; ctx.fillStyle = 'rgba(255,240,230,0.92)';
  ctx.fillText('Happy birthday,', 80, 262);
  const ns = fit(ctx, content.name, 700, 104, F.display, W - 160);
  const ng = ctx.createLinearGradient(80, 0, W - 80, 0);
  ng.addColorStop(0, '#ffd3e2'); ng.addColorStop(0.5, '#ff9fc4'); ng.addColorStop(1, '#ffc58f');
  ctx.fillStyle = ng; ctx.fillText(content.name, 80, 262 + ns + 6);

  // the polaroid: tilted, soft shadow, washi tape, handwritten caption — no outlines
  const pw = 820, ph = pw * 1.18, cx = W / 2, cy = 1060;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-0.045);
  ctx.shadowColor = 'rgba(10,0,30,0.55)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26;
  ctx.fillStyle = '#fdfaf4'; roundRect(ctx, -pw / 2, -ph / 2, pw, ph, 10); ctx.fill();
  ctx.shadowColor = 'transparent';
  const m = 44, side = pw - m * 2;
  const iw = photo.width || photo.naturalWidth, ih = photo.height || photo.naturalHeight, sq = Math.min(iw, ih);
  ctx.drawImage(photo, (iw - sq) / 2, (ih - sq) / 2, sq, sq, -pw / 2 + m, -ph / 2 + m, side, side);
  ctx.fillStyle = '#3a3150'; ctx.textAlign = 'center';
  fit(ctx, `${content.name} ♥`, 700, 64, F.hand, pw - 100);
  ctx.fillText(`${content.name} ♥`, 0, ph / 2 - 58);
  ctx.fillStyle = 'rgba(255,170,200,0.72)';                        // washi tape
  ctx.rotate(0.07); ctx.fillRect(-110, -ph / 2 - 30, 220, 62);
  ctx.restore();
  sparkle(ctx, 150, 580, 30, '#ffe3a3'); sparkle(ctx, 960, 640, 22, '#ffffff'); sparkle(ctx, 930, 1600, 34, '#ffc0d8'); sparkle(ctx, 120, 1520, 18, '#ffffff');

  // frosted chips: when / from
  let x = 80;
  const y = 1640;
  x += chip(ctx, x, y, `📅 ${enDate(date)}`) + 16;
  if (x + 260 > W - 80) x = 80;
  chip(ctx, x, x === 80 ? y + 80 : y, `💌 ${content.from}`);

  // the line at the bottom
  if (s.line) {
    ctx.textAlign = 'center';
    fit(ctx, s.line, 700, 54, F.hand, W - 140);
    ctx.fillStyle = C.cream;
    ctx.fillText(s.line, W / 2, H - 90);
  }
  return cv;
}

/** Turn the canvas into a PNG file (do this ahead of time so sharing stays inside the tap). */
export function canvasToFile(canvas, filename) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ? new File([b], filename, { type: 'image/png' }) : null), 'image/png'));
}

/** Phones: the share sheet with the file. Elsewhere (or if sharing isn't possible): download the PNG. */
export async function shareOrDownload(file, { title = '' } = {}) {
  if (!file) return 'failed';
  const phone = matchMedia('(pointer: coarse)').matches;
  if (phone && navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
