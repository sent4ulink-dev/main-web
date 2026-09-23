import { describe, it, expect } from "vitest";
import { contentSchema, freshContent } from "../shared/content";
import {
  transition,
  initialFlow,
  makePlan,
  resolveMode,
  canEdit,
  buildShareUrl,
  validDateTime,
  type Flow,
} from "../shared/flow";
import { emptyBoard, reveal, found } from "../shared/game";
import { calendar, foldLine, planText, smsUrl } from "../src/exports";
const c = freshContent(),
  now = new Date("2026-09-09T10:00:00");
const s = {
  activityId: "coffee",
  date: "2026-10-20",
  time: "18:30",
  place: "Тухтай кафе, 2; давхар\\цонх",
};
describe("story state machine", () => {
  it("refreshes saved plan copy without losing confirmed selections", () => {
    const state: Flow = {
      ...initialFlow(),
      scene: "final",
      selection: s,
      plan: makePlan(c, s, now),
    };
    const updated = transition(state, {
      type: "refresh",
      content: { ...c, finalHeading: "See you soon", finalEmoticon: "wink" },
    });
    expect(updated.scene).toBe("final");
    expect(updated.selection).toEqual(s);
    expect(updated.plan).toMatchObject({
      ...s,
      heading: "See you soon",
      finalEmoticon: "wink",
    });
    expect(
      transition(state, {
        type: "refresh",
        content: {
          ...c,
          activities: c.activities.filter((a) => a.id !== s.activityId),
        },
      }),
    ).toMatchObject({ scene: "activity", plan: null });
  });
  it("No cycles indefinitely and never advances", () => {
    let f = { ...initialFlow(), scene: "invitation" } as Flow;
    for (let i = 0; i < 120; i++) {
      f = transition(f, { type: "no" });
      expect(f.scene).toBe("invitation");
      expect(c.noResponses[(f.noCount - 1) % c.noResponses.length]).toBe(
        c.noResponses[i % c.noResponses.length],
      );
    }
  });
  it("Yes advances and duplicate events cannot jump scenes", () => {
    const event = {
      type: "next" as const,
      from: "invitation" as const,
      content: c,
    };
    const first = transition({ ...initialFlow(), scene: "invitation" }, event);
    expect(first.scene).toBe("connecting");
    expect(transition(first, event)).toEqual(first);
  });
  it("requires exactly five hearts", () => {
    for (const hearts of [0, 1, 2, 3, 4])
      expect(
        transition(
          { ...initialFlow(), scene: "game", hearts },
          { type: "next", from: "game", content: c },
        ).scene,
      ).toBe("game");
    expect(
      transition(
        { ...initialFlow(), scene: "game", hearts: 5 },
        { type: "next", from: "game", content: c },
      ).scene,
    ).toBe("activity");
  });
  it("back navigation preserves date/time/place", () => {
    const f = { ...initialFlow(), scene: "place" as const, selection: s };
    expect(transition(f, { type: "back" })).toMatchObject({
      scene: "date",
      selection: s,
    });
  });
  it("changing activity clears place but preserves the date", () => {
    const f = transition(
      { ...initialFlow(), selection: s },
      { type: "select", patch: { activityId: "movie" } },
    );
    expect(f.selection).toEqual({ ...s, activityId: "movie", place: "" });
  });
  it("blocks incomplete and past plans", () => {
    expect(makePlan(c, { ...s, time: "" }, now)).toBeNull();
    expect(makePlan(c, { ...s, date: "2026-09-08" }, now)).toBeNull();
    expect(makePlan(c, { ...s, place: "" }, now)).toBeNull();
    expect(validDateTime("2026-02-30", "18:30", now)).toBe(false);
    expect(validDateTime("2026-09-09", "09:30", now)).toBe(false);
    expect(validDateTime("2026-09-09", "10:30", now)).toBe(true);
  });
  it("only place confirmation snapshots the exact plan", () => {
    const f = transition(
      { ...initialFlow(), scene: "place", selection: s },
      { type: "next", from: "place", content: c, now },
    );
    expect(f.scene).toBe("notification");
    expect(f.plan).toMatchObject({
      ...s,
      activity: c.activities[0].name,
      closing: c.customClosing,
    });
  });
});
describe("Heart Sweeper", () => {
  it("every first tile is safe and collects a heart", () => {
    for (let i = 0; i < 36; i++) {
      const b = reveal(emptyBoard(), i);
      expect(b.hearts).toContain(i);
      expect(b.wrong).not.toContain(i);
      expect(found(b)).toBe(1);
      expect(new Set(b.hearts).size).toBe(5);
    }
  });
  it("always solvable, harmless wrong tiles and duplicate reveals", () => {
    let b = reveal(emptyBoard(), 0, () => 0.42);
    const duplicate = reveal(b, 0);
    expect(duplicate).toBe(b);
    const wrong = b.wrong[0];
    b = reveal(b, wrong);
    expect(found(b)).toBe(1);
    for (let i = 0; i < 36; i++) b = reveal(b, i);
    expect(found(b)).toBe(5);
    expect(b.revealed.length).toBe(36);
  });
});
describe("modes and validation", () => {
  it("resolves studio, demo, real and malformed real links", () => {
    expect(resolveMode("")).toEqual({ mode: "studio", id: null });
    expect(resolveMode("?share=test").mode).toBe("demo");
    expect(resolveMode("?share=xyNn3_-Z").mode).toBe("real");
    expect(resolveMode("?share=").mode).toBe("real");
  });
  it("builds a root query URL", () => {
    expect(buildShareUrl("https://example.com", "Abc_123-")).toBe(
      "https://example.com/?share=Abc_123-",
    );
  });
  it("permission expires strictly and finalized wins", () => {
    expect(canEdit("real", false, 100, 100)).toBe(false);
    expect(canEdit("real", true, 200, 100)).toBe(false);
    expect(canEdit("real", false, 200, 100)).toBe(true);
    expect(canEdit("demo", true, 0, 100)).toBe(true);
  });
  it("rejects unknown shapes, excessive lengths, duplicate IDs and empty content", () => {
    expect(contentSchema.safeParse({ ...c, extra: "bad" }).success).toBe(false);
    expect(
      contentSchema.safeParse({ ...c, sender: "x".repeat(81) }).success,
    ).toBe(false);
    expect(
      contentSchema.safeParse({
        ...c,
        activities: [c.activities[0], c.activities[0]],
      }).success,
    ).toBe(false);
    expect(contentSchema.safeParse({ ...c, sender: "\u0000" }).success).toBe(
      false,
    );
    expect(contentSchema.safeParse({ ...c, wrongMessages: [] }).success).toBe(
      false,
    );
    expect(
      contentSchema.safeParse({
        ...c,
        activities: Array(13).fill(c.activities[0]),
      }).success,
    ).toBe(false);
  });
  it("sanitizes control characters without interpreting markup", () => {
    const v = contentSchema.parse({ ...c, sender: " A\u0000 <b>B</b> " });
    expect(v.sender).toBe("A <b>B</b>");
  });
  it("migrates old invitations and snapshots the selected emoticon", () => {
    expect(
      contentSchema.parse({ ...c, finalEmoticon: undefined }).finalEmoticon,
    ).toBe("love");
    expect(
      contentSchema.safeParse({ ...c, finalEmoticon: "unknown" }).success,
    ).toBe(false);
    const draft = { ...c, finalEmoticon: "wink" as const };
    expect(makePlan(draft, s, now)?.finalEmoticon).toBe("wink");
  });
});
describe("calendar and SMS share one plan", () => {
  const p = makePlan(c, s, now)!;
  it("SMS uses the exact plan and platform delimiters", () => {
    expect(decodeURIComponent(smsUrl(p, "iPhone").split("body=")[1])).toBe(
      planText(p),
    );
    expect(smsUrl(p, "iPhone")).toMatch(/^sms:&body=/);
    expect(smsUrl(p, "Android")).toMatch(/^sms:\?body=/);
    expect(planText(p)).toContain(p.place);
    expect(planText(p)).toContain(p.closing);
    expect(planText(p)).toContain(p.message);
  });
  it("produces a valid escaped two hour confirmed calendar", () => {
    const ics = calendar(p, now);
    expect(ics).toContain("STATUS:CONFIRMED\r\n");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("LOCATION:Тухтай кафе\\, 2\\; давхар\\\\цонх");
    const start = unfolded.match(/DTSTART:(.*)/)![1].trim(),
      end = unfolded.match(/DTEND:(.*)/)![1].trim();
    const toDate = (v: string) =>
      new Date(
        v.replace(
          /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
          "$1-$2-$3T$4:$5:$6",
        ),
      );
    expect(+toDate(end) - +toDate(start)).toBe(7200000);
    expect(start).toBe("20261020T183000");
    expect(unfolded).toContain(
      `DESCRIPTION:${planText(p).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,")}`,
    );
    for (const line of ics.split("\r\n"))
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
  it("folds UTF-8 without splitting emoji or Mongolian characters", () => {
    const value = "DESCRIPTION:" + "Өдөр ♡ 🥰".repeat(30);
    const folded = foldLine(value);
    expect(folded.replaceAll("\r\n ", "")).toBe(value);
    for (const line of folded.split("\r\n"))
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
  it("never invents a calendar for an incomplete plan", () => {
    expect(() => calendar({ ...p, place: "" })).toThrow("incomplete");
    expect(() => calendar(p, new Date("2027-01-01"))).toThrow("future");
  });
});
