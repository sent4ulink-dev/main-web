import * as THREE from 'three';
import gsap from 'gsap';
import { toonMaterial, addOutline } from '../style/toon.js';
import { canvas, glowTexture, INK, DRIP, fit, wrap } from '../world/nightTextures.js';
import { Ghost } from './ghosts.js';

// The witch's cauldron. Three ingredients float round it — an eyeball, a toadstool, a spider — tap each and it
// arcs into the brew with a splash; the brew bubbles harder and changes colour each time. With the third, a
// puff of smoke and a little ghost rises out of the pot holding a scroll: the wish, unrolled.

export const BREW = ['#62ff4e', '#b14dff', '#ff8a1e', '#ff5fd2'];

const brewVert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const brewFrag = /* glsl */ `
varying vec2 vUv; uniform float uTime, uBoil; uniform vec3 uColor;
float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 p = vUv - 0.5; float r = length(p) * 2.0, a = atan(p.y, p.x);
  float sw = n(vec2(a * 2.0 + uTime * 0.4 + r * 3.0, r * 4.0 - uTime * 0.3)) * 0.6 + n(p * 9.0 + uTime * 0.5) * 0.4;
  vec3 col = mix(uColor * 0.55, uColor * 1.25, smoothstep(0.35, 0.75, sw));
  // bubbles: little bright rings popping up all over
  vec2 g = p * 7.0; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float ph = fract(h(id) + uTime * (0.35 + h(id + 3.0) * 0.5) * (0.6 + uBoil));
  float br = (0.12 + 0.25 * ph) * step(0.45, h(id + 7.0));
  float ring = smoothstep(0.05, 0.0, abs(length(f) - br)) * (1.0 - ph);
  col += vec3(1.0) * ring * 0.7;
  col *= 1.0 - smoothstep(0.85, 1.0, r) * 0.5;
  gl_FragColor = vec4(col, 1.0);
}`;

function makeEyeball() {
  const g = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), toonMaterial({ color: new THREE.Color('#f4efe6') }, { rimScale: 1.2 }));
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 10), toonMaterial({ color: new THREE.Color('#2fb5a0'), emissive: new THREE.Color('#0c3a33') }));
  iris.scale.z = 0.4; iris.position.z = 0.064;
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), new THREE.MeshBasicMaterial({ color: 0x0a0608 }));
  pupil.scale.z = 0.4; pupil.position.z = 0.078;
  // red veins
  const vein = toonMaterial({ color: new THREE.Color('#c0202a') });
  for (let k = 0; k < 5; k++) {
    const v = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.0035, 4, 18, 0.5 + (k % 3) * 0.2), vein);
    v.rotation.set(k * 1.1, k * 0.7 + Math.PI, k * 0.4); g.add(v);
  }
  addOutline(white, 0.002);
  g.add(white, iris, pupil);
  return g;
}

function makeToadstool() {
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toonMaterial({ color: new THREE.Color('#9b2fd8'), emissive: new THREE.Color('#3a0a5a') }, { rimScale: 1.4 }));
  cap.scale.y = 0.75; cap.position.y = 0.06;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.09, 12), toonMaterial({ color: new THREE.Color('#efe3cc') }));
  stem.position.y = 0.02;
  const dot = toonMaterial({ color: new THREE.Color('#fff7e8') });
  for (let k = 0; k < 7; k++) {
    const a = k * 2.4, el = 0.45 + (k % 3) * 0.3;
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), dot);
    d.position.set(Math.cos(a) * Math.cos(el) * 0.09, 0.06 + Math.sin(el) * 0.068, Math.sin(a) * Math.cos(el) * 0.09);
    d.scale.y = 0.5; g.add(d);
  }
  addOutline(cap, 0.002); addOutline(stem, 0.002);
  g.add(cap, stem);
  return g;
}

function makeSpider() {
  const g = new THREE.Group();
  const black = toonMaterial({ color: new THREE.Color('#1b1420') }, { rimScale: 2.2 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), black); body.scale.set(1, 0.85, 1.15); body.position.z = -0.03;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), black); head.position.z = 0.045;
  const eye = new THREE.MeshBasicMaterial({ color: 0xff3030 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), eye); e.position.set(s * 0.012, 0.012, 0.072); g.add(e); }
  g.legs = [];
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.03, 0, 0.03 - k * 0.025);
    leg.rotation.y = s * (0.5 + k * 0.35) * (s > 0 ? 1 : 1);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.08, 5), black);
    up.rotation.z = -s * 0.9; up.position.set(s * 0.03, 0.025, 0);
    const down = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.09, 5), black);
    down.rotation.z = s * 0.5; down.position.set(s * 0.075, 0.01, 0);
    leg.add(up, down); g.add(leg); g.legs.push(leg);
  }
  addOutline(body, 0.002); addOutline(head, 0.002);
  g.add(body, head);
  return g;
}

/** A rickety little wooden table (origin on the floor, top at 0.74). */
function makeTable() {
  const g = new THREE.Group();
  const wood = toonMaterial({ color: new THREE.Color('#5a3a26') }, { rimScale: 0.7 });
  const dark = toonMaterial({ color: new THREE.Color('#3b2618') }, { rimScale: 0.5 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.045, 0.44), wood); top.position.y = 0.72;
  addOutline(top, 0.002); g.add(top);
  for (const [x, z, lean] of [[-0.28, -0.17, 0.05], [0.28, -0.17, -0.04], [-0.28, 0.17, -0.03], [0.28, 0.17, 0.06]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.72, 8), dark);
    leg.position.set(x, 0.36, z); leg.rotation.z = lean;
    addOutline(leg, 0.0018); g.add(leg);
  }
  // a little cloth hanging over the front edge, and an old book at the back
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16), toonMaterial({ color: new THREE.Color('#5b2a7a'), side: THREE.DoubleSide }));
  cloth.position.set(0.1, 0.66, 0.225); g.add(cloth);
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.12), toonMaterial({ color: new THREE.Color('#7a1d2a') }));
  book.position.set(0.22, 0.765, -0.13); book.rotation.y = 0.4; addOutline(book, 0.0016); g.add(book);
  return g;
}

/** The scroll the ghost holds: parchment between two rollers; `unroll(k)` opens it. */
function makeScroll(text) {
  const W = 0.78, H = 0.52;
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: scrollTexture(text), side: THREE.DoubleSide, fog: false }));
  const wood = toonMaterial({ color: new THREE.Color('#6b3f22') }, { rimScale: 0.8 });
  const roller = () => {
    const r = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, W + 0.08, 12), wood); c.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), wood); k.position.x = s * (W / 2 + 0.05); r.add(k); }
    addOutline(c, 0.0018); r.add(c);
    return r;
  };
  const top = roller(), bottom = roller();
  g.add(paper, top, bottom);
  g.unroll = (k) => {
    const h = Math.max(0.001, H * k);
    paper.scale.y = h / H; paper.position.y = -h / 2;
    paper.material.map.repeat.y = Math.max(0.001, k); paper.material.map.offset.y = 1 - Math.max(0.001, k);
    bottom.position.y = -h;
  };
  g.setText = (t) => { paper.material.map.dispose(); paper.material.map = scrollTexture(t); paper.material.needsUpdate = true; g.unroll(g.k ?? 1); };
  g.paper = paper; g.size = { w: W + 0.12, h: H + 0.06 };
  g.unroll(0);
  return g;
}

function scrollTexture(text) {
  const [c, ctx] = canvas(1024, 683);
  const g = ctx.createLinearGradient(0, 0, 0, 683);
  g.addColorStop(0, '#d9c393'); g.addColorStop(0.5, '#f1e2bb'); g.addColorStop(1, '#d4bb88');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 683);
  ctx.fillStyle = 'rgba(120,80,40,0.12)';
  for (let k = 0; k < 14; k++) { const x = Math.random() * 1024, y = Math.random() * 683, r = 20 + Math.random() * 60, g2 = ctx.createRadialGradient(x, y, 0, x, y, r); g2.addColorStop(0, 'rgba(120,80,40,0.1)'); g2.addColorStop(1, 'rgba(120,80,40,0)'); ctx.fillStyle = g2; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#7a1d8a';
  fit(ctx, 'Wish', 400, 76, DRIP, 700);
  ctx.fillText('Wish', 512, 92);
  ctx.fillStyle = '#2a1c22';
  let size = 60, lines;
  for (;;) { ctx.font = `400 ${size}px ${INK}`; lines = wrap(ctx, text || '', 860); if (lines.length * size * 1.32 <= 470 || size <= 26) break; size -= 2; }
  const y0 = 380 - (lines.length - 1) * size * 0.66;
  lines.forEach((l, i) => ctx.fillText(l, 512, y0 + i * size * 1.32));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export class Cauldron {
  constructor(scene, cauldron, wish, brewLight) {
    this.root = cauldron;
    this.brewLight = brewLight;
    cauldron.updateMatrixWorld(true);
    const inv = cauldron.matrixWorld.clone().invert(), box = new THREE.Box3(), b = new THREE.Box3();
    this.potTargets = [];
    cauldron.traverse((m) => {
      if (!m.isMesh || m.userData.isOutline) return;
      this.potTargets.push(m);
      if (/M_cauldron/.test([].concat(m.material)[0]?.name || '')) { m.geometry.computeBoundingBox(); box.union(b.copy(m.geometry.boundingBox).applyMatrix4(inv.clone().multiply(m.matrixWorld))); }
    });
    const brewEmpty = cauldron.getObjectByName('brew');
    const by = brewEmpty ? cauldron.worldToLocal(brewEmpty.getWorldPosition(new THREE.Vector3())).y : 0.76;
    const rr = box.isEmpty() ? 0.42 : Math.min(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5 * 0.82;
    this.u = { uTime: { value: 0 }, uBoil: { value: 0.3 }, uColor: { value: new THREE.Color(BREW[0]) } };
    this.surface = new THREE.Mesh(new THREE.CircleGeometry(rr, 40), new THREE.ShaderMaterial({ vertexShader: brewVert, fragmentShader: brewFrag, uniforms: this.u }));
    this.surface.rotation.x = -Math.PI / 2;
    this.surface.position.y = by;
    cauldron.add(this.surface);
    this.brewY = by; this.r = rr;
    // steam rising from the brew (one Points draw)
    const N = 46, sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    sg.setAttribute('aSeed', new THREE.BufferAttribute(Float32Array.from({ length: N * 2 }, () => Math.random()), 2));
    this.steamU = { uTime: { value: 0 }, uColor: this.u.uColor, uMap: { value: glowTexture(64) }, uPx: { value: 800 }, uR: { value: rr }, uBoil: this.u.uBoil };
    this.steam = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: this.steamU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec2 aSeed; uniform float uTime, uPx, uR, uBoil; varying float vA;
        void main(){ float t = fract(aSeed.x + uTime * (0.18 + 0.12 * uBoil)); float a = aSeed.y * 6.283;
          vec3 p = vec3(cos(a) * uR * 0.7 * aSeed.x, t * 1.6, sin(a) * uR * 0.7 * aSeed.x);
          p.x += sin(t * 6.0 + aSeed.y * 9.0) * 0.12 * t; p.z += cos(t * 5.0 + aSeed.x * 7.0) * 0.12 * t;
          vA = sin(t * 3.14159) * 0.28; vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp((0.1 + t * 0.32) * uPx / -mv.z, 1.0, 90.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform sampler2D uMap; uniform vec3 uColor; varying float vA; void main(){ float a = texture2D(uMap, gl_PointCoord).r * vA; gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.35) * a, a); }',
    }));
    this.steam.position.y = by;
    this.steam.frustumCulled = false;
    cauldron.add(this.steam);
    // splash droplets (instanced, reused)
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 40);
    this.drops.frustumCulled = false; this.drops.visible = false;
    this.dropsP = Array.from({ length: 40 }, () => new THREE.Vector3()); this.dropsV = Array.from({ length: 40 }, () => new THREE.Vector3());
    cauldron.add(this.drops);
    this._d = new THREE.Object3D();
    // an old wooden table beside the pot, the ingredients laid out on it
    this.table = makeTable();
    this.table.position.set(rr + 0.62, 0, 0.42);
    this.table.rotation.y = -0.25;
    cauldron.add(this.table);
    const topY = 0.74;
    this.items = [makeEyeball(), makeToadstool(), makeSpider()].map((mesh, i) => {
      const home = this.table.localToWorld(new THREE.Vector3(-0.2 + i * 0.2, topY + (i === 1 ? 0.0 : 0.06), 0.02 + (i % 2) * 0.05));
      cauldron.worldToLocal(home);
      const holder = new THREE.Group(); holder.position.copy(home);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(64), color: 0xc7a6ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(0.3);
      holder.add(mesh, glow);
      mesh.scale.setScalar(1.15);
      cauldron.add(holder);
      const targets = []; mesh.traverse((m) => { if (m.isMesh && !m.userData.isOutline) { targets.push(m); m.userData.item = i; } });
      return { holder, mesh, glow, home, targets, used: false, phase: i * 2.1 };
    });
    this.held = -1;
    // the ghost and its scroll
    this.ghost = new Ghost({ scale: 0.95 });
    this.ghost.group.position.set(0, by - 0.9, 0);
    this.ghost.opacity = 0;
    cauldron.add(this.ghost.group);
    this.scroll = makeScroll(wish);
    this.scroll.position.set(0, 0.6, 0.44);   // held at the chest, its eyes peeking over the top
    this.scroll.visible = false;
    this.ghost.group.add(this.scroll);
    this.added = 0;
    this.done = false;
  }

  get hitTargets() { return this.done ? [] : this.items.filter((it) => !it.used).flatMap((it) => it.targets).concat(this.potTargets); }
  get focusPoint() { return this.root.localToWorld(new THREE.Vector3(0, this.brewY + 0.25, 0)); }
  get tablePoint() { return this.table.localToWorld(new THREE.Vector3(0, 0.78, 0)); }
  get ghostPoint() { return this.root.localToWorld(new THREE.Vector3(0, this.brewY + 0.95, 0.3)); }
  get scrollPoint() { return this.scroll.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -this.scroll.size.h / 2, 0)); }
  /** The direction the ghost (and the scroll) faces, in the world. */
  get facing() { return new THREE.Vector3(0, 0, 1).applyQuaternion(this.ghost.group.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize(); }

  /** Pick ingredient i up off the table (it lifts into the hand). */
  grab(i) {
    const it = this.items[i];
    if (!it || it.used || this.done || this.held >= 0) return false;
    this.held = i;
    gsap.killTweensOf(it.holder.position);
    this._dragTo = it.holder.position.clone().add(new THREE.Vector3(0, 0.18, 0));
    this._grabFrom = this._dragTo.clone();
    return true;
  }

  /** The held ingredient follows `worldPoint` (the pointer, on a plane through it facing the camera). */
  dragTo(worldPoint) {
    if (this.held < 0) return;
    this._dragTo = this.root.worldToLocal(worldPoint.clone());
  }

  /** Where the held ingredient is (world), for the drag plane. */
  get heldPoint() { return this.held >= 0 ? this.items[this.held].holder.getWorldPosition(new THREE.Vector3()) : null; }

  /** Let go: it flies in an arc into the pot. */
  release(opts) {
    const i = this.held;
    if (i < 0) return Promise.resolve(false);
    this.held = -1;
    return this.add(i, opts);
  }

  /** A tap (no drag): pick it up, a little wobble, and toss it in. */
  toss(i, opts) {
    const it = this.items[i];
    if (!it || it.used || this.done || this.held >= 0) return Promise.resolve(false);
    it.lifting = true;
    return new Promise((resolve) => {
      gsap.timeline({ onComplete: () => { it.lifting = false; this.add(i, opts).then(resolve); } })
        .to(it.holder.position, { y: it.home.y + 0.35, duration: 0.35, ease: 'power2.out' })
        .to(it.mesh.rotation, { z: 0.5, duration: 0.12, yoyo: true, repeat: 1 }, '<0.1');
    });
  }

  /** Index of the next ingredient (for a "add the next one" button), or -1. */
  nextItem() { return this.items.findIndex((it) => !it.used); }

  /** Drop ingredient i into the pot. Resolves when it has splashed. */
  add(i, { onSplash = () => {} } = {}) {
    const it = this.items[i];
    if (!it || it.used || this.done) return Promise.resolve(false);
    it.used = true;
    const st = { k: 0 }, from = it.holder.position.clone(), to = new THREE.Vector3(0, this.brewY, 0);
    const ctrl = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.55 + from.distanceTo(to) * 0.35, 0));
    gsap.to(it.glow.material, { opacity: 0, duration: 0.3 });
    return new Promise((resolve) => {
      gsap.to(st, {
        k: 1, duration: 0.85, ease: 'power1.in',
        onUpdate: () => {
          const k = st.k, a = from.clone().lerp(ctrl, k), b = ctrl.clone().lerp(to, k);
          it.holder.position.copy(a.lerp(b, k));
          it.mesh.rotation.x += 0.25;
          it.holder.scale.setScalar(1 - k * 0.5);
        },
        onComplete: () => {
          it.holder.visible = false;
          this._splash();
          this.added++;
          const col = new THREE.Color(BREW[Math.min(this.added, BREW.length - 1)]);
          gsap.to(this.u.uColor.value, { r: col.r, g: col.g, b: col.b, duration: 0.9 });
          gsap.to(this.u.uBoil, { value: 0.3 + this.added * 0.6, duration: 0.6 });
          if (this.brewLight) gsap.to(this.brewLight.color, { r: col.r, g: col.g, b: col.b, duration: 0.9 });
          onSplash(this.added);
          resolve(true);
        },
      });
    });
  }

  _splash(strength = 1) {
    this.drops.visible = true; this._dropLife = 1.4;
    this.drops.material.color.copy(this.u.uColor.value).multiplyScalar(1.2);
    this.dropsP.forEach((p, i) => {
      const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random() * 0.9) * strength;
      p.set(Math.cos(a) * 0.05, this.brewY + 0.02, Math.sin(a) * 0.05);
      this.dropsV[i].set(Math.cos(a) * s, 1.6 + Math.random() * 2 * strength, Math.sin(a) * s);
    });
  }

  /** The third ingredient is in: a puff, and the ghost rises with the scroll. */
  async summon({ onRise = () => {}, onUnroll = () => {} } = {}) {
    if (this.done) return;
    this.done = true;
    this._splash(1.6);
    const g = this.ghost;
    g.setFace('ooo');
    g.group.position.y = this.brewY - 0.9; g.group.scale.setScalar(0.35);
    const st = { o: 0 };
    onRise();
    await new Promise((r) => {
      gsap.timeline({ onComplete: r })
        .to(st, { o: 1, duration: 0.6, onUpdate: () => { g.opacity = st.o; } })
        .to(g.group.position, { y: this.brewY + 0.15, duration: 1.8, ease: 'back.out(1.6)' }, 0)
        .to(g.group.scale, { x: 0.95, y: 0.95, z: 0.95, duration: 1.8, ease: 'back.out(1.6)' }, 0);
    });
    g.setFace('smile');
    this.scroll.visible = true;
    onUnroll();
    const u = { k: 0 };
    await new Promise((r) => gsap.to(u, { k: 1, duration: 1.3, ease: 'power2.out', onUpdate: () => { this.scroll.k = u.k; this.scroll.unroll(u.k); }, onComplete: r }));
  }

  setWish(text) { this.scroll.setText(text); }

  /** All in, ghost up (jumping ahead). */
  complete() {
    this.items.forEach((it) => { it.used = true; it.holder.visible = false; });
    this.added = 3; this.done = true;
    const col = new THREE.Color(BREW[3]); this.u.uColor.value.copy(col); this.u.uBoil.value = 2; this.brewLight?.color.copy(col);
    this.ghost.group.position.y = this.brewY + 0.15; this.ghost.group.scale.setScalar(0.95); this.ghost.opacity = 1; this.ghost.setFace('smile');
    this.scroll.visible = true; this.scroll.k = 1; this.scroll.unroll(1);
  }

  reset() {
    this.held = -1;
    this.items.forEach((it) => { gsap.killTweensOf(it.holder.position); it.used = false; it.lifting = false; it.holder.visible = true; it.holder.position.copy(it.home); it.holder.scale.setScalar(1); it.glow.material.opacity = 0.5; });
    this.added = 0; this.done = false;
    const col = new THREE.Color(BREW[0]); this.u.uColor.value.copy(col); this.u.uBoil.value = 0.3; this.brewLight?.color.copy(col);
    this.ghost.opacity = 0; this.ghost.group.position.y = this.brewY - 0.9;
    this.scroll.visible = false; this.scroll.k = 0; this.scroll.unroll(0);
  }

  /** Turn the ghost to face `pos` (the camera's spot). */
  faceTowards(pos) {
    const p = this.root.worldToLocal(pos.clone());
    this.ghost.group.rotation.y = Math.atan2(p.x, p.z);
  }

  update(t, dt, renderer, camera) {
    this.u.uTime.value = t; this.steamU.uTime.value = t;
    this.steamU.uPx.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.items.forEach((it, i) => {
      if (it.used) return;
      if (i === this.held) { it.holder.position.lerp(this._dragTo, Math.min(1, dt * 18)); it.mesh.rotation.y += dt * 3; }
      else if (!it.lifting) it.mesh.rotation.y = 0.4 * Math.sin(t * 0.8 + it.phase);
      if (it.mesh.legs) it.mesh.legs.forEach((l, k) => { l.rotation.x = 0.25 * Math.sin(t * 9 + k); });
      it.glow.material.opacity = 0.35 + 0.2 * Math.sin(t * 3 + i);
    });
    if (this.ghost.group.visible) this.ghost.update(t, dt);
    if (this.drops.visible) {
      this._dropLife -= dt;
      this.dropsP.forEach((p, i) => {
        const v = this.dropsV[i]; v.y -= 9.8 * dt; p.addScaledVector(v, dt);
        this._d.position.copy(p); this._d.scale.setScalar(p.y > this.brewY - 0.05 ? Math.max(0, this._dropLife) : 0);
        this._d.updateMatrix(); this.drops.setMatrixAt(i, this._d.matrix);
      });
      this.drops.instanceMatrix.needsUpdate = true;
      if (this._dropLife <= 0) this.drops.visible = false;
    }
  }
}
