import { describe, it, expect } from "vitest";
import worker, { type Env } from "../worker/src/index";
import { freshContent } from "../shared/content";
import { testPng } from "./png";

// Tiny in-memory stand-ins for the R2 and KV bindings — just the get/put shape the
// Worker actually uses. Real R2/KV behavior (eventual consistency, real TTL expiry)
// isn't reproduced here; that's what the live `wrangler dev` check and the Playwright
// suite (a real, if local, Workers runtime) are for.
function fakeBucket() {
  const store = new Map<string, { value: string; etag: string }>();
  let nextEtag = 1;
  return {
    async get(key: string) {
      const entry = store.get(key);
      return entry === undefined ? null : { json: async () => JSON.parse(entry.value), etag: entry.etag };
    },
    // Mirrors R2's conditional put: with onlyIf.etagDoesNotMatch: "*", only writes when
    // nothing exists yet; with onlyIf.etagMatches, only writes if that's still the
    // current etag. Either way, a failed precondition returns null instead of writing.
    async put(key: string, value: string, opts?: { onlyIf?: { etagDoesNotMatch?: string; etagMatches?: string } }) {
      const entry = store.get(key);
      if (opts?.onlyIf?.etagDoesNotMatch === "*" && entry) return null;
      if (opts?.onlyIf?.etagMatches !== undefined && entry?.etag !== opts.onlyIf.etagMatches) return null;
      const etag = String(nextEtag++);
      store.set(key, { value, etag });
      return { etag };
    },
  };
}

function fakeKV(clock: () => number) {
  const store = new Map<string, { value: string | Uint8Array; expiresAt?: number }>();
  return {
    async get(key: string, type?: "arrayBuffer") {
      const entry = store.get(key);
      if (!entry || (entry.expiresAt !== undefined && entry.expiresAt <= clock())) return null;
      if (type === "arrayBuffer") {
        const bytes = entry.value instanceof Uint8Array ? entry.value : new TextEncoder().encode(entry.value);
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      }
      return entry.value instanceof Uint8Array ? new TextDecoder().decode(entry.value) : entry.value;
    },
    async put(key: string, value: string | Uint8Array, opts?: { expirationTtl?: number }) {
      store.set(key, { value, expiresAt: opts?.expirationTtl ? clock() + opts.expirationTtl * 1000 : undefined });
    },
  };
}

const c = freshContent(),
  createSecret = "server-only-test-fulfillment-secret";

function fixture() {
  let time = 100000000;
  const bucket = fakeBucket();
  const kv = fakeKV(() => time);
  const env = {
    BUCKET: bucket,
    PHOTOS: kv,
    SHARE_CREATE_SECRET: createSecret,
    now: () => time,
  } as unknown as Env;
  return { env, advance: (ms: number) => (time += ms) };
}

function mint(env: Env, id: string) {
  return worker.fetch(
    new Request(`http://test/shares/${id}/ensure`, { method: "POST", headers: { "x-date-create-secret": createSecret } }),
    env,
  );
}

describe("fulfillment secret", () => {
  it("correct secret mints a share; wrong or missing secret is refused", async () => {
    const { env } = fixture();
    expect((await worker.fetch(new Request("http://test/shares/AbCd1234/ensure", { method: "POST" }), env)).status).toBe(
      403,
    );
    expect(
      (
        await worker.fetch(
          new Request("http://test/shares/AbCd1234/ensure", {
            method: "POST",
            headers: { "x-date-create-secret": "wrong" },
          }),
          env,
        )
      ).status,
    ).toBe(403);
    expect((await mint(env, "AbCd1234")).status).toBe(201);
  });
});
describe("real shares", () => {
  it("creates, reads, updates and permanently finalizes a share", async () => {
    const { env } = fixture();
    const created = await mint(env, "AbCd1234");
    expect(created.status).toBe(201);
    const id = (await created.json()).share.id;
    expect(id).toBe("AbCd1234");
    expect((await (await worker.fetch(new Request(`http://test/shares/${id}`), env)).json()).share.content).toEqual(c);
    const put = await worker.fetch(
      new Request(`http://test/shares/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...c, sender: "New sender", finalEmoticon: "cool" }),
      }),
      env,
    );
    expect((await put.json()).share.content.sender).toBe("New sender");
    expect(
      (await (await worker.fetch(new Request(`http://test/shares/${id}`), env)).json()).share.content.finalEmoticon,
    ).toBe("cool");
    expect((await (await worker.fetch(new Request(`http://test/shares/${id}/finalize`, { method: "POST" }), env)).json())
      .share.finalized).toBe(true);
    expect(
      (
        await worker.fetch(new Request(`http://test/shares/${id}`, { method: "PUT", body: JSON.stringify(c) }), env)
      ).status,
    ).toBe(409);
    expect(
      (await worker.fetch(new Request(`http://test/shares/${id}/finalize`, { method: "POST" }), env)).status,
    ).toBe(409);
  });
  it("rejects updates and finalization after expiration", async () => {
    const { env, advance } = fixture();
    const id = "AbCd1234";
    await mint(env, id);
    advance(5 * 86400000);
    expect((await worker.fetch(new Request(`http://test/shares/${id}`, { method: "PUT", body: JSON.stringify(c) }), env))
      .status).toBe(410);
    expect(
      (await worker.fetch(new Request(`http://test/shares/${id}/finalize`, { method: "POST" }), env)).status,
    ).toBe(410);
    expect((await worker.fetch(new Request(`http://test/shares/${id}`), env)).status).toBe(200);
  });
  it("self-heals a share the orders Worker confirms was really paid for, but rejects one it does not recognize", async () => {
    const { env } = fixture();
    (env as unknown as { ORDERS_API_BASE: string }).ORDERS_API_BASE = "https://orders.example.test";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/links/RealOrderId12345"))
        return new Response(JSON.stringify({ ok: true, product: "winxp" }), { status: 200 });
      if (url.endsWith("/links/OtherProductId1234"))
        return new Response(JSON.stringify({ ok: true, product: "pixel" }), { status: 200 });
      return new Response(JSON.stringify({ error: "Not found." }), { status: 404 });
    }) as typeof fetch;
    try {
      const healed = await worker.fetch(new Request("http://test/shares/RealOrderId12345"), env);
      expect(healed.status).toBe(200);
      expect((await healed.json()).share.content).toEqual(c);
      expect((await worker.fetch(new Request("http://test/shares/OtherProductId1234"), env)).status).toBe(404);
      expect((await worker.fetch(new Request("http://test/shares/NeverIssuedId12345"), env)).status).toBe(404);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("rejects malformed content, unknown shape, IDs and oversized payloads", async () => {
    const { env } = fixture();
    await mint(env, "AbCd1234");
    for (const body of [{ ...c, bad: true }, { ...c, sender: "x".repeat(100) }, {}])
      expect(
        (await worker.fetch(new Request("http://test/shares/AbCd1234", { method: "PUT", body: JSON.stringify(body) }), env))
          .status,
      ).toBe(400);
    expect((await worker.fetch(new Request("http://test/shares/no"), env)).status).toBe(400);
  });
  it("serializes concurrent finalize and update operations against the same fake store", async () => {
    const { env } = fixture();
    const id = "AbCd1234";
    await mint(env, id);
    await Promise.all([
      worker.fetch(new Request(`http://test/shares/${id}/finalize`, { method: "POST" }), env),
      worker.fetch(
        new Request(`http://test/shares/${id}`, { method: "PUT", body: JSON.stringify({ ...c, sender: "changed" }) }),
        env,
      ),
    ]);
    expect((await (await worker.fetch(new Request(`http://test/shares/${id}`), env)).json()).share.finalized).toBe(true);
  });
});
describe("temporary photos", () => {
  it("accepts a real PNG, serves exact bytes, expires it and rejects invalid uploads", async () => {
    const { env, advance } = fixture();
    const png = testPng();
    const uploaded = await worker.fetch(
      new Request("http://test/photos", {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: png,
      }),
      env,
    );
    expect(uploaded.status).toBe(201);
    const body = await uploaded.json();
    expect(body.path).toMatch(/^\/photos\/[A-Za-z0-9_-]{24}$/);
    const image = await worker.fetch(new Request(`http://test${body.path}`), env);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(new Uint8Array(png));
    advance(15 * 60000);
    expect((await worker.fetch(new Request(`http://test${body.path}`), env)).status).toBe(404);

    expect(
      (
        await worker.fetch(
          new Request("http://test/photos", { method: "POST", headers: { "Content-Type": "image/png" }, body: "fake png" }),
          env,
        )
      ).status,
    ).toBe(400);
    expect((await worker.fetch(new Request("http://test/photos/bad"), env)).status).toBe(400);
    expect((await worker.fetch(new Request("http://test/photos/aaaaaaaaaaaaaaaaaaaaaaaa"), env)).status).toBe(404);
  });
  it("throttles uploads per IP", async () => {
    const { env } = fixture();
    const png = testPng();
    const upload = (ip: string) =>
      worker.fetch(
        new Request("http://test/photos", {
          method: "POST",
          headers: { "Content-Type": "image/png", "CF-Connecting-IP": ip },
          body: png,
        }),
        env,
      );
    for (let i = 0; i < 6; i++) expect((await upload("1.2.3.4")).status).toBe(201);
    expect((await upload("1.2.3.4")).status).toBe(429);
    expect((await upload("9.8.7.6")).status).toBe(201);
  });
});
