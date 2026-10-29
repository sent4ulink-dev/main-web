import * as THREE from 'three';
import { assets } from '../core/assets.js';
import { patchWind, windDepthMaterial } from './wind.js';
import { heightAt } from './terrain.js';
import { toonMaterial } from '../style/toon.js';
import { TREE } from './layout.js';

/** The big tree behind the table: Poly Haven tree (thinned in Blender), toon-shaded storybook greens. */
export function createFlora(scene) {
  const tree = assets.models.tree_hero.clone(true);
  tree.scale.setScalar(2.05);
  tree.position.set(TREE.x, heightAt(TREE.x, TREE.z) - 0.03, TREE.z);
  tree.rotation.y = 1.15;
  const made = new Map();
  tree.traverse((o) => {
    if (!o.isMesh) return;
    const isLeaf = o.name.includes('leaves');
    const isTwig = o.name.includes('branches');
    const src = o.material;
    let m = made.get(src);
    if (!m) {
      m = toonMaterial({
        map: src.map,
        color: isLeaf ? new THREE.Color(1.15, 1.5, 0.72) : new THREE.Color(0.95, 0.72, 0.55),
        alphaTest: isLeaf ? 0.45 : 0,
        side: isLeaf ? THREE.DoubleSide : THREE.FrontSide,
      }, { rimScale: isLeaf ? 0.8 : 0.4 });
      if (isLeaf) m.alphaToCoverage = true;
      const windOpts = isLeaf
        ? { mode: 'tree', height: 3.4, power: 1.5, amount: 0.16, radius: 2.2, flutter: 0.32, phaseScale: 9 }
        : { mode: 'tree', height: 3.4, power: 1.8, amount: isTwig ? 0.12 : 0.05, radius: 2.2, flutter: 0, phaseScale: 1 };
      patchWind(m, windOpts);
      m.userData.windOpts = windOpts;
      made.set(src, m);
    }
    o.material = m;
    o.castShadow = true;
    o.receiveShadow = true;
    o.customDepthMaterial = windDepthMaterial(m, m.userData.windOpts);
  });
  scene.add(tree);
  return { tree, meshes: [] };
}
