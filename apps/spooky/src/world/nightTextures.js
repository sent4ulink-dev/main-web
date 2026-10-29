import * as THREE from 'three';

// Painted canvas textures for the haunted graveyard (all drawn here, nothing borrowed).

export const DRIP = "'Rubik Wet Paint', 'Rubik', sans-serif";   // dripping titles
export const BODY = "'Rubik', sans-serif";
export const CARVE = "'Yeseva One', 'Rubik', serif";            // engraved stone, carved pumpkin
export const INK = "'Bad Script', 'Caveat', cursive";           // the letter's handwriting
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

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function grain(ctx, w, h, amount = 10, seed = 1) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amount; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
}

export function fit(ctx, text, weight, size, family, maxW, min = 10) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > min);
  return s + 2;
}

/** Wrap text into lines that fit maxW (current ctx font). */
export function wrap(ctx, text, maxW) {
  const lines = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

/** Night grass: dark blue-green tufts and leaf litter (1024 px = 8 m). */
export function grassTexture(seed = 5) {
  const S = 1024, [c, ctx] = canvas(S, S), r = rng(seed);
  ctx.fillStyle = '#1f2a26'; ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 90; k++) {   // soft patches
    const x = r() * S, y = r() * S, rr = 30 + r() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, r() < 0.5 ? 'rgba(52,70,58,0.55)' : 'rgba(28,34,40,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  for (let k = 0; k < 2600; k++) {   // blades
    const x = r() * S, y = r() * S, l = 5 + r() * 9;
    ctx.strokeStyle = `rgba(${70 + r() * 40},${100 + r() * 50},${80 + r() * 30},${0.25 + r() * 0.35})`;
    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 4, y - l); ctx.stroke();
  }
  const leaves = ['#8a4a1e', '#a8601c', '#6e2f2a', '#5c3b22'];
  for (let k = 0; k < 160; k++) {   // fallen leaves
    ctx.save(); ctx.translate(r() * S, r() * S); ctx.rotate(r() * 6.28);
    ctx.fillStyle = leaves[k % 4]; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;
  grain(ctx, S, S, 10, seed);
  return toTexture(c, { repeat: true });
}

/** A stepping stone's top: worn grey with moss in the cracks. */
export function stoneTexture(seed = 3) {
  const S = 256, [c, ctx] = canvas(S, S), r = rng(seed);
  ctx.fillStyle = '#6a6d78'; ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 40; k++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '40,44,52' : '150,154,165'},${0.08 + r() * 0.1})`; ctx.beginPath(); ctx.arc(r() * S, r() * S, 6 + r() * 30, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(60,90,55,0.6)'; ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); let x = r() * S, y = r() * S; ctx.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; ctx.lineTo(x, y); } ctx.stroke(); }
  grain(ctx, S, S, 14, seed);
  return toTexture(c);
}

/** Text carved into stone: dark cut letters with a light lower lip (transparent elsewhere). */
export function engraving(lines, { w = 512, h = 640, sizes = [], color = 'rgba(30,30,40,0.85)', lip = 'rgba(210,214,225,0.55)', glow = null, top = 0.18 } = {}) {
  const [c, ctx] = canvas(w, h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let y = h * top;
  lines.forEach((ln, i) => {
    const size = sizes[i] || 60;
    const s = fit(ctx, ln.text, ln.weight || 400, size, ln.font || CARVE, w * 0.86);
    ctx.fillStyle = lip; ctx.fillText(ln.text, w / 2 + 1.5, y + 2.5);
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = size * 0.35; }
    ctx.fillStyle = color; ctx.fillText(ln.text, w / 2, y);
    ctx.shadowBlur = 0;
    y += s * (ln.gap || 1.35);
  });
  return toTexture(c);
}

/** A cobweb (transparent, white threads) for corners. */
export function cobwebTexture() {
  const S = 512, [c, ctx] = canvas(S, S);
  ctx.strokeStyle = 'rgba(235,235,245,0.75)'; ctx.lineWidth = 2;
  const spokes = 9;
  for (let k = 0; k < spokes; k++) { const a = (k / (spokes - 1)) * Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * S, Math.sin(a) * S); ctx.stroke(); }
  for (let ring = 1; ring <= 7; ring++) {
    const R = ring * S / 7.5;
    ctx.beginPath();
    for (let k = 0; k < spokes; k++) {
      const a = (k / (spokes - 1)) * Math.PI / 2, rr = R * (k % 2 ? 0.93 : 1);
      if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else { const am = ((k - 0.5) / (spokes - 1)) * Math.PI / 2; ctx.quadraticCurveTo(Math.cos(am) * rr * 0.86, Math.sin(am) * rr * 0.86, Math.cos(a) * rr, Math.sin(a) * rr); }
    }
    ctx.stroke();
  }
  return toTexture(c);
}

/** Soft round glow (for wisps, moon halo, lantern glow). */
export function glowTexture(size = 128, inner = 0.0) {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * inner * 0.5, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return toTexture(c, { srgb: false });
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.7, y - s * 1.3, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
}
