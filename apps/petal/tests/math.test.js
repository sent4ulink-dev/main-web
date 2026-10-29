import { describe, expect, it } from "vitest";
import { Spring, approachAngle, damp, seeded, smoothstep, wrapAngle } from "../src/core/math.js";

describe("math helpers", () => {
  it("damps toward a target independent of frame rate", () => {
    let fast = 0;
    for (let i = 0; i < 60; i += 1) fast = damp(fast, 1, 5, 1 / 60);
    let slow = 0;
    for (let i = 0; i < 20; i += 1) slow = damp(slow, 1, 5, 1 / 20);
    expect(fast).toBeCloseTo(slow, 6);
  });

  it("wraps and approaches angles the short way round", () => {
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 6);
    const turned = approachAngle(3.0, -3.0, 1000, 1);
    expect(Math.abs(wrapAngle(turned - -3.0))).toBeLessThan(1e-9);
  });

  it("smoothsteps between edges", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it("produces repeatable random sequences", () => {
    const a = seeded(42);
    const b = seeded(42);
    for (let i = 0; i < 5; i += 1) expect(a()).toBe(b());
  });

  it("settles a spring and stays stable with long frames", () => {
    const spring = new Spring(120, 14);
    for (let i = 0; i < 40; i += 1) spring.update(1, 0.1);
    expect(spring.value).toBeCloseTo(1, 3);
    spring.impulse(5);
    spring.update(1, 0.02);
    expect(spring.value).toBeGreaterThan(1);
  });
});
