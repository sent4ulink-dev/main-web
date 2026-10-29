import * as THREE from 'three';

// Painted (canvas) textures for the salon: parquet, panelled walls, ceiling medallion, the rug,
// brass plaques, sheet music and the quill's parchment. All original, drawn at load.

export const SERIF = "'Cormorant Garamond', Georgia, serif";
export const SCRIPT = "'Bad Script', 'Cormorant Garamond', cursive";

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function toTexture(c, { repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

/** Versailles-style basket parquet: 0.5 m squares of five planks, alternating direction (2 m × 2 m). */
export function parquetTexture() {
  const S = 1024, [c, x] = canvas(S, S), cell = S / 4, n = 5;
  const tones = ['#9a5f33', '#a8693a', '#8c5530', '#b0743f', '#94592f'];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const horiz = (i + j) % 2 === 0;
    for (let k = 0; k < n; k++) {
      x.fillStyle = tones[Math.floor(rand() * tones.length)];
      const w = cell / n;
      if (horiz) x.fillRect(i * cell, j * cell + k * w, cell, w); else x.fillRect(i * cell + k * w, j * cell, w, cell);
      // grain streaks
      x.globalAlpha = 0.08; x.fillStyle = '#3b200e';
      for (let g = 0; g < 4; g++) {
        const o = rand() * w;
        if (horiz) x.fillRect(i * cell, j * cell + k * w + o, cell, 1.2); else x.fillRect(i * cell + k * w + o, j * cell, 1.2, cell);
      }
      x.globalAlpha = 1;
      x.strokeStyle = 'rgba(40,20,8,0.55)'; x.lineWidth = 1.4;
      if (horiz) x.strokeRect(i * cell, j * cell + k * w, cell, w); else x.strokeRect(i * cell + k * w, j * cell, w, cell);
    }
    x.strokeStyle = 'rgba(30,14,5,0.8)'; x.lineWidth = 2.5; x.strokeRect(i * cell, j * cell, cell, cell);
  }
  return toTexture(c, { repeat: true, aniso: 16 });
}

/** One bay of panelled wall, 2 m wide × 5.2 m high: dado, chair rail, a tall gilded panel with faint damask. */
export function wallTexture() {
  const W = 512, H = 1332, [c, x] = canvas(W, H), m = H / 5.2;   // px per metre
  const Y = (metres) => H - metres * m;
  x.fillStyle = '#f2e4d0'; x.fillRect(0, 0, W, H);
  // faint damask inside the upper panel
  x.save();
  x.beginPath(); x.rect(0.3 * m, Y(4.55), W - 0.6 * m, (4.55 - 1.25) * m); x.clip();
  x.fillStyle = '#ecd5c3';
  for (let yy = Y(4.55); yy < Y(1.25); yy += 70) for (let xx = 0.3 * m + ((yy / 70) % 2 ? 35 : 0); xx < W; xx += 70) {
    x.beginPath(); x.ellipse(xx, yy, 9, 15, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(xx - 11, yy + 8, 6, 9, -0.6, 0, Math.PI * 2); x.ellipse(xx + 11, yy + 8, 6, 9, 0.6, 0, Math.PI * 2); x.fill();
  }
  x.restore();
  // dado
  x.fillStyle = '#e9d6bd'; x.fillRect(0, Y(0.95), W, 0.95 * m);
  const frame = (x0, y0, x1, y1, lw = 6) => {
    x.strokeStyle = 'rgba(120,80,40,0.35)'; x.lineWidth = lw + 4; x.strokeRect(x0 + 2, y0 + 2, x1 - x0, y1 - y0);
    x.strokeStyle = '#c9a04a'; x.lineWidth = lw; x.strokeRect(x0, y0, x1 - x0, y1 - y0);
    x.strokeStyle = '#f6dc8c'; x.lineWidth = 1.5; x.strokeRect(x0 - 1, y0 - 1, x1 - x0, y1 - y0);
  };
  frame(0.25 * m, Y(0.78), W - 0.25 * m, Y(0.2), 5);
  frame(0.3 * m, Y(4.55), W - 0.3 * m, Y(1.25), 7);
  frame(0.4 * m, Y(4.45), W - 0.4 * m, Y(1.35), 3);
  // rosettes in the corners of the big panel and a garland bow at the top
  x.fillStyle = '#d4ab55';
  for (const [px, py] of [[0.3 * m, Y(4.55)], [W - 0.3 * m, Y(4.55)], [0.3 * m, Y(1.25)], [W - 0.3 * m, Y(1.25)]]) { x.beginPath(); x.arc(px, py, 11, 0, Math.PI * 2); x.fill(); }
  x.strokeStyle = '#c9a04a'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(W / 2 - 60, Y(4.38)); x.quadraticCurveTo(W / 2, Y(4.22), W / 2 + 60, Y(4.38)); x.stroke();
  x.beginPath(); x.arc(W / 2, Y(4.4), 10, 0, Math.PI * 2); x.fillStyle = '#d4ab55'; x.fill();
  // chair rail
  x.fillStyle = '#c9a04a'; x.fillRect(0, Y(0.97), W, 7);
  x.fillStyle = '#f6dc8c'; x.fillRect(0, Y(0.97), W, 2);
  return toTexture(c, { repeat: true, aniso: 16 });
}

/** The ceiling: cream with a gilded medallion round the chandelier and a border (12 m × 10 m). */
export function ceilingTexture() {
  const W = 1200, H = 1000, [c, x] = canvas(W, H);
  x.fillStyle = '#f5ead8'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#c9a04a'; x.lineWidth = 8; x.strokeRect(60, 60, W - 120, H - 120);
  x.lineWidth = 3; x.strokeRect(85, 85, W - 170, H - 170);
  const cx = W / 2, cy = H / 2 + 20;
  for (const [r, lw] of [[170, 10], [150, 3], [95, 6], [40, 8]]) { x.lineWidth = lw; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = '#d6b05c';
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    x.save(); x.translate(cx + Math.cos(a) * 122, cy + Math.sin(a) * 122); x.rotate(a);
    x.beginPath(); x.ellipse(0, 0, 22, 8, 0, 0, Math.PI * 2); x.fill(); x.restore();
  }
  for (const [px, py] of [[85, 85], [W - 85, 85], [85, H - 85], [W - 85, H - 85]]) {
    x.beginPath(); x.arc(px, py, 26, 0, Math.PI * 2); x.fill();
  }
  return toTexture(c);
}

/** A round Savonnerie-style rug: burgundy border, cream field, rose medallion and scattered posies. */
export function rugTexture() {
  const S = 1024, [c, x] = canvas(S, S), C = S / 2;
  const ring = (r, col) => { x.fillStyle = col; x.beginPath(); x.arc(C, C, r, 0, Math.PI * 2); x.fill(); };
  ring(C, '#6e1422'); ring(C * 0.93, '#c99a52'); ring(C * 0.91, '#8a1c2c'); ring(C * 0.8, '#c99a52'); ring(C * 0.785, '#f1e2c8');
  // border garland of little roses
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2, r = C * 0.855;
    x.fillStyle = i % 2 ? '#e88a98' : '#f4c6a8';
    x.beginPath(); x.arc(C + Math.cos(a) * r, C + Math.sin(a) * r, 12, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#4f7a46';
    x.beginPath(); x.ellipse(C + Math.cos(a + 0.05) * (r + 16), C + Math.sin(a + 0.05) * (r + 16), 9, 4, a, 0, Math.PI * 2); x.fill();
  }
  // posies in the field
  const posy = (px, py, s) => {
    x.fillStyle = '#5d8a50';
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.7; x.beginPath(); x.ellipse(px + Math.cos(a) * 14 * s, py + Math.sin(a) * 14 * s, 10 * s, 4 * s, a, 0, Math.PI * 2); x.fill(); }
    for (const [dx, dy, col] of [[0, 0, '#d9566e'], [-12, 6, '#f2b0bc'], [12, 6, '#f6d2a8']]) { x.fillStyle = col; x.beginPath(); x.arc(px + dx * s, py + dy * s, 9 * s, 0, Math.PI * 2); x.fill(); }
  };
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; posy(C + Math.cos(a) * C * 0.55, C + Math.sin(a) * C * 0.55, 1.3); }
  // central medallion
  ring(C * 0.34, '#8a1c2c'); ring(C * 0.31, '#c99a52'); ring(C * 0.29, '#f6e8d0');
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    x.fillStyle = '#d9566e'; x.beginPath(); x.ellipse(C + Math.cos(a) * C * 0.17, C + Math.sin(a) * C * 0.17, 34, 16, a, 0, Math.PI * 2); x.fill();
  }
  posy(C, C, 2.2);
  return toTexture(c, { aniso: 16 });
}

/** An engraved brass plaque with a caption (for the portraits). */
export function plaqueTexture(text, w = 512, h = 128) {
  const [c, x] = canvas(w, h);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f3d27a'); g.addColorStop(0.5, '#c9973c'); g.addColorStop(1, '#a87628');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#7a5418'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  let size = 64; x.font = `700 ${size}px ${SERIF}`;
  while (size > 24 && x.measureText(text).width > w - 50) { size -= 2; x.font = `700 ${size}px ${SERIF}`; }
  x.fillStyle = 'rgba(255,240,190,0.7)'; x.fillText(text, w / 2 + 1, h / 2 + 3);
  x.fillStyle = '#4a300c'; x.fillText(text, w / 2, h / 2 + 1);
  return toTexture(c);
}

/** A page of sheet music (two-tone parchment, staves and notes). seed varies the notes. */
export function sheetTexture(seed = 1, title = '') {
  const w = 512, h = 680, [c, x] = canvas(w, h);
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  x.fillStyle = '#f4ead2'; x.fillRect(0, 0, w, h);
  const g = x.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(120,80,30,0.25)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#2a2018'; x.strokeStyle = '#2a2018';
  if (title) { x.font = `italic 600 30px ${SERIF}`; x.textAlign = 'center'; x.fillText(title, w / 2, 52); }
  for (let st = 0; st < 9; st++) {
    const y0 = 90 + st * 64;
    x.lineWidth = 1.2;
    for (let l = 0; l < 5; l++) { x.beginPath(); x.moveTo(36, y0 + l * 8); x.lineTo(w - 36, y0 + l * 8); x.stroke(); }
    x.lineWidth = 2; x.beginPath(); x.moveTo(36, y0); x.lineTo(36, y0 + 32); x.stroke();
    for (let bar = 1; bar < 4; bar++) { x.lineWidth = 1.2; x.beginPath(); x.moveTo(36 + bar * (w - 72) / 4, y0); x.lineTo(36 + bar * (w - 72) / 4, y0 + 32); x.stroke(); }
    for (let n = 0; n < 14; n++) {
      const nx = 56 + n * 30 + r() * 4, ny = y0 + 32 - Math.floor(r() * 9) * 4;
      x.beginPath(); x.ellipse(nx, ny, 5, 3.6, -0.4, 0, Math.PI * 2); x.fill();
      x.lineWidth = 1.2; x.beginPath(); x.moveTo(nx + 4.5, ny); x.lineTo(nx + 4.5, ny - 22); x.stroke();
    }
  }
  return toTexture(c);
}

/**
 * The quill's parchment: draw(progress, name, glow) writes the name in calligraphy up to `progress`
 * (0 → 1, left to right) and, with glow, lights the ink in gold. Returns the pen tip (0..1 uv) too.
 */
export function parchment(w = 768, h = 1024) {
  const [c, x] = canvas(w, h);
  const texture = toTexture(c);
  const base = () => {
    x.fillStyle = '#f3e6c6'; x.fillRect(0, 0, w, h);
    const g = x.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(140,90,30,0.32)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(160,110,40,0.5)'; x.lineWidth = 4; x.strokeRect(40, 40, w - 80, h - 80);
  };
  function draw(progress = 0, name = '', glow = 0) {
    base();
    let size = 150; x.font = `400 ${size}px ${SCRIPT}`;
    while (size > 50 && x.measureText(name).width > w - 200) { size -= 4; x.font = `400 ${size}px ${SCRIPT}`; }
    const tw = x.measureText(name).width, x0 = (w - tw) / 2, y = h * 0.46;
    x.save();
    // (the calligraphy's last flourish reaches past its measured width: open the clip a little further)
    if (progress < 1) { x.beginPath(); x.rect(0, 0, x0 + (tw + size * 0.35) * progress, h); x.clip(); }
    x.textBaseline = 'alphabetic';
    if (glow > 0) { x.shadowColor = `rgba(255,190,80,${glow})`; x.shadowBlur = 30 * glow; }
    x.fillStyle = glow > 0 ? `rgb(${Math.round(40 + 190 * glow)},${Math.round(30 + 140 * glow)},${Math.round(30 + 40 * glow)})` : '#2a1c22';
    x.fillText(name, x0, y);
    x.restore();
    // a flourish underneath once the name is written
    if (progress >= 1) {
      x.strokeStyle = glow > 0 ? `rgba(220,160,60,${0.6 + 0.4 * glow})` : 'rgba(42,28,34,0.8)'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(w * 0.25, y + 40); x.bezierCurveTo(w * 0.4, y + 70, w * 0.6, y + 10, w * 0.75, y + 40); x.stroke();
    }
    texture.needsUpdate = true;
    return { u: (x0 + tw * Math.min(1, progress)) / w, v: 1 - (y - size * 0.25) / h };
  }
  draw(0, '');
  return { texture, draw };
}
