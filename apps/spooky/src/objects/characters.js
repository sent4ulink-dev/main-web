import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assets } from '../core/assets.js';
import { toonify, toonMaterial, addOutline } from '../style/toon.js';

// The Halloween folk (CC0 models, animated here):
//   Witch — KayKit's chibi witch (Kay Lousberg). Built from parts (body, head, hat, arms), so she's animated by
//           hand with springs: her hat trails and wobbles, her arms follow through, she squashes when she lands.
//           She can ride a broomstick (made here).
//   Jack  — KayKit's pumpkin-headed friend, animated the same way.
//   Zombie — Quaternius' cartoon zombie, a skinned character with real animation clips (idle, walk, wave, jump,
//           yes, no, run…), chained into routines — a dance, a climb out of the grave.
// Each has `group` (place it), update(t, dt). Forward is +Z.

const INK = 0x1d1530;

/** A damped spring toward a moving target (for secondary motion). */
class Spring {
  constructor(k = 60, damp = 8) { this.k = k; this.d = damp; this.x = 0; this.v = 0; }
  step(target, dt) { const a = this.k * (target - this.x) - this.d * this.v; this.v += a * dt; this.x += this.v * dt; return this.x; }
}

/** Ink outline for a skinned mesh: a back-face hull that deforms with the same skeleton. */
function addSkinnedOutline(mesh, width) {
  const mat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uW = { value: width };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uW;')
      .replace('#include <project_vertex>', 'transformed += normalize(objectNormal) * uW;\n#include <project_vertex>');
  };
  mat.customProgramCacheKey = () => `skin-outline-${width}`;
  const hull = new THREE.SkinnedMesh(mesh.geometry, mat);
  hull.bind(mesh.skeleton, mesh.bindMatrix);
  hull.position.copy(mesh.position); hull.quaternion.copy(mesh.quaternion); hull.scale.copy(mesh.scale);
  hull.userData.isOutline = true;
  hull.raycast = () => {};
  hull.frustumCulled = false;
  mesh.parent.add(hull);
}

/** A crooked broomstick with a straw brush (origin where the rider stands; it points along +Z). */
function makeBroom() {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 1.45, 8), toonMaterial({ color: new THREE.Color('#7a4a2a') }));
  stick.rotation.x = Math.PI / 2; stick.position.set(0, -0.03, 0.12);
  const brush = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.46, 12, 1, true), toonMaterial({ color: new THREE.Color('#e0ad4a'), side: THREE.DoubleSide }));
  brush.rotation.x = -Math.PI / 2; brush.position.set(0, -0.03, -0.7);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 6, 16), toonMaterial({ color: new THREE.Color('#b0342a') }));
  tie.position.set(0, -0.03, -0.48);
  for (const m of [stick, brush, tie]) { addOutline(m, 0.0022, INK); g.add(m); }
  return g;
}

/** A KayKit part-built character (witch or Jack), scaled to `height` metres. */
function partCharacter(model, height) {
  const root = assets.models[model]?.clone(true) || new THREE.Group();
  toonify(root, { outline: true, width: 0.0026, outlineColor: INK, rimScale: 1.3 });
  const find = (re) => { let hit = null; root.traverse((o) => { if (!hit && re.test(o.name)) hit = o; }); return hit; };
  const parts = { root, body: root.children[0] ? root : root, armL: find(/ArmLeft/), armR: find(/ArmRight/), head: find(/Head$/), hat: find(/Hat$/) };
  root.scale.setScalar(height / 2.2);
  // glowing bits: Jack's face, the witch's buckle; and a soft self-glow so they read at night
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    for (const m of [].concat(o.material)) {
      if (m.emissive && m.emissive.getHex() === 0) m.emissive.copy(m.color).multiplyScalar(0.3);
      if (model === 'char_jack' && /Black/.test(m.name) && /Head/.test(o.name)) { m.emissive?.set(0xffb030); if (m.emissive) m.emissiveIntensity = 1.6; }
      if (/Yellow/.test(m.name) && m.emissive) { m.emissive.copy(m.color).multiplyScalar(0.25); }
    }
  });
  for (const p of ['armL', 'armR', 'head', 'hat']) if (parts[p]) parts[p].userData.rest = parts[p].rotation.clone();
  return parts;
}

export class Witch {
  /** broom: rides a broomstick (flying); otherwise she stands and can dance. */
  constructor({ height = 1.15, broom = true } = {}) {
    this.group = new THREE.Group(); this.group.name = 'witch';
    this.inner = new THREE.Group(); this.group.add(this.inner);
    this.p = partCharacter('char_witch', height);
    this.inner.add(this.p.root);
    if (broom) { this.broom = makeBroom(); this.broom.scale.setScalar(height / 1.15); this.inner.add(this.broom); this.p.root.rotation.y = 0.35; this.p.root.position.z = -0.05; }
    this.flying = broom;
    this.hatX = new Spring(70, 7); this.hatZ = new Spring(70, 7);
    this.armL = new Spring(40, 6); this.armR = new Spring(40, 6);
    this.prev = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.acc = new THREE.Vector3();
    this.phase = Math.random() * 10;
    this.mode = broom ? 'fly' : 'idle';
  }

  update(t, dt = 1 / 60) {
    const tt = t + this.phase, P = this.p;
    dt = Math.min(dt || 1 / 60, 1 / 20);
    // how she's moving through the world drives the springs (the hat trails, the arms lag)
    const wp = this.group.getWorldPosition(new THREE.Vector3());
    const v = wp.clone().sub(this.prev).divideScalar(Math.max(dt, 1e-3));
    this.acc.copy(v).sub(this.vel); this.vel.lerp(v, 0.3); this.prev.copy(wp);
    const local = this.vel.clone().applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()).invert());
    if (this.mode === 'fly') {
      // riding the broom: a bob and a pitch with the swoops, leaning into the turns, one arm waving now and then
      this.inner.position.y = 0.06 * Math.sin(tt * 2.2);
      this.inner.rotation.x = -0.05 * Math.sin(tt * 2.2 + 0.6);
      const wave = Math.max(0, Math.sin(tt * 0.7));
      if (P.armL) P.armL.rotation.z = this.armL.step(0.35 + 2.0 * wave * (0.8 + 0.2 * Math.sin(tt * 9)), dt);
      if (P.armR) P.armR.rotation.z = this.armR.step(-0.25 - 0.1 * Math.sin(tt * 3), dt);
      if (P.head) P.head.rotation.set(P.head.userData.rest.x + 0.08 * Math.sin(tt * 1.7), 0.3 * Math.sin(tt * 0.5), P.head.userData.rest.z);
      // the hat streams back with her speed and wobbles
      if (P.hat) {
        P.hat.rotation.x = P.hat.userData.rest.x + this.hatX.step(-Math.min(0.6, local.z * 0.05) - 0.1, dt);
        P.hat.rotation.z = P.hat.userData.rest.z + this.hatZ.step(Math.max(-0.4, Math.min(0.4, -local.x * 0.05)), dt);
      }
    } else if (this.mode === 'dance') {
      // a happy hop: anticipation, a squash on landing, arms up on the beat, hat jiggling after
      const b = (tt * 2.4) % 1, up = Math.sin(Math.PI * Math.min(1, b / 0.7));
      const land = b > 0.7 ? Math.sin(Math.PI * (b - 0.7) / 0.3) : 0;
      this.inner.position.y = 0.14 * up;
      const s0 = (P.root.userData.s0 ??= P.root.scale.x);
      P.root.scale.set(s0 * (1 + 0.05 * land), s0 * (1 - 0.14 * land + 0.06 * up), s0 * (1 + 0.05 * land));
      const beat = Math.sin(tt * 2.4 * Math.PI);
      if (P.armL) P.armL.rotation.z = this.armL.step(1.2 + 1.0 * beat, dt);
      if (P.armR) P.armR.rotation.z = this.armR.step(-1.2 + 1.0 * beat, dt);
      this.inner.rotation.y = 0.35 * Math.sin(tt * 1.2);
      if (P.hat) { P.hat.rotation.x = P.hat.userData.rest.x + this.hatX.step(-0.25 * up + 0.12 * land, dt); P.hat.rotation.z = P.hat.userData.rest.z + this.hatZ.step(0.15 * Math.sin(tt * 2.4 * Math.PI + 1), dt); }
      if (P.head) P.head.rotation.z = 0.12 * Math.sin(tt * 2.4 * Math.PI + 0.5);
    } else {
      // idle: breathing, a look round
      this.inner.position.y = 0.01 * Math.sin(tt * 1.6);
      if (P.armL) P.armL.rotation.z = this.armL.step(0.12 + 0.05 * Math.sin(tt * 1.6), dt);
      if (P.armR) P.armR.rotation.z = this.armR.step(-0.12 - 0.05 * Math.sin(tt * 1.6), dt);
      if (P.head) P.head.rotation.y = 0.4 * Math.sin(tt * 0.4);
      if (P.hat) P.hat.rotation.z = P.hat.userData.rest.z + this.hatZ.step(0.05 * Math.sin(tt * 0.9), dt);
    }
  }
}

export class Jack {
  constructor({ height = 1.1 } = {}) {
    this.group = new THREE.Group(); this.group.name = 'jack';
    this.inner = new THREE.Group(); this.group.add(this.inner);
    this.p = partCharacter('char_jack', height);
    this.inner.add(this.p.root);
    this.head = new Spring(50, 6); this.armL = new Spring(40, 6); this.armR = new Spring(40, 6);
    this.phase = Math.random() * 10;
  }

  update(t, dt = 1 / 60) {
    const tt = t + this.phase, P = this.p;
    dt = Math.min(dt || 1 / 60, 1 / 20);
    // a bouncy two-step: side to side, the big pumpkin head nodding a beat behind the body
    const b = tt * 2.2 * Math.PI;
    this.inner.position.y = 0.1 * Math.abs(Math.sin(b));
    this.inner.position.x = 0.12 * Math.sin(b / 2);
    this.inner.rotation.z = -0.1 * Math.sin(b / 2);
    const nod = this.head.step(0.18 * Math.sin(b - 0.6), dt);
    for (const k of ['head', 'hat']) if (P[k]) P[k].rotation.set(P[k].userData.rest.x + nod, 0.25 * Math.sin(b / 2), P[k].userData.rest.z + 0.1 * Math.sin(b / 2));
    if (P.armL) P.armL.rotation.z = this.armL.step(0.6 + 0.9 * Math.max(0, Math.sin(b / 2)), dt);
    if (P.armR) P.armR.rotation.z = this.armR.step(-0.6 - 0.9 * Math.max(0, -Math.sin(b / 2)), dt);
  }
}

export class Zombie {
  constructor({ height = 1.2 } = {}) {
    this.group = new THREE.Group(); this.group.name = 'zombie';
    this.inner = new THREE.Group(); this.group.add(this.inner);
    const src = assets.models.char_zombie;
    this.model = src ? SkeletonUtils.clone(src) : new THREE.Group();
    toonify(this.model, { outline: false, rimScale: 1.4 });
    this.model.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.map) { m.emissiveMap = m.map; m.emissive.setScalar(0.42); } });   // reads in the dark
    // stand him on the ground at the right size
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const h = Math.max(0.01, box.max.y - box.min.y), k = height / h;
    this.model.scale.multiplyScalar(k);
    this.model.position.y = -box.min.y * k;
    this.inner.add(this.model);
    this.model.updateMatrixWorld(true);
    const skinned = []; this.model.traverse((o) => { if (o.isSkinnedMesh) { skinned.push(o); o.frustumCulled = false; } });
    // ink lines ~7 mm wide in the world, whatever the mesh's own scale
    skinned.forEach((m) => addSkinnedOutline(m, 0.007 / Math.max(1e-4, m.getWorldScale(new THREE.Vector3()).x)));
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of assets.anims.char_zombie || []) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.current = null;
    this.routine = null;
    // only the move that's actually playing moves the routine on (a fading-out one finishing must not)
    this.mixer.addEventListener('finished', (e) => { if (e.action === this.current) this._next(); });
    this.play('Idle');
  }

  /** Cross-fade from whatever is playing to clip `name` (the old move fades out as the new one fades in). */
  play(name, { once = false, fade = 0.3, speed = 1 } = {}) {
    const a = this.actions[name];
    if (!a) return;
    const prev = this.current;
    if (a === prev && !once) return;
    a.reset();
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    a.clampWhenFinished = once;
    a.timeScale = speed;
    a.setEffectiveWeight(1);
    a.play();
    if (prev && prev !== a) prev.crossFadeTo(a, fade, false);
    else if (!prev) a.fadeIn(fade);   // the same clip again just restarts (its loops are seamless): fading it in would dip into the bind pose
    this.current = a;
  }

  /** Loop through a list of clips, each played once: a dance, a celebration. */
  routineOf(list, speed = 1) { this.routine = { list, i: 0, speed }; this.play(list[0], { once: true, speed }); }
  _next() {
    const r = this.routine; if (!r) return;
    r.i = (r.i + 1) % r.list.length;
    this.play(r.list[r.i], { once: true, speed: r.speed, fade: 0.22 });
  }

  // friendly waves, with a little breather in between (no jumping)
  dance() { this.routineOf(['Wave', 'Wave', 'Idle']); }
  cheer() { this.routineOf(['Wave', 'Idle', 'Wave']); }
  idle() { this.routine = null; this.play('Idle', { fade: 0.4 }); }
  /** Freeze on one moment of a clip (for the poster). */
  pose(name, at = 0.4) {
    const a = this.actions[name]; if (!a) return;
    this.mixer.stopAllAction(); this.routine = null;
    a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true; a.time = a.getClip().duration * at; this.mixer.update(0);
    this.current = a;
  }

  update(t, dt = 1 / 60) { this.mixer.update(Math.min(dt || 1 / 60, 1 / 20)); }
}
