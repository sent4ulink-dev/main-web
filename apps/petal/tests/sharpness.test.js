import { describe, expect, it } from "vitest";
import { detectTier, sharpestRatio } from "../src/core/sharpness.js";

describe("the graphics tier a device starts on", () => {
  it("starts an iPhone on the beautiful tier, though Safari reports only 4 cores", () => {
    expect(detectTier({ phone: true, memory: undefined, cores: 4 })).toBe("high");
  });

  it("starts a roomy Android phone on the beautiful tier, a small-memory one balanced", () => {
    expect(detectTier({ phone: true, memory: 8, cores: 8 })).toBe("high");
    expect(detectTier({ phone: true, memory: 3, cores: 8 })).toBe("medium");
  });

  it("keeps battery saver for clearly weak devices", () => {
    expect(detectTier({ phone: true, memory: 2, cores: 8 })).toBe("low");
    expect(detectTier({ phone: false, cores: 2 })).toBe("low");
  });

  it("gives a computer the beautiful tier (Safari on a Mac reports 4 cores too)", () => {
    expect(detectTier({ phone: false, cores: 4 })).toBe("high");
    expect(detectTier({ phone: false, memory: 8, cores: 16 })).toBe("high");
  });
});

describe("how sharp it draws", () => {
  const iphone = { dpr: 3, width: 390, height: 844 };
  const drawn = (tier, screen) => screen.width * screen.height * sharpestRatio(tier, screen) ** 2;

  it("gives a phone a 1080p-class picture", () => {
    expect(sharpestRatio("medium", iphone)).toBeCloseTo(2.52, 1);
    expect(drawn("medium", iphone)).toBeCloseTo(2.1e6, -5);
  });

  it("never draws past the screen's own pixels", () => {
    expect(sharpestRatio("high", { dpr: 1, width: 1920, height: 1080 })).toBe(1);
    expect(sharpestRatio("high", iphone)).toBe(3);
  });

  it("keeps big screens at least as sharp as before", () => {
    expect(sharpestRatio("medium", { dpr: 2, width: 1536, height: 864 })).toBe(1.75);
    expect(sharpestRatio("high", { dpr: 2, width: 1440, height: 900 })).toBe(2);
  });

  it("stays clear on a phone even on battery saver", () => {
    expect(sharpestRatio("low", iphone)).toBeGreaterThan(1.8);
  });
});
