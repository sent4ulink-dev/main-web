import * as THREE from 'three';
import { softSprite } from '../util/textures.js';

// GPU fireworks: every particle's path is solved analytically in the vertex shader
// (drag + gravity), so thousands of sparks cost almost nothing on the CPU.

const TRAIL = 7;
const G = -9.0;

const vert = /* glsl */ `
attribute vec3 aVel;
attribute vec3 aColor;
attribute float aSeed;
attribute float aTrail;
uniform float uAge;
uniform float uLife;
uniform float uDrag;
uniform float uGrav;
uniform float uPx;
uniform float uSize;
uniform vec3 uOrigin;
varying vec3 vColor;
varying float vAlpha;
vec3 pathAt(float t) {
  float k = uDrag;
  float e = (1.0 - exp(-k * t)) / k;
  return uOrigin + aVel * e + vec3(0.0, uGrav, 0.0) * (t - e) / k;
}
void main() {
  float lag = aTrail * 0.035;
  float t = max(uAge - lag, 0.0);
  vec3 p = pathAt(t);
  float life = uLife * (0.75 + 0.5 * aSeed);
  float fade = 1.0 - smoothstep(life * 0.55, life, t);
  float twinkle = 0.65 + 0.35 * sin(uAge * (25.0 + aSeed * 30.0) + aSeed * 50.0);
  float hot = exp(-t * 3.0);
  vColor = mix(aColor, vec3(1.0, 0.95, 0.85), hot * 0.7) * (4.0 + hot * 7.0);
  vAlpha = fade * (aTrail == 0.0 ? 1.0 : (1.0 - aTrail / ${TRAIL.toFixed(1)}) * 0.55) * (t > 0.0 ? 1.0 : 0.0) * mix(1.0, twinkle, step(0.5, aSeed));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * uPx * (1.0 - aTrail * 0.12) * (0.6 + 0.4 * fade) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
uniform sampler2D uMap;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a, a);
}`;

const PALETTES = [
  [[1.0, 0.45, 0.62], [1.0, 0.8, 0.9]],
  [[0.65, 0.5, 1.0], [0.95, 0.85, 1.0]],
  [[1.0, 0.78, 0.35], [1.0, 0.95, 0.7]],
  [[0.45, 0.85, 1.0], [0.85, 0.97, 1.0]],
  [[1.0, 0.35, 0.3], [1.0, 0.75, 0.4]],
  [[0.55, 1.0, 0.7], [0.9, 1.0, 0.85]],
];

function heartPoint(u) {
  // classic heart curve, normalised to ~unit size
  const x = 16 * Math.pow(Math.sin(u), 3);
  const y = 13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u);
  return [x / 17, y / 17];
}

export class Fireworks {
  constructor(scene, camera, { onBurst } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.onBurst = onBurst;
    this.map = softSprite(64, 0.12);
    this.bursts = [];
    this.shells = [];
    this.flash = 0;
    this.time = 0;
    this.auto = false;
    this._next = 0;
  }

  get pxScale() {
    const h = innerHeight * (this.pixelRatio?.() ?? Math.min(devicePixelRatio, 2));
    return h / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
  }

  /** Launch one shell from `from` (ground) to burst at `at`. */
  launch(at, type = 'peony', palette = null) {
    const from = at.clone(); from.y = 0;
    const h = at.y - from.y;
    const v0 = Math.sqrt(2 * -G * h);
    const dur = v0 / -G;
    const geo = new THREE.BufferGeometry();
    const n = TRAIL * 3;
    const pos = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: this.map, color: new THREE.Color(1.0, 0.8, 0.5).multiplyScalar(5), size: 1.0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.shells.push({ pts, from, at, v0, dur, t: 0, type, palette });
  }

  /** Stand-ins with the same shaders as a burst and a rising shell, to compile them during loading
   * (otherwise the first firework of the finale stalls a frame while its shader compiles). */
  warmers() {
    const g = new THREE.BufferGeometry();
    for (const [k, n] of [['position', 3], ['aVel', 3], ['aColor', 3], ['aSeed', 1], ['aTrail', 1]]) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n), n));
    const burst = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAge: { value: 0 }, uLife: { value: 1 }, uDrag: { value: 1 }, uGrav: { value: G }, uPx: { value: 1 }, uSize: { value: 1 }, uOrigin: { value: new THREE.Vector3() }, uMap: { value: this.map } },
    }));
    const shell = new THREE.Points(g, new THREE.PointsMaterial({ map: this.map, size: 1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    for (const p of [burst, shell]) p.frustumCulled = false;
    return [burst, shell];
  }

  _burst(at, type, palette) {
    const pal = (palette || PALETTES[Math.floor(Math.random() * PALETTES.length)]).map((c) => c.slice());
    const cfg = {
      peony: { n: 620, speed: 30, drag: 1.5, life: 2.6, size: 0.68 },
      ring: { n: 320, speed: 28, drag: 1.4, life: 2.4, size: 0.68 },
      willow: { n: 420, speed: 18, drag: 0.9, life: 4.4, size: 0.59 },
      glitter: { n: 700, speed: 26, drag: 1.7, life: 3.0, size: 0.5 },
      heart: { n: 360, speed: 24, drag: 1.3, life: 2.8, size: 0.74 },
      crossette: { n: 460, speed: 34, drag: 1.9, life: 2.2, size: 0.62 },
    }[type] || { n: 500, speed: 25, drag: 1.6, life: 2.4, size: 0.34 };
    if (type === 'willow') pal[0] = [1.0, 0.72, 0.3];
    const N = cfg.n * TRAIL;
    const vel = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = new Float32Array(N), trail = new Float32Array(N), pos = new Float32Array(N * 3);
    // orient ring/heart planes toward the camera
    const toCam = this.camera.position.clone().sub(at).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toCam).normalize();
    const up = new THREE.Vector3().crossVectors(toCam, right).normalize();
    const tilt = (Math.random() - 0.5) * 0.5;
    const v = new THREE.Vector3();
    for (let i = 0; i < cfg.n; i++) {
      const s = Math.random();
      if (type === 'ring') {
        const a = (i / cfg.n) * Math.PI * 2;
        v.copy(right).multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a) * Math.cos(tilt)).addScaledVector(toCam, Math.sin(a) * Math.sin(tilt));
        v.multiplyScalar(cfg.speed * (0.96 + Math.random() * 0.08));
      } else if (type === 'heart') {
        const [hx, hy] = heartPoint((i / cfg.n) * Math.PI * 2);
        v.copy(right).multiplyScalar(hx).addScaledVector(up, hy + 0.15).multiplyScalar(cfg.speed * (0.97 + Math.random() * 0.06));
      } else {
        // uniform sphere
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        v.set(r * Math.cos(a), u, r * Math.sin(a)).multiplyScalar(cfg.speed * (type === 'glitter' ? 0.4 + Math.random() * 0.6 : 0.85 + Math.random() * 0.2));
      }
      const c = s < 0.7 ? pal[0] : pal[1];
      for (let k = 0; k < TRAIL; k++) {
        const j = i * TRAIL + k;
        vel[j * 3] = v.x; vel[j * 3 + 1] = v.y; vel[j * 3 + 2] = v.z;
        col[j * 3] = c[0]; col[j * 3 + 1] = c[1]; col[j * 3 + 2] = c[2];
        seed[j] = type === 'glitter' ? 0.6 + s * 0.4 : s * 0.5;
        trail[j] = k;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aTrail', new THREE.BufferAttribute(trail, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uAge: { value: 0 }, uLife: { value: cfg.life }, uDrag: { value: cfg.drag }, uGrav: { value: type === 'willow' ? G * 0.8 : G * 0.45 },
        uPx: { value: this.pxScale }, uSize: { value: cfg.size }, uOrigin: { value: at.clone() }, uMap: { value: this.map },
      },
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.bursts.push({ pts, age: 0, life: cfg.life * 1.4 + 0.3 });
    this.flash = Math.min(1.5, this.flash + 0.9);
    const color = new THREE.Color(pal[0][0], pal[0][1], pal[0][2]);
    this.onBurst?.({ position: at.clone(), type, color, distance: at.distanceTo(this.camera.position) });
    if (type === 'crossette') {
      // secondary mini bursts
      for (let k = 0; k < 4; k++) {
        const off = new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 18);
        setTimeout(() => this._burst(at.clone().add(off), 'peony', pal), 450 + k * 90);
      }
    }
  }

  /** Start an automatic show over the meadow, centred on `centre`. */
  startShow(centre, duration = 30) {
    this.auto = true;
    this.showCentre = centre.clone();
    const toC = centre.clone().sub(this.camera.position).setY(0).normalize();
    this.showSide = new THREE.Vector3(-toC.z, 0, toC.x);
    this.showEnd = this.time + duration;
    this._next = this.time + 0.2;
    this._seq = 0;
  }

  stopShow() { this.auto = false; }

  update(dt) {
    this.time += dt;
    const px = this.pxScale;
    if (this.auto && this.time >= this._next) {
      const types = ['peony', 'ring', 'willow', 'peony', 'heart', 'glitter', 'crossette', 'peony', 'ring', 'heart'];
      const type = types[this._seq % types.length];
      const c = this.showCentre;
      const side = this.showSide || new THREE.Vector3(1, 0, 0);
      const at = c.clone().addScaledVector(side, (Math.random() - 0.5) * 90).add(new THREE.Vector3(0, 26 + Math.random() * 30, 0));
      this.launch(at, type);
      if (Math.random() < 0.35) this.launch(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 10, 0)), 'peony');
      this._seq++;
      const finale = this.time > this.showEnd - 6;
      this._next = this.time + (finale ? 0.35 + Math.random() * 0.3 : 1.1 + Math.random() * 1.1);
      if (this.time > this.showEnd) {
        this._next = this.time + 4.5 + Math.random() * 3; // keep a gentle trickle going afterwards
        this.showEnd = this.time + 9999;
      }
    }
    // shells rising
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.t += dt;
      const pos = s.pts.geometry.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const tt = Math.max(0, s.t - k * 0.03);
        const f = Math.min(tt / s.dur, 1);
        const y = s.from.y + s.v0 * tt + 0.5 * G * tt * tt;
        pos.setXYZ(k, THREE.MathUtils.lerp(s.from.x, s.at.x, f) + Math.sin(tt * 18) * 0.15, y, THREE.MathUtils.lerp(s.from.z, s.at.z, f));
      }
      pos.needsUpdate = true;
      s.pts.material.opacity = 1 - Math.max(0, s.t - s.dur) * 4;
      if (s.t >= s.dur && !s.burst) { s.burst = true; this._burst(s.at, s.type, s.palette); }
      if (s.t > s.dur + 0.3) { this.scene.remove(s.pts); s.pts.geometry.dispose(); s.pts.material.dispose(); this.shells.splice(i, 1); }
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      b.pts.material.uniforms.uAge.value = b.age;
      b.pts.material.uniforms.uPx.value = px;
      if (b.age > b.life) { this.scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); this.bursts.splice(i, 1); }
    }
    this.flash *= Math.exp(-dt * 3.2);
  }

  clear() {
    this.auto = false;
    for (const b of [...this.bursts, ...this.shells]) { this.scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); }
    this.bursts = []; this.shells = [];
  }
}
