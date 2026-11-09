// The step editor's pieces that run without a browser: the Worker's song check, the preview's screens, what is saved.
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/src/index";
import { previewFlow } from "../src/easy/preview";
import { initialFlow } from "../shared/flow";
import { contentSchema, freshContent } from "../shared/content";
// @ts-expect-error plain JS (the editor's steps)
import { forEditing, forSaving } from "../src/easy/easy-steps.js";

const call = (path: string) => (worker as { fetch: (r: Request, env: unknown) => Promise<Response> }).fetch(new Request(`https://api.test${path}`, { headers: { Origin: "https://sent4u.link" } }), { CORS_ORIGIN: "https://sent4u.link" });

describe("the song check", () => {
  afterEach(() => vi.restoreAllMocks());
  it("says whether a YouTube song can play inside the card", async () => {
    const youtube = (status: number, body = {}) => vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(body, { status }));
    youtube(200, { title: "A song" });
    expect(await (await call("/yt-check/dQw4w9WgXcQ")).json()).toEqual({ ok: true, title: "A song" });
    vi.restoreAllMocks(); youtube(403);
    expect(await (await call("/yt-check/dQw4w9WgXcQ")).json()).toEqual({ ok: false, reason: "blocked" });
    vi.restoreAllMocks(); youtube(404);
    expect(await (await call("/yt-check/dQw4w9WgXcQ")).json()).toEqual({ ok: false, reason: "missing" });
  });
});

describe("the live preview's screens", () => {
  const c = freshContent();
  it("shows each screen as it is at that point", () => {
    expect(previewFlow({ scene: "plea", sub: 2 }, c, initialFlow())).toMatchObject({ scene: "invitation", noCount: 3 });
    expect(previewFlow({ scene: "gamedone", sub: null }, c, initialFlow())).toMatchObject({ scene: "game", hearts: 5 });
    expect(previewFlow({ scene: "place", sub: 1 }, c, initialFlow()).selection.activityId).toBe(c.activities[1].id);
    const mail = previewFlow({ scene: "message", sub: null }, c, initialFlow());
    expect(mail.plan?.message).toContain(c.activities[0].name);
  });
});

describe("what the editor saves", () => {
  it("keeps the last words for an emptied box and leaves empty choices out", () => {
    const last = freshContent();
    const edited = forEditing(last);
    edited.invitation = "  ";
    edited.noResponses[0] = "Are you sure?";
    edited.noResponses[5] = "";
    edited.activities[4] = { id: "new-4", name: "Stargazing", places: [] };
    const saved = contentSchema.parse(forSaving(edited, last, () => false));
    expect(saved.invitation).toBe(last.invitation);
    expect(saved.noResponses).not.toContain("");
    expect(saved.activities.at(-1)).toEqual({ id: "new-4", name: "Stargazing", places: ["Stargazing"] });
  });
});
