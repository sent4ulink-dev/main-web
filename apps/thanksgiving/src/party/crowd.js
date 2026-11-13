import * as THREE from 'three';
import { crowdMaterial, outlineMaterial, hullGeometry } from '../style/toon.js';
import { partsOf, ALL_PARTS } from './looks.js';
import HAT_FIT from './hatfit.json';

// The whole family, drawn part by part: each part (a head, a hairstyle, a hat, an outfit…) is ONE instanced
// mesh shared by everybody wearing it, so fifty people cost a few dozen draws. Every character ("actor") is
// posed by hand each frame — sitting, standing, walking, turning to look, talking (the mouth opens and
// closes), eating, laughing, nodding, waving, cheering, holding the wishbone — with its parts' matrices
// written straight into their instance slots.

const NECK = new THREE.Vector3(0, 0.42, 0);
const SHOULDER_X = 0.165, SHOULDER_Y = 0.31, HIP_X = 0.075;
const MOUTH = new THREE.Vector3(0, 0.499, 0.176);     // the open mouth's top edge (it opens downward from here)
const HAND = new THREE.Vector3(0, -0.235, 0.01);      // where the fork is held, in the arm's space
const KID = 0.66, KID_HEAD = 1.2;
const OUTLINE_RANGE = 7;   // people further from the camera than this are small enough to draw without ink outlines
// the head's skull (kit space) and how big a hand is: hands are kept out of both the head and the table
const SKULL = { c: new THREE.Vector3(0, 0.57, 0.005), r: new THREE.Vector3(0.2, 0.185, 0.19) }, HAND_R = 0.052;
const BITE = new THREE.Vector3(0, -0.36, 0.093);       // the food on the fork, in the arm's space
const ARMS = ['lx', 'lz', 'ly', 'rx', 'rz', 'ry'];
// the fork at the lips (found by search: the bite meets the mouth while hand and fork stay outside the face)
const BITE_POSE = { adult: { rx: -1.876, ry: -0.664, rz: 0.024 }, kid: { rx: -1.88, ry: -0.4, rz: 0.334 } };
const _w = new THREE.Matrix4(), _m = new THREE.Matrix4(), _a = new THREE.Matrix4(), _b = new THREE.Matrix4(), _h = new THREE.Matrix4(), _p = new THREE.Matrix4(), _mo = new THREE.Matrix4(), _fk = new THREE.Matrix4(), _lg = [new THREE.Matrix4(), new THREE.Matrix4()], _hi = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _d = new THREE.Vector3(), _hp = new THREE.Vector3();
const _f = new THREE.Matrix4();
// Each hat sized to the hair under it (made with the kit, art/blender/scripts/avatar_kit.py): "hair|cover" for the
// covering hats (they all sit on one hat line), "hair|hat_bow" and "hair|hat_leaves" for the band and the wreath.
const FITS = new Map();
const fitOf = (key) => {
  if (!FITS.has(key)) { const [hair, kind] = key.split('|'), m = HAT_FIT.fit[hair]?.[kind]; FITS.set(key, m ? new THREE.Matrix4().fromArray(m) : null); }
  return FITS.get(key);
};
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

/** One person: where they are, how they stand or sit, what they are doing. */
export class Actor {
  constructor(crowd, { look, kid = false, sex = 'f', pose = 'sit', name = '', id = '' }) {
    Object.assign(this, { crowd, look, kid, sex, pose, name, id });
    this.pos = new THREE.Vector3(); this.yaw = 0;
    this.visible = true;
    this.anim = 'idle'; this.animT = 0;
    this.lookAt = null;                  // a point the head turns toward
    this.phase = Math.random() * 10;
    this.pop = 0;                        // a happy little bounce when something changes
    this.path = null;                    // walking: the points still to reach
    this.hold = null;                    // arms reaching for a point (the wishbone): { at: Vector3 }
    // the pose as drawn (smoothed toward what the animation wants)
    this.cur = { hy: 0, hp: 0, hr: 0, lx: 0, lz: 0, ly: 0, rx: 0, rz: 0, ry: 0, lean: 0, lift: 0, mo: 0, fk: 0, sw: 0 };
    this.slots = [];
    this.armL = new THREE.Matrix4(); this.armR = new THREE.Matrix4();   // shoulder → hand, this frame
  }
  /** Where a hand is right now (world). */
  handPoint(left, out = new THREE.Vector3()) { return out.set(0, -0.232, 0).applyMatrix4(left ? this.armL : this.armR); }
  set(look) { this.look = look; this.pop = 1; this.crowd.dirty = true; }
  setPose(p) { if (p !== this.pose) { this.pose = p; this.crowd.dirty = true; } }
  show(v) { if (v !== this.visible) { this.visible = v; this.crowd.dirty = true; } }
  play(name) { if (name !== this.anim) { this.anim = name; this.animT = 0; } }
  get scale() { return this.kid ? KID : 1; }
  /** Where the face is (for labels, the camera, the speech bubbles). */
  headPoint(out = new THREE.Vector3()) {
    const s = this.scale, y = (0.57 + (this.kid ? 0.03 : 0)) * s;
    return out.set(0, y + this.cur.lift, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.yaw).add(this.pos);
  }
  get facing() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  /** Walk through `points` (hips height already in each), then face `yaw` and call `done`. */
  walk(points, { speed = 1.25, yaw = null, done = null } = {}) {
    this.setPose('stand');
    this.path = points.map((p) => p.clone()); this.walkSpeed = speed * (this.kid ? 0.85 : 1); this.endYaw = yaw; this.onArrive = done;
    this.play('walk');
  }
}

/** An outline shape kept as its own (lighter) mesh, moved into its part's space (each has its own compression transform). */
function hullIn(hullSrc, src) {
  const g = hullGeometry(hullSrc.geometry).clone();
  g.applyMatrix4(new THREE.Matrix4().copy(src.matrixWorld).invert().multiply(hullSrc.matrixWorld));
  g.computeVertexNormals();
  return g;
}

const NO_OUTLINE = /^(hand|forearm|sleeve|legs_|leg_|glasses_|mouth|fork|skirt)/;

export class Crowd {
  constructor(scene, kit, { max = 80, outline = 0.0024 } = {}) {
    this.material = crowdMaterial();
    this.parts = new Map();
    this.bounds = new THREE.Sphere(new THREE.Vector3(), 1e5);
    kit.updateMatrixWorld(true);
    const names = new Set(ALL_PARTS);
    // (a hair's leaf crown or headband that came out the same as another hair's is drawn with that one)
    this.alias = new Map(Object.entries(HAT_FIT.alias || {}));
    for (const name of names) {
      if (this.alias.has(name)) continue;
      let src = null, hullSrc = null;
      kit.traverse((o) => { if (!o.isMesh) return; if (!src && (o.name === name || o.parent?.name === name)) src = o; if (!hullSrc && (o.name === `${name}__hull` || o.parent?.name === `${name}__hull`)) hullSrc = o; });
      if (!src) { if (!name.endsWith('_hat')) console.warn('missing part', name); continue; }
      // (hands, legs, two arms each — more slots for them)
      const n = /^(hand|forearm|sleeve|leg_)/.test(name) ? max * 2 : max;
      const mesh = new THREE.InstancedMesh(src.geometry, this.material, n);
      mesh.name = `crowd-${name}`;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, _c.set(1, 1, 1));
      // (tiny or tucked-away parts — hands, legs under the table, glasses, the mouth — need no outline)
      const noOutline = NO_OUTLINE.test(name);
      const hull = noOutline ? new THREE.InstancedMesh(new THREE.BufferGeometry(), outlineMaterial(outline), 1) : new THREE.InstancedMesh(hullSrc ? hullIn(hullSrc, src) : hullGeometry(src.geometry), outlineMaterial(outline), n);
      hull.noOutline = noOutline;
      if (!noOutline) hull.instanceMatrix = mesh.instanceMatrix;
      hull.count = 0; hull.renderOrder = -1; hull.raycast = () => {};
      mesh.boundingSphere = hull.boundingSphere = this.bounds;   // one shared sphere round everybody (kept up to date below)
      mesh.visible = hull.visible = false;
      scene.add(mesh, hull);
      // (compressed meshes keep their true size in the node's transform: every placement goes through it)
      this.parts.set(name, { mesh, hull, n: 0, local: src.matrixWorld.clone() });
    }
    this.actors = [];
    this.table = null;   // the table's cloth as a box hands keep out of: { x (half width), z0, z1, top, bottom }
    this.dirty = true;
    this.time = 0;
    this.eye = new THREE.Vector3(); this._sortedAt = new THREE.Vector3(1e9, 0, 0);
  }

  add(opts) { const a = new Actor(this, opts); this.actors.push(a); this.dirty = true; return a; }
  remove(a) { const i = this.actors.indexOf(a); if (i >= 0) { this.actors.splice(i, 1); this.dirty = true; } }
  clear() { this.actors.length = 0; this.dirty = true; }

  /** Give every visible actor its instance slots (and colours) — only when the cast, a pose or a look changes. */
  _layout() {
    this.dirty = false;
    for (const p of this.parts.values()) { p.n = 0; p.near = 0; }
    this._sortedAt.copy(this.eye);
    // nearest first: each part's first `near` slots are the ones close enough to get outlines
    const order = this.actors.filter((a) => a.visible).sort((a, b) => a.pos.distanceToSquared(this.eye) - b.pos.distanceToSquared(this.eye));
    for (const a of this.actors) a.slots = [];
    for (const a of order) {
      const near = a.pos.distanceTo(this.eye) < OUTLINE_RANGE;
      for (const e of partsOf(a.look, { pose: a.pose, sex: a.sex })) {
        const p = this.parts.get(this.alias.get(e.part) || e.part);
        if (!p || p.n >= p.mesh.instanceMatrix.count) continue;
        const slot = p.n++;
        if (near) p.near = p.n;
        p.mesh.setColorAt(slot, _c.set(e.color));
        a.slots.push({ p, slot, group: e.group, fit: e.fit ? fitOf(e.fit) : null });
      }
    }
    for (const p of this.parts.values()) {
      p.mesh.count = p.n; p.mesh.visible = p.n > 0;
      p.hull.count = p.hull.noOutline ? 0 : p.near; p.hull.visible = !p.hull.noOutline && p.near > 0;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
  }

  /** What each animation wants this frame (angles in radians; arm x: forward raise, z: out to the side, y: swung in). */
  _want(a, t) {
    const k = a.animT, ph = a.phase, sit = a.pose === 'sit';
    // seated, grown-ups rest their forearms on the table; children (whose shoulders are at table height) keep their hands in their lap
    const rest = sit ? (a.kid ? -0.55 : -1.36) : -0.05;
    const w = { hy: 0, hp: 0.02 * Math.sin(t * 0.9 + ph), hr: 0.05 * Math.sin(t * 0.6 + ph), lx: rest, lz: sit ? -0.1 : -0.12, ly: sit ? 0.12 : 0, rx: rest, rz: sit ? 0.1 : 0.12, ry: sit ? -0.12 : 0, lean: sit ? 0.06 : 0, lift: 0, mo: 0, fk: 0, sw: 0 };
    // talking: the mouth opens and closes in syllables, never quite in rhythm
    const talk = () => Math.min(1, Math.max(0, 0.5 * Math.sin(t * 11 + ph) + 0.4 * Math.sin(t * 6.7 + ph * 2.3) + 0.32)) * (Math.sin(t * 1.7 + ph) > -0.8 ? 1 : 0.15);
    switch (a.anim) {
      case 'wave': w.rz = 2.45 + 0.32 * Math.sin(t * 9 + ph); w.rx = -0.25; w.hr = 0.12; w.mo = 0.35; break;
      case 'cheer': w.lz = -2.6 - 0.2 * Math.sin(t * 10); w.rz = 2.6 + 0.2 * Math.sin(t * 10); w.lx = w.rx = -0.2; w.lift = Math.abs(Math.sin(t * 7 + ph)) * (sit ? 0.025 : 0.07); w.hp = -0.15; w.mo = 0.8; break;
      case 'toast': w.rx = -2.0; w.rz = 0.35; w.hp = -0.08; w.mo = 0.25; break;
      case 'talk': w.rx = (sit ? -1.15 : -0.6) + 0.35 * Math.sin(t * 4.2 + ph); w.rz = 0.45; w.ry = -0.2; w.hp = 0.05 * Math.sin(t * 5.3); w.hr = 0.08 * Math.sin(t * 2.1); w.mo = talk(); break;
      case 'speech': w.rx = -1.5 + 0.45 * Math.sin(t * 3.1 + ph); w.rz = 0.55 + 0.15 * Math.sin(t * 2.3); w.lx = sit ? -1.2 : -0.4; w.hp = 0.05 * Math.sin(t * 4.3) - 0.04; w.hr = 0.06 * Math.sin(t * 1.6); w.mo = talk(); break;
      case 'laugh': { const sh = Math.sin(t * 16) * 0.5 + 0.5; w.hp = -0.22 + 0.04 * sh; w.mo = 0.65 + 0.3 * sh; w.lift = 0.008 * sh; w.lx = sit ? -1.0 : -0.3; w.ly = 0.45; w.lz = -0.05; break; }
      case 'nod': w.hp = 0.06 + 0.1 * Math.max(0, Math.sin(t * 5 + ph)); w.mo = 0.0; break;
      case 'eat': {
        // reach to the plate, fork up to the lips (stopping there, not in the face), a bite, chew (about three seconds a round)
        const c = ((k + ph) % 3.4) / 3.4, bp = a.kid ? BITE_POSE.kid : BITE_POSE.adult;
        const up = c < 0.3 ? 0 : c < 0.48 ? smooth((c - 0.3) / 0.18) : c < 0.62 ? 1 : c < 0.8 ? 1 - smooth((c - 0.62) / 0.18) : 0;
        const plate = a.kid ? -1.5 : -1.4;   // the fork down to the plate, the hand just above the cloth
        w.rx = plate + (bp.rx - plate) * up; w.ry = -0.25 + (bp.ry + 0.25) * up; w.rz = 0.15 + (bp.rz - 0.15) * up;
        w.hp = 0.14 - 0.14 * up; w.fk = 1 - 0.2 * up;
        w.mo = c > 0.42 && c < 0.55 ? 0.75 : c >= 0.55 && c < 0.95 ? 0.18 * Math.max(0, Math.sin(t * 14)) : 0;
        break;
      }
      case 'clap': { const c = Math.sin(t * 14) > 0 ? 1 : 0; w.lx = w.rx = -1.25; w.lz = w.rz = 0; w.ly = 0.25 + c * 0.3; w.ry = -0.25 - c * 0.3; w.mo = 0.5; break; }
      case 'hold': w.lx = w.rx = -1.35; w.lz = w.rz = 0; w.ly = 0.38; w.ry = -0.38; w.hp = 0.12; break;
      case 'pull': w.lx = w.rx = -1.2; w.lz = w.rz = 0; w.ly = 0.3; w.ry = -0.3; w.lean = -0.16 - 0.04 * Math.sin(t * 16); w.hp = 0.05; w.mo = 0.3; break;
      case 'sad': w.hp = 0.38; w.hr = 0.0; w.lx = w.rx = -0.05; break;
      case 'shrug': w.lz = -0.9; w.rz = 0.9; w.lx = w.rx = -0.6; w.hr = 0.18; w.mo = 0.2; break;
      case 'pose': w.rz = 2.6; w.rx = -0.3; w.lz = -0.35; w.hr = 0.1; w.mo = 0.3; break;   // a "cheese!" wave for the photo
      case 'hug': w.lz = -0.5; w.rz = 0.5; w.lx = w.rx = -0.35; w.ly = 0.6; w.ry = -0.6; w.hr = 0.08; w.mo = 0.3; break;   // arms round the ones beside (the photo)
      case 'hips': w.lz = -0.75; w.rz = 0.75; w.lx = w.rx = 0.25; w.ly = -0.9; w.ry = 0.9; w.hr = -0.06; w.mo = 0.2; break;
      case 'walk': { const s = Math.sin(t * 7.2 + ph); w.sw = s * 0.5; w.lx = -0.05 - s * 0.38; w.rx = -0.05 + s * 0.38; w.lift = Math.abs(Math.cos(t * 7.2 + ph)) * 0.022; w.hp = -0.02; break; }
      default: break;
    }
    if (a.hold && !sit) {
      // both hands out to a point (the wishbone): pitch the arms so the hands meet it, whatever the height
      const s = a.scale, shoulderY = a.pos.y + SHOULDER_Y * s, L = 0.232 * s;
      const dy = THREE.MathUtils.clamp((a.hold.at.y - shoulderY) / L, -0.98, 0.98);
      const th = Math.acos(-dy);
      w.lx = w.rx = -th; w.lz = w.rz = 0; w.ly = 0.38; w.ry = -0.38;
      if (a.anim === 'pull') { w.lx = w.rx = -th + 0.12; }
    }
    if (a.lookAt) {
      const hp = a.headPoint(_v);
      const d = _s.copy(a.lookAt).sub(hp);
      const rel = wrap(Math.atan2(d.x, d.z) - a.yaw);
      w.hy = THREE.MathUtils.clamp(rel, -1.15, 1.15);
      w.hp += THREE.MathUtils.clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.45, 0.5);
    }
    return w;
  }

  /** Shoulder → hand for one arm, from the body (`_a`) and the arm's angles (`src`: as drawn, or as wanted). */
  _arm(a, left, breathe, src = a.cur) {
    const arm = left ? a.armL : a.armR;
    arm.copy(_a).multiply(_m.makeTranslation(left ? -SHOULDER_X : SHOULDER_X, SHOULDER_Y * breathe, 0));
    arm.multiply(_m.makeRotationY(left ? src.ly : src.ry));
    arm.multiply(_m.makeRotationZ(left ? src.lz : src.rz));
    arm.multiply(_m.makeRotationX(left ? src.lx : src.rx));
  }

  /** How far (metres, roughly) a hand is from going into the head, and into the table: below 0 it is inside. */
  _clear(a, left, fk) {
    const s = a.scale, r = HAND_R * s, arm = left ? a.armL : a.armR;
    _hp.set(0, -0.232, 0).applyMatrix4(arm);
    // the head (in its own space, where a child's bigger head is the same skull)
    const k = s * (a.kid ? KID_HEAD : 1), g = r / k;
    _v.copy(_hp).applyMatrix4(_hi);
    let head = (Math.hypot((_v.x - SKULL.c.x) / (SKULL.r.x + g), (_v.y - SKULL.c.y) / (SKULL.r.y + g), (_v.z - SKULL.c.z) / (SKULL.r.z + g)) - 1) * SKULL.r.y * k;
    // the food on the fork may come to the lips, not into the face
    if (!left && fk > 0.3) {
      const f = Math.min(1, fk);
      _v.set(HAND.x + (BITE.x - HAND.x) * f, HAND.y + (BITE.y - HAND.y) * f, HAND.z + (BITE.z - HAND.z) * f).applyMatrix4(arm).applyMatrix4(_hi);
      const gb = 0.01 / k;
      head = Math.min(head, (Math.hypot((_v.x - SKULL.c.x) / (SKULL.r.x + gb), (_v.y - SKULL.c.y) / (SKULL.r.y + gb), (_v.z - SKULL.c.z) / (SKULL.r.z + gb)) - 1) * SKULL.r.y * k);
    }
    // the table (its cloth): a hand rests on it or stays clear of it, never sinks in
    let table = 1;
    const T = this.table;
    if (T && Math.abs(_hp.x) < T.x + r && _hp.z < T.z0 + r && _hp.z > T.z1 - r) {
      const inside = Math.min(T.x + r - Math.abs(_hp.x), T.z0 + r - _hp.z, _hp.z - (T.z1 - r));
      const vert = Math.max(_hp.y - r - T.top, T.bottom - (_hp.y + r));
      if (vert < 0) table = Math.max(vert, -inside);
    }
    return { head, table };
  }

  /**
   * Keep a hand out of the table and the head by correcting where the arm is heading (`w`), by the least that
   * does it: a hand on the table is raised just onto it; a hand at the head swings out just clear. The correction
   * changes smoothly with the pose, and the arm eases toward it like any other move (so it never trembles).
   */
  _fit(a, left, w, breathe) {
    const kx = left ? 'lx' : 'rx', kz = left ? 'lz' : 'rz';
    const test = () => { this._arm(a, left, breathe, w); return this._clear(a, left, w.fk); };
    const least = (key, dir, most, ok) => {   // the smallest turn of `key` (by up to `most`) that makes ok() true
      const from = w[key];
      w[key] = from + dir * most;
      if (!ok(test())) return;                 // (as far as it goes)
      let lo = 0, hi = most;
      for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; w[key] = from + dir * mid; if (ok(test())) hi = mid; else lo = mid; }
      w[key] = from + dir * hi;
    };
    let v = test();
    if (v.table < 0) { least(kx, -1, 1.4, (x) => x.table >= 0); v = test(); }
    if (v.head < 0) {
      // out to the side: an arm below the shoulder swings outward and up, a raised arm leans out and down
      const raised = Math.abs(w[kz]) > Math.PI / 2;
      least(kz, (left ? -1 : 1) * (raised ? -1 : 1), 1.2, (x) => x.head >= 0);
    }
  }

  _walk(a, dt) {
    if (!a.path?.length) return;
    const next = a.path[0];
    _d.subVectors(next, a.pos); const dist = Math.hypot(_d.x, _d.z);
    const step = a.walkSpeed * dt;
    if (dist <= step) {
      a.pos.copy(next); a.path.shift();
      if (!a.path.length) {
        a.path = null;
        if (a.endYaw != null) a.yaw = a.endYaw;
        if (a.anim === 'walk') a.play('idle');
        const cb = a.onArrive; a.onArrive = null; cb?.(a);
      }
      return;
    }
    a.pos.x += (_d.x / dist) * step; a.pos.z += (_d.z / dist) * step;
    a.pos.y = damp(a.pos.y, next.y, 10, dt);
    const want = Math.atan2(_d.x, _d.z);
    a.yaw += wrap(want - a.yaw) * (1 - Math.exp(-9 * dt));
  }

  update(t, dt, camera = null) {
    this.time = t;
    if (camera) { this.eye.copy(camera.position); if (this.eye.distanceToSquared(this._sortedAt) > 2.25) this.dirty = true; }
    if (this.dirty) this._layout();
    for (const a of this.actors) {
      if (!a.visible) continue;
      a.animT += dt;
      this._walk(a, dt);
      const w = this._want(a, t), c = a.cur, sp = a.anim === 'wave' || a.anim === 'clap' || a.anim === 'cheer' || a.anim === 'walk' ? 18 : 7;
      // (the arms ease in last, once their pose has been fitted round the head and the table: below)
      for (const key of Object.keys(c)) if (!ARMS.includes(key)) c[key] = damp(c[key], w[key], key === 'lift' || key === 'mo' ? 22 : key === 'fk' ? 6 : sp, dt);
      a.pop = Math.max(0, a.pop - dt * 2.2);
      const s = a.scale * (1 + 0.12 * Math.sin(a.pop * Math.PI) * a.pop);
      const breathe = 1 + 0.012 * Math.sin(t * 2.2 + a.phase);
      // the whole person (hips), then the upper body leaning at the hips
      _p.compose(_v.set(a.pos.x, a.pos.y + c.lift, a.pos.z), _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, a.yaw), _s.set(s, s, s));
      _a.copy(_p).multiply(_m.makeRotationX(c.lean));
      // body (a touch narrower for women, breathing)
      _b.copy(_a).multiply(_m.makeScale(a.sex === 'f' ? 0.95 : 1, breathe, a.sex === 'f' ? 0.97 : 1));
      // head: turns at the neck (children's heads a little bigger)
      _h.copy(_a).multiply(_m.makeTranslation(0, NECK.y * (breathe - 1) + NECK.y, 0));
      _h.multiply(_m.makeRotationFromEuler(_e.set(c.hp, c.hy, c.hr, 'YXZ')));
      if (a.kid) _h.multiply(_m.makeScale(KID_HEAD, KID_HEAD, KID_HEAD));
      _h.multiply(_m.makeTranslation(0, -NECK.y, 0));
      // the mouth opens down from its top edge
      const open = 0.03 + 0.97 * Math.max(0, Math.min(1, c.mo));
      _mo.copy(_h).multiply(_m.makeTranslation(MOUTH.x, MOUTH.y, MOUTH.z)).multiply(_m.makeScale(1, open, 1)).multiply(_m.makeTranslation(-MOUTH.x, -MOUTH.y, -MOUTH.z));
      // the arms: where they're heading is fitted so each hand stays out of the head and the table (whatever
      // the animation asked for), then they ease there
      _hi.copy(_h).invert();
      for (const left of [true, false]) this._fit(a, left, w, breathe);
      for (const key of ARMS) c[key] = damp(c[key], w[key], sp, dt);
      for (const left of [true, false]) this._arm(a, left, breathe);
      // the fork, in the right hand, only while eating
      const f = Math.max(0.001, Math.min(1, c.fk));
      _fk.copy(a.armR).multiply(_m.makeTranslation(HAND.x, HAND.y, HAND.z)).multiply(_m.makeScale(f, f, f)).multiply(_m.makeTranslation(-HAND.x, -HAND.y, -HAND.z));
      // standing legs swing from the hips (walking)
      for (let i = 0; i < 2; i++) _lg[i].copy(_p).multiply(_m.makeTranslation(i ? HIP_X : -HIP_X, 0, 0)).multiply(_m.makeRotationX(i ? -c.sw : c.sw));
      for (const sl of a.slots) {
        let M;
        switch (sl.group) {
          case 'head': M = _h; break;
          case 'mouth': M = _mo; break;
          case 'body': M = _b; break;
          case 'legs': M = _p; break;
          case 'legL': M = _lg[0]; break;
          case 'legR': M = _lg[1]; break;
          case 'fork': M = _fk; break;
          default: M = sl.group === 'armL' ? a.armL : a.armR;
        }
        sl.p.mesh.setMatrixAt(sl.slot, sl.fit ? _w.multiplyMatrices(M, _f.multiplyMatrices(sl.fit, sl.p.local)) : _w.multiplyMatrices(M, sl.p.local));
      }
    }
    for (const p of this.parts.values()) if (p.n) p.mesh.instanceMatrix.needsUpdate = true;
    // the sphere round everybody, so the whole family is skipped when the camera looks away
    if ((this._bT = (this._bT || 0) - dt) <= 0) {
      this._bT = 0.4;
      const box = new THREE.Box3();
      for (const a of this.actors) if (a.visible) box.expandByPoint(a.pos);
      if (box.isEmpty()) this.bounds.set(new THREE.Vector3(), 0.01); else { box.getBoundingSphere(this.bounds); this.bounds.radius += 1.4; }
    }
  }

  /** The actor whose face is nearest a screen point (CSS px), within `radius` px. */
  pick(x, y, camera, w, h, radius = 46) {
    let best = null, bd = radius;
    for (const a of this.actors) {
      if (!a.visible) continue;
      const p = a.headPoint(_v).project(camera);
      if (p.z > 1) continue;
      const sx = (p.x * 0.5 + 0.5) * w, sy = (-p.y * 0.5 + 0.5) * h;
      const r = radius * (a.kid ? 0.8 : 1);
      const d = Math.hypot(sx - x, sy - y);
      if (d < Math.min(bd, r)) { bd = d; best = a; }
    }
    return best;
  }
}
