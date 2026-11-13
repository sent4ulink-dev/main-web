// "Save the picture": the family photo as a phone-story picture (1080×1920 PNG), drawn in the browser as a
// warm autumn poster — the logo on top, "Happy Thanksgiving" and the family's name, the photo as a taped-up
// polaroid, falling leaves, how many of us there were and when, and a short line at the bottom.
// Phones get the share sheet; others a download.
import { longDate } from '../world/textures.js';

const W = 1080, H = 1920;
const F = { title: "'Playfair Display', Georgia, serif", script: "'Great Vibes', 'Playfair Display', cursive", hand: "'Caveat', 'Nunito', cursive", ui: "'Nunito', system-ui, sans-serif" };

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img); img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
}
function fit(ctx, text, weight, size, family, maxW) {
  let s = size; ctx.font = `${weight} ${s}px ${family}`;
  while (s > 18 && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}

function leaf(ctx, x, y, s, rot, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2, r = 30 * (0.6 + 0.4 * Math.abs(Math.sin(a * 2.5)) ** 0.7) * (Math.sin(a) < -0.85 ? 0.55 : 1);
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,30,10,0.35)'; ctx.lineWidth = 2 / s; ctx.beginPath(); ctx.moveTo(0, 28); ctx.lineTo(0, -16); ctx.stroke();
  ctx.restore();
}

function backdrop(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3A2418'); g.addColorStop(0.35, '#7A3A1E'); g.addColorStop(0.7, '#B5521E'); g.addColorStop(1, '#4A2416');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.48, 80, W / 2, H * 0.48, H * 0.6);
  glow.addColorStop(0, 'rgba(255,200,120,0.35)'); glow.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const cols = ['#C2361F', '#D96A1E', '#E0A830', '#B5523A', '#E07A1F', '#990000'];
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 46; i++) {
    const x = r() * W, y = r() * H;
    if (y > 420 && y < 1500 && x > 110 && x < 970) continue;   // keep the photo's area clear
    ctx.globalAlpha = 0.55 + r() * 0.45;
    leaf(ctx, x, y, 0.8 + r() * 1.4, r() * 6.28, cols[i % cols.length]);
  }
  ctx.globalAlpha = 1;
  // a little grain
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (let q = 0; q < d.length; q += 4) { const n = (Math.random() - 0.5) * 10; d[q] += n; d[q + 1] += n; d[q + 2] += n; }
  ctx.putImageData(img, 0, 0);
}

function tape(ctx, x, y, w, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(227,168,87,0.85)'; ctx.fillRect(-w / 2, -22, w, 44);
  ctx.fillStyle = 'rgba(204,85,0,0.55)';
  for (let i = -w / 2; i < w / 2; i += 16) { ctx.fillRect(i, -22, 8, 44); }
  for (let j = -22; j < 22; j += 16) { ctx.fillRect(-w / 2, j, w, 8); }
  ctx.restore();
}

export async function drawStoryImage({ photo, content, people = 0, base = '' }) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  backdrop(ctx);
  try { const logo = await loadImage(`${base}${content.share.logo}`); const lw = 300, lh = lw * (logo.height / logo.width); ctx.drawImage(logo, (W - lw) / 2, 70, lw, lh); } catch { /* no logo */ }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(30,12,4,0.6)'; ctx.shadowBlur = 18;
  ctx.fillStyle = '#FFE8C2';
  fit(ctx, 'Happy Thanksgiving', '700', 96, F.title, 960);
  ctx.fillText('Happy Thanksgiving', W / 2, 300);
  ctx.fillStyle = '#FFC98A';
  fit(ctx, content.family, '400', 120, F.script, 940);
  ctx.fillText(content.family, W / 2, 420);
  ctx.shadowBlur = 0;
  // the photo as a polaroid
  const pw = photo.width, ph = photo.height, landscape = pw >= ph;
  const iw = landscape ? 860 : 700, ih = iw * (ph / pw);
  const fw = iw + 60, fh = ih + 190, fx = W / 2, fy = 480 + fh / 2 + 10;
  ctx.save(); ctx.translate(fx, fy); ctx.rotate(-0.025);
  ctx.shadowColor = 'rgba(20,8,2,0.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#FBF6EC'; ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
  ctx.shadowColor = 'transparent';
  ctx.drawImage(photo, -iw / 2, -fh / 2 + 30, iw, ih);
  ctx.fillStyle = '#6E473B'; ctx.textAlign = 'center';
  const cap = people > 1 ? `${people} of us around one table` : 'Around one table';
  fit(ctx, cap, '700', 64, F.hand, fw - 80);
  ctx.fillText(cap, 0, fh / 2 - 92);
  ctx.fillStyle = '#CC5500'; ctx.font = `800 34px ${F.ui}`;
  ctx.fillText(longDate(content.date.iso), 0, fh / 2 - 40);
  ctx.restore();
  tape(ctx, fx - fw / 2 + 60, fy - fh / 2 + 6, 190, -0.5);
  tape(ctx, fx + fw / 2 - 60, fy - fh / 2 + 6, 190, 0.5);
  // the line at the bottom
  ctx.textAlign = 'center'; ctx.fillStyle = '#FFE8C2'; ctx.shadowColor = 'rgba(30,12,4,0.6)'; ctx.shadowBlur = 14;
  const line = content.share.line;
  fit(ctx, line, '700', 62, F.hand, 940);
  ctx.fillText(line, W / 2, Math.min(H - 150, fy + fh / 2 + 150));
  ctx.shadowBlur = 0;
  return c;
}

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
