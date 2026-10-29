import * as THREE from "three";
import { findPath } from "../world/pathfind.js";

// The paw-print trail: a line of little glowing bunny prints from wherever
// you are to the next thing to do (the activity board first, then the
// calendar, the treasure map, and last the keepsake book), so nobody gets
// lost. A heart bobs over where it leads, little hearts hover over the prints
// (so they show over stones and flowers), and a glow runs along them towards
// it. It rests while a board or the book is open, and once you are close (the
// board's own hint takes over, and the view turns round to it).

const STEP = 0.46; // metres between prints (left, right, left…)
const START = 1.3; // the first print, this far ahead of you (clear of your own bunny)
const SHOW = 14; // metres of trail shown
const MAX = Math.ceil((SHOW - START) / STEP) + 1;
const NEAR = 1.4; // close enough: the trail rests (the board's hint shows by then)
const REPLAN = 1; // seconds between fresh paths while you walk
const SIZE = 0.56; // each print's square (paw and glow), bigger than a real paw so you see it
const DIM = new THREE.Color(0.8, 0.8, 0.8);
const BRIGHT = new THREE.Color(1, 1, 1);
const HEART_EVERY = 3; // a little heart hovers over every third print…
const HEART_HIGH = 0.42; // …this high, so the trail shows over stones and flowers…
const HEART_SIZE = 0.34; // …on a square this big (heart and glow)

// A paw print painted once: a soft pink glow, then a pad and four toe beans
// in candy pink with a white edge, toes towards the top of the picture.
function pawTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const glow = g.createRadialGradient(64, 66, 4, 64, 66, 62);
  glow.addColorStop(0, "rgba(255, 190, 218, 0.75)");
  glow.addColorStop(0.55, "rgba(255, 170, 205, 0.32)");
  glow.addColorStop(1, "rgba(255, 170, 205, 0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);
  const blob = (x, y, rx, ry) => {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  };
  g.fillStyle = "#ff5f9e";
  g.strokeStyle = "#ffffff";
  g.lineWidth = 4;
  blob(64, 76, 19, 16);
  for (const [x, y] of [[40, 54], [55, 44], [73, 44], [88, 54]]) blob(x, y, 8, 9);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A hovering heart painted once: a soft white glow, then a heart in deep
// candy pink with a white edge and a little shine, so it shows even against
// the pink flowers.
function heartTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const glow = g.createRadialGradient(64, 66, 6, 64, 66, 62);
  glow.addColorStop(0, "rgba(255, 255, 255, 0.8)");
  glow.addColorStop(0.5, "rgba(255, 214, 232, 0.36)");
  glow.addColorStop(1, "rgba(255, 214, 232, 0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);
  g.beginPath();
  g.moveTo(64, 100);
  g.bezierCurveTo(26, 76, 20, 44, 43, 35);
  g.bezierCurveTo(55, 30, 64, 39, 64, 47);
  g.bezierCurveTo(64, 39, 73, 30, 85, 35);
  g.bezierCurveTo(108, 44, 102, 76, 64, 100);
  g.closePath();
  g.fillStyle = "#ff4b8f";
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = "#ffffff";
  g.stroke();
  g.beginPath();
  g.ellipse(47, 49, 8, 5, -0.7, 0, Math.PI * 2);
  g.fillStyle = "rgba(255, 255, 255, 0.75)";
  g.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function heartGeometry(size) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.55, -0.1, -0.6, 0.45, -0.28, 0.5);
  s.bezierCurveTo(-0.1, 0.52, 0, 0.35, 0, 0.25);
  s.bezierCurveTo(0, 0.35, 0.1, 0.52, 0.28, 0.5);
  s.bezierCurveTo(0.6, 0.45, 0.55, -0.1, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2, curveSegments: 10 });
  g.center();
  g.scale(size, size, size);
  return g;
}

// The first step not done yet (steps in order), or null when all are.
export function nextStep(steps) {
  return steps.find((step) => !step.done()) ?? null;
}

// steps: [{ key, spot (walk to here), mark (the heart floats here), done() }]
// onStep(key, first): a new step to lead to; onArrive(step): you got there.
export function createTrail(scene, { map, steps, onStep = () => {}, onArrive = () => {} }) {
  // Flat squares on the ground (toes towards -z), each painted with a paw.
  const square = new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2);
  const prints = new THREE.InstancedMesh(square, new THREE.MeshBasicMaterial({
    map: pawTexture(), transparent: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }), MAX);
  prints.count = 0;
  prints.frustumCulled = false;
  prints.renderOrder = 2;
  prints.setColorAt(0, DIM);
  scene.add(prints);
  // Little hearts hovering over the trail, always facing you.
  const floaters = new THREE.InstancedMesh(new THREE.PlaneGeometry(HEART_SIZE, HEART_SIZE), new THREE.MeshBasicMaterial({
    map: heartTexture(), transparent: true, depthWrite: false, toneMapped: false,
  }), Math.ceil(MAX / HEART_EVERY) + 1);
  floaters.count = 0;
  floaters.frustumCulled = false;
  floaters.renderOrder = 3;
  floaters.setColorAt(0, DIM);
  scene.add(floaters);
  const heart = new THREE.Mesh(heartGeometry(0.34), new THREE.MeshBasicMaterial({ color: "#ff6f9f", toneMapped: false }));
  heart.visible = false;
  scene.add(heart);

  let current = null; // the step being led to
  let announced = null;
  let arrived = null; // the step you last got to (until you wander off again)
  let line = []; // the path, from you to the step's spot
  let lengths = [];
  const planned = new THREE.Vector3(Infinity, 0, 0);
  let replan = 0;
  let shown = 0; // fades the trail in and out
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const at = new THREE.Vector3();
  const along = new THREE.Vector3();

  function plan(from) {
    // (Room to go back to the path and along it: the gardens stand to either
    // side of it, so the way from one to another is never a straight line.)
    const path = findPath(map, from, current.spot, { radius: 0.2, pad: 14, grid: 0.2, budget: 60000 });
    const start = from.clone().setY(map.surface(from.x, from.z) ?? from.y); // (from the ground, even mid-hop)
    // No way on foot from here (up on a secret garden, say): no prints across
    // the open sky, only the heart over where the trail leads.
    line = path ? [start, ...path] : [start, start.clone()];
    lengths = [0];
    for (let i = 1; i < line.length; i += 1) lengths.push(lengths[i - 1] + line[i].distanceTo(line[i - 1]));
    planned.copy(from);
  }
  // The point and direction `s` metres along the path.
  function pointAt(s) {
    let i = 1;
    while (i < line.length - 1 && lengths[i] < s) i += 1;
    const a = line[i - 1];
    const b = line[i];
    const span = lengths[i] - lengths[i - 1] || 1;
    const k = Math.min(1, Math.max(0, (s - lengths[i - 1]) / span));
    at.lerpVectors(a, b, k);
    along.subVectors(b, a).setY(0).normalize();
  }

  return {
    get step() { return current?.key ?? null; },
    // active: walking, with nothing open; you: where your bunny is.
    update(time, dt, { active, you, camera }) {
      const step = active ? nextStep(steps) : null;
      if (step !== current) {
        current = step;
        line = [];
        planned.set(Infinity, 0, 0);
        replan = 0;
      }
      if (current && current.key !== announced) {
        const first = announced === null;
        announced = current.key;
        onStep(current.key, first);
      }
      const away = current ? you.distanceTo(current.spot) : Infinity;
      const near = away < NEAR;
      if (near && arrived !== current) {
        arrived = current;
        onArrive(current);
      } else if (away > NEAR + 1.5) {
        arrived = null;
      }
      shown = Math.max(0, Math.min(1, shown + (current && !near ? dt : -dt) * 2.5));
      // The heart over the next stop, whenever there is one.
      heart.visible = Boolean(current);
      if (current) {
        heart.position.copy(current.mark).setY(current.mark.y + Math.sin(time * 2.2) * 0.08);
        heart.quaternion.copy(camera.quaternion);
        heart.rotateZ(Math.sin(time * 1.6) * 0.15);
        heart.scale.setScalar(1 + Math.sin(time * 4.4) * 0.05);
      }
      if (!current || shown <= 0) {
        prints.count = 0;
        floaters.count = 0;
        return;
      }
      replan -= dt;
      if (!line.length || (replan <= 0 && you.distanceTo(planned) > 0.6)) {
        plan(you);
        replan = REPLAN;
      }
      // Prints, left and right, from just ahead of you along the path; a
      // glow runs along them towards where they lead.
      const total = lengths[lengths.length - 1];
      let count = 0;
      let hovering = 0;
      for (let k = 0; count < MAX; k += 1) {
        const s = START + k * STEP;
        if (s > Math.min(total - 0.3, SHOW)) break;
        pointAt(s);
        const side = k % 2 ? 1 : -1;
        at.x += along.z * side * 0.1;
        at.z -= along.x * side * 0.1;
        // On the ground beside the path, unless that is the top of a lantern
        // or a bush: then at the path's own height.
        const ground = map.surface(at.x, at.z);
        const y = ground !== null && Math.abs(ground - at.y) < 0.25 ? ground : at.y;
        dummy.position.set(at.x, y + 0.035, at.z);
        dummy.rotation.set(0, Math.atan2(along.x, along.z) + Math.PI, 0);
        // A glow runs along the prints towards where they lead, each one
        // brightening and giving a little hop as it passes.
        const wave = (((s - time * 2.2) % 3) + 3) % 3;
        const glow = Math.max(0, Math.cos((wave / 3) * Math.PI * 2)) ** 4;
        const fade = Math.min(1, (SHOW - s) / 2.5) * shown;
        dummy.scale.setScalar(Math.max(0.001, fade * (1 + glow * 0.14)));
        dummy.updateMatrix();
        prints.setMatrixAt(count, dummy.matrix);
        prints.setColorAt(count, color.copy(DIM).lerp(BRIGHT, glow));
        if (k % HEART_EVERY === 1) {
          dummy.position.y += HEART_HIGH + Math.sin(time * 2.6 + k) * 0.05 + glow * 0.06;
          dummy.quaternion.copy(camera.quaternion);
          dummy.scale.setScalar(Math.max(0.001, fade * (1 + glow * 0.3)));
          dummy.updateMatrix();
          floaters.setMatrixAt(hovering, dummy.matrix);
          floaters.setColorAt(hovering, color.copy(DIM).lerp(BRIGHT, glow));
          hovering += 1;
        }
        count += 1;
      }
      prints.count = count;
      prints.instanceMatrix.needsUpdate = true;
      if (prints.instanceColor) prints.instanceColor.needsUpdate = true;
      floaters.count = hovering;
      floaters.instanceMatrix.needsUpdate = true;
      if (floaters.instanceColor) floaters.instanceColor.needsUpdate = true;
    },
    dispose() {
      scene.remove(prints, floaters, heart);
      floaters.geometry.dispose();
      floaters.material.map.dispose();
      floaters.material.dispose();
      prints.geometry.dispose();
      prints.material.map.dispose();
      prints.material.dispose();
      heart.geometry.dispose();
      heart.material.dispose();
    },
  };
}
