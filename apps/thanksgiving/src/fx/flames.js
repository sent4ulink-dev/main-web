import * as THREE from 'three';

// Every candle in the salon (chandelier, candelabras, sconces, the desk) burns in ONE instanced draw:
// camera-facing teardrop flames with their own flicker. The hearth fire uses the same flames, bigger.
// Golden motes drift through the warm air (one more draw).

const flameVert = /* glsl */ `
attribute float aSeed;
varying vec2 vUv; varying float vSeed;
uniform float uTime;
void main() {
  vUv = uv; vSeed = aSeed;
  vec3 p = position;
  float sway = (sin(uTime * 9.0 + aSeed * 7.0) * 0.5 + sin(uTime * 15.3 + aSeed * 3.0) * 0.3) * 0.08;
  p.x += sway * uv.y * uv.y;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(instanceMatrix[0].xyz);
  mv.xy += p.xy * s;
  gl_Position = projectionMatrix * mv;
}`;
const flameFrag = /* glsl */ `
varying vec2 vUv; varying float vSeed;
uniform float uTime; uniform float uLife;
void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float flick = 0.9 + 0.1 * sin(uTime * 23.0 + vSeed * 11.0) + 0.05 * sin(uTime * 37.0 + vSeed);
  uv.y = uv.y + 0.35;
  float w = mix(0.62, 0.05, clamp((uv.y + 0.6) / 1.9, 0.0, 1.0)) * flick;
  float d = length(vec2(uv.x / max(w, 0.02), (uv.y + 0.15) * 0.62));
  float body = smoothstep(1.0, 0.25, d);
  float core = smoothstep(0.55, 0.0, length(vec2(uv.x / 0.28, (uv.y + 0.55) * 1.4)));
  float blue = smoothstep(0.5, 0.0, length(vec2(uv.x / 0.3, (uv.y + 0.95) * 2.2)));
  vec3 col = mix(vec3(1.0, 0.38, 0.06), vec3(1.0, 0.74, 0.36), body) * body * 1.9;
  col += vec3(1.0, 0.9, 0.7) * core * 2.2;
  col = mix(col, vec3(0.25, 0.45, 1.0) * 1.5, blue * 0.5);
  float a = clamp(body + core * 0.5, 0.0, 1.0) * uLife;
  gl_FragColor = vec4(col * a, a);
}`;

export class Flames {
  /** points: world positions of wick tips; sizes: optional per-flame scale (1 = a candle). */
  constructor(scene, points, sizes = []) {
    const geo = new THREE.PlaneGeometry(0.013, 0.028);
    geo.translate(0, 0.012, 0);
    const seeds = new Float32Array(points.length).map(() => Math.random() * 10);
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.uniforms = { uTime: { value: 0 }, uLife: { value: 1 } };
    this.mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      vertexShader: flameVert, fragmentShader: flameFrag, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }), points.length);
    const m = new THREE.Matrix4();
    points.forEach((p, i) => { const s = sizes[i] || 1; m.makeScale(s, s, s).setPosition(p); this.mesh.setMatrixAt(i, m); });
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }
  update(t) { this.uniforms.uTime.value = t; }
}

const dustVert = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime, uPx;
uniform vec3 uMin, uSize;
varying float vA;
void main() {
  vec3 p = uMin + mod(aSeed.xyz * uSize + vec3(sin(uTime * 0.11 + aSeed.w * 6.0) * 0.6, uTime * (0.03 + aSeed.w * 0.04), cos(uTime * 0.09 + aSeed.w * 4.0) * 0.6), uSize);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vA = (0.45 + 0.55 * sin(uTime * (0.8 + aSeed.w) + aSeed.w * 30.0)) * smoothstep(0.0, 0.6, p.y - uMin.y) * smoothstep(0.0, 0.8, uMin.y + uSize.y - p.y);
  gl_PointSize = clamp((0.012 + aSeed.w * 0.014) * uPx / -mv.z, 1.0, 9.0);
  gl_Position = projectionMatrix * mv;
}`;
const dustFrag = /* glsl */ `
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(c)) * vA;
  float cross = max(smoothstep(0.06, 0.0, abs(c.x)) * smoothstep(0.5, 0.1, abs(c.y)), smoothstep(0.06, 0.0, abs(c.y)) * smoothstep(0.5, 0.1, abs(c.x)));
  gl_FragColor = vec4(vec3(1.0, 0.82, 0.48) * 1.6 * (a + cross * vA * 0.5), a + cross * vA * 0.4);
}`;

/** Golden motes drifting through a box (the lit middle of the room). */
export class GoldDust {
  constructor(scene, min, size, count = 260) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(count * 4).map(() => Math.random()), 4));
    this.uniforms = { uTime: { value: 0 }, uPx: { value: 800 }, uMin: { value: min.clone() }, uSize: { value: size.clone() } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: dustVert, fragmentShader: dustFrag, uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
  }
  update(t, renderer, camera) {
    this.uniforms.uTime.value = t;
    this.uniforms.uPx.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
}
