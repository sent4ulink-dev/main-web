import * as THREE from 'three';
import gsap from 'gsap';
import { canvas, toTexture, STENCIL, star, fit, rng } from '../world/courtyardTextures.js';
import { toonMaterial, addOutline } from '../style/toon.js';

// The last shot, framed as an MVP board: weathered planks with metal corner brackets, a stamped steel "★ MVP ★"
// plate, the picture taped on, and the name painted underneath. It flips in and floats to you.

/** Weathered planks (also used by the story picture). */
export function drawPlanks(ctx, x, y, w, h, seed = 4) {
  const r = rng(seed), n = 6, pw = w / n;
  for (let i = 0; i < n; i++) {
    const tone = r();
    const g = ctx.createLinearGradient(x + i * pw, 0, x + (i + 1) * pw, 0);
    g.addColorStop(0, `rgb(${120 + tone * 30},${80 + tone * 20},${45 + tone * 12})`); g.addColorStop(0.5, `rgb(${145 + tone * 30},${98 + tone * 22},${55 + tone * 14})`); g.addColorStop(1, `rgb(${112 + tone * 28},${74 + tone * 18},${40 + tone * 10})`);
    ctx.fillStyle = g; ctx.fillRect(x + i * pw, y, pw, h);
    ctx.strokeStyle = 'rgba(60,35,15,0.28)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 9; k++) {   // grain
      const gx = x + i * pw + (k + 0.5) * pw / 9 + (r() - 0.5) * 6;
      ctx.beginPath(); ctx.moveTo(gx, y);
      for (let yy = 0; yy <= h; yy += 30) ctx.lineTo(gx + Math.sin(yy * 0.02 + k + i) * 4, y + yy);
      ctx.stroke();
    }
    if (r() < 0.7) { ctx.fillStyle = 'rgba(55,30,12,0.45)'; ctx.beginPath(); ctx.ellipse(x + i * pw + pw * (0.3 + r() * 0.4), y + h * r(), 7, 14, 0, 0, Math.PI * 2); ctx.fill(); }   // a knot
    ctx.fillStyle = 'rgba(30,15,5,0.55)'; ctx.fillRect(x + (i + 1) * pw - 2, y, 3, h);   // the gap
    for (const ny of [y + 28, y + h - 28]) { ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(x + i * pw + pw / 2, ny, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x + i * pw + pw / 2 - 1.5, ny - 1.5, 1.5, 0, Math.PI * 2); ctx.fill(); }
  }
  // metal corner brackets
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    const L = Math.min(w, h) * 0.13;
    ctx.fillStyle = '#5c6066';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + sx * L, cy); ctx.lineTo(cx + sx * L, cy + sy * 16); ctx.lineTo(cx + sx * 16, cy + sy * 16); ctx.lineTo(cx + sx * 16, cy + sy * L); ctx.lineTo(cx, cy + sy * L); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8b9096'; for (const [bx, by] of [[cx + sx * 9, cy + sy * L * 0.75], [cx + sx * L * 0.75, cy + sy * 9]]) { ctx.beginPath(); ctx.arc(bx, by, 3.5, 0, Math.PI * 2); ctx.fill(); }
  }
}

/** The stamped steel plate: ★ MVP ★. */
export function drawPlate(ctx, cx, cy, w, h) {
  const g = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
  g.addColorStop(0, '#c9ced3'); g.addColorStop(0.5, '#8d949b'); g.addColorStop(1, '#b6bcc2');
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(cx - w / 2 + 5, cy - h / 2 + 7, w, h);
  ctx.fillStyle = g; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = 'rgba(40,44,48,0.6)'; ctx.lineWidth = 3; ctx.strokeRect(cx - w / 2 + 8, cy - h / 2 + 8, w - 16, h - 16);
  for (const [bx, by] of [[cx - w / 2 + 16, cy - h / 2 + 16], [cx + w / 2 - 16, cy - h / 2 + 16], [cx - w / 2 + 16, cy + h / 2 - 16], [cx + w / 2 - 16, cy + h / 2 - 16]]) { ctx.fillStyle = '#4a4f55'; ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `400 ${h * 0.62}px ${STENCIL}`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillText('MVP', cx + 1.5, cy + 3.5);
  const gg = ctx.createLinearGradient(0, cy - h / 3, 0, cy + h / 3); gg.addColorStop(0, '#ffe08a'); gg.addColorStop(1, '#c7861a');
  ctx.fillStyle = gg; ctx.fillText('MVP', cx, cy + 2);
  ctx.fillStyle = '#d9a12e'; star(ctx, cx - w * 0.36, cy + 2, h * 0.2, h * 0.085); star(ctx, cx + w * 0.36, cy + 2, h * 0.2, h * 0.085);
}

function boardTexture(name) {
  const W = 1024, H = 1280, [c, ctx] = canvas(W, H);
  drawPlanks(ctx, 0, 0, W, H);
  drawPlate(ctx, W / 2, 110, 560, 150);
  // the name, painted on with a stencil
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const nm = name.toUpperCase();
  fit(ctx, nm, 800, 130, "'Rubik', sans-serif", W - 160);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(nm, W / 2 + 4, H - 148 + 5);
  ctx.fillStyle = '#f4efe2'; ctx.fillText(nm, W / 2, H - 148);
  ctx.font = "500 40px 'Oswald', sans-serif"; ctx.fillStyle = 'rgba(244,239,226,0.85)';
  ctx.fillText('HAPPY BIRTHDAY', W / 2, H - 58);
  return toTexture(c);
}

export class MvpCard {
  constructor(scene, name) {
    this.group = new THREE.Group(); this.group.name = 'mvp';
    this.group.visible = false;
    scene.add(this.group);
    const BW = 0.8, BH = 1.0;
    this.size = { w: BW, h: BH };
    this.board = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, 0.03), [0, 1, 2, 3].map(() => toonMaterial({ color: new THREE.Color('#6b4524') }, { rimScale: 0.4 })).concat([new THREE.MeshBasicMaterial({ map: boardTexture(name) }), toonMaterial({ color: new THREE.Color('#5a3a1e') }, { rimScale: 0.3 })]));
    this.board.position.z = -0.016;
    addOutline(this.board, 0.0016);
    // the picture, taped on (square), slightly askew
    this.photo = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.56), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.photo.position.set(0, 0.02, 0.002); this.photo.rotation.z = -0.025;
    const border = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xf1ead6 }));
    border.position.set(0, 0, -0.001); this.photo.add(border);
    const tape = new THREE.MeshBasicMaterial({ color: 0xe7dbb2, transparent: true, opacity: 0.85 });
    for (const [x, y, r] of [[-0.27, 0.27, 0.7], [0.27, 0.27, -0.7], [-0.27, -0.27, -0.7], [0.27, -0.27, 0.7]]) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.035), tape); t.position.set(x, y, 0.002); t.rotation.z = r; this.photo.add(t);
    }
    this.group.add(this.board, this.photo);
  }

  setName(name) { const m = this.board.material[4]; m.map?.dispose(); m.map = boardTexture(name); m.needsUpdate = true; }

  /** Put the picture in and show the board at `at`, facing `towards`. */
  show(image, at, towards) {
    const t = new THREE.CanvasTexture(image); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    this.photo.material.map?.dispose(); this.photo.material.map = t; this.photo.material.needsUpdate = true;
    this.group.position.copy(at);
    this.group.lookAt(towards);
    this.group.visible = true;
    this.group.scale.setScalar(1);
    return gsap.fromTo(this.group.rotation, { y: this.group.rotation.y - Math.PI / 2 }, { y: this.group.rotation.y, duration: 0.9, ease: 'back.out(1.4)' });
  }

  hide() { this.group.visible = false; }
}
