import { describe, expect, it } from "vitest";
import { listing, longDate, mediumDate, weekColumn } from "../src/core/dates.js";

describe("dates in English", () => {
  it("writes a date out", () => {
    expect(longDate("2026-10-23")).toBe("October 23, 2026");
    expect(longDate("2027-12-01")).toBe("December 1, 2027");
    expect(mediumDate("2026-10-23")).toBe("Oct 23, 2026");
  });

  it("names the weekday", () => {
    expect(longDate("2026-10-23", { weekday: true })).toBe("Friday, October 23, 2026");
    expect(longDate("2026-11-01", { weekday: true })).toBe("Sunday, November 1, 2026");
  });

  it("starts the week on Monday", () => {
    expect(weekColumn(new Date(2026, 9, 5))).toBe(0); // a Monday
    expect(weekColumn(new Date(2026, 9, 4))).toBe(6); // a Sunday
  });

  it("lists things with “and”", () => {
    expect(listing(["day"])).toBe("day");
    expect(listing(["day", "place"])).toBe("day and place");
    expect(listing(["day", "adventure", "place"])).toBe("day, adventure and place");
  });
});
