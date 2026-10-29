import { describe, expect, it } from "vitest";
import { createWalkMap } from "../src/world/walkmap.js";

// A 10 x 10 map at 10 cm cells: floor at y = 0, a bench-like body (top 0.45 m)
// in the middle, a pond corner and one open-sky column.
function makeMap() {
  const cols = 10;
  const rows = 10;
  const meta = { version: 2, x0: 0, z0: 0, cell: 0.1, cols, rows, offset: 5, scale: 0.001, heightMask: 0x3fff, bodyBit: 0x4000, waterBit: 0x8000 };
  const heights = new Uint16Array(cols * rows);
  const materials = new Uint8Array(cols * rows);
  const encode = (y) => Math.round((y + 5) / 0.001);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c;
      heights[i] = encode(0);
      materials[i] = 1; // grass
      if (c >= 4 && c <= 6 && r >= 4 && r <= 6) {
        heights[i] = encode(0.45) | 0x4000;
        materials[i] = 3; // wood
      }
      if (c >= 8 && r >= 8) {
        heights[i] |= 0x8000;
        materials[i] = 4; // water
      }
      if (c === 0) heights[i] = 0;
    }
  }
  return createWalkMap(meta, heights, materials);
}

describe("walk map", () => {
  it("reads floors, body tops and open sky", () => {
    const map = makeMap();
    expect(map.surface(0.2, 0.2)).toBeCloseTo(0, 3);
    expect(map.surface(0.5, 0.5)).toBeCloseTo(0.45, 3);
    expect(map.surface(0.0, 0.5)).toBeNull();
  });

  it("classifies cells with material and water", () => {
    const map = makeMap();
    expect(map.sample(0.5, 0.5)).toMatchObject({ kind: "body", material: "wood", water: false });
    expect(map.sample(0.2, 0.2)).toMatchObject({ kind: "floor", material: "grass", water: false });
    expect(map.sample(0.9, 0.9)).toMatchObject({ kind: "floor", material: "water", water: true });
    expect(map.sample(0.0, 0.3).kind).toBe("void");
  });

  it("does not blend floors into the edge of a body", () => {
    const map = makeMap();
    // Right next to the bench the floor must stay flat, not ramp up.
    expect(map.surface(0.34, 0.5)).toBeCloseTo(0, 3);
  });

  it("supports the bunny on the highest point of its footprint", () => {
    const map = makeMap();
    const edge = map.support(0.3, 0.5, 0.12);
    expect(edge.height).toBeCloseTo(0.45, 3);
    expect(edge.voids).toBe(0);
    const cliff = map.support(0.1, 0.5, 0.12);
    expect(cliff.voids).toBeGreaterThan(0);
  });

  it("lets runtime props add and remove bodies", () => {
    const map = makeMap();
    const id = map.addCollider({ type: "circle", x: 0.25, z: 0.25, radius: 0.08 }, 0.9);
    expect(map.surface(0.25, 0.25)).toBeCloseTo(0.9, 3);
    expect(map.sample(0.25, 0.25).kind).toBe("body");
    map.removeCollider(id);
    expect(map.surface(0.25, 0.25)).toBeCloseTo(0, 3);
  });

  it("supports rotated box colliders and moving tops", () => {
    const map = makeMap();
    let top = 0.2;
    map.addCollider({ type: "box", x: 0.3, z: 0.8, halfX: 0.15, halfZ: 0.03, yaw: Math.PI / 2 }, () => top);
    // Rotated a quarter turn, the long side runs along z.
    expect(map.surface(0.3, 0.9)).toBeCloseTo(0.2, 3);
    expect(map.surface(0.42, 0.8)).toBeCloseTo(0, 3);
    top = 0.6;
    expect(map.surface(0.3, 0.9)).toBeCloseTo(0.6, 3);
  });

  it("still understands version 1 maps (1 = obstacle)", () => {
    const meta = { x0: 0, z0: 0, cell: 0.1, cols: 2, rows: 1, offset: 5, scale: 0.001 };
    const map = createWalkMap(meta, new Uint16Array([1, 5000]));
    expect(map.surface(0, 0)).toBeGreaterThan(10);
    expect(map.surface(0.1, 0)).toBeCloseTo(0, 3);
  });
});
