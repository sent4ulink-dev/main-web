import * as THREE from 'three';
import { assets, findNode } from '../core/assets.js';
import { toonMaterial } from '../style/toon.js';
import { patchWind } from './wind.js';
import { heightAt, rng, noise2 } from './terrain.js';

/** Meshes of a Blender-made model (a node may hold several primitives/materials). */
function partsOf(name) {
  const node = findNode(assets.models.nature, name);
  const parts = [];
  if (!node) return parts;
  // keep each mesh's full transform (it carries the glTF dequantisation scale), then move the
  // model so it stands on the origin
  assets.models.nature.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(node);
  const recentre = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  node.traverse((o) => {
    if (!o.isMesh) return;
    const local = new THREE.Matrix4().multiplyMatrices(recentre, o.matrixWorld);
    parts.push({ geometry: o.geometry, color: o.material.color.clone(), local, matName: o.material.name });
  });
  return parts;
}

const matCache = new Map();
function toonFor(color, key, windOpts) {
  const k = `${key}-${color.getHexString()}`;
  if (!matCache.has(k)) {
    const m = toonMaterial({ color }, { rimScale: 0.5 });
    if (windOpts) patchWind(m, windOpts);
    matCache.set(k, m);
  }
  return matCache.get(k);
}

function instanced(scene, name, transforms, { cast = false, wind = null } = {}) {
  const out = [];
  for (const part of partsOf(name)) {
    const isFoliage = !/bark/i.test(part.matName);
    const im = new THREE.InstancedMesh(part.geometry, toonFor(part.color, name + part.matName, isFoliage ? wind : null), transforms.length);
    transforms.forEach((m, i) => im.setMatrixAt(i, m.clone().multiply(part.local)));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = cast; im.receiveShadow = true;
    im.name = name;
    scene.add(im);
    out.push(im);
  }
  return out;
}

export function createForest(scene, { exclude }) {
  const rand = rng(77);
  const d = new THREE.Object3D();
  const place = (x, z, s, yaw) => {
    d.position.set(x, heightAt(x, z) - 0.05, z);
    d.rotation.set(0, yaw, 0);
    d.scale.setScalar(s);
    d.updateMatrix();
    return d.matrix.clone();
  };
  const sets = { pine_a: [], pine_b: [], pine_c: [], broadleaf_a: [], broadleaf_b: [], broadleaf_c: [], bush_a: [], bush_b: [] };
  // forest ring: conifers on the left (+Z), broadleaf on the right (-Z); denser behind the table (-X)
  for (let i = 0; i < 150; i++) {
    const a = rand() * Math.PI * 2;
    const behind = Math.cos(a) < 0.2;
    if (!behind && rand() < 0.55) continue;
    const r = (behind ? 24 : 30) + rand() * 34;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const leftSide = z > -4 + (rand() - 0.5) * 10;
    const pick = leftSide ? ['pine_a', 'pine_b', 'pine_c'][Math.floor(rand() * 3)] : ['broadleaf_a', 'broadleaf_b', 'broadleaf_c'][Math.floor(rand() * 3)];
    sets[pick].push(place(x, z, 0.95 + rand() * 0.75, rand() * Math.PI * 2));
  }
  // bushes along the forest edge
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2;
    if (Math.cos(a) > 0.5 && rand() < 0.7) continue;
    const r = 13 + rand() * 11;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    sets[rand() < 0.5 ? 'bush_a' : 'bush_b'].push(place(x, z, 0.9 + rand() * 0.9, rand() * 6));
  }
  const treeWind = { mode: 'plant', height: 8, power: 1.5, amount: 0.06, flutter: 0.05, phaseScale: 3 };
  const meshes = [];
  for (const [name, list] of Object.entries(sets)) {
    if (list.length) meshes.push(...instanced(scene, name, list, { wind: name.startsWith('bush') ? { ...treeWind, height: 1, amount: 0.05 } : treeWind }));
  }

  // little storybook flowers in the grass (pink, purple, white, yellow)
  const petal = new THREE.CircleGeometry(0.03, 10);
  const pos = petal.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const a = Math.atan2(y, x), r = Math.hypot(x, y);
    const k = 0.62 + 0.38 * Math.abs(Math.cos(a * 2.5));
    pos.setXY(i, Math.cos(a) * r * k, Math.sin(a) * r * k);
  }
  petal.rotateX(-Math.PI / 2);
  const stem = new THREE.CylinderGeometry(0.0025, 0.003, 1, 4);
  stem.translate(0, 0.5, 0);
  const centre = new THREE.SphereGeometry(0.009, 8, 6);
  const N = 520;
  const flowerT = [], stemT = [], colors = [];
  const pal = ['#ff8fb7', '#f06aa0', '#b98cf2', '#ffffff', '#ffd86b', '#ff9fd0'].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    let x, z, tries = 0;
    do {
      const a = rand() * Math.PI * 2, r = 2.2 + Math.sqrt(rand()) * 17;
      x = Math.cos(a) * r; z = Math.sin(a) * r; tries++;
    } while ((exclude(x, z, 0.2) < 0.5 || noise2(x * 0.3 + 5, z * 0.3) < 0.35) && tries < 8);
    const h = 0.12 + rand() * 0.22;
    const y = heightAt(x, z);
    d.position.set(x, y, z); d.rotation.set(0, 0, 0); d.scale.set(1, h, 1); d.updateMatrix(); stemT.push(d.matrix.clone());
    d.position.set(x, y + h, z); d.rotation.set((rand() - 0.5) * 0.5, rand() * 6, (rand() - 0.5) * 0.5); d.scale.setScalar(0.8 + rand() * 0.6); d.updateMatrix(); flowerT.push(d.matrix.clone());
    colors.push(pal[Math.floor(rand() * pal.length)]);
  }
  const fWind = { mode: 'plant', height: 0.3, power: 1.2, amount: 0.12, flutter: 0.25, phaseScale: 0 };
  const headWind = { mode: 'rigid', amount: 0.09, flutter: 0.25, phaseScale: 0 };
  const petals = new THREE.InstancedMesh(petal, toonFor(new THREE.Color(1, 1, 1), 'petal', headWind), N);
  const stems = new THREE.InstancedMesh(stem, toonFor(new THREE.Color('#3f7a2c'), 'stem', fWind), N);
  const centres = new THREE.InstancedMesh(centre, toonFor(new THREE.Color('#ffcf4a'), 'centre', headWind), N);
  flowerT.forEach((m, i) => { petals.setMatrixAt(i, m); centres.setMatrixAt(i, m); petals.setColorAt(i, colors[i]); });
  stemT.forEach((m, i) => stems.setMatrixAt(i, m));
  for (const im of [petals, stems, centres]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.receiveShadow = true; scene.add(im); meshes.push(im); }
  petals.material.side = THREE.DoubleSide;
  return { meshes };
}
