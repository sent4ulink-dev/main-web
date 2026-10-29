import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../src/app/content.js";
import { EDIT_WINDOW_MS, FIRST_VISIT_GRACE_MS, handleApi } from "../server/api.js";
import { createLocalBucket } from "../server/local-bucket.js";

const DAY = 24 * 60 * 60 * 1000;
// Tiny stand-ins for photos: the right first bytes, then filler.
function webp(length) {
  const bytes = new Uint8Array(length);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBP"), 8);
  return bytes;
}
function jpeg(length) {
  const bytes = new Uint8Array(length);
  bytes.set([0xff, 0xd8, 0xff], 0);
  return bytes;
}
const T0 = Date.UTC(2026, 9, 8, 12);

// One server with its own bucket, and a pretend sent4u orders server that sold the ids in `sold` for this card;
// call(method, path, body, { now, ip, headers }).
function server({ password = "", secret = "", sold = [], open = true } = {}) {
  const env = { SHARES: createLocalBucket(), STUDIO_PASSWORD: password, SHARE_CREATE_SECRET: secret, ORDERS_API_BASE: "https://orders.test", OPEN_STUDIO: open ? "1" : "" };
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(url);
    const id = url.split("/").pop();
    return sold.includes(id) ? Response.json({ ok: true, product: "petal" }) : Response.json({ error: "Not found." }, { status: 404 });
  };
  const call = async (method, path, body, { now = T0, ip = "203.0.113.7", headers = {} } = {}) => {
    const request = new Request(`https://petal.example/api/${path}`, {
      method,
      headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const response = await handleApi(request, env, { now, fetchImpl });
    return { status: response.status, body: await response.json() };
  };
  return { env, call, asked };
}

describe("share links' server", () => {
  it("makes a short link that opens with the invitation's words", async () => {
    const { call } = server();
    const words = structuredClone(DEFAULT_CONTENT);
    words.book.note = "Dearest, I love you so much ♡";
    const made = await call("POST", "shares", { content: words });
    expect(made.status).toBe(201);
    expect(made.body.id).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(made.body.editUntil).toBe(T0 + EDIT_WINDOW_MS);
    const opened = await call("GET", `shares/${made.body.id}`);
    expect(opened.status).toBe(200);
    expect(opened.body.content.book.note).toBe(words.book.note);
    expect(opened.body.finalized).toBe(false);
  });

  it("keeps only the words the invitation has, of the right kind", async () => {
    const { call } = server();
    const { body } = await call("POST", "shares", { content: { intro: { headline: "Hello", copy: 5 }, extra: "<script>", locked: true } });
    const { body: opened } = await call("GET", `shares/${body.id}`);
    expect(opened.content.intro.headline).toBe("Hello");
    expect(opened.content.intro.copy).toBe(DEFAULT_CONTENT.intro.copy);
    expect(opened.content.extra).toBeUndefined();
    expect(opened.content.locked).toBe(false);
  });

  it("lets anyone with the link edit it for five days from its first visit", async () => {
    const { call } = server();
    const { body } = await call("POST", "shares", {});
    const words = structuredClone(DEFAULT_CONTENT);
    words.question.text = "Will you be\nmy beloved\nsomeone?";
    // The studio opening it at once isn't a visit; nor do the days run while nobody has opened it.
    expect((await call("GET", `shares/${body.id}`)).body.editUntil).toBe(T0 + EDIT_WINDOW_MS);
    expect((await call("GET", `shares/${body.id}`, undefined, { now: T0 + FIRST_VISIT_GRACE_MS })).body.editUntil).toBe(T0 + FIRST_VISIT_GRACE_MS + EDIT_WINDOW_MS);
    expect((await call("PUT", `shares/${body.id}`, { content: words }, { now: T0 + 30 * DAY })).status).toBe(200);
    // First visited a month after it was made: five days from then, and a later visit doesn't move the end.
    const first = T0 + 31 * DAY;
    const opened = await call("GET", `shares/${body.id}`, undefined, { now: first });
    expect(opened.body.editUntil).toBe(first + EDIT_WINDOW_MS);
    expect(opened.body.content.question.text).toBe(words.question.text);
    expect((await call("GET", `shares/${body.id}`, undefined, { now: first + 2 * DAY })).body.editUntil).toBe(first + EDIT_WINDOW_MS);
    expect((await call("PUT", `shares/${body.id}`, { content: words }, { now: first + 4 * DAY })).status).toBe(200);
    const late = await call("PUT", `shares/${body.id}`, { content: words }, { now: first + 5 * DAY + 1 });
    expect(late).toEqual({ status: 403, body: { error: "edit_window_closed" } });
  });

  it("stays as it is once finished", async () => {
    const { call } = server();
    const { body } = await call("POST", "shares", {});
    expect((await call("POST", `shares/${body.id}/finalize`)).status).toBe(200);
    const opened = await call("GET", `shares/${body.id}`);
    expect(opened.body.finalized).toBe(true);
    const words = { ...structuredClone(DEFAULT_CONTENT), character: "boy" };
    expect(await call("PUT", `shares/${body.id}`, { content: words })).toEqual({ status: 403, body: { error: "finalized" } });
  });

  it("stays finished when the last save and the finish arrive together", async () => {
    const { call } = server();
    const { body } = await call("POST", "shares", {});
    const words = structuredClone(DEFAULT_CONTENT);
    words.book.note = "The last word";
    await Promise.all([call("PUT", `shares/${body.id}`, { content: words }), call("POST", `shares/${body.id}/finalize`)]);
    const opened = await call("GET", `shares/${body.id}`);
    expect(opened.body.finalized).toBe(true);
    expect(opened.body.content.book.note).toBe("The last word");
  });

  it("says when a link doesn't exist, and refuses odd ids and huge bodies", async () => {
    const { call } = server();
    expect((await call("GET", "shares/nothere1")).status).toBe(404);
    expect((await call("GET", "shares/..%2Flocks")).status).toBe(404);
    const huge = { content: { book: { note: "♡".repeat(30000) } } };
    expect((await call("POST", "shares", huge)).status).toBe(413);
    expect((await call("POST", "shares", "{not json")).status).toBe(400);
  });

  it("needs the studio password to make a link, and locks out a guesser for a day", async () => {
    const { call } = server({ password: "bolzoo-2026" });
    expect((await call("GET", "studio")).body.locked).toBe(true);
    expect((await call("POST", "shares", { studioPassword: "wrong" })).body).toEqual({ error: "wrong_password", attemptsRemaining: 1 });
    expect((await call("POST", "studio/unlock", { password: "nope" })).status).toBe(429);
    // Even the right password waits out the day from that address…
    expect((await call("POST", "shares", { studioPassword: "bolzoo-2026" })).status).toBe(429);
    // …but not from another one, nor after the day.
    expect((await call("POST", "shares", { studioPassword: "bolzoo-2026" }, { ip: "198.51.100.2" })).status).toBe(201);
    expect((await call("POST", "studio/unlock", { password: "bolzoo-2026" }, { now: T0 + DAY + 1 })).body).toEqual({ ok: true });
  });

  it("opens and edits a link without the password", async () => {
    const { call } = server({ password: "bolzoo-2026" });
    const { body } = await call("POST", "shares", { studioPassword: "bolzoo-2026" });
    expect((await call("GET", `shares/${body.id}`, undefined, { ip: "192.0.2.9" })).status).toBe(200);
    expect((await call("PUT", `shares/${body.id}`, { content: DEFAULT_CONTENT }, { ip: "192.0.2.9" })).status).toBe(200);
  });

  it("counts the links made, still editable and finished", async () => {
    const { call } = server();
    const ids = [];
    for (let i = 0; i < 3; i += 1) ids.push((await call("POST", "shares", {})).body.id);
    await call("POST", `shares/${ids[0]}/finalize`);
    expect((await call("GET", "studio", undefined, { now: T0 + DAY })).body).toEqual({ locked: false, open: true, shares: { total: 3, active: 2, finalized: 1 } });
    // One is visited a day after it was made: its five days run out; the other, never visited, stays editable.
    await call("GET", `shares/${ids[1]}`, undefined, { now: T0 + DAY });
    expect((await call("GET", "studio", undefined, { now: T0 + 5 * DAY })).body.shares).toEqual({ total: 3, active: 2, finalized: 1 });
    expect((await call("GET", "studio", undefined, { now: T0 + 7 * DAY })).body.shares).toEqual({ total: 3, active: 1, finalized: 1 });
  });

  it("keeps a photo per place, deletes the one it replaces, and serves it", async () => {
    const { env, call } = server();
    const { body } = await call("POST", "shares", {});
    const upload = (slot, bytes, size = "1280x960") => handleApi(new Request(`https://petal.example/api/shares/${body.id}/images?slot=${slot}`, {
      method: "POST", headers: { "content-type": "image/webp", "x-image-size": size }, body: bytes,
    }), env, { now: T0 });
    const first = await (await upload("book", webp(100))).json();
    expect(first.url).toMatch(new RegExp(`^/api/images/${body.id}/[A-Za-z0-9_-]{16}-1280x960[.]webp$`));
    expect((await call("GET", `shares/${body.id}`)).body.content.book.photo).toBe(first.url);
    const served = await handleApi(new Request(`https://petal.example${first.url}`), env);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/webp");
    expect(served.headers.get("cache-control")).toContain("immutable");
    expect((await served.arrayBuffer()).byteLength).toBe(100);
    // A new one replaces it, and the old file is gone.
    const second = await (await upload("book", webp(120), "900x1200")).json();
    expect(env.SHARES.keys().filter((key) => key.startsWith("images/"))).toEqual([`images/${body.id}/${second.url.split("/").pop()}`]);
    expect((await handleApi(new Request(`https://petal.example${first.url}`), env)).status).toBe(404);
    // Taking it away deletes it too.
    expect((await call("DELETE", `shares/${body.id}/images?slot=book`)).body).toEqual({ ok: true, url: "" });
    expect(env.SHARES.keys().some((key) => key.startsWith("images/"))).toBe(false);
    expect((await call("GET", `shares/${body.id}`)).body.content.book.photo).toBe("");
  });

  it("never lets the page set a photo itself, nor keeps one it didn't make", async () => {
    const { env, call } = server();
    const { body } = await call("POST", "shares", { content: { activities: [{ image: "https://tracker.example/pixel.png" }] } });
    expect((await call("GET", `shares/${body.id}`)).body.content.activities[0].image).toBe("");
    const upload = await handleApi(new Request(`https://petal.example/api/shares/${body.id}/images?slot=activity0`, {
      method: "POST", headers: { "x-image-size": "800x800" }, body: jpeg(50),
    }), env, { now: T0 });
    const { url } = await upload.json();
    expect(url).toMatch(/-800x800[.]jpg$/);
    // A later save from the page (with old or odd photos) keeps the server's.
    const words = structuredClone(DEFAULT_CONTENT);
    words.activities[0].image = "";
    words.map.places[1].image = "data:image/png;base64,AAAA";
    await call("PUT", `shares/${body.id}`, { content: words });
    const { content } = (await call("GET", `shares/${body.id}`)).body;
    expect(content.activities[0].image).toBe(url);
    expect(content.map.places[1].image).toBe("");
  });

  it("refuses photos that aren't WebP or JPEG, too big, for no place, or after finishing", async () => {
    const { env, call } = server();
    const { body } = await call("POST", "shares", {});
    const upload = (bytes, { slot = "place1", size = "640x480" } = {}) => handleApi(new Request(`https://petal.example/api/shares/${body.id}/images?slot=${slot}`, {
      method: "POST", headers: { "x-image-size": size }, body: bytes,
    }), env, { now: T0 });
    expect((await upload(new TextEncoder().encode("<svg onload=alert(1)>"))).status).toBe(400);
    expect((await upload(webp(16), { size: "big" })).status).toBe(400);
    expect((await upload(webp(16), { slot: "cover" })).status).toBe(400);
    expect((await upload(webp(2 * 1024 * 1024 + 1))).status).toBe(413);
    await call("POST", `shares/${body.id}/finalize`);
    expect((await upload(webp(16))).status).toBe(403);
    expect((await handleApi(new Request(`https://petal.example/api/images/${body.id}/../shares.json`), env)).status).toBe(404);
  });

  it("makes a sold link when the store asks, with its secret, never twice", async () => {
    const { call } = server({ secret: "store-secret" });
    const id = "Xq3_9kLmP0a"; // the store's ids: 8 random bytes
    expect((await call("POST", `shares/${id}/ensure`, {})).status).toBe(403);
    expect((await call("POST", `shares/${id}/ensure`, {}, { headers: { "x-petal-create-secret": "guess" } })).status).toBe(403);
    const made = await call("POST", `shares/${id}/ensure`, {}, { headers: { "x-petal-create-secret": "store-secret" } });
    expect(made.body).toEqual({ ok: true, existed: false });
    const words = structuredClone(DEFAULT_CONTENT);
    words.book.note = "My letter";
    await call("PUT", `shares/${id}`, { content: words });
    const again = await call("POST", `shares/${id}/ensure`, {}, { headers: { "x-petal-create-secret": "store-secret" } });
    expect(again.body).toEqual({ ok: true, existed: true });
    const opened = await call("GET", `shares/${id}`);
    expect(opened.body.content.book.note).toBe("My letter");
    expect(opened.body.editUntil).toBe(T0 + EDIT_WINDOW_MS);
  });

  it("makes a sold link on the store's call without any secret, checking the sale", async () => {
    const { call, asked } = server({ sold: ["Paid_Link_07"] });
    expect((await call("POST", "shares/Paid_Link_07/ensure", {})).body).toEqual({ ok: true, existed: false });
    expect(asked).toEqual(["https://orders.test/links/Paid_Link_07"]);
    expect((await call("GET", "shares/Paid_Link_07")).status).toBe(200);
    expect((await call("POST", "shares/Unpaid_Link8/ensure", {})).body).toEqual({ error: "not_sold" });
    expect((await call("GET", "shares/Unpaid_Link8")).status).toBe(404);
  });

  it("makes no links in the studio until it has a password", async () => {
    const { call } = server({ open: false });
    expect((await call("GET", "studio")).body).toMatchObject({ locked: false, open: false });
    expect((await call("POST", "shares", {})).body).toEqual({ error: "studio_closed" });
  });

  it("makes a sold link on opening if the store's call hasn't arrived, but not an unsold one", async () => {
    const { call, asked } = server({ sold: ["Sold_Link_01"] });
    const opened = await call("GET", "shares/Sold_Link_01");
    expect(opened.status).toBe(200);
    expect(opened.body.finalized).toBe(false);
    expect(asked).toEqual(["https://orders.test/links/Sold_Link_01"]);
    expect((await call("GET", "shares/Sold_Link_01")).status).toBe(200);
    expect(asked).toHaveLength(1); // made once, then simply read
    expect((await call("GET", "shares/NotSold_002")).status).toBe(404);
    expect((await call("PUT", "shares/Sold_Link_09", { content: DEFAULT_CONTENT })).status).toBe(404); // only opening asks
  });

  it("says so when no bucket is bound", async () => {
    const response = await handleApi(new Request("https://petal.example/api/studio"), {});
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "not_configured" });
  });
});
