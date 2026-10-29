import * as THREE from 'three';

// The view through the salon's windows: a violet twilight over 18th-century Vienna. A painted sky dome
// (gradient, stars, a crescent moon) and two layers of skyline: St. Stephen's spire and its patterned
// roof, the Karlskirche dome between its two columns, baroque towers, rooftops and lit windows.

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const skyFrag = /* glsl */ `
varying vec3 vDir;
uniform float uTime;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  float h = vDir.y;
  vec3 top = vec3(0.07, 0.07, 0.22), mid = vec3(0.30, 0.17, 0.42), low = vec3(0.86, 0.48, 0.46), glow = vec3(1.0, 0.72, 0.5);
  vec3 col = mix(low, mid, smoothstep(-0.02, 0.18, h));
  col = mix(col, top, smoothstep(0.16, 0.6, h));
  col += glow * 0.35 * smoothstep(0.12, 0.0, h) * step(0.0, h);
  // below the rooftops: the city at night, dark with a warm haze (never a bright band)
  col = mix(col, vec3(0.1, 0.06, 0.16) + vec3(0.12, 0.05, 0.03) * smoothstep(-0.35, -0.02, h), smoothstep(0.0, -0.04, h));
  // stars
  vec3 cell = floor(vDir * 260.0);
  float s = hash(cell);
  float tw = 0.6 + 0.4 * sin(uTime * (1.0 + s * 3.0) + s * 40.0);
  col += vec3(1.0, 0.95, 0.85) * step(0.9965, s) * smoothstep(0.08, 0.3, h) * tw * 1.4;
  // crescent moon, low over the city
  vec3 m = normalize(vec3(0.35, 0.22, -1.0));
  float d = acos(clamp(dot(vDir, m), -1.0, 1.0));
  vec3 m2 = normalize(m + vec3(0.012, 0.006, 0.0));
  float d2 = acos(clamp(dot(vDir, m2), -1.0, 1.0));
  float moon = smoothstep(0.035, 0.032, d) * smoothstep(0.03, 0.034, d2);
  col = mix(col, vec3(1.0, 0.95, 0.8) * 1.6, moon);
  col += vec3(1.0, 0.85, 0.7) * 0.25 * smoothstep(0.2, 0.0, d);
  gl_FragColor = vec4(col, 1.0);
}`;

function skyline(w, h, { near = true, seed = 3 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const base = h * (near ? 0.62 : 0.55);
  const body = near ? '#2a2148' : '#4b3b72';
  const lit = near ? '#ffd27a' : '#e8b884';
  x.fillStyle = body;
  // rooftops
  let px = 0;
  const roofs = [];
  while (px < w) {
    const bw = (near ? 60 : 40) + r() * (near ? 120 : 70), bh = (near ? 40 : 20) + r() * (near ? 90 : 50);
    const top = base - bh;
    x.fillRect(px, top, bw + 1, h - top);
    x.beginPath(); x.moveTo(px - 4, top); x.lineTo(px + bw / 2, top - bw * 0.32); x.lineTo(px + bw + 4, top); x.fill();
    if (r() < 0.6) x.fillRect(px + bw * (0.2 + r() * 0.6), top - bw * 0.3, 8, 22);   // chimney
    roofs.push([px, top, bw]);
    px += bw - 4;
  }
  const dome = (cx, cy, rw, rh, drum = 0) => {
    if (drum) x.fillRect(cx - rw * 0.9, cy, rw * 1.8, drum);
    x.beginPath(); x.ellipse(cx, cy, rw, rh, 0, Math.PI, 0); x.fill();
    x.fillRect(cx - rw * 0.12, cy - rh - rh * 0.5, rw * 0.24, rh * 0.5);           // lantern
    x.beginPath(); x.moveTo(cx - rw * 0.1, cy - rh * 1.5); x.lineTo(cx, cy - rh * 1.95); x.lineTo(cx + rw * 0.1, cy - rh * 1.5); x.fill();
  };
  const tower = (cx, bw, bh, onion = true) => {
    x.fillRect(cx - bw / 2, base - bh, bw, bh);
    if (onion) {
      x.beginPath(); x.ellipse(cx, base - bh - bw * 0.35, bw * 0.55, bw * 0.45, 0, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.moveTo(cx - bw * 0.15, base - bh - bw * 0.7); x.lineTo(cx, base - bh - bw * 1.6); x.lineTo(cx + bw * 0.15, base - bh - bw * 0.7); x.fill();
    } else { x.beginPath(); x.moveTo(cx - bw / 2, base - bh); x.lineTo(cx, base - bh - bw * 2.2); x.lineTo(cx + bw / 2, base - bh); x.fill(); }
  };
  if (near) {
    // St. Stephen's: the great steep roof with its zigzag tiles, and the south tower's spire
    const sx = w * 0.34;
    x.beginPath(); x.moveTo(sx - 170, base - 70); x.lineTo(sx - 120, base - 210); x.lineTo(sx + 160, base - 210); x.lineTo(sx + 210, base - 70); x.fill();
    x.save(); x.beginPath(); x.moveTo(sx - 170, base - 70); x.lineTo(sx - 120, base - 210); x.lineTo(sx + 160, base - 210); x.lineTo(sx + 210, base - 70); x.clip();
    x.strokeStyle = 'rgba(170,110,90,0.32)'; x.lineWidth = 4;
    for (let row = 0; row < 6; row++) { x.beginPath(); for (let k = 0; k <= 26; k++) x.lineTo(sx - 180 + k * 16, base - 90 - row * 22 - (k % 2) * 12); x.stroke(); }
    x.restore();
    x.fillStyle = body;
    x.fillRect(sx - 120, base - 70, 330, 70);
    const tx = sx - 150;
    x.fillRect(tx - 34, base - 300, 68, 300);
    x.beginPath(); x.moveTo(tx - 34, base - 300); x.lineTo(tx - 22, base - 420); x.lineTo(tx - 10, base - 470); x.lineTo(tx, base - 560); x.lineTo(tx + 10, base - 470); x.lineTo(tx + 22, base - 420); x.lineTo(tx + 34, base - 300); x.fill();
    for (let k = 0; k < 6; k++) { x.fillRect(tx - 40 + k * 2, base - 300 - k * 30, 80 - k * 4, 6); }
    // Karlskirche: dome on a drum, portico and the two triumphal columns
    const kx = w * 0.72;
    x.fillRect(kx - 150, base - 90, 300, 90);
    dome(kx, base - 150, 80, 90, 60);
    for (const sxx of [-1, 1]) {
      x.fillRect(kx + sxx * 125 - 12, base - 230, 24, 140);
      x.beginPath(); x.ellipse(kx + sxx * 125, base - 232, 16, 8, 0, 0, Math.PI * 2); x.fill();
      x.fillRect(kx + sxx * 125 - 5, base - 262, 10, 30);
    }
    x.beginPath(); x.moveTo(kx - 70, base - 90); x.lineTo(kx, base - 130); x.lineTo(kx + 70, base - 90); x.fill();
    tower(w * 0.12, 30, 170); tower(w * 0.52, 26, 150); tower(w * 0.9, 28, 160, false); tower(w * 0.6, 22, 120);
    dome(w * 0.2, base - 110, 45, 45, 30);
  } else {
    tower(w * 0.08, 18, 90); tower(w * 0.45, 16, 80, false); dome(w * 0.62, base - 60, 40, 40, 20); tower(w * 0.85, 18, 95);
  }
  // lit windows
  x.fillStyle = lit;
  for (const [rx, top, bw] of roofs) {
    for (let k = 0; k < (near ? 9 : 5); k++) {
      if (r() < 0.45) continue;
      const wx = rx + 8 + r() * (bw - 16), wy = top + 10 + r() * (base - top + 40);
      x.globalAlpha = 0.6 + r() * 0.4;
      x.fillRect(wx, wy, near ? 6 : 3, near ? 9 : 4);
    }
  }
  x.globalAlpha = 1;
  // warm city glow at the bottom
  const g = x.createLinearGradient(0, base - 40, 0, h);
  g.addColorStop(0, 'rgba(255,170,90,0)'); g.addColorStop(1, near ? 'rgba(255,170,90,0.35)' : 'rgba(255,170,110,0.25)');
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function createVienna(scene) {
  const group = new THREE.Group();
  group.name = 'vienna';
  const uniforms = { uTime: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), new THREE.ShaderMaterial({ vertexShader: skyVert, fragmentShader: skyFrag, uniforms, side: THREE.BackSide, depthWrite: false }));
  sky.renderOrder = -10;
  group.add(sky);
  const layer = (z, w, h, y0, opts) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: skyline(2048, 512, opts), transparent: true, depthWrite: false, fog: false }));
    m.position.set(0, y0 + h / 2, z);
    m.renderOrder = -9;
    group.add(m);
    return m;
  };
  layer(-150, 330, 82, -46, { near: false, seed: 11 });
  layer(-88, 200, 50, -27, { near: true, seed: 5 });
  scene.add(group);
  return { group, update: (t) => { uniforms.uTime.value = t; } };
}
