import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const BASE = import.meta.env.BASE_URL;
export const url = (p) => `${BASE}${p}`;

export const manager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);

export const assets = { models: {}, textures: {} };

// all made in Blender for this project (art/blender/scripts/courtyard_props.py, tactical_props.py)
export const MODEL_LIST = ['courtyard', 'tactical'];

export async function loadAll(onProgress) {
  manager.onProgress = (_u, loaded, total) => onProgress?.(loaded / total);
  const jobs = [];
  for (const name of MODEL_LIST) {
    jobs.push(gltfLoader.loadAsync(url(`models/${name}.glb`)).then((g) => { assets.models[name] = g.scene; }).catch((e) => console.warn('model failed', name, e)));
  }
  await Promise.all(jobs);
  // Any material with transmission makes three.js render the whole scene a second time every frame.
  // Small glass parts (camera lens, lantern glass) look the same as cheap transparent glass.
  for (const root of Object.values(assets.models)) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.transmission > 0) {
          m.transmission = 0;
          m.transparent = true;
          m.opacity = Math.min(m.opacity, 0.35);
          m.depthWrite = false;
          m.roughness = Math.min(m.roughness, 0.1);
        }
      }
    });
  }
  return assets;
}

/** Find a named node in a loaded model (exact name or prefix). */
export function findNode(root, name) {
  let hit = null;
  root.traverse((o) => { if (!hit && (o.name === name || o.name.startsWith(name))) hit = o; });
  return hit;
}

/** Clone a model and enable shadows on its meshes. */
export function cloneModel(name, { cast = true, receive = true } = {}) {
  const src = assets.models[name];
  if (!src) return new THREE.Group();
  const c = src.clone(true);
  c.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return c;
}
