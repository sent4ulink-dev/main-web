import * as THREE from 'three';
import { heightAt, fbm, noise2 } from './terrain.js';
import { toonMaterial } from '../style/toon.js';

/** Storybook meadow floor: painted colour patches (vertex colours), toon-shaded, fading into the haze. */
export function createGround(scene) {
  const size = 560, seg = 220;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Color('#3f7a2a'), b = new THREE.Color('#5c9a36'), c = new THREE.Color('#2f5e26');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const n = fbm(x * 0.06 + 3, z * 0.06 - 2, 3), m = noise2(x * 0.4, z * 0.4);
    tmp.copy(a).lerp(b, THREE.MathUtils.smoothstep(n, 0.4, 0.7)).lerp(c, THREE.MathUtils.smoothstep(m, 0.7, 0.95) * 0.5);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = toonMaterial({ color: 0xffffff, vertexColors: true }, { rimScale: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  scene.add(mesh);
  return mesh;
}
