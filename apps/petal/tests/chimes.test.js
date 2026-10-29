import { describe, expect, it } from "vitest";
import { createChimes, stoneUnder, TUNES } from "../src/gameplay/chimes.js";

const run = Array.from({ length: 8 }, (_, i) => [0, 1, -i * 0.52]);
const scene = { add() {}, remove() {} };

describe("the path's chiming heart stones", () => {
  it("find the stone under her feet", () => {
    expect(stoneUnder(run, 0.05, -1.04)).toBe(2);
    expect(stoneUnder(run, 0.6, -1.04)).toBe(-1); // beside the run
  });

  it("chime each stone's own note once per step, and cheer a run walked in turn", () => {
    const notes = [];
    let hearts = 0;
    const chimes = createChimes({
      scene, runs: [run], sfx: { note: (midi) => notes.push(midi), twinkle() {} }, fx: { sparkle() {}, hearts: () => (hearts += 1) },
    });
    const at = (z) => ({ x: 0, y: 1, z });
    chimes.update(0.016, at(0));
    chimes.update(0.016, at(-0.05)); // still on the first stone: no second chime
    expect(notes).toEqual([TUNES[0][0]]);
    for (let i = 1; i < 8; i += 1) {
      chimes.update(0.016, at(-i * 0.52 + 0.26)); // between two stones: off both
      chimes.update(0.016, at(-i * 0.52));
    }
    expect(notes).toEqual(TUNES[0]);
    expect(hearts).toBe(1);
    // High above the stones (a hop over them) nothing chimes.
    chimes.update(0.016, { x: 0, y: 2, z: 0 });
    expect(notes.length).toBe(8);
  });

  it("is nothing where the island has no stones", () => {
    expect(createChimes({ scene, runs: [] })).toBeNull();
  });
});
