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

console.log(`\n${passed} tests passed`);
