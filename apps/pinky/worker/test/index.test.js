import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index.js';

// A tiny in-memory stand-in for an R2 bucket binding — just the get/put shape the
// Worker actually uses (R2ObjectBody's .json(), and .put(key, string, options)).
function fakeBucket() {
  const store = new Map();
  return {
    async get(key) {
      const value = store.get(key);
      return value === undefined ? null : { json: async () => JSON.parse(value) };
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

function env(overrides = {}) {
  return { BUCKET: fakeBucket(), SHARE_CREATE_SECRET: 'test-fulfillment-secret', ...overrides };
}

const base = 'http://pinky-share-api.test';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('share API', () => {
  it('only the fulfillment secret can mint a share, then anyone with the link can edit and permanently finalize it', async () => {
    const e = env();
    const id = 'realOrderId1234567890';

    const missingBeforeCreate = await worker.fetch(new Request(`${base}/api/shares/${id}`), e);
    expect(missingBeforeCreate.status).toBe(404);

    const deniedEnsure = await worker.fetch(new Request(`${base}/api/shares/${id}/ensure`, { method: 'POST' }), e);
    expect(deniedEnsure.status).toBe(403);

    const ensure = () =>
      worker.fetch(
        new Request(`${base}/api/shares/${id}/ensure`, {
          method: 'POST',
          headers: { 'x-date-create-secret': 'test-fulfillment-secret' },
        }),
        e,
      );
    const ensured = await ensure();
    expect(ensured.status).toBe(200);
    expect(await ensured.json()).toEqual({ ok: true, existed: false });

    const ensuredAgain = await ensure();
    expect(await ensuredAgain.json()).toEqual({ ok: true, existed: true });

    const fetched = await (await worker.fetch(new Request(`${base}/api/shares/${id}`), e)).json();
    expect(fetched.content.question).toBe('Will you go on a date with me?');
    expect(fetched.finalized).toBe(false);
    expect(fetched.editUntil).toBeGreaterThan(Date.now());

    const updated = await worker.fetch(
      new Request(`${base}/api/shares/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: { question: 'Changed?' } }),
      }),
      e,
    );
    expect(updated.status).toBe(200);
    expect((await (await worker.fetch(new Request(`${base}/api/shares/${id}`), e)).json()).content.question).toBe(
      'Changed?',
    );

    const finalized = await worker.fetch(new Request(`${base}/api/shares/${id}/finalize`, { method: 'POST' }), e);
    expect(finalized.status).toBe(200);
    expect((await (await worker.fetch(new Request(`${base}/api/shares/${id}`), e)).json()).finalized).toBe(true);

    const lockedUpdate = await worker.fetch(
      new Request(`${base}/api/shares/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: { question: 'One more?' } }),
      }),
      e,
    );
    expect(lockedUpdate.status).toBe(403);

    const health = await (await worker.fetch(new Request(`${base}/health`), e)).json();
    expect(health).toEqual({ ok: true });
  });

  it('rejects an edit past the edit window', async () => {
    const e = env();
    const id = 'expiredOrderId123456';
    await worker.fetch(
      new Request(`${base}/api/shares/${id}/ensure`, {
        method: 'POST',
        headers: { 'x-date-create-secret': 'test-fulfillment-secret' },
      }),
      e,
    );
    const entry = await e.BUCKET.get(`shares/${id}`).then((o) => o.json());
    await e.BUCKET.put(`shares/${id}`, JSON.stringify({ ...entry, editUntil: Date.now() - 1000 }));
    const update = await worker.fetch(
      new Request(`${base}/api/shares/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: { question: 'Too late?' } }),
      }),
      e,
    );
    expect(update.status).toBe(403);
    expect((await update.json()).error).toBe('edit_window_closed');
  });

  it('self-heals a share the orders Worker confirms was really paid for, but rejects one it does not recognize', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (String(url).endsWith('/links/RealOrderId12345'))
          return new Response(JSON.stringify({ ok: true, product: 'pinky' }), { status: 200 });
        if (String(url).endsWith('/links/OtherProductId1234'))
          return new Response(JSON.stringify({ ok: true, product: 'pixel' }), { status: 200 });
        return new Response(JSON.stringify({ error: 'Not found.' }), { status: 404 });
      }),
    );
    const e = env({ ORDERS_API_BASE: 'https://orders.example.test' });

    const healed = await worker.fetch(new Request(`${base}/api/shares/RealOrderId12345`), e);
    expect(healed.status).toBe(200);
    expect((await healed.json()).content.question).toBe('Will you go on a date with me?');

    const wrongProduct = await worker.fetch(new Request(`${base}/api/shares/OtherProductId1234`), e);
    expect(wrongProduct.status).toBe(404);

    const unknown = await worker.fetch(new Request(`${base}/api/shares/NeverIssuedId12345`), e);
    expect(unknown.status).toBe(404);
  });
});

describe('maps proxy', () => {
  it('resolve requires a url and a configured API key', async () => {
    const e = env();
    const missingUrl = await worker.fetch(new Request(`${base}/api/maps/resolve`), e);
    expect(missingUrl.status).toBe(400);
    const notConfigured = await worker.fetch(new Request(`${base}/api/maps/resolve?url=https://maps.google.com/x`), e);
    expect(notConfigured.status).toBe(503);
  });

  it('photo requires a ref and a configured API key', async () => {
    const e = env();
    const missingRef = await worker.fetch(new Request(`${base}/api/maps/photo`), e);
    expect(missingRef.status).toBe(400);
    const notConfigured = await worker.fetch(new Request(`${base}/api/maps/photo?ref=abc`), e);
    expect(notConfigured.status).toBe(503);
  });
});
