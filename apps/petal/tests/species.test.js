import { describe, expect, it } from "vitest";
import { BIRD, BUNNY, DUCK, FISH, FROG, OWL, SWAN } from "../src/actors/species.js";
import { MAX_PARTS } from "../src/actors/herd.js";

const SPECIES = { BUNNY, DUCK, FROG, BIRD, FISH, SWAN, OWL };

describe("animal designs", () => {
  for (const [name, species] of Object.entries(SPECIES)) {
    it(`${name} parts and channels are consistent`, () => {
      expect(species.parts.length).toBeLessThanOrEqual(MAX_PARTS);
      const geometry = species.geometry();
      const ids = new Set(geometry.attributes.aPart.array);
      for (const id of ids) {
        expect(Number.isInteger(id)).toBe(true);
        expect(id).toBeGreaterThanOrEqual(0);
        expect(id).toBeLessThan(species.parts.length);
      }
      // Every animated part rotates around a pivot and reads a valid channel.
      species.parts.forEach((spec, id) => {
        for (const key of ["a", "b"]) {
          if (!spec[key]) continue;
          expect(["x", "y", "z"]).toContain(spec[key][0]);
          expect(spec[key][1]).toBeGreaterThanOrEqual(0);
          expect(spec[key][1]).toBeLessThan(8);
        }
        if (spec.parent !== undefined) {
          expect(spec.parent).not.toBe(id);
          expect(species.parts[spec.parent]?.pivot).toBeDefined();
        }
      });
      for (const channel of Object.values(species.channels)) expect(channel).toBeLessThan(8);
      expect(geometry.attributes.color).toBeDefined();
      geometry.dispose();
    });
  }
});
