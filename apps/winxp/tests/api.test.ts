import { afterEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app";
import { MemoryStorage, JsonStorage } from "../server/storage";
import { freshContent } from "../shared/content";
import { testPng } from "./png";
const c = freshContent(),
  createSecret = "server-only-test-fulfillment-secret";
const apps: ReturnType<typeof createApp>[] = [];
function fixture() {
  let time = 100000000;
  const storage = new MemoryStorage();
  const app = createApp({ storage, createSecret, now: () => time });
  apps.push(app);
  return {
    app,
    storage,
    advance: (ms: number) => {
      time += ms;
    },
  };
}
afterEach(() => {
  apps.splice(0).forEach((a) => a.locals.dispose());
});
// Mints a share the same way the sent4u order Worker does: server-to-server,
// against a specific id, gated by the shared fulfillment secret.
function mint(app: ReturnType<typeof createApp>, id: string) {
  return request(app)
    .post(`/shares/${id}/ensure`)
    .set("x-date-create-secret", createSecret);
}
describe("fulfillment secret", () => {
  it("only the order Worker's shared secret can mint a share", async () => {
    const { app } = fixture();
    expect((await request(app).post("/shares/AbCd1234/ensure")).status).toBe(
      403,
    );
    expect(
      (
        await request(app)
          .post("/shares/AbCd1234/ensure")
          .set("x-date-create-secret", "wrong")
      ).status,
    ).toBe(403);
    const created = await mint(app, "AbCd1234");
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: "ok", existed: false });
    expect(created.body.share.content).toEqual(c);
  });
  it("is idempotent: a second ensure never overwrites existing content", async () => {
    const { app } = fixture();
    await mint(app, "AbCd1234");
    await request(app)
      .put("/shares/AbCd1234")
      .send({ ...c, sender: "Changed sender" });
    const second = await mint(app, "AbCd1234");
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ status: "ok", existed: true });
    expect(second.body.share.content.sender).toBe("Changed sender");
  });
  it("never exposes the secret and rejects malformed ids", async () => {
    const { app } = fixture();
    const r = await request(app).post("/shares/AbCd1234/ensure");
    expect(JSON.stringify(r.body)).not.toContain(createSecret);
    expect((await mint(app, "short")).status).toBe(400);
  });
});
describe("real shares", () => {
  it("creates, reads, updates and permanently finalizes a share", async () => {
    const { app } = fixture();
    const created = await mint(app, "AbCd1234");
    const id = created.body.share.id;
    expect(id).toBe("AbCd1234");
    expect(
      (await request(app).get(`/shares/${id}`)).body.share.content,
    ).toEqual(c);
    expect(
      (
        await request(app)
          .put(`/shares/${id}`)
          .send({ ...c, sender: "New sender", finalEmoticon: "cool" })
      ).body.share.content.sender,
    ).toBe("New sender");
    expect(
      (await request(app).get(`/shares/${id}`)).body.share.content
        .finalEmoticon,
    ).toBe("cool");
    expect(
      (await request(app).post(`/shares/${id}/finalize`)).body.share
        .finalized,
    ).toBe(true);
    expect((await request(app).put(`/shares/${id}`).send(c)).body.status).toBe(
      "finalized",
    );
    expect(
      (await request(app).post(`/shares/${id}/finalize`)).body.status,
    ).toBe("finalized");
  });
  it("rejects updates and finalization after expiration", async () => {
    const { app, advance } = fixture();
    const id = "AbCd1234";
    await mint(app, id);
    advance(5 * 86400000);
    expect((await request(app).put(`/shares/${id}`).send(c)).status).toBe(410);
    expect(
      (await request(app).post(`/shares/${id}/finalize`)).body.status,
    ).toBe("expired");
    expect((await request(app).get(`/shares/${id}`)).status).toBe(200);
  });
  it("self-heals a share the Worker confirms was really paid for, but rejects one it doesn't recognize", async () => {
    const storage = new MemoryStorage();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/links/RealOrderId12345"))
        return new Response(
          JSON.stringify({ ok: true, product: "winxp" }),
          { status: 200 },
        );
      if (url.endsWith("/links/OtherProductId1234"))
        return new Response(
          JSON.stringify({ ok: true, product: "pixel" }),
          { status: 200 },
        );
      return new Response(JSON.stringify({ error: "Not found." }), {
        status: 404,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const app = createApp({
      storage,
      createSecret,
      ordersApiBase: "https://orders.example.test",
    });
    apps.push(app);
    try {
      const healed = await request(app).get("/shares/RealOrderId12345");
      expect(healed.status).toBe(200);
      expect(healed.body.share.content).toEqual(c);
      expect(await storage.get("RealOrderId12345")).not.toBeNull();
      const wrongProduct = await request(app).get(
        "/shares/OtherProductId1234",
      );
      expect(wrongProduct.status).toBe(404);
      const unknown = await request(app).get("/shares/NeverIssuedId12345");
      expect(unknown.status).toBe(404);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("rejects malformed content, unknown shape, IDs and oversized payloads", async () => {
    const { app } = fixture();
    await mint(app, "AbCd1234");
    for (const body of [
      { ...c, bad: true },
      { ...c, sender: "x".repeat(100) },
      {},
    ])
      expect(
        (await request(app).put("/shares/AbCd1234").send(body)).status,
      ).toBe(400);
    expect((await request(app).get("/shares/no")).status).toBe(400);
    expect((await request(app).get("/shares/test")).status).toBe(400);
    expect(
      (
        await request(app)
          .put("/shares/AbCd1234")
          .send({ ...c, messageTemplate: "x".repeat(50000) })
      ).status,
    ).toBe(413);
  });
  it("async storage failures return structured JSON immediately", async () => {
    const storage = new MemoryStorage();
    storage.get = async () => {
      throw new Error("private storage failure");
    };
    const app = createApp({ storage, createSecret });
    apps.push(app);
    const r = await request(app).get("/shares/AbCd1234").timeout(2000);
    expect(r.status).toBe(500);
    expect(r.body).toMatchObject({ status: "error" });
    expect(JSON.stringify(r.body)).not.toContain("private storage");
  });
  it("serializes concurrent finalize and update operations", async () => {
    const { app } = fixture();
    const id = "AbCd1234";
    await mint(app, id);
    await Promise.all([
      request(app).post(`/shares/${id}/finalize`),
      request(app)
        .put(`/shares/${id}`)
        .send({ ...c, sender: "changed" }),
    ]);
    expect((await request(app).get(`/shares/${id}`)).body.share.finalized).toBe(
      true,
    );
    expect((await request(app).put(`/shares/${id}`).send(c)).status).toBe(409);
  });
  it("rejects invalid PNG uploads and unknown photo IDs", async () => {
    const { app } = fixture();
    expect(
      (
        await request(app)
          .post("/photos")
          .set("Content-Type", "image/png")
          .send(Buffer.from("fake png"))
      ).status,
    ).toBe(400);
    expect((await request(app).get("/photos/bad")).status).toBe(400);
    expect(
      (await request(app).get("/photos/aaaaaaaaaaaaaaaaaaaaaaaa")).body.status,
    ).toBe("expired");
  });
});
describe("temporary photos", () => {
  it("accepts a real PNG, serves exact bytes and expires it", async () => {
    const { app, advance } = fixture();
    const png = testPng();
    const uploaded = await request(app)
      .post("/photos")
      .set("Content-Type", "image/png")
      .send(png);
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.path).toMatch(/^\/photos\/[A-Za-z0-9_-]{24}$/);
    const image = await request(app).get(uploaded.body.path);
    expect(image.headers["content-type"]).toContain("image/png");
    expect(image.body).toEqual(png);
    advance(15 * 60000);
    expect((await request(app).get(uploaded.body.path)).body.status).toBe(
      "expired",
    );
  });
  it("throttles uploads per IP and rejects corrupted data", async () => {
    const { app } = fixture();
    const png = testPng();
    for (let i = 0; i < 6; i++)
      expect(
        (
          await request(app)
            .post("/photos")
            .set("Content-Type", "image/png")
            .send(png)
        ).status,
      ).toBe(201);
    expect(
      (
        await request(app)
          .post("/photos")
          .set("Content-Type", "image/png")
          .send(png)
      ).status,
    ).toBe(429);
    expect(
      (
        await request(app)
          .post("/photos")
          .set("Content-Type", "image/png")
          .set("X-Forwarded-For", "9.8.7.6")
          .send(png)
      ).status,
    ).toBe(201);
    png[50] ^= 1;
    expect(
      (
        await request(app)
          .post("/photos")
          .set("Content-Type", "image/png")
          .send(png)
      ).status,
    ).toBe(400);
  });
});
describe("atomic JSON storage", () => {
  it("keeps saved content and edit locks after restarting the API", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "heart-restart-"));
    try {
      const file = path.join(dir, "shares.json");
      const first = createApp({
        storage: new JsonStorage(file),
        createSecret,
      });
      apps.push(first);
      const id = "AbCd1234";
      const created = await mint(first, id);
      await request(first)
        .put(`/shares/${id}`)
        .send({ ...c, sender: "Persisted sender" });
      await request(first).post(`/shares/${id}/finalize`);
      const restarted = createApp({
        storage: new JsonStorage(file),
        createSecret,
      });
      apps.push(restarted);
      const loaded = await request(restarted).get(`/shares/${id}`);
      expect(loaded.body.share).toMatchObject({
        id,
        content: { sender: "Persisted sender" },
        finalized: true,
        createdAt: created.body.share.createdAt,
        editUntil: created.body.share.editUntil,
      });
      expect(
        (await request(restarted).put(`/shares/${id}`).send(c)).status,
      ).toBe(409);
      expect((await mint(restarted, id)).body).toMatchObject({
        status: "ok",
        existed: true,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("recovers missing file, persists and reloads individually validated shares", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "heart-storage-"));
    try {
      const file = path.join(dir, "shares.json"),
        storage = new JsonStorage(file);
      expect(await storage.list()).toEqual([]);
      const s = {
        id: "AbCd1234",
        content: c,
        createdAt: 100,
        editUntil: 200,
        finalized: false,
      };
      await storage.put(s);
      expect(await new JsonStorage(file).get(s.id)).toEqual(s);
      expect(JSON.parse(await readFile(file, "utf8"))).toEqual([s]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("preserves malformed existing storage instead of silently overwriting it", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "heart-storage-"));
    try {
      const file = path.join(dir, "shares.json");
      await writeFile(file, "broken");
      await expect(new JsonStorage(file).list()).rejects.toThrow("preserved");
      expect(await readFile(file, "utf8")).toBe("broken");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
