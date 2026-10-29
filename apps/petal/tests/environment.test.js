import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { TIME_MODES, TIME_PRESETS, WEATHER_MODES, paletteAt, sunDirection } from "../src/world/environment.js";

const elevation = (hours) => THREE.MathUtils.radToDeg(Math.asin(sunDirection(hours).y));

describe("sun path", () => {
  it("rises at 6:30, peaks at 12:30 and sets at 18:30", () => {
    expect(Math.abs(elevation(6.5))).toBeLessThan(0.5);
    expect(elevation(12.5)).toBeCloseTo(58, 0);
    expect(Math.abs(elevation(18.5))).toBeLessThan(0.5);
    expect(elevation(0.5)).toBeLessThan(-50);
  });

  it("moves from east to west through the day", () => {
    const morning = sunDirection(8);
    const evening = sunDirection(17);
    expect(Math.sign(morning.x)).not.toBe(Math.sign(evening.x));
  });

  it("puts every preset where its name says", () => {
    expect(elevation(TIME_PRESETS.noon)).toBeGreaterThan(50);
    expect(elevation(TIME_PRESETS.golden)).toBeGreaterThan(5);
    expect(elevation(TIME_PRESETS.golden)).toBeLessThan(25);
    expect(Math.abs(elevation(TIME_PRESETS.sunset))).toBeLessThan(4);
    expect(elevation(TIME_PRESETS.night)).toBeLessThan(-30);
  });
});

describe("sky palette", () => {
  it("is bright by day and dark by night", () => {
    const day = paletteAt(45, {});
    const night = paletteAt(-30, {});
    const luminance = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    expect(luminance(day.zenith)).toBeGreaterThan(luminance(night.zenith) * 3);
    expect(day.sunI).toBeGreaterThan(1.5);
    expect(night.sunI).toBe(0);
  });

  it("blends smoothly across sunset", () => {
    const a = paletteAt(-1, {});
    const b = paletteAt(1, {});
    expect(Math.abs(a.hemi - b.hemi)).toBeLessThan(0.2);
  });

  it("offers every mode the settings allow", () => {
    expect(TIME_MODES).toContain("cycle");
    expect(TIME_MODES).toContain("live");
    expect(WEATHER_MODES).toEqual(["auto", "clear", "cloudy", "petals", "rain", "snow", "mist"]);
  });
});
