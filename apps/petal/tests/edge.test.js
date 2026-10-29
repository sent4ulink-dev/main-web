// The share server as Cloudflare runs it: functions/api/[[path]].js around server/api.js.
import { describe, expect, it } from "vitest";
import { onRequest } from "../functions/api/[[path]].js";
import { memoryBucket } from "./memory-bucket.js";

const SITE = "https://sent4u-petal.pages.dev";
const ID = "Ab3_x-9Q";
const call = (env, path, init = {}) => onRequest({ request: new Request(SITE + path, init), env });
const send = (env, path, method, body, headers = {}) =>
  call(env, path, { method, headers: { "content-type": "application/json", origin: SITE, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });

describe("Petal Isle on Cloudflare", () => {
  it("answers not_configured without its bucket", async () => {
    expect((await call({}, `/api/shares/${ID}`)).status).toBe(503);
  });

  it("makes a sold link with the store's secret, opens it, and refuses changes from other websites", async () => {
    const env = { SHARES: memoryBucket(), SHARE_CREATE_SECRET: "shop" };
    expect((await call(env, `/api/shares/${ID}/ensure`, { method: "POST", headers: { "x-petal-create-secret": "nope" } })).status).toBe(403);
    expect((await call(env, `/api/shares/${ID}/ensure`, { method: "POST", headers: { "x-petal-create-secret": "shop" } })).status).toBe(200);
    const link = await (await call(env, `/api/shares/${ID}`)).json();
    expect(link.finalized).toBe(false);
    expect((await send(env, `/api/shares/${ID}`, "PUT", { content: link.content }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await send(env, `/api/shares/${ID}`, "PUT", { content: link.content })).status).toBe(200);
  });

  it("lets sent4u.link save changes (it shows this card through its gateway) but still no other website", async () => {
    const env = { SHARES: memoryBucket(), SHARE_CREATE_SECRET: "shop", CORS_ORIGIN: "https://sent4u.link,https://sent4u-petal.pages.dev" };
    await call(env, `/api/shares/${ID}/ensure`, { method: "POST", headers: { "x-petal-create-secret": "shop" } });
    const { content } = await (await call(env, `/api/shares/${ID}`)).json();
    expect((await send(env, `/api/shares/${ID}`, "PUT", { content }, { origin: "https://sent4u.link" })).status).toBe(200);
    expect((await send(env, `/api/shares/${ID}`, "PUT", { content }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await send({ ...env, CORS_ORIGIN: "" }, `/api/shares/${ID}`, "PUT", { content }, { origin: "https://sent4u.link" })).status).toBe(403);
  });

  it("two wrong studio passwords lock the address, even sent together", async () => {
    const env = { SHARES: memoryBucket({ delay: 5 }), STUDIO_PASSWORD: "real-studio-password" };
    const answers = await Promise.all(Array.from({ length: 5 }, () => send(env, "/api/studio/unlock", "POST", { password: "guess" }, { "cf-connecting-ip": "7.7.7.7" })));
    const bodies = await Promise.all(answers.map((r) => r.json()));
    expect(bodies.filter((b) => b.error === "wrong_password").length).toBe(1);
    expect(bodies.filter((b) => b.error === "locked_out").length).toBe(4);
    const right = await send(env, "/api/studio/unlock", "POST", { password: "real-studio-password" }, { "cf-connecting-ip": "7.7.7.7" });
    expect(right.status).toBe(429);
    const elsewhere = await send(env, "/api/studio/unlock", "POST", { password: "real-studio-password" }, { "cf-connecting-ip": "8.8.8.8" });
    expect(await elsewhere.json()).toEqual({ ok: true });
  });

  it("a finish and a save at the same moment leave the link finished", async () => {
    for (let round = 0; round < 5; round += 1) {
      const env = { SHARES: memoryBucket({ delay: 6 }), SHARE_CREATE_SECRET: "s" };
      await call(env, `/api/shares/${ID}/ensure`, { method: "POST", headers: { "x-petal-create-secret": "s" } });
      const { content } = await (await call(env, `/api/shares/${ID}`)).json();
      await Promise.all([send(env, `/api/shares/${ID}/finalize`, "POST"), send(env, `/api/shares/${ID}`, "PUT", { content })]);
      expect((await (await call(env, `/api/shares/${ID}`)).json()).finalized).toBe(true);
    }
  });

});
