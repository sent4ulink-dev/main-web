import * as THREE from 'three';
import { assets, cloneModel, findNode } from '../core/assets.js';
import { patchWind } from './wind.js';
import { heightAt, noise2 } from './terrain.js';
import { TOP, TABLE_TOP_Y, TABLE, STUMP, POSTS, ON_TABLE, DECOR } from './layout.js';
import { toonify, toonMaterial, addOutline } from '../style/toon.js';
import { ginghamTexture } from '../util/textures.js';

/**
 * Tablecloth draped over the table top: flat on top, falling over the edges with soft folds
 * and pointed corners. Storybook red gingham; the hanging hem sways in the wind.
 */
function createTablecloth() {
  const hang = 0.34;
  const W = TABLE.halfX * 2 + hang * 2, D = TABLE.halfZ * 2 + hang * 2;
  const geo = new THREE.PlaneGeometry(W, D, 70, 160);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const hx = TABLE.halfX + 0.012, hz = TABLE.halfZ + 0.012;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const ox = Math.max(Math.abs(x) - hx, 0), oz = Math.max(Math.abs(z) - hz, 0);
    const out = Math.hypot(ox, oz);
    let nx = x, nz = z, y = TOP;
    if (out > 0) {
      const ex = Math.sign(x) * Math.min(Math.abs(x), hx), ez = Math.sign(z) * Math.min(Math.abs(z), hz);
      const dirx = ox / out * Math.sign(x), dirz = oz / out * Math.sign(z);
      const round = 0.03;
      const fall = Math.max(out - round, 0);
      const along = (ox > 0 ? z : x) * 9.0;
      const fold = (Math.sin(along) * 0.5 + Math.sin(along * 2.3 + 1.7) * 0.25 + (noise2(along * 0.3, 3.1) - 0.5) * 0.8) * 0.02 * Math.min(fall / 0.2, 1);
      const flare = fall * 0.06;
      nx = ex + dirx * (Math.min(out, round) + flare + fold);
      nz = ez + dirz * (Math.min(out, round) + flare + fold);
      y = TOP - (out < round ? out * out / round * 0.6 : round * 0.6 + fall);
    }
    p.setXYZ(i, nx, y, nz);
  }
  geo.computeVertexNormals();
  const tex = ginghamTexture('#d8343c', 512, 8);
  tex.repeat.set(W / 0.24, D / 0.24);
  const mat = toonMaterial({ map: tex, side: THREE.DoubleSide }, { rimScale: 0.6 });
  patchWind(mat, { mode: 'hang', height: TABLE_TOP_Y - 0.02, radius: 0.35, amount: 0.07, flutter: 0.35, phaseScale: 4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'tablecloth';
  return mesh;
}

/** Pull a named object out of the Blender food set, re-centred on its own footprint. */
export function foodPiece(name, { ground = true } = {}) {
  const src = findNode(assets.models.food, name);
  if (!src) { console.warn('missing food piece', name); return new THREE.Group(); }
  const c = src.clone(true);
  c.position.set(0, 0, 0);
  c.rotation.set(0, 0, 0);
  const g = new THREE.Group();
  g.name = name;
  g.add(c);
  if (ground) {
    const b = new THREE.Box3().setFromObject(c);
    c.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  }
  const isGlass = name === 'glass' || name === 'glass_wine';
  toonify(g, { outline: !isGlass, width: 0.0022, cast: !isGlass });
  if (isGlass) g.traverse((o) => { if (o.isMesh && name === 'glass') { o.material.transparent = true; o.material.opacity = 0.16; o.material.depthWrite = false; o.material.color.set('#dff1ff'); o.material.userData.rimScale.value = 3.5; o.renderOrder = 3; } });
  return g;
}

function createPost(post) {
  const geo = new THREE.CylinderGeometry(0.045, 0.06, post.h, 12, 4);
  geo.translate(0, post.h / 2, 0);
  const m = new THREE.Mesh(geo, toonMaterial({ color: new THREE.Color('#7b5236') }));
  m.position.set(post.x, heightAt(post.x, post.z) - 0.05, post.z);
  m.castShadow = true; m.receiveShadow = true;
  addOutline(m, 0.0025);
  return m;
}

export function createPicnic(scene) {
  const group = new THREE.Group();
  group.name = 'picnic';
  scene.add(group);
  const anchors = {};

  // table + cloth (Poly Haven table, toon shaded, ink outlined)
  const table = cloneModel('wooden_picnic_table');
  toonify(table, { outline: true, width: 0.0018, tint: new THREE.Color(1.15, 0.95, 0.82) });
  group.add(table);
  group.add(createTablecloth());

  // food, presents and decorations from the Blender set
  for (const [name, x, z, yaw, s] of DECOR) {
    const piece = foodPiece(name, { ground: name !== 'glass_wine' });
    piece.position.set(x, TOP + (name === 'fork' || name === 'knife' ? 0.004 : 0), z);
    piece.rotation.y = yaw;
    piece.scale.setScalar(s);
    group.add(piece);
  }

  for (const [k, [x, z, yaw]] of Object.entries(ON_TABLE)) {
    anchors[k] = { position: new THREE.Vector3(x, TOP, z), yaw, parent: group };
  }

  // tree stump at the front-left of the clearing
  const stump = cloneModel('tree_stump_01');
  toonify(stump, { outline: true, width: 0.002, tint: new THREE.Color(1.05, 0.88, 0.72) });
  stump.position.set(STUMP.x, heightAt(STUMP.x, STUMP.z) - 0.02, STUMP.z);
  stump.rotation.y = 0.7;
  group.add(stump);

  for (const p of POSTS) group.add(createPost(p));

  return { group, anchors, table };
}
