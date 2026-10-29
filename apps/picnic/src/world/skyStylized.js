import * as THREE from 'three';
import { assets, findNode } from '../core/assets.js';

// A painted twilight sky — no HDRI. Gradient dome + sunset glow + stars + Blender clouds,
// and the lights that make the storybook look (hemisphere, soft key, warm string-light glow).

const C = (hex) => new THREE.Color(hex);
const PALETTE = {
  dusk: { zenith: C('#1f2d68'), upper: C('#33468f'), horizon: C('#7a6fb0'), glow: C('#f4a68c'), glow2: C('#e07ea6'), fog: C('#5a5a96') },
  night: { zenith: C('#0c1434'), upper: C('#18245a'), horizon: C('#3b3f7c'), glow: C('#9a5f8f'), glow2: C('#6a4a8a'), fog: C('#2b2f5c') },
};

const domeVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w;
}`;

const domeFrag = /* glsl */ `
uniform vec3 uZenith, uUpper, uHorizon, uGlow, uGlow2;
uniform vec3 uGlowDir;
uniform float uGlowAmt, uStars, uTime;
varying vec3 vDir;
float h1(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 h3(vec3 p) { return vec3(h1(p), h1(p + 17.31), h1(p + 41.7)); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float az = dot(normalize(d.xz + 1e-5), normalize(uGlowDir.xz));
  vec3 col = mix(uHorizon, uUpper, smoothstep(0.0, 0.28, h));
  col = mix(col, uZenith, smoothstep(0.28, 0.95, h));
  // sunset glow: strongest at the horizon toward the glow direction
  float g = pow(max(az, 0.0), 2.2) * exp(-max(h, 0.0) * 5.5);
  col = mix(col, uGlow, clamp(g * uGlowAmt, 0.0, 1.0));
  col = mix(col, uGlow2, clamp(pow(max(az * 0.5 + 0.5, 0.0), 2.0) * exp(-max(h - 0.06, 0.0) * 9.0) * 0.45 * uGlowAmt, 0.0, 1.0) * smoothstep(-0.02, 0.1, h));
  // below the horizon: deep haze
  col = mix(col, uHorizon * 0.6, smoothstep(0.0, -0.15, h));
  // stars: one jittered point per cell
  if (h > 0.04 && uStars > 0.0) {
    for (int k = 0; k < 2; k++) {
      float sc = k == 0 ? 120.0 : 260.0;
      vec3 cell = floor(d * sc);
      vec3 rnd = h3(cell + float(k) * 3.7);
      if (rnd.x > (k == 0 ? 0.965 : 0.94)) {
        vec3 c = (cell + 0.25 + rnd * 0.5) / sc;
        float dist = length(d - normalize(c)) * sc;
        float size = k == 0 ? 0.16 : 0.1;
        float tw = 0.65 + 0.35 * sin(uTime * (1.2 + rnd.y * 3.0) + rnd.z * 40.0);
        float s = smoothstep(size, 0.0, dist) * tw * smoothstep(0.04, 0.3, h);
        col += vec3(0.95, 0.95, 1.0) * s * uStars * (k == 0 ? 1.5 : 0.8) * smoothstep(0.1, 0.45, h);
      }
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const cloudVert = /* glsl */ `
varying vec3 vN; varying vec3 vW; varying float vH; varying vec3 vV;
uniform float uMinY, uMaxY;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vH = clamp((position.y - uMinY) / (uMaxY - uMinY), 0.0, 1.0);
  vec4 mv = viewMatrix * w;
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const cloudFrag = /* glsl */ `
uniform vec3 uTop, uBottom, uLit, uGlowDir;
uniform float uGlowAmt;
varying vec3 vN; varying vec3 vW; varying float vH; varying vec3 vV;
void main() {
  vec3 n = normalize(vN);
  float toGlow = max(dot(normalize(vW.xz), normalize(uGlowDir.xz)), 0.0);
  float lit = max(dot(n, normalize(vec3(uGlowDir.x, -0.15, uGlowDir.z))), 0.0);
  vec3 col = mix(uBottom, uTop, smoothstep(0.0, 0.9, vH));
  col = mix(col, uLit, clamp(lit * (0.45 + 0.75 * toGlow) * uGlowAmt * (1.0 - vH * 0.45), 0.0, 0.9));
  col += vec3(0.08, 0.06, 0.12) * pow(max(1.0 - abs(dot(n, normalize(cameraPosition - vW))), 0.0), 2.0);
  gl_FragColor = vec4(col, 1.0);
}`;

export class StylizedSky {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.time = 0;
    this.glowDir = new THREE.Vector3(-0.78, 0, 0.62).normalize();
    const P = PALETTE.dusk;
    this.uniforms = {
      uZenith: { value: P.zenith.clone() }, uUpper: { value: P.upper.clone() }, uHorizon: { value: P.horizon.clone() },
      uGlow: { value: P.glow.clone() }, uGlow2: { value: P.glow2.clone() }, uGlowDir: { value: this.glowDir },
      uGlowAmt: { value: 1 }, uStars: { value: 0.6 }, uTime: { value: 0 },
    };
    const domeMat = new THREE.ShaderMaterial({ vertexShader: domeVert, fragmentShader: domeFrag, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), domeMat);
    this.dome.scale.setScalar(1500);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    this._buildClouds();

    // ── lights ──
    this.hemi = new THREE.HemisphereLight(C('#9aa6ff'), C('#3d5a2a'), 1.3);
    scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(C('#ffd6e0'), 1.2);
    this.key.position.set(5, 7, 2.5);
    this.key.target.position.set(0, 0.5, 0);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    const sc = this.key.shadow.camera;
    sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 30;
    this.key.shadow.bias = -0.0005;
    this.key.shadow.normalBias = 0.03;
    this.key.shadow.radius = 4;
    scene.add(this.key, this.key.target);
    this.sun = this.key; // compatibility with the quality manager
    this.sunDir = this.key.position.clone().normalize();

    // warm glow of the string lights over the table
    this.warmA = new THREE.PointLight(C('#ffb768'), 2.6, 8, 1.5);
    this.warmA.position.set(-0.2, 2.15, 0.9);
    this.warmB = new THREE.PointLight(C('#ffb768'), 2.6, 8, 1.5);
    this.warmB.position.set(-0.2, 2.15, -0.9);
    scene.add(this.warmA, this.warmB);

    scene.fog = new THREE.FogExp2(P.fog.clone(), 0.0085);
    scene.background = null;

    // a soft environment for the glass, bottle and balloons, made from this painted sky
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), domeMat));
    this.setTime(0, true);
  }

  _buildClouds() {
    const nature = assets.models.nature;
    this.cloudMat = new THREE.ShaderMaterial({
      vertexShader: cloudVert, fragmentShader: cloudFrag, fog: false,
      uniforms: {
        uTop: { value: C('#8d86c8') }, uBottom: { value: C('#5d5a9e') }, uLit: { value: C('#ff9ec4') },
        uGlowDir: { value: this.glowDir }, uGlowAmt: { value: 1 }, uMinY: { value: -0.2 }, uMaxY: { value: 3 },
      },
    });
    this.clouds = new THREE.Group();
    this.clouds.name = 'clouds';
    const names = ['cloud_a', 'cloud_b', 'cloud_c', 'cloud_d'];
    nature.updateMatrixWorld(true);
    // bake each cloud's node transform (incl. glTF dequantisation) into a centred, unit-scale geometry
    const geos = names.map((n) => findNode(nature, n)).filter(Boolean).map((node) => {
      let mesh = null; node.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
      // positions are quantised int16 (normalised to ±1): copy them to floats first, or the
      // transform below would clamp every vertex back into a unit box
      const src = mesh.geometry.attributes.position;
      const pos = new Float32Array(src.count * 3);
      for (let i = 0; i < src.count; i++) { pos[i * 3] = src.getX(i); pos[i * 3 + 1] = src.getY(i); pos[i * 3 + 2] = src.getZ(i); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      if (mesh.geometry.index) g.setIndex(Array.from(mesh.geometry.index.array));
      g.applyMatrix4(mesh.matrixWorld);
      g.computeBoundingBox();
      const b = g.boundingBox;
      g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      // normalise to a unit box so each spot's scale is its size in metres
      g.userData.aspect = (b.max.y - b.min.y) / (b.max.x - b.min.x);
      g.scale(1 / (b.max.x - b.min.x), 1 / (b.max.y - b.min.y), 1 / (b.max.z - b.min.z));
      g.computeVertexNormals();
      return g;
    });
    if (!geos.length) return;
    // [azimuth offset from the glow (rad), elevation of the cloud base (deg), distance, width (m)]
    // the main view looks along -X: positive offsets move a cloud from the glow toward the centre of frame
    const spots = [
      [0.1, 6.5, 430, 150], [0.3, 10.5, 470, 125], [0.5, 5, 450, 115], [0.2, 15, 520, 95], [0.68, 8.5, 480, 105],
      [-0.15, 9, 450, 135], [-0.45, 12, 500, 120],
      [0.95, 17, 520, 110], [1.2, 11, 480, 100], [1.5, 21, 560, 125],
      [2.3, 13, 520, 120], [-1.3, 15, 500, 110], [-2.2, 10, 520, 120], [2.9, 19, 560, 130],
    ];
    const baseAz = Math.atan2(this.glowDir.z, this.glowDir.x);
    spots.forEach(([da, el, dist, s], i) => {
      const m = new THREE.Mesh(geos[i % geos.length], this.cloudMat);
      const az = baseAz + da;
      const e = THREE.MathUtils.degToRad(el);
      m.position.set(Math.cos(az) * Math.cos(e) * dist, Math.sin(e) * dist, Math.sin(az) * Math.cos(e) * dist);
      const g = geos[i % geos.length];
      m.scale.set(s, s * g.userData.aspect * (1.1 + 0.15 * ((i * 7) % 3)), s * 0.35);
      m.renderOrder = -9;
      m.frustumCulled = false;
      this.clouds.add(m);
    });
    // glTF export converts Blender Z-up to Y-up, so clouds are upright: turn their long side to face the picnic
    this.clouds.children.forEach((m) => { m.rotation.set(0, Math.atan2(m.position.x, m.position.z), 0); });
    this.cloudMat.uniforms.uMinY.value = 0;
    this.cloudMat.uniforms.uMaxY.value = 1;
    this.scene.add(this.clouds);
  }

  setTime(t, force = false) {
    this.time = t;
    const D = PALETTE.dusk, N = PALETTE.night, u = this.uniforms;
    const k = THREE.MathUtils.smoothstep(t, 0.3, 1.0);
    u.uZenith.value.copy(D.zenith).lerp(N.zenith, k);
    u.uUpper.value.copy(D.upper).lerp(N.upper, k);
    u.uHorizon.value.copy(D.horizon).lerp(N.horizon, k);
    u.uGlow.value.copy(D.glow).lerp(N.glow, k);
    u.uGlow2.value.copy(D.glow2).lerp(N.glow2, k);
    u.uGlowAmt.value = THREE.MathUtils.lerp(1.0, 0.55, k);
    u.uStars.value = THREE.MathUtils.lerp(0.55, 1.0, k);
    this.scene.fog.color.copy(D.fog).lerp(N.fog, k);
    const cu = this.cloudMat.uniforms;
    cu.uGlowAmt.value = u.uGlowAmt.value;
    cu.uTop.value.set('#8d86c8').lerp(C('#3f467f'), k);
    cu.uBottom.value.set('#5d5a9e').lerp(C('#2a2f62'), k);
    this.hemiBase = THREE.MathUtils.lerp(1.3, 0.85, k);
    this.hemiBaseColor = C('#9aa6ff').lerp(C('#6f7fd8'), k);
    this.hemi.intensity = this.hemiBase;
    this.hemi.color.copy(this.hemiBaseColor);
    this.key.intensity = THREE.MathUtils.lerp(1.2, 0.65, k);
    if (force || Math.abs(t - (this._envT ?? -1)) > 0.12) {
      this._envT = t;
      const env = this.pmrem.fromScene(this.envScene, 0, 0.1, 50);
      if (this.envRT) this.envRT.dispose();
      this.envRT = env;
      this.scene.environment = env.texture;
      this.scene.environmentIntensity = 0.6;
    }
  }

  update(t, camera) {
    this.uniforms.uTime.value = t;
    this.dome.position.copy(camera.position);
  }
}
