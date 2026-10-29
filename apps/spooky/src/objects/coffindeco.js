import * as THREE from 'three';
import { toonMaterial, addOutline } from '../style/toon.js';
import { canvas, INK } from '../world/nightTextures.js';
import { addJackFace } from './jackface.js';

// Making the coffin mailbox charming: a big purple bow on top, a string of twinkling fairy lights round its
// edges, a little bat perched on the corner, a hand-painted "Letter" sign hanging under it, and two tiny
// jack-o'-lanterns at the foot of the post. (All in the mailbox's own space: the coffin is a hexagonal box
// from y 1.05 to 1.67, its front at z ≈ 0.12.)

const OUTLINE = [[-0.14, 1.05], [-0.22, 1.47], [-0.12, 1.67], [0.12, 1.67], [0.22, 1.47], [0.14, 1.05]];

function bow(color) {
  const g = new THREE.Group();
  const m = toonMaterial({ color: new THREE.Color(color), emissive: new THREE.Color(color).multiplyScalar(0.25) }, { rimScale: 1.6 });
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 8, 18), m);
    loop.scale.set(1.25, 0.8, 0.6); loop.position.set(s * 0.065, 0.02, 0); loop.rotation.z = s * 0.35;
    addOutline(loop, 0.0016); g.add(loop);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.012), m);
    tail.position.set(s * 0.035, -0.05, 0.005); tail.rotation.z = s * 0.4;
    addOutline(tail, 0.0014); g.add(tail);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), m); knot.scale.set(1, 0.85, 0.7);
  addOutline(knot, 0.0016); g.add(knot);
  return g;
}

function signTexture() {
  const [c, ctx] = canvas(512, 200);
  const g = ctx.createLinearGradient(0, 0, 0, 200);
  g.addColorStop(0, '#8a5a36'); g.addColorStop(1, '#5e3a22');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(4, 4, 504, 192, 26); ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,10,0.6)'; ctx.lineWidth = 6; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,170,0.12)'; ctx.lineWidth = 3;
  for (let y = 40; y < 190; y += 34) { ctx.beginPath(); ctx.moveTo(20, y); ctx.bezierCurveTo(180, y - 6, 330, y + 6, 492, y); ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe9c4'; ctx.font = `400 96px ${INK}`;
  ctx.fillText('Letter', 230, 104);
  // a little heart
  ctx.fillStyle = '#ff6f9a'; ctx.save(); ctx.translate(430, 96); ctx.scale(2.2, 2.2);
  ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-14, -2, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 14, -2, 0, 8); ctx.fill(); ctx.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function decorateCoffin(mailbox, { makeBat = null, makePumpkin = null, lookAt = null } = {}) {
  const deco = new THREE.Group(); deco.name = 'coffin-deco';
  mailbox.add(deco);
  // the bow
  const b = bow('#8a3ad8'); b.position.set(0, 1.705, 0.06); deco.add(b);
  // fairy lights along the coffin's edges (on the box itself, so they stay when the lid swings open)
  const pts = [];
  for (let k = 0; k < OUTLINE.length - 1; k++) {
    const [x0, y0] = OUTLINE[k], [x1, y1] = OUTLINE[k + 1], n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 0.07));
    for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); }
  }
  pts.push(OUTLINE[OUTLINE.length - 1]);
  const colors = [0xffb347, 0xb36bff, 0x7dff6a, 0xff6f9a];
  const bulbs = pts.map(([x, y], i) => {
    const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], toneMapped: false, fog: false });
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), mat);
    const out = 1.07;   // just proud of the edge
    s.position.set(x * out, 1.36 + (y - 1.36) * 1.02, 0.02);
    deco.add(s);
    return { s, mat, base: new THREE.Color(colors[i % colors.length]), phase: i * 0.7 };
  });
  // the wire between them
  const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(bulbs.map((q) => q.s.position)), new THREE.LineBasicMaterial({ color: 0x1a1020 }));
  deco.add(wire);
  // the sign, hanging from the coffin's bottom on two little chains
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.133), new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true }));
  sign.position.set(0, 0.86, 0.07);
  const chainMat = new THREE.MeshBasicMaterial({ color: 0x2a2030 });
  for (const s of [-1, 1]) {
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.13, 4), chainMat);
    ch.position.set(s * 0.12, 0.99, 0.07); deco.add(ch);
  }
  deco.add(sign);
  // a little bat perched on the corner
  let bat = null;
  if (makeBat) {
    bat = makeBat(); bat.scale.setScalar(0.42);
    bat.position.set(0.15, 1.69, 0.02); bat.rotation.y = 0.5;
    deco.add(bat);
  }
  // two tiny jack-o'-lanterns at the foot of the post
  if (makePumpkin) {
    for (const [x, z, s, k] of [[-0.24, 0.16, 0.85, 0], [0.22, 0.2, 0.7, 2]]) {
      const p = makePumpkin(); p.position.set(x, 0, z); p.scale.setScalar(s); p.rotation.y = x;
      deco.add(p);
      if (lookAt) addJackFace(p, lookAt, k);
    }
  }
  const wl = bat?.getObjectByName('bat_wing_l'), wr = bat?.getObjectByName('bat_wing_r');
  return {
    group: deco,
    update(t) {
      bulbs.forEach((q) => { const f = 0.55 + 0.45 * Math.max(0, Math.sin(t * 2.2 + q.phase)); q.mat.color.copy(q.base).multiplyScalar(0.6 + f * 1.1); });
      if (wl) { const f = 0.25 + 0.2 * Math.sin(t * 1.3) + (Math.sin(t * 0.37) > 0.93 ? Math.sin(t * 30) * 0.8 : 0); wl.rotation.y = f; wr.rotation.y = -f; }
    },
  };
}
