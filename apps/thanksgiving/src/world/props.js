import * as THREE from 'three';
import { assets } from '../core/assets.js';
import { toonMaterial, addOutline, outlineMaterial, hullGeometry } from '../style/toon.js';

// The Blender props (public/models/thanksgiving.glb): turned into toon materials once, then cloned where
// one is needed (piece) or drawn many times in one go (Instancer: one instanced mesh per part).

const GLOW = new Set(['M_flame', 'M_window_glow']);
const mats = new Map();
function convert(src) {
  if (mats.has(src)) return mats.get(src);
  let m;
  const name = src.name || '';
  if (GLOW.has(name)) m = new THREE.MeshBasicMaterial({ color: src.emissive?.clone().multiplyScalar(1.15) || src.color.clone(), toneMapped: false });
  else if (name === 'M_glass') m = toonMaterial({ color: new THREE.Color('#E8F0F4'), transparent: true, opacity: 0.32, depthWrite: false }, { rimScale: 2.2 });
  else m = toonMaterial({ color: src.color.clone(), emissive: src.emissive?.clone() || new THREE.Color(0, 0, 0), emissiveIntensity: src.emissiveIntensity ?? 1 }, { rimScale: name === 'M_silver' || name === 'M_brass' ? 1.8 : 1 });
  m.name = name;
  mats.set(src, m);
  return m;
}
/** Swap a material by name everywhere (e.g. the sofa's plaid gets its texture). */
export function propMaterial(name) { for (const m of mats.values()) if (m.name === name) return m; return null; }

let prepared = false;
export function prepareProps() {
  if (prepared) return;
  prepared = true;
  const root = assets.models.thanksgiving;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
  });
}

/** A fresh copy of one prop (its root's own transform reset), with ink outlines. */
export function piece(name, { outline = 0.0016, cast = false, skip = null } = {}) {
  prepareProps();
  const src = assets.models.thanksgiving.getObjectByName(name);
  if (!src) { console.warn('missing prop', name); return new THREE.Group(); }
  const c = src.clone(true);
  c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1);
  c.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = cast; o.receiveShadow = false;
    const glow = [].concat(o.material).every((m) => m.isMeshBasicMaterial || m.transparent);
    if (outline && !glow && !(skip && (skip.test(o.name) || skip.test(o.parent?.name || '')))) addOutline(o, outline);
  });
  return c;
}

/**
 * Many copies of one prop in one draw per part: each part of the prop becomes an instanced mesh (with its
 * own instanced outline); set(i, matrix) places copy i, commit(n) shows the first n.
 */
export class Instancer {
  constructor(scene, name, max, { outline = 0.0016, skip = /^(place_silver|place_glass|place_cider|ps_napkin)/ } = {}) {
    prepareProps();
    const src = assets.models.thanksgiving.getObjectByName(name);
    this.items = [];
    this.max = max;
    if (!src) { console.warn('missing prop', name); return; }
    const root = src.clone(true);
    root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mesh = new THREE.InstancedMesh(o.geometry, o.material, max);
      mesh.count = 0; mesh.frustumCulled = false; mesh.name = `inst-${name}-${o.name}`;
      const glow = [].concat(o.material).every((m) => m.isMeshBasicMaterial || m.transparent);
      let hull = null;
      if (outline && !glow && !skip.test(o.name)) {
        hull = new THREE.InstancedMesh(hullGeometry(o.geometry), outlineMaterial(outline), max);
        hull.instanceMatrix = mesh.instanceMatrix; hull.count = 0; hull.frustumCulled = false; hull.renderOrder = -1; hull.raycast = () => {};
        scene.add(hull);
      }
      scene.add(mesh);
      this.items.push({ mesh, hull, local: o.matrixWorld.clone() });
    });
    this._m = new THREE.Matrix4();
  }
  set(i, matrix) { for (const it of this.items) it.mesh.setMatrixAt(i, this._m.multiplyMatrices(matrix, it.local)); }
  commit(n) {
    // a sphere round every copy (plus the prop's own size), so off-screen copies are skipped as one
    const box = new THREE.Box3(), p = new THREE.Vector3();
    for (const it of this.items) for (let i = 0; i < n; i++) { it.mesh.getMatrixAt(i, this._m); box.expandByPoint(p.setFromMatrixPosition(this._m)); }
    const sphere = box.isEmpty() ? new THREE.Sphere(new THREE.Vector3(), 0.01) : box.getBoundingSphere(new THREE.Sphere());
    sphere.radius += 1.2;
    for (const it of this.items) {
      it.mesh.boundingSphere = sphere; it.mesh.frustumCulled = true;
      if (it.hull) { it.hull.boundingSphere = sphere; it.hull.frustumCulled = true; }
      it.mesh.count = n; it.mesh.visible = n > 0; it.mesh.instanceMatrix.needsUpdate = true;
      if (it.hull) { it.hull.count = n; it.hull.visible = n > 0; }
    }
  }
  get meshes() { return this.items.map((i) => i.mesh); }

  /** Outlines only on the copies near the camera (copies are laid out front to back, so the near ones come first). */
  outlineNear(eye, range) {
    const n = this.items[0]?.mesh.count || 0; if (!n) return;
    let k = 0;
    const p = new THREE.Vector3(), r2 = range * range;
    for (; k < n; k++) { this.items[0].mesh.getMatrixAt(k, this._m); if (p.setFromMatrixPosition(this._m).distanceToSquared(eye) > r2) break; }
    for (const it of this.items) if (it.hull) { it.hull.count = k; it.hull.visible = k > 0; }
  }
}

const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
/** A placement matrix: position, a turn about the vertical, a uniform scale. */
export function place(x, y, z, yaw = 0, s = 1, out = new THREE.Matrix4()) {
  return out.compose(_p.set(x, y, z), _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw), _s.set(s, s, s));
}
