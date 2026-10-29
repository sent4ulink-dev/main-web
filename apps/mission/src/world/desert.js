import * as THREE from 'three';
import { rng } from './courtyardTextures.js';

// The world outside the courtyard walls: a painted golden-hour sky that can fall into a violet dusk for the
// salute (uDusk 0 → 1), soft toon clouds, and a hazy ring of a desert town (flat roofs, domes, water tower,
// palms) on the horizon. All original, painted in code.

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const skyFrag = /* glsl */ `
varying vec3 vDir;
uniform float uTime, uDusk;
uniform vec3 uSun;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float h = vDir.y;
  // golden hour
  vec3 dTop = vec3(0.36, 0.56, 0.86), dMid = vec3(0.96, 0.78, 0.56), dLow = vec3(1.0, 0.66, 0.38);
  // dusk
  vec3 nTop = vec3(0.08, 0.07, 0.22), nMid = vec3(0.36, 0.18, 0.42), nLow = vec3(0.95, 0.45, 0.32);
  vec3 top = mix(dTop, nTop, uDusk), mid = mix(dMid, nMid, uDusk), low = mix(dLow, nLow, uDusk);
  vec3 col = mix(low, mid, smoothstep(-0.02, 0.2, h));
  col = mix(col, top, smoothstep(0.18, 0.75, h));
  // the sun and its glow
  float d = acos(clamp(dot(vDir, normalize(uSun)), -1.0, 1.0));
  vec3 sunCol = mix(vec3(1.0, 0.86, 0.6), vec3(1.0, 0.5, 0.3), uDusk);
  col += sunCol * 0.55 * exp(-d * 3.2) * (1.0 - uDusk * 0.6);
  col = mix(col, vec3(1.0, 0.95, 0.82) * 1.5, smoothstep(0.052, 0.045, d) * (1.0 - uDusk));
  // toon clouds: soft bands, lit from the sun side
  vec2 cp = vDir.xz / max(0.12, h + 0.15) * 1.6 + vec2(uTime * 0.004, 0.0);
  float c = vn(cp * 1.3) * 0.6 + vn(cp * 3.1) * 0.3 + vn(cp * 7.0) * 0.1;
  float cloud = smoothstep(0.58, 0.66, c) * smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.45, 0.8, h));
  vec3 cloudCol = mix(vec3(1.0, 0.88, 0.74), vec3(0.62, 0.36, 0.5), uDusk);
  cloudCol = mix(cloudCol * 0.86, cloudCol * 1.08, smoothstep(0.62, 0.7, c));
  col = mix(col, cloudCol, cloud * 0.85);
  // stars at dusk
  vec3 cell = floor(vDir * 260.0);
  float s = hash(cell);
  float tw = 0.6 + 0.4 * sin(uTime * (1.0 + s * 3.0) + s * 40.0);
  col += vec3(1.0, 0.95, 0.85) * step(0.9968, s) * smoothstep(0.1, 0.35, h) * tw * 1.4 * smoothstep(0.5, 1.0, uDusk);
  // below the horizon: the haze of the desert (never a bright band)
  col = mix(col, mix(vec3(0.86, 0.66, 0.46), vec3(0.2, 0.12, 0.2), uDusk), smoothstep(0.0, -0.05, h));
  gl_FragColor = vec4(col, 1.0);
}`;

/** The town on the horizon, painted onto a band (2048 × 256 per tile, wrapped round the courtyard). */
function townTexture(seed, { far = false } = {}) {
  const W = 2048, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), r = rng(seed);
  const base = H * 0.86;
  const body = far ? '#d9a77a' : '#c98f60';
  const shade = far ? '#c99467' : '#b47a4c';
  let px = 0;
  while (px < W) {
    const bw = (far ? 30 : 50) + r() * (far ? 60 : 90);
    const bh = (far ? 18 : 30) + r() * (far ? 40 : 70);
    const top = base - bh;
    x.fillStyle = r() < 0.5 ? body : shade;
    x.fillRect(px, top, bw + 1, H - top);
    // parapet notches and little windows
    x.fillStyle = shade;
    if (r() < 0.5) for (let k = 0; k < bw; k += 12) x.fillRect(px + k, top - 5, 6, 5);
    x.fillStyle = far ? 'rgba(120,70,40,0.35)' : 'rgba(90,50,30,0.5)';
    for (let k = 0; k < 4; k++) if (r() < 0.6) x.fillRect(px + 6 + r() * (bw - 14), top + 8 + r() * (bh - 16), far ? 3 : 5, far ? 5 : 9);
    // a dome now and then
    if (r() < 0.22) {
      x.fillStyle = r() < 0.4 ? '#e6c48a' : body;
      x.beginPath(); x.ellipse(px + bw / 2, top, bw * 0.38, bw * 0.4, 0, Math.PI, 0); x.fill();
      x.fillRect(px + bw / 2 - 1.5, top - bw * 0.55, 3, bw * 0.16);
    }
    // a tall slim tower now and then
    if (r() < 0.08) {
      const tw = far ? 8 : 12, th = (far ? 70 : 110) + r() * 40;
      x.fillStyle = body;
      x.fillRect(px + bw / 2 - tw / 2, base - th, tw, th);
      x.fillRect(px + bw / 2 - tw * 0.8, base - th + 10, tw * 1.6, 6);
      x.beginPath(); x.moveTo(px + bw / 2 - tw * 0.6, base - th); x.lineTo(px + bw / 2, base - th - tw * 2.2); x.lineTo(px + bw / 2 + tw * 0.6, base - th); x.fill();
    }
    // a palm against the sky
    if (r() < 0.18) {
      const cx = px + r() * bw, ph = (far ? 40 : 70) + r() * 30;
      x.strokeStyle = far ? '#8d7a52' : '#6c5a35'; x.lineWidth = far ? 2 : 3;
      x.beginPath(); x.moveTo(cx, base); x.quadraticCurveTo(cx + 6, base - ph / 2, cx + 3, base - ph); x.stroke();
      x.fillStyle = far ? '#7f8f55' : '#5f7a3c';
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k - 3) * 0.5;
        x.save(); x.translate(cx + 3, base - ph); x.rotate(a + Math.PI / 2);
        x.beginPath(); x.ellipse(0, -14, 3.5, 16, 0.25, 0, Math.PI * 2); x.fill(); x.restore();
      }
    }
    px += bw - 2;
  }
  // haze: the band fades into the sky at the top and into dust at the bottom
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,214,170,0)'); g.addColorStop(1, far ? 'rgba(255,214,170,0.55)' : 'rgba(255,206,160,0.3)');
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

export const SUN_DIR = new THREE.Vector3(-0.62, 0.16, -0.77).normalize();

export function createDesert(scene) {
  const group = new THREE.Group();
  group.name = 'desert';
  const uniforms = { uTime: { value: 0 }, uDusk: { value: 0 }, uSun: { value: SUN_DIR.clone() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), new THREE.ShaderMaterial({ vertexShader: skyVert, fragmentShader: skyFrag, uniforms, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -10;
  group.add(sky);
  // two bands of town (open cylinders), tinted towards the dusk with the sky
  const bands = [];
  const band = (radius, h, y0, seed, far, reps) => {
    const tex = townTexture(seed, { far }); tex.repeat.set(reps, 1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, 96, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false }));
    m.position.y = y0 + h / 2;
    m.renderOrder = -9;
    group.add(m); bands.push(m);
  };
  band(150, 36, -3, 11, true, 5);
  band(85, 22, -2, 5, false, 4);
  // the desert floor out to the horizon
  const floor = new THREE.Mesh(new THREE.CircleGeometry(160, 48), new THREE.MeshBasicMaterial({ color: 0xd8b07a, fog: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.05;
  group.add(floor);
  scene.add(group);
  const dayTint = new THREE.Color(1, 1, 1), duskTint = new THREE.Color(0.42, 0.3, 0.46);
  const setDusk = (v) => {
    uniforms.uDusk.value = v;
    for (const b of bands) b.material.color.copy(dayTint).lerp(duskTint, v);
    floor.material.color.set(0xd8b07a).lerp(new THREE.Color(0x3a2a3a), v);
  };
  return { group, update: (t) => { uniforms.uTime.value = t; }, setDusk, uniforms };
}
