import * as THREE from 'three';
import { placeholderPhoto, planeRect } from '../util/textures.js';
import { toonMaterial, addOutline } from '../style/toon.js';
import { stickyTexture, canvas, toTexture, rng, roundRect, HAND, MONO } from '../world/courtyardTextures.js';

// The squad's board on the wooden pallet: five old, yellowed polaroids (each card shaped to its photo), a
// hand-drawn tactical plan pinned between them, red string from the photos' pins to the plan, dog tags on a
// ball chain engraved with the name and the day, and a sticky note. Same interface as BW2's portrait gallery.

const SLOTS = [[-0.42, 0.86, -0.05], [0.0, 0.88, 0.04], [0.42, 0.85, -0.03], [-0.42, 0.4, 0.05], [0.45, 0.41, -0.06]];
const MAXW = 0.27, MAXH = 0.34;   // the largest a card may be (m)
const TYPE = "'Lumios Typewriter Old', 'Cousine', monospace";

/** An old polaroid: sepia-faded photo, a yellowed frame with stains and worn corners, a caption in ink. */
function agedPolaroid(img, caption, i, w = 640) {
  const iw = img.naturalWidth || img.width || 1, ih = img.naturalHeight || img.height || 1;
  const ia = iw / ih, a = Math.min(16 / 9, Math.max(9 / 16, ia));
  const k = w / 512, m = 30 * k, ph = w - m * 2, phH = Math.round(ph / a);
  const h = Math.round(m + phH + 138 * k);
  const [c, ctx] = canvas(w, h), r = rng(17 + i * 7);
  // the yellowed card
  ctx.fillStyle = '#e9dcb6'; ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.8);
  g.addColorStop(0, 'rgba(255,248,225,0.3)'); g.addColorStop(1, 'rgba(150,110,50,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // the photo, cropped to shape, then faded to sepia with a warm cast
  let sw = iw, sh = ih;
  if (ia > a) sw = ih * a; else sh = iw / a;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, m, m, ph, phH);
  const px = ctx.getImageData(m, m, ph, phH), d = px.data;
  for (let q = 0; q < d.length; q += 4) {
    const R = d[q], G = d[q + 1], B = d[q + 2];
    const sr = R * 0.393 + G * 0.769 + B * 0.189, sg = R * 0.349 + G * 0.686 + B * 0.168, sb = R * 0.272 + G * 0.534 + B * 0.131;
    d[q] = Math.min(255, (R * 0.45 + sr * 0.55) * 0.92 + 18); d[q + 1] = Math.min(255, (G * 0.45 + sg * 0.55) * 0.9 + 12); d[q + 2] = Math.min(255, (B * 0.45 + sb * 0.55) * 0.82 + 4);
  }
  ctx.putImageData(px, m, m);
  const v = ctx.createRadialGradient(m + ph / 2, m + phH / 2, ph * 0.25, m + ph / 2, m + phH / 2, ph * 0.75);
  v.addColorStop(0, 'rgba(255,230,180,0.06)'); v.addColorStop(1, 'rgba(90,55,20,0.45)');
  ctx.fillStyle = v; ctx.fillRect(m, m, ph, phH);
  // scratches and specks on the print
  ctx.strokeStyle = 'rgba(255,245,220,0.35)'; ctx.lineWidth = 1;
  for (let q = 0; q < 6; q++) { const x = m + r() * ph, y = m + r() * phH; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 60, y + r() * 80); ctx.stroke(); }
  // stains on the frame, a darker worn edge
  for (let q = 0; q < 5; q++) {
    const x = r() * w, y = r() * h, rr = 10 + r() * 40;
    const b = ctx.createRadialGradient(x, y, 0, x, y, rr);
    b.addColorStop(0, `rgba(140,95,40,${0.08 + r() * 0.1})`); b.addColorStop(1, 'rgba(140,95,40,0)');
    ctx.fillStyle = b; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  ctx.strokeStyle = 'rgba(110,70,30,0.35)'; ctx.lineWidth = 6 * k; ctx.strokeRect(0, 0, w, h);
  // the caption, in faded ink
  ctx.fillStyle = 'rgba(32,38,70,0.85)';
  let size = Math.round(50 * k);
  ctx.font = `700 ${size}px ${HAND}`;
  while (ctx.measureText(caption || '').width > w - m * 2.4 && size > 14) { size -= 2; ctx.font = `700 ${size}px ${HAND}`; }
  ctx.textAlign = 'center';
  ctx.save(); ctx.translate(w / 2, h - 46 * k); ctx.rotate((r() - 0.5) * 0.04); ctx.fillText(caption || '', 0, 0); ctx.restore();
  const t = toTexture(c);
  t.userData.aspect = h / w;
  t.userData.photo = { u0: m / w, v0: m / h, v1: (m + phH) / h };
  return t;
}

/** A hand-drawn tactical plan (original): grid, contours, a river, roads, blocks, routes and the objective. */
function mapTexture(name) {
  const W = 1024, H = 720, [c, ctx] = canvas(W, H), r = rng(101);
  ctx.fillStyle = '#dcd3ad'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, 'rgba(255,250,230,0.3)'); g.addColorStop(1, 'rgba(120,90,40,0.4)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // contour lines
  ctx.strokeStyle = 'rgba(140,90,40,0.35)'; ctx.lineWidth = 2;
  for (const [cx, cy] of [[260, 220], [760, 520]]) for (let k = 1; k <= 6; k++) {
    ctx.beginPath();
    for (let a = 0; a <= 64; a++) { const t = a / 64 * Math.PI * 2, rr = k * 26 * (1 + 0.18 * Math.sin(t * 3 + k) + 0.1 * Math.cos(t * 5)); ctx.lineTo(cx + Math.cos(t) * rr * 1.4, cy + Math.sin(t) * rr); }
    ctx.stroke();
  }
  // a river and roads
  ctx.strokeStyle = 'rgba(60,110,160,0.7)'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(0, 560); ctx.bezierCurveTo(250, 470, 420, 690, 640, 600); ctx.bezierCurveTo(820, 530, 900, 650, W, 600); ctx.stroke();
  ctx.strokeStyle = 'rgba(70,60,50,0.6)'; ctx.lineWidth = 5; ctx.setLineDash([18, 10]);
  ctx.beginPath(); ctx.moveTo(80, 0); ctx.lineTo(320, 400); ctx.lineTo(560, 380); ctx.lineTo(980, 120); ctx.stroke();
  ctx.setLineDash([]);
  // blocks of a little town
  ctx.fillStyle = 'rgba(60,55,50,0.55)';
  for (let k = 0; k < 16; k++) { const x = 470 + (k % 4) * 52 + r() * 10, y = 200 + Math.floor(k / 4) * 44 + r() * 8; ctx.fillRect(x, y, 30 + r() * 14, 22 + r() * 12); }
  // the grid with its coordinates
  ctx.strokeStyle = 'rgba(40,60,80,0.25)'; ctx.lineWidth = 1.5;
  for (let x = 0; x <= W; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(40,50,60,0.75)'; ctx.font = `700 22px ${MONO}`;
  'ABCDEFGH'.split('').forEach((l, i) => ctx.fillText(l, i * 128 + 54, 24));
  for (let i = 0; i < 6; i++) ctx.fillText(String(i + 1), 8, i * 120 + 70);
  // routes (blue arrows), unit boxes, the objective (red)
  const arrow = (pts, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.stroke();
    const [x1, y1] = pts[pts.length - 1], [x0, y0] = pts[pts.length - 2], a = Math.atan2(y1 - y0, x1 - x0);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x1 + Math.cos(a) * 18, y1 + Math.sin(a) * 18); ctx.lineTo(x1 + Math.cos(a + 2.4) * 22, y1 + Math.sin(a + 2.4) * 22); ctx.lineTo(x1 + Math.cos(a - 2.4) * 22, y1 + Math.sin(a - 2.4) * 22); ctx.fill();
  };
  arrow([[120, 650], [240, 520], [420, 420], [560, 330]], 'rgba(40,80,170,0.85)');
  arrow([[960, 660], [860, 500], [700, 380], [640, 320]], 'rgba(40,80,170,0.85)');
  for (const [x, y] of [[100, 660], [960, 680]]) {
    ctx.strokeStyle = 'rgba(40,80,170,0.9)'; ctx.lineWidth = 4; ctx.strokeRect(x - 30, y - 20, 60, 40);
    ctx.beginPath(); ctx.moveTo(x - 30, y - 20); ctx.lineTo(x + 30, y + 20); ctx.moveTo(x + 30, y - 20); ctx.lineTo(x - 30, y + 20); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200,30,30,0.9)'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(600, 290, 54, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(570, 260); ctx.lineTo(630, 320); ctx.moveTo(630, 260); ctx.lineTo(570, 320); ctx.stroke();
  ctx.fillStyle = 'rgba(200,30,30,0.95)'; ctx.font = `700 46px ${HAND}`;
  ctx.fillText('cake here! ♥', 660, 250);
  // title block and a compass rose
  ctx.fillStyle = 'rgba(240,232,205,0.9)'; ctx.fillRect(W - 360, H - 120, 340, 100);
  ctx.strokeStyle = 'rgba(40,40,40,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(W - 360, H - 120, 340, 100);
  ctx.fillStyle = '#222'; ctx.font = `700 26px ${TYPE}`; ctx.fillText('OPERATION: B-DAY', W - 345, H - 80);
  ctx.font = `400 22px ${TYPE}`; ctx.fillText(`TARGET: ${(name || '').toUpperCase()}`.slice(0, 22), W - 345, H - 44);
  ctx.save(); ctx.translate(110, 130);
  ctx.fillStyle = 'rgba(40,40,40,0.75)';
  for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -56); ctx.lineTo(10, 0); ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill(); }
  ctx.font = `700 24px ${MONO}`; ctx.textAlign = 'center'; ctx.fillText('N', 0, -64); ctx.restore();
  // a coffee ring and folds
  ctx.strokeStyle = 'rgba(120,80,35,0.3)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(330, 120, 60, 0.4, 5.6); ctx.stroke();
  for (const x of [W / 3, (W * 2) / 3]) { ctx.fillStyle = 'rgba(255,255,240,0.25)'; ctx.fillRect(x, 0, 2, H); ctx.fillStyle = 'rgba(90,60,30,0.18)'; ctx.fillRect(x + 2, 0, 2, H); }
  ctx.fillStyle = 'rgba(255,255,240,0.25)'; ctx.fillRect(0, H / 2, W, 2); ctx.fillStyle = 'rgba(90,60,30,0.18)'; ctx.fillRect(0, H / 2 + 2, W, 2);
  return toTexture(c);
}

/** The face of a dog tag: name, the day, a number — stamped into steel. */
function tagTexture(name, iso, second = false) {
  const W = 256, H = 148, [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#d9dde0'); g.addColorStop(0.5, '#a9b0b6'); g.addColorStop(1, '#cdd2d6');
  ctx.fillStyle = g; roundRect(ctx, 0, 0, W, H, 34); ctx.fill();
  ctx.fillStyle = 'rgba(40,45,50,0.85)'; ctx.font = `700 26px ${MONO}`; ctx.textAlign = 'left';
  const d = new Date(`${iso}T12:00:00`), dd = isNaN(d) ? '' : `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const lines = second ? ['B-DAY SQUAD', `DAY ${dd}`, 'MVP  56'] : [(name || '').toUpperCase().slice(0, 12), `B-DAY ${dd}`, 'GG WP  ★'];
  lines.forEach((l, i) => { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText(l, 41, 49 + i * 36); ctx.fillStyle = 'rgba(40,45,50,0.85)'; ctx.fillText(l, 40, 48 + i * 36); });
  ctx.fillStyle = 'rgba(30,30,30,0.6)'; ctx.beginPath(); ctx.arc(20, H / 2, 7, 0, Math.PI * 2); ctx.fill();
  return toTexture(c);
}

export class PhotoBoard {
  /** pallet: the pallet_board group (its face is local z ≈ 0.075). photos: [{ image, caption, src }] */
  constructor(scene, pallet, photos, { name = '', iso = '' } = {}) {
    this.pallet = pallet;
    pallet.updateMatrixWorld(true);
    this.group = new THREE.Group(); this.group.name = 'photos';
    pallet.add(this.group);
    this.cards = []; this.images = [];
    this.pinGeo = new THREE.SphereGeometry(0.012, 12, 8);
    this.pinMat = toonMaterial({ color: new THREE.Color('#d8343c') }, { rimScale: 1.6 });
    this.tapeMat = new THREE.MeshBasicMaterial({ color: 0xe8dcb0, transparent: true, opacity: 0.75 });
    // the plan, pinned between the lower photos
    this.map = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.295), toonMaterial({ map: mapTexture(name) }, { rimScale: 0 }));
    this.map.position.set(0.02, 0.43, 0.077); this.map.rotation.z = 0.03; this.map.castShadow = true;
    this.group.add(this.map);
    this.mapPins = [[-0.12, 0.1], [0.08, 0.04], [0.17, -0.1]].map(([x, y]) => {
      const pin = new THREE.Mesh(this.pinGeo, this.pinMat); pin.position.set(x, y, 0.012); pin.scale.set(0.8, 0.8, 0.7);
      this.map.add(pin); return pin;
    });
    photos.forEach((ph, i) => this._add(ph, i));
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), toonMaterial({ map: stickyTexture('Another year, another clutch!') }, { rimScale: 0 }));
    note.position.set(-0.17, 0.57, 0.088); note.rotation.z = 0.14;
    this.group.add(note);
    this._dogTags(name, iso);
    this._strings();
  }

  _add(ph, i) {
    const [x, y, rz] = SLOTS[i % SLOTS.length];
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0.08 + i * 0.0015);
    pivot.rotation.z = rz;
    this.group.add(pivot);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), toonMaterial({ color: 0xffffff }, { rimScale: 0 }));
    card.castShadow = true;
    card.userData.slot = i;
    pivot.add(card);
    const pin = new THREE.Mesh(this.pinGeo, this.pinMat); pin.scale.set(1, 1, 0.8);
    addOutline(pin, 0.0012);
    pivot.add(pin);
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.022), this.tapeMat);
    tape.rotation.z = (i % 2 ? 0.6 : -0.6);
    pivot.add(tape);
    const c = { pivot, card, frame: card, pin, tape, w: 1, h: 1 };
    this.cards.push(c);
    this.images.push(ph);
    this._fit(i);
  }

  _fit(i) {
    const c = this.cards[i], ph = this.images[i];
    const img = ph.image || placeholderPhoto(i, '');
    const t = agedPolaroid(img, ph.caption || '', i);
    const aspect = t.userData.aspect;
    let w = MAXW, h = w * aspect;
    if (h > MAXH) { h = MAXH; w = h / aspect; }
    c.w = w; c.h = h; c.photoUV = t.userData.photo;
    c.card.scale.set(w, h, 1);
    c.card.material.map?.dispose();
    c.card.material.map = t; c.card.material.needsUpdate = true;
    c.pin.position.set(0, h / 2 - 0.022, 0.012);
    c.tape.position.set((i % 2 ? 1 : -1) * (w / 2 - 0.02), -h / 2 + 0.02, 0.003);
    if (this._stringGroup) this._strings();
  }

  /** Dog tags on a ball chain, hanging from a nail between the top photos. */
  _dogTags(name, iso) {
    const g = new THREE.Group();
    g.position.set(-0.21, 1.07, 0.085);
    this.group.add(g);
    const steel = toonMaterial({ color: new THREE.Color('#b8bec4'), emissive: new THREE.Color('#b8bec4').multiplyScalar(0.08) }, { rimScale: 2.4 });
    const nail = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 10), steel); nail.rotation.x = Math.PI / 2; g.add(nail);
    const shape = new THREE.Shape(); roundRectShape(shape, -0.025, -0.0145, 0.05, 0.029, 0.009);
    const tagGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.0015, bevelEnabled: true, bevelSize: 0.0008, bevelThickness: 0.0006, bevelSegments: 2 });
    this.tagFaces = [];
    const tags = [[-0.012, -0.27, 0.12, 0], [0.01, -0.29, -0.18, 0.004]];
    tags.forEach(([x, y, rz, z], k) => {
      const tg = new THREE.Group(); tg.position.set(x, y, z + 0.004); tg.rotation.z = Math.PI / 2 + rz;
      const tag = new THREE.Mesh(tagGeo, steel); addOutline(tag, 0.0008); tg.add(tag);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.029), new THREE.MeshBasicMaterial({ map: tagTexture(name, iso, k === 1), transparent: true }));
      face.position.z = 0.0028; tg.add(face); this.tagFaces.push(face);
      g.add(tg);
    });
    // the ball chain: two strands from the nail to the tags' holes
    const balls = [];
    for (const [ex, ey] of [[-0.03, -0.25], [0.035, -0.265]]) {
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0.004), new THREE.Vector3(ex * 0.5, ey * 0.55, 0.012), new THREE.Vector3(ex, ey, 0.006));
      const n = 46;
      for (let i = 0; i <= n; i++) balls.push(curve.getPoint(i / n));
    }
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0021, 6, 5), steel, balls.length);
    const m4 = new THREE.Matrix4();
    balls.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); inst.setMatrixAt(i, m4); });
    g.add(inst);
  }

  /** Red string from photo pins to the plan's pins. */
  _strings() {
    if (this._stringGroup) { this.group.remove(this._stringGroup); this._stringGroup.traverse((m) => m.geometry?.dispose()); }
    const sg = this._stringGroup = new THREE.Group();
    this.group.add(sg);
    this.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.group.matrixWorld).invert();
    const at = (obj) => obj.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).add(new THREE.Vector3(0, 0, 0.004));
    const mat = new THREE.MeshBasicMaterial({ color: 0xb3201f });
    for (const [ci, pi] of [[0, 0], [2, 1], [4, 2], [3, 0]]) {
      const c = this.cards[ci]; if (!c) continue;
      const a = at(c.pin), b = at(this.mapPins[pi]);
      const mid = a.clone().lerp(b, 0.5); mid.y -= 0.03; mid.z += 0.006;
      sg.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 20, 0.0016, 4), mat));
    }
  }

  /** The name and the day on the tags and the plan follow edits. */
  setDetails(name, iso) {
    this.tagFaces.forEach((f, k) => { f.material.map?.dispose(); f.material.map = tagTexture(name, iso, k === 1); f.material.needsUpdate = true; });
    this.map.material.map?.dispose(); this.map.material.map = mapTexture(name); this.map.material.needsUpdate = true;
  }

  setCaption(i, caption) {
    const ph = this.images[i]; if (!ph) return;
    ph.caption = caption;
    this._fit(i);
  }

  setPhoto(i, image, src = '') {
    const ph = this.images[i]; if (!ph) return;
    ph.image = image || null; ph.src = image ? src : '';
    this._fit(i);
  }

  update() {}

  spots(camera, w, h) {
    return this.cards.map((c, slot) => {
      const p = c.photoUV;
      const rect = planeRect(c.card, camera, w, h, p ? { u0: p.u0, u1: 1 - p.u0, v0: p.v0, v1: p.v1 } : {});
      return rect && { key: `photo${slot}`, path: `photos.${slot}.src`, slot, rect, filled: !!this.images[slot]?.src };
    }).filter(Boolean);
  }

  _normal() { return new THREE.Vector3(0, 0, 1).applyQuaternion(this.pallet.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize(); }

  get focusPoint() { return this.pallet.localToWorld(new THREE.Vector3(0, 0.64, 0.08)); }

  get ordered() { return [...this.cards].sort((a, b) => (b.pivot.position.y > 0.6) - (a.pivot.position.y > 0.6) || a.pivot.position.x - b.pivot.position.x); }

  boardShot(portrait = false) {
    const c = this.focusPoint, n = this._normal();
    return portrait
      ? { pos: c.clone().addScaledVector(n, 2.3).add(new THREE.Vector3(0, 0.25, 0)), target: c.clone().add(new THREE.Vector3(0, 0.02, 0)), fov: 44, portraitFov: 64, mobileOffset: new THREE.Vector3(0, 0.2, 0) }
      : { pos: c.clone().addScaledVector(n, 1.9).add(new THREE.Vector3(0, 0.25, 0)), target: c.clone().add(new THREE.Vector3(0, -0.02, 0)), fov: 40, frameX: -0.12 };
  }

  shotFor(i) {
    const c = this.ordered[i];
    if (!c) return null;
    const centre = c.card.getWorldPosition(new THREE.Vector3());
    const n = this._normal();
    const dist = 0.5 + Math.max(c.h, c.w) * 1.5;
    return { pos: centre.clone().addScaledVector(n, dist).add(new THREE.Vector3(0, 0.03, 0)), target: centre, fov: 36, frameX: -0.1 };
  }
}

function roundRectShape(s, x, y, w, h, r) {
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
}
