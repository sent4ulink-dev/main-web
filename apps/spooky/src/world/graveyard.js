import * as THREE from 'three';
import { assets } from '../core/assets.js';
import { toonify, toonMaterial } from '../style/toon.js';
import { grassTexture, stoneTexture, cobwebTexture, glowTexture, canvas, toTexture, rng } from './nightTextures.js';
import { createNightSky, MOON_DIR } from './nightsky.js';
import { Flames } from '../fx/flames.js';
import { Bats } from '../fx/bats.js';
import { addJackFace } from '../objects/jackface.js';

// A haunted graveyard on a hill, in the storybook toon style: an iron fence and creaking gate, a path of
// stepping stones through crooked tombstones, a pumpkin patch, a dead tree, a crypt, a witch's cauldron and,
// at the top of the path, the haunted mansion with glowing windows under a giant moon. Fog crawls over the
// ground, will-o'-wisps drift, bats circle the tower, crows watch, and lightning flickers now and then.
//
// Ground: the gate is at z = 6.5 (where you stand), the mansion at z = -17.

export const LAYOUT = {
  gate: new THREE.Vector3(0, 0, 6.5),
  mailbox: { pos: new THREE.Vector3(2.15, 0, 4.25), rotY: -0.95 },
  pumpkin: { pos: new THREE.Vector3(-3.3, 0, 1.5), rotY: 0.45 },   // far enough in that the camera stays inside the fence
  tree: { pos: new THREE.Vector3(-5.8, 0, -1.4), rotY: -2.33 },   // its branch tips (the polaroids) on the side facing the path
  // the plan's four stones, side by side in a gentle arc, each turned to face where you stand on the path
  plan: [
    { pos: new THREE.Vector3(0.62, 0, -0.66), rotY: -0.18, kind: 'round' },
    { pos: new THREE.Vector3(1.69, 0, -0.17), rotY: -0.47, kind: 'gothic' },
    { pos: new THREE.Vector3(2.68, 0, 0.52), rotY: -0.75, kind: 'round' },
    { pos: new THREE.Vector3(3.53, 0, 1.39), rotY: -1.04, kind: 'gothic' },
  ],
  crypt: { pos: new THREE.Vector3(6.4, 0, -7.4), rotY: -0.6 },
  cauldron: { pos: new THREE.Vector3(-3.1, 0, -6.4), rotY: 0.4 },
  gramophone: { pos: new THREE.Vector3(2.5, 0, -10.9), rotY: -0.45 },
  mansion: { pos: new THREE.Vector3(0, 0, -17), rotY: 0 },
  bucket: { pos: new THREE.Vector3(1.35, 0.7, -13.15), rotY: -0.15 },
  camera: { pos: new THREE.Vector3(0.25, 0, 8.05), look: new THREE.Vector3(-0.15, 2.4, -10) },
};
// Where the story's cameras look from and to (x, z): nothing gets scattered across these lines of sight.
const VIEWS = [
  [0.6, 5.4, 2.15, 4.25], [-1.4, 5.8, -3.3, 1.5], [-1.6, 2.6, -5.8, -1.0], [-0.2, 3.6, 0.6, -0.7], [-0.2, 3.6, 2.2, 0.15], [-0.2, 3.6, 3.5, 1.4], [4.0, -3.8, 6.4, -7.4],
  [-2.1, -4.1, -3.1, -6.4], [1.1, -8.0, 2.5, -10.9], [1.0, -11.0, 1.35, -13.15], [0.25, 8.05, 0.2, 6.0], [1.6, 1.2, -0.4, -12],
];
const segDist = (x, z, [ax, az, bx, bz]) => {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
};
const PATH = [[0, 6.6], [-0.5, 4.2], [0.35, 1.6], [-0.35, -1.2], [0.4, -4.0], [-0.25, -7.0], [0.5, -9.6], [0.6, -11.6]];

/** A prop from the Blender file, toon-shaded, as its own group (root transform reset). */
export function piece(name, { outline = 0.0018, tint = null, model = 'halloween' } = {}) {
  const src = assets.models[model]?.getObjectByName(name);
  if (!src) { console.warn('missing piece', name); return new THREE.Group(); }
  const o = src.clone(true);
  o.position.set(0, 0, 0); o.rotation.set(0, 0, 0);
  toonify(o, { outline: outline > 0, width: outline, tint });
  o.traverse((m) => {
    if (!m.isMesh || m.userData.isOutline) return;
    for (const mat of [].concat(m.material)) {
      const n = mat.name || '';
      if (n.startsWith('M_window_glow')) { mat.emissive.set(0xffa53a); mat.emissiveIntensity = 1.1; }
      else if (n.startsWith('M_window_green')) { mat.emissive.set(0x7dff6a); mat.emissiveIntensity = 0.9; }
      else if (n.startsWith('M_eye_glow')) { mat.emissive.set(0xffc23a); mat.emissiveIntensity = 1.4; }
      else if (n.startsWith('M_shroom') && !n.includes('stem')) { mat.emissive.set(0x9a3cff); mat.emissiveIntensity = 0.55; }
      else if (n.startsWith('M_fire')) { mat.emissive.set(0xff7a2a); mat.emissiveIntensity = 1.6; }
      else if (n.startsWith('M_gold')) { mat.emissive.copy(mat.color).multiplyScalar(0.12); mat.userData.rimScale.value = 2.4; }
      else if (n.startsWith('M_stone') || n.startsWith('M_bone')) mat.userData.rimScale.value = 1.4;
      else if (n.startsWith('M_pumpkin')) mat.userData.rimScale.value = 1.5;
    }
  });
  const g = new THREE.Group();
  g.name = name;
  g.add(o);
  g.userData.src = o;
  return g;
}

function place(parent, obj, pos, rotY = 0, scale = 1) {
  obj.position.copy(pos); obj.rotation.y = rotY; obj.scale.setScalar(scale);
  parent.add(obj);
  return obj;
}

function pathCurve() { return new THREE.CatmullRomCurve3(PATH.map(([x, z]) => new THREE.Vector3(x, 0, z))); }

/** Distance from (x, z) to the path (to keep scattered props off it). */
function pathDist(x, z, curve) {
  let best = 1e9; const p = new THREE.Vector3();
  for (let i = 0; i <= 60; i++) { curve.getPoint(i / 60, p); best = Math.min(best, Math.hypot(p.x - x, p.z - z)); }
  return best;
}

/** Crawling ground fog: a few big planes with drifting noise. */
function groundFog(scene) {
  const u = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.27, 0.26, 0.4) }, uOpacity: { value: 0.24 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime, uOpacity; uniform vec3 uColor; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){ vec2 p = vW.xz * 0.18 + vec2(uTime * 0.05, uTime * 0.02) + vW.y * 3.0;
        float f = n(p) * 0.6 + n(p * 2.3 - uTime * 0.04) * 0.4;
        float a = smoothstep(0.42, 0.9, f) * uOpacity;
        float far = smoothstep(55.0, 25.0, length(vW.xz));
        gl_FragColor = vec4(uColor, a * far); }`,
  });
  const planes = [];
  const phone = matchMedia('(pointer: coarse)').matches;
  for (const y of phone ? [0.06, 0.24] : [0.04, 0.14, 0.3]) {   // phones: one layer fewer (it's all overdraw)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), mat);
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 6;
    scene.add(m); planes.push(m);
  }
  return { u, planes };
}

/** Will-o'-wisps: little green-blue lights drifting low over the graves. */
function wisps(scene, count = 70) {
  const g = new THREE.BufferGeometry();
  const seed = new Float32Array(count * 4).map(() => Math.random());
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const u = { uTime: { value: 0 }, uPx: { value: 800 }, uMap: { value: glowTexture(64) } };
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 aSeed; uniform float uTime, uPx; varying float vA; varying float vHue;
      void main(){ vec3 p = vec3((aSeed.x - 0.5) * 22.0, 0.4 + aSeed.y * 2.2, 6.0 - aSeed.z * 24.0);
        float t = uTime * (0.2 + aSeed.w * 0.3) + aSeed.x * 40.0;
        p.x += sin(t) * 1.2; p.z += cos(t * 0.8) * 1.0; p.y += sin(t * 1.7) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = 0.55 + 0.45 * sin(uTime * 2.0 + aSeed.y * 30.0); vHue = aSeed.w;
        gl_PointSize = clamp(0.11 * uPx / -mv.z, 1.0, 22.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uMap; varying float vA; varying float vHue;
      void main(){ float a = texture2D(uMap, gl_PointCoord).r * vA; vec3 c = mix(vec3(0.35, 1.0, 0.45), vec3(0.4, 0.7, 1.0), vHue);
        gl_FragColor = vec4(c * a * 1.4, a * 0.8); }`,
  }));
  pts.frustumCulled = false; pts.renderOrder = 7;
  scene.add(pts);
  return u;
}

/** A jagged lightning bolt (flat strips): a main channel with forked branches. Re-shaped on every strike. */
function boltGeometry(branches = 2) {
  const verts = [];
  const channel = (x, y, steps, w0, dx = 0) => {
    let px = x, py = y;
    const pts = [[px, py]];
    for (let i = 0; i < steps; i++) { px += (Math.random() - 0.5) * 3 + dx; py -= 2.0 + Math.random() * 1.2; pts.push([px, py]); }
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], w = w0 * (1 - i / pts.length) + 0.06;
      verts.push(ax - w, ay, 0, ax + w, ay, 0, bx + w, by, 0, ax - w, ay, 0, bx + w, by, 0, bx - w, by, 0);
    }
    return pts;
  };
  const main = channel(0, 0, 13, 0.4);
  for (let k = 0; k < branches; k++) {
    const [bx, by] = main[2 + Math.floor(Math.random() * 7)];
    channel(bx, by, 4 + Math.floor(Math.random() * 4), 0.2, (Math.random() < 0.5 ? -1 : 1) * 1.2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return g;
}

function boltMesh() {
  const m = new THREE.Mesh(boltGeometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.9, 1).multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide, toneMapped: false }));
  m.renderOrder = -8;
  return m;
}

export function createGraveyard(scene) {
  const group = new THREE.Group(); group.name = 'graveyard';
  scene.add(group);
  const sky = createNightSky(scene);
  const L = LAYOUT, o = {};
  const curve = pathCurve();
  const R = rng(1031);   // the same graveyard on every visit

  // the ground: grass, flat round the graves, rolling up into hills outside the fence
  const gt = grassTexture(); gt.repeat.set(90 / 8, 90 / 8);
  const gg = new THREE.PlaneGeometry(90, 90, 120, 120);
  gg.rotateX(-Math.PI / 2);
  const gp = gg.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    const out = Math.max(THREE.MathUtils.smoothstep(Math.abs(x), 10, 20), THREE.MathUtils.smoothstep(z, 9, 20), THREE.MathUtils.smoothstep(-z, 22, 32));
    gp.setY(i, out * (2.5 + Math.sin(x * 0.2) * 1.2 + Math.cos(z * 0.17) * 1.0) + Math.sin(x * 0.9) * Math.cos(z * 0.7) * 0.04);
  }
  gg.computeVertexNormals();
  const ground = new THREE.Mesh(gg, toonMaterial({ map: gt }, { rimScale: 0 }));
  ground.receiveShadow = true;
  group.add(ground);

  // stepping stones up the path to the mansion
  const st = new THREE.CylinderGeometry(0.34, 0.37, 0.07, 9);
  const stones = new THREE.InstancedMesh(st, toonMaterial({ map: stoneTexture() }, { rimScale: 0.4 }), 34);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3();
  for (let i = 0; i < 34; i++) {
    curve.getPoint(i / 33, p);
    p.x += (R() - 0.5) * 0.15; p.y = 0.03;
    q.setFromEuler(new THREE.Euler(0, R() * 3, 0));
    const s = 0.85 + R() * 0.3;
    m4.compose(p, q, new THREE.Vector3(s, 1, s * (0.8 + R() * 0.3)));
    stones.setMatrixAt(i, m4);
  }
  stones.receiveShadow = true;
  group.add(stones);

  // the iron fence along the front, the gate in the middle
  const fence = piece('fence_section', { outline: 0.0012 });
  for (let k = 0; k < 6; k++) {
    for (const sx of [-1, 1]) {
      const f = fence.clone();
      f.position.set(sx * (2.95 + k * 2.0), 0, L.gate.z); f.rotation.y = sx < 0 ? 0 : Math.PI;
      group.add(f);
    }
  }
  for (const sx of [-1, 1]) {   // the fence turns back along the sides
    for (let k = 0; k < 6; k++) { const f = fence.clone(); f.position.set(sx * 13.95, 0, L.gate.z - 1.0 - k * 2.0); f.rotation.y = Math.PI / 2; group.add(f); }
  }
  o.gate = place(group, piece('gate'), L.gate);
  o.gateL = o.gate.getObjectByName('gate_left'); o.gateR = o.gate.getObjectByName('gate_right');
  o.mailbox = place(group, piece('coffin_mailbox'), L.mailbox.pos, L.mailbox.rotY);
  o.pumpkin = place(group, piece('pumpkin_giant'), L.pumpkin.pos, L.pumpkin.rotY, 1.5);
  o.tree = place(group, piece('dead_tree'), L.tree.pos, L.tree.rotY);
  o.crypt = place(group, piece('crypt'), L.crypt.pos, L.crypt.rotY);
  o.cauldron = place(group, piece('cauldron'), L.cauldron.pos, L.cauldron.rotY);
  o.gramophone = place(group, piece('gramophone'), L.gramophone.pos, L.gramophone.rotY);
  o.mansion = place(group, piece('mansion', { outline: 0.0012 }), L.mansion.pos, L.mansion.rotY);
  o.bucket = place(group, piece('candy_bucket'), L.bucket.pos, L.bucket.rotY, 1.25);
  o.camera = place(group, piece('box_camera'), L.camera.pos, Math.atan2(L.camera.look.x - L.camera.pos.x, L.camera.look.z - L.camera.pos.z));
  // the plan's tombstones (sunk into the ground until the date chapter raises them)
  o.plan = L.plan.map((sp) => {
    const t = place(group, piece(`tomb_${sp.kind}`), sp.pos, sp.rotY);
    const mound = place(group, piece('dirt_mound', { outline: 0.0012 }), sp.pos.clone().add(new THREE.Vector3(Math.sin(sp.rotY) * 0.75, -0.02, Math.cos(sp.rotY) * 0.75)), sp.rotY, 0.9);
    return { t, mound };
  });

  // scattered graves, pumpkins, mushrooms, rocks, skulls — never on the path or at the story's places
  const keep = [L.mailbox.pos, L.pumpkin.pos, L.tree.pos, L.crypt.pos, L.cauldron.pos, L.gramophone.pos, ...L.plan.map((s) => s.pos)];
  const free = (x, z, r) => pathDist(x, z, curve) > 1.3 && keep.every((k) => Math.hypot(k.x - x, k.z - z) > r) && Math.abs(z + 17) > 3.6 && VIEWS.every((v) => segDist(x, z, v) > 1.1);
  const kinds = ['tomb_cross', 'tomb_small', 'tomb_round', 'tomb_gothic', 'tomb_cross', 'tomb_small'];
  let n = 0;
  for (let tries = 0; tries < 400 && n < 26; tries++) {
    const x = (R() - 0.5) * 24, z = 5 - R() * 19;
    if (!free(x, z, 2.0)) continue;
    const t = place(group, piece(kinds[n % kinds.length]), new THREE.Vector3(x, 0, z), (R() - 0.5) * 0.6, 0.85 + R() * 0.3);
    t.rotation.z = (R() - 0.5) * 0.18; t.rotation.x = (R() - 0.5) * 0.1;   // crooked
    if (R() < 0.5) place(group, piece('dirt_mound', { outline: 0.0012 }), new THREE.Vector3(x + Math.sin(t.rotation.y) * 0.7, -0.02, z + Math.cos(t.rotation.y) * 0.7), t.rotation.y, 0.8);
    n++;
  }
  const small = [['pumpkin', 6], ['pumpkin_tall', 4], ['mushrooms', 8], ['rock', 8], ['skull', 4]];
  for (const [name, count] of small) {
    let c = 0;
    for (let tries = 0; tries < 200 && c < count; tries++) {
      const x = (R() - 0.5) * 22, z = 5.5 - R() * 18;
      if (!free(x, z, 1.2)) continue;
      const it = place(group, piece(name, { outline: 0.0012 }), new THREE.Vector3(x, 0, z), R() * 6, 0.9 + R() * 0.5);
      if (name.startsWith('pumpkin')) addJackFace(it, new THREE.Vector3(0, 0.3, z + 1.5), c);   // grinning at the path
      c++;
    }
  }
  // the pumpkin patch round the giant pumpkin
  const faceA = Math.atan2(Math.cos(L.pumpkin.rotY), Math.sin(L.pumpkin.rotY));   // the carved face's direction (x-z angle)
  for (let k = 0; k < 6; k++) {
    const a = faceA + 1.15 + k * 0.8, r = 1.75 + (k % 2) * 0.45;   // round the sides and back only, never in front of the face
    const it = place(group, piece(k % 3 ? 'pumpkin' : 'pumpkin_tall', { outline: 0.0012 }), L.pumpkin.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)), R() * 6, 1.0 + R() * 0.6);
    addJackFace(it, new THREE.Vector3(-1.4, 1.0, 5.6), k + 1);   // all of them look out at you
  }
  // candles and skulls round the cauldron and on the crypt steps
  const flames = [], sizes = [];
  const collect = (obj, size = 1) => { obj.updateMatrixWorld(true); obj.traverse((nd) => { if (/^flame_/.test(nd.name)) { flames.push(nd.getWorldPosition(new THREE.Vector3())); sizes.push(size); } }); };
  for (const [pp, r] of [[L.cauldron.pos.clone().add(new THREE.Vector3(0.9, 0, 0.5)), 0], [L.cauldron.pos.clone().add(new THREE.Vector3(-0.85, 0, 0.6)), 1], [L.crypt.pos.clone().add(new THREE.Vector3(-1.2, 0.0, 1.6)), 2], [L.gramophone.pos.clone().add(new THREE.Vector3(-0.7, 0, 0.3)), 3]]) {
    collect(place(group, piece('candles', { outline: 0.0012 }), pp, r), 1.6);
  }
  place(group, piece('skull', { outline: 0.0012 }), L.cauldron.pos.clone().add(new THREE.Vector3(0.75, 0, -0.5)), 0.5, 1.4);
  // lamp posts along the path
  o.lamps = [[-0.95, -0.7, 0], [1.6, -3.4, Math.PI], [-1.4, -8.6, 0.2]].map(([x, z, r]) => { const l = place(group, piece('lamp_post', { outline: 0.0012 }), new THREE.Vector3(x, 0, z), r); collect(l, 2.4); return l; });
  // crows on the gate pillar, the tree and the fence
  o.crows = [
    place(group, piece('crow', { outline: 0.0012 }), L.gate.clone().add(new THREE.Vector3(-1.47, 3.1, 0)), 0.4, 1.4),
    place(group, piece('crow', { outline: 0.0012 }), new THREE.Vector3(-8.95, 1.35, L.gate.z), -0.3, 1.3),
    place(group, piece('crow', { outline: 0.0012 }), L.crypt.pos.clone().add(new THREE.Vector3(0, 3.85, 0.4)), 0.2, 1.3),
  ];
  // cobwebs on the gate pillars and in the porch corner
  const webMat = new THREE.MeshBasicMaterial({ map: cobwebTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.8 });
  for (const [pp, ry, s] of [[L.gate.clone().add(new THREE.Vector3(-1.22, 2.6, -0.26)), 0, 0.7], [L.gate.clone().add(new THREE.Vector3(1.22, 2.6, -0.26)), Math.PI, 0.6], [new THREE.Vector3(2.1, 3.0, -12.8), Math.PI, 0.9]]) {
    const web = new THREE.Mesh(new THREE.PlaneGeometry(s, s), webMat);
    web.position.copy(pp); web.rotation.set(Math.PI, ry, 0);
    group.add(web);
  }

  // ── light: cold moonlight from behind the mansion, a purple sky bounce, a soft fill from where you stand ──
  const hemi = new THREE.HemisphereLight(0x6a58a8, 0x1c2a22, 1.0);
  const moon = new THREE.DirectionalLight(0xa9b4ff, 1.5);
  moon.position.copy(MOON_DIR).multiplyScalar(40).add(new THREE.Vector3(6, 8, 0)); moon.target.position.set(0, 0, -3);
  moon.castShadow = true;
  Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 90 });
  moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.03;
  const fill = new THREE.DirectionalLight(0xc89ae0, 0.55);
  fill.position.set(4, 6, 14);
  const pumpkinLight = new THREE.PointLight(0xff8a2a, 0.6, 5, 1.6);
  pumpkinLight.position.copy(L.pumpkin.pos).add(new THREE.Vector3(Math.sin(L.pumpkin.rotY) * 1.4, 0.9, Math.cos(L.pumpkin.rotY) * 1.4));
  const brewLight = new THREE.PointLight(0x6cff5a, 1.4, 5, 1.6);
  brewLight.position.copy(L.cauldron.pos).add(new THREE.Vector3(0, 1.3, 0));
  scene.add(hemi, moon, moon.target, fill, pumpkinLight, brewLight);
  scene.fog = new THREE.FogExp2(0x2a2440, 0.028);

  const candles = new Flames(scene, flames, sizes);
  const fog = groundFog(scene);
  const wispU = wisps(scene);
  const batMeshMaker = () => piece('bat', { outline: 0.001 });
  const moonAt = new THREE.Vector3().copy(MOON_DIR).multiplyScalar(60);
  const bats = new Bats(scene, batMeshMaker, { count: 26, centre: L.mansion.pos.clone().add(new THREE.Vector3(-3.4, 10.5, 2)), moonAt });
  const bolt = boltMesh();
  scene.add(bolt);

  // the mansion's glowing windows (they flicker; and go dark for a moment when something wicked happens)
  const windowMats = [];
  o.mansion.traverse((m) => { if (m.isMesh && !m.userData.isOutline) for (const mat of [].concat(m.material)) if (/M_window/.test(mat.name || '')) windowMats.push(mat); });

  group.traverse((m) => { if (m.isMesh && !m.userData.isOutline && m.castShadow === undefined) m.castShadow = true; });

  // lightning: a flash, a bolt in the sky, light on everything; thunder is the audio's job (onLightning)
  let flash = 0, nextStrike = 8 + Math.random() * 10, dark = 0, bigFlash = false;
  const hemiBase = hemi.intensity;
  /** big: a close, forked strike right where you look (az: its direction round the hill, 0 = toward the mansion). */
  const strike = ({ big = false, az = null } = {}) => {
    flash = big ? 1.7 : 1;
    bigFlash = big;
    const a = az ?? (Math.random() - 0.5) * 1.6;
    const dist = big ? 75 : 120, h = big ? 52 : 70;
    bolt.geometry.dispose(); bolt.geometry = boltGeometry(big ? 3 : 1);
    bolt.position.set(Math.sin(a) * dist, h, -Math.cos(a) * dist); bolt.lookAt(0, h, 0);
    bolt.scale.setScalar(big ? 4.2 + Math.random() * 1.5 : 3 + Math.random() * 2);
    api.onLightning?.(big);
  };
  const api = {
    group, o, sun: moon, hemi, sky, bats, fog, update: null, strike, brewLight, pumpkinLight,
    /** Windows (and lamps) go dark for `s` seconds — a trick. */
    blackout(s = 1.2) { dark = s; },
    /** No lightning this instant (for a clean render). */
    calm() { flash = 0; hemi.intensity = hemiBase; sky.uniforms.uFlash.value = 0; bolt.material.opacity = 0; },
    get flash() { return flash; },
  };
  api.update = (t, dt, renderer, camera) => {
    sky.update(t);
    candles.update(t);
    fog.u.uTime.value = t;
    wispU.uTime.value = t;
    wispU.uPx.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    bats.update(t, dt);
    nextStrike -= dt;
    if (nextStrike <= 0) { strike(); nextStrike = 14 + Math.random() * 16; }
    flash = Math.max(0, flash - dt * (bigFlash ? 2.2 : 3.2));
    const flick = flash > 0.05 ? (Math.random() < 0.5 ? flash : flash * 0.3) : 0;
    sky.uniforms.uFlash.value = Math.min(bigFlash ? 0.6 : 1, flick);
    bolt.material.opacity = flick > 0.3 ? 1 : 0;
    hemi.intensity = hemiBase + Math.min(flick, 1.2) * (bigFlash ? 2.8 : 2.2);
    dark = Math.max(0, dark - dt);
    const on = dark > 0 ? 0.05 : 1;
    windowMats.forEach((m, i) => { m.emissiveIntensity = on * (1.0 + 0.15 * Math.sin(t * (3 + i) + i) + (Math.random() < 0.004 ? -0.8 : 0)); });
    pumpkinLight.intensity = (api.pumpkinGlow ?? 0.6) * (0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.1)) * on;
    brewLight.intensity = 1.4 * (0.85 + 0.15 * Math.sin(t * 5.3)) * (on > 0.5 ? 1 : 0.2);
    o.crows.forEach((c, i) => { c.userData.base ??= c.rotation.y; const want = c.userData.base + (Math.sin(t * 0.37 + i * 2.1) > 0 ? 0.55 : -0.35); c.rotation.y += (want - c.rotation.y) * Math.min(1, dt * 6); });
  };
  return api;
}
