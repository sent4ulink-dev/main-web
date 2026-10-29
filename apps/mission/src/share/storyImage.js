// "Save image": the last shot as a phone-story picture (1080×1920 PNG), drawn in the browser, game-poster style:
// a real render of the courtyard at dusk (fireworks, the name on the wall) as the backdrop, and on it a weathered
// wooden board — a steel "★ MVP ★" plate, the photo taped on, the name stencilled — with a typed tag for the day
// and who it is from, the logo on top and a short line at the bottom. Phones get the share sheet; others a download.
import { enDate } from '../util/textures.js';
import { drawPlanks, drawPlate } from '../objects/mvp.js';

const W = 1080, H = 1920;
const C = { gold: '#ffcf5e', cream: '#f6f1e4' };
const F = { stencil: "'Black Ops One', sans-serif", hud: "'Oswald', sans-serif", body: "'Rubik', sans-serif", type: "'Lumios Typewriter Old', 'Cousine', monospace" };

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
}

function fit(ctx, text, weight, size, family, maxW) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 18 && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}

/** The backdrop: the render (cover-fitted), graded warm-cool, darkened top and bottom, film grain. */
function backdrop(ctx, bg) {
  if (bg) {
    const iw = bg.width || bg.naturalWidth, ih = bg.height || bg.naturalHeight, k = Math.max(W / iw, H / ih);
    ctx.drawImage(bg, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b2244'); g.addColorStop(0.55, '#8a4a3a'); g.addColorStop(1, '#2a1d14');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const t = ctx.createLinearGradient(0, 0, 0, H);
  t.addColorStop(0, 'rgba(8,6,14,0.75)'); t.addColorStop(0.18, 'rgba(8,6,14,0.15)'); t.addColorStop(0.75, 'rgba(8,6,14,0.25)'); t.addColorStop(1, 'rgba(8,6,14,0.85)');
  ctx.fillStyle = t; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, H * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (let q = 0; q < d.length; q += 4) { const n = (Math.random() - 0.5) * 14; d[q] += n; d[q + 1] += n; d[q + 2] += n; }
  ctx.putImageData(img, 0, 0);
}

/**
 * Draw the story picture. photo: the square last shot; bg: a portrait render of the courtyard. Returns a canvas.
 */
export async function drawStoryImage({ photo, bg = null, content, base = '' }) {
  const s = content.share || {};
  const date = new Date(`${content.date.iso}T12:00:00`);
  const texts = [s.brand, s.line, content.name, content.from, enDate(date), 'HAPPY BIRTHDAY'].filter(Boolean).join(' ');
  await Promise.all([`400 100px ${F.stencil}`, `700 100px ${F.hud}`, `500 40px ${F.hud}`, `500 40px ${F.body}`, `800 100px ${F.body}`, `700 40px ${F.type}`].map((f) => document.fonts.load(f, texts).catch(() => {})));
  await document.fonts.ready;
  const logo = s.logo ? await loadImage(`${base}${s.logo}`).catch(() => null) : null;

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  backdrop(ctx, bg);
  ctx.textAlign = 'center';

  // logo and the greeting up top
  if (logo && logo.height) { const lh = 62, lw = (logo.width / logo.height) * lh; ctx.drawImage(logo, (W - lw) / 2, 78, lw, lh); }
  else { fit(ctx, s.brand || '', 700, 44, F.hud, W - 200); ctx.fillStyle = C.cream; ctx.fillText(s.brand || '', W / 2, 122); }
  ctx.font = `600 54px ${F.hud}`; ctx.fillStyle = C.cream;
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 18;
  ctx.fillText('HAPPY BIRTHDAY', W / 2, 226);
  ctx.shadowBlur = 0;

  // the board, hanging a touch askew
  const bw = 880, bh = 1240, bx = (W - bw) / 2, by = 300;
  ctx.save();
  ctx.translate(W / 2, by + bh / 2); ctx.rotate(-0.012); ctx.translate(-W / 2, -(by + bh / 2));
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26;
  ctx.fillStyle = '#5a3a1e'; ctx.fillRect(bx, by, bw, bh);
  ctx.shadowColor = 'transparent';
  drawPlanks(ctx, bx, by, bw, bh, 9);
  drawPlate(ctx, W / 2, by + 112, 520, 140);
  // the photo, on a white border, taped at the corners
  const side = 700, px = (W - side) / 2, py = by + 220;
  ctx.save(); ctx.translate(W / 2, py + side / 2); ctx.rotate(0.018); ctx.translate(-W / 2, -(py + side / 2));
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#f1ead6'; ctx.fillRect(px - 22, py - 22, side + 44, side + 44);
  ctx.shadowColor = 'transparent';
  const iw = photo.width || photo.naturalWidth, ih = photo.height || photo.naturalHeight, sq = Math.min(iw, ih);
  ctx.drawImage(photo, (iw - sq) / 2, (ih - sq) / 2, sq, sq, px, py, side, side);
  ctx.fillStyle = 'rgba(232,220,178,0.82)';
  for (const [x, y, r] of [[px, py, -0.7], [px + side, py, 0.7], [px, py + side, 0.7], [px + side, py + side, -0.7]]) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.fillRect(-70, -18, 140, 36); ctx.restore();
  }
  ctx.restore();
  // the name, stencilled on the planks
  const nm = content.name.toUpperCase();
  fit(ctx, nm, 800, 128, F.body, bw - 120);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillText(nm, W / 2 + 4, by + 1030 + 5);
  ctx.fillStyle = '#f4efe2'; ctx.fillText(nm, W / 2, by + 1030);
  // a typed tag, pinned: the day and who it is from
  ctx.save(); ctx.translate(W / 2, by + 1150); ctx.rotate(0.02);
  ctx.fillStyle = '#ece2c6'; ctx.fillRect(-300, -46, 600, 92);
  ctx.strokeStyle = 'rgba(80,60,30,0.4)'; ctx.lineWidth = 2; ctx.strokeRect(-290, -36, 580, 72);
  ctx.fillStyle = '#c0302a'; ctx.beginPath(); ctx.arc(0, -46, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1f1b16'; fit(ctx, `${enDate(date)}  ·  ${content.from}`, 700, 34, F.type, 540);
  ctx.fillText(`${enDate(date)}  ·  ${content.from}`, 0, 4);
  ctx.restore();
  ctx.restore();
  ctx.textBaseline = 'alphabetic';

  if (s.line) {
    fit(ctx, s.line, 500, 44, F.body, W - 160);
    ctx.fillStyle = C.gold; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 14;
    ctx.fillText(s.line, W / 2, H - 150);
    ctx.shadowBlur = 0;
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
