import { describe, expect, it } from "vitest";
import { calendarTap, shiftMonth } from "../src/world/slot-art.js";

// The carved calendar is 768 x 1024; days sit in a 7-column grid from x = 70
// (the week starts on Monday, as Mongolian calendars do), rows 92 px apart
// from y = 466, with month arrows either side at y = 322.
const content = { calendar: { month: "2026-10", day: 14 } };
const cellW = (768 - 140) / 7;
const cell = (index) => [70 + cellW / 2 + (index % 7) * cellW, 466 + Math.floor(index / 7) * 92];

describe("tapping the carved calendar", () => {
  it("finds the day under a tap", () => {
    // 1 October 2026 is a Thursday (column 3, Monday being 0).
    expect(calendarTap(content, {}, ...cell(3))).toEqual({ date: "2026-10-01" });
    expect(calendarTap(content, {}, ...cell(3 + 13))).toEqual({ date: "2026-10-14" });
    expect(calendarTap(content, {}, ...cell(3 + 30))).toEqual({ date: "2026-10-31" });
  });

  it("ignores taps between and outside the days", () => {
    expect(calendarTap(content, {}, ...cell(2))).toBeNull(); // the Wednesday before the 1st
    expect(calendarTap(content, {}, 384, 128)).toBeNull(); // the title
  });

  it("browses months with the arrows", () => {
    expect(calendarTap(content, {}, 150, 322)).toEqual({ step: -1 });
    expect(calendarTap(content, {}, 618, 322)).toEqual({ step: 1 });
    expect(shiftMonth(content, {}, 1)).toBe("2026-11");
    expect(shiftMonth(content, { viewMonth: "2026-12" }, 1)).toBe("2027-01");
    expect(shiftMonth(content, { date: "2027-03-08" }, -1)).toBe("2027-02");
  });

  it("reads the days of the month on show", () => {
    // November 2026 starts on a Sunday (the last column).
    expect(calendarTap(content, { viewMonth: "2026-11" }, ...cell(6))).toEqual({ date: "2026-11-01" });
  });
});
