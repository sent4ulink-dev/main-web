import * as THREE from "three";

// A little hot-air balloon that tours the treasure map: it drifts along an arc
// to the next place, settles beside it for a moment, then sets off again. It is
// a small transparent card just in front of the map, with a soft shadow on the
// parchment; the pictures and the lettering are left alone.

const FLIGHT = 3.4; // seconds between two places
const STAY = 1.8; // seconds at each place

function teardrop(g) {
  g.beginPath();
  g.moveTo(64, 106);
  g.bezierCurveTo(20, 82, 12, 40, 34, 20);
  g.bezierCurveTo(48, 6, 80, 6, 94, 20);
  g.bezierCurveTo(116, 40, 108, 82, 64, 106);
  g.closePath();
}

function balloonTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 160;
  const g = canvas.getContext("2d");
  g.strokeStyle = "#8a6a55";
  g.lineWidth = 2.5;
  for (const [x0, x1] of [[44, 54], [84, 74]]) {
    g.beginPath();
    g.moveTo(x0, 96);
    g.lineTo(x1, 128);
    g.stroke();
  }
  g.save();
  teardrop(g);
  g.clip();
  ["#ff8fb8", "#fff4f8", "#ffb3cf", "#fff4f8", "#ff8fb8", "#fff4f8"].forEach((color, i) => {
    g.fillStyle = color;
    g.fillRect(4 + i * 20, 0, 20, 112);
  });
  const shade = g.createRadialGradient(46, 34, 4, 64, 58, 66);
  shade.addColorStop(0, "rgba(255,255,255,0.6)");
  shade.addColorStop(1, "rgba(110,30,70,0.28)");
  g.fillStyle = shade;
  g.fillRect(0, 0, 128, 112);
  g.restore();
  teardrop(g);
  g.strokeStyle = "rgba(122,52,84,0.6)";
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.moveTo(64, 66);
  g.bezierCurveTo(48, 54, 54, 40, 64, 48);
  g.bezierCurveTo(74, 40, 80, 54, 64, 66);
  g.fill();
  g.fillStyle = "#c9925f";
  g.fillRect(50, 126, 28, 22);
  g.fillStyle = "#a8703f";
  g.fillRect(48, 124, 32, 6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function shadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d");
  const gradient = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gradient.addColorStop(0, "rgba(60,30,20,0.55)");
  gradient.addColorStop(1, "rgba(60,30,20,0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

const smooth = (t) => t * t * (3 - 2 * t);

// slots: the island's picture slots; the map's three places are SLOT_05..07.
export function createMapBalloon(world, slots, { reducedMotion = false } = {}) {
  const found = ["SLOT_05", "SLOT_06", "SLOT_07"].map((prefix) => slots.find((s) => s.name.startsWith(prefix))).filter(Boolean);
  if (found.length < 2) return null;
  world.updateMatrixWorld(true);
  const toWorld = world.matrixWorld.clone().invert();
  const normal = new THREE.Vector3();
  const centres = found.map((slot) => {
    const geometry = slot.geometry;
    geometry.computeBoundingBox();
    const normals = geometry.attributes.normal;
    if (normals) {
      const n = new THREE.Vector3(normals.getX(0), normals.getY(0), normals.getZ(0)).transformDirection(slot.matrixWorld);
      normal.add(n);
    }
    return slot.localToWorld(geometry.boundingBox.getCenter(new THREE.Vector3())).applyMatrix4(toWorld);
  });
  if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1);
  normal.normalize();
  if (normal.z < 0) normal.negate(); // the map faces visitors (+z)
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(normal, -normal.y).normalize();
  const right = new THREE.Vector3().crossVectors(up, normal).normalize();
  if (right.dot(new THREE.Vector3().subVectors(centres[centres.length - 1], centres[0])) < 0) right.negate();
  // Each stop: beside the top right of a place's picture, in front of the map.
  const stops = centres.map((c) => c.clone().addScaledVector(up, 0.3).addScaledVector(right, 0.3).addScaledVector(normal, 0.07));
  const basis = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));

  const texture = balloonTexture();
  const balloon = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.325),
    new THREE.MeshLambertMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  balloon.renderOrder = 3;
  balloon.name = "Map balloon";
  const shadowMap = shadowTexture();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.075),
    new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, opacity: 0.5 }),
  );
  shadow.renderOrder = 3;
  world.add(balloon, shadow);

  // A tour back and forth across the map: 0, 1, 2, 1, 0, 1, …
  const order = stops.length === 3 ? [0, 1, 2, 1] : [0, 1];
  let leg = 0;
  let clock = 0;
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const control = new THREE.Vector3();
  const spin = new THREE.Quaternion();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  function place(position, time, heading) {
    const bob = Math.sin(time * 2.1) * 0.012;
    balloon.position.copy(position).addScaledVector(up, bob);
    spin.setFromAxisAngle(normal, Math.sin(time * 1.6) * 0.06 - heading * 0.16);
    balloon.quaternion.copy(spin).multiply(basis);
    // Its shadow lies on the parchment below, smaller when it is higher.
    shadow.position.copy(position).addScaledVector(up, -0.21).addScaledVector(normal, -0.058);
    shadow.quaternion.copy(basis);
    shadow.scale.setScalar(1 - bob * 4);
  }

  place(stops[0], 0, 0);
  return {
    textures: [texture, shadowMap],
    update(time, dt) {
      if (reducedMotion) {
        place(stops[0], 0, 0);
        return;
      }
      clock += dt;
      if (clock > FLIGHT + STAY) {
        clock -= FLIGHT + STAY;
        leg = (leg + 1) % order.length;
      }
      from.copy(stops[order[leg]]);
      to.copy(stops[order[(leg + 1) % order.length]]);
      if (clock < STAY) {
        place(from, time, 0);
        return;
      }
      // Fly an arc up and over to the next place.
      const t = smooth((clock - STAY) / FLIGHT);
      control.lerpVectors(from, to, 0.5).addScaledVector(up, 0.32);
      a.lerpVectors(from, control, t);
      b.lerpVectors(control, to, t);
      const heading = Math.sign(to.dot(right) - from.dot(right)) * Math.sin(Math.PI * t);
      place(a.lerp(b, t), time, heading);
    },
  };
}
