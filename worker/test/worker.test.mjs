// Run with: node test/worker.test.mjs   (no install needed — the bucket is faked in memory)
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { fakeBucket } from './fake-bucket.mjs';
import { fakeKV } from './fake-kv.mjs';

const ORIGIN = 'https://sent4u.link';
const env = () => ({ BUCKET: fakeBucket(), AUTH: fakeKV(), ALLOWED_ORIGINS: `${ORIGIN},http://localhost:4173`, ADMIN_TOKEN: 'secret-token' });
const call = (e, path, { method = 'GET', body, ip = '1.1.1.1', origin = ORIGIN, headers = {} } = {}) =>
  worker.fetch(new Request(`https://reviews.test${path}`, {
    method,
    headers: { 'CF-Connecting-IP': ip, ...(origin ? { Origin: origin } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  }), e);
const good = (over = {}) => ({ rating: 5, tool: 'Pinky', text: 'The invite looked gorgeous and everyone opened it.', name: 'Lena K.', role: 'Planner', email: 'lena@example.com', consent: true, ...over });

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('  ok  ' + name); };

await test('an empty bucket gives an empty list', async () => {
  const e = env();
  const res = await call(e, '/reviews');
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).reviews, []);
});

await test('a valid review is live straight away, and the private bits are not public', async () => {
  const e = env();
  const res = await call(e, '/reviews', { method: 'POST', body: good() });
  assert.equal(res.status, 201);
  const made = (await res.json()).review;
  assert.equal(made.name, 'Lena K.');
  const list = (await (await call(e, '/reviews')).json()).reviews;
  assert.equal(list.length, 1);
  assert.equal(list[0].text, good().text);
  assert.ok(!('email' in list[0]) && !('ipHash' in list[0]));
  // the email is kept privately in the review's own object
  const stored = JSON.parse(e.BUCKET.store.get(`reviews/${made.id}.json`));
  assert.equal(stored.email, 'lena@example.com');
  assert.ok(!JSON.stringify(stored).includes('1.1.1.1'));
});

await test('newest first', async () => {
  const e = env();
  await call(e, '/reviews', { method: 'POST', body: good({ name: 'First P.' }), ip: '2.2.2.2' });
  await new Promise(r => setTimeout(r, 5));
  await call(e, '/reviews', { method: 'POST', body: good({ name: 'Second P.', text: 'A second, different review of the whole thing.' }), ip: '3.3.3.3' });
  const list = (await (await call(e, '/reviews')).json()).reviews;
  assert.deepEqual(list.map(r => r.name), ['Second P.', 'First P.']);
});

await test('bad input is refused with a readable message', async () => {
  const e = env();
  const cases = [
    [good({ rating: 0 }), /star rating/], [good({ rating: 6 }), /star rating/], [good({ tool: 'Nope' }), /what you used/],
    [good({ text: 'too short' }), /20 characters/], [good({ name: '   ' }), /name/], [good({ email: 'nope' }), /email/],
    [good({ consent: false }), /Tick the box/], [good({ text: 'Great, see https://spam.example for more of this' }), /links/],
    [good({ text: 'Visit www.spam.example today for a great deal on links' }), /links/],
  ];
  for (const [body, msg] of cases) {
    const res = await call(e, '/reviews', { method: 'POST', body, ip: `9.9.9.${Math.floor(Math.random() * 200)}` });
    assert.equal(res.status, 422, JSON.stringify(body));
    assert.match((await res.json()).error, msg);
  }
  assert.deepEqual((await (await call(e, '/reviews')).json()).reviews, []);
});

await test('markup is stored as plain text and control characters are stripped', async () => {
  const e = env();
  const res = await call(e, '/reviews', { method: 'POST', body: good({ name: '<b>Eve</b>\n\t', text: '<script>alert(1)</script> this is a proper long review' }) });
  assert.equal(res.status, 201);
  const r = (await res.json()).review;
  assert.equal(r.name, '<b>Eve</b>');            // the site only ever shows it as text, never as HTML
  assert.ok(!/[\n\t]/.test(r.text));
});

await test('a filled-in honeypot looks like success but stores nothing', async () => {
  const e = env();
  const res = await call(e, '/reviews', { method: 'POST', body: good({ website: 'http://bot.example' }) });
  assert.equal(res.status, 201);
  assert.deepEqual((await (await call(e, '/reviews')).json()).reviews, []);
});

await test('rate limits: a minute apart, five a day, no repeats', async () => {
  const e = env();
  const first = await call(e, '/reviews', { method: 'POST', body: good(), ip: '5.5.5.5' });
  assert.equal(first.status, 201);
  const soon = await call(e, '/reviews', { method: 'POST', body: good({ text: 'Another review straight after, from the same visitor.' }), ip: '5.5.5.5' });
  assert.equal(soon.status, 429);
  assert.match((await soon.json()).error, /minute/);
  // pretend a minute has passed
  const key = [...e.BUCKET.store.keys()].find(k => k.startsWith('rl/'));
  const s = JSON.parse(e.BUCKET.store.get(key)); s.last -= 61_000; e.BUCKET.store.set(key, JSON.stringify(s));
  const repeat = await call(e, '/reviews', { method: 'POST', body: good(), ip: '5.5.5.5' });
  assert.equal(repeat.status, 429);
  assert.match((await repeat.json()).error, /already been sent/);
  // five a day
  for (let i = 0; i < 4; i++) {
    const s2 = JSON.parse(e.BUCKET.store.get(key)); s2.last -= 61_000; e.BUCKET.store.set(key, JSON.stringify(s2));
    const ok = await call(e, '/reviews', { method: 'POST', body: good({ text: `Review number ${i + 2}, written out in full for the test.` }), ip: '5.5.5.5' });
    assert.equal(ok.status, 201);
  }
  const s3 = JSON.parse(e.BUCKET.store.get(key)); s3.last -= 61_000; e.BUCKET.store.set(key, JSON.stringify(s3));
  const sixth = await call(e, '/reviews', { method: 'POST', body: good({ text: 'The sixth review of the day should not be accepted.' }), ip: '5.5.5.5' });
  assert.equal(sixth.status, 429);
  assert.match((await sixth.json()).error, /tomorrow/);
});

await test('other sites cannot post, and CORS only names allowed origins', async () => {
  const e = env();
  const bad = await call(e, '/reviews', { method: 'POST', body: good(), origin: 'https://evil.example' });
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get('Access-Control-Allow-Origin'), null);
  const okOrigin = await call(e, '/reviews', { origin: 'http://localhost:4173' });
  assert.equal(okOrigin.headers.get('Access-Control-Allow-Origin'), 'http://localhost:4173');
  const pre = await call(e, '/reviews', { method: 'OPTIONS' });
  assert.equal(pre.status, 204);
});

await test('only the owner can delete, and a deleted review leaves the public list', async () => {
  const e = env();
  const made = (await (await call(e, '/reviews', { method: 'POST', body: good() })).json()).review;
  const anon = await call(e, `/reviews/${made.id}`, { method: 'DELETE' });
  assert.equal(anon.status, 403);
  const wrong = await call(e, `/reviews/${made.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer nope' } });
  assert.equal(wrong.status, 403);
  assert.equal((await (await call(e, '/reviews')).json()).reviews.length, 1);
  const done = await call(e, `/reviews/${made.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer secret-token' } });
  assert.equal(done.status, 200);
  assert.deepEqual((await (await call(e, '/reviews')).json()).reviews, []);
  assert.equal(e.BUCKET.store.has(`reviews/${made.id}.json`), false);
  // with no ADMIN_TOKEN set at all, nobody can delete
  const e2 = { ...env(), ADMIN_TOKEN: undefined };
  const m2 = (await (await call(e2, '/reviews', { method: 'POST', body: good() })).json()).review;
  assert.equal((await call(e2, `/reviews/${m2.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer undefined' } })).status, 403);
});

await test('the list is capped at the newest 100', async () => {
  const e = env();
  for (let i = 0; i < 105; i++) {
    const id = `${String(9_999_999_999_999 - (1_700_000_000_000 + i)).padStart(13, '0')}-${i.toString(16).padStart(8, '0')}`;
    e.BUCKET.store.set(`reviews/${id}.json`, JSON.stringify({ id, name: `N${i}`, role: '', tool: 'Send', rating: 5, text: 'x'.repeat(30), at: 1_700_000_000_000 + i }));
  }
  const list = (await (await call(e, '/reviews')).json()).reviews;
  assert.equal(list.length, 100);
  assert.equal(list[0].name, 'N104');
});

await test('claims: a free name can be reserved once, and then it is taken', async () => {
  const e = env();
  assert.equal((await (await call(e, '/claims/ada-l')).json()).available, true);
  const made = await call(e, '/claims', { method: 'POST', body: { handle: 'Ada-L', email: 'ada@example.com' }, ip: '6.6.6.6' });
  assert.equal(made.status, 201);
  assert.equal((await made.json()).handle, 'ada-l');                       // names are stored lower-case
  assert.equal((await (await call(e, '/claims/ada-l')).json()).available, false);
  const again = await call(e, '/claims', { method: 'POST', body: { handle: 'ada-l' }, ip: '7.7.7.7' });
  assert.equal(again.status, 409);
  assert.match((await again.json()).error, /took that one/);
  const stored = JSON.parse(e.BUCKET.store.get('claims/ada-l.json'));
  assert.equal(stored.email, 'ada@example.com');
  assert.ok(!JSON.stringify(stored).includes('6.6.6.6'));
});

await test('claims: bad, reserved and too-short names are refused', async () => {
  const e = env();
  let n = 0;
  for (const [handle, msg] of [['ab', /3–24/], ['-abc', /3–24/], ['abc_', /3–24/], ['a b c', /3–24/], ['a'.repeat(25), /3–24/], ['a--b', /apart/], ['admin', /reserved/], ['sent4u', /reserved/]]) {
    const res = await call(e, '/claims', { method: 'POST', body: { handle }, ip: `8.8.8.${++n}` });
    assert.equal(res.status, 422, handle);
    assert.match((await res.json()).error, msg, handle);
  }
  assert.equal((await call(e, '/claims', { method: 'POST', body: { handle: 'fine-name', email: 'nope' }, ip: '8.8.9.9' })).status, 422);
  assert.equal((await (await call(e, '/claims/admin')).json()).available, false);
  assert.equal([...e.BUCKET.store.keys()].filter(k => k.startsWith('claims/')).length, 0);
});

await test('claims: rate limited, honeypot ignored, other sites refused', async () => {
  const e = env();
  assert.equal((await call(e, '/claims', { method: 'POST', body: { handle: 'first-try' }, ip: '5.4.3.2' })).status, 201);
  const soon = await call(e, '/claims', { method: 'POST', body: { handle: 'second-try' }, ip: '5.4.3.2' });
  assert.equal(soon.status, 429);
  assert.equal((await (await call(e, '/claims/second-try')).json()).available, true);     // the refused one was not stored
  const bot = await call(e, '/claims', { method: 'POST', body: { handle: 'bot-name', website: 'x' }, ip: '5.4.3.3' });
  assert.equal(bot.status, 201);
  assert.equal((await (await call(e, '/claims/bot-name')).json()).available, true);
  assert.equal((await call(e, '/claims', { method: 'POST', body: { handle: 'evil-site' }, origin: 'https://evil.example', ip: '5.4.3.4' })).status, 403);
});

await test('claims: only the owner can free a name', async () => {
  const e = env();
  await call(e, '/claims', { method: 'POST', body: { handle: 'temp-name' }, ip: '4.4.4.4' });
  assert.equal((await call(e, '/claims/temp-name', { method: 'DELETE' })).status, 403);
  assert.equal((await call(e, '/claims/temp-name', { method: 'DELETE', headers: { Authorization: 'Bearer secret-token' } })).status, 200);
  assert.equal((await (await call(e, '/claims/temp-name')).json()).available, true);
});



/* ---------------- orders (Paddle) ---------------- */

// a stand-in for Paddle's Transactions and Adjustments APIs (POST https://paddle.test/transactions, /adjustments), used in place of the real `fetch` for every test below
function fakePaddle() {
  const calls = [];
  let n = 0, broken = false;
  const fetchFn = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push({ url, body });
    if (broken) return { ok: false, status: 400, json: async () => ({ error: { detail: 'nope' } }) };
    if (String(url).endsWith('/adjustments')) {                  // Paddle's Adjustments API: a refund, waiting for Paddle's approval
      const id = `adj_${++n}`;
      calls.at(-1).id = id;
      return { ok: true, status: 201, json: async () => ({ data: { id, status: 'pending_approval', action: body.action, transaction_id: body.transaction_id } }) };
    }
    const id = `txn_${++n}`;
    calls.at(-1).id = id;
    return { ok: true, status: 201, json: async () => ({ data: { id, checkout: { url: `https://pay.test/checkout?_ptxn=${id}` } } }) };
  };
  return { calls, fetchFn, break: () => { broken = true; } };
}

const PADDLE_WEBHOOK_SECRET = 'whsec_test';
const shop = () => ({
  ...env(), ORDER_SECRET: 'order-secret',
  PADDLE_API_KEY: 'padkey_test', PADDLE_API_BASE: 'https://paddle.test', PADDLE_WEBHOOK_SECRET,
  PADDLE_PRICE_SINGLE: 'pri_single', PADDLE_PRICE_PACK: 'pri_pack',
});
const owner = { Authorization: 'Bearer order-secret' };

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const paddleSig = async (secret, rawBody, ts = Math.floor(Date.now() / 1000)) => `ts=${ts};h1=${await hmacHex(secret, `${ts}:${rawBody}`)}`;
const postWebhook = (e, rawBody, sigHeader) => worker.fetch(new Request('https://reviews.test/webhooks/paddle', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(sigHeader !== undefined ? { 'Paddle-Signature': sigHeader } : {}) }, body: rawBody,
}), e);
const completedPayload = (id, token) => JSON.stringify({ event_type: 'transaction.completed', data: { id, custom_data: token ? { orderToken: token } : undefined } });

const startOrder = async (e, pack = 'pack', ip = '9.9.9.9') => (await (await call(e, '/checkout', { method: 'POST', body: { pack }, ip })).json());
const generate = (e, token, items, extra = {}) => call(e, `/orders/${token}/generate`, { method: 'POST', body: { items }, ...extra });

// most order tests pay by playing Paddle's own webhook, exactly like production; a couple of tests further down check the manual
// owner-only /confirm route and the webhook's signature checking directly
const paidOrder = async (e, calls, pack = 'pack', ip = '9.9.9.9') => {
  const { token } = await startOrder(e, pack, ip);
  const { id } = calls.at(-1);
  const raw = completedPayload(id, token);
  const res = await postWebhook(e, raw, await paddleSig(PADDLE_WEBHOOK_SECRET, raw));
  assert.equal(res.status, 200);
  return token;
};

const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('a test forgot to stub fetch — this would have hit the real network'); };

await test('checkout is refused until Paddle is configured, and only accepts the two packs', async () => {
  const off = await call(env(), '/checkout', { method: 'POST', body: { pack: 'pack' } });
  assert.equal(off.status, 501);
  const e = shop();
  globalThis.fetch = fakePaddle().fetchFn;
  assert.equal((await call(e, '/checkout', { method: 'POST', body: { pack: 'huge' } })).status, 422);
  assert.equal((await call(e, '/checkout', { method: 'POST', body: { pack: 'pack' }, origin: 'https://evil.example' })).status, 403);
});

// regression: PACKS[pack] used to be a plain {} lookup, so pack="__proto__" (or "constructor", "toString", …) resolved to an
// inherited Object.prototype value instead of failing — credits/amount silently became undefined, which turned the "never more
// than you paid for" check in generateLinks into `want > NaN`, always false. A single real $14.99 payment would then generate
// unlimited links forever. PACKS is now a null-prototype object so these names simply aren't there.
await test('a pack name that shadows Object.prototype cannot buy unlimited links', async () => {
  const e = shop();
  globalThis.fetch = fakePaddle().fetchFn;
  for (const pack of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
    assert.equal((await call(e, '/checkout', { method: 'POST', body: { pack } })).status, 422, pack);
  }
  assert.equal([...e.BUCKET.store.keys()].filter(k => k.startsWith('orders/')).length, 0);
});

await test('checkout asks Paddle for the right price and custom data, and hands back its checkout link', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const res = await call(e, '/checkout', { method: 'POST', body: { pack: 'single' } });
  assert.equal(res.status, 201);
  const out = await res.json();
  assert.equal(out.token.length, 22);
  assert.equal(paddle.calls.length, 1);
  assert.equal(paddle.calls[0].body.items[0].price_id, 'pri_single');
  assert.equal(paddle.calls[0].body.custom_data.orderToken, out.token);
  assert.equal(out.checkoutUrl, `https://pay.test/checkout?_ptxn=${paddle.calls[0].id}`);
  const order = await (await call(e, `/orders/${out.token}`)).json();
  assert.deepEqual([order.status, order.credits, order.remaining, order.amount, order.links.length], ['pending', 1, 1, 399, 0]);
  assert.ok(!('ipHash' in order));
});

await test('if Paddle is unreachable, checkout fails cleanly and nothing is left behind', async () => {
  const e = shop(), paddle = fakePaddle();
  paddle.break();
  globalThis.fetch = paddle.fetchFn;
  const res = await call(e, '/checkout', { method: 'POST', body: { pack: 'pack' } });
  assert.equal(res.status, 502);
  assert.equal([...e.BUCKET.store.keys()].filter(k => k.startsWith('orders/')).length, 0);
});

await test('an unknown order is a 404, and nothing can be made before the payment is confirmed', async () => {
  const e = shop();
  globalThis.fetch = fakePaddle().fetchFn;
  assert.equal((await call(e, '/orders/AAAAAAAAAAAAAAAAAAAAAA')).status, 404);
  const { token } = await startOrder(e);
  assert.equal((await generate(e, token, { pixel: 1 })).status, 402);
});

await test('the manual owner-only /confirm route still works, for fixing an order Paddle missed', async () => {
  const e = shop();
  globalThis.fetch = fakePaddle().fetchFn;
  const { token } = await startOrder(e);
  assert.equal((await call(e, `/orders/${token}/confirm`, { method: 'POST' })).status, 403);
  assert.equal((await call(e, `/orders/${token}/confirm`, { method: 'POST', headers: { Authorization: 'Bearer wrong' } })).status, 403);
  const first = await call(e, `/orders/${token}/confirm`, { method: 'POST', headers: owner });
  assert.equal((await first.json()).status, 'paid');
  const paidAt = JSON.parse(e.BUCKET.store.get(`orders/${token}.json`)).paidAt;
  const again = await call(e, `/orders/${token}/confirm`, { method: 'POST', headers: owner });
  assert.equal(again.status, 200);
  assert.equal(JSON.parse(e.BUCKET.store.get(`orders/${token}.json`)).paidAt, paidAt);
});

await test('Paddle webhook: a valid transaction.completed marks the order paid, and repeats are a no-op', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const { token } = await startOrder(e);
  const { id } = paddle.calls[0];
  const raw = completedPayload(id, token);
  const res = await postWebhook(e, raw, await paddleSig(PADDLE_WEBHOOK_SECRET, raw));
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(e.BUCKET.store.get(`orders/${token}.json`)).status, 'paid');
  const paidAt = JSON.parse(e.BUCKET.store.get(`orders/${token}.json`)).paidAt;
  const again = await postWebhook(e, raw, await paddleSig(PADDLE_WEBHOOK_SECRET, raw));   // Paddle retries webhooks it isn't sure landed
  assert.equal(again.status, 200);
  assert.equal(JSON.parse(e.BUCKET.store.get(`orders/${token}.json`)).paidAt, paidAt);
});

await test('Paddle webhook: falls back to the transaction-id index when custom_data is missing', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const { token } = await startOrder(e);
  const { id } = paddle.calls[0];
  const raw = completedPayload(id, null);   // no custom_data at all — only the transaction id
  const res = await postWebhook(e, raw, await paddleSig(PADDLE_WEBHOOK_SECRET, raw));
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(e.BUCKET.store.get(`orders/${token}.json`)).status, 'paid');
});

await test('Paddle webhook: refuses a bad, missing, wrongly-signed or stale signature', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const { token } = await startOrder(e);
  const raw = completedPayload(paddle.calls[0].id, token);
  assert.equal((await postWebhook(e, raw, undefined)).status, 401);                                  // no header at all
  assert.equal((await postWebhook(e, raw, 'garbage')).status, 401);
  assert.equal((await postWebhook(e, raw, await paddleSig('wrong-secret', raw))).status, 401);        // signed, but with the wrong secret
  assert.equal((await postWebhook(e, raw, await paddleSig(PADDLE_WEBHOOK_SECRET, raw + 'x'))).status, 401);   // signed over the wrong bytes
  const stale = Math.floor(Date.now() / 1000) - 3600;
  assert.equal((await postWebhook(e, raw, await paddleSig(PADDLE_WEBHOOK_SECRET, raw, stale))).status, 401);  // an hour old
  assert.equal(JSON.parse(e.BUCKET.store.get(`orders/${token}.json`)).status, 'pending');             // none of the above touched the order
  const good = await postWebhook(e, raw, await paddleSig(PADDLE_WEBHOOK_SECRET, raw));
  assert.equal(good.status, 200);
  assert.equal(JSON.parse(e.BUCKET.store.get(`orders/${token}.json`)).status, 'paid');
});

await test('Paddle webhook: an event for an order that does not exist is acknowledged, not an error', async () => {
  const e = shop();
  globalThis.fetch = fakePaddle().fetchFn;
  const raw = completedPayload('txn_nonexistent', 'AAAAAAAAAAAAAAAAAAAAAA');
  const res = await postWebhook(e, raw, await paddleSig(PADDLE_WEBHOOK_SECRET, raw));
  assert.equal(res.status, 200);   // Paddle should not be told to keep retrying forever over a mismatch on our end
});

await test('GET /links/:id says which product a real link is for, and nothing about a fake or revoked one', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  const order = await (await generate(e, token, { winxp: 1 })).json();
  const id = order.links[0].id;
  const found = await call(e, `/links/${id}`);
  assert.equal(found.status, 200);
  assert.deepEqual(await found.json(), { ok: true, product: 'winxp' });
  assert.equal((await call(e, '/links/AAAAAAAAAAAAAAAAAAAAAA')).status, 404);   // well-formed but never issued
  await call(e, `/orders/${token}/refund`, { method: 'POST', headers: owner });
  const afterRefund = await call(e, `/links/${id}`);
  assert.equal(afterRefund.status, 404);   // exists, but revoked — treated the same as not found from the outside
});

await test('a pack of 8 can be split as the buyer likes: 3 Pixel, 2 Pinky, 3 WinXP', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  const res = await generate(e, token, { pixel: 3, pinky: 2, winxp: 3 });
  assert.equal(res.status, 200);
  const order = await res.json();
  assert.equal(order.remaining, 0);
  assert.deepEqual(order.links.map(l => l.product), ['pixel', 'pixel', 'pixel', 'pinky', 'pinky', 'winxp', 'winxp', 'winxp']);
  assert.equal(new Set(order.links.map(l => l.id)).size, 8);
  for (const l of order.links) {
    assert.equal(l.id.length, 22);
    assert.equal(l.url, `https://sent4u.link/?share=${l.id}`);
    const record = JSON.parse(e.BUCKET.store.get(`links/${l.id}.json`));
    assert.deepEqual([record.product, record.order], [l.product, token]);
  }
  assert.equal((await generate(e, token, { pixel: 1 })).status, 422);              // nothing left
});

await test('every style can be chosen: the birthday cards, Petal Isle and Halloween as well', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  const res = await generate(e, token, { halloween: 1, picnic: 2, salon: 2, mission: 1, spooky: 1, petal: 1 });
  assert.equal(res.status, 200);
  const order = await res.json();
  assert.deepEqual(order.links.map(l => l.product), ['petal', 'picnic', 'picnic', 'salon', 'salon', 'mission', 'halloween', 'spooky']);
  for (const l of order.links) {
    const found = await call(e, `/links/${l.id}`);
    assert.deepEqual(await found.json(), { ok: true, product: l.product });
  }
});

await test('it can be spread over several visits, and never past what was paid for', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  assert.equal((await (await generate(e, token, { pinky: 5 })).json()).remaining, 3);
  const tooMany = await generate(e, token, { pixel: 2, winxp: 2 });
  assert.equal(tooMany.status, 422);
  assert.match((await tooMany.json()).error, /only have 3/);
  assert.equal((await (await call(e, `/orders/${token}`)).json()).links.length, 5);   // the refused request made nothing
  assert.equal((await (await generate(e, token, { winxp: 3 })).json()).remaining, 0);
});

await test('a single link is exactly one link', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls, 'single');
  assert.equal((await generate(e, token, { pixel: 1, pinky: 1 })).status, 422);
  assert.equal((await generate(e, token, { winxp: 1 })).status, 200);
  assert.equal((await generate(e, token, { pixel: 1 })).status, 422);
});

await test('bad requests are refused', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  for (const items of [{}, { pixel: 0 }, { pixel: -1 }, { pixel: 1.5 }, { pixel: '2' }, { gameboy: 1 }, { pixel: 99 }, null, [1]]) {
    assert.equal((await generate(e, token, items)).status, 422, JSON.stringify(items));
  }
  assert.equal((await generate(e, token, { pixel: 1 }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await (await call(e, `/orders/${token}`)).json()).links.length, 0);
});

await test('two requests at once can never make more links than were paid for', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  const [a, b] = await Promise.all([generate(e, token, { pixel: 5 }), generate(e, token, { pinky: 5 })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 422]);
  const order = await (await call(e, `/orders/${token}`)).json();
  assert.equal(order.links.length, 5);
  assert.equal([...e.BUCKET.store.keys()].filter(k => k.startsWith('links/')).length, 5);   // the losing request left nothing behind
});

await test('a refund stops the links working', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  const order = await (await generate(e, token, { pixel: 2 })).json();
  assert.equal((await call(e, `/orders/${token}/refund`, { method: 'POST' })).status, 403);
  const res = await call(e, `/orders/${token}/refund`, { method: 'POST', headers: owner });
  assert.equal((await res.json()).status, 'refunded');
  for (const l of order.links) assert.equal(JSON.parse(e.BUCKET.store.get(`links/${l.id}.json`)).revoked, true);
  assert.equal((await generate(e, token, { pixel: 1 })).status, 402);
  assert.equal((await call(e, `/orders/${token}/confirm`, { method: 'POST', headers: owner })).status, 409);
});

await test('orders are limited per visitor', async () => {
  const e = shop();
  globalThis.fetch = fakePaddle().fetchFn;
  assert.equal((await call(e, '/checkout', { method: 'POST', body: { pack: 'single' }, ip: '5.5.5.5' })).status, 201);
  assert.equal((await call(e, '/checkout', { method: 'POST', body: { pack: 'single' }, ip: '5.5.5.5' })).status, 429);   // too soon after the last one
});

/* ---------------- refunds the buyer asks for (10 minutes), and Paddle's refund webhooks ---------------- */

const adjustmentPayload = (type, data) => JSON.stringify({ event_type: type, data });
const sendAdjustment = async (e, type, data) => {
  const raw = adjustmentPayload(type, data);
  const res = await postWebhook(e, raw, await paddleSig(PADDLE_WEBHOOK_SECRET, raw));
  assert.equal(res.status, 200);
};
const askRefund = (e, token, extra = {}) => call(e, `/orders/${token}/refund-request`, { method: 'POST', ...extra });
const stored = (e, token) => JSON.parse(e.BUCKET.store.get(`orders/${token}.json`));
const linkRevoked = (e, id) => JSON.parse(e.BUCKET.store.get(`links/${id}.json`)).revoked === true;
const age = (e, token, ms) => { const o = stored(e, token); o.paidAt -= ms; e.BUCKET.store.set(`orders/${token}.json`, JSON.stringify(o)); };

await test('a paid order says until when it can be refunded', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  const order = await (await call(e, `/orders/${token}`)).json();
  assert.equal(order.refundableUntil, order.paidAt + 10 * 60 * 1000);
  const { token: pending } = await startOrder(e, 'single', '8.8.8.8');
  assert.equal((await (await call(e, `/orders/${pending}`)).json()).refundableUntil, null);
});

await test('within 10 minutes and before any link is made: Paddle is asked for a full refund', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  age(e, token, 9 * 60 * 1000);                                // nine minutes after paying
  const res = await askRefund(e, token);
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.equal(out.status, 'refunding');
  assert.equal(out.refundableUntil, null);
  const call0 = paddle.calls.at(-1);
  assert.equal(call0.url, 'https://paddle.test/adjustments');
  assert.deepEqual([call0.body.action, call0.body.type, call0.body.transaction_id], ['refund', 'full', stored(e, token).paddleTransactionId]);
  assert.equal(stored(e, token).refundAdjustmentId, call0.id);
  assert.equal((await generate(e, token, { pixel: 1 })).status, 402);   // nothing can be made from it any more
  assert.equal((await askRefund(e, token)).status, 409);       // only once

  // Paddle approves it: refunded for good
  await sendAdjustment(e, 'adjustment.updated', { id: call0.id, action: 'refund', type: 'full', status: 'approved', transaction_id: call0.body.transaction_id });
  assert.equal(stored(e, token).status, 'refunded');
});

await test('once a link has been made, the order can no longer be refunded (it could already have been sent and seen)', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  const { links, refundableUntil } = await (await generate(e, token, { pixel: 1 })).json();
  assert.equal(refundableUntil, null);
  const before = paddle.calls.length;
  const res = await askRefund(e, token);
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /already been made/);
  assert.equal(paddle.calls.length, before);                   // Paddle was never asked
  assert.equal(stored(e, token).status, 'paid');
  assert.ok(!linkRevoked(e, links[0].id));
});

await test('after 10 minutes the refund is refused and nothing changes', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  age(e, token, 10 * 60 * 1000 + 1000);
  const before = paddle.calls.length;
  const res = await askRefund(e, token);
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /10 minutes/);
  assert.equal(paddle.calls.length, before);
  assert.equal(stored(e, token).status, 'paid');
});

await test('an unpaid, unknown or foreign-site request is refused', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const { token } = await startOrder(e);
  assert.equal((await askRefund(e, token)).status, 409);
  assert.equal((await askRefund(e, 'AAAAAAAAAAAAAAAAAAAAAA')).status, 404);
  const paid = await paidOrder(e, paddle.calls, 'pack', '8.8.4.4');
  assert.equal((await askRefund(e, paid, { origin: 'https://evil.example' })).status, 403);
  assert.equal(stored(e, paid).status, 'paid');
});

await test('if Paddle can’t take the refund, the buyer keeps the order and can still use it', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  paddle.break();
  const res = await askRefund(e, token);
  assert.equal(res.status, 502);
  assert.equal(stored(e, token).status, 'paid');
  assert.equal((await generate(e, token, { picnic: 1 })).status, 200);
});

await test('if Paddle rejects the refund, the order comes back', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  await askRefund(e, token);
  const adj = paddle.calls.at(-1);
  await sendAdjustment(e, 'adjustment.updated', { id: adj.id, action: 'refund', type: 'full', status: 'rejected', transaction_id: adj.body.transaction_id });
  assert.equal(stored(e, token).status, 'paid');
  assert.equal((await generate(e, token, { mission: 1 })).status, 200);
});

await test('a full refund or chargeback made in the Paddle dashboard stops the links too; a partial refund does not', async () => {
  const e = shop(), paddle = fakePaddle();
  globalThis.fetch = paddle.fetchFn;
  const token = await paidOrder(e, paddle.calls);
  const { links } = await (await generate(e, token, { halloween: 1 })).json();
  const txn = stored(e, token).paddleTransactionId;
  await sendAdjustment(e, 'adjustment.created', { id: 'adj_p', action: 'refund', type: 'partial', status: 'approved', transaction_id: txn });
  assert.equal(stored(e, token).status, 'paid');
  await sendAdjustment(e, 'adjustment.created', { id: 'adj_x', action: 'refund', type: 'full', status: 'pending_approval', transaction_id: txn });
  assert.equal(stored(e, token).status, 'paid');               // nothing until Paddle approves it
  await sendAdjustment(e, 'adjustment.updated', { id: 'adj_x', action: 'refund', type: 'full', status: 'approved', transaction_id: txn });
  assert.equal(stored(e, token).status, 'refunded');
  assert.ok(linkRevoked(e, links[0].id));

  const other = await paidOrder(e, paddle.calls, 'single', '8.8.8.1');
  const { links: more } = await (await generate(e, other, { petal: 1 })).json();
  await sendAdjustment(e, 'adjustment.created', { id: 'adj_cb', action: 'chargeback', type: 'full', status: 'approved', transaction_id: stored(e, other).paddleTransactionId });
  assert.equal(stored(e, other).status, 'refunded');
  assert.ok(linkRevoked(e, more[0].id));
});

await test('an adjustment for a transaction that isn’t ours is acknowledged and ignored', async () => {
  const e = shop();
  globalThis.fetch = fakePaddle().fetchFn;
  await sendAdjustment(e, 'adjustment.created', { id: 'adj_z', action: 'refund', type: 'full', status: 'approved', transaction_id: 'txn_somebody_else' });
});

/* ---------------- signing in (an emailed link to confirm it's you) ---------------- */

// a stand-in for Resend's API — captures every email it was asked to send, never sends anything for real
function fakeEmail() {
  const sent = [];
  const fetchFn = async (url, opts) => {
    assert.equal(url, 'https://api.resend.com/emails');
    sent.push(JSON.parse(opts.body));
    return { ok: true, status: 200, json: async () => ({ id: 'email_test' }) };
  };
  return { sent, fetchFn };
}
const withEmail = env => ({ ...env, RESEND_API_KEY: 'resend_test', EMAIL_FROM: 'sent4u <hello@sent4u.link>' });
const requestLink = (e, email, extra = {}) => call(e, '/auth/request-link', { method: 'POST', body: { email }, ...extra });
// the email's text body always contains the exact link this test then "clicks"
const linkFromEmail = sent => sent.at(-1).text.match(/https:\S+/)[0].replace(/^https:\/\/sent4u\.link/, '');
const tokenFromEmail = sent => new URL(`https://x${linkFromEmail(sent)}`).searchParams.get('token');
const cookieFrom = (res, name) => {
  const all = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('Set-Cookie') || ''];
  for (const c of all) { const m = c.match(new RegExp(`${name}=([^;]*)`)); if (m) return m[1]; }
  return '';
};
const sessionCookieFrom = res => cookieFrom(res, 's4u_session');
const asSession = token => ({ headers: { Cookie: `s4u_session=${token}` } });
// pressing a button on the confirmation page: a normal form post from sent4u.link
const confirmForm = (e, token, { choice, cookie } = {}) => worker.fetch(new Request('https://reviews.test/auth/confirm', {
  method: 'POST',
  headers: { Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded', ...(cookie ? { Cookie: cookie } : {}) },
  body: new URLSearchParams({ token, ...(choice !== undefined ? { choice } : {}) }).toString(),
}), e);
// asking for a link the way the site does: the reply carries the number to show and the waiting cookie
async function startSignIn(e, email = 'lena@example.com', extra = {}) {
  const res = await requestLink(e, email, extra);
  return { res, body: await res.json(), pending: cookieFrom(res, 's4u_signin') };
}
// the whole thing in the browser that asked: open the link, press "Yes, sign me in"
async function signInHere(e, mail, email = 'lena@example.com') {
  const { pending } = await startSignIn(e, email);
  const res = await confirmForm(e, tokenFromEmail(mail.sent), { cookie: `s4u_signin=${pending}` });
  assert.equal(res.status, 303);
  return sessionCookieFrom(res);
}

await test('sign-in is refused until Resend is configured', async () => {
  const res = await requestLink(env(), 'lena@example.com');
  assert.equal(res.status, 501);
});

await test('asking for a link emails a confirmation link and gives the browser a number and a waiting cookie', async () => {
  const e = withEmail(env());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  const { res, body, pending } = await startSignIn(e, 'Lena@Example.com  ');   // stray case/whitespace, like a real input field
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.code, /^\d{2}$/);
  assert.ok(pending);
  assert.equal(mail.sent.length, 1);
  assert.equal(mail.sent[0].to[0], 'lena@example.com');     // trimmed and lower-cased before it's used anywhere
  assert.match(linkFromEmail(mail.sent), /^\/auth\/confirm\?token=/);
});

await test('opening the link only shows a page: a mail scanner that opens it first cannot use it up', async () => {
  const e = withEmail(env());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  const { pending } = await startSignIn(e);
  const path = linkFromEmail(mail.sent);
  for (let i = 0; i < 3; i++) {                                // a scanner, a preview, the person themselves
    const pageRes = await call(e, path, { headers: {} });
    assert.equal(pageRes.status, 200);
    assert.match(pageRes.headers.get('Content-Type'), /text\/html/);
    assert.ok(!sessionCookieFrom(pageRes));
  }
  const html = await (await call(e, path, { headers: { Cookie: `s4u_signin=${pending}` } })).text();
  assert.match(html, /Yes, sign me in/);
  assert.match(html, /le\*+@example\.com/);                    // the address, masked
  assert.ok(!html.includes('lena@example.com'));
});

await test('confirming in the browser that asked signs it in, and its waiting tab sees that', async () => {
  const e = withEmail(env());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  const { pending } = await startSignIn(e);
  const res = await confirmForm(e, tokenFromEmail(mail.sent), { cookie: `s4u_signin=${pending}` });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('Location'), 'https://sent4u.link/?signedin=1');
  const session = sessionCookieFrom(res);
  assert.ok(session);
  const me = await call(e, '/me', asSession(session));
  assert.deepEqual(await me.json(), { email: 'lena@example.com', orders: [] });
  // the same browser's waiting tab: it now has the session cookie, so its next check says yes
  const status = await call(e, '/auth/status', { headers: { Cookie: `s4u_session=${session}; s4u_signin=${pending}` } });
  assert.equal((await status.json()).signedIn, true);
});

await test('confirming on another device: the right number signs the waiting browser in', async () => {
  const e = withEmail(env());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  const { body, pending } = await startSignIn(e);
  const waiting = { headers: { Cookie: `s4u_signin=${pending}` } };
  assert.deepEqual(await (await call(e, '/auth/status', waiting)).json(), { signedIn: false, waiting: true });

  const html = await (await call(e, linkFromEmail(mail.sent), { headers: {} })).text();   // the phone: no waiting cookie
  const offered = [...html.matchAll(/name="choice" value="(\d{2})"/g)].map(m => m[1]);
  assert.equal(offered.length, 3);
  assert.ok(offered.includes(body.code));

  const ok = await confirmForm(e, tokenFromEmail(mail.sent), { choice: body.code });
  assert.equal(ok.status, 200);
  assert.ok(!sessionCookieFrom(ok));                           // the phone itself isn't signed in by this
  const status = await call(e, '/auth/status', waiting);
  assert.equal((await status.json()).signedIn, true);
  const session = sessionCookieFrom(status);
  assert.equal((await call(e, '/me', asSession(session))).status, 200);
  assert.equal((await (await call(e, '/auth/status', waiting)).json()).expired, true);   // used up
});

await test('a wrong number cancels the request, so tapping a link someone else asked for signs nobody in', async () => {
  const e = withEmail(env());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  const { body, pending } = await startSignIn(e);
  const wrong = body.code === '10' ? '11' : '10';
  const res = await confirmForm(e, tokenFromEmail(mail.sent), { choice: wrong });
  assert.match(await res.text(), /didn’t match/);
  const status = await (await call(e, '/auth/status', { headers: { Cookie: `s4u_signin=${pending}` } })).json();
  assert.deepEqual(status, { signedIn: false, expired: true });
  assert.equal((await confirmForm(e, tokenFromEmail(mail.sent), { choice: body.code })).status, 410);   // the link is used up too
});

await test('"sign in on this device" from another device signs that device in, and nothing else', async () => {
  const e = withEmail(env());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  const { pending } = await startSignIn(e);
  const res = await confirmForm(e, tokenFromEmail(mail.sent));
  assert.equal(res.status, 303);
  assert.ok(sessionCookieFrom(res));
  assert.equal((await (await call(e, '/auth/status', { headers: { Cookie: `s4u_signin=${pending}` } })).json()).signedIn, false);
});

await test('a malformed email gets the same reply, but nothing is ever sent', async () => {
  const e = withEmail(env());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  const { res, body } = await startSignIn(e, 'not-an-email');
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.code, /^\d{2}$/);
  assert.equal(mail.sent.length, 0);
});

await test('a link signs in once, then is refused; an unknown or expired one is refused the same way', async () => {
  const e = withEmail(env());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  await startSignIn(e);
  const token = tokenFromEmail(mail.sent);
  assert.equal((await confirmForm(e, token)).status, 303);
  assert.equal((await confirmForm(e, token)).status, 410);
  assert.equal((await call(e, linkFromEmail(mail.sent), { headers: {} })).status, 410);
  assert.equal((await confirmForm(e, 'AAAAAAAAAAAAAAAAAAAAAA')).status, 410);

  await startSignIn(e, 'lena@example.com', { ip: '4.4.4.4' });
  const key = [...e.AUTH.store.keys()].find(k => k.startsWith('login:'));
  e.AUTH.store.get(key).expiresAt = Date.now() - 1000;          // pretend the 15 minutes passed
  assert.equal((await confirmForm(e, tokenFromEmail(mail.sent))).status, 410);
});

await test('the confirmation must come from the sent4u site', async () => {
  const e = withEmail(env());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  await startSignIn(e);
  const res = await worker.fetch(new Request('https://reviews.test/auth/confirm', {
    method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: tokenFromEmail(mail.sent) }).toString(),
  }), e);
  assert.equal(res.status, 403);
  assert.equal((await confirmForm(e, tokenFromEmail(mail.sent))).status, 303);   // still usable from the real page
});

await test('the old /auth/verify links show the confirmation page instead of signing straight in', async () => {
  const e = withEmail(env());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  await startSignIn(e);
  const res = await call(e, `/auth/verify?token=${tokenFromEmail(mail.sent)}`, { headers: {} });
  assert.equal(res.status, 200);
  assert.ok(!sessionCookieFrom(res));
});

await test('sign-in requests are rate limited per visitor, without revealing that in the response', async () => {
  const e = withEmail(env());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  const past = (n) => { // pretend the last request was long enough ago to clear the "give it a moment" cooldown
    const key = [...e.BUCKET.store.keys()].find(k => k.startsWith('rla/'));
    if (!key) return;
    const s = JSON.parse(e.BUCKET.store.get(key)); s.last -= n; e.BUCKET.store.set(key, JSON.stringify(s));
  };
  for (let i = 0; i < 5; i++) {
    past(6000);
    const res = await requestLink(e, 'lena@example.com', { ip: '6.6.6.6' });
    assert.equal(res.status, 200);
  }
  past(6000);
  const limited = await requestLink(e, 'lena@example.com', { ip: '6.6.6.6' });
  assert.equal(limited.status, 200);            // looks identical to a normal success…
  assert.match((await limited.json()).code, /^\d{2}$/);
  assert.equal(mail.sent.length, 5);             // …but nothing was actually sent the 6th time
});

await test('a session lasts 90 days and is renewed while it is used, so a browser stays signed in', async () => {
  const e = withEmail(env());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  const session = await signInHere(e, mail);
  const first = await call(e, '/me', asSession(session));
  assert.equal(first.status, 200);
  assert.ok(!sessionCookieFrom(first));                        // renewed at most once a week
  const record = e.AUTH.store.get(`session:${session}`);
  assert.ok(record.expiresAt - Date.now() > 89 * 24 * 3600 * 1000);
  const stored = JSON.parse(record.value); stored.renewedAt -= 8 * 24 * 3600 * 1000;   // a visit eight days later
  record.value = JSON.stringify(stored); record.expiresAt -= 8 * 24 * 3600 * 1000;
  const later = await call(e, '/me', asSession(session));
  assert.equal(later.status, 200);
  assert.equal(sessionCookieFrom(later), session);
  assert.ok(e.AUTH.store.get(`session:${session}`).expiresAt - Date.now() > 89 * 24 * 3600 * 1000);
});

await test('logging out clears the session; /me then requires signing in again', async () => {
  const e = withEmail(env());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  const session = await signInHere(e, mail);
  assert.equal((await call(e, '/me', asSession(session))).status, 200);

  const out = await call(e, '/auth/logout', { method: 'POST', headers: { Cookie: `s4u_session=${session}` } });
  assert.equal(out.status, 200);
  assert.match(out.headers.get('Set-Cookie') || '', /Max-Age=0/);
  assert.equal((await call(e, '/me', asSession(session))).status, 401);
});

await test('/me requires a session', async () => {
  assert.equal((await call(env(), '/me')).status, 401);
});

await test('checking out while signed in adds the order to My links; signed out, it does not', async () => {
  const e = withEmail(shop());
  const mail = fakeEmail();
  globalThis.fetch = mail.fetchFn;
  const session = await signInHere(e, mail);

  globalThis.fetch = fakePaddle().fetchFn;
  const signedIn = await call(e, '/checkout', { method: 'POST', body: { pack: 'single' }, ...asSession(session) });
  assert.equal(signedIn.status, 201);
  const { token: myToken } = await signedIn.json();

  const guest = await call(e, '/checkout', { method: 'POST', body: { pack: 'single' }, ip: '7.7.7.7' });
  assert.equal(guest.status, 201);
  const { token: guestToken } = await guest.json();

  const me = await call(e, '/me', asSession(session));
  const orders = (await me.json()).orders;
  assert.deepEqual(orders.map(o => o.token), [myToken]);
  assert.ok(!orders.some(o => o.token === guestToken));
});

globalThis.fetch = realFetch;

console.log(`\n${passed} tests passed`);
