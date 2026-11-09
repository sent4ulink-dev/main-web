// "Save image": the painted moment as a phone-story picture (1080×1920 PNG), drawn in the browser.
// Logo at the top, the name in calligraphy, the painting in a gilded frame, the day on a brass plaque, who it is
// from and a short line at the bottom — in the salon's own colours and fonts. On phones it opens the
// share sheet; otherwise it downloads.
import { enDate } from '../util/textures.js';

const W = 1080, H = 1920;
const C = { claret: '#5c1426', gold: '#e9c06a', cream: '#fbf1dc' };
const F = { script: "'Bad Script', cursive", serif: "'Cormorant Garamond', Georgia, serif" };   // the salon's calligraphy and Garamond

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

function fit(ctx, text, weight, size, family, maxW) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 18 && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}

/** A burgundy silk damask with a gilded double border and corner flourishes, as on an 18th-century card. */
function background(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#2c0912'); g.addColorStop(0.5, C.claret); g.addColorStop(1, '#2c0912');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,190,150,0.06)';                          // damask
  for (let y = 40; y < H; y += 110) for (let x = (y / 110) % 2 ? 55 : 0; x < W + 60; x += 110) {
    ctx.beginPath(); ctx.ellipse(x, y, 14, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - 18, y + 14, 9, 15, -0.6, 0, Math.PI * 2); ctx.ellipse(x + 18, y + 14, 9, 15, 0.6, 0, Math.PI * 2); ctx.fill();
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,0,4,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.lineWidth = 1.5; ctx.strokeRect(50, 50, W - 100, H - 100);
  for (const [x, y, sx, sy] of [[50, 50, 1, 1], [W - 50, 50, -1, 1], [50, H - 50, 1, -1], [W - 50, H - 50, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + sy * 120); ctx.bezierCurveTo(x + sx * 10, y + sy * 40, x + sx * 40, y + sy * 10, x + sx * 120, y); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + sx * 34, y + sy * 34, 9, 0, Math.PI * 2); ctx.fillStyle = C.gold; ctx.fill();
  }
}

function sparkle(ctx, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

function goldGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#f8de96'); g.addColorStop(0.35, '#d9a445'); g.addColorStop(0.55, '#fbe7a8'); g.addColorStop(1, '#a87628');
  return g;
}

/** An ornate gilded frame round (x, y, w, h): bevelled mouldings, corner rosettes and a shell crest. */
function giltFrame(ctx, x, y, w, h, b = 58) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
  ctx.fillStyle = goldGradient(ctx, x - b, y - b, x + w + b, y + h + b);
  ctx.fillRect(x - b, y - b, w + 2 * b, h + 2 * b);
  ctx.restore();
  ctx.strokeStyle = 'rgba(120,70,10,0.7)'; ctx.lineWidth = 3;
  for (const k of [10, 26, b - 6]) ctx.strokeRect(x - b + k, y - b + k, w + 2 * (b - k), h + 2 * (b - k));
  ctx.strokeStyle = 'rgba(255,245,210,0.75)'; ctx.lineWidth = 1.5;
  for (const k of [13, 29]) ctx.strokeRect(x - b + k, y - b + k, w + 2 * (b - k), h + 2 * (b - k));
  for (const [cx, cy] of [[x - b / 2, y - b / 2], [x + w + b / 2, y - b / 2], [x - b / 2, y + h + b / 2], [x + w + b / 2, y + h + b / 2]]) {
    const r = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, 22); r.addColorStop(0, '#fff3c4'); r.addColorStop(1, '#b07c2c');
    ctx.fillStyle = r; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = goldGradient(ctx, x + w / 2 - 80, y - b - 60, x + w / 2 + 80, y - b);
  ctx.beginPath(); ctx.ellipse(x + w / 2, y - b + 4, 80, 52, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,10,0.6)'; ctx.lineWidth = 2;
  for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(x + w / 2, y - b + 2); ctx.lineTo(x + w / 2 + k * 22, y - b - 40 + Math.abs(k) * 6); ctx.stroke(); }
}

/**
 * Draw the story picture. photo: a square canvas/image (the painted moment). Returns a canvas.
 */
export async function drawStoryImage({ photo, content, base = '' }) {
  const s = content.share || {};
  const date = new Date(`${content.date.iso}T12:00:00`);
  const texts = [s.brand, s.title, s.line, content.name, content.from, enDate(date)].filter(Boolean).join(' ');
  await Promise.all([`400 150px ${F.script}`, `italic 600 56px ${F.serif}`, `700 40px ${F.serif}`].map((f) => document.fonts.load(f, texts).catch(() => {})));
  await document.fonts.ready;
  const logo = s.logo ? await loadImage(`${base}${s.logo}`).catch(() => null) : null;

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  background(ctx);

  // logo
  if (logo && logo.height) { const lh = 70, lw = (logo.width / logo.height) * lh; ctx.drawImage(logo, (W - lw) / 2, 92, lw, lh); }
  else { ctx.textAlign = 'center'; fit(ctx, s.brand || '', 700, 50, F.serif, W - 200); ctx.fillStyle = C.gold; ctx.fillText(s.brand || '', W / 2, 140); }

  // headline: the greeting in Garamond italic, the name in gilded calligraphy
  ctx.textAlign = 'center';
  if (s.title) { fit(ctx, s.title, 'italic 600', 56, F.serif, W - 180); ctx.fillStyle = C.cream; ctx.fillText(s.title, W / 2, 290); }
  const ns = fit(ctx, content.name, 400, 150, F.script, W - 180);
  ctx.fillStyle = goldGradient(ctx, 0, 300, 0, 300 + ns);
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  ctx.fillText(content.name, W / 2, 300 + ns * 0.95);
  ctx.shadowColor = 'transparent';

  // the painting in its gilded frame, under a faint varnish
  const side = 760, px = (W - side) / 2, py = 600;
  giltFrame(ctx, px, py, side, side);
  const iw = photo.width || photo.naturalWidth, ih = photo.height || photo.naturalHeight, sq = Math.min(iw, ih);
  ctx.fillStyle = '#2a1410'; ctx.fillRect(px, py, side, side);
  ctx.drawImage(photo, (iw - sq) / 2, (ih - sq) / 2, sq, sq, px, py, side, side);
  const glaze = ctx.createRadialGradient(W / 2, py + side / 2, side * 0.3, W / 2, py + side / 2, side * 0.75);
  glaze.addColorStop(0, 'rgba(0,0,0,0)'); glaze.addColorStop(1, 'rgba(40,15,5,0.35)');
  ctx.fillStyle = glaze; ctx.fillRect(px, py, side, side);

  // a brass plaque with the day
  const pw = 440, ph = 84, ppx = (W - pw) / 2, ppy = py + side + 96;
  ctx.fillStyle = goldGradient(ctx, ppx, ppy, ppx, ppy + ph); roundRect(ctx, ppx, ppy, pw, ph, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(110,70,15,0.8)'; ctx.lineWidth = 3; roundRect(ctx, ppx + 8, ppy + 8, pw - 16, ph - 16, 6); ctx.stroke();
  ctx.fillStyle = '#4a2c0a'; fit(ctx, enDate(date), 700, 40, F.serif, pw - 60);
  ctx.textBaseline = 'middle'; ctx.fillText(enDate(date), W / 2, ppy + ph / 2 + 2); ctx.textBaseline = 'alphabetic';

  // who it is from, and the line at the bottom
  ctx.font = `italic 600 50px ${F.serif}`; ctx.fillStyle = C.cream;
  ctx.fillText(`— ${content.from} —`, W / 2, ppy + ph + 90);
  if (s.line) { fit(ctx, s.line, 'italic 600', 46, F.serif, W - 200); ctx.fillStyle = C.gold; ctx.fillText(s.line, W / 2, H - 120); }
  sparkle(ctx, 170, 470, 26, '#ffe3a3'); sparkle(ctx, 910, 520, 20, '#fff6dc'); sparkle(ctx, 900, 1660, 30, '#ffe3a3'); sparkle(ctx, 170, 1620, 18, '#fff6dc');
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
