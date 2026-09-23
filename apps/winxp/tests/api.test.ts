import { afterEach, describe, it, expect } from "vitest";
import request from "supertest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app";
import { MemoryStorage, JsonStorage } from "../server/storage";
import { freshContent } from "../shared/content";
import { testPng } from "./png";
const c = freshContent(),
  password = "server-only-test-password";
const apps: ReturnType<typeof createApp>[] = [];
function fixture() {
  let time = 100000000;
  const storage = new MemoryStorage();
  const app = createApp({ storage, password, now: () => time });
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
async function token(app: ReturnType<typeof createApp>, ip = "1.2.3.4") {
  return (
    await request(app)
      .post("/api/studio/unlock")
      .set("X-Forwarded-For", ip)
      .send({ password })
  ).body.token as string;
}
describe("password and authorization", () => {
  it("correct password returns only a temporary opaque token", async () => {
    const { app, advance } = fixture();
    const t = await token(app);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(t).not.toContain(password);
    expect((await request(app).post("/shares").send(c)).status).toBe(401);
    expect(
      (
        await request(app)
          .post("/shares")
          .set("Authorization", `Bearer ${t}`)
          .send(c)
      ).status,
    ).toBe(201);
    advance(7200001);
    expect(
      (
        await request(app)
          .post("/shares")
          .set("Authorization", `Bearer ${t}`)
          .send(c)
      ).status,
    ).toBe(401);
  });
  it("two failures lock only the real client IP, even with correct password", async () => {
    const { app, advance } = fixture();
    const unlock = (pw: string, ip = "10.1.2.3") =>
      request(app)
        .post("/api/studio/unlock")
        .set("X-Forwarded-For", ip)
        .send({ password: pw });
    expect((await unlock("wrong")).body).toEqual({
      status: "wrong",
      attemptsRemaining: 1,
    });
    expect((await unlock("wrong")).body).toMatchObject({
      status: "locked_out",
      retryAfterMs: 86400000,
    });
    expect((await unlock(password)).body.status).toBe("locked_out");
    expect((await unlock(password, "10.1.2.4")).body.status).toBe("ok");
    advance(86400001);
    expect((await unlock(password)).body.status).toBe("ok");
  });
  it("successful unlock resets failed attempt state", async () => {
    const { app } = fixture();
    const unlock = (pw: string) =>
      request(app).post("/api/studio/unlock").send({ password: pw });
    await unlock("wrong");
    await unlock(password);
    expect((await unlock("wrong")).body).toEqual({
      status: "wrong",
      attemptsRemaining: 1,
    });
  });
  it("rejects malformed bodies and never exposes a secret", async () => {
    const { app } = fixture();
    const r = await request(app)
      .post("/api/studio/unlock")
      .send({ password: 3 });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).not.toContain(password);
  });
});
describe("real shares", () => {
  it("creates, reads, updates and permanently finalizes a share", async () => {
    const { app } = fixture();
    const t = await token(app);
    const created = await request(app)
      .post("/shares")
      .set("Authorization", `Bearer ${t}`)
      .send(c);
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect(id).toMatch(/^[A-Za-z0-9_-]{8}$/);
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
      (await request(app).post(`/shares/${id}/finalize`)).body.share.finalized,
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
    const t = await token(app),
      id = (
        await request(app)
          .post("/shares")
          .set("Authorization", `Bearer ${t}`)
          .send(c)
      ).body.id;
    advance(5 * 86400000);
    expect((await request(app).put(`/shares/${id}`).send(c)).status).toBe(410);
    expect(
      (await request(app).post(`/shares/${id}/finalize`)).body.status,
    ).toBe("expired");
    expect((await request(app).get(`/shares/${id}`)).status).toBe(200);
  });
  it("retries reserved IDs and collisions", async () => {
    const storage = new MemoryStorage();
    let count = 0;
    const ids = ["test", "AbCd1234", "AbCd1234", "XyZ_3456"];
    const app = createApp({ storage, password, randomId: () => ids[count++] });
    apps.push(app);
    const t = await token(app);
    const a = await request(app)
        .post("/shares")
        .set("Authorization", `Bearer ${t}`)
        .send(c),
      b = await request(app)
        .post("/shares")
        .set("Authorization", `Bearer ${t}`)
        .send(c);
    expect(a.body.id).toBe("AbCd1234");
    expect(b.body.id).toBe("XyZ_3456");
  });
  it("stats contain aggregate counts only and exclude demo/photos", async () => {
    const { app, advance } = fixture();
    const t = await token(app);
    const create = async () =>
      (
        await request(app)
          .post("/shares")
          .set("Authorization", `Bearer ${t}`)
          .send(c)
      ).body.id;
    const id = await create();
    await request(app).post(`/shares/${id}/finalize`);
    await create();
    advance(5 * 86400000);
    const t2 = await token(app);
    await request(app)
      .post("/shares")
      .set("Authorization", `Bearer ${t2}`)
      .send(c);
    const result = await request(app).get("/stats");
    expect(result.body).toEqual({
      status: "ok",
      total: 3,
      active: 1,
      finalized: 1,
      expired: 1,
    });
    expect(JSON.stringify(result.body)).not.toContain(id);
    expect((await request(app).get("/shares/test")).status).toBe(400);
  });
  it("rejects malformed content, unknown shape, IDs and oversized payloads", async () => {
    const { app } = fixture(),
      t = await token(app);
    for (const body of [
      { ...c, bad: true },
      { ...c, sender: "x".repeat(100) },
      {},
    ])
      expect(
        (
          await request(app)
            .post("/shares")
            .set("Authorization", `Bearer ${t}`)
            .send(body)
        ).status,
      ).toBe(400);
    expect((await request(app).get("/shares/no")).status).toBe(400);
    expect(
      (
        await request(app)
          .post("/shares")
          .set("Authorization", `Bearer ${t}`)
          .send({ ...c, messageTemplate: "x".repeat(50000) })
      ).status,
    ).toBe(413);
  });
  it("async storage failures return structured JSON immediately", async () => {
    const storage = new MemoryStorage();
    storage.get = async () => {
      throw new Error("private storage failure");
    };
    const app = createApp({ storage, password });
    apps.push(app);
    const r = await request(app).get("/shares/AbCd1234").timeout(2000);
    expect(r.status).toBe(500);
    expect(r.body).toMatchObject({ status: "error" });
    expect(JSON.stringify(r.body)).not.toContain("private storage");
  });
  it("serializes concurrent finalize and update operations", async () => {
    const { app } = fixture(),
      t = await token(app);
    const id = (
      await request(app)
        .post("/shares")
        .set("Authorization", `Bearer ${t}`)
        .send(c)
    ).body.id;
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
  it("accepts a real PNG, serves exact bytes, expires it and never counts it as a share", async () => {
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
    expect((await request(app).get("/stats")).body.total).toBe(0);
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
      const first = createApp({ storage: new JsonStorage(file), password });
      apps.push(first);
      const t = await token(first);
      const created = await request(first)
        .post("/shares")
        .set("Authorization", `Bearer ${t}`)
        .send(c);
      const id = created.body.id;
      await request(first)
        .put(`/shares/${id}`)
        .send({ ...c, sender: "Persisted sender" });
      await request(first).post(`/shares/${id}/finalize`);
      const restarted = createApp({ storage: new JsonStorage(file), password });
      apps.push(restarted);
      const loaded = await request(restarted).get(`/shares/${id}`);
      expect(loaded.body.share).toMatchObject({
        id,
        content: { sender: "Persisted sender" },
        finalized: true,
        createdAt: created.body.share.createdAt,
        editUntil: created.body.editUntil,
      });
      expect(
        (await request(restarted).put(`/shares/${id}`).send(c)).status,
      ).toBe(409);
      expect(
        (
          await request(restarted)
            .post("/shares")
            .set("Authorization", `Bearer ${t}`)
            .send(c)
        ).status,
      ).toBe(401);
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
