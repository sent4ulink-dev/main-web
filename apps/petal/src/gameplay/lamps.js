import * as THREE from "three";
import { environment } from "../core/uniforms.js";

// Lanterns. Every glowing lantern in the island model shares one "lamp-glow"
// mesh; its vertices are grouped into individual lanterns (flood fill over a
// 0.35 m grid). They are all lit, each with a soft additive halo that grows
// after dark.

export function createLamps({ scene, world }) {
  const lamps = [];
  world.traverse((object) => {
    if (!object.isMesh || object.material?.name !== "lamp-glow") return;
    const position = object.geometry.attributes.position;
    const color = object.geometry.attributes.color;
    if (!color) return;
    object.updateMatrixWorld(true);
    const points = [];
    const v = new THREE.Vector3();
    const cells = new Map();
    const cellKey = (x, y, z) => `${x},${y},${z}`;
    for (let i = 0; i < position.count; i += 1) {
      v.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      points.push(v.clone());
      const k = cellKey(Math.floor(v.x / 0.35), Math.floor(v.y / 0.35), Math.floor(v.z / 0.35));
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(i);
    }
    const owner = new Int32Array(position.count).fill(-1);
    const clusters = [];
    for (let start = 0; start < position.count; start += 1) {
      if (owner[start] >= 0) continue;
      const cluster = { indices: [], sum: new THREE.Vector3() };
      const id = clusters.length;
      clusters.push(cluster);
      const queue = [start];
      owner[start] = id;
      while (queue.length) {
        const i = queue.pop();
        cluster.indices.push(i);
        cluster.sum.add(points[i]);
        const p = points[i];
        const cx = Math.floor(p.x / 0.35);
        const cy = Math.floor(p.y / 0.35);
        const cz = Math.floor(p.z / 0.35);
        for (let dx = -1; dx <= 1; dx += 1) {
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dz = -1; dz <= 1; dz += 1) {
              for (const j of cells.get(cellKey(cx + dx, cy + dy, cz + dz)) || []) {
                if (owner[j] < 0 && points[j].distanceToSquared(p) < 0.35 * 0.35) {
                  owner[j] = id;
                  queue.push(j);
                }
              }
            }
          }
        }
      }
    }
    const original = Float32Array.from(color.array);
    for (const cluster of clusters) {
      lamps.push({ color, original, indices: cluster.indices, pos: cluster.sum.divideScalar(cluster.indices.length), id: lamps.length });
    }
  });

  // Halos: one additive point per lit lantern.
  const halos = new THREE.BufferGeometry();
  const haloPositions = new Float32Array(Math.max(1, lamps.length) * 3).fill(-999);
  halos.setAttribute("position", new THREE.BufferAttribute(haloPositions, 3));
  const haloCanvas = document.createElement("canvas");
  haloCanvas.width = haloCanvas.height = 64;
  {
    const g = haloCanvas.getContext("2d");
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,226,160,0.9)");
    gradient.addColorStop(0.35, "rgba(255,196,120,0.35)");
    gradient.addColorStop(1, "rgba(255,190,120,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);
  }
  const haloTexture = new THREE.CanvasTexture(haloCanvas);
  const haloMaterial = new THREE.PointsMaterial({ map: haloTexture, size: 1.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const haloPoints = new THREE.Points(halos, haloMaterial);
  haloPoints.frustumCulled = false;
  scene.add(haloPoints);

  lamps.forEach((lamp) => haloPositions.set([lamp.pos.x, lamp.pos.y, lamp.pos.z], lamp.id * 3));
  halos.attributes.position.needsUpdate = true;

  return {
    list: lamps,
    get total() { return lamps.length; },
    update(time) {
      haloMaterial.size = (1.3 + Math.sin(time * 2.3) * 0.08) * (1 + environment.uNight.value * 0.7);
    },
    dispose() {
      scene.remove(haloPoints);
      halos.dispose();
      haloMaterial.dispose();
      haloTexture.dispose();
    },
  };
}
