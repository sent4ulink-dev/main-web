import * as THREE from "three";

// The path's chiming heart stones. Two stretches of the path have no cobbles
// but a run of pastel heart stones: each chimes as the bunny steps on it, a
// note of its own, so walking up a run plays a little tune (a scale on the
// first, "Twinkle, twinkle" on the second). Step on every stone of a run in
// turn and it answers with a puff of hearts.

// The tune of each run (MIDI notes), from its first stone to its last.
export const TUNES = [
  [72, 74, 76, 77, 79, 81, 83, 84], // do re mi fa sol la ti do
  [72, 72, 79, 79, 81, 81, 79, 77], // twinkle, twinkle, little star, how…
];
const COLOURS = ["#ff9fc3", "#ffb99a", "#ffe08a", "#bfe6a3", "#9fd8f0", "#b9b3ff", "#e0a8f5", "#ff9fc3"];
const STEP_ON = 0.3; // metres: her feet are on a stone within this of its middle…
const STEP_OFF = 0.46; // …and off it again beyond this (so one step chimes once)
const WIDTH = 0.46;

// A heart lying flat, its point towards +z (towards whoever walks up the path).
function heartStone() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.55, -0.1, -0.6, 0.45, -0.28, 0.5);
  s.bezierCurveTo(-0.1, 0.52, 0, 0.35, 0, 0.25);
  s.bezierCurveTo(0, 0.35, 0.1, 0.52, 0.28, 0.5);
  s.bezierCurveTo(0.6, 0.45, 0.55, -0.1, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 8 });
  g.center();
  g.rotateX(-Math.PI / 2);
  g.scale(WIDTH, WIDTH * 0.75, WIDTH);
  return g;
}

// The stone of a run (if any) that feet at (x, z) stand on: its index.
export function stoneUnder(run, x, z, within = STEP_ON) {
  let best = -1;
  let near = within;
  run.forEach(([sx, , sz], index) => {
    const d = Math.hypot(x - sx, z - sz);
    if (d < near) {
      near = d;
      best = index;
    }
  });
  return best;
}

// runs: play.json's chimes, a list of runs, each a list of [x, y, z].
export function createChimes({ scene, runs = [], fx, sfx }) {
  const stones = runs.flatMap((run, r) => run.map(([x, y, z], i) => ({ run: r, index: i, x, y, z, bump: 0, on: false })));
  if (!stones.length) return null;
  const mesh = new THREE.InstancedMesh(heartStone(), new THREE.MeshLambertMaterial({ emissive: "#ff9fc3", emissiveIntensity: 0.22 }), stones.length);
  mesh.name = "Chiming heart stones";
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const colour = new THREE.Color();
  const white = new THREE.Color("#ffffff");
  function draw(stone, k) {
    dummy.position.set(stone.x, stone.y + 0.035 + stone.bump * 0.05, stone.z);
    dummy.scale.setScalar(1 + stone.bump * 0.22);
    dummy.updateMatrix();
    mesh.setMatrixAt(k, dummy.matrix);
    mesh.setColorAt(k, colour.set(COLOURS[stone.index % COLOURS.length]).lerp(white, stone.bump * 0.6));
  }
  stones.forEach(draw);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  // How far along each run she has stepped in turn (for the puff of hearts).
  const streak = runs.map(() => -1);

  return {
    stones,
    // position: the bunny's feet while she walks (null otherwise).
    update(dt, position = null) {
      let changed = false;
      stones.forEach((stone, k) => {
        if (position) {
          const d = Math.hypot(position.x - stone.x, position.z - stone.z);
          const level = Math.abs(position.y - stone.y) < 0.35;
          if (!stone.on && d < STEP_ON && level) {
            stone.on = true;
            stone.bump = 1;
            sfx?.note?.(TUNES[stone.run % TUNES.length][stone.index % 8]);
            fx?.sparkle(new THREE.Vector3(stone.x, stone.y + 0.25, stone.z), 6, COLOURS[stone.index % COLOURS.length]);
            // In turn, either way along the run? Only upwards counts as the tune.
            streak[stone.run] = stone.index === streak[stone.run] + 1 ? stone.index : stone.index === 0 ? 0 : -1;
            if (streak[stone.run] === runs[stone.run].length - 1) {
              streak[stone.run] = -1;
              fx?.hearts(new THREE.Vector3(stone.x, stone.y + 0.9, stone.z), 10);
              sfx?.twinkle?.();
            }
          } else if (stone.on && (d > STEP_OFF || !level)) stone.on = false;
        } else stone.on = false;
        if (stone.bump > 0) {
          stone.bump = Math.max(0, stone.bump - dt * 2.6);
          draw(stone, k);
          changed = true;
        }
      });
      if (changed) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
      }
    },
    dispose() {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    },
  };
}
