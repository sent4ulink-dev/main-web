import * as THREE from 'three';
import gsap from 'gsap';
import { toonMaterial } from '../style/toon.js';
import { piece } from '../world/salon.js';
import { sheetTexture } from '../world/salonTextures.js';

// The music corner comes alive: the fortepiano's lid swings open and its keys play by themselves (Viennese
// colours: ebony naturals, bone sharps), the violin and the cello rise into the air and bow on their own,
// the harp's strings shimmer, pages of music lift off the stands and float round, golden notes stream up.

const LOW = 29, HIGH = 89;                        // FF … f3, the five octaves of a 1790s Viennese fortepiano
const BLACK = new Set([1, 3, 6, 8, 10]);
const isBlack = (m) => BLACK.has(m % 12);

/** Local axes → quaternion: `along` = the instrument's scroll direction, `face` = where its top looks. */
function pose(along, face) {
  const d = along.clone().normalize();
  const z = d.clone().negate();                                   // local +Z = towards the tail
  const y = face.clone().sub(d.clone().multiplyScalar(face.dot(d))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
function bowPose(axis, up) {
  const x = axis.clone().normalize();
  const y = up.clone().sub(x.clone().multiplyScalar(up.dot(x))).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

export class Ensemble {
  constructor(scene, salon) {
    this.scene = scene;
    const o = salon.o;
    this.piano = o.piano;
    this.harp = o.harp;
    this.k = { v: 0 };                         // 0 = at rest, 1 = playing
    this.playing = false;
    this.piano.updateMatrixWorld(true);
    this.lid = this.piano.getObjectByName('fortepiano_lid');
    this.prop = this.piano.getObjectByName('fortepiano_prop');
    if (this.prop) this.prop.visible = false;
    this._keys();

    // violin + bow on a chair, the cello and its bow against the wall
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const qY = (a) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a);
    this.parts = [];
    const add = (name, rest, play, bow = null) => {
      const g = piece('instruments', name);
      g.traverse((m) => { if (m.isMesh) m.castShadow = false; });   // (their shadows would lag behind while they fly)
      scene.add(g);
      const p = { g, rest, play, bow };
      g.position.copy(rest.pos); g.quaternion.copy(rest.quat);
      this.parts.push(p);
      return p;
    };
    const chair = o.violinChair.position;
    const violinPlay = { pos: V(-0.95, 1.7, -2.05), quat: pose(V(-0.55, 0.6, 0.32), V(0.5, 0.2, 0.85)) };
    this.violin = add('violin', { pos: V(chair.x, 0.528, chair.z), quat: qY(-0.6 + Math.PI / 2) }, violinPlay);
    const vd = V(-0.55, 0.6, 0.32).normalize(), vn = V(0.5, 0.2, 0.85);
    const vAxis = new THREE.Vector3().crossVectors(vn, vd).normalize().applyAxisAngle(vd, 0.15);
    this.violinBow = add('violin_bow', { pos: V(chair.x + 0.1, 0.515, chair.z + 0.12), quat: qY(-0.6) },
      { pos: violinPlay.pos.clone().addScaledVector(vd, 0.02).addScaledVector(vn.clone().normalize(), 0.075), quat: bowPose(vAxis, vn) }, { axis: vAxis, amp: 0.15, speed: 2.4 });
    const celloRestQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.16, 0.25, 0, 'YXZ'));
    const celloPlay = { pos: V(-2.35, 0.76, -3.75), quat: pose(V(0.06, 1, 0.1), V(0.6, 0.05, 0.8)) };
    this.cello = add('cello', { pos: V(-1.8, 0.41, -4.6), quat: celloRestQ }, celloPlay);
    const cd = V(0.06, 1, 0.1).normalize(), cn = V(0.6, 0.05, 0.8).normalize();
    const cAxis = new THREE.Vector3().crossVectors(cn, cd).normalize().applyAxisAngle(cn, 0.1);
    this.celloBow = add('cello_bow', { pos: V(-1.5, 0.62, -4.72), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.2, 1.35)) },
      { pos: celloPlay.pos.clone().addScaledVector(cd, -0.09).addScaledVector(cn, 0.19), quat: bowPose(cAxis, cn) }, { axis: cAxis, amp: 0.2, speed: 1.7 });

    // harp strings shimmer while it plays
    this.strings = this.harp.getObjectByName('harp_strings');
    this.stringMats = [];
    this.strings?.traverse((m) => { if (m.isMesh && !m.userData.isOutline) for (const mt of [].concat(m.material)) this.stringMats.push(mt); });

    // pages of music that float round the corner
    this.pages = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), toonMaterial({ map: sheetTexture(i * 3 + 2), side: THREE.DoubleSide }, { rimScale: 0.4 }));
      m.visible = false;
      m.castShadow = false;
      scene.add(m);
      this.pages.push({ m, a: (i / 7) * Math.PI * 2, r: 1.15 + (i % 3) * 0.2, y: 2.15 + (i % 4) * 0.22, s: 0.18 + Math.random() * 0.12, ph: Math.random() * 6 });
    }
    this.pageCentre = V(-2.6, 0, -2.6);
    this.pageFrom = o.stand1.position.clone().add(V(0, 1.2, 0));

    // golden notes rising from the open fortepiano
    this.notes = this._notes(scene);
    this.focus = V(-2.6, 1.05, -2.5);
    this.hitTargets = [];
    for (const g of [this.piano, this.harp, this.violin.g, this.cello.g]) g.traverse((m) => { if (m.isMesh && !m.userData.isOutline) this.hitTargets.push(m); });
  }

  // ── the keyboard ───────────────────────────────────────
  _keys() {
    const origin = this.piano.getObjectByName('keys_origin');
    const W = 0.86, whites = [];
    for (let m = LOW; m <= HIGH; m++) if (!isBlack(m)) whites.push(m);
    const ww = W / whites.length;
    this.keyInfo = new Map();
    const white = new THREE.BoxGeometry(ww * 0.9, 0.018, 0.2); white.translate(0, 0, -0.1);
    const black = new THREE.BoxGeometry(ww * 0.56, 0.024, 0.12); black.translate(0, 0.012, -0.06);
    const nat = new THREE.InstancedMesh(white, toonMaterial({ color: new THREE.Color('#2a1d1a') }, { rimScale: 0.8 }), whites.length);
    const sh = new THREE.InstancedMesh(black, toonMaterial({ color: new THREE.Color('#f3ead6'), emissive: new THREE.Color('#2a2418') }, { rimScale: 0.8 }), HIGH - LOW + 1 - whites.length);
    let wi = 0, bi = 0;
    for (let m = LOW; m <= HIGH; m++) {
      if (!isBlack(m)) { this.keyInfo.set(m, { mesh: nat, i: wi, x: (wi + 0.5) * ww, z: 0, a: 0, target: 0 }); wi++; }
      else { this.keyInfo.set(m, { mesh: sh, i: bi, x: wi * ww, z: -0.02, a: 0, target: 0 }); bi++; }
    }
    this.keyMeshes = [nat, sh];
    for (const k of this.keyInfo.values()) this._setKey(k);
    nat.castShadow = sh.castShadow = false;
    origin.add(nat, sh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._ax = new THREE.Vector3(1, 0, 0);
  }

  _setKey(k) {
    // pivot at the back of the key: the front dips when pressed
    const m = new THREE.Matrix4().makeTranslation(k.x, 0, k.z - (k.mesh === this.keyMeshes?.[1] ? 0.12 : 0.2));
    m.multiply(new THREE.Matrix4().makeRotationX(k.a));
    m.multiply(new THREE.Matrix4().makeTranslation(0, 0, k.mesh === this.keyMeshes?.[1] ? 0.12 : 0.2));
    k.mesh.setMatrixAt(k.i, m);
    k.mesh.instanceMatrix.needsUpdate = true;
  }

  /** A key goes down for `dur` seconds. */
  press(midi, dur = 0.3) {
    while (midi < LOW) midi += 12;
    while (midi > HIGH) midi -= 12;
    const k = this.keyInfo.get(midi); if (!k) return;
    k.target = 0.07; k.until = performance.now() + Math.max(0.12, dur * 0.9) * 1000;
    this._burstNote();
  }

  // ── notes ──────────────────────────────────────────────
  _notes(scene) {
    const tex = ['♪', '♫', '♩', '𝄞'].map((ch) => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.font = `bold ${ch === '𝄞' ? 104 : 96}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = 'rgba(255,200,110,0.9)'; x.shadowBlur = 14; x.fillText(ch, 64, 70);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    });
    const list = [];
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex[i % tex.length], color: new THREE.Color(1.0, 0.8, 0.45).multiplyScalar(1.8), transparent: true, depthWrite: false }));
      s.visible = false; s.scale.setScalar(0.1);
      scene.add(s);
      list.push({ s, age: 99, life: 3.2 });
    }
    return list;
  }

  _burstNote() {
    if (this._noteGap > 0) return;
    this._noteGap = 0.16;
    const n = this.notes.find((q) => q.age > q.life); if (!n) return;
    const src = [this.piano, this.violin.g, this.cello.g, this.harp][Math.floor(Math.random() * 4)];
    n.from = src.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, src === this.piano ? 1.0 : src === this.harp ? 1.2 : 0.2, 0));
    n.age = 0; n.dx = (Math.random() - 0.5) * 0.6; n.dz = (Math.random() - 0.5) * 0.6; n.ph = Math.random() * 6; n.size = 0.08 + Math.random() * 0.07;
  }

  // ── play / stop ────────────────────────────────────────
  play() {
    if (this.playing) return;
    this.playing = true;
    gsap.killTweensOf(this.k);
    gsap.to(this.k, { v: 1, duration: 2.4, ease: 'power2.inOut' });
    if (this.lid) gsap.to(this.lid.rotation, { z: 0.72, duration: 1.6, ease: 'power2.inOut' });
    if (this.prop) { this.prop.visible = true; this.prop.rotation.set(0, 0, 0); this.prop.scale.y = 0.01; gsap.to(this.prop.scale, { y: 1, duration: 1.4, ease: 'power2.inOut' }); }
    this.pages.forEach((p, i) => { p.m.visible = true; p.t0 = i * 0.25; p.age = 0; });
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    gsap.killTweensOf(this.k);
    gsap.to(this.k, { v: 0, duration: 2.0, ease: 'power2.inOut' });
    if (this.lid) gsap.to(this.lid.rotation, { z: 0, duration: 1.4, ease: 'power2.inOut', delay: 0.4 });
    if (this.prop) gsap.to(this.prop.scale, { y: 0.01, duration: 0.8, onComplete: () => { this.prop.visible = false; } });
    for (const k of this.keyInfo.values()) k.target = 0;
  }

  /** While a recording or a YouTube song plays: the keys still dance, in a gentle made-up pattern. */
  autoplay(on) { this._auto = on; this._autoT = 0; }

  update(t, dt) {
    const k = this.k.v, e = k * k * (3 - 2 * k);
    // instruments: rest ↔ play, bobbing in the air while playing, bows stroking
    for (const p of this.parts) {
      const pos = p.rest.pos.clone().lerp(p.play.pos, e);
      // lift first, then glide (an arc up out of the rest spot)
      pos.y += Math.sin(Math.PI * e) * 0.35;
      if (k > 0.01) pos.y += Math.sin(t * 1.3 + p.play.pos.x) * 0.025 * e;
      if (p.bow && k > 0.01) pos.addScaledVector(p.bow.axis, Math.sin(t * p.bow.speed) * p.bow.amp * e);
      p.g.position.copy(pos);
      p.g.quaternion.slerpQuaternions(p.rest.quat, p.play.quat, e);
      if (k > 0.01 && !p.bow) p.g.rotateZ(Math.sin(t * 1.1) * 0.03 * e);
    }
    // keys
    const now = performance.now();
    if (this._auto && this.playing) {
      this._autoT -= dt;
      if (this._autoT <= 0) { this._autoT = 0.18 + Math.random() * 0.2; const m = 48 + Math.floor(Math.random() * 30); this.press(m, 0.25); if (Math.random() < 0.5) this.press(m - 12, 0.4); }
    }
    for (const key of this.keyInfo.values()) {
      if (key.until && now > key.until) { key.target = 0; key.until = 0; }
      if (Math.abs(key.a - key.target) > 1e-4) {
        key.a += (key.target - key.a) * Math.min(1, dt * (key.target > key.a ? 40 : 18));
        this._setKey(key);
      }
    }
    // harp strings glow
    const glow = this.playing ? 0.4 + 0.3 * Math.sin(t * 9) : 0;
    for (const m of this.stringMats) m.emissive?.setRGB(glow, glow * 0.8, glow * 0.4);
    // pages
    for (const p of this.pages) {
      if (!p.m.visible) continue;
      p.age += dt;
      const show = this.playing ? THREE.MathUtils.clamp((p.age - p.t0) / 1.6, 0, 1) : Math.max(0, (p.hide ?? 1) - dt / 1.2);
      if (!this.playing) { p.hide = show; if (show <= 0) { p.m.visible = false; p.hide = 1; continue; } }
      const a = p.a + t * p.s;
      const target = new THREE.Vector3(this.pageCentre.x + Math.cos(a) * p.r, p.y + Math.sin(t * 0.8 + p.ph) * 0.12, this.pageCentre.z + Math.sin(a) * p.r * 0.7);
      p.m.position.lerpVectors(this.pageFrom, target, show * show * (3 - 2 * show));
      p.m.rotation.set(Math.sin(t * 1.3 + p.ph) * 0.4, a + Math.PI / 2, Math.sin(t * 0.9 + p.ph) * 0.3);
      p.m.scale.setScalar(Math.max(0.001, show));   // grow in / shrink away (opaque: no sorting flicker)
    }
    // notes
    this._noteGap = (this._noteGap || 0) - dt;
    if (this.playing && Math.random() < dt * 2.2) this._burstNote();
    for (const n of this.notes) {
      n.age += dt;
      const q = n.age / n.life;
      n.s.visible = q < 1;
      if (!n.s.visible) continue;
      n.s.position.set(n.from.x + n.dx * q + Math.sin(n.age * 2.4 + n.ph) * 0.08, n.from.y + n.age * 0.35, n.from.z + n.dz * q);
      n.s.scale.setScalar(n.size * (0.6 + 0.4 * Math.sin(Math.min(q, 1) * Math.PI)));
      n.s.material.opacity = Math.sin(Math.min(q, 1) * Math.PI);
      n.s.material.rotation = Math.sin(n.age * 2 + n.ph) * 0.35;
    }
  }

  get focusPoint() { return this.focus.clone(); }

  reset() {
    this.playing = false; this._auto = false;
    this.k.v = 0;
    if (this.lid) this.lid.rotation.z = 0;
    if (this.prop) this.prop.visible = false;
    for (const p of this.pages) p.m.visible = false;
  }
}
