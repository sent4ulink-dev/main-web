import * as THREE from 'three';
import { assets } from '../core/assets.js';
import { toonify, toonMaterial, addOutline } from '../style/toon.js';
import { sandstoneTexture, groundTexture, sandTexture, rugTexture, bannerTexture, chalkboardTexture, stickyTexture, stencilTexture } from './courtyardTextures.js';
import { createDesert, SUN_DIR } from './desert.js';
import { Flames, GoldDust } from '../fx/flames.js';
import { EveningLights } from '../objects/lights.js';
import { Balloons } from '../objects/balloons.js';
import { wind } from './wind.js';

// A sandstone courtyard in the desert at golden hour, in the storybook toon style — an original "operation
// birthday" base: crenellated walls with an arched gate onto a street, a watchtower, red banners, palms,
// crates, sandbags and gear, string lights and brass lanterns, the cake on a green footlocker on a red rug.
//
// Courtyard: x −8…8, z −6 (back wall, gate) … 5 (open front, where you stand); walls 4.2 m.

export const YARD = { x0: -8, x1: 8, z0: -6, z1: 5, h: 4.2, t: 0.6 };
export const WALL_FACE = YARD.z0 + YARD.t / 2;          // the back wall's inner face (z)
export const GATE = { x: 2.6, w: 2.3, h: 3.35 };
export const FOOTLOCKER_TOP = 0.55;
// the marksman's tower out front (right), and the point its rifle is laid on: the cake and the heart in one line
export const TOWER = { pos: new THREE.Vector3(3.7, 0, 9.7), deck: 3.33 };
export const SNIPER_TARGET = new THREE.Vector3(-1.75, 1.45, -2.7);

export const LAYOUT = {
  footlocker: { pos: new THREE.Vector3(0, 0, 0), rotY: 0 },
  dossierCrate: { pos: new THREE.Vector3(-1.4, 0, 0.35), rotY: 0.28 },
  caseCrate: { pos: new THREE.Vector3(1.55, 0, 0.3), rotY: -0.28 },
  timerBarrel: { pos: new THREE.Vector3(-2.75, 0, -1.25), rotY: 0.5 },
  radioCrate: { pos: new THREE.Vector3(2.95, 0, -1.45), rotY: -0.45 },
  sandbags: { pos: new THREE.Vector3(1.9, 0, 3.4), rotY: 0 },
  pallet: { pos: new THREE.Vector3(-5.55, 0, 0.55), rotY: 0.95 },
  heart: new THREE.Vector3(-3.25, 2.15, WALL_FACE + 0.004),   // centre of the bullet-hole heart on the back wall
};

/** A prop from one of the Blender files, toon-shaded, as its own group (root transform reset). */
export function piece(model, name, { outline = 0.0018, tint = null } = {}) {
  const src = assets.models[model]?.getObjectByName(name);
  if (!src) { console.warn('missing piece', model, name); return new THREE.Group(); }
  const o = src.clone(true);
  o.position.set(0, 0, 0); o.rotation.set(0, 0, 0);
  toonify(o, { outline: outline > 0, width: outline, tint });
  o.traverse((m) => {
    if (!m.isMesh || m.userData.isOutline) return;
    for (const mat of [].concat(m.material)) {
      const n = mat.name || '';
      if (n.startsWith('M_gold') || n.startsWith('M_brass')) { mat.emissive.copy(mat.color).multiplyScalar(0.14); mat.userData.rimScale.value = 2.4; }
      else if (n.startsWith('M_steel')) { mat.emissive.copy(mat.color).multiplyScalar(0.06); mat.userData.rimScale.value = 2.2; }
      else if (n.startsWith('M_lantern_glass')) { mat.emissive.set(0xffa040); mat.emissiveIntensity = 0.6; }
      else if (n.startsWith('M_led')) { mat.emissive.set(0xff2010); mat.emissiveIntensity = 1.5; }
      else if (n.startsWith('M_lens')) { mat.emissive.set(0x3a8aa0).multiplyScalar(0.3); mat.userData.rimScale.value = 2.6; }
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

/** A box whose UVs are in metres (so one tiling texture fits every wall at the same scale). */
function meterBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // +x −x +y −y +z −z
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  }
  return g;
}

function archPath(cx, w, h, grow = 0) {
  const p = new THREE.Path(), r = w / 2 + grow, ys = h - w / 2;
  p.moveTo(cx - r, -0.01); p.lineTo(cx + r, -0.01); p.lineTo(cx + r, ys);
  p.absarc(cx, ys, r, 0, Math.PI, false);
  p.lineTo(cx - r, -0.01);
  return p;
}

function buildWalls(group, stoneMat, trimMat) {
  const { x0, x1, z0, z1, h, t } = YARD;
  const add = (m) => { m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  // the back wall, with the arched gate (an extruded outline: its UVs are metres, like the boxes)
  const shape = new THREE.Shape([new THREE.Vector2(x0 - t, 0), new THREE.Vector2(x1 + t, 0), new THREE.Vector2(x1 + t, h), new THREE.Vector2(x0 - t, h)]);
  shape.holes.push(archPath(GATE.x, GATE.w, GATE.h));
  const backGeo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 20 });
  const back = add(new THREE.Mesh(backGeo, stoneMat));
  back.position.z = z0 - t / 2;
  // the gate's arch: a raised band of darker stone, front and back
  for (const side of [1, -1]) {
    const ring = new THREE.Shape();
    const ro = GATE.w / 2 + 0.28, ys = GATE.h - GATE.w / 2;
    ring.moveTo(GATE.x - ro, 0); ring.lineTo(GATE.x - GATE.w / 2, 0); ring.lineTo(GATE.x - GATE.w / 2, ys);
    ring.absarc(GATE.x, ys, GATE.w / 2, Math.PI, 0, true);
    ring.lineTo(GATE.x + GATE.w / 2, 0); ring.lineTo(GATE.x + ro, 0); ring.lineTo(GATE.x + ro, ys);
    ring.absarc(GATE.x, ys, ro, 0, Math.PI, false);
    const m = add(new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 20 }), trimMat));
    m.position.z = side > 0 ? z0 + t / 2 : z0 - t / 2 - 0.08;
  }
  // side walls (stop short of the back wall's ends, so no faces coincide)
  const sideLen = z1 - (z0 + t / 2);
  for (const [x, sgn] of [[x0 - t / 2, 1], [x1 + t / 2, -1]]) {
    const m = add(new THREE.Mesh(meterBox(t, h - 0.3, sideLen), stoneMat));
    m.position.set(x, (h - 0.3) / 2, z0 + t / 2 + sideLen / 2);
    // a stepped end where the wall stops at the front
    const e = add(new THREE.Mesh(meterBox(t + 0.1, 1.4, 0.7), trimMat));
    e.position.set(x, 0.7, z1 - 0.35);
  }
  // crenellations along the tops, and a coping strip (one instanced merlon)
  const merlonGeo = meterBox(0.52, 0.5, t + 0.06);
  const spots = [];
  for (let x = x0 - t / 2; x <= x1 + t / 2; x += 1.0) spots.push([x, h + 0.25 + 0.06, z0, 0]);
  for (const [x, hh] of [[x0 - t / 2, h - 0.3], [x1 + t / 2, h - 0.3]]) for (let z = z0 + 1; z <= z1 - 0.6; z += 1.0) spots.push([x, hh + 0.25 + 0.06, z, Math.PI / 2]);
  const merlons = new THREE.InstancedMesh(merlonGeo, stoneMat, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  spots.forEach(([x, y, z, r], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); merlons.setMatrixAt(i, m4); });
  add(merlons);
  const cope = (len, x, y, z, rotY) => { const m = add(new THREE.Mesh(meterBox(len, 0.12, t + 0.12), trimMat)); m.position.set(x, y, z); m.rotation.y = rotY; };
  cope(x1 - x0 + t * 2 + 0.12, 0, h + 0.06, z0, 0);
  cope(sideLen, x0 - t / 2, h - 0.3 + 0.06, z0 + t / 2 + sideLen / 2, Math.PI / 2);
  cope(sideLen, x1 + t / 2, h - 0.3 + 0.06, z0 + t / 2 + sideLen / 2, Math.PI / 2);
  // the watchtower in the back-right corner
  const tower = new THREE.Group();
  const body = new THREE.Mesh(meterBox(2.6, 8.2, 2.6), stoneMat); body.position.y = 4.1;
  const band = new THREE.Mesh(meterBox(2.9, 0.22, 2.9), trimMat); band.position.y = 7.0;
  const cap = new THREE.Mesh(meterBox(2.9, 0.14, 2.9), trimMat); cap.position.y = 8.25;
  tower.add(body, band, cap);
  for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) {
    const mm = new THREE.Mesh(meterBox(0.46, 0.5, 0.36), stoneMat);
    const a = k * Math.PI / 2, off = -0.9 + j * 0.9;
    mm.position.set(Math.cos(a) * 1.27 - Math.sin(a) * off, 8.57, Math.sin(a) * 1.27 + Math.cos(a) * off);
    mm.rotation.y = -a;
    tower.add(mm);
  }
  // dark arched slits
  const slitMat = new THREE.MeshBasicMaterial({ color: 0x2a1a12 });
  const slitShape = new THREE.Shape(); slitShape.moveTo(-0.16, 0); slitShape.lineTo(0.16, 0); slitShape.lineTo(0.16, 0.5); slitShape.absarc(0, 0.5, 0.16, 0, Math.PI, false); slitShape.lineTo(-0.16, 0);
  const slitGeo = new THREE.ShapeGeometry(slitShape, 10);
  for (const [y, face] of [[5.6, 'z'], [5.6, 'x'], [3.0, 'x']]) {
    const s = new THREE.Mesh(slitGeo, slitMat);
    if (face === 'z') s.position.set(0, y, 1.302); else { s.position.set(-1.302, y, 0); s.rotation.y = -Math.PI / 2; }
    tower.add(s);
  }
  tower.position.set(x1 + 0.2, 0, z0 - 0.15);
  tower.traverse((m) => { if (m.isMesh && m.material !== slitMat) { m.castShadow = true; m.receiveShadow = true; } });
  group.add(tower);
  return { back, tower };
}

/** The street beyond the gate: a few houses with parapets and awnings, and a domed building at its end. */
function buildStreet(group, stoneMat, trimMat) {
  const r = (() => { let s = 17; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  const tints = [0xffffff, 0xf2dcc4, 0xe9cfae, 0xfbe6cc];
  const houseMats = tints.map((c) => { const m = stoneMat.clone(); m.color.set(c); return m; });
  const awning = [0xc8342c, 0x2f8f8a, 0xe2a33a].map((c) => toonMaterial({ color: new THREE.Color(c), side: THREE.DoubleSide }, { rimScale: 0.4 }));
  for (const side of [-1, 1]) {
    let z = YARD.z0 - 1.6;
    while (z > -27) {
      const d = 3 + r() * 3, w = 4 + r() * 2, hh = 4.2 + r() * 3.5;
      const x = GATE.x + side * (2.6 + w / 2);
      const m = new THREE.Mesh(meterBox(w, hh, d), houseMats[Math.floor(r() * houseMats.length)]);
      m.position.set(x, hh / 2, z - d / 2);
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
      const p = new THREE.Mesh(meterBox(w + 0.1, 0.3, d + 0.1), trimMat); p.position.set(x, hh + 0.15, z - d / 2); group.add(p);
      // windows and a door on the street side
      const dark = new THREE.MeshBasicMaterial({ color: 0x3a2618 });
      const fx = GATE.x + side * 2.598;
      for (let k = 0; k < 2; k++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8), dark);
        win.position.set(fx, 2.6 + (hh > 6 ? k * 2 : 0), z - d * (0.3 + 0.4 * k)); win.rotation.y = -side * Math.PI / 2;
        group.add(win);
      }
      if (r() < 0.6) {
        const a = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.7, 1.0), awning[Math.floor(r() * 3)]);
        a.position.set(fx - side * 0.45, 2.35, z - d / 2); a.rotation.set(0, -side * Math.PI / 2, 0); a.rotateX(-0.9);
        group.add(a);
      }
      z -= d + 0.05;
    }
  }
  // the domed building closing the street
  const hall = new THREE.Mesh(meterBox(8, 6, 5), houseMats[1]); hall.position.set(GATE.x, 3, -31); hall.castShadow = true; group.add(hall);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), toonMaterial({ color: new THREE.Color('#e9c27f') }, { rimScale: 0.8 }));
  dome.position.set(GATE.x, 6, -31); group.add(dome);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1, 8), trimMat); fin.position.set(GATE.x, 8.85, -31); group.add(fin);
}

/** A cloth banner, hung from its top edge, rippling gently. */
function banner(map, w = 0.9, h = 2.6) {
  const geo = new THREE.PlaneGeometry(w, h, 6, 18); geo.translate(0, -h / 2, 0);
  const mat = toonMaterial({ map, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }, { rimScale: 0.6 });
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh) => {
    base(sh);
    sh.uniforms.uTime = wind.uniforms.uTime || { value: 0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hang = clamp(-position.y / ${h.toFixed(2)}, 0.0, 1.0);
        transformed.z += (sin(uTime * 1.7 + position.y * 2.2) * 0.05 + sin(uTime * 2.9 + position.x * 4.0) * 0.02) * hang;`);
  };
  mat.customProgramCacheKey = () => 'banner';
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, w + 0.2, 8), toonMaterial({ color: new THREE.Color('#d9a845') }, { rimScale: 2 }));
  rod.rotation.z = Math.PI / 2;
  const g = new THREE.Group(); g.add(m, rod);
  return g;
}

export function createCourtyard(scene) {
  const group = new THREE.Group();
  group.name = 'courtyard';
  scene.add(group);
  const desert = createDesert(scene);
  const L = LAYOUT, o = {};

  const stone = sandstoneTexture(); stone.repeat.set(0.25, 0.25);
  const stoneMat = toonMaterial({ map: stone }, { rimScale: 0.35 });
  const trimTex = sandstoneTexture(9); trimTex.repeat.set(0.5, 0.5);
  const trimMat = toonMaterial({ map: trimTex, color: new THREE.Color('#e9cfa6') }, { rimScale: 0.4 });
  const walls = buildWalls(group, stoneMat, trimMat);
  buildStreet(group, stoneMat, trimMat);

  // the ground: flagstones in the courtyard, sand in the street
  const gt = groundTexture(); gt.repeat.set(18 / 6, 13 / 6);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(18, 13), toonMaterial({ map: gt }, { rimScale: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -0.5); ground.receiveShadow = true;
  group.add(ground);
  const st = sandTexture(); st.repeat.set(40 / 6, 60 / 6);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(40, 60), toonMaterial({ map: st }, { rimScale: 0 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, -0.012, -26); sand.receiveShadow = true;
  group.add(sand);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), toonMaterial({ map: st.clone() }, { rimScale: 0 }));
  front.material.map.repeat.set(60 / 6, 30 / 6); front.material.map.needsUpdate = true;
  front.rotation.x = -Math.PI / 2; front.position.set(0, -0.014, 18); front.receiveShadow = true;
  group.add(front);

  // the red rug and the footlocker that holds the cake
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.8), toonMaterial({ map: rugTexture() }, { rimScale: 0 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, 0.15); rug.receiveShadow = true;
  group.add(rug);
  o.footlocker = place(group, piece('tactical', 'footlocker'), L.footlocker.pos, L.footlocker.rotY);
  const top = (x, z) => new THREE.Vector3(x, FOOTLOCKER_TOP, z);
  o.helmet = place(group, piece('tactical', 'helmet'), top(0.45, 0.12), -0.5);
  place(group, piece('courtyard', 'party_hat'), top(0.45, 0.12).add(new THREE.Vector3(0, 0.13, 0)), 0).rotation.z = 0.25;
  place(group, piece('courtyard', 'gift_b'), top(-0.5, 0.02), 0.3);
  place(group, piece('tactical', 'ammo_box'), top(-0.48, -0.18), 0.1).scale.setScalar(0.8);

  // crates that carry the dossier (left) and the loot case (right); the barrel with the party timer; the radio's crate
  o.dossierCrate = place(group, piece('tactical', 'crate_small'), L.dossierCrate.pos, L.dossierCrate.rotY);
  o.caseCrate = place(group, piece('tactical', 'crate_big'), L.caseCrate.pos, L.caseCrate.rotY);
  o.caseCrate.scale.set(1.35, 0.85, 1.0);   // wide (and a little lower) for the big case
  o.barrel = place(group, piece('tactical', 'barrel'), L.timerBarrel.pos, L.timerBarrel.rotY);
  o.radioCrate = place(group, piece('tactical', 'crate_big'), L.radioCrate.pos, L.radioCrate.rotY);   // wide: the radio and an ammo box side by side
  o.radioCrate.updateMatrixWorld(true);
  place(group, piece('tactical', 'ammo_box'), o.radioCrate.localToWorld(new THREE.Vector3(0.28, 0.622, 0.04)), L.radioCrate.rotY - 0.25);

  // the sandbag nest the rifle rests on (5 courses, staggered)
  const bag = piece('tactical', 'sandbag', { outline: 0.0015 });
  bag.scale.set(1.1, 1.55, 1.2);
  for (let row = 0; row < 4; row++) {
    for (let k = -3; k <= 3; k++) {
      if ((row === 3 && Math.abs(k) === 3) || (row % 2 && k === 3)) continue;
      const b = bag.clone();
      b.position.copy(L.sandbags.pos).add(new THREE.Vector3(k * 0.5 + (row % 2) * 0.25, row * 0.185, (Math.random() - 0.5) * 0.04));
      b.rotation.y = (Math.random() - 0.5) * 0.12;
      group.add(b);
    }
  }
  o.sandbagTop = L.sandbags.pos.clone().add(new THREE.Vector3(0, 4 * 0.185 + 0.02, 0));

  // set dressing: stacks of crates, cases, cans and barrels round the walls (none of it in the shots' way)
  const dress = [
    ['tactical', 'crate_big', [-6.6, 0, -4.9], 0.1], ['tactical', 'crate_small', [-6.5, 0.62, -4.85], -0.2], ['tactical', 'ammo_box', [-6.4, 1.08, -4.8], 0.4],
    ['tactical', 'crate_big', [-5.55, 0, -5.1], -0.05], ['tactical', 'hard_case', [-5.6, 0.62, -5.05], 0.2],
    ['tactical', 'barrel', [-7.2, 0, -3.2], 0], ['tactical', 'barrel', [-7.25, 0, -2.5], 1.2], ['tactical', 'jerrycan', [-6.7, 0, -2.85], 0.5],
    ['tactical', 'crate_big', [6.3, 0, 2.6], -1.4], ['tactical', 'crate_small', [6.2, 0.62, 2.55], -1.1], ['tactical', 'jerrycan', [5.6, 0, 3.3], -0.4],
    ['tactical', 'crate_small', [6.6, 0, -3.6], 0.3], ['tactical', 'hard_case', [6.55, 0.46, -3.6], -0.2], ['tactical', 'barrel', [7.1, 0, -2.6], 0.8],
['tactical', 'jerrycan', [-2.1, 0, -1.55], 0.8], ['tactical', 'ammo_box', [-1.95, 0, -0.95], 0.3],
    ['tactical', 'hard_case', [0.9, 0, 3.55], 0.4], ['tactical', 'ammo_box', [2.95, 0, 3.0], -0.4],
    ['courtyard', 'gift_a', [0.62, 0, 0.75], 0.4], ['courtyard', 'gift_b', [-0.72, 0, 0.78], -0.3],
    ['courtyard', 'pot_plant', [-7.25, 0, 4.2], 0], ['courtyard', 'pot_plant', [7.15, 0, 4.1], 0], ['courtyard', 'pot_plant', [1.0, 0, -5.25], 0], ['courtyard', 'pot_plant', [4.25, 0, -5.25], 0],
    ['courtyard', 'lantern_floor', [-4.55, 0, 1.95], 0.3], ['courtyard', 'lantern_floor', [3.75, 0, -0.55], 0], ['courtyard', 'lantern_floor', [-0.95, 0, -5.2], 0],
  ];
  const flames = [], sizes = [];
  const collect = (obj, size = 1) => { obj.updateMatrixWorld(true); obj.traverse((n) => { if (/^flame_/.test(n.name)) { flames.push(n.getWorldPosition(new THREE.Vector3())); sizes.push(size); } }); };
  for (const [model, name, p, r] of dress) {
    const obj = place(group, piece(model, name), new THREE.Vector3(...p), r);
    if (name === 'lantern_floor') collect(obj, 2.2);
  }
  // wall lanterns: flanking the gate, and on the side walls
  for (const [p, r] of [[[GATE.x - 1.55, 2.95, WALL_FACE], 0], [[GATE.x + 1.55, 2.95, WALL_FACE], 0], [[YARD.x0, 2.9, -2.6], Math.PI / 2], [[YARD.x0, 2.9, 2.4], Math.PI / 2], [[YARD.x1, 2.9, 0.4], -Math.PI / 2]]) {
    collect(place(group, piece('courtyard', 'lantern_wall'), new THREE.Vector3(...p), r), 1.4);
  }
  // palms outside the walls (they show over the battlements and through the gate)
  for (const [name, p, r, s] of [['palm', [-5.6, 0, -8.4], 0.3, 1.1], ['palm', [-9.9, 0, -3.2], 2.0, 1.0], ['palm', [6.0, 0, -9.8], 4.0, 1.15], ['palm', [10.3, 0, 1.8], 1.0, 1.0],
    ['palm_small', [-10.2, 0, 3.4], 0.5, 1.1], ['palm_small', [9.8, 0, -3.6], 2.6, 1.2], ['palm', [-1.2, 0, -9.3], 5.0, 0.95], ['palm_small', [GATE.x - 1.7, 0, -13], 1.0, 1.0]]) {
    place(group, piece('courtyard', name, { outline: 0.0012 }), new THREE.Vector3(...p), r, s);
  }

  // the marksman's tower, its front (local +Z) turned to the target, three sandbags along the front edge
  {
    const d = SNIPER_TARGET.clone().sub(TOWER.pos);
    o.tower = place(group, piece('tactical', 'sniper_tower'), TOWER.pos, Math.atan2(d.x, d.z));
    o.tower.updateMatrixWorld(true);
    const sb = piece('tactical', 'sandbag', { outline: 0.0015 }); sb.scale.set(1.1, 1.55, 1.2);
    for (const x of [-0.5, 0, 0.5]) {
      const b = sb.clone(); b.position.set(x, TOWER.deck, 0.9); b.rotation.y = (Math.random() - 0.5) * 0.15; o.tower.add(b);
    }
    o.sniperRest = o.tower.localToWorld(new THREE.Vector3(0, TOWER.deck + 0.2, 0.9));
  }

  // the photo pallet (the polaroids are pinned on by PhotoBoard) and the chalkboard in a crate lid
  o.pallet = place(group, piece('courtyard', 'pallet_board'), L.pallet.pos, L.pallet.rotY);
  {
    const lid = new THREE.Group();
    const wood = toonMaterial({ color: new THREE.Color('#9c6b3c') }, { rimScale: 0.4 });
    const frameParts = [[1.1, 0.07, 0, 0.37], [1.1, 0.07, 0, -0.37], [0.07, 0.8, 0.52, 0], [0.07, 0.8, -0.52, 0]];
    for (const [w, h, x, y] of frameParts) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), wood); m.position.set(x, y, 0.02); addOutline(m, 0.0015); lid.add(m); }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.68), toonMaterial({ map: chalkboardTexture() }, { rimScale: 0 }));
    board.position.z = 0.012; lid.add(board);
    lid.position.set(-0.55, 0.43, -0.95); lid.rotation.set(-0.22, 0.12, 0);
    lid.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    group.add(lid);
    o.chalkboard = lid;
  }
  // a sticky note on the hard case by the rifle; the stencilled sign on the right wall
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), toonMaterial({ map: stickyTexture() }, { rimScale: 0 }));
  note.position.set(0.9, 0.205, 3.55); note.rotation.set(-Math.PI / 2, 0, 0.4 + 0.15);
  group.add(note);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshLambertMaterial({ map: stencilTexture('B-DAY'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  sign.position.set(YARD.x1 - 0.002, 1.75, -2.4); sign.rotation.y = -Math.PI / 2;
  sign.material.side = THREE.DoubleSide;
  group.add(sign);

  // red banners: on the back wall either side of the spray wall, on the left wall, on the tower
  const bt = bannerTexture();
  for (const [p, r, s] of [[[-6.9, 4.15, WALL_FACE + 0.03], 0, 1], [[0.45, 4.15, WALL_FACE + 0.03], 0, 1], [[YARD.x0 + 0.03, 3.85, -0.9], Math.PI / 2, 0.9], [[YARD.x0 + 0.03, 3.85, 3.4], Math.PI / 2, 0.9], [[YARD.x1 - 1.1, 7.6, YARD.z0 + 1.17], 0, 1.3]]) {
    const b = banner(bt);
    b.position.set(...p); b.rotation.y = r; b.scale.setScalar(s);
    group.add(b);
  }

  // string lights criss-crossing over the courtyard, and balloons tied to the footlocker
  const T = YARD.h - 0.1;
  const lights = new EveningLights(scene, [
    { a: new THREE.Vector3(YARD.x0, T - 0.3, -4.6), b: new THREE.Vector3(YARD.x1, T - 0.3, -2.2), sag: 0.9, bulbs: 34 },
    { a: new THREE.Vector3(YARD.x0, T - 0.3, -1.0), b: new THREE.Vector3(YARD.x1, T - 0.3, 1.2), sag: 1.0, bulbs: 34 },
    { a: new THREE.Vector3(YARD.x0, T - 0.3, 2.6), b: new THREE.Vector3(YARD.x1, T - 0.3, 3.8), sag: 0.8, bulbs: 32 },
    { a: new THREE.Vector3(-3.0, T + 0.3, WALL_FACE), b: new THREE.Vector3(YARD.x0, T - 0.3, 1.0), sag: 0.7, bulbs: 22 },
    { a: new THREE.Vector3(GATE.x + 1.8, T + 0.3, WALL_FACE), b: new THREE.Vector3(YARD.x1, T - 0.3, -0.4), sag: 0.6, bulbs: 18 },
  ], [], { warmLight: false });
  lights.setLevel(0.25);
  const balloons = new Balloons(scene, new THREE.Vector3(2.4, 0, 0.62), 6);
  const balloons2 = new Balloons(scene, new THREE.Vector3(-4.6, 0.0, 2.6), 5);

  // ── light: a low golden sun from the front left, warm sky bounce, a cool rim from behind ──
  const hemi = new THREE.HemisphereLight(0xffe2bf, 0xa8774a, 1.05);
  const sun = new THREE.DirectionalLight(0xffcf96, 2.3);
  sun.position.set(-7, 8.5, 6.5); sun.target.position.set(-0.5, 0, -1);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 34 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025;
  const rimLight = new THREE.DirectionalLight(0xffb27a, 0.6);
  rimLight.position.copy(SUN_DIR).multiplyScalar(30);
  const party = new THREE.PointLight(0xffa860, 0, 9, 1.5);   // the courtyard's own warm glow once dusk falls
  party.position.set(0, 3.0, 0.5);
  scene.add(hemi, sun, sun.target, rimLight, party);
  scene.fog = new THREE.Fog(0xf2c999, 30, 140);

  const candles = new Flames(scene, flames, sizes);
  const dust = new GoldDust(scene, new THREE.Vector3(-7, 0.3, -5.5), new THREE.Vector3(14, 3.6, 10), 260);

  group.traverse((m) => { if (m.isMesh && !m.userData.isOutline && m.castShadow === undefined) m.castShadow = true; });

  // golden hour (0) → violet dusk (1): the sky, the sun, the bounce light, the string lights and lanterns
  const day = { sun: new THREE.Color(0xffcf96), hemiSky: new THREE.Color(0xffe2bf), hemiGround: new THREE.Color(0xa8774a), fog: new THREE.Color(0xf2c999) };
  const dusk = { sun: new THREE.Color(0xff8a66), hemiSky: new THREE.Color(0x6a5a9a), hemiGround: new THREE.Color(0x4a3040), fog: new THREE.Color(0x4a3350) };
  let duskV = 0;
  const setDusk = (v) => {
    duskV = v;
    desert.setDusk(v);
    sun.color.copy(day.sun).lerp(dusk.sun, v); sun.intensity = THREE.MathUtils.lerp(2.3, 0.55, v);
    hemi.color.copy(day.hemiSky).lerp(dusk.hemiSky, v); hemi.groundColor.copy(day.hemiGround).lerp(dusk.hemiGround, v);
    hemi.intensity = THREE.MathUtils.lerp(1.05, 0.95, v);
    rimLight.intensity = THREE.MathUtils.lerp(0.6, 0.25, v);
    scene.fog.color.copy(day.fog).lerp(dusk.fog, v);
    lights.setLevel(THREE.MathUtils.lerp(0.25, 1, v));
    party.intensity = v * 5;
  };

  const update = (t, dt, renderer, camera) => {
    desert.update(t);
    wind.update?.(t, dt);
    candles.update(t);
    dust.update(t, renderer, camera);
    lights.update(t);
    balloons.update(t, dt); balloons2.update(t, dt);
    party.intensity = duskV * (5 + Math.sin(t * 6.1) * 0.2);
  };
  return { group, o, sun, hemi, desert, lights, update, setDusk, get dusk() { return duskV; }, walls };
}
