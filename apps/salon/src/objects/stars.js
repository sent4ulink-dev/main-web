import * as THREE from 'three';

// Golden stars that fly off the quill's page and write the name inside a heart, floating in the air
// of the salon (the picnic's sky-writing, scaled down to a room: `scale` shrinks the whole drawing).

const starVert = /* glsl */ `
attribute vec3 aStart, aCtrl, aEnd;
attribute float aDelay, aSize, aPhase;
uniform float uT, uDur, uPx, uTime, uScale;
varying float vA; varying float vHue;
void main() {
  float k = clamp((uT - aDelay) / uDur, 0.0, 1.0);
  float e = k * k * (3.0 - 2.0 * k);
  vec3 p = mix(mix(aStart, aCtrl, e), mix(aCtrl, aEnd, e), e);
  // once written, the stars breathe a little in the warm air
  p.y += sin(uTime * 0.9 + aPhase * 30.0) * 0.012 * uScale * 10.0 * smoothstep(0.95, 1.0, k);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float tw = 0.65 + 0.35 * sin(uTime * (1.5 + aPhase * 2.0) + aPhase * 40.0);
  float moving = 1.0 - smoothstep(0.8, 1.0, k);
  float size = mix(0.012 * uScale * 4.0, aSize, e);
  vA = step(0.0, uT - aDelay) * mix(1.0, tw, smoothstep(0.9, 1.0, k));
  vHue = aPhase;
  gl_PointSize = clamp(size * uPx / -mv.z, 1.5, 30.0) * (1.0 + moving * 0.8);
  gl_Position = projectionMatrix * mv;
}`;
const starFrag = /* glsl */ `
varying float vA; varying float vHue;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = smoothstep(0.5, 0.0, d);
  float cross = max(smoothstep(0.08, 0.0, abs(c.x)) * smoothstep(0.5, 0.1, abs(c.y)), smoothstep(0.08, 0.0, abs(c.y)) * smoothstep(0.5, 0.1, abs(c.x)));
  vec3 col = mix(vec3(1.0, 0.86, 0.52), vec3(1.0, 0.7, 0.62), vHue * vHue);
  gl_FragColor = vec4(col * 1.8, (core * core + cross * 0.55) * vA);
}`;

/**
 * Points along the strokes of `name`, in the calligraphy font, centred, in metres (before scaling).
 * Long names break onto two lines at a hyphen or space and are scaled to fit maxW.
 */
function namePoints(name, font, maxW = 12.5) {
  const c = document.createElement('canvas');
  c.width = 1600; c.height = 640;
  const ctx = c.getContext('2d');
  let size = 230;
  const setFont = () => { ctx.font = `400 ${size}px ${font}`; };
  setFont();
  let lines = [name];
  if (ctx.measureText(name).width > 1150 && name.length > 8) {
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
  const step = Math.max(3, Math.round(6 * size / 270));
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
  constructor(scene, name, { scale = 1, font = "'Bad Script', cursive" } = {}) {
    this.scale = scale; this.font = font;
    this.uniforms = { uT: { value: -1 }, uDur: { value: 2.8 }, uPx: { value: 800 }, uTime: { value: 0 }, uScale: { value: scale } };
    this.points = new THREE.Points(this._geometry(name), new THREE.ShaderMaterial({
      vertexShader: starVert, fragmentShader: starFrag, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
    this.running = false;
  }

  _geometry(name) {
    const s = this.scale;
    const { pts, width, height } = namePoints(name, this.font);
    const heartW = THREE.MathUtils.clamp(Math.max(width * 1.45, height * 1.9), 17.5, 22);
    const lift = heartW * 0.05;   // sit the name a touch above the heart's middle
    const heart = heartPoints(heartW, 130);
    const extra = [];
    for (let i = 0; i < 44; i++) {
      const a = Math.random() * Math.PI * 2, r = heartW * (0.62 + Math.random() * 0.45);
      extra.push([Math.cos(a) * r, Math.sin(a) * r * 0.8]);
    }
    // plane coordinates + per-star size (metres) and launch delay
    this.local = [
      ...pts.map(([x, y]) => [x * s, (y + lift) * s, (0.3 + Math.random() * 0.12) * s, 0.5 + Math.random() * 0.9]),
      ...heart.map(([x, y], i) => [x * s, y * s, (i % 10 === 0 ? 0.75 : 0.4) * s, (i / heart.length) * 1.6]),
      ...extra.map(([x, y]) => [x * s, y * s, (0.25 + Math.random() * 0.4) * s, 1.0 + Math.random() * 1.2]),
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

  /** A new (edited) name: rebuild the writing in place; stars already written stay there. */
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
    const n = viewer.clone().sub(center).setY(0).normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const end = this.points.geometry.attributes.aEnd;
    this.local.forEach(([x, y], i) => {
      const p = center.clone().addScaledVector(right, x).addScaledVector(up, y);
      end.setXYZ(i, p.x, p.y, p.z);
    });
    end.needsUpdate = true;
  }

  /** Launch every star from `from` (the quill's page) along a sweeping arc. */
  launch(from) {
    this._from = from.clone();
    const s = this.scale * 10;   // arc size follows the drawing's size
    const g = this.points.geometry;
    const st = g.attributes.aStart, c = g.attributes.aCtrl, e = g.attributes.aEnd;
    for (let i = 0; i < st.count; i++) {
      const a = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.1, Math.random() * 0.05, (Math.random() - 0.5) * 0.06));
      const b = new THREE.Vector3(e.getX(i), e.getY(i), e.getZ(i));
      const mid = a.clone().lerp(b, 0.4);
      mid.y = Math.max(a.y, b.y) + (0.5 + Math.random() * 0.5) * s * 0.12;
      mid.x += (Math.random() - 0.5) * s * 0.18; mid.z += (Math.random() - 0.5) * s * 0.18;
      st.setXYZ(i, a.x, a.y, a.z); c.setXYZ(i, mid.x, mid.y, mid.z);
    }
    st.needsUpdate = true; c.needsUpdate = true;
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
