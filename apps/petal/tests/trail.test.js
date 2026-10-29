import { describe, expect, it } from "vitest";
import { nextStep } from "../src/gameplay/trail.js";

// The paw-print trail leads to one thing at a time: the first step (in order)
// not done yet.
const step = (key, done) => ({ key, done: () => done });

describe("the paw-print trail's next step", () => {
  it("starts at the first step", () => {
    expect(nextStep([step("activity", false), step("calendar", false)]).key).toBe("activity");
  });

  it("moves on once a step is done", () => {
    expect(nextStep([step("activity", true), step("calendar", false), step("place", false)]).key).toBe("calendar");
  });

  it("goes back for a step skipped earlier", () => {
    expect(nextStep([step("activity", true), step("calendar", false), step("place", true), step("book", false)]).key).toBe("calendar");
  });

  it("rests once everything is done", () => {
    expect(nextStep([step("activity", true), step("book", true)])).toBeNull();
  });
});
