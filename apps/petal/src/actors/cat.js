import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// An articulated tabby cat that naps on a bench. Pet her and she wakes,
// stretches, sits up facing you, rubs her head against your paw and purrs,
// then curls back up to sleep. Poses blend smoothly from a few weights.

const ORANGE = new THREE.Color("#f4a95e");
const STRIPE = new THREE.Color("#d9803f");
const CREAM = new THREE.Color("#fff1dc");
const PINK = new THREE.Color("#ff9fb3");
const INK = new THREE.Color("#3a2630");

function painted(geometry, fn) {
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    c.copy(fn(v));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.deleteAttribute("uv");
  return geometry;
}
function ball(r, [sx, sy, sz], [x, y, z], fn, detail = 16) {
  const g = new THREE.SphereGeometry(r, detail, Math.round(detail * 0.75));
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return painted(g, typeof fn === "function" ? fn : () => fn);
}
// Tabby stripes that wrap around the body.
const tabby = (axis = "z", freq = 60) => (v) => {
  const s = Math.sin(v[axis] * freq + Math.sin(v.y * 30) * 0.8);
  return s > 0.45 ? STRIPE : ORANGE;
};

export function createCat(scene, { position, heading = 0 }) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const root = new THREE.Group();
  root.name = "Sleepy cat";
  root.position.copy(position);
  root.rotation.y = heading;
  scene.add(root);

  // Body pivots at the hips so it can sit up or bow into a stretch.
  const hips = new THREE.Group();
  hips.position.set(0, 0.07, -0.08);
  root.add(hips);
  const body = new THREE.Mesh(mergeGeometries([
    ball(0.1, [0.85, 0.78, 1.35], [0, 0.03, 0.09], (v) => (v.y < -0.02 && v.z > 0.05 ? CREAM : tabby("z", 55)(v))),
    ball(0.06, [1, 0.9, 1], [0, 0.0, 0.18], CREAM),
  ]), material);
  hips.add(body);

  // Head on a neck pivot at the front of the body.
  const neck = new THREE.Group();
  neck.position.set(0, 0.08, 0.2);
  hips.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 0.06, 0.03);
  neck.add(head);
  const ear = (side) => {
    const g = new THREE.ConeGeometry(0.03, 0.055, 4);
    g.rotateZ(-side * 0.25);
    g.translate(side * 0.045, 0.065, -0.005);
    return painted(g, (v) => (v.z > 0.005 ? PINK : ORANGE));
  };
  head.add(new THREE.Mesh(mergeGeometries([
    ball(0.075, [1.12, 0.95, 1], [0, 0, 0], tabby("x", 70)),
    ball(0.035, [1.2, 0.8, 0.9], [0, -0.022, 0.058], CREAM), // muzzle
    ball(0.012, [1.2, 0.8, 0.8], [0, -0.008, 0.088], PINK), // nose
    ball(0.02, [1.2, 0.7, 0.5], [-0.045, -0.02, 0.058], new THREE.Color("#ffb7c5")), // blush
    ball(0.02, [1.2, 0.7, 0.5], [0.045, -0.02, 0.058], new THREE.Color("#ffb7c5")),
    ear(-1),
    ear(1),
  ]), material));
  const eyesOpen = new THREE.Mesh(mergeGeometries([
    ball(0.014, [0.9, 1.25, 0.5], [-0.03, 0.008, 0.068], INK, 10),
    ball(0.014, [0.9, 1.25, 0.5], [0.03, 0.008, 0.068], INK, 10),
    ball(0.005, [1, 1, 0.5], [-0.026, 0.014, 0.075], new THREE.Color("#ffffff"), 6),
    ball(0.005, [1, 1, 0.5], [0.034, 0.014, 0.075], new THREE.Color("#ffffff"), 6),
  ]), material);
  const closedArc = (x) => {
    const g = new THREE.TorusGeometry(0.012, 0.0035, 5, 10, Math.PI);
    g.translate(x, 0.004, 0.071);
    return painted(g, () => INK);
  };
  const eyesClosed = new THREE.Mesh(mergeGeometries([closedArc(-0.03), closedArc(0.03)]), material);
  head.add(eyesOpen, eyesClosed);

  // Legs: front legs hang from the chest, back legs from the hips.
  const legGeo = mergeGeometries([
    painted(new THREE.CylinderGeometry(0.022, 0.02, 0.075, 8).translate(0, -0.037, 0), () => ORANGE),
    ball(0.026, [1, 0.7, 1.3], [0, -0.075, 0.01], CREAM, 8),
  ]);
  const legs = [[-0.05, 0.02, 0.17, "front"], [0.05, 0.02, 0.17, "front"], [-0.055, 0.0, 0.0, "back"], [0.055, 0.0, 0.0, "back"]]
    .map(([x, y, z, kind]) => {
      const leg = new THREE.Mesh(legGeo, material);
      leg.position.set(x, y, z);
      hips.add(leg);
      return { leg, kind };
    });

  // Tail: a chain of segments that can wrap around or swish.
  const tail = [];
  let parent = hips;
  for (let i = 0; i < 7; i += 1) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? 0.03 : 0, i === 0 ? -0.08 : -0.035);
    const r = 0.024 - i * 0.0018;
    seg.add(new THREE.Mesh(ball(r, [1, 1, 1.5], [0, 0, -0.018], i === 6 ? CREAM : i % 2 ? STRIPE : ORANGE, 8), material));
    parent.add(seg);
    tail.push(seg);
    parent = seg;
  }

  // Pose weights, blended every frame.
  const w = { curl: 1, sit: 0, stretch: 0, rub: 0 };
  let state = "sleep";
  let stateT = 0;
  let petT = 0;
  let turn = 0;
  const target = new THREE.Vector3();

  function setState(next) {
    state = next;
    stateT = 0;
  }

  return {
    position: root.position,
    get awake() { return state !== "sleep"; },
    // Called when the bunny pets her.
    pet(from) {
      target.copy(from);
      petT = 2.6;
      if (state === "sleep" || state === "lie") setState("wake");
      else setState("rub");
    },
    update(time, dt, near) {
      stateT += dt;
      petT = Math.max(0, petT - dt);
      if (near) target.copy(near);
      // State machine.
      if (state === "wake" && stateT > 0.7) setState("stretch");
      else if (state === "stretch" && stateT > 1.3) setState(petT > 0 ? "rub" : "sit");
      else if (state === "rub" && petT <= 0) setState("sit");
      else if (state === "sit" && stateT > 9) setState("lie");
      else if (state === "lie" && stateT > 1.6) setState("sleep");

      const goal = {
        sleep: { curl: 1, sit: 0, stretch: 0, rub: 0 },
        wake: { curl: 0.6, sit: 0.3, stretch: 0, rub: 0 },
        stretch: { curl: 0, sit: 0, stretch: 1, rub: 0 },
        sit: { curl: 0, sit: 1, stretch: 0, rub: 0 },
        rub: { curl: 0, sit: 1, stretch: 0, rub: 1 },
        lie: { curl: 0.7, sit: 0.2, stretch: 0, rub: 0 },
      }[state];
      for (const key of Object.keys(w)) w[key] = THREE.MathUtils.damp(w[key], goal[key], state === "stretch" ? 5 : 4, dt);

      // Turn toward the bunny while awake.
      const awake = 1 - w.curl;
      const local = root.worldToLocal(target.clone());
      const want = Math.atan2(local.x, local.z);
      turn = THREE.MathUtils.damp(turn, awake > 0.3 ? THREE.MathUtils.clamp(want, -1.2, 1.2) : 0, 3, dt);

      const breathe = Math.sin(time * (w.curl > 0.5 ? 1.6 : 3.2)) * 0.02;
      const purr = w.rub * Math.sin(time * 70) * 0.0025;
      hips.rotation.set(-w.sit * 0.62 + w.stretch * 0.32, turn * 0.6, 0);
      // Awake she stands on her paws, so the body lifts off the seat.
      hips.position.set(purr, 0.07 - w.curl * 0.02 + (1 - w.curl) * 0.035 + w.sit * 0.02 + w.stretch * 0.02, -0.08 + w.sit * 0.02);
      body.scale.set(1 + breathe * 0.5, 1 + breathe, 1 - w.stretch * 0.05);

      // Head: resting on paws when curled, up and looking at you when awake,
      // bowing into a stretch, rubbing side to side when petted.
      const rub = w.rub * Math.sin(time * 5);
      neck.rotation.set(w.curl * 0.55 + w.sit * 0.55 - w.stretch * 0.35 + w.rub * 0.1, turn * 0.4, rub * 0.3);
      neck.position.z = 0.2 + w.rub * 0.02 * (0.5 + 0.5 * Math.sin(time * 5));
      head.rotation.set(-w.sit * 0.1, 0, rub * 0.15 + (w.sit - w.rub) * Math.sin(time * 0.8) * 0.06);

      // Eyes: closed asleep and while enjoying the rub, slow blinks otherwise.
      const blink = (time % 4.2) < 0.18;
      const closed = w.curl > 0.5 || w.rub > 0.5 || blink;
      eyesOpen.visible = !closed;
      eyesClosed.visible = closed;

      // Legs: tucked in the curl, front paws reach out in the stretch.
      for (const { leg, kind } of legs) {
        if (kind === "front") {
          leg.rotation.x = w.curl * 1.35 + w.sit * 0.62 - w.stretch * 1.1;
          leg.scale.y = 1 + w.stretch * 0.25;
        } else {
          leg.rotation.x = w.curl * 1.4 + w.sit * 1.5 + w.stretch * 0.25;
        }
      }

      // Tail: wraps around the curled cat, curls round the paws when sitting,
      // swishes happily while petted, sticks straight up in the stretch.
      tail.forEach((seg, i) => {
        const s = i / (tail.length - 1);
        const swish = Math.sin(time * (2 + w.rub * 3) - i * 0.6) * (0.12 + w.rub * 0.18) * awake;
        seg.rotation.set(
          w.stretch * -0.35 + w.sit * (i === 0 ? 0.9 : 0.05) - w.curl * 0.05,
          (w.curl * 0.5 + w.sit * 0.35) * (1 - s * 0.3) + swish,
          0,
        );
      });
      root.updateMatrixWorld();
    },
    dispose() {
      scene.remove(root);
      root.traverse((o) => o.geometry?.dispose());
      material.dispose();
    },
  };
}
