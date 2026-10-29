import * as THREE from 'three';

// Smooth value noise used for terrain, grass fields and scattering (deterministic).
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm(x, y, oct = 4) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; }
  return v;
}

/** Ground height: flat picnic lawn, gentle rolling meadow further out. */
export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  const hills = (fbm(x * 0.025 + 3.1, z * 0.025 - 1.7, 3) - 0.5) * 3.2 + (noise2(x * 0.11, z * 0.11) - 0.5) * 0.25;
  return hills * THREE.MathUtils.smoothstep(r, 7, 45) + (noise2(x * 0.6, z * 0.6) - 0.5) * 0.03;
}

/** Seeded random generator so the meadow looks the same on every visit. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
