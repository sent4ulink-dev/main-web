import * as THREE from 'three';

// The sky over the haunted hill: deep violet with a sick green glow at the horizon, stars, a giant full moon
// with craters and a halo, toon clouds drifting across it, and a lightning flash (uFlash) now and then.

export const MOON_DIR = new THREE.Vector3(-0.42, 0.43, -1).normalize();

const vert = /* glsl */ `
varying vec3 vDirRaw;
void main() { vDirRaw = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = /* glsl */ `
varying vec3 vDirRaw;
uniform float uTime, uFlash;
uniform vec3 uMoon;
float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 vDir = normalize(vDirRaw);
  float h = vDir.y;
  vec3 top = vec3(0.025, 0.015, 0.07), mid = vec3(0.12, 0.05, 0.2), low = vec3(0.16, 0.24, 0.2);
  vec3 col = mix(low, mid, smoothstep(-0.02, 0.22, h));
  col = mix(col, top, smoothstep(0.2, 0.75, h));
  // the moon: disc with craters, a rim, a big soft halo
  vec3 m = normalize(uMoon);
  float d = acos(clamp(dot(vDir, m), -1.0, 1.0));
  float R = 0.095;
  vec3 right = normalize(cross(m, vec3(0.0, 1.0, 0.0))), up = cross(right, m);
  vec2 q = vec2(dot(vDir - m, right), dot(vDir - m, up)) / R;
  float crater = vn(q * 3.0 + 4.0) * 0.6 + vn(q * 7.0) * 0.4;
  vec3 moonCol = mix(vec3(1.0, 0.96, 0.82), vec3(0.86, 0.82, 0.7), smoothstep(0.55, 0.75, crater));
  moonCol *= 1.0 - 0.18 * smoothstep(0.5, 1.0, length(q));
  col += vec3(0.9, 0.85, 0.65) * 0.28 * exp(-d * 5.0);
  col += vec3(0.6, 0.55, 0.9) * 0.12 * exp(-d * 1.6);
  col = mix(col, moonCol * 1.35, smoothstep(R, R * 0.97, d));
  // clouds drifting across (darker toon bands, silver-lined near the moon)
  vec2 cp = vDir.xz / max(0.12, h + 0.18) * 1.4 + vec2(uTime * 0.012, uTime * 0.004);
  float c = vn(cp * 1.2) * 0.6 + vn(cp * 2.9) * 0.3 + vn(cp * 6.0) * 0.1;
  float cloud = smoothstep(0.56, 0.64, c) * smoothstep(0.04, 0.16, h) * (1.0 - smoothstep(0.55, 0.9, h));
  vec3 cloudCol = mix(vec3(0.12, 0.08, 0.2), vec3(0.32, 0.26, 0.42), smoothstep(0.64, 0.7, c));
  cloudCol += vec3(0.7, 0.68, 0.55) * 0.5 * exp(-d * 6.0) * smoothstep(0.6, 0.7, c);
  col = mix(col, cloudCol, cloud * 0.9);
  // stars
  vec3 cell = floor(vDir * 240.0);
  float s = hash3(cell);
  float tw = 0.6 + 0.4 * sin(uTime * (1.0 + s * 3.0) + s * 40.0);
  vec3 sp = fract(vDir * 240.0) - 0.5;
  col += vec3(1.0, 0.95, 0.9) * step(0.996, s) * smoothstep(0.2, 0.05, length(sp)) * smoothstep(0.08, 0.35, h) * tw * (1.0 - cloud) * 1.8;
  // below the horizon: dark misty hills
  col = mix(col, vec3(0.08, 0.1, 0.11), smoothstep(0.0, -0.06, h));
  // lightning: the whole sky blanches for a moment
  col = mix(col, vec3(0.85, 0.88, 1.0), uFlash * 0.75 * smoothstep(-0.1, 0.4, h));
  gl_FragColor = vec4(col, 1.0);
}`;

/** Far hills and a dead forest silhouette on a band round the scene. */
function hillsTexture(seed, far) {
  const W = 2048, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.fillStyle = far ? '#1c1a2c' : '#121219';
  x.beginPath(); x.moveTo(0, H);
  for (let px = 0; px <= W; px += 16) x.lineTo(px, H * 0.62 - Math.sin(px * 0.004 + seed) * 22 - Math.sin(px * 0.013) * 9);
  x.lineTo(W, H); x.fill();
  for (let k = 0; k < (far ? 70 : 45); k++) {   // bare trees
    const tx = r() * W, base = H * 0.64 - Math.sin(tx * 0.004 + seed) * 22, th = (far ? 30 : 55) + r() * 40;
    x.strokeStyle = x.fillStyle; x.lineWidth = far ? 2 : 3.5;
    x.beginPath(); x.moveTo(tx, base); x.lineTo(tx + (r() - 0.5) * 6, base - th); x.stroke();
    for (let b = 0; b < 4; b++) {
      const by = base - th * (0.4 + b * 0.15), dir = b % 2 ? 1 : -1;
      x.lineWidth = far ? 1.2 : 2;
      x.beginPath(); x.moveTo(tx, by); x.lineTo(tx + dir * (8 + r() * 16), by - 8 - r() * 12); x.stroke();
    }
  }
  if (!far) {   // a little church with a lit window, far away
    const cx = W * 0.72, base = H * 0.6;
    x.fillRect(cx - 18, base - 30, 36, 30); x.beginPath(); x.moveTo(cx - 22, base - 30); x.lineTo(cx, base - 48); x.lineTo(cx + 22, base - 30); x.fill();
    x.fillRect(cx - 4, base - 70, 8, 26);
    x.fillStyle = '#ffcf6a'; x.fillRect(cx - 3, base - 22, 6, 9);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function createNightSky(scene) {
  const group = new THREE.Group(); group.name = 'nightsky';
  const uniforms = { uTime: { value: 0 }, uFlash: { value: 0 }, uMoon: { value: MOON_DIR.clone() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -10;
  group.add(sky);
  const bands = [];
  for (const [radius, h, y0, seed, far, reps] of [[150, 30, -4, 7, true, 4], [80, 18, -3, 3, false, 3]]) {
    const tex = hillsTexture(seed, far); tex.repeat.set(reps, 1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, 96, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false }));
    m.position.y = y0 + h / 2; m.renderOrder = -9;
    group.add(m); bands.push(m);
  }
  scene.add(group);
  return { group, uniforms, update: (t) => { uniforms.uTime.value = t; } };
}
