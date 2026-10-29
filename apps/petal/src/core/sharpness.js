// How good a picture a device can afford: the graphics tier it starts on, and
// how many pixels to draw for each CSS pixel.

// Every device starts on the most beautiful tier it can plausibly hold (the
// frame governor in world/stage.js then steps down if it struggles): "low"
// only for clearly weak devices, "medium" for small-memory ones. A core count
// of 4 says nothing: Safari reports 4 on every device with fewer than 8 cores
// (every iPhone among them), and it reports no memory at all.
export function detectTier({ memory, cores } = {}) {
  if ((memory && memory <= 2) || (cores && cores < 4)) return "low";
  if (memory && memory <= 3) return "medium";
  return "high";
}

// Each tier draws at least `ratio` pixels per CSS pixel, and on small screens
// more, up to about `pixels` in all (so a phone gets a 1080p-class picture),
// never past the screen's own pixels (nor 3×).
const SHARPNESS = {
  high: { ratio: 2, pixels: 3.7e6 }, // about 1440p
  medium: { ratio: 1.75, pixels: 2.1e6 }, // about 1080p
  low: { ratio: 1.25, pixels: 1.1e6 }, // about 720p
};

export function sharpestRatio(tier, { dpr = 1, width, height }) {
  const { ratio, pixels } = SHARPNESS[tier] ?? SHARPNESS.medium;
  return Math.min(dpr, 3, Math.max(ratio, Math.sqrt(pixels / Math.max(1, width * height))));
}
