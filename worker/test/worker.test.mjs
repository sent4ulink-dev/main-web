// Run with: node test/worker.test.mjs   (no install needed — the bucket is faked in memory)
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { fakeBucket } from './fake-bucket.mjs';

const ORIGIN = 'https://sent4u.link';
const env = () => ({ BUCKET: fakeBucket(), ALLOWED_ORIGINS: `${ORIGIN},http://localhost:4173`, ADMIN_TOKEN: 'secret-token' });
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

// a stand-in for Paddle's Transactions API (POST https://paddle.test/transactions), used in place of the real `fetch` for every test below
function fakePaddle() {
  const calls = [];
  let n = 0, broken = false;
  const fetchFn = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push({ url, body });
    if (broken) return { ok: false, status: 400, json: async () => ({ error: { detail: 'nope' } }) };
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
// than you paid for" check in generateLinks into `want > NaN`, always false. A single real $9.99 payment would then generate
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
  assert.deepEqual([order.status, order.credits, order.remaining, order.amount, order.links.length], ['pending', 1, 1, 199, 0]);
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

globalThis.fetch = realFetch;

console.log(`\n${passed} tests passed`);
