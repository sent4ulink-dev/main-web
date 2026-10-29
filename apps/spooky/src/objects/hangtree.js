import * as THREE from 'three';
import { toonMaterial, addOutline } from '../style/toon.js';
import { placeholderPhoto, polaroidTexture, planeRect } from '../util/textures.js';

// The memories hang from the dead tree: old polaroids on lengths of twine, one from each crooked branch,
// turning and swaying in the night wind. Tap one to see it close up.

const MAXW = 0.46, MAXH = 0.6;
const DROP = [0.42, 0.62, 0.92, 0.86, 0.9];     // twine length under each branch tip (hang_0..4)

/** A polaroid gone yellow and spotty with age, a little torn at one corner. */
function spookyPolaroid(img, caption, i) {
  const t = polaroidTexture(img, caption, 512);
  const c = t.image, ctx = c.getContext('2d'), w = c.width, h = c.height;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(232,214,170,0.55)'; ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.8);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,84,40,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  let s = i * 31 + 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 14; k++) { const x = r() * w, y = r() * h, rr = 4 + r() * 18; ctx.fillStyle = `rgba(110,80,40,${0.08 + r() * 0.12})`; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.moveTo(w, h); ctx.lineTo(w - 38, h); ctx.lineTo(w - 22, h - 14); ctx.lineTo(w - 30, h - 26); ctx.lineTo(w, h - 44); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  t.needsUpdate = true;
  return t;
}

export class HangingPhotos {
  /** tree: the dead tree group (with hang_0..4); photos: [{ image, caption, src }]; viewFrom: where you look from. */
  constructor(scene, tree, photos, viewFrom) {
    this.group = new THREE.Group(); this.group.name = 'hanging-photos';
    scene.add(this.group);
    this.images = photos.map((p) => ({ ...p }));
    this.viewFrom = viewFrom.clone();
    tree.updateMatrixWorld(true);
    const twineMat = toonMaterial({ color: new THREE.Color('#3a2c22') }, { rimScale: 0.3 });
    const pegMat = toonMaterial({ color: new THREE.Color('#8a6a48') }, { rimScale: 0.6 });
    this.cards = photos.map((_, i) => {
      const hang = tree.getObjectByName(`hang_${i % 5}`);
      const top = hang ? hang.getWorldPosition(new THREE.Vector3()) : tree.localToWorld(new THREE.Vector3(i * 0.4 - 1, 3, 0));
      if (i >= 5) top.add(new THREE.Vector3((i % 2 ? 0.25 : -0.25), -0.05, 0.1));
      const drop = DROP[i % 5] + (i >= 5 ? 0.55 : 0);
      const pivot = new THREE.Group();
      pivot.position.copy(top);
      pivot.rotation.y = Math.atan2(this.viewFrom.x - top.x, this.viewFrom.z - top.z) + (i % 2 ? 0.12 : -0.12);
      this.group.add(pivot);
      const twine = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, drop, 5), twineMat);
      twine.position.y = -drop / 2;
      pivot.add(twine);
      const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xd9d2c4, fog: false, side: THREE.FrontSide }));
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), toonMaterial({ color: new THREE.Color('#d8ceb6') }, { rimScale: 0.4 }));
      back.rotation.y = Math.PI; back.raycast = () => {};
      card.add(back);
      pivot.add(card);
      const peg = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.06, 0.018), pegMat);
      addOutline(peg, 0.0015);
      pivot.add(peg);
      return { pivot, card, twine, peg, drop, w: MAXW, h: MAXH, phase: i * 1.7, photoUV: null };
    });
    this.cards.forEach((_, i) => this._fit(i));
  }

  _fit(i) {
    const c = this.cards[i], ph = this.images[i];
    const t = spookyPolaroid(ph.image || placeholderPhoto(i, ''), ph.caption || '', i);
    const aspect = t.userData.aspect;
    let w = MAXW, h = w * aspect;
    if (h > MAXH) { h = MAXH; w = h / aspect; }
    c.w = w; c.h = h; c.photoUV = t.userData.photo;
    c.card.scale.set(w, h, 1);
    c.card.position.y = -c.drop - h / 2 + 0.02;
    c.peg.position.set(0, -c.drop + 0.01, 0.006);
    c.card.material.map?.dispose();
    c.card.material.map = t; c.card.material.color.set(0xe2dccf); c.card.material.needsUpdate = true;
  }

  setCaption(i, caption) { const ph = this.images[i]; if (!ph) return; ph.caption = caption; this._fit(i); }
  setPhoto(i, image, src = '') { const ph = this.images[i]; if (!ph) return; ph.image = image || null; ph.src = image ? src : ''; this._fit(i); }

  update(t) {
    // turning on the twine in the wind
    this.cards.forEach((c) => {
      c.pivot.rotation.z = 0.05 * Math.sin(t * 0.9 + c.phase) + 0.02 * Math.sin(t * 2.3 + c.phase);
      c.pivot.rotation.x = 0.04 * Math.sin(t * 0.7 + c.phase * 1.3);
      c.card.rotation.y = 0.18 * Math.sin(t * 0.5 + c.phase);
      c.peg.rotation.y = c.card.rotation.y;
    });
  }

  spots(camera, w, h) {
    return this.cards.map((c, slot) => {
      const p = c.photoUV;
      const rect = planeRect(c.card, camera, w, h, p ? { u0: p.u0, u1: 1 - p.u0, v0: p.v0, v1: p.v1 } : {});
      return rect && { key: `photo${slot}`, path: `photos.${slot}.src`, slot, rect, filled: !!this.images[slot]?.src };
    }).filter(Boolean);
  }

  /** The middle of all the cards (at rest). */
  get focusPoint() {
    const p = new THREE.Vector3();
    this.cards.forEach((c) => p.add(this._rest(c)));
    return p.divideScalar(this.cards.length);
  }

  _rest(c) { return c.pivot.position.clone().add(new THREE.Vector3(0, -c.drop - c.h / 2, 0)); }
  _normal(c) { return new THREE.Vector3(Math.sin(c.pivot.rotation.y), 0, Math.cos(c.pivot.rotation.y)); }

  /** Left to right as seen from where you look. */
  get ordered() {
    const f = this.focusPoint, d = f.clone().sub(this.viewFrom).setY(0).normalize(), right = new THREE.Vector3(-d.z, 0, d.x);
    return [...this.cards].sort((a, b) => this._rest(a).dot(right) - this._rest(b).dot(right));
  }

  treeShot(portrait = false) {
    const f = this.focusPoint, d = this.viewFrom.clone().sub(f).setY(0).normalize();
    return portrait
      ? { pos: f.clone().addScaledVector(d, 5.2).add(new THREE.Vector3(0, 0.1, 0)), target: f.clone().add(new THREE.Vector3(0, 0.15, 0)), fov: 44, portraitFov: 74 }
      : { pos: f.clone().addScaledVector(d, 4.2).add(new THREE.Vector3(0, 0.05, 0)), target: f.clone().add(new THREE.Vector3(0, 0.05, 0)), fov: 42, frameX: -0.12 };
  }

  shotFor(i) {
    const c = this.ordered[i], at = this._rest(c), n = this._normal(c);
    const portrait = innerWidth / innerHeight < 1.1;
    return { pos: at.clone().addScaledVector(n, portrait ? 1.05 : 0.95).add(new THREE.Vector3(0, 0.05, 0)), target: at.clone().add(new THREE.Vector3(0, portrait ? -0.04 : 0, 0)), fov: 36, portraitFov: portrait ? 50 : undefined, frameX: portrait ? 0 : -0.1 };
  }
}
