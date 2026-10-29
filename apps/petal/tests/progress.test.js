import { describe, expect, it } from "vitest";
import { createProgress } from "../src/gameplay/progress.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
}

describe("walkthrough progress", () => {
  it("reads the save format of earlier versions", () => {
    const storage = memoryStorage({ "petal-isle-play": JSON.stringify({ done: ["wish"], picked: 7, hearts: [1, 4], lamps: [0, 2, 3] }) });
    expect([...createProgress({ storage }).hearts]).toEqual([1, 4]);
  });

  it("keeps the hearts found", () => {
    const storage = memoryStorage();
    const progress = createProgress({ storage });
    progress.hearts.add(3);
    progress.save();
    expect([...createProgress({ storage }).hearts]).toEqual([3]);
  });

  it("ignores corrupt saves", () => {
    expect(createProgress({ storage: memoryStorage({ "petal-isle-play": "{oops" }) }).hearts.size).toBe(0);
  });
});
