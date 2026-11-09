// The step editor's song box asks the card's own server whether a YouTube song can play inside the card.
import { describe, expect, it } from "vitest";
import { handleApi } from "../server/api.js";

const call = (path, fetchImpl, method = "GET") => handleApi(new Request(`https://card.test${path}`, { method }), {}, { fetchImpl });
const answer = (status, body = {}) => async (u) => {
  expect(String(u)).toMatch(/^https:\/\/www\.youtube\.com\/oembed\?format=json&url=/);
  return Response.json(body, { status });
};

describe("the song check", () => {
  it("says whether a YouTube song can play inside the card", async () => {
    const check = async (fetchImpl) => (await call("/api/yt-check/dQw4w9WgXcQ", fetchImpl)).json();
    expect(await check(answer(200, { title: "A song" }))).toEqual({ ok: true, title: "A song" });
    expect(await check(answer(401))).toEqual({ ok: false, reason: "blocked" });
    expect(await check(answer(404))).toEqual({ ok: false, reason: "missing" });
    expect(await check(answer(500))).toEqual({ ok: true }); // can't tell: not stopped
    expect(await check(async () => { throw new Error("offline"); })).toEqual({ ok: true });
  });
  it("answers only a real song id, and only to GET", async () => {
    expect((await call("/api/yt-check/not-an-id", answer(200))).status).toBe(503); // (not a song check: no storage in this test)
    expect((await call("/api/yt-check/dQw4w9WgXcQ", answer(200), "POST")).status).toBe(405);
  });
});
