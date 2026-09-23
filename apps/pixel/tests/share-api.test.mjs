/* oxlint-disable typescript/no-floating-promises */
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';
import { defaultShareContent } from '../lib/share-content.ts';

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

test('share API only lets the fulfillment secret mint a share, then anyone with the link can edit and permanently finalize it', async () => {
  const e = env();
  const id = 'realOrderId1234567890';
  const base = 'http://pixel-share-api.test';

  const missingBeforeCreate = await worker.fetch(new Request(`${base}/shares/${id}`), e);
  assert.equal(missingBeforeCreate.status, 404);

  const deniedEnsure = await worker.fetch(
    new Request(`${base}/shares/${id}/ensure`, { method: 'POST' }),
    e,
  );
  assert.equal(deniedEnsure.status, 403);

  const ensure = () =>
    worker.fetch(
      new Request(`${base}/shares/${id}/ensure`, {
        method: 'POST',
        headers: { 'x-date-create-secret': 'test-fulfillment-secret' },
      }),
      e,
    );
  const ensured = await ensure();
  assert.equal(ensured.status, 201);
  assert.deepEqual(await ensured.json(), { ok: true, existed: false });

  const ensuredAgain = await ensure();
  assert.equal(ensuredAgain.status, 200);
  assert.deepEqual(await ensuredAgain.json(), { ok: true, existed: true });

  const fetched = await (await worker.fetch(new Request(`${base}/shares/${id}`), e)).json();
  assert.equal(fetched.content.sender, defaultShareContent.sender);
  assert.equal(fetched.finalized, false);
  assert.ok(new Date(fetched.editUntil).getTime() > Date.now());

  const changed = { ...defaultShareContent, sender: 'Test sender' };
  const updated = await worker.fetch(
    new Request(`${base}/shares/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: changed }),
    }),
    e,
  );
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).content.sender, changed.sender);

  const finalized = await worker.fetch(
    new Request(`${base}/shares/${id}/finalize`, { method: 'POST' }),
    e,
  );
  assert.equal(finalized.status, 200);
  assert.equal((await finalized.json()).finalized, true);

  const lockedUpdate = await worker.fetch(
    new Request(`${base}/shares/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: defaultShareContent }),
    }),
    e,
  );
  assert.equal(lockedUpdate.status, 423);

  const lockedFinalize = await worker.fetch(
    new Request(`${base}/shares/${id}/finalize`, { method: 'POST' }),
    e,
  );
  assert.equal(lockedFinalize.status, 423);

  const missing = await worker.fetch(new Request(`${base}/shares/unmintedRealLookingId12`), e);
  assert.equal(missing.status, 404);

  const health = await (await worker.fetch(new Request(`${base}/health`), e)).json();
  assert.deepEqual(health, { ok: true });
});

test('self-heals a share the orders Worker confirms was really paid for, but rejects one it does not recognize', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (String(url).endsWith('/links/RealOrderId12345'))
      return new Response(JSON.stringify({ ok: true, product: 'pixel' }), { status: 200 });
    if (String(url).endsWith('/links/OtherProductId1234'))
      return new Response(JSON.stringify({ ok: true, product: 'pinky' }), { status: 200 });
    return new Response(JSON.stringify({ error: 'Not found.' }), { status: 404 });
  };
  try {
    const e = env({ ORDERS_API_BASE: 'https://orders.example.test' });
    const base = 'http://pixel-share-api.test';

    const healed = await worker.fetch(new Request(`${base}/shares/RealOrderId12345`), e);
    assert.equal(healed.status, 200);
    const body = await healed.json();
    assert.equal(body.content.sender, defaultShareContent.sender);

    const wrongProduct = await worker.fetch(new Request(`${base}/shares/OtherProductId1234`), e);
    assert.equal(wrongProduct.status, 404);

    const unknown = await worker.fetch(new Request(`${base}/shares/NeverIssuedId12345`), e);
    assert.equal(unknown.status, 404);
    assert.ok(calls.length >= 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
