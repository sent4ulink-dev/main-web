import * as THREE from 'three';
import { softSprite } from '../util/textures.js';

/** Rose petals (and a little gold leaf) that burst up and flutter down through the salon's still air. */
export class Confetti {
  constructor(scene, count = 420) {
    this.count = count;
    const geo = new THREE.CircleGeometry(0.012, 7); geo.scale(1, 1.5, 1);
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.45, metalness: 0.25 });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    const pal = [0xf2a7b8, 0xe8798f, 0xfbd3dc, 0xf48aa0, 0xc8344f, 0xffe0c2, 0xf2a7b8, 0xe9b949];
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, new THREE.Color(pal[i % pal.length]));
    scene.add(this.mesh);
    this.p = new Float32Array(count * 3); this.v = new Float32Array(count * 3);
    this.r = new Float32Array(count * 3); this.w = new Float32Array(count * 3);
    this.alive = 0;
    this._d = new THREE.Object3D();
  }

  burst(origin, spread = 1) {
    this.mesh.visible = true;
    this.alive = 7;
    for (let i = 0; i < this.count; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.6 + Math.random()) * spread;
      this.p[i * 3] = origin.x + (Math.random() - 0.5) * 0.2; this.p[i * 3 + 1] = origin.y; this.p[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.2;
      this.v[i * 3] = Math.cos(a) * s * 1.6; this.v[i * 3 + 1] = 3.5 + Math.random() * 3.5 * spread; this.v[i * 3 + 2] = Math.sin(a) * s * 1.6;
      for (let k = 0; k < 3; k++) { this.r[i * 3 + k] = Math.random() * 6; this.w[i * 3 + k] = (Math.random() - 0.5) * 14; }
    }
  }

  update(t, dt) {
    if (!this.mesh.visible) return;
    this.alive -= dt;
    const wd = { x: 0.1, y: -0.05 }, ws = 0.4;   // a faint draught from the windows
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      this.v[i3 + 1] -= 9.0 * dt;
      // flutter: strong air drag, terminal fall ~0.5 m/s
      const drag = Math.exp(-dt * 3.2);
      this.v[i3] = this.v[i3] * drag + (wd.x * ws * 0.6 + Math.sin(t * 3 + i) * 0.3) * dt * 3;
      this.v[i3 + 2] = this.v[i3 + 2] * drag + (wd.y * ws * 0.6 + Math.cos(t * 2.7 + i) * 0.3) * dt * 3;
      this.v[i3 + 1] = Math.max(this.v[i3 + 1] * drag, -0.55);
      if (this.p[i3 + 1] > 0.02) {
        this.p[i3] += this.v[i3] * dt; this.p[i3 + 1] += this.v[i3 + 1] * dt; this.p[i3 + 2] += this.v[i3 + 2] * dt;
        for (let k = 0; k < 3; k++) this.r[i3 + k] += this.w[i3 + k] * dt;
      }
      this._d.position.set(this.p[i3], Math.max(0.02, this.p[i3 + 1]), this.p[i3 + 2]);
      this._d.rotation.set(this.r[i3], this.r[i3 + 1], this.r[i3 + 2]);
      this._d.scale.setScalar(this.alive > 0 ? 1 : Math.max(0, 1 + this.alive));
      this._d.updateMatrix();
      this.mesh.setMatrixAt(i, this._d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.alive < -1) this.mesh.visible = false;
  }
}

/** Little music notes floating up from the cassette player while it plays. */
export class MusicNotes {
  constructor(scene) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    this.textures = ['♪', '♫', '♩'].map((ch) => {
      ctx.clearRect(0, 0, 128, 128);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 96px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255,190,210,0.9)'; ctx.shadowBlur = 12;
      ctx.fillText(ch, 64, 70);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      const copy = document.createElement('canvas'); copy.width = copy.height = 128; copy.getContext('2d').drawImage(c, 0, 0);
      const tex = new THREE.CanvasTexture(copy); tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    });
    this.sprites = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.textures[i % 3], color: new THREE.Color(1.0, 0.75, 0.85).multiplyScalar(1.6), transparent: true, depthWrite: false }));
      s.scale.setScalar(0.05);
      s.visible = false;
      scene.add(s);
      this.sprites.push({ s, age: 99, life: 2.6 });
    }
    this.origin = new THREE.Vector3();
    this.active = false;
    this._timer = 0;
  }

  update(t, dt) {
    this._timer -= dt;
    if (this.active && this._timer <= 0) {
      const free = this.sprites.find((n) => n.age > n.life);
      if (free) { free.age = 0; free.x = (Math.random() - 0.5) * 0.1; free.z = (Math.random() - 0.5) * 0.1; free.phase = Math.random() * 6; }
      this._timer = 0.55;
    }
    for (const n of this.sprites) {
      n.age += dt;
      const k = n.age / n.life;
      n.s.visible = k < 1;
      if (!n.s.visible) continue;
      n.s.position.set(this.origin.x + n.x + Math.sin(n.age * 2.5 + n.phase) * 0.05, this.origin.y + 0.12 + n.age * 0.22, this.origin.z + n.z);
      n.s.material.opacity = Math.sin(Math.min(k, 1) * Math.PI);
      n.s.material.rotation = Math.sin(n.age * 2 + n.phase) * 0.3;
    }
  }
}

/** Fireflies drifting over the twilight meadow: warm, slowly blinking points. */
export class Fireflies {
  constructor(scene, count = 110, radius = 11) {
    this.count = count; this.radius = radius;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.seed = new Float32Array(count);
    this.home = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.5 + Math.sqrt(Math.random()) * radius;
      this.home.push([Math.cos(a) * r, 0.25 + Math.random() * 2.2, Math.sin(a) * r]);
      this.seed[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uMap: { value: softSprite(64, 0.12) }, uPx: { value: 800 }, uTime: { value: 0 }, uLevel: { value: 1 } },
      vertexShader: /* glsl */ `attribute float aSeed; uniform float uPx; uniform float uTime; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float blink = smoothstep(0.2, 1.0, sin(uTime * (0.6 + aSeed * 0.9) + aSeed * 30.0) * 0.5 + 0.5);
          vA = 0.15 + blink * 0.85;
          gl_PointSize = uPx * (0.018 + aSeed * 0.012) / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `uniform sampler2D uMap; uniform float uLevel; varying float vA;
        void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA * uLevel; if (a < 0.004) discard;
          gl_FragColor = vec4(vec3(1.0, 0.86, 0.42) * a * 3.0, a); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(t, dt, camera, level = 1) {
    const u = this.mat.uniforms;
    u.uTime.value = t; u.uLevel.value = level;
    u.uPx.value = innerHeight * Math.min(devicePixelRatio, 2) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (let i = 0; i < this.count; i++) {
      const h = this.home[i], s = this.seed[i];
      this.pos[i * 3] = h[0] + Math.sin(t * (0.21 + s * 0.2) + s * 40) * 0.9;
      this.pos[i * 3 + 1] = h[1] + Math.sin(t * (0.37 + s * 0.3) + s * 17) * 0.35;
      this.pos[i * 3 + 2] = h[2] + Math.cos(t * (0.19 + s * 0.2) + s * 23) * 0.9;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

const sparkVert = /* glsl */ `
attribute vec3 aVel;
attribute float aSeed;
uniform vec3 uOrigin;
uniform float uT, uPx, uTime;
varying float vA; varying float vHue;
void main() {
  float t = max(0.0, uT - aSeed * 0.35);
  float k = 1.6;                                    // air drag
  vec3 p = uOrigin + aVel * (1.0 - exp(-k * t)) / k + vec3(0.0, -0.9 * t * t, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float life = 1.0 - smoothstep(2.2, 3.4, t);
  float tw = 0.55 + 0.45 * sin(uTime * 22.0 + aSeed * 60.0);
  vA = life * tw * step(0.001, t);
  vHue = fract(aSeed * 7.0);
  gl_PointSize = clamp(0.022 * uPx / -mv.z, 1.5, 28.0);
  gl_Position = projectionMatrix * mv;
}`;
const sparkFrag = /* glsl */ `
varying float vA; varying float vHue;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = smoothstep(0.5, 0.0, d);
  float cross = max(smoothstep(0.07, 0.0, abs(c.x)) * smoothstep(0.5, 0.0, abs(c.y)), smoothstep(0.07, 0.0, abs(c.y)) * smoothstep(0.5, 0.0, abs(c.x)));
  vec3 col = vHue < 0.6 ? vec3(1.0, 0.82, 0.45) : (vHue < 0.85 ? vec3(1.0, 0.95, 0.9) : vec3(1.0, 0.6, 0.78));
  gl_FragColor = vec4(col * 2.2, (core * core + cross * 0.6) * vA);
}`;

/** Golden glitter that fountains up from a point and twinkles as it falls (the candles' celebration). */
export class Sparkles {
  constructor(scene, count = 320) {
    const g = new THREE.BufferGeometry();
    const vel = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, up = 2.2 + Math.random() * 2.6, out = 0.4 + Math.random() * 1.3;
      vel.set([Math.cos(a) * out, up, Math.sin(a) * out], i * 3);
      seed[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.uniforms = { uOrigin: { value: new THREE.Vector3() }, uT: { value: 10 }, uPx: { value: 800 }, uTime: { value: 0 } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: sparkVert, fragmentShader: sparkFrag, uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
  }

  burst(origin) { this.uniforms.uOrigin.value.copy(origin); this.uniforms.uT.value = 0; this.points.visible = true; }

  update(t, dt, renderer, camera) {
    if (!this.points.visible) return;
    this.uniforms.uTime.value = t;
    this.uniforms.uT.value += dt;
    this.uniforms.uPx.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    if (this.uniforms.uT.value > 4) this.points.visible = false;
  }
}
