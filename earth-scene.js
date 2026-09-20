import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { onRealResize } from './viewport.js';
import { tilt } from './tilt.js';

/* ---------------- Dot-matrix Earth · messages flying between real cities · Moon · Satellite ----------------
   The Earth is procedural: land is read from Natural Earth's public-domain 110m outlines
   (assets/data/ne_110m_land.geojson), rasterised to a mask, and turned into a regular lat/lon dot grid on a dark
   sphere with a thin Fresnel rim. Messages are paper planes riding lifted great-circle arcs between real cities.
   The Moon is procedural (grey, cratered, tidally locked); the Satellite is a Poly by Google model (CC-BY 3.0, via
   poly.pizza) drawn as a dark body with dots sampled from its surface, its dish always pointing at the Earth. The paper
   airplane is a Poly by Google model too. */

const R = 1.5; // globe radius
const loader = new GLTFLoader();

function loadModel(url){
  return new Promise((resolve, reject) => loader.load(url, gltf => resolve(gltf.scene), undefined, reject));
}

// normalizes an arbitrary loaded model to sit centered at the origin with the given radius.
// (Some exports keep their original scene-space offset, so the recentering translation has to
// be computed in the SAME scaled space as the object itself.)
function fitToRadius(object, radius){
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = (radius * 2) / maxDim;
  const wrapper = new THREE.Group();
  object.scale.setScalar(scale);
  object.position.copy(center).multiplyScalar(-scale);
  wrapper.add(object);
  return wrapper;
}

// centers a geometry on its own origin and scales it so its longest side equals targetSize
function normalizeGeometry(geo, targetSize){
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = targetSize / (Math.max(size.x, size.y, size.z) || 1);
  geo.translate(-center.x, -center.y, -center.z);
  geo.scale(scale, scale, scale);
  return geo;
}

function orbitRing(radius, color, opacity){
  const pts = [];
  for (let i = 0; i <= 96; i++){
    const a = (i / 96) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

// lat/lon (degrees) -> point on a sphere. lon 0 faces +z (the camera), east is +x, north is +y
function toVec(latDeg, lonDeg, r = 1, out = new THREE.Vector3()){
  const phi = latDeg * Math.PI / 180, lam = lonDeg * Math.PI / 180;
  return out.set(Math.cos(phi) * Math.sin(lam), Math.sin(phi), Math.cos(phi) * Math.cos(lam)).multiplyScalar(r);
}

/* ---------------- land → dots ---------------- */

async function loadLandMask(){
  const geo = await (await fetch('assets/data/ne_110m_land.geojson')).json();
  const W = 2048, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (const f of geo.features){
    const g = f.geometry;
    const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
    for (const poly of polys) for (const ring of poly){
      ring.forEach(([lon, lat], i) => {
        const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.closePath();
    }
  }
  ctx.fill('evenodd'); // holes (lakes, inland seas) are separate rings
  const data = ctx.getImageData(0, 0, W, H).data;
  return (lat, lon) => {
    const x = Math.min(W - 1, Math.max(0, Math.floor((lon + 180) / 360 * W)));
    const y = Math.min(H - 1, Math.max(0, Math.floor((90 - lat) / 180 * H)));
    return data[(y * W + x) * 4 + 3] > 128;
  };
}

// rows of dots at equal angular spacing; each row is offset half a step from the last (a hex-ish grid)
function buildLandDots(isLand, step = 1.55){
  const pos = [], v = new THREE.Vector3();
  let row = 0;
  for (let lat = -90 + step / 2; lat < 90; lat += step, row++){
    const n = Math.max(1, Math.round(360 * Math.cos(lat * Math.PI / 180) / step));
    const shift = (row % 2) * 0.5;
    for (let i = 0; i < n; i++){
      const lon = -180 + (i + shift) * 360 / n;
      if (isLand(lat, lon)){ toVec(lat, lon, R, v); pos.push(v.x, v.y, v.z); }
    }
  }
  return new Float32Array(pos);
}

// Colours. Dots: `lit` where the light hits, `dim` on the night side. Body: `base` in the dark, `baseLit` in the light
// (for the Earth that is the ocean). `rim` is the glow on the sphere's edge.
const PALETTE = {
  earth:  { lit: 0x62f28f, dim: 0x1b7a4a, base: [0.012, 0.05, 0.135], baseLit: [0.045, 0.26, 0.6],   rim: [0.5, 0.78, 1.0] },
  moon:   { lit: 0xf6f2e8, dim: 0x85838a, base: [0.06, 0.06, 0.066], baseLit: [0.5, 0.49, 0.47],    rim: [0.8, 0.8, 0.86] },
  sat:    { lit: 0xffb0d2, dim: 0x8a3f68, base: [0.06, 0.03, 0.05],   baseLit: [0.2, 0.11, 0.16],    rim: [1.0, 0.62, 0.82] },
  beacon: 0xff6b9d,
};
const LIGHT = new THREE.Vector3(-0.55, 0.42, 0.72).normalize(); // world-space direction towards the sun

const DOT_VERT = /* glsl */`
  uniform float uSize;   // dot diameter in world units
  uniform float uScale;  // pixels per world unit at distance 1
  uniform vec3 uLight;   // world-space direction towards the light
  #ifdef USE_NORMAL_ATTR
    attribute vec3 aN;   // real surface normal (for shapes that are not spheres)
  #endif
  #ifdef USE_BRIGHT
    attribute float aB;  // per-dot brightness
  #endif
  varying float vLit;
  varying float vFres;
  varying float vB;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale / -mv.z;
    #ifdef USE_NORMAL_ATTR
      vec3 n = normalize(aN);
    #else
      vec3 n = normalize(position);
    #endif
    vLit = dot(normalize(mat3(modelMatrix) * n), uLight);
    vFres = 1.0 - clamp(normalize(normalMatrix * n).z, 0.0, 1.0);
    #ifdef USE_BRIGHT
      vB = aB;
    #else
      vB = 1.0;
    #endif
  }`;
const DOT_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform vec3 uDim;
  varying float vLit;
  varying float vFres;
  varying float vB;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.3, d);
    float lit = smoothstep(-0.25, 0.9, vLit);
    vec3 col = mix(uDim, uColor, lit) * vB;
    col += uColor * 0.3 * pow(vFres, 2.0) * lit; // a little glint on the lit limb
    gl_FragColor = vec4(col, a);
  }`;

function dotMaterial({ size, color, dim, uniforms, bright = false, normals = false }){
  const defines = {};
  if (bright) defines.USE_BRIGHT = '';
  if (normals) defines.USE_NORMAL_ATTR = '';
  return new THREE.ShaderMaterial({
    defines, vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, transparent: true, depthWrite: false,
    uniforms: {
      uSize: { value: size }, uScale: uniforms.uScale, uLight: uniforms.uLight,
      uColor: { value: new THREE.Color(color) }, uDim: { value: new THREE.Color(dim) },
    },
  });
}

const BODY_VERT = /* glsl */`
  varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * mv;
  }`;
const BODY_FRAG = /* glsl */`
  uniform vec3 uLight; uniform vec3 uBase; uniform vec3 uBaseLit; uniform vec3 uRim;
  varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main(){
    float f = 1.0 - max(dot(vN, vV), 0.0);
    float lit = smoothstep(-0.3, 0.9, dot(vW, uLight));
    vec3 base = mix(uBase, uBaseLit, lit);
    float rim = pow(f, 2.6) * 0.55 + smoothstep(0.92, 1.0, f) * 0.85; // soft inner glow + a thin bright edge
    vec3 col = base + uRim * rim * (0.32 + 0.68 * lit);
    gl_FragColor = vec4(col, 1.0);
  }`;

// the dark body with a glowing rim that every dotted object (earth, moon, satellite) sits on
function bodyMaterial(p){
  return new THREE.ShaderMaterial({
    vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, side: THREE.DoubleSide,
    uniforms: { uLight: { value: LIGHT }, uBase: { value: new THREE.Vector3(...p.base) }, uBaseLit: { value: new THREE.Vector3(...p.baseLit) }, uRim: { value: new THREE.Vector3(...p.rim) } },
  });
}

// The Moon, in the same dot language as the Earth but unmistakably a moon: dots cover the WHOLE ball (no continents),
// in neutral grey; a few big dark "seas" (maria) dim the dots, and lots of craters read as rings of bright dots
// around a darker floor, the biggest with a bright central peak.
function buildMoon(dotUniforms){
  const r = 0.3, g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.975, 40, 40), bodyMaterial(PALETTE.moon)));
  let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const unit = () => { const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, k = Math.sqrt(1 - u * u); return new THREE.Vector3(k * Math.cos(t), u, k * Math.sin(t)); };
  const smoothstep = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  const maria = Array.from({ length: 6 }, () => ({ c: unit(), r: 0.5 + rnd() * 0.45 }));
  const craters = Array.from({ length: 52 }, () => ({ c: unit(), r: 0.05 + Math.pow(rnd(), 2.2) * 0.27 }));
  const pos = [], bri = [], d = new THREE.Vector3();
  const step = 3.7;
  let row = 0;
  for (let lat = -90 + step / 2; lat < 90; lat += step, row++){
    const n = Math.max(1, Math.round(360 * Math.cos(lat * Math.PI / 180) / step));
    for (let i = 0; i < n; i++){
      toVec(lat, -180 + (i + (row % 2) * 0.5) * 360 / n, 1, d);
      // bright highlands with a little natural variation
      let b = 0.78 + 0.18 * Math.sin(d.x * 9.1 + 0.7) * Math.sin(d.y * 8.3 + 2.0) * Math.sin(d.z * 7.7 + 1.1);
      for (const m of maria){
        const t = 1 - smoothstep(m.r * 0.6, m.r, Math.acos(Math.min(1, d.dot(m.c))));
        b *= 1 - 0.62 * t;
      }
      for (const cr of craters){
        const ang = Math.acos(Math.min(1, d.dot(cr.c)));
        if (ang > cr.r) continue;
        if (ang > cr.r * 0.8) b = Math.min(1, b + 0.5);       // bright rim
        else if (ang < cr.r * 0.13 && cr.r > 0.14) b = Math.min(1, b + 0.35); // central peak
        else b *= 0.7;                                          // darker floor
      }
      pos.push(d.x * r, d.y * r, d.z * r); bri.push(b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aB', new THREE.Float32BufferAttribute(bri, 1));
  const dots = new THREE.Points(geo, dotMaterial({ size: 0.0125, color: PALETTE.moon.lit, dim: PALETTE.moon.dim, uniforms: dotUniforms, bright: true }));
  dots.renderOrder = 2;
  g.add(dots);
  return g;
}

// random points on the surface of every mesh under `root` (in root's own space), area-weighted, with the face normal
function sampleSurface(root, count, lift){
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const parts = []; let triCount = 0;
  const v = new THREE.Vector3(), m = new THREE.Matrix4();
  root.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position, idx = o.geometry.index;
    m.multiplyMatrices(inv, o.matrixWorld);
    const cnt = Math.floor((idx ? idx.count : p.count) / 3) * 3, arr = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++){
      v.fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(m);
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
    }
    parts.push(arr); triCount += cnt / 3;
  });
  const V = new Float32Array(triCount * 9);
  let off = 0; for (const a of parts){ V.set(a, off); off += a.length; }

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), cr = new THREE.Vector3();
  const cum = new Float32Array(triCount), centre = new THREE.Vector3();
  let total = 0;
  for (let t = 0; t < triCount; t++){
    a.fromArray(V, t * 9); b.fromArray(V, t * 9 + 3); c.fromArray(V, t * 9 + 6);
    total += cr.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).length() * 0.5;
    cum[t] = total; centre.add(a);
  }
  centre.divideScalar(Math.max(triCount, 1));

  let seed = 9; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let k = 0; k < count; k++){
    const target = rnd() * total;
    let lo = 0, hi = triCount - 1;
    while (lo < hi){ const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; }
    a.fromArray(V, lo * 9); b.fromArray(V, lo * 9 + 3); c.fromArray(V, lo * 9 + 6);
    const su = Math.sqrt(rnd()), r2 = rnd();
    p.set(0, 0, 0).addScaledVector(a, 1 - su).addScaledVector(b, su * (1 - r2)).addScaledVector(c, su * r2);
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize();
    if (n.dot(cr.subVectors(p, centre)) < 0) n.negate(); // point the normal away from the middle of the object
    p.addScaledVector(n, lift);
    p.toArray(pos, k * 3); n.toArray(nor, k * 3);
  }
  return { pos, nor };
}

/* ---------------- messages ---------------- */

const CITIES = [
  ['ULAANBAATAR', 47.92, 106.92], ['TOKYO', 35.68, 139.69], ['SEOUL', 37.57, 126.98], ['BEIJING', 39.90, 116.40],
  ['SINGAPORE', 1.35, 103.82], ['BANGKOK', 13.76, 100.50], ['JAKARTA', -6.21, 106.85], ['SYDNEY', -33.87, 151.21],
  ['DELHI', 28.61, 77.21], ['DUBAI', 25.20, 55.27], ['ISTANBUL', 41.01, 28.98], ['MOSCOW', 55.76, 37.62],
  ['BERLIN', 52.52, 13.40], ['LONDON', 51.51, -0.13], ['PARIS', 48.86, 2.35], ['CAIRO', 30.04, 31.24],
  ['LAGOS', 6.52, 3.38], ['NAIROBI', -1.29, 36.82], ['CAPE TOWN', -33.92, 18.42], ['NEW YORK', 40.71, -74.01],
  ['TORONTO', 43.65, -79.38], ['SAN FRANCISCO', 37.77, -122.42], ['MEXICO CITY', 19.43, -99.13],
  ['SÃO PAULO', -23.55, -46.63], ['BUENOS AIRES', -34.60, -58.38],
];
const MESSAGE_COLORS = [0x8fe9ff, 0xff9ecf, 0xc9b8ff, 0xffffff];

// a great-circle arc lifted off the surface; the longer the trip, the higher it climbs
class ArcCurve extends THREE.Curve {
  constructor(a, b){
    super();
    this.a = a.clone().normalize(); this.b = b.clone().normalize();
    this.ang = this.a.angleTo(this.b);
    this.sin = Math.sin(this.ang);
    this.lift = R * (0.1 + 0.5 * this.ang / Math.PI);
  }
  getPoint(t, target = new THREE.Vector3()){
    const w1 = Math.sin((1 - t) * this.ang) / this.sin, w2 = Math.sin(t * this.ang) / this.sin;
    target.set(0, 0, 0).addScaledVector(this.a, w1).addScaledVector(this.b, w2).normalize();
    return target.multiplyScalar(R * 1.006 + this.lift * Math.sin(Math.PI * t));
  }
}

const TRAIL_VERT = /* glsl */`
  attribute float aT; varying float vT;
  void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TRAIL_FRAG = /* glsl */`
  varying float vT; uniform float uHead; uniform float uTail; uniform float uOpacity; uniform vec3 uColor;
  void main(){
    float d = uHead - vT;
    float a = d < 0.0 ? 0.0 : pow(clamp(1.0 - d / uTail, 0.0, 1.0), 1.5);
    gl_FragColor = vec4(uColor, a * uOpacity);
  }`;

function createMessageNetwork(parent, planeGeo, dotUniforms, onSend){
  const cityVecs = CITIES.map(([, lat, lon]) => toVec(lat, lon, R * 1.004));

  // city dots (always on) — small pink beacons
  const beaconGeo = new THREE.BufferGeometry();
  beaconGeo.setAttribute('position', new THREE.Float32BufferAttribute(cityVecs.flatMap(v => [v.x, v.y, v.z]), 3));
  const beacons = new THREE.Points(beaconGeo, dotMaterial({ size: 0.05, color: PALETTE.beacon, dim: 0xb8456f, uniforms: dotUniforms }));
  beacons.renderOrder = 3;
  parent.add(beacons);

  // ripples on the ground where a message leaves / lands
  const ringGeo = new THREE.RingGeometry(0.9, 1, 48);
  const pulses = [];
  for (let i = 0; i < 14; i++){
    const mat = new THREE.MeshBasicMaterial({ color: 0xff9ecf, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.visible = false;
    parent.add(mesh);
    pulses.push({ mesh, mat, t: 1 });
  }
  const zAxis = new THREE.Vector3(0, 0, 1);
  function pulse(vec, color){
    const p = pulses.find(x => x.t >= 1) || pulses[0];
    p.t = 0; p.mat.color.setHex(color);
    p.mesh.position.copy(vec).multiplyScalar(1.002);
    p.mesh.quaternion.setFromUnitVectors(zAxis, vec.clone().normalize());
    p.mesh.visible = true;
  }

  const group = new THREE.Group();
  parent.add(group);

  const FLIGHT_TIME = 2.8;   // seconds to travel the arc
  const FADE_TIME = 0.9;     // seconds for the trail to drain after arrival
  const SPAWN_EVERY = 0.3;   // seconds between new messages
  const MAX_ACTIVE = 18;
  const ARC_SEGMENTS = 64;
  const TAIL = 0.6;
  const PLANE_SCALE = 0.085;
  const up = new THREE.Vector3(), tangent = new THREE.Vector3(), lookTarget = new THREE.Vector3(), pos = new THREE.Vector3();
  const orientMatrix = new THREE.Matrix4(), orientQuat = new THREE.Quaternion();
  const active = [];
  let spawnTimer = 0;

  function spawn(){
    const ai = Math.floor(Math.random() * cityVecs.length);
    let bi, ang = 0, tries = 0;
    do { bi = Math.floor(Math.random() * cityVecs.length); ang = bi === ai ? 0 : cityVecs[ai].angleTo(cityVecs[bi]); }
    while ((ang < 0.55 || ang > 2.7) && ++tries < 30); // not next door, not straight through the planet
    if (ang < 0.55 || ang > 2.7) return;
    const curve = new ArcCurve(cityVecs[ai], cityVecs[bi]);
    const color = MESSAGE_COLORS[Math.floor(Math.random() * MESSAGE_COLORS.length)];

    // thin comet-like trail that follows the plane along the arc
    const pts = curve.getPoints(ARC_SEGMENTS);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(pts.map((_, i) => i / ARC_SEGMENTS), 1));
    const trailMat = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, transparent: true, depthWrite: false,
      uniforms: { uHead: { value: 0 }, uTail: { value: TAIL }, uOpacity: { value: 0.9 }, uColor: { value: new THREE.Color(color) } },
    });
    const trail = new THREE.Line(geo, trailMat);
    trail.frustumCulled = false;
    group.add(trail);

    // solid paper body + a slightly larger dark backface shell (the cheap "toon outline" trick)
    const planeMat = new THREE.MeshStandardMaterial({ color, flatShading: true, side: THREE.DoubleSide, roughness: 0.6, transparent: true, opacity: 1 });
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x14141f, side: THREE.BackSide, transparent: true, opacity: 1 });
    const body = new THREE.Mesh(planeGeo, planeMat);
    const outline = new THREE.Mesh(planeGeo, outlineMat);
    outline.scale.setScalar(1.22);
    const plane = new THREE.Group();
    plane.add(outline, body);
    plane.scale.setScalar(PLANE_SCALE);
    plane.position.copy(cityVecs[ai]);
    group.add(plane);

    pulse(cityVecs[ai], 0xff9ecf);
    onSend && onSend(CITIES[ai][0], CITIES[bi][0]);
    active.push({ curve, trail, geo, trailMat, plane, planeMat, outlineMat, elapsed: 0, landed: false, to: cityVecs[bi] });
  }

  function update(dt){
    spawnTimer += dt;
    if (spawnTimer >= SPAWN_EVERY && active.length < MAX_ACTIVE){ spawnTimer = 0; spawn(); }

    for (const p of pulses){
      if (p.t >= 1) continue;
      p.t = Math.min(p.t + dt / 1.3, 1);
      const s = 0.012 + 0.16 * (1 - Math.pow(1 - p.t, 3));
      p.mesh.scale.setScalar(s);
      p.mat.opacity = 0.9 * (1 - p.t);
      if (p.t >= 1) p.mesh.visible = false;
    }

    for (let i = active.length - 1; i >= 0; i--){
      const f = active[i];
      f.elapsed += dt;
      const flyT = Math.min(f.elapsed / FLIGHT_TIME, 1);
      // ease the trip so it leaves and lands gently
      const e = flyT * flyT * (3 - 2 * flyT) * 0.55 + flyT * 0.45;
      f.curve.getPoint(e, pos);
      f.plane.position.copy(pos);

      // Nose = curve tangent, belly toward the planet. Matrix4.lookAt is pure local-space vector math
      // (the arcs live in the rotating globe's LOCAL space, so Object3D.lookAt's world-space maths would drift).
      tangent.copy(f.curve.getTangent(Math.min(e + 0.001, 1))).normalize();
      up.copy(pos).normalize();
      lookTarget.copy(pos).add(tangent);
      orientMatrix.lookAt(lookTarget, pos, up); // eye/target order matches this model's nose at local -Z
      orientQuat.setFromRotationMatrix(orientMatrix);
      f.plane.quaternion.copy(orientQuat);
      f.plane.rotateY(Math.PI);

      f.trailMat.uniforms.uHead.value = f.elapsed <= FLIGHT_TIME ? e : 1 + Math.min((f.elapsed - FLIGHT_TIME) / FADE_TIME, 1) * TAIL;

      if (f.elapsed <= FLIGHT_TIME){
        const fadeIn = Math.min(flyT / 0.1, 1), fadeOut = 1 - Math.max((flyT - 0.93) / 0.07, 0);
        f.planeMat.opacity = f.outlineMat.opacity = fadeIn * fadeOut;
      } else {
        f.planeMat.opacity = f.outlineMat.opacity = 0;
        if (!f.landed){ f.landed = true; pulse(f.to, 0xffffff); }
        if (f.elapsed - FLIGHT_TIME >= FADE_TIME){
          group.remove(f.trail, f.plane);
          f.geo.dispose(); f.trailMat.dispose(); f.planeMat.dispose(); f.outlineMat.dispose();
          active.splice(i, 1);
        }
      }
    }
  }
  return { update };
}

/* ---------------- scene ---------------- */

export async function initEarthScene({ canvas, reduceMotion }){
  if (!canvas || !canvas.getContext) return;

  const coarse = window.matchMedia('(pointer: coarse)').matches;   // a phone or tablet: fewer pixels, fewer triangles, 30 fps
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(coarse ? 1 : Math.min(window.devicePixelRatio || 1, 1.25)); // the canvas is huge: more pixels than this cost a lot and show little
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  // pulled back far enough that the moon's full orbit — even combined with the interactive tilt — stays in frame
  camera.position.set(0, 0.35, 9.5);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x8894c8, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 3.4);
  sun.position.copy(LIGHT).multiplyScalar(6);
  scene.add(sun);

  const root = new THREE.Group();
  scene.add(root);

  const MOON_ORBIT_R = 2.55, SAT_ORBIT_R = 2.05;
  const moonPivot = new THREE.Group();
  moonPivot.rotation.x = 0.27; moonPivot.rotation.z = 0.12;
  root.add(moonPivot);
  moonPivot.add(orbitRing(MOON_ORBIT_R, 0xd9d0ff, 0.2));
  const satPivot = new THREE.Group();
  satPivot.rotation.x = -0.35; satPivot.rotation.z = -0.18;
  root.add(satPivot);
  satPivot.add(orbitRing(SAT_ORBIT_R, 0xff9ecf, 0.24));

  // shared shader inputs
  const dotUniforms = { uScale: { value: 1 }, uLight: { value: LIGHT } };

  // ---- the globe: dark body, land dots, thin outer ring ----
  const earth = new THREE.Group();
  earth.rotation.y = -107 * Math.PI / 180 + 0.5; // open on Mongolia / East Asia
  root.add(earth);

  const body = new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, coarse ? 56 : 96, coarse ? 56 : 96), bodyMaterial(PALETTE.earth));
  earth.add(body);

  try {
    const isLand = await loadLandMask();
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.BufferAttribute(buildLandDots(isLand), 3));
    const dots = new THREE.Points(dotGeo, dotMaterial({ size: 0.021, color: PALETTE.earth.lit, dim: PALETTE.earth.dim, uniforms: dotUniforms }));
    dots.renderOrder = 2;
    earth.add(dots);
  } catch (err) {
    console.error('earth-scene: could not build the land dots', err);
  }

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(R * 1.045, R * 1.052, 160),
    new THREE.MeshBasicMaterial({ color: 0x7fbfff, transparent: true, opacity: 0.16, depthWrite: false })
  );
  root.add(halo);

  // ---- models + messages ----
  const labelEl = document.getElementById('globeLabel');
  const labelCard = labelEl && labelEl.querySelector('.gt-card');
  const labelRoute = labelEl && labelEl.querySelector('.gt-route');
  let lastLabel = 0;
  const onSend = (from, to) => {
    if (!labelCard || !labelRoute) return;
    const now = performance.now();
    if (now - lastLabel < 2600) return; // keep it readable
    lastLabel = now;
    const nice = n => n.toLowerCase().replace(/(^|\s)(\S)/g, (_, sp, ch) => sp + ch.toUpperCase()); // (\b would split "são" at the ã)
    labelRoute.textContent = `${nice(from)} → ${nice(to)}`;
    labelCard.classList.remove('pop'); void labelCard.offsetWidth; labelCard.classList.add('pop'); // replay the pop-in
  };

  let messageNetwork = { update(){} }, moon, satellite;
  try {
    const [satScene, planeScene] = await Promise.all([
      loadModel('assets/models/satellite.glb'),
      loadModel('assets/models/paper-plane.glb'),
    ]);
    let planeGeoSource;
    planeScene.traverse(o => { if (o.isMesh) planeGeoSource = o.geometry; });
    messageNetwork = createMessageNetwork(earth, normalizeGeometry(planeGeoSource.clone(), 1), dotUniforms, onSend);

    moon = buildMoon(dotUniforms);
    moon.position.x = MOON_ORBIT_R;
    moonPivot.add(moon);

    // the satellite: same dark body + rim as the Earth, dressed in dots sampled from its own surface
    satellite = fitToRadius(satScene, 0.32);
    const satBody = bodyMaterial(PALETTE.sat);
    satellite.traverse(o => {
      if (!o.isMesh) return;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      o.material = satBody;
    });
    const { pos, nor } = sampleSurface(satellite, 3400, 0.004);
    const satGeo = new THREE.BufferGeometry();
    satGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    satGeo.setAttribute('aN', new THREE.BufferAttribute(nor, 3));
    const satDots = new THREE.Points(satGeo, dotMaterial({ size: 0.0105, color: PALETTE.sat.lit, dim: PALETTE.sat.dim, uniforms: dotUniforms, normals: true }));
    satDots.renderOrder = 2;
    satellite.add(satDots);
    // Orientation: the model's dish opens toward +Z (feed horn at the tip) and its solar panels span X. Point the dish at
    // the Earth (pivot -X) and run the panels along the orbit's normal (pivot Y), like a real nadir-pointing satellite.
    // The pivot's own rotation carries it round, so it keeps facing the Earth all the way.
    satellite.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0)));
    satellite.position.x = SAT_ORBIT_R;
    satPivot.add(satellite);
  } catch (err) {
    console.error('earth-scene: failed to load a model', err);
  }

  function resize(){
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || w;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // pixels per world unit at distance 1, so dots keep a constant on-screen size
    dotUniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  }
  resize();
  onRealResize(resize);

  // gentle cursor-driven nudge, independent of the CSS billboard the canvas sits in
  let targetYaw = 0, targetPitch = 0, yaw = 0, pitch = 0;
  const heroEl = canvas.closest('.hero');
  if (heroEl && !window.matchMedia('(hover: none)').matches){
    heroEl.addEventListener('mousemove', e => {
      const r = heroEl.getBoundingClientRect();
      targetYaw = ((e.clientX - r.left) / r.width - 0.5) * 0.7;
      targetPitch = ((e.clientY - r.top) / r.height - 0.5) * 0.45;
    });
    heroEl.addEventListener('mouseleave', () => { targetYaw = 0; targetPitch = 0; });
  }

  // the label follows the globe's on-screen position (the canvas sits in a tilted, parallaxing 3D stack)
  function placeLabel(){
    if (!labelEl || !heroEl) return;
    const c = canvas.getBoundingClientRect(), h = heroEl.getBoundingClientRect();
    const k = c.width / 820; // offsets below are in units of an 820px-wide canvas, scaled by however big the canvas is drawn
    // just off the globe's upper-right limb, clear of the header
    labelEl.style.transform = `translate3d(${(c.left - h.left + c.width / 2 + 185 * k).toFixed(1)}px,${(c.top - h.top + c.height / 2 - 150 * k).toFixed(1)}px,0)`;
  }

  const clock = new THREE.Clock();
  let running = false, raf = 0;
  let lastDraw = 0;
  function frame(now){
    if (!running){ raf = 0; return; }
    if (coarse && now - lastDraw < 30){ raf = requestAnimationFrame(frame); return; }   // 30 fps is plenty on a phone
    lastDraw = now;
    if (!coarse) placeLabel();   // (the label isn't shown on a phone)
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!reduceMotion){
      if (tilt.active){ targetYaw = tilt.x * 0.5; targetPitch = tilt.y * 0.35; }   // a phone: its lean swings the globe like the mouse does
      earth.rotation.y += dt * 0.11;
      messageNetwork.update(dt);
      moonPivot.rotation.y += dt * 0.5;
      satPivot.rotation.y -= dt * 0.9;
      yaw += (targetYaw - yaw) * 0.06;
      pitch += (targetPitch - pitch) * 0.06;
      root.rotation.y = yaw;
      root.rotation.x = pitch;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  // only draw while the hero is on screen; the rest of the time the GPU has better things to do
  new IntersectionObserver(([entry]) => {
    running = entry.isIntersecting;
    if (running && !raf){ clock.getDelta(); raf = requestAnimationFrame(frame); }
  }, { rootMargin: '150px' }).observe(heroEl || canvas);
  const goLite = () => { renderer.setPixelRatio(1); resize(); };
  window.addEventListener('sent4u:lite', goLite);
  if (document.body.classList.contains('lite')) goLite();   // the mode may have been switched on before this scene finished loading
}
