import * as THREE from "three";

// Camera poses for the picking boards and the keepsake book: a clear spot
// square onto a board (framePose), and a pose fitted round the things that
// must be in view (fitPose), so on a narrow phone screen a board fills the
// width instead of shrinking into the distance.

// [distance scale, rise, fov]: a little above, then higher, then closer and
// wider.
const FRAMINGS = [[1, 0.24, 50], [1, 0.45, 50], [0.82, 0.3, 58], [0.82, 0.6, 58], [0.66, 0.45, 66], [0.66, 0.8, 66]];
// A phone held upright has height to spare: a taller view lets the camera
// stand closer (fewer things in between) with the board just as wide.
export const UPRIGHT_FRAMINGS = [[0.72, 0.3, 66], [0.72, 0.5, 66], [0.62, 0.38, 74], [0.62, 0.6, 74], [0.72, 0.75, 66], [0.62, 0.85, 74]];

// A camera pose square onto a board (f: boardFrame from actors/host.js), far
// enough back to see all of it from `bottom` to `top` and `width` across. It
// takes the first spot (in FRAMINGS order, then a little to either side) with
// a clear view of the board, read off the walk map's heights so it costs next
// to nothing. foreground: also keep anything big out of the near half of the
// view (on a tall screen it would fill the bottom of it).
export function framePose(map, aspect, f, { bottom, top, width, target: centre = f.centre, framings = FRAMINGS, foreground = false }) {
  const height = top - bottom + 0.5;
  const tan = Math.tan(THREE.MathUtils.degToRad(25));
  const distance = Math.max(height / 2 / tan, width / 2 / (tan * Math.max(0.4, aspect))) * 1.05;
  const target = new THREE.Vector3(centre.x, (top + bottom) / 2, centre.z);
  // Points on the board's face (its own tree or stand right behind it does
  // not count as being in the way).
  const corners = [
    target,
    target.clone().addScaledVector(f.side, -f.half * 0.8),
    target.clone().addScaledVector(f.side, f.half * 0.8),
    target.clone().setY(top - 0.2),
    target.clone().setY(bottom + 0.3),
  ];
  const step = new THREE.Vector3();
  const clear = (eye, fov) => {
    const under = map.surface(eye.x, eye.z);
    if (under !== null && under > eye.y - 0.6) return false; // in or right over something
    if (foreground) {
      // The bottom edge of the view falls this much per metre ahead; nothing
      // with a body may rise above it in the nearer part of the way.
      const across = Math.hypot(target.x - eye.x, target.z - eye.z);
      const drop = Math.tan(Math.atan2(eye.y - target.y, across) + THREE.MathUtils.degToRad(fov / 2));
      const spread = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect;
      const dx = (target.x - eye.x) / across;
      const dz = (target.z - eye.z) / across;
      for (let t = 0.4; t < across * 0.6; t += 0.2) {
        for (const lateral of [-1, -0.5, 0, 0.5, 1]) {
          const x = eye.x + dx * t - dz * lateral * spread * t;
          const z = eye.z + dz * t + dx * lateral * spread * t;
          const sample = map.sample(x, z);
          if (sample.kind === "body" && sample.height > eye.y - t * drop + 0.1) return false;
        }
      }
    }
    for (const aimAt of corners) {
      const length = step.subVectors(aimAt, eye).length();
      step.normalize();
      for (let t = 0.4; t < length - 1.2; t += 0.15) {
        const h = map.surface(eye.x + step.x * t, eye.z + step.z * t);
        if (h !== null && h > eye.y + step.y * t - 0.05) return false;
      }
    }
    // Nothing tall right in front (it would fill the bottom of the view).
    const ahead = step.subVectors(target, eye).setY(0);
    const reach = Math.min(3.6, ahead.length() - 1.5);
    ahead.normalize();
    const across = new THREE.Vector3(-ahead.z, 0, ahead.x);
    for (let t = 0.3; t < reach; t += 0.25) {
      for (const lateral of [-0.6, -0.3, 0, 0.3, 0.6]) {
        const x = eye.x + ahead.x * t + across.x * lateral * t;
        const z = eye.z + ahead.z * t + across.z * lateral * t;
        const sample = map.sample(x, z);
        if (sample.kind === "body" && sample.height > eye.y - 1.7) return false;
      }
    }
    return true;
  };
  let eye = null;
  let fov = 50;
  search: for (const [scale, rise, wide] of framings) {
    for (const shift of [0, -0.9, 0.9, -1.8, 1.8]) {
      const spot = target.clone().addScaledVector(f.normal, distance * scale).addScaledVector(f.side, shift)
        .add(new THREE.Vector3(0, distance * rise, 0));
      if (clear(spot, wide)) {
        eye = spot;
        fov = wide;
        break search;
      }
    }
  }
  const position = eye || target.clone().addScaledVector(f.normal, distance).add(new THREE.Vector3(0, distance * 0.6, 0));
  const look = new THREE.Matrix4().lookAt(position, target, new THREE.Vector3(0, 1, 0));
  return { position, quaternion: new THREE.Quaternion().setFromRotationMatrix(look), fov };
}

// From the eye's side of things, aim so every point is in view, then slide
// the eye along its line of sight until they fill `fill` of the frame (of its
// width or its height, whichever runs out first). safe: the part of the
// screen to fill, in -1..1 screen units (on a phone the controls take the
// bottom and the chips the top). With a walk map, null if the eye would end
// up inside something.
export function fitPose(eye, points, { fov, aspect, fill = 0.88, map = null, safe = { top: 1, bottom: -1 } }) {
  const view = new THREE.PerspectiveCamera(fov, aspect, 0.1, 200);
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const tanH = tanV * aspect;
  const look = points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(points.length);
  const position = eye.clone();
  const v = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  for (let i = 0; i < 12; i += 1) {
    view.position.copy(position);
    view.lookAt(look);
    view.updateMatrixWorld(true);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) {
      v.copy(p).applyMatrix4(view.matrixWorldInverse);
      const depth = Math.max(0.2, -v.z);
      x0 = Math.min(x0, v.x / depth / tanH);
      x1 = Math.max(x1, v.x / depth / tanH);
      y0 = Math.min(y0, v.y / depth / tanV);
      y1 = Math.max(y1, v.y / depth / tanV);
    }
    // Slide sideways and up or down to centre them in the safe part of the
    // screen, then in or out to fit it.
    const distance = position.distanceTo(look);
    right.setFromMatrixColumn(view.matrixWorld, 0);
    up.setFromMatrixColumn(view.matrixWorld, 1);
    const middle = (y0 + y1) / 2 - (safe.top + safe.bottom) / 2;
    const shift = right.multiplyScalar(((x0 + x1) / 2) * tanH * distance).addScaledVector(up, middle * tanV * distance);
    position.add(shift);
    look.add(shift);
    const extent = Math.max((x1 - x0) / 2, (y1 - y0) / (safe.top - safe.bottom)) / fill;
    position.sub(look).multiplyScalar(THREE.MathUtils.clamp(extent, 0.6, 1.6)).add(look);
  }
  if (map) {
    const under = map.surface(position.x, position.z);
    if (under !== null && under > position.y - 0.6) return null;
  }
  view.position.copy(position);
  view.lookAt(look);
  return { position, quaternion: view.quaternion.clone(), fov };
}

// The eight corners of a box.
export function boxCorners(box) {
  const corners = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
    }
  }
  return corners;
}
