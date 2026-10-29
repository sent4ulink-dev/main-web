import * as THREE from 'three';

// Procedural canvas textures — paper, photos, calendar pages — painted at runtime, no image files.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 16;
  t.needsUpdate = true;
  return t;
}

function grain(ctx, w, h, amount = 10, seed = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Set ctx.font to `weight size family`, shrinking the size until `text` fits in maxW. Returns the size. */
export function fitFont(ctx, text, weight, size, family, maxW, min = 10) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > min && ctx.measureText(text).width > maxW) { s -= 1; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}

export const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "October 14" and "October 14, 2026" */
export const monthDay = (d) => `${EN_MONTHS[d.getMonth()]} ${d.getDate()}`;
export const enDate = (d) => `${monthDay(d)}, ${d.getFullYear()}`;

/** Cream paper with fibres. */
export function paperTexture({ w = 512, h = 512, tint = '#f6efe3', lines = false } = {}) {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.4, h * 0.3, 10, w / 2, h / 2, w * 0.8);
  g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(180,150,110,0.12)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(140,110,80,0.06)';
  for (let i = 0; i < 260; i++) {
    ctx.beginPath();
    const x = Math.random() * w, y = Math.random() * h;
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.random() * 20 - 10, y + Math.random() * 20 - 10, x + Math.random() * 30 - 15, y + Math.random() * 30 - 15);
    ctx.stroke();
  }
  if (lines) {
    ctx.strokeStyle = 'rgba(90,120,170,0.18)'; ctx.lineWidth = 1.5;
    for (let y = h * 0.16; y < h * 0.95; y += h * 0.065) { ctx.beginPath(); ctx.moveTo(w * 0.08, y); ctx.lineTo(w * 0.92, y); ctx.stroke(); }
  }
  grain(ctx, w, h, 9, 3);
  return toTexture(c);
}

/** Handwritten letter page (A5 portrait). Drawn on a 512-wide layout, scaled to the canvas. */
export const INKFONT = "'Bad Script', 'Caveat', cursive";
export const DRIPFONT = "'Rubik Wet Paint', 'Rubik', sans-serif";

/** Old parchment, scorched at the edges, a cobweb in the corner and a wax drip. 512-wide layout. */
function spookyPaper(ctx, W, H, seed = 3) {
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = '#e6d6b2'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 40, W / 2, H / 2, Math.max(W, H) * 0.72);
  g.addColorStop(0, 'rgba(255,248,225,0.5)'); g.addColorStop(0.65, 'rgba(160,120,70,0.12)'); g.addColorStop(1, 'rgba(40,20,10,0.75)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 22; k++) {
    const x = r() * W, y = r() * H, rr = 10 + r() * 40;
    const b = ctx.createRadialGradient(x, y, 0, x, y, rr);
    b.addColorStop(0, `rgba(120,80,40,${0.05 + r() * 0.08})`); b.addColorStop(1, 'rgba(120,80,40,0)');
    ctx.fillStyle = b; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  // a cobweb in the top-right corner
  ctx.strokeStyle = 'rgba(60,50,40,0.35)'; ctx.lineWidth = 1;
  for (let k = 0; k < 7; k++) { const a = Math.PI / 2 + k / 6 * Math.PI / 2; ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W + Math.cos(a) * 140, Math.sin(a) * 140); ctx.stroke(); }
  for (let ring = 1; ring <= 5; ring++) {
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) { const a = Math.PI / 2 + k / 6 * Math.PI / 2, rr = ring * 26; const x = W + Math.cos(a) * rr, y = Math.sin(a) * rr; if (k) ctx.quadraticCurveTo(W + Math.cos(a - 0.13) * rr * 0.9, Math.sin(a - 0.13) * rr * 0.9, x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
  }
  // a little spider hanging from it
  ctx.beginPath(); ctx.moveTo(W - 58, 60); ctx.lineTo(W - 58, 112); ctx.stroke();
  ctx.fillStyle = 'rgba(30,22,20,0.85)'; ctx.beginPath(); ctx.arc(W - 58, 118, 6, 0, Math.PI * 2); ctx.fill();
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(W - 58, 118); ctx.quadraticCurveTo(W - 58 + sx * 9, 112 + k * 3, W - 58 + sx * 13, 118 + k * 4); ctx.stroke(); }
  // a drip of candle wax
  ctx.fillStyle = 'rgba(240,236,220,0.75)';
  ctx.beginPath(); ctx.ellipse(70, H - 70, 26, 16, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(200,190,160,0.5)'; ctx.beginPath(); ctx.ellipse(74, H - 66, 14, 8, 0.3, 0, Math.PI * 2); ctx.fill();
}

/** The invitation: dripping title, the letter in dark ink, a signature, bats along the top. 512-wide layout. */
export function letterTexture(content, w = 1024, h = 1434, { blank = false } = {}) {
  const [c, ctx] = canvas(w, h);
  const k = w / 512, H = h / k;
  ctx.scale(k, k);
  spookyPaper(ctx, 512, H);
  // bats across the top
  ctx.fillStyle = 'rgba(40,20,45,0.8)';
  for (const [x, y, s] of [[70, 40, 1], [120, 62, 0.7], [400, 44, 0.8]]) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-12, -14, -30, -6); ctx.quadraticCurveTo(-22, 0, -24, 8); ctx.quadraticCurveTo(-14, 2, -8, 10); ctx.quadraticCurveTo(-4, 4, 0, 8);
    ctx.quadraticCurveTo(4, 4, 8, 10); ctx.quadraticCurveTo(14, 2, 24, 8); ctx.quadraticCurveTo(22, 0, 30, -6); ctx.quadraticCurveTo(12, -14, 0, 0); ctx.fill(); ctx.restore();
  }
  // the dripping title
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#8a1020';
  fitFont(ctx, 'Halloween Invitation', 400, 44, DRIPFONT, 380);
  ctx.fillText('Halloween Invitation', 256, 150);
  ctx.textAlign = 'left';
  if (blank) { ctx.setTransform(1, 0, 0, 1, 0, 0); grain(ctx, w, h, 9, 5); return toTexture(c); }   // paper only (words edited on top)
  ctx.fillStyle = '#231a28';
  const greeting = content.letter.greeting.replace('{name}', content.name);
  fitFont(ctx, greeting, 400, 26, INKFONT, 420);
  ctx.fillText(greeting, 44, 220);
  ctx.font = `400 18px ${INKFONT}`;
  let y = 258;
  const maxW = 424;
  for (const p of content.letter.paragraphs) {
    let line = '';
    for (const wd of p.split(' ')) {
      const test = line ? `${line} ${wd}` : wd;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, 44, y); y += 26; line = wd; } else line = test;
    }
    if (line) { ctx.fillText(line, 44, y); y += 26; }
    y += 10;
  }
  y = Math.min(y + 6, H - 120);
  ctx.textAlign = 'right';
  ctx.font = `400 19px ${INKFONT}`;
  ctx.fillText(content.letter.signoff, 468, y);
  ctx.fillStyle = '#5a1430';
  fitFont(ctx, content.from, 400, 40, INKFONT, 300);
  ctx.fillText(content.from, 468, y + 46);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  grain(ctx, w, h, 9, 5);
  const t = toTexture(c);
  t.anisotropy = 16;
  return t;
}

// placeholder photos (before real ones are added): moonlit dusk skies over dark hills
const PHOTO_PALETTES = [
  ['#2a1d4a', '#7a4a8a', '#1a1424'], ['#1d2a44', '#4a6a8a', '#121a22'], ['#3a1d2a', '#b8603a', '#1a1214'],
  ['#1d3a2e', '#5aa070', '#101a14'], ['#2e1d44', '#c07a3a', '#18121e'],
];

export function placeholderPhoto(i, caption = '', size = 768) {
  const [c, ctx] = canvas(size, size);
  const [a, b, d] = PHOTO_PALETTES[i % PHOTO_PALETTES.length];
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, a); g.addColorStop(0.62, b); g.addColorStop(1, d);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255,248,230,0.9)';
  ctx.beginPath(); ctx.arc(size * (0.3 + 0.4 * ((i * 37) % 10) / 10), size * 0.5, size * 0.09, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = `rgba(40,30,60,${0.25 + k * 0.18})`;
    ctx.beginPath(); ctx.moveTo(0, size);
    for (let x = 0; x <= size; x += size / 16) ctx.lineTo(x, size * (0.62 + k * 0.1) + Math.sin(x * 0.015 + i + k * 2) * size * 0.04);
    ctx.lineTo(size, size); ctx.fill();
  }
  if (caption) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    fitFont(ctx, caption, 600, Math.round(size * 0.075), "'Rubik', sans-serif", size * 0.86);
    ctx.textAlign = 'center';
    ctx.fillText(caption, size / 2, size * 0.2);
  }
  grain(ctx, size, size, 14, i + 7);
  return c;
}

/** Polaroid card: white frame + photo + handwritten caption. */
export function polaroidTexture(photoCanvasOrImg, caption, w = 512) {
  // the photo keeps its own shape (within 9:16 … 16:9); the card grows or shrinks around it
  const img = photoCanvasOrImg, iw = img.naturalWidth || img.width || 1, ih = img.naturalHeight || img.height || 1;
  const ia = iw / ih, a = Math.min(16 / 9, Math.max(9 / 16, ia));
  const k = w / 512, m = 30 * k, ph = w - m * 2, phH = Math.round(ph / a);
  const h = Math.round(m + phH + 138 * k);
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, w, h);
  let sw = iw, sh = ih;
  if (ia > a) sw = ih * a; else sh = iw / a;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, m, m, ph, phH);
  ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(m, m, ph, 3 * k);
  ctx.fillStyle = '#3a3550';
  fitFont(ctx, caption || '', 700, Math.round(50 * k), "'Caveat', cursive", w - m * 2.4);
  ctx.textAlign = 'center';
  ctx.fillText(caption || '', w / 2, h - 46 * k);
  grain(ctx, w, h, 6, 11);
  const t = toTexture(c);
  t.userData.aspect = h / w;                                  // card height / width
  t.userData.photo = { u0: m / w, v0: m / h, v1: (m + phH) / h };   // the photo window, from the top-left
  return t;
}

/** Screen rectangle {x, y, w, h} of part of a plane mesh (u/v from its top-left), or null when behind the camera. */
export function planeRect(mesh, camera, w, h, { u0 = 0, u1 = 1, v0 = 0, v1 = 1 } = {}) {
  const g = mesh.geometry.parameters, pts = [];
  for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]) {
    const p = mesh.localToWorld(new THREE.Vector3((u - 0.5) * g.width, (0.5 - v) * g.height, 0)).project(camera);
    if (p.z > 1) return null;
    pts.push([(p.x * 0.5 + 0.5) * w, (-p.y * 0.5 + 0.5) * h]);
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Soft round sprite (for fireflies, sparks, pollen, smoke). */
export function softSprite(size = 64, hard = 0.0) {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(Math.max(0.05, hard), 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return toTexture(c, false);
}

/** Envelope back: blush paper, shaded fold triangles and a handwritten name. */
export function envelopeTexture(name, w = 1024, h = 712) {
  // an old parchment envelope: scorched edges, a moon and bats in dark ink, the name in purple handwriting
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#dcc79c'; ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.7);
  g.addColorStop(0, 'rgba(255,245,215,0.35)'); g.addColorStop(0.7, 'rgba(150,100,50,0.15)'); g.addColorStop(1, 'rgba(50,25,10,0.7)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(90,60,30,0.3)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w * 0.5, h * 0.52); ctx.lineTo(w, h); ctx.stroke();
  // moon and bats, lower left, in faded ink
  ctx.fillStyle = 'rgba(60,30,70,0.55)'; ctx.beginPath(); ctx.arc(130, h - 150, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8c398'; ctx.beginPath(); ctx.arc(150, h - 162, 42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(60,30,70,0.6)';
  for (const [x, y, s] of [[230, h - 230, 1.1], [300, h - 180, 0.7], [w - 150, 120, 0.9]]) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-12, -14, -30, -6); ctx.quadraticCurveTo(-22, 0, -24, 8); ctx.quadraticCurveTo(-14, 2, -8, 10); ctx.quadraticCurveTo(-4, 4, 0, 8);
    ctx.quadraticCurveTo(4, 4, 8, 10); ctx.quadraticCurveTo(14, 2, 24, 8); ctx.quadraticCurveTo(22, 0, 30, -6); ctx.quadraticCurveTo(12, -14, 0, 0); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = '#4a1a5a'; ctx.textAlign = 'center';
  fitFont(ctx, name, 400, 100, INKFONT, w * 0.62);
  ctx.fillText(name, w * 0.55, h * 0.86);
  grain(ctx, w, h, 12, 23);
  return toTexture(c);
}

/** Envelope flap texture with a soft edge shadow. */
export function flapTexture(w = 512, h = 256) {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#cdb68a'; ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,240,210,0.2)'); g.addColorStop(1, 'rgba(70,40,15,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 10, 29);
  return toTexture(c);
}

/** Crisp storybook gingham: white base, red stripes; the crossings read darker, like woven cloth. */
export function ginghamTexture(color = '#d8343c', size = 512, squares = 8) {
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = '#fbf6ef'; ctx.fillRect(0, 0, size, size);
  const s = size / squares;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = color;
  for (let i = 0; i < squares; i += 2) {
    ctx.fillRect(i * s, 0, s, size);
    ctx.fillRect(0, i * s, size, s);
  }
  ctx.globalAlpha = 1;
  // faint weave texture
  ctx.globalAlpha = 0.06; ctx.fillStyle = '#000';
  for (let y = 0; y < size; y += 3) ctx.fillRect(0, y, size, 1);
  ctx.globalAlpha = 1;
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}


/**
 * One page of a day-flip desk calendar: the month (in English) on a red band at the top and the day,
 * big, in the middle. mark() circles the special day and writes its note along the bottom.
 */
export function dayTexture(date, highlight = false, w = 1024, h = 1150) {
  const [c, ctx] = canvas(w, h);
  const base = document.createElement('canvas'); base.width = w; base.height = h;
  const b = base.getContext('2d');
  b.fillStyle = '#fbf7f0'; b.fillRect(0, 0, w, h);
  b.fillStyle = '#c2364f'; b.fillRect(0, 0, w, 250);
  b.fillStyle = '#fff'; b.textAlign = 'center';
  b.font = "700 150px 'Oswald', sans-serif";
  b.fillText(EN_MONTHS[date.getMonth()], w / 2, 150);
  b.font = "600 46px 'Oswald', sans-serif";
  b.fillStyle = 'rgba(255,255,255,0.85)';
  b.fillText(String(date.getFullYear()), w / 2, 214);
  b.fillStyle = '#2b2233';
  b.font = "700 520px 'Oswald', sans-serif";
  const cy = 700;
  b.fillText(String(date.getDate()), w / 2, cy + 175);
  grain(b, w, h, 7, 13 + date.getDate());
  ctx.drawImage(base, 0, 0);
  const texture = toTexture(c);
  texture.anisotropy = 16;

  function mark(progress = 1, label = '') {
    ctx.drawImage(base, 0, 0);
    if (highlight && progress > 0) {
      const x = w / 2, y = cy, rx = 300, ry = 270;
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // three overlapping passes read like a felt-tip brush
      for (const [lw, a, wob] of [[20, 0.55, 0], [12, 0.65, 3], [6, 0.5, -4]]) {
        ctx.strokeStyle = `rgba(214,48,82,${a})`; ctx.lineWidth = lw;
        ctx.beginPath();
        const end = -0.5 + Math.PI * 2.2 * Math.min(1, progress);
        for (let t = -0.5; t <= end; t += 0.03) {
          const r = 1 + Math.sin(t * 3 + wob) * 0.03 + (t > Math.PI * 1.6 ? (t - Math.PI * 1.6) * 0.04 : 0);
          ctx.lineTo(x + Math.cos(t) * rx * r, y + Math.sin(t) * ry * r);
        }
        ctx.stroke();
      }
      if (progress >= 1) {
        // a little heart by the circle + the handwritten note
        const hx = x + rx * 0.8, hy = y - ry * 0.78, s = 30;
        ctx.fillStyle = 'rgba(214,48,82,0.9)';
        ctx.beginPath(); ctx.moveTo(hx, hy + s);
        ctx.bezierCurveTo(hx - s * 2, hy - s * 0.4, hx - s * 0.8, hy - s * 1.8, hx, hy - s * 0.6);
        ctx.bezierCurveTo(hx + s * 0.8, hy - s * 1.8, hx + s * 2, hy - s * 0.4, hx, hy + s);
        ctx.fill();
        if (label) {
          ctx.fillStyle = '#b8304e'; ctx.textAlign = 'center';
          fitFont(ctx, label, 'italic 700', LABEL.size, "'Oswald', sans-serif", w - 80);
          ctx.fillText(label, w / 2, h - LABEL.bottom);
        }
      }
      ctx.restore();
    }
    texture.needsUpdate = true;
  }
  return { texture, mark };
}
/** Where dayTexture() writes the note (px from the bottom of the 1150px page, font size). */
export const LABEL = { bottom: 70, size: 72, h: 1150 };

/**
 * Cassette label, laid out for the walkman's window (portrait). The two reel sockets sit exactly over
 * the player's spindles (`reels`, as fractions of the label: [u, v, r]); the picture fills the space
 * between them — just the photo, no frame. The hubs themselves are separate meshes that spin.
 */
/** Where the picture sits on the cassette label (between the reels), in label pixels. */
function labelPicture(w, h, reels) {
  const top = (reels[0][1] * h) + reels[0][2] * w * 1.75, bottom = (reels[1][1] * h) - reels[1][2] * w * 1.75;
  return { px: w * 0.06, pw: w * 0.88, ph: Math.max(10, bottom - top), py: top };
}
/** Width / height of that picture (the cassette's photo window crops to exactly this). */
export function labelPictureAspect(aspect, reels, w = 640) { const p = labelPicture(w, Math.round(w / aspect), reels); return p.pw / p.ph; }

export function cassetteLabelTexture(image, { aspect = 0.633, reels = [[0.544, 0.162, 0.136], [0.544, 0.824, 0.136]] } = {}, w = 640) {
  const h = Math.round(w / aspect);
  const [c, ctx] = canvas(w, h);
  // shell + label
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f6d9de'); g.addColorStop(1, '#efc7d1');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, h * 0.49, w, 2);
  // reel sockets (dark rings around the spindles, a little tape wound on each)
  for (const [u, v, r] of reels) {
    const x = u * w, y = v * h, R = r * w;
    ctx.fillStyle = '#3a3140'; ctx.beginPath(); ctx.arc(x, y, R * 1.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b4a3c'; ctx.beginPath(); ctx.arc(x, y, R * 1.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2330'; ctx.beginPath(); ctx.arc(x, y, R * 0.92, 0, Math.PI * 2); ctx.fill();
  }
  // the picture, centred between the sockets
  const { px, py, pw, ph } = labelPicture(w, h, reels);
  ctx.save(); ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 18); ctx.clip();
  const iw = image.width || image.naturalWidth, ih = image.height || image.naturalHeight;
  const k = Math.max(pw / iw, ph / ih);
  ctx.drawImage(image, px + (pw - iw * k) / 2, py + (ph - ih * k) / 2, iw * k, ih * k);
  ctx.restore();
  ctx.strokeStyle = 'rgba(70,40,55,0.35)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 18); ctx.stroke();
  grain(ctx, w, h, 6, 31);
  const t = toTexture(c);
  t.anisotropy = 16;
  return t;
}

/** White toothed cassette hub on a transparent background. */
export function hubTexture(size = 128) {
  const [c, ctx] = canvas(size, size);
  const m = size / 2;
  ctx.fillStyle = '#f4efe8';
  ctx.beginPath(); ctx.arc(m, m, size * 0.46, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(m, m, size * 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#f4efe8';
  for (let i = 0; i < 6; i++) {
    ctx.save(); ctx.translate(m, m); ctx.rotate((i / 6) * Math.PI * 2);
    ctx.fillRect(-size * 0.035, size * 0.12, size * 0.07, size * 0.15);
    ctx.restore();
  }
  return toTexture(c);
}
