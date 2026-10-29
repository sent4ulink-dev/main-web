import * as THREE from 'three';
import { piece } from '../world/courtyard.js';
import { holeTexture, HUD } from '../world/courtyardTextures.js';
import { softSprite } from '../util/textures.js';
import { toonMaterial } from '../style/toon.js';

// The name, written in bullet holes: an AK-style rifle (original model) on the sandbags sprays the back wall —
// first a heart, then the name inside it, letter by letter, the muzzle tracking every hole. Tracers, muzzle
// flash, brass casings tinkling down, puffs of sandstone dust; each hole glows hot for a moment, and when the
// last one lands the whole heart lights up gold from within.

const HOLE = 0.115;         // hole decal size (m)
const STEP = 0.075;         // spacing of holes along the letters (m)
const HEART_W = 3.5;        // heart width on the wall (m)
const NAME_W = 2.75;        // the name's widest line (m)
const GW = 4.2, GH = 4.0, GPX = 1024;   // the scorch / glow layer: metres covered, pixels wide
const RATE_HEART = 30, RATE_NAME = 22;   // holes per second

const glowVert = /* glsl */ `
attribute float aOrder, aHit;
uniform float uNow, uGlow, uPx, uTime;
varying float vHot, vGlow;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float since = uNow - aHit;
  vHot = aHit < 0.0 ? 0.0 : exp(-max(since, 0.0) * 3.5) * step(0.0, since);
  vGlow = smoothstep(aOrder - 0.04, aOrder + 0.02, uGlow) * (0.75 + 0.25 * sin(uTime * 3.0 + aOrder * 60.0));
  gl_PointSize = clamp((0.16 + 0.12 * vHot) * uPx / -mv.z, 1.0, 96.0);
  gl_Position = projectionMatrix * mv;
}`;
const glowFrag = /* glsl */ `
uniform sampler2D uMap;
varying float vHot, vGlow;
void main() {
  float a = texture2D(uMap, gl_PointCoord).a;
  float core = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
  vec3 col = vec3(1.0, 0.42, 0.1) * vHot * 2.6 + mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.95, 0.7), core * core) * vGlow * 1.9;
  float alpha = a * clamp(vHot + vGlow, 0.0, 1.0);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col * alpha, alpha);
}`;

/** Hole positions (metres, relative to the heart's centre) in firing order: the heart outline, then the name. */
function layout(name) {
  const pts = [];
  // the heart, traced round from the dip at the top
  const curve = (t) => {
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [x / 32 * HEART_W, y / 32 * HEART_W - 0.05];
  };
  let prev = curve(0), acc = 0;
  pts.push({ x: prev[0], y: prev[1], heart: true });
  for (let k = 1; k <= 2000; k++) {
    const p = curve(k / 2000 * Math.PI * 2);
    acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    if (acc >= 0.125) { pts.push({ x: p[0], y: p[1], heart: true }); acc = 0; }
    prev = p;
  }
  // the name: rendered in a bold condensed face, sampled on a grid, swept column by column (a snake)
  const text = (name || '').toUpperCase().trim() || '★';
  const c = document.createElement('canvas'); c.width = 1400; c.height = 520;
  const ctx = c.getContext('2d');
  let lines = [text];
  if (text.length > 9 && /\s|-/.test(text)) {
    const mid = text.length / 2; let cut = -1;
    for (let i = 1; i < text.length - 1; i++) if (/[-\s]/.test(text[i]) && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
    lines = [text.slice(0, cut + (text[cut] === '-' ? 1 : 0)).trim(), text.slice(cut + 1).trim()].filter(Boolean);
  }
  let size = 300;
  const FONT = "'Rubik', 'Oswald', sans-serif";   // heavy and wide: strokes three holes across
  const setFont = () => { ctx.font = `800 ${size}px ${FONT}`; };
  setFont();
  const widest = () => Math.max(...lines.map((l) => ctx.measureText(l).width));
  while (size > 60 && (widest() > c.width - 60 || size * 1.02 * lines.length > c.height - 40)) { size -= 6; setFont(); }
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lineH = size * 1.02;
  lines.forEach((l, i) => ctx.fillText(l, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * lineH));
  const textW = widest(), textH = lineH * lines.length;
  const mpp = Math.min(NAME_W / textW, 1.3 / textH, 0.0036);
  const step = STEP / mpp;
  const img = ctx.getImageData(0, 0, c.width, c.height).data;
  const cols = [];
  for (let x = step / 2; x < c.width; x += step) {
    const col = [];
    for (let y = step / 2; y < c.height; y += step) {
      const a = img[(Math.round(y) * c.width + Math.round(x)) * 4 + 3];
      if (a > 120) col.push({ x: (x - c.width / 2) * mpp + (Math.random() - 0.5) * 0.01, y: -(y - c.height / 2) * mpp + 0.12 + (Math.random() - 0.5) * 0.01, heart: false });
    }
    if (col.length) cols.push(col);
  }
  cols.forEach((col, i) => pts.push(...(i % 2 ? col.reverse() : col)));
  // the scorch and the glow: the same heart and letters, drawn smooth, to lie under the holes
  const ppm = GPX / GW, gh = Math.round(GH * ppm);
  const mk = () => { const cv = document.createElement('canvas'); cv.width = GPX; cv.height = gh; return [cv, cv.getContext('2d')]; };
  const X = (m) => GPX / 2 + m * ppm, Y = (m) => gh / 2 - m * ppm;
  const heartPath = (g) => { g.beginPath(); for (let k = 0; k <= 240; k++) { const [x, y] = curve(k / 240 * Math.PI * 2); g.lineTo(X(x), Y(y)); } };
  const textAt = (g, stroke = false) => {
    g.font = `800 ${size * mpp * ppm}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => (stroke ? g.strokeText : g.fillText).call(g, l, X(0), Y(0.12 - (i - (lines.length - 1) / 2) * lineH * mpp)));
  };
  const [sc, sx] = mk();   // soot: dark, soft, a little wider than the strokes
  sx.fillStyle = 'rgba(28,16,8,1)'; sx.strokeStyle = 'rgba(28,16,8,1)'; sx.lineJoin = 'round';
  sx.filter = `blur(${Math.round(ppm * 0.02)}px)`;
  sx.lineWidth = ppm * 0.09; heartPath(sx); sx.stroke();
  sx.lineWidth = ppm * 0.05; textAt(sx); textAt(sx, true);
  const [gc, gx] = mk();   // glow: bright outlines with a warm halo (the holes stay visible inside the letters)
  gx.shadowColor = 'rgba(255,170,60,1)'; gx.shadowBlur = ppm * 0.08; gx.lineJoin = 'round';
  gx.strokeStyle = 'rgba(255,214,130,1)'; gx.lineWidth = ppm * 0.03; heartPath(gx); gx.stroke();
  gx.fillStyle = 'rgba(255,190,90,0.3)'; textAt(gx);
  gx.lineWidth = ppm * 0.022; textAt(gx, true);
  pts.layers = { soot: sc, glow: gc, w: GW, h: GH };
  return pts;
}

export class Spray {
  /** rest: where the bipod stands (top of the sandbags); heart: the heart's centre on the wall (facing +Z). */
  constructor(scene, { rest, heart }, name) {
    this.scene = scene;
    this.heart = heart.clone();
    this.group = new THREE.Group(); this.group.name = 'spray';
    scene.add(this.group);
    // the rifle: an inner group turns its +X barrel onto +Z, so the mount can simply lookAt() the target
    this.mount = new THREE.Group();
    this.mount.position.copy(rest).add(new THREE.Vector3(0, 0.33, 0));
    this.group.add(this.mount);
    this.kick = new THREE.Group();
    this.mount.add(this.kick);
    this.rifle = piece('tactical', 'rifle', { outline: 0.0016 });
    this.rifle.rotation.y = -Math.PI / 2;
    this.rifle.scale.setScalar(1.25);
    this.kick.add(this.rifle);
    this.rifle.updateMatrixWorld(true);
    this.muzzle = this.rifle.getObjectByName('muzzle');
    this.ejection = this.rifle.getObjectByName('ejection');
    this.hitTargets = [];
    this.rifle.traverse((m) => { if (m.isMesh && !m.userData.isOutline) this.hitTargets.push(m); });
    this.aim = this.heart.clone();
    this._aimTo = this.heart.clone();
    this.mount.lookAt(this.aim);

    // muzzle flash (sprite + light)
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.scale.setScalar(0.32);
    this.flash.visible = false;
    this.group.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffb060, 0, 6, 2);
    this.group.add(this.flashLight);

    // tracers
    this.tracers = [];
    const tg = new THREE.CylinderGeometry(0.009, 0.004, 1, 5, 1, true); tg.translate(0, -0.5, 0);
    const tm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.82, 0.45).multiplyScalar(3), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(tg, tm); m.visible = false; m.frustumCulled = false; this.group.add(m); this.tracers.push({ m, life: 0 }); }

    // casings: brass, ejected to the right, bouncing on the ground
    const sg = new THREE.CylinderGeometry(0.0055, 0.0055, 0.03, 8);
    this.shells = new THREE.InstancedMesh(sg, toonMaterial({ color: new THREE.Color('#e3ad4a'), emissive: new THREE.Color('#e3ad4a').multiplyScalar(0.15) }, { rimScale: 2.4 }), 80);
    this.shells.frustumCulled = false; this.shells.castShadow = false;
    this.shellData = Array.from({ length: 80 }, () => ({ p: new THREE.Vector3(0, -10, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), rest: true }));
    this._shellIdx = 0;
    this.group.add(this.shells);

    // dust puffs and sparks at the wall
    this.dust = particlePool(500, softSprite(64), false);
    this.sparks = particlePool(260, softSprite(32, 0.3), true);
    this.group.add(this.dust.points, this.sparks.points);

    this.holeMat = new THREE.MeshLambertMaterial({ map: holeTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.glowU = { uNow: { value: 0 }, uGlow: { value: 0 }, uPx: { value: 800 }, uTime: { value: 0 }, uMap: { value: softSprite(64, 0.15) } };
    this.setName(name);
    this.state = 'idle';
    this._t = 0;
    this.recoil = 0;
  }

  setName(name) {
    this.points = layout(name);
    const n = this.points.length;
    for (const k of ['holes', 'glow', 'soot', 'shine']) if (this[k]) { this.group.remove(this[k]); this[k].geometry.dispose(); this[k].material.map?.dispose?.(); }
    this.holes = new THREE.InstancedMesh(new THREE.PlaneGeometry(HOLE, HOLE), this.holeMat, n);
    this.holes.frustumCulled = false;
    this.holes.renderOrder = 2;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), order = new Float32Array(n), hit = new Float32Array(n).fill(-1);
    this.world = this.points.map((p, i) => {
      const w = new THREE.Vector3(this.heart.x + p.x, this.heart.y + p.y, this.heart.z + 0.004);
      pos.set([w.x, w.y, w.z + 0.01], i * 3);
      order[i] = i / Math.max(1, n - 1);
      return w;
    });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aOrder', new THREE.BufferAttribute(order, 1));
    g.setAttribute('aHit', new THREE.BufferAttribute(hit, 1));
    this.glow = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: glowVert, fragmentShader: glowFrag, uniforms: this.glowU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.frustumCulled = false;
    this.glow.renderOrder = 3;
    // the scorched letters under the holes (they make the name readable in daylight) and the warm glow over them
    const L = this.points.layers;
    const plane = (canvas, mat) => {
      const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      mat.map = t; mat.transparent = true; mat.depthWrite = false; mat.opacity = 0;
      mat.polygonOffset = true; mat.polygonOffsetFactor = -2;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), mat);
      m.position.copy(this.heart).add(new THREE.Vector3(0, 0, 0.002));
      m.renderOrder = 1;
      return m;
    };
    this.soot = plane(L.soot, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.shine = plane(L.glow, new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending }));
    this.shine.position.z += 0.004; this.shine.renderOrder = 3;
    this.group.add(this.soot, this.shine, this.holes, this.glow);
    this.times = this._schedule();
    // a finished name stays written (an edit rewrites it at once)
    if (this.state === 'done' || this.state === 'firing') { this._showAll(); this.state = 'done'; this.glowU.uGlow.value = 1.1; }
    else this._hideAll();
  }

  _schedule() {
    const t = []; let at = 0;
    this.points.forEach((p) => { t.push(at); at += 1 / (p.heart ? RATE_HEART : RATE_NAME); });
    return t;
  }

  _hideAll() {
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.points.length; i++) this.holes.setMatrixAt(i, m);
    this.holes.instanceMatrix.needsUpdate = true;
    this.glow.geometry.attributes.aHit.array.fill(-1); this.glow.geometry.attributes.aHit.needsUpdate = true;
  }

  _showAll() {
    for (let i = 0; i < this.points.length; i++) this._placeHole(i, 1);
    this.holes.instanceMatrix.needsUpdate = true;
    this.glow.geometry.attributes.aHit.array.fill(-100); this.glow.geometry.attributes.aHit.needsUpdate = true;
  }

  _placeHole(i, s) {
    const m = new THREE.Matrix4();
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (i * 2.399) % (Math.PI * 2));
    m.compose(this.world[i], rot, new THREE.Vector3(s, s, s));
    this.holes.setMatrixAt(i, m);
  }

  /** Seconds the whole spray takes. */
  get duration() { return this.times[this.times.length - 1] + 0.3; }
  get focusPoint() { return this.mount.position.clone(); }
  /** The rifle's muzzle, in the world. */
  get muzzlePos() { return this.muzzle.getWorldPosition(new THREE.Vector3()); }

  /** Spray the heart and the name. onShot(i, isHeart) fires on every round; resolves when the heart glows. */
  fire(onShot = () => {}) {
    if (this.state !== 'idle') return Promise.resolve();
    this.state = 'firing';
    this._t = -0.35;   // a breath before the first round
    this._next = 0;
    this._onShot = onShot;
    this._hideAll();
    this.glowU.uGlow.value = 0;
    return new Promise((resolve) => { this._done = resolve; });
  }

  /** Written at once, glowing (the finale, if the rifle was never fired). */
  complete() { this.state = 'done'; this._showAll(); this.glowU.uGlow.value = 1.1; }

  reset() {
    this.state = 'idle';
    this._hideAll();
    this.glowU.uGlow.value = 0;
    this._aimTo.copy(this.heart);
    for (const s of this.shellData) { s.p.set(0, -10, 0); s.rest = true; }
  }

  _shoot(i) {
    const target = this.world[i];
    this._aimTo.copy(target);
    this.aim.lerp(target, 0.85);
    this.mount.lookAt(this.aim);
    this.mount.updateMatrixWorld(true);
    const muzzle = this.muzzlePos;
    this.recoil = 1;
    this.flash.position.copy(muzzle);
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.24 + Math.random() * 0.16);
    this.flash.visible = true; this._flashT = 0.045;
    this.flashLight.position.copy(muzzle); this.flashLight.intensity = 5;
    // the tracer
    const tr = this.tracers.find((x) => x.life <= 0) || this.tracers[0];
    const dist = muzzle.distanceTo(target);
    tr.from = muzzle.clone(); tr.to = target.clone(); tr.life = tr.dur = dist / 190; tr.i = i;
    tr.m.visible = true;
    tr.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), target.clone().sub(muzzle).normalize());
    // the casing
    const s = this.shellData[this._shellIdx = (this._shellIdx + 1) % this.shellData.length];
    const ej = this.ejection.getWorldPosition(new THREE.Vector3());
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.mount.quaternion).cross(new THREE.Vector3(0, 1, 0)).normalize().negate();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mount.quaternion);
    const side = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    s.p.copy(ej); s.v.copy(side).multiplyScalar(1.6 + Math.random() * 0.8).add(new THREE.Vector3(0, 1.8 + Math.random() * 0.8, 0)).addScaledVector(fwd, -0.4 - Math.random() * 0.4);
    s.w.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
    s.rest = false; s.bounces = 0;
    void right;
    this._onShot(i, this.points[i].heart, s);
  }

  _impact(i) {
    this._placeHole(i, 1);
    this.holes.instanceMatrix.needsUpdate = true;
    const hit = this.glow.geometry.attributes.aHit; hit.array[i] = this.glowU.uNow.value; hit.needsUpdate = true;
    const p = this.world[i];
    for (let k = 0; k < 2; k++) this.dust.spawn(p.clone().add(new THREE.Vector3(0, 0, 0.03)), new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.6, 0.4 + Math.random() * 0.9), 0.9 + Math.random() * 0.6, 0.09 + Math.random() * 0.08, [0.93, 0.82, 0.65]);
    for (let k = 0; k < 3; k++) this.sparks.spawn(p.clone().add(new THREE.Vector3(0, 0, 0.02)), new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, 1 + Math.random() * 2.5), 0.18 + Math.random() * 0.15, 0.03, [1.0, 0.7, 0.3]);
  }

  update(t, dt, renderer, camera) {
    this.glowU.uTime.value = t;
    this.glowU.uNow.value = t;
    this.glowU.uPx.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    if (this.state === 'firing') {
      this._t += dt;
      while (this._next < this.times.length && this._t >= this.times[this._next]) this._shoot(this._next++);
      if (this._next >= this.times.length && this.tracers.every((x) => x.life <= 0)) {
        this.state = 'glowing'; this._glowT = 0;
      }
    } else if (this.state === 'glowing') {
      this._glowT += dt;
      if (this._glowT > 0.5) this.glowU.uGlow.value = Math.min(1.1, (this._glowT - 0.5) / 1.6);
      if (this._glowT > 2.4) { this.state = 'done'; this._done?.(); }
    } else if (this.state === 'idle') {
      // idle: the muzzle drifts gently, as if someone's breathing behind it
      this._aimTo.copy(this.heart).add(new THREE.Vector3(Math.sin(t * 0.7) * 0.25, Math.sin(t * 1.1) * 0.12, 0));
      this.aim.lerp(this._aimTo, Math.min(1, dt * 2));
      this.mount.lookAt(this.aim);
    }
    // recoil: kick back and up, settle fast
    this.recoil = Math.max(0, this.recoil - dt * 14);
    this.kick.position.z = -0.045 * this.recoil;
    this.kick.rotation.x = -0.05 * this.recoil;
    if (this._flashT > 0) { this._flashT -= dt; if (this._flashT <= 0) this.flash.visible = false; }
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 90);
    // tracers fly; the hole appears as each one arrives
    for (const tr of this.tracers) {
      if (tr.life <= 0) continue;
      tr.life -= dt;
      const k = 1 - Math.max(0, tr.life) / tr.dur;
      tr.m.position.lerpVectors(tr.from, tr.to, k);
      tr.m.scale.set(1, Math.min(1.1, tr.from.distanceTo(tr.m.position)), 1);
      if (tr.life <= 0) { tr.m.visible = false; this._impact(tr.i); }
    }
    // casings
    const d = this._d || (this._d = new THREE.Object3D());
    this.shellData.forEach((s, i) => {
      if (!s.rest) {
        s.v.y -= 9.8 * dt;
        s.p.addScaledVector(s.v, dt);
        s.r.x += s.w.x * dt; s.r.y += s.w.y * dt; s.r.z += s.w.z * dt;
        if (s.p.y < 0.006) {
          s.p.y = 0.006;
          if (Math.abs(s.v.y) > 0.6 && s.bounces < 3) { s.v.y *= -0.35; s.v.x *= 0.5; s.v.z *= 0.5; s.w.multiplyScalar(0.5); s.bounces++; this.onTink?.(s.bounces); }
          else { s.rest = true; s.r.x = Math.PI / 2; s.r.z = 0; }
        }
      }
      d.position.copy(s.p); d.rotation.copy(s.r); d.updateMatrix();
      this.shells.setMatrixAt(i, d.matrix);
    });
    this.shells.instanceMatrix.needsUpdate = true;
    const shot = this.state === 'idle' ? 0 : this.state === 'firing' ? Math.min(1, this._next / Math.max(1, this.points.length)) : 1;
    const glow = Math.min(1, this.glowU.uGlow.value);
    if (this.soot) { this.soot.material.opacity = 0.62 * shot; this.shine.material.opacity = 0.85 * glow; }
    this.dust.update(dt, 0.6, 0.35); this.sparks.update(dt, 6, 0);
  }
}

/** A star-shaped muzzle flash. */
function flashTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.25, 'rgba(255,200,110,0.9)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  x.fillStyle = g;
  x.beginPath();
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, r = (k % 2 ? 0.16 : 0.5) * S; x.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r); }
  x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A pool of soft point particles (dust or sparks). */
function particlePool(n, map, additive) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3).fill(-50), life = new Float32Array(n), size = new Float32Array(n), col = new Float32Array(n * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uPx: { value: 900 } },
    vertexShader: `attribute float aLife, aSize; attribute vec3 aColor; varying float vL; varying vec3 vC; uniform float uPx;
      void main(){ vL = aLife; vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = clamp(aSize * (${additive ? '1.0' : '1.0 + (1.0 - aLife) * 2.5'}) * uPx / -mv.z, 0.0, 90.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uMap; varying float vL; varying vec3 vC;
      void main(){ float a = texture2D(uMap, gl_PointCoord).a * clamp(vL, 0.0, 1.0) * ${additive ? '1.0' : '0.55'}; if (a < 0.004) discard;
      gl_FragColor = vec4(vC * ${additive ? '2.2 * a' : '1.0'}, a); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 4;
  const vel = new Float32Array(n * 3), dur = new Float32Array(n);
  let next = 0;
  return {
    points,
    spawn(p, v, d, s, c) {
      const i = next; next = (next + 1) % n;
      pos.set([p.x, p.y, p.z], i * 3); vel.set([v.x, v.y, v.z], i * 3); col.set(c, i * 3);
      life[i] = 1; dur[i] = d; size[i] = s;
    },
    update(dt, gravity, drag) {
      mat.uniforms.uPx.value = innerHeight * Math.min(devicePixelRatio, 2) / (2 * Math.tan(THREE.MathUtils.degToRad(45) / 2));
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt / dur[i];
        const k = Math.exp(-dt * (drag * 6));
        vel[i * 3] *= k; vel[i * 3 + 2] *= k; vel[i * 3 + 1] = vel[i * 3 + 1] * k - gravity * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (life[i] <= 0) pos[i * 3 + 1] = -50;
      }
      g.attributes.position.needsUpdate = true; g.attributes.aLife.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.attributes.aColor.needsUpdate = true;
    },
  };
}

export { particlePool };
