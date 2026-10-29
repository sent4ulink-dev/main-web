import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { boxCorners, fitPose } from "../src/gameplay/framing.js";

// Where points land on screen (-1..1) for a pose.
function project(pose, aspect, points) {
  const camera = new THREE.PerspectiveCamera(pose.fov, aspect, 0.1, 200);
  camera.position.copy(pose.position);
  camera.quaternion.copy(pose.quaternion);
  camera.updateMatrixWorld(true);
  return points.map((p) => p.clone().project(camera));
}

describe("fitting the camera round a board", () => {
  // A 3.6 m wide, 1.1 m tall board standing 1.5 m up, seen from the front.
  const board = new THREE.Box3(new THREE.Vector3(-1.8, 1.5, -0.1), new THREE.Vector3(1.8, 2.6, 0.1));
  const points = boxCorners(board);

  it("fills an upright phone's width with the board", () => {
    const aspect = 375 / 812;
    const pose = fitPose(new THREE.Vector3(0, 4, 12), points, { fov: 66, aspect, fill: 0.9 });
    const shown = project(pose, aspect, points);
    const xs = shown.map((p) => p.x);
    expect(Math.max(...xs)).toBeLessThanOrEqual(0.91);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-0.91);
    // It really fills it: the widest point sits right at the margin.
    expect(Math.max(...xs.map(Math.abs))).toBeGreaterThan(0.85);
  });

  it("keeps everything inside the safe band between the chips and the controls", () => {
    const aspect = 375 / 812;
    const safe = { top: 0.7, bottom: -0.85 };
    const host = [new THREE.Vector3(0.3, 0.4, 1), new THREE.Vector3(0.3, 1.45, 1)];
    const pose = fitPose(new THREE.Vector3(0, 4, 12), [...points, ...host], { fov: 66, aspect, fill: 0.9, safe });
    for (const p of project(pose, aspect, [...points, ...host])) {
      expect(p.y).toBeLessThanOrEqual(safe.top + 1e-3);
      expect(p.y).toBeGreaterThanOrEqual(safe.bottom - 1e-3);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(0.91);
    }
  });
});
