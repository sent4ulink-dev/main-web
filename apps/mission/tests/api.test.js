// node --test tests/  — the card server: studio, links, five-day editing, permanent finish, store links.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, FIVE_DAYS, FIRST_VISIT_GRACE } from '../server/api.js';
import { createLocalBucket } from '../server/local-bucket.js';
import { freshContent, cleanContent } from '../src/share/content-core.js';

function setup() {
  let clock = Date.UTC(2026, 9, 16);
  const api = createApi({ now: () => clock, fetchImpl: async () => new Response('{}', { status: 404 }) });
  const env = { SHARES: createLocalBucket(), STUDIO_PASSWORD: 'secret-pw', CORS_ORIGIN: 'https://card.test', SHARE_CREATE_SECRET: 'store-key' };
  const call = async (path, { method = 'GET', body, token, headers = {} } = {}) => {
    const r = await api.fetch(new Request(`https://card.test${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
    return { status: r.status, data: await r.json() };
  };
  const send = (path, type, bytes, token) => api.fetch(new Request(`https://card.test${path}`, { method: 'POST', headers: { 'content-type': type, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: bytes }), env);
  return { call, send, env, advance: (ms) => { clock += ms; } };
}

test('studio: password, save the draft, then a link from that exact revision', async () => {
  const { call } = setup();
  assert.equal((await call('/api/studio/login', { method: 'POST', body: { password: 'nope' } })).status, 401);
  const { data: { token } } = await call('/api/studio/login', { method: 'POST', body: { password: 'secret-pw' } });
  assert.ok(token);
  assert.equal((await call('/api/studio/draft')).status, 401, 'needs the token');
  const draft = (await call('/api/studio/draft', { token })).data;
  assert.equal(draft.revision, 0);
  assert.equal((await call('/api/studio/links', { method: 'POST', body: { revision: 0 }, token })).status, 409, 'save first');
  const content = { ...draft.content, name: 'Sara' };
  assert.equal((await call('/api/studio/draft', { method: 'PUT', body: { content, revision: 0 }, token })).data.revision, 1);
  const link = await call('/api/studio/links', { method: 'POST', body: { revision: 1 }, token });
  assert.equal(link.status, 201);
  assert.match(link.data.id, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(link.data.url, `https://card.test/?share=${link.data.id}`);
  assert.equal((await call(`/api/invitations/${link.data.id}`)).data.content.name, 'Sara');
});

test('a link: edit for five days from the first visit, then permanently finish', async () => {
  const { call, advance } = setup();
  const { data: { token } } = await call('/api/studio/login', { method: 'POST', body: { password: 'secret-pw' } });
  const d = (await call('/api/studio/draft', { token })).data;
  await call('/api/studio/draft', { method: 'PUT', body: { content: d.content, revision: 0 }, token });
  const { id } = (await call('/api/studio/links', { method: 'POST', body: { revision: 1 }, token })).data;
  advance(FIRST_VISIT_GRACE + 1000);
  const first = (await call(`/api/invitations/${id}`)).data;
  assert.equal(first.canEdit, true);
  const edited = { ...first.content, from: 'Bat' };
  assert.equal((await call(`/api/invitations/${id}`, { method: 'PUT', body: { content: edited, revision: 0 } })).data.revision, 1);
  assert.equal((await call(`/api/invitations/${id}`, { method: 'PUT', body: { content: edited, revision: 0 } })).status, 409, 'stale revision');
  const done = await call(`/api/invitations/${id}/finish`, { method: 'POST', body: { content: edited, revision: 1 } });
  assert.equal(done.data.finished, true);
  assert.equal((await call(`/api/invitations/${id}`, { method: 'PUT', body: { content: edited, revision: 2 } })).status, 423, 'locked for good');
  const view = (await call(`/api/invitations/${id}`)).data;
  assert.equal(view.canEdit, false);
  assert.equal(view.content.from, 'Bat');
});

test('the window closes five days after the first visit', async () => {
  const { call, advance } = setup();
  const { data: { token } } = await call('/api/studio/login', { method: 'POST', body: { password: 'secret-pw' } });
  const d = (await call('/api/studio/draft', { token })).data;
  await call('/api/studio/draft', { method: 'PUT', body: { content: d.content, revision: 0 }, token });
  const { id } = (await call('/api/studio/links', { method: 'POST', body: { revision: 1 }, token })).data;
  advance(FIRST_VISIT_GRACE + 1000);
  const c = (await call(`/api/invitations/${id}`)).data.content;
  advance(FIVE_DAYS + 1000);
  assert.equal((await call(`/api/invitations/${id}`, { method: 'PUT', body: { content: c, revision: 0 } })).status, 423);
});

test('bought links: made on the create secret, unknown ids unavailable', async () => {
  const { call } = setup();
  const id = 'A'.repeat(22);   // the orders server's link ids are 22 characters
  assert.equal((await call(`/api/invitations/${id}`)).status, 404);
  assert.equal((await call(`/api/invitations/${id}/ensure`, { method: 'POST' })).status, 403);
  assert.equal((await call(`/api/invitations/${id}/ensure`, { method: 'POST', headers: { 'x-card-create-secret': 'store-key' } })).status, 201);
  assert.equal((await call(`/api/invitations/${id}`)).status, 200);
  assert.equal((await call('/api/invitations/short')).status, 404);
});

test('an id bought on sent4u is made the first time it is opened; any other id is not', async () => {
  const asked = [];
  const ask = (answer) => async (url) => { asked.push(String(url)); return answer; };
  const env = { SHARES: createLocalBucket(), ORDERS_API_BASE: 'https://orders.test/', CORS_ORIGIN: 'https://card.test' };
  const get = (api, id) => api.fetch(new Request(`https://card.test/api/invitations/${id}`), env);
  const id = 'B'.repeat(22);
  assert.equal((await get(createApi({ fetchImpl: ask(Response.json({ ok: true, product: 'pixel' })) }), id)).status, 404, 'bought for another style');
  assert.equal((await get(createApi({ fetchImpl: ask(new Response('{}', { status: 404 })) }), id)).status, 404, 'unknown or refunded');
  const made = await get(createApi({ fetchImpl: ask(Response.json({ ok: true, product: 'mission' })) }), id);
  assert.equal(made.status, 200);
  assert.equal(asked.at(-1), `https://orders.test/links/${id}`);
  assert.equal((await get(createApi({ fetchImpl: ask(new Response('{}', { status: 404 })) }), id)).status, 200, 'once made it stays, even if the orders server cannot be asked');
});

test('content: only the card\'s own shape is accepted', () => {
  assert.doesNotThrow(() => cleanContent(freshContent()));
  assert.throws(() => cleanContent({ ...freshContent(), evil: '<script>' }));
  assert.throws(() => cleanContent({ ...freshContent(), date: { ...freshContent().date, iso: 'tomorrow' } }));
  assert.throws(() => cleanContent({ ...freshContent(), photos: [{ src: 'https://x/y.png', caption: '' }] }));
  const t = cleanContent({ ...freshContent(), texts: { 'Letter': 'My letter' } });
  assert.equal(t.texts['Letter'], 'My letter');
});

test('media: uploads are served, replaced ones deleted, links get copies', async () => {
  const { call, send, env } = setup();
  const keys = (prefix) => env.SHARES.keys().filter((k) => k.startsWith(prefix));
  const { data: { token } } = await call('/api/studio/login', { method: 'POST', body: { password: 'secret-pw' } });
  assert.equal((await send('/api/studio/media', 'image/webp', new Uint8Array([1, 2, 3]))).status, 401, 'needs the token');
  assert.equal((await send('/api/studio/media', 'text/html', new Uint8Array([1]), token)).status, 415);
  assert.equal((await send('/api/studio/media', 'audio/webm', new Uint8Array(800001), token)).status, 413);
  const a = (await (await send('/api/studio/media', 'image/webp', new Uint8Array([1, 2, 3]), token)).json()).name;
  const served = await api(`/api/media/studio/${a.slice(6)}`);
  assert.equal(served.headers.get('content-type'), 'image/webp');
  assert.deepEqual([...new Uint8Array(await served.arrayBuffer())], [1, 2, 3]);
  const c = (await call('/api/studio/draft', { token })).data.content;
  c.photos[0].src = a;
  await call('/api/studio/draft', { method: 'PUT', body: { content: c, revision: 0 }, token });
  const b = (await (await send('/api/studio/media', 'image/webp', new Uint8Array([4]), token)).json()).name;
  const v = (await (await send('/api/studio/media', 'audio/webm', new Uint8Array([5]), token)).json()).name;
  c.photos[0].src = b; c.song.voice = v;
  await call('/api/studio/draft', { method: 'PUT', body: { content: c, revision: 1 }, token });
  assert.deepEqual(keys('media/studio/').sort(), [`media/studio/${b.slice(6)}`, `media/studio/${v.slice(6)}`].sort(), 'the replaced photo is gone');
  const { id } = (await call('/api/studio/links', { method: 'POST', body: { revision: 2 }, token })).data;
  assert.equal(keys(`media/${id}/`).length, 2, 'the link has its own copies');
  c.song.voice = '';
  await call(`/api/invitations/${id}`, { method: 'PUT', body: { content: c, revision: 0 } });
  assert.equal(keys(`media/${id}/`).length, 1, 'the deleted voice is gone');
  assert.equal(keys('media/studio/').length, 2, 'the studio keeps its own');
  async function api(path) { return createApi().fetch(new Request(`https://card.test${path}`), env); }
});

test('yt-check: whether a YouTube song can play inside the card', async () => {
  const answer = (status, body = {}) => async (u) => { assert.match(String(u), /^https:\/\/www\.youtube\.com\/oembed\?format=json&url=/); return Response.json(body, { status }); };
  const check = async (fetchImpl, id = 'dQw4w9WgXcQ') => (await (await createApi({ fetchImpl }).fetch(new Request(`https://card.test/api/yt-check/${id}`), {})).json());
  assert.deepEqual(await check(answer(200, { title: 'A song' })), { ok: true, title: 'A song' });
  assert.deepEqual(await check(answer(401)), { ok: false, reason: 'blocked' });
  assert.deepEqual(await check(answer(404)), { ok: false, reason: 'missing' });
  assert.deepEqual(await check(answer(500)), { ok: true }, 'cannot tell: not stopped');
  assert.deepEqual(await check(async () => { throw new Error('offline'); }), { ok: true });
  assert.equal((await createApi().fetch(new Request('https://card.test/api/yt-check/not-an-id'), {})).status, 503, 'a wrong id is not a song check (no storage in this test)');
});

test('content: the background song and the saved picture words are kept, a bad link is refused', () => {
  const c = freshContent();
  assert.equal(c.song.bg, '');
  assert.equal(c.share.title, 'HAPPY BIRTHDAY');
  const ok = cleanContent({ ...c, song: { ...c.song, bg: 'https://youtu.be/dQw4w9WgXcQ' }, share: { ...c.share, title: 'Happy 30th,', line: 'Love you' } });
  assert.equal(ok.song.bg, 'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(ok.share.title, 'Happy 30th,');
  assert.throws(() => cleanContent({ ...c, song: { ...c.song, bg: 'not a link' } }));
});
