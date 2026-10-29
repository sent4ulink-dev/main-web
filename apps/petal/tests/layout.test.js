import { describe, expect, it } from "vitest";
import { createLayout } from "../src/world/layout.js";
import { turningLines } from "../src/world/island.js";

const play = {
  gate: { pos: [-4.1, 1.4, -33.7], half: 1.45 },
  layout: {
    path: { x: -4.1, from: -2.3, to: -35.6, half: 2.15 },
    moves: { 1: [0, 0, 0], 2: [9.4, 0, -7.25], 3: [-12.5, 0, -12.1], 4: [0.9, 0, -24.1], 5: [-18.7, 0, -26.1] },
    regions: [{ name: "south", x: -4.1, z: -6, r: 13 }, { name: "north", x: -4.1, z: -26, r: 11 }, { name: "hub", x: -4.1, z: -45.2, r: 4.9 }],
  },
};

describe("the island's layout", () => {
  it("puts a spot of the first layout where its garden stands now", () => {
    const layout = createLayout(play);
    // The question garden stays where it was; the others moved along the path.
    expect(layout.spot([-5.5, 1.7, 4.7])).toEqual([-5.5, 1.7, 4.7]);
    expect(layout.gardenAt(-5.15, -1.2)).toBe(2);
    expect(layout.spot([-5.15, 1.82, -1.2])).toEqual([-5.15 + 9.4, 1.82, -1.2 - 7.25]);
    expect(layout.gardenAt(5.7, -4.4)).toBe(5);
    // A view names its garden, so its camera (which stands back, over the
    // next garden as first laid out) goes with the board it looks at.
    expect(layout.spot([-5.15, 3.65, 4.6], 2)).toEqual([-5.15 + 9.4, 3.65, 4.6 - 7.25]);
  });

  it("finds the part of the island a spot is in by the nearest rim", () => {
    const layout = createLayout(play);
    expect(layout.regionOf(-5, 4)).toBe("south");
    expect(layout.regionOf(-13, -30)).toBe("north");
    expect(layout.regionOf(-4, -46)).toBe("hub");
  });

  it("works without a layout (an island built before the path)", () => {
    const layout = createLayout(null);
    expect(layout.spot([1, 2, 3])).toEqual([1, 2, 3]);
    expect(layout.regionOf(0, 0)).toBe("main");
    expect(layout.gate).toBeNull();
  });
});

describe("the signs at the turnings", () => {
  it("number the gardens and break a long name in two", () => {
    expect(turningLines(2, "Calendar Tree")).toEqual(["2 · Calendar Tree"]);
    expect(turningLines(1, "Adventure Garden")).toEqual(["1 · Adventure", "Garden"]);
    expect(turningLines(4, "Crossroads of the Isles")).toEqual(["4 · Crossroads", "of the Isles"]);
  });
});
