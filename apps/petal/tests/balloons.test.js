import { describe, expect, it } from "vitest";
import { ambientLoop } from "../src/gameplay/extras.js";

// Closest the decorative balloon's loop ever comes to a route (ground plan).
function closest(loop, route) {
  let min = Infinity;
  for (let i = 0; i < 720; i += 1) {
    const a = (i / 720) * Math.PI * 2;
    const x = Math.cos(a) * loop.rx;
    const z = Math.sin(a) * loop.rz + loop.cz;
    for (const p of route) min = Math.min(min, Math.hypot(p.x - x, p.z - z));
  }
  return min;
}

describe("the two hot-air balloons", () => {
  it("never share airspace, whenever they happen to fly", () => {
    // The ride's waypoints, which cross the default loop at its far end.
    const waypoints = [
      [-19, 1], [-10, 9], [2, 12], [14, 7], [25, -3], [17, -16], [2, -27], [-14, -20], [-26, -6], [-19, 1],
    ];
    const route = [];
    for (let i = 0; i + 1 < waypoints.length; i += 1) {
      for (let k = 0; k < 20; k += 1) {
        const t = k / 20;
        route.push({ x: waypoints[i][0] + (waypoints[i + 1][0] - waypoints[i][0]) * t, z: waypoints[i][1] + (waypoints[i + 1][1] - waypoints[i][1]) * t });
      }
    }
    expect(closest({ rx: 30, rz: 22, cz: -6 }, route)).toBeLessThan(4);
    const loop = ambientLoop(route);
    // Two envelopes of 1.38 m radius, with at least 2.5 m of sky between them.
    expect(closest(loop, route)).toBeGreaterThan(2 * 1.06 * 1.3 + 2.5);
  });

  it("keeps the default loop when there is no ride", () => {
    expect(ambientLoop([])).toEqual({ rx: 30, rz: 22, cx: 0, cz: -6 });
  });
});
