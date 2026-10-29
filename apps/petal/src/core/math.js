// Small, allocation-free math helpers shared by every system.

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const saturate = (value) => clamp(value, 0, 1);

// Frame-rate independent exponential smoothing toward a target.
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

export function smoothstep(edge0, edge1, x) {
  const t = saturate((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// Wrap an angle to (-PI, PI].
export const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

// Turn `current` toward `target` along the shortest way.
export const approachAngle = (current, target, rate, dt) => current + wrapAngle(target - current) * Math.min(1, rate * dt);

// Deterministic pseudo-random numbers (Park–Miller), for stable layouts.
export function seeded(seed = 1) {
  let s = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// A damped spring for secondary motion (ears, skirts, squash and stretch).
// Sub-stepped so it stays stable when a slow phone delivers long frames.
export class Spring {
  constructor(stiffness = 120, damping = 12, value = 0) {
    this.stiffness = stiffness;
    this.damping = damping;
    this.value = value;
    this.velocity = 0;
  }

  update(target, dt) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      const accel = (target - this.value) * this.stiffness - this.velocity * this.damping;
      this.velocity += accel * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  // Add a sudden kick (a landing thump, a bump).
  impulse(amount) {
    this.velocity += amount;
  }

  reset(value = 0) {
    this.value = value;
    this.velocity = 0;
  }
}
