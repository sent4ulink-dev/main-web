import * as THREE from 'three';

// Painted canvas textures for the desert courtyard (all drawn here, nothing borrowed): sandstone blocks,
// flagstones, a kilim rug, red banners, the chalkboard, a sticky note, a stencilled "B-DAY" sign, bullet holes.

export const STENCIL = "'Black Ops One', 'Oswald', sans-serif";   // Latin only (no basic Cyrillic in this font)
export const HUD = "'Oswald', 'Rubik', sans-serif";               // condensed
export const BODY = "'Rubik', sans-serif";
export const MONO = "'Roboto Mono', monospace";
export const HAND = "'Caveat', cursive";

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function toTexture(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Seeded random (so the walls look the same on every visit). */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function grain(ctx, w, h, amount = 10, seed = 1) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

export function fit(ctx, text, weight, size, family, maxW, min = 10) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > min);
  return s + 2;
}

/** Sandstone blocks: 1024 px = 4 m wide × 4 m tall (tile it); rows 0.5 m, staggered, each block its own tone. */
export function sandstoneTexture(seed = 3) {
  const S = 1024, [c, ctx] = canvas(S, S), r = rng(seed);
  const px = S / 4;   // per metre
  ctx.fillStyle = '#b98d5c'; ctx.fillRect(0, 0, S, S);   // mortar
  const rows = 8, rh = S / rows;
  for (let row = 0; row < rows; row++) {
    let x = row % 2 ? -px * 0.45 : 0;
    while (x < S) {
      const w = px * (0.7 + r() * 0.6);
      const tone = r();
      const base = [222 - tone * 26, 182 - tone * 26, 128 - tone * 22];
      const g = ctx.createLinearGradient(0, row * rh, 0, row * rh + rh);
      g.addColorStop(0, `rgb(${base[0] + 10},${base[1] + 8},${base[2] + 6})`);
      g.addColorStop(1, `rgb(${base[0] - 14},${base[1] - 14},${base[2] - 12})`);
      ctx.fillStyle = g;
      const m = 5;
      roundRect(ctx, x + m, row * rh + m, w - m * 2, rh - m * 2, 10);
      ctx.fill();
      // worn edges and chips
      ctx.fillStyle = 'rgba(120,80,40,0.18)';
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(x + m + r() * (w - m * 2), row * rh + m + (r() < 0.5 ? 2 : rh - m * 2 - 2), 3 + r() * 7, 0, Math.PI * 2); ctx.fill(); }
      // pores
      ctx.fillStyle = 'rgba(110,70,35,0.22)';
      for (let k = 0; k < 18; k++) { ctx.beginPath(); ctx.arc(x + m + r() * (w - m * 2), row * rh + m + r() * (rh - m * 2), 1 + r() * 2.2, 0, Math.PI * 2); ctx.fill(); }
      // highlight on the top edge (low sun)
      ctx.fillStyle = 'rgba(255,240,205,0.25)';
      ctx.fillRect(x + m + 4, row * rh + m, w - m * 2 - 8, 4);
      x += w;
    }
  }
  // a couple of hairline cracks
  ctx.strokeStyle = 'rgba(90,60,30,0.35)'; ctx.lineWidth = 2;
  for (let k = 0; k < 5; k++) {
    let x = r() * S, y = r() * S;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) { x += (r() - 0.5) * 40; y += 10 + r() * 22; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  grain(ctx, S, S, 12, seed);
  return toTexture(c, { repeat: true });
}

/** Big flagstones with sand in the joints: 1024 px = 6 m. */
export function groundTexture(seed = 7) {
  const S = 1024, [c, ctx] = canvas(S, S), r = rng(seed);
  ctx.fillStyle = '#c9a473'; ctx.fillRect(0, 0, S, S);
  const n = 6, cell = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const tone = r();
    ctx.fillStyle = `rgb(${226 - tone * 22},${196 - tone * 22},${150 - tone * 20})`;
    const m = 6 + r() * 3;
    roundRect(ctx, i * cell + m, j * cell + m, cell - m * 2, cell - m * 2, 14);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,110,60,0.14)';
    for (let k = 0; k < 10; k++) { ctx.beginPath(); ctx.arc(i * cell + r() * cell, j * cell + r() * cell, 4 + r() * 14, 0, Math.PI * 2); ctx.fill(); }
  }
  // drifts of sand
  for (let k = 0; k < 60; k++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(232,200,150,0.45)'); g.addColorStop(1, 'rgba(232,200,150,0)');
    ctx.save(); ctx.translate(r() * S, r() * S); ctx.scale(40 + r() * 90, 20 + r() * 40); ctx.rotate(r());
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  grain(ctx, S, S, 14, seed);
  return toTexture(c, { repeat: true });
}

/** Desert sand outside the walls. */
export function sandTexture(seed = 9) {
  const S = 512, [c, ctx] = canvas(S, S), r = rng(seed);
  ctx.fillStyle = '#d9b47c'; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(170,120,60,0.18)'; ctx.lineWidth = 3;
  for (let y = 0; y < S; y += 18) {
    ctx.beginPath();
    for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + y) * 5 + (r() - 0.5) * 2);
    ctx.stroke();
  }
  grain(ctx, S, S, 16, seed);
  return toTexture(c, { repeat: true });
}

/** A red kilim runner with an original diamond pattern. */
export function rugTexture() {
  const W = 1024, H = 640, [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#9e1f22'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#c33a2b'; ctx.fillRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = '#f0c46a'; ctx.lineWidth = 10; ctx.strokeRect(58, 58, W - 116, H - 116);
  ctx.strokeStyle = '#2a1b3d'; ctx.lineWidth = 6; ctx.strokeRect(76, 76, W - 152, H - 152);
  const diamond = (x, y, s, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); };
  for (let k = 0; k < 3; k++) {
    const x = W / 2 + (k - 1) * 270;
    diamond(x, H / 2, 150, '#2a1b3d'); diamond(x, H / 2, 118, '#f0c46a'); diamond(x, H / 2, 92, '#9e1f22'); diamond(x, H / 2, 46, '#f7e3b5');
  }
  for (let x = 100; x < W - 80; x += 40) { diamond(x, 100, 10, '#f0c46a'); diamond(x, H - 100, 10, '#f0c46a'); }
  // fringe
  ctx.fillStyle = '#f2e2c0';
  for (let y = 10; y < H; y += 14) { ctx.fillRect(0, y, 30, 5); ctx.fillRect(W - 30, y, 30, 5); }
  grain(ctx, W, H, 16, 4);
  return toTexture(c);
}

/** A long red banner with a gold border and an original emblem (a star over two chevrons). */
export function bannerTexture() {
  const W = 256, H = 768, [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#a3161c'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.5, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e9b94a'; ctx.lineWidth = 8; ctx.strokeRect(18, 10, W - 36, H - 70);
  // swallowtail
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W / 2, H - 70); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#e9b94a';
  star(ctx, W / 2, 230, 70, 30);
  ctx.lineWidth = 14; ctx.strokeStyle = '#e9b94a';
  for (const y of [360, 410]) { ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(W / 2, y + 40); ctx.lineTo(W - 60, y); ctx.stroke(); }
  grain(ctx, W, H, 10, 8);
  return toTexture(c);
}

export function star(ctx, x, y, R, r, points = 5) {
  ctx.beginPath();
  for (let k = 0; k < points * 2; k++) {
    const a = -Math.PI / 2 + k * Math.PI / points, rr = k % 2 ? r : R;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

/** The chalkboard in a crate lid: chalk lines, smudges and doodles. */
export function chalkboardTexture(lines = ['GOOD FRIENDS', 'GOOD GAMES', 'MORE BIRTHDAYS', 'TO COME!']) {
  const W = 1024, H = 680, [c, ctx] = canvas(W, H), r = rng(21);
  ctx.fillStyle = '#26332c'; ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 40; k++) {
    ctx.fillStyle = `rgba(220,230,220,${0.02 + r() * 0.04})`;
    ctx.beginPath(); ctx.ellipse(r() * W, r() * H, 40 + r() * 140, 10 + r() * 40, r() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#f2f4ee'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lh = (H - 120) / lines.length;
  lines.forEach((l, i) => {
    fit(ctx, l, 700, 120, HAND, W - 160);
    ctx.save(); ctx.translate(W / 2, 80 + lh * (i + 0.5)); ctx.rotate((r() - 0.5) * 0.05);
    ctx.globalAlpha = 0.92; ctx.fillText(l, 0, 0); ctx.restore();
  });
  // doodles: a heart, a crosshair, stars
  ctx.strokeStyle = '#f6c8d0'; ctx.lineWidth = 6; ctx.globalAlpha = 0.9;
  heartPath(ctx, 110, 110, 34); ctx.stroke();
  ctx.strokeStyle = '#cfe8f6';
  ctx.beginPath(); ctx.arc(W - 110, H - 100, 34, 0, Math.PI * 2); ctx.moveTo(W - 160, H - 100); ctx.lineTo(W - 60, H - 100); ctx.moveTo(W - 110, H - 150); ctx.lineTo(W - 110, H - 50); ctx.stroke();
  ctx.fillStyle = '#f7e08a'; star(ctx, W - 120, 100, 26, 11); star(ctx, 120, H - 100, 20, 8);
  ctx.globalAlpha = 1;
  grain(ctx, W, H, 14, 22);
  return toTexture(c);
}

export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.7, y - s * 1.3, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
}

/** A yellow sticky note with a handwritten line. */
export function stickyTexture(text = 'Another year, another clutch!') {
  const S = 512, [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#f7dd5c'; ctx.fillRect(0, 0, S, S);
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(160,110,0,0.18)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#2a2a52'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const words = text.split(' ');
  const lines = []; let line = '';
  ctx.font = `700 92px ${HAND}`;
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > S - 70 && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line);
  const size = Math.min(92, (S - 80) / lines.length / 1.05);
  ctx.font = `700 ${size}px ${HAND}`;
  lines.forEach((l, i) => ctx.fillText(l, S / 2, S / 2 + (i - (lines.length - 1) / 2) * size * 1.05));
  grain(ctx, S, S, 8, 31);
  return toTexture(c);
}

/** "B-DAY →" stencilled in spray paint (transparent), with overspray and a drip or two. */
export function stencilTexture(text = 'B-DAY', color = '#f2efe6') {
  const W = 1024, H = 512, [c, ctx] = canvas(W, H), r = rng(41);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `400 230px ${STENCIL}`;
  const tw = ctx.measureText(text).width;
  const x0 = (W - tw - 230) / 2;
  ctx.shadowColor = color; ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(text, x0, H / 2);
  // the arrow
  const ax = x0 + tw + 40, ay = H / 2;
  ctx.beginPath(); ctx.moveTo(ax, ay - 30); ctx.lineTo(ax + 120, ay - 30); ctx.lineTo(ax + 120, ay - 80); ctx.lineTo(ax + 210, ay); ctx.lineTo(ax + 120, ay + 80); ctx.lineTo(ax + 120, ay + 30); ctx.lineTo(ax, ay + 30); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  for (let k = 0; k < 7; k++) {   // drips
    const x = x0 + r() * (tw + 200), y = H / 2 + 60 + r() * 30, L = 20 + r() * 70;
    ctx.fillRect(x, y, 4, L); ctx.beginPath(); ctx.arc(x + 2, y + L, 4, 0, Math.PI * 2); ctx.fill();
  }
  // weathering: knock some paint out
  ctx.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 900; k++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.6})`; ctx.fillRect(r() * W, r() * H, 2 + r() * 6, 2 + r() * 4); }
  ctx.globalCompositeOperation = 'source-over';
  return toTexture(c);
}

/** One bullet hole: dark core, torn rim, a ring of pale dust and hairline cracks (alpha). */
export function holeTexture() {
  const S = 128, [c, ctx] = canvas(S, S), r = rng(77);
  const cx = S / 2;
  let g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  g.addColorStop(0, 'rgba(250,236,205,0.0)'); g.addColorStop(0.35, 'rgba(255,240,210,0.7)'); g.addColorStop(0.7, 'rgba(240,220,185,0.25)'); g.addColorStop(1, 'rgba(240,220,185,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(70,45,25,0.7)'; ctx.lineWidth = 2;
  for (let k = 0; k < 8; k++) {
    let a = r() * Math.PI * 2, d = 22, x = cx + Math.cos(a) * d, y = cx + Math.sin(a) * d;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) { a += (r() - 0.5) * 0.7; d += 7 + r() * 9; ctx.lineTo(cx + Math.cos(a) * d, cx + Math.sin(a) * d); }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(115,72,38,0.95)';
  ctx.beginPath();
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, rr = 24 + r() * 8; ctx.lineTo(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
  g = ctx.createRadialGradient(cx - 3, cx - 3, 0, cx, cx, 19);
  g.addColorStop(0, 'rgba(8,5,3,1)'); g.addColorStop(1, 'rgba(45,28,16,1)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cx, 18, 0, Math.PI * 2); ctx.fill();
  return toTexture(c);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
