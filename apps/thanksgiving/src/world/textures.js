import * as THREE from 'three';

// Painted textures for the farmhouse (drawn once in a canvas at load): plank floors, plaster, wainscot,
// the sofa's plaid, the dusk outside the windows, the rug, soft glows and shadows.

export const FONTS = {
  title: "'Playfair Display', Georgia, serif",
  script: "'Great Vibes', 'Playfair Display', cursive",
  hand: "'Caveat', 'Nunito', cursive",
  ui: "'Nunito', system-ui, sans-serif",
};

export function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
export function tex(c, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const rnd = (() => { let s = 1126; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

/** Honey-coloured plank floor (one 2 × 2 m tile: boards 0.2 m wide, staggered ends). */
export function planks() {
  const [c, x] = canvas(1024, 1024);
  const boards = 10, bw = 1024 / boards;
  for (let i = 0; i < boards; i++) {
    let y = -rnd() * 400;
    while (y < 1024) {
      const len = 300 + rnd() * 500, l = 0.5 + rnd() * 0.1;
      const g = x.createLinearGradient(i * bw, 0, (i + 1) * bw, 0);
      const base = `hsl(${28 + rnd() * 6}, ${46 + rnd() * 10}%, ${l * 100 - 12}%)`;
      g.addColorStop(0, base); g.addColorStop(1, `hsl(${27 + rnd() * 6}, 48%, ${l * 100 - 16}%)`);
      x.fillStyle = g; x.fillRect(i * bw, y, bw, len);
      x.strokeStyle = 'rgba(60,30,15,0.18)'; x.lineWidth = 1.2;
      for (let k = 0; k < 5; k++) { const gx = i * bw + 6 + rnd() * (bw - 12); x.beginPath(); x.moveTo(gx, y); x.bezierCurveTo(gx + 6, y + len * 0.3, gx - 6, y + len * 0.6, gx + 2, y + len); x.stroke(); }
      x.fillStyle = 'rgba(40,20,10,0.55)'; x.fillRect(i * bw, y, bw, 3);
      y += len;
    }
    x.fillStyle = 'rgba(40,20,10,0.5)'; x.fillRect(i * bw, 0, 3, 1024);
  }
  return tex(c, { repeat: [1, 1] });
}

/** Warm cream plaster with a soft mottle. */
export function plaster() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#F6EBD8'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) {
    const r = 20 + rnd() * 60, px = rnd() * 512, py = rnd() * 512;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, rnd() > 0.5 ? 'rgba(255,252,245,0.1)' : 'rgba(225,200,165,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  return tex(c, { repeat: [1, 1] });
}

/** Board-and-batten wainscot: warm brown boards with a cap rail line. */
export function wainscot() {
  const [c, x] = canvas(512, 256);
  x.fillStyle = '#8A5A3B'; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 8; i++) {
    const g = x.createLinearGradient(i * 64, 0, i * 64 + 64, 0);
    g.addColorStop(0, '#94633F'); g.addColorStop(0.5, '#8D5D3B'); g.addColorStop(1, '#7E5034');
    x.fillStyle = g; x.fillRect(i * 64 + 4, 18, 56, 238);
    x.fillStyle = 'rgba(40,20,10,0.35)'; x.fillRect(i * 64, 18, 4, 238);
  }
  x.fillStyle = '#6E473B'; x.fillRect(0, 0, 512, 18);
  x.fillStyle = 'rgba(255,230,190,0.25)'; x.fillRect(0, 2, 512, 3);
  return tex(c, { repeat: [1, 1] });
}

/** A cosy red-and-gold plaid (for the sofa). */
export function plaid() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#A33A2B'; x.fillRect(0, 0, 256, 256);
  const band = (pos, w, col, vertical) => { x.fillStyle = col; if (vertical) x.fillRect(pos, 0, w, 256); else x.fillRect(0, pos, 256, w); };
  for (const v of [false, true]) {
    band(40, 46, 'rgba(60,18,14,0.45)', v); band(150, 46, 'rgba(60,18,14,0.45)', v);
    band(110, 8, 'rgba(227,168,87,0.85)', v); band(214, 6, 'rgba(253,251,247,0.55)', v);
    band(10, 4, 'rgba(30,10,8,0.5)', v);
  }
  return tex(c, { repeat: [2, 2] });
}

/** The view out of the windows: an autumn dusk — apricot sky, violet clouds, trees in flame colours, a barn. */
export function duskView(seed = 0) {
  const [c, x] = canvas(512, 640);
  const g = x.createLinearGradient(0, 0, 0, 640);
  g.addColorStop(0, '#5E4A7E'); g.addColorStop(0.35, '#C9727A'); g.addColorStop(0.62, '#F2A65A'); g.addColorStop(0.75, '#F8C77E'); g.addColorStop(1, '#7A5A3A');
  x.fillStyle = g; x.fillRect(0, 0, 512, 640);
  x.fillStyle = 'rgba(255,240,210,0.9)'; x.beginPath(); x.arc(150 + seed * 90, 390, 26, 0, Math.PI * 2); x.fill();
  for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(110,70,120,0.35)'; x.beginPath(); x.ellipse(rnd() * 512, 80 + rnd() * 200, 90 + rnd() * 80, 14 + rnd() * 10, 0, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#6B4A3A'; x.beginPath(); x.moveTo(0, 470); for (let k = 0; k <= 512; k += 32) x.lineTo(k, 455 + Math.sin(k * 0.02 + seed) * 18); x.lineTo(512, 640); x.lineTo(0, 640); x.fill();
  if (seed % 2 === 0) { x.fillStyle = '#8E2E22'; x.fillRect(330, 395, 90, 70); x.beginPath(); x.moveTo(320, 398); x.lineTo(375, 350); x.lineTo(430, 398); x.fill(); x.fillStyle = '#F4E8D4'; x.fillRect(362, 425, 26, 40); }
  const cols = ['#C2361F', '#D96A1E', '#E0A830', '#B5523A', '#8A3B22'];
  for (let i = 0; i < 9; i++) {
    const tx = rnd() * 512, ty = 470 + rnd() * 40, s = 30 + rnd() * 40;
    x.fillStyle = '#4A3226'; x.fillRect(tx - 3, ty - s * 0.4, 6, s * 0.9);
    x.fillStyle = cols[i % 5];
    for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(tx + (rnd() - 0.5) * s, ty - s * 0.6 - rnd() * s * 0.6, s * 0.38, 0, Math.PI * 2); x.fill(); }
  }
  return tex(c);
}

/** A braided rag rug: concentric rings in harvest colours. */
export function rug() {
  const [c, x] = canvas(512, 512);
  const cols = ['#CC5500', '#E3A857', '#990000', '#6E473B', '#F2E6D0', '#8FA58A'];
  for (let r = 250, i = 0; r > 4; r -= 13, i++) {
    x.fillStyle = cols[i % cols.length]; x.beginPath(); x.arc(256, 256, r, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(40,20,10,0.25)'; x.lineWidth = 2; x.setLineDash([6, 5]); x.beginPath(); x.arc(256, 256, r - 6, 0, Math.PI * 2); x.stroke();
  }
  return tex(c);
}

/** A soft round glow (candles, lamps, string lights). */
export function glowTexture(size = 128, inner = 'rgba(255,230,180,1)') {
  const [c, x] = canvas(size, size);
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(0.25, 'rgba(255,190,110,0.55)'); g.addColorStop(1, 'rgba(255,160,80,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return tex(c);
}

/** A soft dark blot for contact shadows under people and things. */
export function blobTexture() {
  const [c, x] = canvas(128, 128);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(40,20,10,0.55)'); g.addColorStop(0.55, 'rgba(40,20,10,0.25)'); g.addColorStop(1, 'rgba(40,20,10,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return tex(c);
}

/** Lawn scattered with fallen leaves (outside the house). */
export function lawn() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#6E7A3A'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${90 + rnd() * 40},${110 + rnd() * 30},${40 + rnd() * 20},0.5)`; x.fillRect(rnd() * 512, rnd() * 512, 2, 6); }
  const cols = ['#C2361F', '#D96A1E', '#E0A830', '#B5523A'];
  for (let i = 0; i < 220; i++) { x.fillStyle = cols[i % 4]; x.save(); x.translate(rnd() * 512, rnd() * 512); x.rotate(rnd() * 6); x.beginPath(); x.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
  return tex(c, { repeat: [10, 10] });
}

/** The evening sky, as a big gradient dome texture. */
export function skyTexture() {
  const [c, x] = canvas(16, 512);
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#2E2448'); g.addColorStop(0.35, '#6E4A7A'); g.addColorStop(0.5, '#D9826A'); g.addColorStop(0.56, '#F6B26B'); g.addColorStop(0.62, '#FBD49A'); g.addColorStop(1, '#3A2A2A');
  x.fillStyle = g; x.fillRect(0, 0, 16, 512);
  return tex(c);
}

/** Word-wrap helper for canvas text. */
export function wrapText(ctx, text, maxW) {
  const words = String(text).split(/\s+/), lines = [];
  let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}

export function fitFont(ctx, text, weight, size, family, maxW, min = 14) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > min && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}

/** "Thursday, November 26" from 2026-11-26. */
export function longDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
