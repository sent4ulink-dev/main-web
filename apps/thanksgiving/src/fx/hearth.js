import * as THREE from 'three';

// The fire in the hearth, drawn like a storybook fire: three layered sheets of flame (deep red at the
// edges, orange, a yellow heart) licking upward in tongues that never repeat, glowing embers along the logs
// and sparks floating up the chimney.

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = /* glsl */ `
uniform float uTime; uniform float uSeed; uniform float uTall;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec2 uv = vUv;
  float x = (uv.x - 0.5) * 2.0;
  float n = fbm(vec2(uv.x * 3.2 + uSeed, uv.y * 2.4 - uTime * 1.9));
  float n2 = fbm(vec2(uv.x * 7.0 - uSeed * 2.0, uv.y * 4.5 - uTime * 3.1));
  // wide at the base, licking up into tongues
  float body = 1.0 - abs(x) * (0.85 + uv.y * 1.5) - uv.y * (1.05 - uTall * 0.3) + (n - 0.5) * 1.0 + (n2 - 0.5) * 0.38;
  body *= smoothstep(0.0, 0.1, uv.y);
  float e = fwidth(body) * 1.5 + 0.01;
  float a1 = smoothstep(0.02, 0.02 + e, body);
  float a2 = smoothstep(0.24, 0.24 + e, body);
  float a3 = smoothstep(0.5, 0.5 + e, body);
  vec3 col = mix(vec3(0.82, 0.2, 0.05), vec3(1.0, 0.52, 0.1), a2);
  col = mix(col, vec3(1.0, 0.88, 0.46), a3);
  gl_FragColor = vec4(col * 1.5, a1);
}`;

const sparkVert = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime; uniform float uPx;
varying float vA;
void main() {
  float life = fract(uTime * (0.35 + aSeed.z * 0.3) + aSeed.x);
  vec3 p = position + vec3(sin(life * 6.0 + aSeed.y * 9.0) * 0.06, life * 0.95, cos(life * 5.0 + aSeed.x * 7.0) * 0.04);
  vA = (1.0 - life) * smoothstep(0.0, 0.1, life);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(0.03 * uPx / -mv.z, 1.0, 6.0);
  gl_Position = projectionMatrix * mv;
}`;
const sparkFrag = /* glsl */ `
varying float vA;
void main() { float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vA; gl_FragColor = vec4(vec3(1.0, 0.62, 0.2) * 2.0 * a, a); }`;

export class Hearth {
  /** spot: the middle of the grate (world); facing: the way the fireplace looks into the room. */
  constructor(scene, spot, facing) {
    this.group = new THREE.Group();
    this.group.position.copy(spot);
    this.group.rotation.y = Math.atan2(facing.x, facing.z);
    this.mats = [];
    // three sheets, back to front: tall and dark, then brighter and smaller
    [[0.78, 0.62, -0.06, 1.0, 0.1], [0.66, 0.5, -0.02, 0.6, 3.7], [0.5, 0.36, 0.02, 0.3, 7.3]].forEach(([w, h, z, tall, seed]) => {
      const m = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uTall: { value: tall } }, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), m);
      sheet.position.set(0, 0.02, z); sheet.renderOrder = 6;
      this.group.add(sheet); this.mats.push(m);
    });
    // embers on the logs
    const ember = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.09), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.45, 0.1), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false }));
    ember.position.set(0, 0.03, 0.05); ember.renderOrder = 7; this.ember = ember;
    this.group.add(ember);
    // sparks
    const n = 26, pos = new Float32Array(n * 3), seed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 0.4; pos[i * 3 + 1] = 0.1; pos[i * 3 + 2] = (Math.random() - 0.5) * 0.1; seed.set([Math.random(), Math.random(), Math.random()], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    this.sparkU = { uTime: { value: 0 }, uPx: { value: innerHeight } };
    this.sparks = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: sparkVert, fragmentShader: sparkFrag, uniforms: this.sparkU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sparks.frustumCulled = false; this.sparks.renderOrder = 8;
    this.group.add(this.sparks);
    scene.add(this.group);
  }
  update(t) {
    for (const m of this.mats) m.uniforms.uTime.value = t;
    this.sparkU.uTime.value = t; this.sparkU.uPx.value = innerHeight;
    this.ember.material.opacity = 0.75 + 0.2 * Math.sin(t * 5.3) * Math.sin(t * 2.1);
  }
  dispose(scene) { scene.remove(this.group); }
}
