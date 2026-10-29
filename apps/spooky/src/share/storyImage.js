// "Save image": the spirit photograph as a phone-story picture (1080×1920 PNG), drawn in the browser as a cute
// haunted poster: a staged render of the night as the backdrop (the carved name-pumpkin, the photo tree, the bat
// heart round the moon, witches, zombies and ghosts), a dripping title, the sepia photo (with its uninvited
// guest) as an old taped-up polaroid, sweets and twinkles, the logo on top and a short line at the bottom.
// Phones get the share sheet; others a download.
import { enDate } from '../util/textures.js';

const W = 1080, H = 1920;
const C = { pumpkin: '#ff9a2e', gold: '#e8c370', cream: '#f4eee2', green: '#9dff7a' };
const F = { drip: "'Rubik Wet Paint', 'Rubik', sans-serif", body: "'Rubik', sans-serif", ink: "'Bad Script', 'Caveat', cursive", carve: "'Yeseva One', serif" };

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

/** The backdrop: the render (cover-fitted), a touch of purple, soft dark at the very top and bottom, grain. */
function backdrop(ctx, bg) {
  if (bg) {
    const iw = bg.width || bg.naturalWidth, ih = bg.height || bg.naturalHeight, k = Math.max(W / iw, H / ih);
    ctx.drawImage(bg, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#120c1c'); g.addColorStop(0.6, '#3a2252'); g.addColorStop(1, '#141a16');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(120,60,200,0.35)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
  const t = ctx.createLinearGradient(0, 0, 0, H);
  t.addColorStop(0, 'rgba(14,8,24,0.78)'); t.addColorStop(0.2, 'rgba(14,8,24,0)'); t.addColorStop(0.8, 'rgba(14,8,24,0)'); t.addColorStop(1, 'rgba(14,8,24,0.85)');
  ctx.fillStyle = t; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H * 0.48, W * 0.42, W / 2, H * 0.48, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,0,20,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (let q = 0; q < d.length; q += 4) { const n = (Math.random() - 0.5) * 12; d[q] += n; d[q + 1] += n; d[q + 2] += n; }
  ctx.putImageData(img, 0, 0);
}

function bat(ctx, x, y, s, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-12, -14, -30, -6); ctx.quadraticCurveTo(-22, 0, -24, 8); ctx.quadraticCurveTo(-14, 2, -8, 10); ctx.quadraticCurveTo(-4, 4, 0, 8);
  ctx.quadraticCurveTo(4, 4, 8, 10); ctx.quadraticCurveTo(14, 2, 24, 8); ctx.quadraticCurveTo(22, 0, 30, -6); ctx.quadraticCurveTo(12, -14, 0, 0); ctx.fill();
  ctx.restore();
}

function cobweb(ctx, x, y, r, flipX) {
  ctx.save(); ctx.translate(x, y); ctx.scale(flipX ? -1 : 1, 1);
  ctx.strokeStyle = 'rgba(235,230,250,0.5)'; ctx.lineWidth = 2;
  for (let k = 0; k < 8; k++) { const a = (k / 7) * Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
  for (let ring = 1; ring <= 6; ring++) {
    const rr = ring * r / 6.5; ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 7) * Math.PI / 2;
      if (!k) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else { const am = ((k - 0.5) / 7) * Math.PI / 2; ctx.quadraticCurveTo(Math.cos(am) * rr * 0.86, Math.sin(am) * rr * 0.86, Math.cos(a) * rr, Math.sin(a) * rr); }
    }
    ctx.stroke();
  }
  // a little spider dangling from it
  ctx.beginPath(); ctx.moveTo(r * 0.55, r * 0.2); ctx.lineTo(r * 0.55, r * 0.62); ctx.stroke();
  ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.arc(r * 0.55, r * 0.66, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 0.55 + s * 4, r * 0.65, 2.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

/** Bats flying in the shape of a heart round (mx, my); R is the heart's half-width. */
function batHeart(ctx, mx, my, R) {
  ctx.save();
  ctx.fillStyle = 'rgba(16,8,24,0.95)';
  const n = 26;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    bat(ctx, mx + (x / 16) * R, my - (y / 16) * R - R * 0.1, 0.62 + 0.25 * Math.sin(i * 1.7) ** 2, Math.sin(i * 2.3) * 0.3);
  }
  ctx.restore();
}

/** A cartoon lightning bolt from the top edge, with a glow and a little fork. */
function lightningBolt(ctx, x0, y0, len, dir = 1) {
  const pts = [[x0, y0]];
  let x = x0, y = y0;
  for (let k = 0; k < 7; k++) { x += dir * (k % 2 ? -26 : 42) + (Math.random() - 0.5) * 14; y += len / 7; pts.push([x, y]); }
  const path = (p) => { ctx.beginPath(); p.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); };
  ctx.save();
  ctx.lineJoin = 'miter'; ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(190,200,255,0.95)'; ctx.shadowBlur = 40;
  ctx.strokeStyle = 'rgba(200,210,255,0.55)'; ctx.lineWidth = 22; path(pts); ctx.stroke();
  ctx.shadowBlur = 16; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; path(pts); ctx.stroke();
  const [fx, fy] = pts[3];
  const fork = [[fx, fy], [fx + dir * 50, fy + 50], [fx + dir * 34, fy + 70], [fx + dir * 70, fy + 120]];
  ctx.lineWidth = 5; path(fork); ctx.stroke();
  ctx.restore();
}

/** A four-pointed twinkle. */
function twinkle(ctx, x, y, r, color) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = r * 1.5;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, rr = k % 2 ? r * 0.28 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

/** A wrapped sweet. */
function candy(ctx, x, y, s, rot, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = color; ctx.strokeStyle = 'rgba(20,10,30,0.8)'; ctx.lineWidth = 3;
  for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 26, 0); ctx.lineTo(d * 48, -16); ctx.lineTo(d * 44, 0); ctx.lineTo(d * 48, 16); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(0, 0, 30, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 5;
  for (const o of [-12, 4]) { ctx.beginPath(); ctx.moveTo(o, -18); ctx.lineTo(o + 10, 18); ctx.stroke(); }
  ctx.restore();
}

/** A piece of candy corn. */
function candyCorn(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const band = (y0, y1, c) => { ctx.save(); ctx.beginPath(); ctx.moveTo(0, -40); ctx.quadraticCurveTo(30, 20, 26, 34); ctx.quadraticCurveTo(0, 42, -26, 34); ctx.quadraticCurveTo(-30, 20, 0, -40); ctx.clip(); ctx.fillStyle = c; ctx.fillRect(-40, y0, 80, y1 - y0); ctx.restore(); };
  band(-45, -12, '#fff4e0'); band(-12, 14, '#ff9a2e'); band(14, 50, '#ffd23f');
  ctx.strokeStyle = 'rgba(20,10,30,0.8)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -40); ctx.quadraticCurveTo(30, 20, 26, 34); ctx.quadraticCurveTo(0, 42, -26, 34); ctx.quadraticCurveTo(-30, 20, 0, -40); ctx.stroke();
  ctx.restore();
}

/** The photo, sepia-toned with a little colour left in, vignetted (as the frame in the scene shows it). */
function sepia(photo, side) {
  const c = document.createElement('canvas'); c.width = c.height = side;
  const x = c.getContext('2d');
  const iw = photo.width || photo.naturalWidth, ih = photo.height || photo.naturalHeight, sq = Math.min(iw, ih);
  x.filter = 'sepia(0.72) contrast(1.08) brightness(1.04)';
  x.drawImage(photo, (iw - sq) / 2, (ih - sq) / 2, sq, sq, 0, 0, side, side);
  x.filter = 'none';
  const v = x.createRadialGradient(side / 2, side / 2, side * 0.3, side / 2, side / 2, side * 0.75);
  v.addColorStop(0, 'rgba(60,30,10,0)'); v.addColorStop(1, 'rgba(60,30,10,0.55)');
  x.fillStyle = v; x.fillRect(0, 0, side, side);
  for (let k = 0; k < 30; k++) { x.strokeStyle = `rgba(255,240,210,${0.04 + Math.random() * 0.08})`; x.lineWidth = 1; const px = Math.random() * side; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (Math.random() - 0.5) * 20, side); x.stroke(); }
  return c;
}

/**
 * Draw the story picture. photo: the square spirit photograph; bg: the staged portrait render (pumpkin, tree,
 * moon and bats, witches, zombies, ghosts). Returns a canvas.
 */
export async function drawStoryImage({ photo, bg = null, content, base = '' }) {
  const s = content.share || {};
  const date = new Date(`${content.date.iso}T12:00:00`);
  const title = content.finale?.title || 'Happy Halloween';
  const texts = [s.brand, s.line, title, content.name, content.from, enDate(date), 'Ghost photo'].filter(Boolean).join(' ');
  await Promise.all([`400 100px ${F.drip}`, `500 40px ${F.body}`, `400 60px ${F.ink}`, `400 60px ${F.carve}`].map((f) => document.fonts.load(f, texts).catch(() => {})));
  await document.fonts.ready;
  const logo = s.logo ? await loadImage(`${base}${s.logo}`).catch(() => null) : null;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  backdrop(ctx, bg);
  // the drama in the sky: a bolt of lightning, and the bats gathered into a heart round the moon
  const moon = bg?.moon || { x: 0.7, y: 0.36, r: 0.085 };
  lightningBolt(ctx, W * 0.86, 0, H * 0.3, -1);
  batHeart(ctx, moon.x * W, moon.y * H, Math.max(150, moon.r * W * 2.1));
  cobweb(ctx, 0, 0, 250, false);
  cobweb(ctx, W, 0, 190, true);
  // twinkles and a few extra bats in the sky
  for (const [x, y, r, c] of [[150, 520, 16, '#fff3c4'], [930, 470, 12, '#d6b8ff'], [880, 640, 9, '#9dff7a'], [90, 760, 10, '#ffb36b'], [560, 455, 8, '#fff3c4'], [1010, 860, 11, '#ffd27a'], [300, 640, 7, '#d6b8ff']]) twinkle(ctx, x, y, r, c);
  ctx.fillStyle = 'rgba(16,8,24,0.92)';
  for (const [x, y, sc, r] of [[120, 470, 1.2, -0.2], [230, 560, 0.7, 0.15]]) bat(ctx, x, y, sc, r);
  if (logo && logo.height) { const lh = 62, lw = (logo.width / logo.height) * lh; ctx.drawImage(logo, (W - lw) / 2, 78, lw, lh); }
  else if (s.brand) { ctx.textAlign = 'center'; ctx.fillStyle = C.cream; fit(ctx, s.brand, 500, 40, F.body, W - 200); ctx.fillText(s.brand, W / 2, 120); }

  // the dripping title in glowing pumpkin orange, the name under it in toxic green
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const ts = fit(ctx, title, 400, 128, F.drip, W - 120);
  const tg = ctx.createLinearGradient(0, 290 - ts, 0, 290);
  tg.addColorStop(0, '#ffd27a'); tg.addColorStop(1, '#ff7a1a');
  ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(30,10,40,0.9)'; ctx.strokeText(title, W / 2, 290);
  ctx.shadowColor = 'rgba(255,120,30,0.7)'; ctx.shadowBlur = 40;
  ctx.fillStyle = tg; ctx.fillText(title, W / 2, 290);
  ctx.shadowBlur = 0;
  fit(ctx, content.name, 400, 104, F.drip, W - 200);
  ctx.lineWidth = 10; ctx.strokeText(content.name, W / 2, 405);
  ctx.fillStyle = C.green; ctx.shadowColor = 'rgba(120,255,100,0.6)'; ctx.shadowBlur = 30;
  ctx.fillText(content.name, W / 2, 405);
  ctx.shadowBlur = 0;

  // the spirit photograph, as an old polaroid taped up on the right, a little crooked
  const side = 330, pw = side + 40, ph = side + 126, cx = 828, cy = 1485;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(0.08);
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#efe6d2'; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const pg = ctx.createLinearGradient(0, -ph / 2, 0, ph / 2);
  pg.addColorStop(0, 'rgba(255,255,255,0.18)'); pg.addColorStop(1, 'rgba(120,90,50,0.22)');
  ctx.fillStyle = pg; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
  ctx.drawImage(sepia(photo, side), -side / 2, -ph / 2 + 22, side, side);
  // purple washi tape across the top
  ctx.save(); ctx.rotate(-0.06); ctx.fillStyle = 'rgba(150,90,220,0.72)'; ctx.fillRect(-80, -ph / 2 - 22, 160, 46);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.strokeRect(-80, -ph / 2 - 22, 160, 46); ctx.restore();
  ctx.fillStyle = '#3a2440'; ctx.textAlign = 'center';
  const names = `${content.name} & ${content.from}`, sub = `Ghost photo · ${enDate(date)}`;
  fit(ctx, names, 400, 50, F.ink, pw - 50); ctx.fillText(names, 0, ph / 2 - 62);
  ctx.fillStyle = '#6a4a5a'; fit(ctx, sub, 400, 22, F.carve, pw - 50); ctx.fillText(sub, 0, ph / 2 - 24);
  ctx.restore();
  twinkle(ctx, cx - pw / 2 + 4, cy - ph / 2 + 30, 18, '#fff3c4');
  twinkle(ctx, cx + pw / 2 - 10, cy + ph / 2 - 10, 13, '#9dff7a');

  // sweets spilled at the bottom corners
  candy(ctx, 110, H - 250, 1.1, -0.4, '#ff7a1a');
  candy(ctx, 240, H - 200, 0.8, 0.5, '#9b4dff');
  candyCorn(ctx, 70, H - 160, 0.9, 0.3);
  candy(ctx, W - 90, H - 330, 0.8, 0.35, '#62ff4e');

  if (s.line) {
    ctx.textAlign = 'center';
    fit(ctx, s.line, 400, 56, F.ink, W - 200);
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(20,8,30,0.85)'; ctx.strokeText(s.line, W / 2, H - 120);
    ctx.fillStyle = C.pumpkin; ctx.fillText(s.line, W / 2, H - 120);
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
