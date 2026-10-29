import { describe, expect, it, vi } from "vitest";
import { fitSize, photoSize } from "../src/app/photo.js";
import { createAutosave, createShare, editTimeLeft, loadShare, shareIdFrom, shareUrl } from "../src/app/share-client.js";

describe("share links in the page", () => {
  it("reads the link's id, and makes the link from it", () => {
    expect(shareIdFrom("?share=Ab3_x-9Q")).toBe("Ab3_x-9Q");
    expect(shareIdFrom("?share=../x")).toBeNull();
    expect(shareIdFrom("?debug")).toBeNull();
    expect(shareUrl("Ab3_x-9Q", "https://petal.pages.dev/?debug#c=old")).toBe("https://petal.pages.dev/?share=Ab3_x-9Q");
  });

  it("answers with the server's error, or offline, never throwing", async () => {
    const refused = vi.fn(async () => new Response(JSON.stringify({ error: "wrong_password", attemptsRemaining: 1 }), { status: 401 }));
    const result = await createShare({}, "x", { fetchImpl: refused });
    expect(result).toMatchObject({ ok: false, status: 401, error: "wrong_password", attemptsRemaining: 1 });
    expect(JSON.parse(refused.mock.calls[0][1].body)).toEqual({ content: {}, studioPassword: "x" });
    const offline = await loadShare("Ab3_x-9Q", { fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
    expect(offline).toEqual({ ok: false, status: 0, error: "offline" });
  });

  it("says how long a link can still be edited, in Mongolian", () => {
    const minute = 60000;
    expect(editTimeLeft(4 * 1440 * minute + 23 * 60 * minute)).toBe("4 days 23 hours");
    expect(editTimeLeft(2 * 1440 * minute)).toBe("2 days");
    expect(editTimeLeft(5 * 60 * minute + 12 * minute)).toBe("5 hours 12 minutes");
    expect(editTimeLeft(30 * 1000)).toBe("1 minute");
    expect(editTimeLeft(-5)).toBe("");
  });
});

describe("autosave", () => {
  it("saves a moment after the last change, the latest words only", async () => {
    vi.useFakeTimers();
    const saved = [];
    const states = [];
    const autosave = createAutosave({ save: async (words) => (saved.push(words.n), { ok: true }), onState: (s) => states.push(s) });
    autosave.schedule({ n: 1 });
    autosave.schedule({ n: 2 });
    expect(autosave.dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(1999);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved).toEqual([2]);
    expect(states).toEqual(["saving", "saved"]);
    expect(autosave.dirty).toBe(false);
    vi.useRealTimers();
  });

  it("saves at once when asked, and keeps unsaved words after a failure", async () => {
    let fail = true;
    const saved = [];
    const autosave = createAutosave({ save: async (words) => (fail ? { ok: false, error: "offline" } : (saved.push(words.n), { ok: true })) });
    autosave.schedule({ n: 1 });
    expect(await autosave.flush()).toBe(false);
    expect(autosave.dirty).toBe(true);
    fail = false;
    expect(await autosave.flush()).toBe(true);
    expect(saved).toEqual([1]);
    expect(await autosave.flush({ n: 3 })).toBe(true);
    expect(saved).toEqual([1, 3]);
  });
});

describe("photos", () => {
  it("shrinks to 1280 on the longest side, never enlarging", () => {
    expect(fitSize(4032, 3024)).toEqual({ width: 1280, height: 960 });
    expect(fitSize(3024, 4032)).toEqual({ width: 960, height: 1280 });
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("reads a stored photo's shape from its name, for the polaroid", () => {
    expect(photoSize("/api/images/Ab3_x-9Q/abcdefgh12345678-900x1200.webp")).toEqual({ width: 900, height: 1200 });
    expect(photoSize("")).toBeNull();
  });
});
