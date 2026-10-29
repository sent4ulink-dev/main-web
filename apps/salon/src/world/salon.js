import * as THREE from 'three';
import { assets } from '../core/assets.js';
import { toonify, toonMaterial, addOutline } from '../style/toon.js';
import { parquetTexture, wallTexture, ceilingTexture, rugTexture, sheetTexture } from './salonTextures.js';
import { createVienna } from './vienna.js';
import { Flames, GoldDust } from '../fx/flames.js';

// A candle-lit Viennese salon of the Classical era (Mozart's and Beethoven's Vienna), in the storybook
// toon style: parquet, cream walls with gilded panels, three tall arched windows onto the twilit city,
// a marble fireplace with a mirror, a crystal chandelier over the birthday tea table, the fortepiano
// and its fellow instruments, a writing desk with a quill, a gallery wall for five portraits.
//
// Room: x −6…6 (left wall = portraits, right wall = fireplace), z −5 (windows) … 5 (doors), height 5.2.

export const ROOM = { x0: -6, x1: 6, z0: -5, z1: 5, h: 5.2 };
export const WINDOWS = [-3.6, 0, 3.6].map((x) => ({ x, w: 1.7, y0: 0.72, y1: 4.15 }));
export const TABLE = new THREE.Vector3(0, 0, 0.3);
export const TABLE_TOP = 0.774;

export const LAYOUT = {
  piano: { pos: new THREE.Vector3(-3.15, 0, -2.55), rotY: 0.58 },
  harp: { pos: new THREE.Vector3(-5.3, 0, -4.2), rotY: 1.0 },
  desk: { pos: new THREE.Vector3(3.35, 0, -4.15), rotY: 0 },
  fireplace: { pos: new THREE.Vector3(6, 0, -0.5), rotY: -Math.PI / 2 },
  easel: { pos: new THREE.Vector3(3.2, 0, 3.0), rotY: -2.45 },
  settee: { pos: new THREE.Vector3(5.1, 0, 2.6), rotY: -Math.PI / 2 },
  bust: { pos: new THREE.Vector3(-5.2, 0, 3.9), rotY: 2.3 },
  portraits: { x: -5.94, y: 2.35, zs: [-3.1, -1.55, 0, 1.55, 3.1] },
};

const GOLD_RIM = new THREE.Color(1.0, 0.86, 0.55);

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
      if (n.startsWith('M_gold')) { mat.emissive.copy(mat.color).multiplyScalar(0.16); mat.userData.rimScale.value = 2.4; }
      else if (n.startsWith('M_crystal')) { mat.emissive.set(0x9fb8e8).multiplyScalar(0.12); mat.userData.rimScale.value = 2.2; }
      else if (n.startsWith('M_wax')) mat.emissive.set(0xffe2b0).multiplyScalar(0.25);
      else if (n.startsWith('M_silver')) { mat.emissive.copy(mat.color).multiplyScalar(0.1); mat.userData.rimScale.value = 2.6; }
      else if (n.startsWith('M_fire')) { mat.emissive.set(0xff7a2a); mat.emissiveIntensity = 1.6; }
      else if (n.startsWith('M_velvet')) mat.userData.rimScale.value = 1.6;
    }
    if (/candle|wick|drop|bead|str\d|crystal/.test(m.name)) { m.castShadow = false; }
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

function wallMat(texture) {
  return toonMaterial({ map: texture, side: THREE.FrontSide }, { rimScale: 0 });
}

function buildRoom(group) {
  const { x0, x1, z0, z1, h } = ROOM;
  const W = x1 - x0, D = z1 - z0;
  // floor
  const parquet = parquetTexture(); parquet.repeat.set(W / 2, D / 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), toonMaterial({ map: parquet }, { rimScale: 0 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  group.add(floor);
  // rug under the table
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 96), toonMaterial({ map: rugTexture() }, { rimScale: 0 }));
  rug.rotation.x = -Math.PI / 2; rug.scale.set(2.5, 2.1, 1); rug.position.set(TABLE.x, 0.006, TABLE.z); rug.receiveShadow = true;
  group.add(rug);
  // walls (one bay of panelling every 2 m)
  const wt = wallTexture();
  const side = (len) => { const t = wt.clone(); t.needsUpdate = true; t.repeat.set(len / 2, 1); return t; };
  // the gallery wall: one panel per portrait (1.55 m bays, a panel centred on z = 0)
  const gal = wt.clone(); gal.needsUpdate = true; gal.repeat.set(D / 1.55, 1); gal.offset.x = ((0.5 - 0.5 * D / 1.55) % 1 + 1) % 1;
  const left = new THREE.Mesh(new THREE.PlaneGeometry(D, h), wallMat(gal));
  left.position.set(x0, h / 2, 0); left.rotation.y = Math.PI / 2;
  const right = new THREE.Mesh(new THREE.PlaneGeometry(D, h), wallMat(side(D)));
  right.position.set(x1, h / 2, 0); right.rotation.y = -Math.PI / 2;
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W, h), wallMat(side(W)));
  front.position.set(0, h / 2, z1); front.rotation.y = Math.PI;
  // back wall with three arched window openings
  const shape = new THREE.Shape([new THREE.Vector2(x0, 0), new THREE.Vector2(x1, 0), new THREE.Vector2(x1, h), new THREE.Vector2(x0, h)]);
  for (const win of WINDOWS) shape.holes.push(archPath(win.x, win.w, win.y0, win.y1));
  const backGeo = new THREE.ShapeGeometry(shape, 24);
  const bt = wt.clone(); bt.needsUpdate = true; bt.repeat.set(0.5, 1 / h); bt.offset.set(0.5, 0);
  const back = new THREE.Mesh(backGeo, wallMat(bt));
  back.position.z = z0;
  for (const m of [left, right, front, back]) { m.receiveShadow = true; group.add(m); }
  // ceiling
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), toonMaterial({ map: ceilingTexture() }, { rimScale: 0 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = h;
  group.add(ceil);
  // cornice, baseboard and pilasters (cream with gilded lines)
  const cream = toonMaterial({ color: new THREE.Color('#f4e7d2') }, { rimScale: 0.4 });
  const gilt = toonMaterial({ color: new THREE.Color('#d9a845'), emissive: new THREE.Color('#d9a845').multiplyScalar(0.15) }, { rimScale: 2.2 });
  const marble = toonMaterial({ color: new THREE.Color('#e8d8cc') }, { rimScale: 0.4 });
  const strip = (len, y, hh, d, mat, axis, at) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? len : d, hh, axis === 'x' ? d : len), mat);
    if (axis === 'x') m.position.set(0, y, at + Math.sign(-at) * d / 2); else m.position.set(at + Math.sign(-at) * d / 2, y, 0);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  for (const [axis, at, len] of [['x', z0, W], ['x', z1, W], ['z', x0, D], ['z', x1, D]]) {
    // (corners: the side walls' strips stop where the end walls' begin, so no two faces ever coincide)
    const L = (d) => (axis === 'z' ? len - 2 * d : len);
    strip(L(0.22), h - 0.175, 0.31, 0.22, cream, axis, at);
    strip(L(0.26), h - 0.335, 0.035, 0.26, gilt, axis, at);
    strip(L(0.3), h - 0.045, 0.06, 0.3, gilt, axis, at);
    strip(L(0.05), 0.083, 0.16, 0.05, marble, axis, at);
    strip(L(0.06), 0.168, 0.018, 0.06, gilt, axis, at);
  }
  // pilasters between the windows and in the corners of the back wall
  const pil = (x, z, rotY) => {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.34, h - 0.5, 0.1), cream); shaft.position.y = (h - 0.5) / 2 + 0.17;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.16), gilt); cap.position.y = h - 0.42;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.3, 0.14), marble); base.position.y = 0.15;
    for (let k = -1; k <= 1; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, h - 1.1, 0.02), gilt); f.position.set(k * 0.09, h / 2, 0.055); g.add(f); }
    g.add(shaft, cap, base);
    g.position.set(x, 0, z); g.rotation.y = rotY;
    g.traverse((m) => { if (m.isMesh) m.receiveShadow = true; });
    group.add(g);
  };
  for (const x of [-5.6, -1.8, 1.8, 5.6]) pil(x, z0 + 0.05, 0);
  for (const z of [-4.6, 4.6]) { pil(x0 + 0.05, z, Math.PI / 2); pil(x1 - 0.05, z, -Math.PI / 2); }
  // window frames: deep cream reveals, gilded edges, glazing bars and a sill
  for (const win of WINDOWS) group.add(windowFrame(win, cream, gilt, marble));
  // double doors in the front wall
  const door = new THREE.Group();
  const panelMat = toonMaterial({ color: new THREE.Color('#efe2cc') }, { rimScale: 0.5 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.3, 0.12), gilt); frame.position.y = 1.65;
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.84, 3.15, 0.14), panelMat); leaf.position.y = 1.6;
  door.add(frame, leaf);
  for (const sx of [-1, 1]) for (const [y, hh] of [[0.75, 1.0], [2.25, 1.5]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.66, hh, 0.02), gilt); p.position.set(sx * 0.46, y, 0.08); door.add(p);
    const q = new THREE.Mesh(new THREE.BoxGeometry(0.6, hh - 0.06, 0.025), panelMat); q.position.set(sx * 0.46, y, 0.085); door.add(q);
  }
  const split = new THREE.Mesh(new THREE.BoxGeometry(0.02, 3.15, 0.16), gilt); split.position.y = 1.6; door.add(split);
  door.position.set(0, 0, z1 - 0.08); door.rotation.y = Math.PI;
  group.add(door);
}

function archPath(cx, w, y0, y1, grow = 0) {
  const p = new THREE.Path();
  w += grow * 2; y0 -= grow; y1 += grow;
  const r = w / 2, ys = y1 - r;
  p.moveTo(cx - r, y0); p.lineTo(cx + r, y0); p.lineTo(cx + r, ys);
  p.absarc(cx, ys, r, 0, Math.PI, false);
  p.lineTo(cx - r, y0);
  return p;
}

function windowFrame(win, cream, gilt, marble) {
  const g = new THREE.Group();
  const r = win.w / 2, ys = win.y1 - r;
  // reveal: an extruded arch ring (outer slightly bigger than the opening)
  const ring = (grow, depth, mat, z, hole = 0) => {
    const outer = new THREE.Shape(); const ro = r + grow;
    outer.moveTo(-ro, win.y0 - grow * 0.4); outer.lineTo(ro, win.y0 - grow * 0.4); outer.lineTo(ro, ys); outer.absarc(0, ys, ro, 0, Math.PI, false); outer.lineTo(-ro, win.y0 - grow * 0.4);
    outer.holes.push(archPath(0, win.w, win.y0, win.y1, hole));
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 24 }), mat);
    m.position.z = z;
    return m;
  };
  g.add(ring(0.18, 0.05, cream, 0.012, 0.012), ring(0.08, 0.07, gilt, 0.02, 0.03));
  const inner = ring(0.0001, 0.34, cream, -0.34); g.add(inner);
  // glazing bars (white-gold), set back in the reveal
  const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), gilt); m.position.set(x, y, -0.22); g.add(m); };
  bar(0.035, win.y1 - win.y0 - 0.02, 0, (win.y0 + win.y1) / 2 - 0.01);
  for (let k = 1; k <= 3; k++) bar(win.w, 0.03, 0, win.y0 + (ys - win.y0) * k / 4);
  for (let k = 0; k < 5; k++) { const a = Math.PI * (k + 1) / 6; const m = new THREE.Mesh(new THREE.BoxGeometry(0.025, r, 0.03), gilt); m.position.set(Math.cos(a) * r / 2, ys + Math.sin(a) * r / 2, -0.22); m.rotation.z = a - Math.PI / 2; g.add(m); }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(win.w + 0.4, 0.06, 0.42), marble); sill.position.set(0, win.y0 - 0.026, -0.12); g.add(sill);
  g.position.set(win.x, 0, ROOM.z0);
  g.traverse((m) => { if (m.isMesh) m.receiveShadow = true; });
  return g;
}

/** Rose garlands swagging over the portrait wall (one instanced rose). */
function garlands(group, zs, y, x) {
  const rose = piece('decor', 'rose', { outline: 0 });
  const meshes = [];
  rose.updateMatrixWorld(true);
  rose.traverse((m) => { if (m.isMesh && !m.userData.isOutline) meshes.push(m); });
  const spots = [];
  for (let i = 0; i < zs.length - 1; i++) {
    const a = zs[i] + 0.35, b = zs[i + 1] - 0.35;
    for (let k = 0; k <= 9; k++) { const t = k / 9; spots.push(new THREE.Vector3(x, y - Math.sin(Math.PI * t) * 0.32, a + (b - a) * t)); }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (const src of meshes) {
    const inst = new THREE.InstancedMesh(src.geometry, src.material, spots.length);
    spots.forEach((p, i) => {
      q.setFromEuler(new THREE.Euler(Math.random() * 0.6, Math.PI / 2 + (Math.random() - 0.5) * 0.8, Math.PI / 2 + (Math.random() - 0.5) * 0.6));
      const s = 0.8 + Math.random() * 0.5;
      m4.compose(p, q, new THREE.Vector3(s, s, s)).multiply(src.matrixWorld);
      inst.setMatrixAt(i, m4);
    });
    inst.castShadow = false;
    group.add(inst);
  }
}

export function createSalon(scene) {
  const group = new THREE.Group();
  group.name = 'salon';
  scene.add(group);
  buildRoom(group);
  const view = createVienna(scene);
  const L = LAYOUT, o = {};

  // the tea table under the chandelier
  o.table = place(group, piece('decor', 'round_table'), TABLE);
  o.cloth = place(group, piece('decor', 'tablecloth', { outline: 0.0012 }), TABLE);
  o.runner = place(group, piece('decor', 'runner', { outline: 0 }), TABLE.clone().add(new THREE.Vector3(0, 0.001, 0)), 0.5);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const p = TABLE.clone().add(new THREE.Vector3(Math.sin(a) * 1.0, 0, Math.cos(a) * 1.0));
    place(group, piece('decor', 'chair'), p, a + Math.PI);
  }
  const T = (x, z) => new THREE.Vector3(TABLE.x + x, TABLE_TOP, TABLE.z + z);
  place(group, piece('table', 'pineapple'), T(-0.36, -0.22), 0.4);
  place(group, piece('table', 'cake_stand'), T(0.4, -0.18), 0.3);
  place(group, piece('table', 'teapot'), T(0.38, 0.2), -0.6);
  place(group, piece('table', 'sugar_bowl'), T(0.16, 0.08), 0);
  for (const [x, z, r] of [[-0.46, 0.08, 0.4], [-0.08, -0.42, 2.0], [0.5, -0.02, -1.2]]) place(group, piece('table', 'cup'), T(x, z), r);
  place(group, piece('table', 'chocolate_pot'), T(-0.18, -0.38), 0.8);
  // (cake, salver + letter and the wish casket are placed by their own objects)

  // the chandelier over the table and candelabras / sconces round the room
  const flames = [], sizes = [];
  const collect = (obj) => { obj.updateMatrixWorld(true); obj.traverse((n) => { if (/^flame_/.test(n.name)) { flames.push(n.getWorldPosition(new THREE.Vector3())); sizes.push(1); } }); };
  o.chandelier = place(group, piece('decor', 'chandelier', { outline: 0.0012 }), new THREE.Vector3(TABLE.x, ROOM.h - 0.62, TABLE.z));
  collect(o.chandelier);
  // music corner: fortepiano, harp, stands, the cello against the wall, the violin on a chair
  o.piano = place(group, piece('instruments', 'fortepiano'), L.piano.pos, L.piano.rotY);
  o.pianoBench = place(group, piece('decor', 'chair'), L.piano.pos.clone().add(new THREE.Vector3(Math.sin(L.piano.rotY) * 0.62, 0, Math.cos(L.piano.rotY) * 0.62)), L.piano.rotY + Math.PI);
  o.harp = place(group, piece('instruments', 'harp'), L.harp.pos, L.harp.rotY);
  o.stand1 = place(group, piece('instruments', 'music_stand'), new THREE.Vector3(-1.55, 0, -3.75), 0.35);
  o.stand2 = place(group, piece('instruments', 'music_stand'), new THREE.Vector3(-4.2, 0, -1.25), 1.2);
  o.violinChair = place(group, piece('decor', 'chair'), new THREE.Vector3(-1.2, 0, -2.95), -0.5);
  for (const st of [o.stand1, o.stand2]) {
    st.updateMatrixWorld(true);
    const a = st.getObjectByName('sheet_anchor');
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.45), toonMaterial({ map: sheetTexture(st === o.stand1 ? 3 : 8, st === o.stand1 ? 'Eine kleine Nachtmusik' : 'Ode an die Freude'), side: THREE.DoubleSide }, { rimScale: 0 }));
    sheet.position.copy(a.position).add(new THREE.Vector3(0, 0, -0.012)); sheet.quaternion.copy(a.quaternion);
    sheet.rotateY(Math.PI);
    a.parent.add(sheet);
  }
  // writing desk with the inkwell and a candlestick (the quill is the Quill object's)
  o.desk = place(group, piece('decor', 'writing_desk'), L.desk.pos, L.desk.rotY);
  place(group, piece('decor', 'inkwell'), L.desk.pos.clone().add(new THREE.Vector3(0.34, 0.766, -0.08)));
  const deskCandle = place(group, piece('table', 'candlestick'), L.desk.pos.clone().add(new THREE.Vector3(-0.38, 0.766, -0.12)));
  collect(deskCandle);
  place(group, piece('decor', 'books'), L.desk.pos.clone().add(new THREE.Vector3(-0.2, 0.766, -0.14)), 0.3);
  // fireplace wall: marble fireplace, mirror above, clock and candelabras on the mantel
  o.fireplace = place(group, piece('decor', 'fireplace'), L.fireplace.pos, L.fireplace.rotY);
  o.mirror = place(group, piece('decor', 'mirror_frame'), L.fireplace.pos.clone().add(new THREE.Vector3(-0.02, 1.42, 0)), L.fireplace.rotY);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.42), new THREE.MeshBasicMaterial({ color: 0x9c8fb0 }));
  glass.material.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      vec2 q = gl_FragCoord.xy; gl_FragColor.rgb *= 0.85 + 0.15 * sin(q.x * 0.004 + q.y * 0.006);`);
  };
  {
    const gg = new THREE.Group();
    const g1 = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.42), toonMaterial({ color: new THREE.Color('#b3a7c4'), emissive: new THREE.Color('#3a2a3e') }, { rimScale: 0 }));
    g1.position.set(0, 0.79, 0.02); gg.add(g1);
    for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.05 + k * 0.02, 1.3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false })); s.position.set(-0.3 + k * 0.17, 0.79, 0.045); s.rotation.z = 0.35; gg.add(s); }
    place(o.mirror, gg, new THREE.Vector3(0, 0, 0));
  }
  const mantel = (dz) => L.fireplace.pos.clone().add(new THREE.Vector3(-0.22, 1.31, dz));
  o.clock = place(group, piece('decor', 'mantel_clock'), mantel(0), L.fireplace.rotY);
  for (const dz of [-0.82, 0.82]) collect(place(group, piece('decor', 'candelabra'), mantel(dz), L.fireplace.rotY));
  // sconces between the windows and on the side walls
  for (const x of [-1.8, 1.8]) collect(place(group, piece('decor', 'sconce'), new THREE.Vector3(x, 2.45, ROOM.z0 + 0.12), 0));
  for (const z of [-2.2, 1.2]) collect(place(group, piece('decor', 'sconce'), new THREE.Vector3(ROOM.x1 - 0.02, 2.5, z), -Math.PI / 2));
  for (const z of [4.4]) collect(place(group, piece('decor', 'sconce'), new THREE.Vector3(ROOM.x0 + 0.02, 2.5, z), Math.PI / 2));
  // curtains and valances on the three windows
  for (const win of WINDOWS) {
    // narrow panels gathered beside the opening, so the view stays clear; the swagged valance tops it all
    const cw = 0.55, edge = win.w / 2 + 0.12 + cw;
    const l = place(group, piece('decor', 'curtain', { outline: 0.0012 }), new THREE.Vector3(win.x - edge, 0, ROOM.z0 + 0.02), 0);
    l.scale.set(cw, 4.38 / 3.7, 1);   // tall enough to disappear behind the valance
    const r = place(group, piece('decor', 'curtain', { outline: 0.0012 }), new THREE.Vector3(win.x + edge, 0, ROOM.z0 + 0.02), 0);
    r.scale.set(-cw, 4.38 / 3.7, 1);
    const v = place(group, piece('decor', 'valance', { outline: 0.0012 }), new THREE.Vector3(win.x, 4.42, ROOM.z0 + 0.02), 0);
    v.scale.set(1.17, 0.9, 1);
  }
  // the rest of the room: settee, bust, roses, the painter's easel
  place(group, piece('decor', 'settee'), L.settee.pos, L.settee.rotY);
  place(group, piece('decor', 'bust'), L.bust.pos, L.bust.rotY);
  place(group, piece('decor', 'vase_roses'), mantel(-0.42), 0);
  place(group, piece('decor', 'vase_roses'), new THREE.Vector3(-5.2, 0, 3.9).add(new THREE.Vector3(0.5, 0, -0.6)), 0, 1.6).position.y = 0;
  o.easel = place(group, piece('decor', 'easel'), L.easel.pos, L.easel.rotY);
  garlands(group, L.portraits.zs, 3.55, ROOM.x0 + 0.06);

  // fire in the hearth: a few big flames + its own flickering light
  o.fireplace.updateMatrixWorld(true);
  const fa = o.fireplace.getObjectByName('fire_anchor').getWorldPosition(new THREE.Vector3());
  for (let i = 0; i < 7; i++) { flames.push(fa.clone().add(new THREE.Vector3(-0.05 + Math.random() * 0.1, 0, -0.35 + i * 0.11))); sizes.push(7 + Math.random() * 5); }

  // ── light: warm candle glow from above, a flickering hearth, cool twilight from the windows ──
  const hemi = new THREE.HemisphereLight(0xffe4c8, 0x4a2622, 0.95);
  const key = new THREE.DirectionalLight(0xffd6a2, 1.35);
  key.position.set(2.5, 9, 5); key.target.position.set(0, 0, 0);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 25 });
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
  const cool = new THREE.DirectionalLight(0x8f8cff, 0.35);
  cool.position.set(0, 4, -12);
  const chandelierLight = new THREE.PointLight(0xffb56e, 7, 11, 1.4);
  chandelierLight.position.set(TABLE.x, 3.7, TABLE.z);
  const fireLight = new THREE.PointLight(0xff8a3c, 3, 6, 1.6);
  fireLight.position.copy(fa).add(new THREE.Vector3(-0.8, 0.4, 0));
  scene.add(hemi, key, key.target, cool, chandelierLight, fireLight);

  const candles = new Flames(scene, flames, sizes);
  const dust = new GoldDust(scene, new THREE.Vector3(-5, 0.4, -4.5), new THREE.Vector3(10, 4, 9), 320);

  group.traverse((m) => { if (m.isMesh && !m.userData.isOutline && m.castShadow === undefined) m.castShadow = true; });
  const update = (t, renderer, camera) => {
    view.update(t);
    candles.update(t);
    dust.update(t, renderer, camera);
    fireLight.intensity = 2.6 + Math.sin(t * 7.3) * 0.35 + Math.sin(t * 13.1) * 0.25 + Math.sin(t * 3.1) * 0.3;
    chandelierLight.intensity = 7 + Math.sin(t * 5.7) * 0.15;
    // the clock keeps real time
    const d = new Date();
    if (o.clock.userData.hands === undefined) o.clock.userData.hands = { h: o.clock.getObjectByName('clock_hour'), m: o.clock.getObjectByName('clock_minute') };
    const { h, m } = o.clock.userData.hands;
    if (h && !o.clock.userData.spin) { h.rotation.z = -((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2; m.rotation.z = -(d.getMinutes() + d.getSeconds() / 60) / 60 * Math.PI * 2; }
  };
  return { group, o, sun: key, hemi, lights: { key, chandelierLight, fireLight }, view, candles, update, fireAnchor: fa };
}
