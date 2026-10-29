import * as THREE from "three";
import { colored, sphere } from "../core/geometry.js";
import { part, partGeometry } from "./herd.js";

// Designs of the island's residents, as part-tagged geometry for herd.js.
// Web axes: +y up, +z forward. Channel numbers are the eight per-animal
// animation values the behaviour code writes every frame.

const INK = "#3a2733";
const WHITE = "#ffffff";

const cone = (radius, height, color, position, rotation = [0, 0, 0], segments = 7) => {
  const g = new THREE.ConeGeometry(radius, height, segments);
  g.rotateX(rotation[0]);
  g.rotateY(rotation[1]);
  g.rotateZ(rotation[2]);
  g.translate(...position);
  return colored(g, color);
};
// A sphere scaled along its own axes, tilted, then moved (ears, wings, feet).
const blob = (radius, color, scale, tilt, position, detail = 10) => {
  const g = new THREE.SphereGeometry(radius, detail, Math.round(detail * 0.75));
  g.scale(...scale);
  g.rotateX(tilt[0]);
  g.rotateY(tilt[1]);
  g.rotateZ(tilt[2]);
  g.translate(...position);
  return colored(g, color);
};
const eyes = (x, y, z, r = 0.016, color = INK) => [
  sphere(r, color, [-x, y, z], [0.9, 1.15, 0.6], 8),
  sphere(r, color, [x, y, z], [0.9, 1.15, 0.6], 8),
  sphere(r * 0.32, WHITE, [-x + r * 0.3, y + r * 0.45, z + r * 0.55], [1, 1, 0.6], 6),
  sphere(r * 0.32, WHITE, [x + r * 0.3, y + r * 0.45, z + r * 0.55], [1, 1, 0.6], 6),
];

// Channels: 0 head yaw, 1 head pitch, 2 left ear, 3 right ear, 4 tail wag,
// 5 hind legs, 6 blink.
export const BUNNY = {
  channels: { yaw: 0, pitch: 1, earL: 2, earR: 3, tail: 4, legs: 5, blink: 6 },
  parts: [
    {},
    { pivot: [0, 0.16, 0.06], a: ["y", 0], b: ["x", 1] },
    { pivot: [-0.03, 0.245, 0.075], a: ["x", 2], parent: 1 },
    { pivot: [0.03, 0.245, 0.075], a: ["x", 3], parent: 1 },
    { pivot: [0, 0.2, 0.152], a: ["y", 6], kind: "blink", parent: 1 },
    { pivot: [0, 0.1, -0.12], a: ["z", 4] },
    { pivot: [0, 0.05, -0.03], a: ["x", 5] },
  ],
  geometry() {
    const ear = (side) => [
      blob(0.028, WHITE, [0.8, 2.6, 0.55], [0.1, 0, -side * 0.18], [side * 0.03 + side * 0.012, 0.31, 0.07]),
      blob(0.015, "#ffc2d6", [0.7, 2.3, 0.3], [0.1, 0, -side * 0.18], [side * 0.03 + side * 0.012, 0.31, 0.083]),
    ];
    return partGeometry([
      part(0, sphere(0.1, WHITE, [0, 0.1, -0.01], [1, 0.9, 1.2], 14)),
      part(0, sphere(0.062, "#fff8f2", [0, 0.1, 0.068], [1, 1, 0.8], 10)),
      part(0, sphere(0.026, WHITE, [-0.035, 0.022, 0.085], [1, 0.7, 1.3], 8)),
      part(0, sphere(0.026, WHITE, [0.035, 0.022, 0.085], [1, 0.7, 1.3], 8)),
      part(1, sphere(0.07, WHITE, [0, 0.19, 0.1], [1.05, 0.95, 1], 14)),
      part(1, sphere(0.034, WHITE, [-0.034, 0.17, 0.14], [1, 0.8, 0.9], 8)),
      part(1, sphere(0.034, WHITE, [0.034, 0.17, 0.14], [1, 0.8, 0.9], 8)),
      part(1, sphere(0.011, "#ff8fb0", [0, 0.182, 0.168], [1.2, 0.8, 0.7], 6)),
      part(1, sphere(0.016, "#ffc6d6", [-0.046, 0.172, 0.146], [1.2, 0.7, 0.4], 6)),
      part(1, sphere(0.016, "#ffc6d6", [0.046, 0.172, 0.146], [1.2, 0.7, 0.4], 6)),
      ...ear(-1).map((g) => part(2, g)),
      ...ear(1).map((g) => part(3, g)),
      ...eyes(0.036, 0.2, 0.15, 0.016).map((g) => part(4, g)),
      part(5, sphere(0.034, WHITE, [0, 0.11, -0.132], [1, 1, 1], 8)),
      part(6, blob(0.034, WHITE, [0.75, 0.55, 1.5], [0, 0, 0], [-0.056, 0.03, -0.035])),
      part(6, blob(0.034, WHITE, [0.75, 0.55, 1.5], [0, 0, 0], [0.056, 0.03, -0.035])),
    ]);
  },
};

// Channels: 0 head yaw, 1 head pitch, 2 left wing, 3 right wing, 4 tail wag, 6 blink.
export const DUCK = {
  channels: { yaw: 0, pitch: 1, wingL: 2, wingR: 3, tail: 4, blink: 6 },
  parts: [
    {},
    { pivot: [0, 0.11, 0.08], a: ["y", 0], b: ["x", 1] },
    { pivot: [-0.07, 0.1, 0.0], a: ["z", 2] },
    { pivot: [0.07, 0.1, 0.0], a: ["z", 3, -1] },
    { pivot: [0, 0.205, 0.14], a: ["y", 6], kind: "blink", parent: 1 },
    { pivot: [0, 0.08, -0.11], a: ["y", 4] },
  ],
  geometry() {
    return partGeometry([
      part(0, sphere(0.12, "#fffaf0", [0, 0.06, 0], [0.85, 0.62, 1.2], 14)),
      part(0, sphere(0.07, "#fffdf8", [0, 0.07, 0.08], [1, 0.9, 1], 10)),
      part(1, sphere(0.045, "#fffaf0", [0, 0.14, 0.09], [1, 1.35, 1], 10)),
      part(1, sphere(0.06, "#fffaf0", [0, 0.195, 0.105], [1, 0.95, 1], 12)),
      part(1, blob(0.03, "#ffa94d", [1.1, 0.42, 1.35], [0, 0, 0], [0, 0.18, 0.168])),
      part(1, sphere(0.014, "#ffc6d6", [-0.04, 0.18, 0.14], [1.2, 0.7, 0.4], 6)),
      part(1, sphere(0.014, "#ffc6d6", [0.04, 0.18, 0.14], [1.2, 0.7, 0.4], 6)),
      part(2, blob(0.06, "#f3eadb", [0.32, 0.62, 1.15], [0, 0, 0.2], [-0.088, 0.075, -0.01])),
      part(3, blob(0.06, "#f3eadb", [0.32, 0.62, 1.15], [0, 0, -0.2], [0.088, 0.075, -0.01])),
      ...eyes(0.03, 0.205, 0.142, 0.011).map((g) => part(4, g)),
      part(5, cone(0.045, 0.09, "#f3eadb", [0, 0.1, -0.14], [-Math.PI / 2.6, 0, 0], 6)),
    ]);
  },
};

// Channels: 4 throat puff, 5 back legs, 6 blink.
export const FROG = {
  channels: { throat: 4, legs: 5, blink: 6 },
  parts: [
    {},
    {},
    {},
    {},
    { pivot: [0, 0.1, 0.05], a: ["y", 6], kind: "blink" },
    { pivot: [0, 0.035, 0.065], a: ["y", 4], kind: "puff" },
    { pivot: [0, 0.03, -0.03], a: ["x", 5] },
  ],
  geometry() {
    return partGeometry([
      part(0, sphere(0.07, "#86d484", [0, 0.05, 0], [1.1, 0.72, 1], 12)),
      part(0, sphere(0.05, "#d4f5b4", [0, 0.035, 0.03], [1, 0.6, 0.9], 10)),
      part(0, blob(0.022, "#86d484", [0.7, 0.5, 1.4], [0, 0, 0], [-0.045, 0.018, 0.06])),
      part(0, blob(0.022, "#86d484", [0.7, 0.5, 1.4], [0, 0, 0], [0.045, 0.018, 0.06])),
      part(0, sphere(0.012, "#ffadc4", [-0.052, 0.07, 0.062], [1, 0.6, 0.5], 6)),
      part(0, sphere(0.012, "#ffadc4", [0.052, 0.07, 0.062], [1, 0.6, 0.5], 6)),
      part(4, sphere(0.028, "#86d484", [-0.04, 0.095, 0.035], [1, 1, 1], 10)),
      part(4, sphere(0.028, "#86d484", [0.04, 0.095, 0.035], [1, 1, 1], 10)),
      ...eyes(0.042, 0.103, 0.058, 0.013).map((g) => part(4, g)),
      part(5, sphere(0.03, "#f2dccb", [0, 0.035, 0.062], [1.15, 0.8, 0.8], 8)),
      part(6, blob(0.03, "#78c676", [1.2, 0.5, 1.7], [0, 0.3, 0], [-0.062, 0.022, -0.025])),
      part(6, blob(0.03, "#78c676", [1.2, 0.5, 1.7], [0, -0.3, 0], [0.062, 0.022, -0.025])),
    ]);
  },
};

// Channels: 0 head yaw, 1 head pitch (pecking), 2 left wing, 3 right wing, 4 tail, 6 blink.
export const BIRD = {
  channels: { yaw: 0, pitch: 1, wingL: 2, wingR: 3, tail: 4, blink: 6 },
  parts: [
    {},
    { pivot: [0, 0.09, 0.03], a: ["y", 0], b: ["x", 1] },
    { pivot: [-0.04, 0.085, 0], a: ["z", 2] },
    { pivot: [0.04, 0.085, 0], a: ["z", 3, -1] },
    { pivot: [0, 0.125, 0.07], a: ["y", 6], kind: "blink", parent: 1 },
    { pivot: [0, 0.07, -0.05], a: ["x", 4] },
  ],
  geometry() {
    return partGeometry([
      part(0, sphere(0.055, WHITE, [0, 0.06, 0], [0.9, 0.85, 1.1], 12)),
      part(0, sphere(0.04, "#fff8ee", [0, 0.05, 0.03], [0.9, 0.8, 0.9], 8)),
      part(1, sphere(0.04, WHITE, [0, 0.115, 0.04], [1, 1, 1], 10)),
      part(1, cone(0.012, 0.035, "#ffb347", [0, 0.11, 0.087], [Math.PI / 2, 0, 0], 5)),
      part(1, sphere(0.011, "#ffc6d6", [-0.026, 0.104, 0.062], [1, 0.7, 0.5], 6)),
      part(1, sphere(0.011, "#ffc6d6", [0.026, 0.104, 0.062], [1, 0.7, 0.5], 6)),
      part(2, blob(0.03, WHITE, [0.4, 0.8, 1.3], [0, 0, 0.3], [-0.05, 0.062, -0.008])),
      part(3, blob(0.03, WHITE, [0.4, 0.8, 1.3], [0, 0, -0.3], [0.05, 0.062, -0.008])),
      ...eyes(0.022, 0.123, 0.068, 0.009).map((g) => part(4, g)),
      part(5, cone(0.022, 0.06, WHITE, [0, 0.07, -0.075], [-Math.PI / 2.3, 0, 0], 4)),
    ]);
  },
};

// Channels: 4 tail swish.
export const FISH = {
  channels: { tail: 4 },
  parts: [{}, {}, {}, {}, {}, { pivot: [0, 0, -0.085], a: ["y", 4] }],
  geometry() {
    return partGeometry([
      part(0, sphere(0.07, WHITE, [0, 0, 0], [0.6, 0.7, 1.4], 12)),
      part(0, sphere(0.03, "#ff8a3d", [0.02, 0.03, 0.02], [0.8, 0.8, 1.3], 8)),
      part(0, sphere(0.024, "#ff8a3d", [-0.015, 0.035, -0.04], [0.8, 0.7, 1.2], 8)),
      part(0, sphere(0.009, INK, [0.035, 0.015, 0.07], [1, 1, 1], 6)),
      part(0, sphere(0.009, INK, [-0.035, 0.015, 0.07], [1, 1, 1], 6)),
      part(5, blob(0.05, "#fff0e6", [0.25, 0.9, 1], [0, 0, 0], [0, 0, -0.12])),
    ]);
  },
};

// Channels: 0 neck yaw, 1 neck pitch, 2 left wing, 3 right wing, 6 blink.
export const SWAN = {
  channels: { yaw: 0, pitch: 1, wingL: 2, wingR: 3, blink: 6 },
  parts: [
    {},
    { pivot: [0, 0.12, 0.14], a: ["y", 0], b: ["x", 1] },
    { pivot: [-0.1, 0.13, 0], a: ["z", 2] },
    { pivot: [0.1, 0.13, 0], a: ["z", 3, -1] },
    { pivot: [0, 0.43, 0.23], a: ["y", 6], kind: "blink", parent: 1 },
  ],
  geometry() {
    const neck = [];
    const curve = [[0, 0.14, 0.15], [0, 0.2, 0.19], [0, 0.26, 0.19], [0, 0.32, 0.165], [0, 0.37, 0.17], [0, 0.41, 0.195]];
    curve.forEach(([x, y, z], i) => neck.push(part(1, sphere(0.034 - i * 0.002, WHITE, [x, y, z], [1, 1.2, 1], 10))));
    return partGeometry([
      part(0, sphere(0.16, WHITE, [0, 0.08, 0], [0.8, 0.52, 1.2], 16)),
      part(0, cone(0.07, 0.14, WHITE, [0, 0.13, -0.2], [-Math.PI / 2.5, 0, 0], 8)),
      ...neck,
      part(1, sphere(0.045, WHITE, [0, 0.425, 0.215], [1, 0.95, 1.15], 12)),
      part(1, cone(0.02, 0.07, "#ff9a4d", [0, 0.415, 0.275], [Math.PI / 2.2, 0, 0], 8)),
      part(1, sphere(0.012, "#ffc6d6", [-0.03, 0.41, 0.235], [1, 0.7, 0.5], 6)),
      part(1, sphere(0.012, "#ffc6d6", [0.03, 0.41, 0.235], [1, 0.7, 0.5], 6)),
      part(2, blob(0.12, "#f7f3ee", [0.32, 0.5, 1.1], [0, 0, 0.25], [-0.1, 0.12, -0.02])),
      part(3, blob(0.12, "#f7f3ee", [0.32, 0.5, 1.1], [0, 0, -0.25], [0.1, 0.12, -0.02])),
      ...eyes(0.026, 0.435, 0.238, 0.01).map((g) => part(4, g)),
    ]);
  },
};

// Channels: 0 head yaw, 1 head pitch, 2 left wing, 3 right wing, 6 blink.
export const OWL = {
  channels: { yaw: 0, pitch: 1, wingL: 2, wingR: 3, blink: 6 },
  parts: [
    {},
    { pivot: [0, 0.15, 0], a: ["y", 0], b: ["x", 1] },
    { pivot: [-0.07, 0.14, 0], a: ["z", 2] },
    { pivot: [0.07, 0.14, 0], a: ["z", 3, -1] },
    { pivot: [0, 0.205, 0.07], a: ["y", 6], kind: "blink", parent: 1 },
  ],
  geometry() {
    return partGeometry([
      part(0, sphere(0.08, "#b88f6e", [0, 0.09, 0], [1, 1.2, 0.95], 14)),
      part(0, sphere(0.055, "#f1dcc3", [0, 0.08, 0.04], [1, 1.2, 0.7], 10)),
      part(0, sphere(0.018, "#ffb347", [-0.025, 0.005, 0.03], [1, 0.5, 1.3], 6)),
      part(0, sphere(0.018, "#ffb347", [0.025, 0.005, 0.03], [1, 0.5, 1.3], 6)),
      part(1, sphere(0.07, "#b88f6e", [0, 0.2, 0.01], [1.12, 0.92, 1], 14)),
      part(1, sphere(0.05, "#f6e7d4", [0, 0.2, 0.045], [1.3, 0.95, 0.6], 12)),
      part(1, cone(0.018, 0.05, "#9c7456", [-0.05, 0.265, 0], [0, 0, 0.35], 5)),
      part(1, cone(0.018, 0.05, "#9c7456", [0.05, 0.265, 0], [0, 0, -0.35], 5)),
      part(1, cone(0.01, 0.025, "#ffb347", [0, 0.19, 0.078], [Math.PI / 1.6, 0, 0], 5)),
      part(2, blob(0.06, "#a47d5e", [0.35, 0.95, 0.9], [0, 0, 0.15], [-0.075, 0.09, -0.01])),
      part(3, blob(0.06, "#a47d5e", [0.35, 0.95, 0.9], [0, 0, -0.15], [0.075, 0.09, -0.01])),
      ...eyes(0.03, 0.207, 0.068, 0.02, "#2e2230").map((g) => part(4, g)),
      part(4, sphere(0.024, "#ffe9a8", [-0.03, 0.207, 0.062], [1, 1, 0.5], 10)),
      part(4, sphere(0.024, "#ffe9a8", [0.03, 0.207, 0.062], [1, 1, 0.5], 10)),
    ]);
  },
};
