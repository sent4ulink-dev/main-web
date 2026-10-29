import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GAP, SEAT_GAP, createCouple, pushDue, sideFor } from "../src/gameplay/couple.js";
import { SWING_RATE } from "../src/gameplay/swing.js";

// A flat lawn, your bunny standing on it, and the other one (as host.js
// makes it): just what the couple leads.
function world({ surface = () => 0 } = {}) {
  const walker = {
    map: { surface, sample: () => ({ kind: "floor" }) },
    position: new THREE.Vector3(0, 0, 0), heading: 0, sitting: null, grounded: true, gliding: false, busy: false, speed: 0, idle: 0,
    asleep: false, holding: [0, 0], company: null, faces: [],
    setCompany(fn) { this.company = fn; },
    setLookProvider() {},
    express(kind) { this.faces.push(kind); },
  };
  const actor = {
    shown: false, position: new THREE.Vector3(), heading: 0, pose: null, plays: [],
    appear(at, yaw) { this.shown = true; this.position.copy(at); this.heading = yaw; },
    vanish() { this.shown = false; },
    lead(pose) { this.pose = pose; this.position.copy(pose.position); },
    play(type) { this.plays.push(type); },
    holdWand() {}, pointAt() {}, lookAt() {}, turnTo() {}, hop() {}, express() {},
  };
  const fx = { hearts() {}, sparkle() {} };
  return { walker, actor, fx };
}
const frames = (couple, seconds, state, from = 0) => {
  let time = from;
  for (let i = 0; i < Math.round(seconds * 60); i += 1) couple.update((time += 1 / 60), 1 / 60, state);
  return time;
};
const together = { on: true, walking: true };

describe("which side it walks on", () => {
  it("keeps to the side whose paw is free", () => {
    expect(sideFor(-1)).toEqual({ side: -1, hold: true });
    expect(sideFor(-1, { carrots: 2 })).toEqual({ side: 1, hold: true }); // a carrot in that paw
    expect(sideFor(-1, { rain: 0.8 })).toEqual({ side: 1, hold: true }); // …or the umbrella
    expect(sideFor(-1, { rain: 0.8, flowers: 3 })).toEqual({ side: 1, hold: false }); // in the rain: always away from your umbrella
    expect(sideFor(1, { flowers: 5 })).toEqual({ side: -1, hold: true }); // the bouquet is in the other
    expect(sideFor(-1, { flowers: 5, carrots: 1 })).toEqual({ side: -1, hold: false }); // both full: no paw to hold
  });
});

describe("the two of you", () => {
  it("only walks with you once the book's dance is danced", () => {
    const { walker, actor, fx } = world();
    const couple = createCouple({ walker, actor, fx, sfx: {} });
    frames(couple, 1, { on: false, walking: true });
    expect(couple.together).toBe(false);
    expect(actor.shown).toBe(false);
  });

  it("walks at your side, hand in hand, and keeps up", () => {
    const { walker, actor, fx } = world();
    const couple = createCouple({ walker, actor, fx, sfx: {} });
    frames(couple, 1, together);
    expect(couple.together).toBe(true);
    expect(actor.shown).toBe(true);
    expect(couple.position.distanceTo(walker.position)).toBeCloseTo(GAP, 2);
    expect(couple.holding).toBe(true);
    // Paws meet half way between you; yours is the one on its side.
    expect(walker.company().hold.x).toBeCloseTo(couple.position.x / 2, 2);
    expect(walker.company().holdHand).toBe(0);
    expect(actor.pose.holdHand).toBe(1);
    // You walk off (2.2 m/s, along +z): it stays beside you.
    let time = 1;
    for (let i = 0; i < 120; i += 1) {
      walker.position.z += 2.2 / 60;
      walker.speed = 2.2;
      couple.update((time += 1 / 60), 1 / 60, together);
    }
    expect(couple.position.distanceTo(walker.position)).toBeCloseTo(GAP, 1);
    expect(actor.pose.speed).toBeGreaterThan(1.8);
    expect(couple.holding).toBe(true);
  });

  it("goes off to a scene and comes back, and goes home when you stop walking", () => {
    const { walker, actor, fx } = world();
    const couple = createCouple({ walker, actor, fx, sfx: {} });
    frames(couple, 0.5, together);
    frames(couple, 0.2, { ...together, busy: true }); // a board has it
    expect(couple.together).toBe(false);
    expect(walker.company).toBe(null);
    expect(actor.shown).toBe(true); // …and it is the scene's to send away
    frames(couple, 0.5, together);
    expect(couple.together).toBe(true);
    frames(couple, 0.2, { on: true, walking: false });
    expect(actor.shown).toBe(false);
  });

  it("goes behind you where there is no room at your side", () => {
    // A ledge one bunny wide along z.
    const { walker, actor, fx } = world({ surface: (x) => (Math.abs(x) < 0.3 ? 0 : null) });
    const couple = createCouple({ walker, actor, fx, sfx: {} });
    frames(couple, 1.5, together);
    expect(couple.position.x).toBeCloseTo(0, 1);
    expect(couple.position.z).toBeLessThan(-0.4);
    expect(couple.holding).toBe(false);
  });

  it("sits down beside you and leans on you", () => {
    const { walker, actor, fx } = world();
    const couple = createCouple({ walker, actor, fx, sfx: {} });
    const time = frames(couple, 0.5, together);
    walker.sitting = { ground: true };
    frames(couple, 3, together, time);
    expect(couple.mode).toBe("sit");
    expect(actor.pose.sitting).toBe(true);
    expect(couple.position.distanceTo(walker.position)).toBeCloseTo(SEAT_GAP, 2);
    // Each leans towards the other.
    expect(Math.sign(actor.pose.cuddle)).toBe(-Math.sign(walker.company().cuddle));
    expect(Math.abs(walker.company().cuddle)).toBeGreaterThan(0.8);
    expect(couple.holding).toBe(true);
  });

  it("takes the place a bench keeps for it", () => {
    const { walker, actor, fx } = world();
    const couple = createCouple({ walker, actor, fx, sfx: {} });
    const time = frames(couple, 0.5, together);
    walker.position.set(-0.27, 0.45, 2);
    walker.sitting = { pos: [-0.27, 0.45, 2], yaw: 0, edge: 0.1, beside: [0.27, 0.45, 2] };
    frames(couple, 2, together, time);
    expect(couple.position.x).toBeCloseTo(0.27, 2);
    expect(couple.position.y).toBeCloseTo(0.45, 2);
    expect(actor.pose.seat).toBe(true);
  });
});

describe("pushing the swing", () => {
  it("begins a push a little before the seat is furthest back, once a swing", () => {
    const period = (Math.PI * 2) / SWING_RATE;
    const back = Math.PI / 2 / SWING_RATE; // the seat is furthest back
    let due = 0;
    let first = null;
    for (let t = 0; t < period * 3; t += 1 / 60) {
      if (pushDue(t, t + 1 / 60)) {
        due += 1;
        first ??= t;
      }
    }
    expect(due).toBe(3);
    expect(back - first).toBeGreaterThan(0.25);
    expect(back - first).toBeLessThan(0.4);
  });

  it("goes round behind the swing and pushes, and you are all smiles", () => {
    const { walker, actor, fx } = world();
    const swing = { base: new THREE.Vector3(0, 0, 0), yaw: 0, pushed: false };
    const couple = createCouple({ walker, actor, fx, sfx: {}, getSwing: () => swing });
    const time = frames(couple, 0.5, together);
    walker.sitting = { swing: true };
    frames(couple, 8, together, time);
    expect(couple.mode).toBe("push");
    expect(couple.position.z).toBeLessThan(-1); // behind it (it faces +z)
    expect(Math.abs(couple.position.x)).toBeLessThan(0.05);
    expect(swing.pushed).toBe(true);
    expect(actor.plays.filter((type) => type === "push").length).toBeGreaterThanOrEqual(2);
    expect(walker.faces).toContain("happy");
    // You hop off: it lets the swing be.
    walker.sitting = null;
    frames(couple, 0.2, together, time + 8);
    expect(swing.pushed).toBe(false);
  });
});
