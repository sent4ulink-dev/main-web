import * as THREE from 'three';
import gsap from 'gsap';
import { assets, findNode } from '../core/assets.js';
import { toonify } from '../style/toon.js';

const BALL_R = 0.05, BALL_Y = 0.091;   // from art/blender/scripts/stylized_props.py
const REST_GLOW = 0.32;                // a gentle swirl even before the spell

const ballVert = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = position / ${BALL_R.toFixed(3)};
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const ballFrag = /* glsl */ `
uniform float uTime, uGlow;
uniform vec3 uColA, uColB;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
void main() {
  float facing = max(dot(normalize(vN), normalize(vV)), 0.0);
  float fres = pow(max(1.0 - facing, 0.0), 2.2);   // max(): dot() can exceed 1 by a hair → pow(neg) = NaN
  float t = uTime * (0.3 + uGlow * 1.2);
  vec3 p = vP;
  float a = t * 0.8; p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
  float n = noise(p * 2.3 + vec3(0.0, t * 0.7, 0.0)) * 0.62 + noise(p * 5.1 - vec3(t, 0.0, t * 0.5)) * 0.38;
  // swirl arms around the vertical axis
  float arms = 0.5 + 0.5 * sin(atan(p.z, p.x) * 3.0 + length(p.xz) * 6.0 - t * 2.0);
  float body = facing;                                // denser through the middle of the ball
  vec3 neb = mix(uColA, uColB, n) * (0.25 + 0.9 * n * (0.6 + 0.4 * arms)) * (0.65 + uGlow * 2.0) * (0.45 + 0.55 * body);
  vec3 col = neb + vec3(0.88, 0.84, 1.0) * fres * (0.5 + uGlow * 0.7);
  // a little window-shaped highlight
  col += vec3(1.0) * smoothstep(0.92, 0.99, dot(normalize(vN), normalize(vec3(-0.5, 0.7, 0.6)))) * 0.8;
  float alpha = clamp(0.52 + fres * 0.48 + n * 0.3 * (0.5 + uGlow), 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}`;

const sparkVert = /* glsl */ `
attribute vec4 aOrbit;   // radius, angle, speed, height
uniform float uTime, uGlow, uPx;
varying float vA;
void main() {
  float ang = aOrbit.y + uTime * aOrbit.z * (0.4 + uGlow * 2.5);
  vec3 p = vec3(cos(ang) * aOrbit.x, aOrbit.w + sin(uTime * 1.3 + aOrbit.y) * 0.004, sin(ang) * aOrbit.x);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA = 0.25 + uGlow * 0.75;
  gl_PointSize = clamp(0.0035 * uPx / -mv.z, 1.0, 14.0) * (0.6 + uGlow * 0.8);
  gl_Position = projectionMatrix * mv;
}`;
const sparkFrag = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vec3(1.0, 0.9, 1.0) * 1.6, a * vA);
}`;

/**
 * A crystal ball on a turned walnut stand, with a magic wand beside it. Casting the spell wakes the
 * nebula inside, the wand taps the glass, and a stream of stars flies up to write a name in the sky.
 */
export class CrystalBall {
  constructor(parent, anchor) {
    this.group = new THREE.Group();
    this.group.name = 'crystal-ball';
    this.group.position.copy(anchor.position);
    this.group.rotation.y = anchor.yaw || 0;
    parent.add(this.group);
    const props = assets.models.props;

    // (keep each node's own transform: the mesh quantisation offset lives there)
    const stand = findNode(props, 'crystal_stand').clone(true);
    toonify(stand, { outline: true, width: 0.0017, tint: new THREE.Color(0.8, 0.72, 0.68) });
    this.group.add(stand);

    this.uniforms = {
      uTime: { value: 0 }, uGlow: { value: REST_GLOW }, uPx: { value: 800 },
      uColA: { value: new THREE.Color('#6a4cff') }, uColB: { value: new THREE.Color('#ff6fc0') },
    };
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32),
      new THREE.ShaderMaterial({ vertexShader: ballVert, fragmentShader: ballFrag, uniforms: this.uniforms, transparent: true, depthWrite: false }));
    this.ball.position.y = BALL_Y;
    this.ball.renderOrder = 2;
    this.group.add(this.ball);

    // sparks orbiting inside the glass
    const N = 46, orbit = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) orbit.set([Math.random() * BALL_R * 0.75, Math.random() * Math.PI * 2, 0.6 + Math.random() * 1.4, (Math.random() - 0.5) * BALL_R * 1.1], i * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aOrbit', new THREE.BufferAttribute(orbit, 4));
    this.sparks = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: sparkVert, fragmentShader: sparkFrag, uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sparks.position.y = BALL_Y;
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 3;
    this.group.add(this.sparks);

    // inner glow light (always present so the light count never changes)
    this.light = new THREE.PointLight(0xc79bff, 0.25, 1.4, 2);
    this.light.position.y = BALL_Y;
    this.group.add(this.light);

    // the wand rests in front of the stand
    this.wand = findNode(props, 'magic_wand').clone(true);
    toonify(this.wand, { outline: true, width: 0.0015 });
    this.wandRig = new THREE.Group();
    this.wandRig.add(this.wand);
    this.wandHome = { pos: new THREE.Vector3(0.02, 0.0, 0.085), rot: new THREE.Euler(0, 0.35, 0) };
    this.wandRig.position.copy(this.wandHome.pos);
    this.wandRig.rotation.copy(this.wandHome.rot);
    this.group.add(this.wandRig);

    this.cast = false;
    this.hitTargets = [this.ball];
    stand.traverse((o) => { if (o.isMesh && !o.userData.isOutline) this.hitTargets.push(o); });
    this.wand.traverse((o) => { if (o.isMesh && !o.userData.isOutline) this.hitTargets.push(o); });
  }

  get ballCenter() { return this.group.localToWorld(new THREE.Vector3(0, BALL_Y, 0)); }
  get focusPoint() { return this.group.localToWorld(new THREE.Vector3(0, BALL_Y - 0.01, 0)); }

  /** Wand taps the ball and the glow swells. Resolves at the moment the stars should launch. */
  spell() {
    if (this.cast) return Promise.resolve();
    this.cast = true;
    const w = this.wandRig;
    return new Promise((resolve) => {
      const tl = gsap.timeline();
      // the wand floats up beside the ball, pointing at it …
      tl.to(w.position, { x: 0.075, y: BALL_Y + 0.06, z: 0.06, duration: 0.9, ease: 'power2.inOut' })
        .to(w.rotation, { x: 0, y: 0.6, z: -0.75, duration: 0.9, ease: 'power2.inOut' }, '<')
        // … taps twice
        .to(w.rotation, { z: -0.95, duration: 0.12, yoyo: true, repeat: 3, ease: 'power1.inOut' })
        .to(this.uniforms.uGlow, { value: 1, duration: 1.4, ease: 'power2.inOut' }, '-=0.3')
        .to(this.light, { intensity: 1.6, duration: 1.4, ease: 'power2.inOut' }, '<')
        .add(resolve, '-=0.2')
        // the wand settles back down
        .to(w.position, { x: this.wandHome.pos.x, y: this.wandHome.pos.y, z: this.wandHome.pos.z, duration: 1.0, ease: 'power2.inOut' }, '+=0.6')
        .to(w.rotation, { x: this.wandHome.rot.x, y: this.wandHome.rot.y, z: this.wandHome.rot.z, duration: 1.0, ease: 'power2.inOut' }, '<')
        .to(this.uniforms.uGlow, { value: 0.6, duration: 2.5 }, '+=1.5')
        .to(this.light, { intensity: 0.5, duration: 2.5 }, '<');
    });
  }

  reset() {
    this.cast = false;
    gsap.killTweensOf([this.wandRig.position, this.wandRig.rotation, this.uniforms.uGlow, this.light]);
    this.wandRig.position.copy(this.wandHome.pos);
    this.wandRig.rotation.copy(this.wandHome.rot);
    this.uniforms.uGlow.value = REST_GLOW;
    this.light.intensity = 0.25;
  }

  update(t, renderer, camera) {
    this.uniforms.uTime.value = t;
    this.uniforms.uPx.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
}

// ── stars that write a name in the sky ───────────────────────────────────────

const starVert = /* glsl */ `
attribute vec3 aStart, aCtrl, aEnd;
attribute float aDelay, aSize, aPhase;
uniform float uT, uDur, uPx, uTime;
varying float vA; varying float vHue;
void main() {
  float k = clamp((uT - aDelay) / uDur, 0.0, 1.0);
  float e = k * k * (3.0 - 2.0 * k);
  vec3 p = mix(mix(aStart, aCtrl, e), mix(aCtrl, aEnd, e), e);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float tw = 0.7 + 0.3 * sin(uTime * (1.5 + aPhase * 2.0) + aPhase * 40.0);
  float moving = 1.0 - smoothstep(0.8, 1.0, k);
  float size = mix(0.012, aSize, e);
  vA = step(0.0, uT - aDelay) * mix(1.0, tw, smoothstep(0.9, 1.0, k));
  vHue = aPhase;
  gl_PointSize = clamp(size * uPx / -mv.z, 1.5, 26.0) * (1.0 + moving * 0.8);
  gl_Position = projectionMatrix * mv;
}`;
const starFrag = /* glsl */ `
varying float vA; varying float vHue;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = smoothstep(0.5, 0.0, d);
  float cross = max(smoothstep(0.08, 0.0, abs(c.x)) * smoothstep(0.5, 0.1, abs(c.y)), smoothstep(0.08, 0.0, abs(c.y)) * smoothstep(0.5, 0.1, abs(c.x)));
  vec3 col = mix(vec3(1.0, 0.92, 0.75), vec3(1.0, 0.72, 0.9), vHue);
  gl_FragColor = vec4(col * 1.8, (core * core + cross * 0.5) * vA);
}`;

/**
 * Points along the strokes of `name`, in the handwriting font, centred, in metres. Long names (e.g. a
 * 14-letter Mongolian name) break onto two lines at a hyphen or space and are scaled to fit maxW.
 */
function namePoints(name, maxW = 12.5) {
  const c = document.createElement('canvas');
  c.width = 1600; c.height = 640;
  const ctx = c.getContext('2d');
  let size = 230;
  const setFont = () => { ctx.font = `700 ${size}px Caveat, cursive`; };
  setFont();
  let lines = [name];
  if (ctx.measureText(name).width > 1050 && name.length > 8) {
    const mid = name.length / 2;
    let cut = -1;
    for (let i = 1; i < name.length - 1; i++) if (/[-\s]/.test(name[i]) && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
    if (cut < 0) cut = Math.round(mid);
    const hyphen = name[cut] === '-';
    lines = [name.slice(0, cut + (hyphen ? 1 : 0)).trim(), name.slice(cut + (hyphen ? 1 : 0)).trim()].filter(Boolean);
  }
  const widest = () => Math.max(...lines.map((l) => ctx.measureText(l).width));
  while (size > 60 && (widest() > c.width - 80 || size * 0.95 * lines.length > c.height - 60)) { size -= 6; setFont(); }
  const lineH = size * 0.95;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  lines.forEach((l, i) => ctx.fillText(l, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * lineH));
  const widthPx = widest(), heightPx = lineH * lines.length;
  const mpp = Math.min(0.026, maxW / widthPx);
  const img = ctx.getImageData(0, 0, c.width, c.height).data;
  const step = Math.max(4, Math.round(7 * size / 270));
  const pts = [];
  for (let y = 0; y < c.height; y += step) {
    for (let x = 0; x < c.width; x += step) {
      if (img[(y * c.width + x) * 4 + 3] > 140) pts.push([(x - c.width / 2 + (Math.random() - 0.5) * 3) * mpp, -(y - c.height / 2 + (Math.random() - 0.5) * 3) * mpp]);
    }
  }
  return { pts, width: widthPx * mpp, height: heightPx * mpp };
}

function heartPoints(width, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    out.push([x / 32 * width, y / 32 * width + width * 0.06]);
  }
  return out;
}

export class StarWriting {
  constructor(scene, name) {
    this.uniforms = { uT: { value: -1 }, uDur: { value: 2.8 }, uPx: { value: 800 }, uTime: { value: 0 } };
    this.points = new THREE.Points(this._geometry(name), new THREE.ShaderMaterial({
      vertexShader: starVert, fragmentShader: starFrag, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = -8;   // drawn with the sky, behind the trees
    scene.add(this.points);
    this.running = false;
  }

  _geometry(name) {
    const { pts, width, height } = namePoints(name);
    const heartW = THREE.MathUtils.clamp(Math.max(width * 1.45, height * 1.9), 17.5, 22);
    const lift = heartW * 0.05;   // sit the name a touch above the heart's middle
    const heart = heartPoints(heartW, 120);
    const extra = [];
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2, r = heartW * (0.62 + Math.random() * 0.45);
      extra.push([Math.cos(a) * r, Math.sin(a) * r * 0.8]);
    }
    // plane coordinates + per-star size (metres) and launch delay
    this.local = [
      ...pts.map(([x, y]) => [x, y + lift, 0.3 + Math.random() * 0.12, 0.5 + Math.random() * 0.9]),
      ...heart.map(([x, y], i) => [x, y, i % 10 === 0 ? 0.75 : 0.38, (i / heart.length) * 1.6]),
      ...extra.map(([x, y]) => [x, y, 0.25 + Math.random() * 0.4, 1.0 + Math.random() * 1.2]),
    ];
    const N = this.local.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    for (const k of ['aStart', 'aCtrl', 'aEnd']) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aDelay', new THREE.BufferAttribute(new Float32Array(this.local.map((p) => p[3])), 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(this.local.map((p) => p[2])), 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(N).map(() => Math.random()), 1));
    return g;
  }

  /** A new (edited) name: rebuild the writing in place; stars already in the sky stay there. */
  setName(name) {
    const old = this.points.geometry;
    this.points.geometry = this._geometry(name);
    old.dispose();
    if (this._placed) this.place(...this._placed);
    if (this.running && this._from) { this.launch(this._from); this.uniforms.uT.value = 30; }
  }

  /** Lay the writing out on a plane centred at `center`, facing `viewer`. */
  place(center, viewer) {
    this._placed = [center.clone(), viewer.clone()];
    this.center = center.clone();
    const n = viewer.clone().sub(center).normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    const up = n.clone().cross(right).normalize();
    const end = this.points.geometry.attributes.aEnd;
    this.local.forEach(([x, y], i) => {
      const p = center.clone().addScaledVector(right, x).addScaledVector(up, y);
      end.setXYZ(i, p.x, p.y, p.z);
    });
    end.needsUpdate = true;
  }

  /** Launch every star from `from` (the crystal ball) along a sweeping arc. */
  launch(from) {
    this._from = from.clone();
    const g = this.points.geometry;
    const s = g.attributes.aStart, c = g.attributes.aCtrl, e = g.attributes.aEnd;
    for (let i = 0; i < s.count; i++) {
      const j = new THREE.Vector3((Math.random() - 0.5) * 0.03, Math.random() * 0.03, (Math.random() - 0.5) * 0.03);
      const a = from.clone().add(j);
      const b = new THREE.Vector3(e.getX(i), e.getY(i), e.getZ(i));
      // control point: up out of the ball first, then curving across the sky
      const mid = a.clone().lerp(b, 0.35);
      mid.y = a.y + (b.y - a.y) * 0.9 + 6 + Math.random() * 4;
      mid.x += (Math.random() - 0.5) * 8; mid.z += (Math.random() - 0.5) * 8;
      s.setXYZ(i, a.x, a.y, a.z); c.setXYZ(i, mid.x, mid.y, mid.z);
    }
    s.needsUpdate = true; c.needsUpdate = true;
    this.uniforms.uT.value = 0;
    this.points.visible = true;
    this.running = true;
  }

  /** Seconds until every star has arrived. */
  get duration() { return 2.6 + this.uniforms.uDur.value; }

  reset() { this.running = false; this.points.visible = false; this.uniforms.uT.value = -1; }

  update(t, dt, renderer, camera) {
    this.uniforms.uTime.value = t;
    if (this.running) this.uniforms.uT.value += dt;
    this.uniforms.uPx.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
}
