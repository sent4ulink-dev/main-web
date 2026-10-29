import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { colored } from "../core/geometry.js";

// The Lantern Grove swing. Its posts are solid; sitting on it starts a gentle
// swing that the seat (and the bunny on it) follows. With someone pushing
// (gameplay/couple.js) it swings higher. The seat hangs low, a bunny's knee
// above the grass, so whoever pushes can reach it: at the back of a pushed
// swing it is at paw height.

export const SWING_RATE = 2.1; // the swing's angle is sin(time * this) * its reach; at +1 the seat is furthest back
const BAR = 2.14; // the bar the ropes hang from, above the ground
const ROPE = 1.78; // from the bar down to the seat
export const SWING_REACH = { alone: 0.42, pushed: 0.5 }; // how far it swings (radians)
// How far behind the frame the seat comes at the back of a pushed swing.
export const SWING_BACK = ROPE * Math.sin(SWING_REACH.pushed);

export function createSwing({ scene, walker, data, sfx }) {
  const base = new THREE.Vector3(...data.pos);
  const wood = "#9a6a4a";
  const frameGeometry = mergeGeometries([
    colored(new THREE.BoxGeometry(0.1, 2.2, 0.1).rotateZ(0.12).translate(-0.72, 1.08, 0), wood),
    colored(new THREE.BoxGeometry(0.1, 2.2, 0.1).rotateZ(-0.12).translate(0.72, 1.08, 0), wood),
    colored(new THREE.BoxGeometry(1.7, 0.12, 0.12).translate(0, 2.18, 0), "#c9925f"),
  ]);
  const seatGeometry = mergeGeometries([
    colored(new THREE.BoxGeometry(0.03, ROPE, 0.03).translate(-0.3, -ROPE / 2, 0), "#f3e3c8"),
    colored(new THREE.BoxGeometry(0.03, ROPE, 0.03).translate(0.3, -ROPE / 2, 0), "#f3e3c8"),
    colored(new THREE.BoxGeometry(0.72, 0.06, 0.32).translate(0, -ROPE - 0.03, 0), "#e98fae"),
  ]);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const frame = new THREE.Mesh(frameGeometry, material);
  frame.position.copy(base);
  frame.rotation.y = data.yaw;
  const pivot = new THREE.Group();
  pivot.position.set(0, BAR, 0);
  pivot.add(new THREE.Mesh(seatGeometry, material));
  frame.add(pivot);
  scene.add(frame);
  const colliders = [-1, 1].map((side) => {
    const along = new THREE.Vector3(side * 0.72, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), data.yaw);
    return walker.addCollider({ type: "circle", x: base.x + along.x, z: base.z + along.z, radius: 0.09 }, base.y + 2.2);
  });

  let angle = 0;
  let amp = 0;
  let occupied = false;
  let pushed = false;
  const seat = new THREE.Vector3();
  const xAxis = new THREE.Vector3(1, 0, 0);
  return {
    base,
    get occupied() { return occupied; },
    set occupied(on) { occupied = on; },
    // Someone stands behind and pushes.
    get pushed() { return pushed; },
    set pushed(on) { pushed = on; },
    yaw: data.yaw,
    get reach() { return amp; },
    // A dynamic seat for walker.sit().
    spot() {
      return {
        pos: [base.x, base.y + BAR - ROPE + 0.03, base.z],
        yaw: data.yaw,
        swing: true,
        edge: 0.15, // the seat's front edge, for the skirt
        swingAngle: () => angle,
        dynamic: () => {
          seat.set(0, -ROPE, 0).applyAxisAngle(xAxis, angle).add(pivot.position).applyMatrix4(frame.matrixWorld);
          return { pos: seat.add(new THREE.Vector3(0, 0.03, 0)), yaw: data.yaw };
        },
      };
    },
    update(time, dt) {
      amp = THREE.MathUtils.damp(amp, occupied && walker.sitting?.swing ? (pushed ? SWING_REACH.pushed : SWING_REACH.alone) : 0, 1.2, dt);
      const previous = angle;
      angle = Math.sin(time * SWING_RATE) * amp;
      pivot.rotation.x = angle;
      frame.updateMatrixWorld(true);
      if (amp > 0.2 && Math.sign(previous) !== Math.sign(angle)) sfx.swing();
    },
    dispose() {
      colliders.forEach((id) => walker.removeCollider(id));
      scene.remove(frame);
      frameGeometry.dispose();
      seatGeometry.dispose();
      material.dispose();
    },
  };
}
