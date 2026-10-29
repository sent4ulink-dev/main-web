import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createWalkMap } from "../src/world/walkmap.js";
import { findPath, footing } from "../src/world/pathfind.js";

// A 6 m x 6 m lawn (10 cm cells) with a 1 m tall wall across the middle,
// from z = 1.5 to z = 4.5 at x = 3: the way from one side to the other has to
// go round one end of it.
function lawnWithWall() {
  const cols = 61;
  const rows = 61;
  const meta = { version: 2, x0: 0, z0: 0, cell: 0.1, cols, rows, offset: 5, scale: 0.001, heightMask: 0x3fff, bodyBit: 0x4000, waterBit: 0x8000 };
  const heights = new Uint16Array(cols * rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = c * 0.1;
      const z = r * 0.1;
      const wall = Math.abs(x - 3) <= 0.15 && z >= 1.5 && z <= 4.5;
      heights[r * cols + c] = wall ? Math.round((1 + 5) / 0.001) | 0x4000 : Math.round(5 / 0.001);
    }
  }
  return createWalkMap(meta, heights);
}

describe("finding a way round things", () => {
  const map = lawnWithWall();

  it("knows where a bunny fits", () => {
    expect(footing(map, 1, 3)).toBeCloseTo(0, 3);
    expect(footing(map, 3, 3)).toBeNull(); // on the wall
    expect(footing(map, 2.9, 3)).toBeNull(); // brushing it
  });

  it("goes round the wall, never through it", () => {
    const from = new THREE.Vector3(1, 0, 3);
    const to = new THREE.Vector3(5, 0, 3);
    const path = findPath(map, from, to);
    expect(path).not.toBeNull();
    expect(path.at(-1).distanceTo(to)).toBeLessThan(1e-6);
    let at = from.clone();
    for (const point of path) {
      const length = at.distanceTo(point);
      for (let t = 0; t <= length; t += 0.05) {
        const p = at.clone().lerp(point, length ? t / length : 0);
        expect(map.sample(p.x, p.z).kind).toBe("floor");
      }
      at = point;
    }
    // It turns at an end of the wall rather than wandering.
    expect(path.length).toBeLessThan(6);
  });

  it("walks straight when nothing is in the way", () => {
    const path = findPath(map, new THREE.Vector3(1, 0, 0.5), new THREE.Vector3(5, 0, 0.5));
    expect(path).toHaveLength(1);
  });
});
