import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONTENT } from "../src/app/content.js";
import {
  IMAGE_NAME, IMAGE_SIZE, calendarFile, canSaveToCalendar, createImageShare, createPlanImage, currentPlan, drawPlanImage,
  isFutureDate, planText, shareFile, smsLink,
} from "../src/app/plan.js";
import { longDate } from "../src/core/dates.js";

const content = structuredClone(DEFAULT_CONTENT);
content.book.note = "Every day with you is a little celebration; one more adventure!";
content.book.signature = "With love ♡";
const selections = { activity: "Picking flowers", place: "Secret Lake", date: "2026-10-14" };
const plan = currentPlan(content, selections);

// A 2D context that draws nothing but remembers every word written on it.
function recordingContext() {
  const written = [];
  const gradient = { addColorStop() {} };
  const target = {
    font: "",
    fillText: (text, x, y) => written.push({ text: String(text), x, y }),
    measureText: (text) => ({ width: String(text).length * (Number(/(\d+)px/.exec(target.font)?.[1]) || 20) * 0.5 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  const context = new Proxy(target, {
    get: (object, key) => (key in object ? object[key] : () => {}),
    set: (object, key, value) => {
      object[key] = value;
      return true;
    },
  });
  return { context, written };
}

describe("the finished plan", () => {
  it("is the book's choices and its love letter", () => {
    expect(plan).toMatchObject({
      title: content.book.title, activity: "Picking flowers", place: "Secret Lake", date: "2026-10-14",
      dateText: longDate("2026-10-14", { weekday: true }), message: content.book.note, signature: "With love ♡", complete: true,
    });
    expect(currentPlan(content, { activity: "A picnic" }).complete).toBe(false);
  });
});

describe("the picture", () => {
  it("has the current plan written on it, and nothing of the site's buttons", () => {
    const { context, written } = recordingContext();
    drawPlanImage(context, plan, IMAGE_SIZE);
    const text = written.map((w) => w.text).join(" ");
    for (const part of [plan.title, plan.activity, plan.dateText, plan.place, plan.signature]) expect(text).toContain(part);
    for (const word of plan.message.split(" ")) expect(text).toContain(word);
    for (const ui of ["Save", "Next", "Previous", "Finish", "Preparing", "Loading"]) expect(text).not.toContain(ui);
    expect(written.every((w) => w.x >= 0 && w.x <= IMAGE_SIZE.width && w.y >= 0 && w.y <= IMAGE_SIZE.height)).toBe(true);
  });

  it("follows the plan when it changes", () => {
    const { context, written } = recordingContext();
    drawPlanImage(context, currentPlan(content, { ...selections, place: "Sky Terrace" }), IMAGE_SIZE);
    expect(written.map((w) => w.text)).toContain("Sky Terrace");
    expect(written.map((w) => w.text)).not.toContain("Secret Lake");
  });

  it("is a 1080 x 1920 PNG file", async () => {
    const sizes = [];
    const canvas = (width, height) => {
      sizes.push([width, height]);
      return { getContext: () => recordingContext().context, toBlob: (done, type) => done(new Blob(["png"], { type })) };
    };
    const file = await createPlanImage(plan, { createCanvas: canvas, ready: async () => {} });
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe("image/png");
    expect(file.name).toBe(IMAGE_NAME);
    expect(sizes).toEqual([[1080, 1920]]);
  });

  it("goes straight into the phone's share sheet as a PNG file", async () => {
    const file = new File(["png"], IMAGE_NAME, { type: "image/png" });
    const share = vi.fn(async () => {});
    const save = vi.fn();
    const nav = { canShare: ({ files }) => files.every((f) => f.type === "image/png"), share };
    expect(await shareFile(file, { nav, save })).toBe("shared");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [file] }));
    expect(share.mock.calls[0][0].files[0].type).toBe("image/png");
    expect(save).not.toHaveBeenCalled();
  });

  it("is saved instead where files can't be shared, and says when sharing was cancelled", async () => {
    const file = new File(["png"], IMAGE_NAME, { type: "image/png" });
    const save = vi.fn();
    expect(await shareFile(file, { nav: {}, save })).toBe("saved");
    expect(save).toHaveBeenCalledWith(file);
    const cancelled = { canShare: () => true, share: async () => { throw Object.assign(new Error("no"), { name: "AbortError" }); } };
    expect(await shareFile(file, { nav: cancelled, save: vi.fn() })).toBe("cancelled");
  });

  it("reports creating, ready, cancelled and failed", async () => {
    const states = [];
    const file = new File(["png"], IMAGE_NAME, { type: "image/png" });
    const flow = createImageShare({ makeFile: async () => file, share: async () => "cancelled", onState: (s) => states.push(s) });
    await flow.prepare();
    expect(await flow.share()).toBe("cancelled");
    const broken = createImageShare({ makeFile: async () => { throw new Error("no canvas"); }, onState: (s) => states.push(s) });
    expect(await broken.share()).toBe("failed");
    expect(states).toEqual(["creating", "ready", "cancelled", "creating", "failed"]);
  });
});

describe("the text message", () => {
  it("is the whole plan", () => {
    expect(planText(plan)).toBe([
      `${plan.title} ♡`,
      "Adventure: Picking flowers",
      `Date: ${longDate("2026-10-14", { weekday: true })}`,
      "Place: Secret Lake",
      "",
      plan.message,
      "With love ♡",
    ].join("\n"));
  });

  it("opens the composer the way iPhones and Android phones each read it", () => {
    const text = planText(plan);
    expect(smsLink(text, { ios: true })).toBe(`sms:&body=${encodeURIComponent(text)}`);
    expect(smsLink(text, { ios: false })).toBe(`sms:?body=${encodeURIComponent(text)}`);
    expect(decodeURIComponent(smsLink(text, { ios: false }).split("body=")[1])).toBe(text);
  });
});

describe("the calendar file", () => {
  const ics = calendarFile(plan, { now: new Date("2026-10-08T09:30:00Z") });
  const unfolded = ics.replace(/\r\n /g, "");
  const field = (name) => unfolded.split("\r\n").find((line) => line.startsWith(name))?.slice(name.length);
  const unescape = (text) => text.replace(/\\n/g, "\n").replace(/\\([,;\\])/g, "$1");

  it("is a valid all-day event with CRLF lines no longer than 75 bytes", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VEVENT\r\nEND:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(field("DTSTART;VALUE=DATE:")).toBe("20261014");
    expect(field("DTEND;VALUE=DATE:")).toBe("20261015");
    expect(field("DTSTAMP:")).toBe("20261008T093000Z");
  });

  it("carries the same plan the site shows", () => {
    expect(unescape(field("SUMMARY:"))).toBe(`${plan.title}: Picking flowers`);
    expect(unescape(field("LOCATION:"))).toBe("Secret Lake");
    const description = unescape(field("DESCRIPTION:"));
    expect(description).toContain("Adventure: Picking flowers");
    expect(description).toContain("Place: Secret Lake");
    expect(description).toContain(plan.message);
    expect(description).toContain("With love ♡");
  });

  it("can only be saved for a real day, today or later", () => {
    const today = new Date(2026, 9, 8);
    expect(isFutureDate("2026-10-14", today)).toBe(true);
    expect(isFutureDate("2026-10-08", today)).toBe(true);
    expect(isFutureDate("2026-10-07", today)).toBe(false);
    expect(isFutureDate("2026-02-30", today)).toBe(false);
    expect(canSaveToCalendar(plan, today)).toBe(true);
    expect(canSaveToCalendar(currentPlan(content, { ...selections, date: "" }), today)).toBe(false);
  });
});
