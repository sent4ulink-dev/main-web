import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { colored } from "../core/geometry.js";

// The Star Perch telescope: a tripod with a head that turns (azimuth) and
// tilts (altitude) live. The bunny stands at the eyepiece while you steer,
// and a zoomed "scope view" is rendered from the lens. A centre column slides
// up and down so the eyepiece stays at her eye however far the tube tilts.

const WOOD = "#8e6147";
const BRASS = "#e2b866";
const TUBE = "#b7a4e8";

function cylinderBetween(a, b, r0, r1, color, segments = 12) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r1, r0, d.length(), segments);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return colored(g, color);
}

export function createTelescope(scene, data) {
  const base = new THREE.Vector3(...data.base);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: "#ffffff", emissiveIntensity: 0.05 });
  const root = new THREE.Group();
  root.name = "Telescope";
  root.position.copy(base);
  scene.add(root);

  // Tripod (static), sized for a small bunny, with a sliding centre column.
  const apex = new THREE.Vector3(0, 0.38, 0);
  const legs = [];
  for (let k = 0; k < 3; k += 1) {
    const a = (k / 3) * Math.PI * 2 + 0.3;
    const foot = new THREE.Vector3(Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34);
    legs.push(cylinderBetween(foot, apex, 0.022, 0.017, WOOD, 8));
    legs.push(cylinderBetween(foot, foot.clone().add(new THREE.Vector3(0, 0.035, 0)), 0.036, 0.032, BRASS, 8));
  }
  legs.push(cylinderBetween(apex.clone().add(new THREE.Vector3(0, -0.05, 0)), apex.clone().add(new THREE.Vector3(0, 0.05, 0)), 0.055, 0.05, BRASS, 12));
  const tripod = new THREE.Mesh(mergeGeometries(legs), material);
  root.add(tripod);
  const column = new THREE.Mesh(colored(new THREE.CylinderGeometry(0.024, 0.028, 1, 10).translate(0, 0.5, 0), BRASS), material);
  column.position.copy(apex);
  root.add(column);

  // Head: yaw group -> tilt group -> tube along +Z. A fork on top of the
  // column holds the tube's trunnion.
  const yawGroup = new THREE.Group();
  yawGroup.position.copy(apex).add(new THREE.Vector3(0, 0.26, 0));
  root.add(yawGroup);
  const fork = new THREE.Mesh(mergeGeometries([
    cylinderBetween(new THREE.Vector3(0, -0.15, 0), new THREE.Vector3(0, -0.12, 0), 0.04, 0.04, BRASS, 12),
    cylinderBetween(new THREE.Vector3(-0.085, -0.13, 0), new THREE.Vector3(0.085, -0.13, 0), 0.014, 0.014, BRASS, 6),
    cylinderBetween(new THREE.Vector3(-0.085, -0.13, 0), new THREE.Vector3(-0.085, 0, 0), 0.012, 0.012, BRASS, 6),
    cylinderBetween(new THREE.Vector3(0.085, -0.13, 0), new THREE.Vector3(0.085, 0, 0), 0.012, 0.012, BRASS, 6),
  ]), material);
  yawGroup.add(fork);
  const tilt = new THREE.Group();
  yawGroup.add(tilt);
  const z = (v) => new THREE.Vector3(0, 0, v);
  const parts = [
    cylinderBetween(z(-0.32), z(0.42), 0.055, 0.07, TUBE, 16),
    cylinderBetween(z(0.42), z(0.54), 0.078, 0.078, "#9f8ad8", 16),
    cylinderBetween(z(0.535), z(0.545), 0.072, 0.072, "#bfe6ff", 16),
    cylinderBetween(z(-0.34), z(-0.3), 0.06, 0.06, BRASS, 16),
    cylinderBetween(z(0.04), z(0.08), 0.066, 0.066, BRASS, 16),
    cylinderBetween(z(0.4), z(0.44), 0.075, 0.075, BRASS, 16),
    cylinderBetween(new THREE.Vector3(0, 0.0, -0.34), new THREE.Vector3(0, 0.03, -0.44), 0.022, 0.018, "#4a3a5a", 10), // eyepiece
    cylinderBetween(new THREE.Vector3(0, 0.1, -0.1), new THREE.Vector3(0, 0.1, 0.16), 0.016, 0.02, TUBE, 10), // finder
    cylinderBetween(new THREE.Vector3(0, 0.05, 0.02), new THREE.Vector3(0, 0.1, 0.02), 0.01, 0.01, BRASS, 6),
    cylinderBetween(new THREE.Vector3(-0.07, 0, 0), new THREE.Vector3(0.07, 0, 0), 0.02, 0.02, BRASS, 8), // trunnion
  ];
  const head = new THREE.Mesh(mergeGeometries(parts), material);
  tilt.add(head);

  let azimuth = data.yaw ?? 0;
  let altitude = 0.35;
  let eyeHeight = 0.55; // eyepiece height above the base (her eye when she's there)
  let wantEye = eyeHeight;
  const eye = new THREE.Vector3();
  const dir = new THREE.Vector3();
  function apply() {
    yawGroup.rotation.y = azimuth;
    tilt.rotation.x = -altitude;
    // The eyepiece end (0, 0.03, -0.46) sits this far above the pivot.
    const rise = 0.03 * Math.cos(altitude) - 0.46 * Math.sin(altitude);
    yawGroup.position.y = THREE.MathUtils.clamp(eyeHeight - rise, apex.y + 0.2, apex.y + 1.0);
    column.scale.y = yawGroup.position.y - 0.15 - apex.y;
    root.updateMatrixWorld(true);
  }
  apply();

  return {
    base,
    get azimuth() { return azimuth; },
    // Smoothly steer toward a heading / altitude (radians).
    aim(targetAzimuth, targetAltitude, dt) {
      let diff = targetAzimuth - azimuth;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      azimuth += diff * Math.min(1, dt * 8);
      altitude = THREE.MathUtils.damp(altitude, THREE.MathUtils.clamp(targetAltitude, -0.15, 0.9), 8, dt);
      eyeHeight = THREE.MathUtils.damp(eyeHeight, wantEye, 6, dt);
      apply();
    },
    // Keep the eyepiece at this world height (her eye).
    setEyeHeight(y) {
      wantEye = THREE.MathUtils.clamp(y - base.y, 0.3, 1.1);
    },
    // Eyepiece position and viewing direction in world space.
    eye(target = eye) { return head.localToWorld(target.set(0, 0.03, -0.46)); },
    // Just past the objective lens: the full-screen view is rendered from
    // here, so neither the tube nor her head is in front of the camera.
    lensFront(target = new THREE.Vector3()) { return head.localToWorld(target.set(0, 0, 0.62)); },
    // Where her paws hold the tube, a little ahead of the eyepiece.
    grip(target = new THREE.Vector3()) { return head.localToWorld(target.set(0, 0, -0.22)); },
    direction(target = dir) {
      return target.set(0, 0, 1).applyQuaternion(tilt.getWorldQuaternion(new THREE.Quaternion())).normalize();
    },
    // Where the bunny stands to look through it: far enough behind the
    // eyepiece that her face just touches it.
    // With `offset` (her eye relative to her feet, in her frame) her eye
    // lands right on the eyepiece.
    standSpot(offset = null) {
      const e = this.eye(new THREE.Vector3());
      if (!offset) {
        const back = new THREE.Vector3(Math.sin(azimuth), 0, Math.cos(azimuth));
        return { pos: e.sub(back.multiplyScalar(0.27)).setY(base.y), yaw: azimuth };
      }
      const c = Math.cos(azimuth);
      const s = Math.sin(azimuth);
      return { pos: new THREE.Vector3(e.x - (offset.x * c + offset.z * s), base.y, e.z - (-offset.x * s + offset.z * c)), yaw: azimuth };
    },
    dispose() {
      scene.remove(root);
      tripod.geometry.dispose();
      column.geometry.dispose();
      fork.geometry.dispose();
      head.geometry.dispose();
      material.dispose();
    },
  };
}
