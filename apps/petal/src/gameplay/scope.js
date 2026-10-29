import * as THREE from "three";
import { createTelescope } from "./telescope.js";

// The live telescope on the Star Perch. The bunny steps up and peeks through
// it while you steer (drag or joystick). Three views: over her shoulder with a
// round lens window, a front view of her at the eyepiece, and full-screen
// through the lens.

const MODES = ["Over the shoulder", "Watch the bunny", "Through the scope"];

export function createScope({ scene, walker, data, notify, sfx }) {
  if (!data?.base) return null;
  const scope = createTelescope(scene, data);
  const collider = walker.addCollider({ type: "circle", x: scope.base.x, z: scope.base.z, radius: 0.26 }, scope.base.y + 2.2);
  let active = false;
  let mode = 0;
  let camReady = false;
  const eye = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const from = new THREE.Vector3();
  const look = new THREE.Vector3();
  const listeners = new Set();
  const changed = () => listeners.forEach((fn) => fn(active, mode));
  const eyeOffset = new THREE.Vector3();
  const grip = new THREE.Vector3();
  // Stand so her telescope eye is on the eyepiece (one eye looks, one winks).
  const standSpot = () => scope.standSpot(walker.scopeEyeOffset?.(eyeOffset) ?? null);

  function camera(cam, dt) {
    scope.eye(eye);
    scope.direction(dir);
    if (mode === 2) {
      scope.lensFront(eye);
      cam.position.copy(eye);
      cam.lookAt(look.copy(eye).add(dir));
      cam.fov = THREE.MathUtils.damp(cam.fov, 16, 6, dt);
    } else {
      const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      const side = new THREE.Vector3(flat.z, 0, -flat.x);
      const want = scope.base.clone().addScaledVector(flat, 1.7).addScaledVector(side, 0.9).add(new THREE.Vector3(0, 0.95, 0));
      if (!camReady) from.copy(cam.position);
      camReady = true;
      from.lerp(want, 1 - Math.exp(-dt * 5));
      cam.position.copy(from);
      cam.lookAt(look.copy(scope.base).add(new THREE.Vector3(0, 0.55, 0)).addScaledVector(flat, -0.1));
      cam.fov = THREE.MathUtils.damp(cam.fov, 50, 6, dt);
    }
    cam.updateProjectionMatrix();
  }

  return {
    base: scope.base,
    get active() { return active; },
    // For the corner lens window (rendered by the stage).
    view: {
      get active() { return active && mode !== 2; },
      eye: (target) => scope.eye(target),
      direction: (target) => scope.direction(target),
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    near(position, reach = 1.4) {
      return Math.hypot(scope.base.x - position.x, scope.base.z - position.z) < reach;
    },
    look() {
      if (walker.busy) return false;
      active = true;
      mode = 0;
      walker.sit({
        pose: "scope",
        aim: true,
        locked: () => active,
        ...standSpot(),
        pos: standSpot().pos.toArray(),
        dynamic: () => standSpot(),
        grip: () => scope.grip(grip),
      });
      walker.setView(2.3);
      sfx.chime();
      notify("Drag or use the joystick to turn the scope. 🎥 changes the view. ✨");
      changed();
      return true;
    },
    stop() {
      if (!active) return;
      active = false;
      mode = 0;
      walker.setCameraOverride(null);
      walker.setView(false);
      walker.sit();
      changed();
    },
    cycle() {
      if (!active) return;
      mode = (mode + 1) % MODES.length;
      camReady = false;
      walker.setCameraOverride(mode === 0 ? null : camera);
      notify(`🎥 ${MODES[mode]}`);
      changed();
    },
    reset() {
      active = false;
      mode = 0;
      walker.setCameraOverride(null);
      changed();
    },
    update(dt) {
      if (!active) return;
      const offset = walker.scopeEyeOffset?.(eyeOffset);
      if (offset && walker.sitting?.pose === "scope") scope.setEyeHeight(scope.base.y + offset.y);
      scope.aim(walker.yaw + Math.PI, 0.5 - (walker.pitch - 0.42) * 1.6, dt);
    },
    dispose() {
      walker.removeCollider(collider);
      scope.dispose();
    },
  };
}
