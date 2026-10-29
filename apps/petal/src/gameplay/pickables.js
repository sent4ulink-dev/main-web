import * as THREE from "three";

// Flowers and carrots you can pick. They are instances in the island model
// (recognised by their triangle counts); picking plays a gesture, and at the
// grab moment the flower (or the loosened carrot) rises from the ground into
// the bunny's paw.

const TRI = { flower: 23, tall: 25, carrot: 16 };

export function createPickables({ world, walker, fx, sfx, onCollect = () => {} }) {
  const matrix = new THREE.Matrix4();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const items = [];
  world.traverse((object) => {
    if (!object.isInstancedMesh) return;
    const tris = (object.geometry.index ? object.geometry.index.count : object.geometry.attributes.position.count) / 3;
    const kind = tris === TRI.carrot ? "carrot" : tris === TRI.flower || tris === TRI.tall ? "flower" : null;
    if (!kind) return;
    object.updateMatrixWorld(true);
    for (let i = 0; i < object.count; i += 1) {
      object.getMatrixAt(i, matrix);
      const pos = new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(object.matrixWorld);
      items.push({ mesh: object, index: i, pos, kind, picked: false });
    }
  });
  const grid = new Map();
  const key = (x, z) => `${Math.floor(x)},${Math.floor(z)}`;
  for (const item of items) {
    const k = key(item.pos.x, item.pos.z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(item);
  }

  const tmp = new THREE.Vector3();
  function nearest(position, reach = 0.7) {
    let best = null;
    let bestD = reach;
    const ahead = tmp.copy(walker.forward).multiplyScalar(0.25).add(position);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        for (const item of grid.get(key(ahead.x + dx, ahead.z + dz)) || []) {
          if (item.picked || Math.abs(item.pos.y - position.y) > 0.6) continue;
          const d = Math.hypot(item.pos.x - ahead.x, item.pos.z - ahead.z);
          if (d < bestD) {
            bestD = d;
            best = item;
          }
        }
      }
    }
    return best;
  }

  const moving = []; // { item, base, phase: "wait" | "tug" | "lift", t }
  function pick(item) {
    if (item.picked || walker.busy) return false;
    const carrot = item.kind === "carrot";
    const base = new THREE.Matrix4();
    item.mesh.getMatrixAt(item.index, base);
    const entry = { item, base, phase: carrot ? "tug" : "wait", t: 0 };
    const started = walker.perform(carrot ? "pull" : "pick", {
      duration: carrot ? 1.5 : 1.1,
      mid: carrot ? 0.78 : 0.42,
      face: item.pos,
      onMid: () => {
        entry.phase = "lift";
        entry.t = 0;
        sfx.pop();
        if (carrot) fx.sparkle(item.pos.clone().add(new THREE.Vector3(0, 0.1, 0)), 10, "#c9a27a");
      },
    });
    if (!started) return false;
    item.picked = true;
    moving.push(entry);
    return true;
  }

  const worldMatrix = new THREE.Matrix4();
  const localMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const wobble = new THREE.Quaternion();
  const euler = new THREE.Euler();
  function update(dt) {
    for (let i = moving.length - 1; i >= 0; i -= 1) {
      const entry = moving[i];
      const { item, base } = entry;
      entry.t += dt;
      const mesh = item.mesh;
      worldMatrix.multiplyMatrices(mesh.matrixWorld, base);
      worldMatrix.decompose(position, rotation, scale);
      if (entry.phase === "tug") {
        // The carrot wiggles and loosens while she tugs.
        const loosen = Math.min(1, entry.t / 1.1);
        position.y += loosen * 0.05 + Math.abs(Math.sin(entry.t * 14)) * 0.015;
        rotation.multiply(wobble.setFromEuler(euler.set(Math.sin(entry.t * 22) * 0.2 * loosen, 0, Math.cos(entry.t * 19) * 0.2 * loosen)));
      } else if (entry.phase === "lift") {
        const k = Math.min(1, entry.t / 0.38);
        const e = k * k * (3 - 2 * k);
        walker.handWorld(item.kind === "carrot" ? 0 : 1, hand);
        position.lerpVectors(item.pos, hand, e);
        position.y += Math.sin(Math.PI * e) * (item.kind === "carrot" ? 0.25 : 0.1);
        scale.multiplyScalar(1 - 0.35 * e);
        if (k >= 1) {
          mesh.setMatrixAt(item.index, zero);
          mesh.instanceMatrix.needsUpdate = true;
          moving.splice(i, 1);
          fx.sparkle(walker.handWorld(item.kind === "carrot" ? 0 : 1, hand).clone(), 8, item.kind === "carrot" ? "#ffb070" : "#ffd3e4");
          walker.cheer();
          onCollect(item);
          continue;
        }
      } else continue; // waiting for the paw to reach down
      worldMatrix.compose(position, rotation, scale);
      localMatrix.copy(mesh.matrixWorld).invert().multiply(worldMatrix);
      mesh.setMatrixAt(item.index, localMatrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  return { nearest, pick, update, get total() { return items.length; } };
}
