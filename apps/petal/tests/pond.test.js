import { describe, expect, it } from "vitest";
import { createWalkMap } from "../src/world/walkmap.js";
import { bankSpots, isOpenWater, koiJump, planLanes, ringIsClear } from "../src/actors/pond.js";

// A 3 m pond centred on (0, 0) at 10 cm cells, with a wooden dock reaching in
// from the west (to x = -2.1) and a rowboat moored by the south bank.
const R = 3;
const inBoat = (x, z) => Math.abs(x) < 0.75 && Math.abs(z - 2.55) < 0.32;
const inDock = (x, z) => x < -2.1 && Math.abs(z) < 0.45;

function makePond() {
  const cell = 0.1;
  const cols = 101;
  const rows = 101;
  const x0 = -5;
  const z0 = -5;
  const meta = { version: 2, x0, z0, cell, cols, rows, offset: 5, scale: 0.001, heightMask: 0x3fff, bodyBit: 0x4000, waterBit: 0x8000 };
  const heights = new Uint16Array(cols * rows);
  const materials = new Uint8Array(cols * rows);
  const encode = (y) => Math.round((y + 5) / 0.001);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c;
      const x = x0 + c * cell;
      const z = z0 + r * cell;
      heights[i] = encode(0.1);
      materials[i] = 1; // grass bank
      if (Math.hypot(x, z) < R) {
        heights[i] = encode(0) | 0x8000;
        materials[i] = 4; // water
        if (inDock(x, z)) materials[i] = 3; // planks over the water
        if (inBoat(x, z)) {
          heights[i] = encode(0.25) | 0x4000;
          materials[i] = 3;
        }
      }
    }
  }
  return createWalkMap(meta, heights, materials);
}

const map = makePond();
const open = (x, z) => isOpenWater(map, x, z);
const center = { x: 0, y: 0, z: 0 };
const LANES = [
  { name: "mum", share: 0.6, half: 0.12 },
  { name: "duck", share: 0.47, half: 0.12 },
  { name: "duck", share: 0.33, half: 0.12 },
  { name: "swans", share: 0.17, half: 0.2 },
];

describe("pond navigation", () => {
  it("only counts real open water", () => {
    expect(open(0, 0)).toBe(true);
    expect(open(-2.5, 0)).toBe(false); // the dock
    expect(open(0, 2.55)).toBe(false); // the boat
    expect(open(0, -3.5)).toBe(false); // the bank
  });

  it("plans nested lanes that clear the dock, the boat and each other", () => {
    const lanes = planLanes(open, center, R, LANES);
    expect(lanes.every((l) => l.clear)).toBe(true);
    for (const lane of lanes) expect(ringIsClear(open, 0, 0, lane.radius, lane.half)).toBe(true);
    for (let i = 1; i < lanes.length; i += 1) {
      expect(lanes[i - 1].radius - lanes[i - 1].half).toBeGreaterThan(lanes[i].radius + lanes[i].half);
    }
    // The outer lane had to move in to pass the dock's end at 2.1 m.
    expect(lanes[0].radius + lanes[0].half).toBeLessThan(2.1);
  });

  it("keeps blocked lanes apart instead of stacking them", () => {
    const lanes = planLanes(() => false, center, R, LANES);
    expect(lanes.every((l) => !l.clear)).toBe(true);
    for (let i = 1; i < lanes.length; i += 1) {
      expect(lanes[i - 1].radius - lanes[i - 1].half).toBeGreaterThan(lanes[i].radius + lanes[i].half);
    }
  });

  it("puts the frogs on the bank, never on the dock or the boat", () => {
    const spots = bankSpots(map, open, center, R, 12);
    expect(spots.length).toBeGreaterThanOrEqual(8);
    for (const s of spots) {
      const ground = map.sample(s.x, s.z);
      expect(ground.kind).toBe("floor");
      expect(ground.water).toBe(false);
      expect(inDock(s.x, s.z) || inBoat(s.x, s.z)).toBe(false);
      expect(Math.hypot(s.x, s.z)).toBeGreaterThan(R - 0.05);
    }
  });

  it("lets the koi jump only in open water, away from busy spots", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const busy = (x, z) => Math.hypot(x - 1, z) < 0.6;
    for (let i = 0; i < 40; i += 1) {
      const jump = koiJump(open, center, R, { rand, busy });
      expect(jump).not.toBeNull();
      for (const p of [jump.from, jump.to]) {
        expect(open(p.x, p.z)).toBe(true);
        expect(busy(p.x, p.z)).toBe(false);
      }
    }
  });
});
