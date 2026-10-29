// The server as Cloudflare runs it: functions/api/[[path]].js around server/api.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/[[path]].js';
import { memoryBucket } from './helpers/memory-bucket.js';

const SITE = 'https://sent4u.link';
const ID = 'A'.repeat(32);
const call = (env, path, init = {}) => onRequest({ request: new Request(SITE + path, init), env });
const send = (env, path, method, body, origin = SITE) =>
  call(env, path, { method, headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });

test('without its bucket it says so instead of failing', async () => {
  const response = await call({}, `/api/invitations/${ID}`);
  assert.equal(response.status, 503);
});

test('the store makes a sold link with its secret; the link opens and saves from this site only', async () => {
  const env = { SHARES: memoryBucket(), SHARE_CREATE_SECRET: 'shop-secret' };
  const refused = await call(env, `/api/invitations/${ID}/ensure`, { method: 'POST', headers: { 'x-halloween-create-secret': 'wrong' } });
  assert.equal(refused.status, 403);
  const made = await call(env, `/api/invitations/${ID}/ensure`, { method: 'POST', headers: { 'x-halloween-create-secret': 'shop-secret' } });
  assert.equal(made.status, 201);
  const again = await call(env, `/api/invitations/${ID}/ensure`, { method: 'POST', headers: { 'x-halloween-create-secret': 'shop-secret' } });
  assert.deepEqual(await again.json(), { ok: true, existed: true });
  const link = await (await call(env, `/api/invitations/${ID}`)).json();
  assert.equal(link.revision, 0);
  const elsewhere = await send(env, `/api/invitations/${ID}`, 'PUT', { content: link.content, revision: 0 }, 'https://evil.example');
  assert.equal(elsewhere.status, 403, 'another website cannot change it');
  const saved = await send(env, `/api/invitations/${ID}`, 'PUT', { content: link.content, revision: 0 });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).revision, 1);
});

test('a save and a finish at the same moment: the link stays finished', async () => {
  for (let round = 0; round < 5; round += 1) {
    const env = { SHARES: memoryBucket({ delay: 6 }), SHARE_CREATE_SECRET: 's' };
    await call(env, `/api/invitations/${ID}/ensure`, { method: 'POST', headers: { 'x-halloween-create-secret': 's' } });
    const { content } = await (await call(env, `/api/invitations/${ID}`)).json();
    const [finish, save] = await Promise.all([
      send(env, `/api/invitations/${ID}/finish`, 'POST', { content, revision: 0 }),
      send(env, `/api/invitations/${ID}`, 'PUT', { content, revision: 0 }),
    ]);
    const after = await (await call(env, `/api/invitations/${ID}`)).json();
    if (finish.status === 200) assert.equal(after.finished, true, `round ${round}: finished link came back to life (save ${save.status})`);
    assert.equal([finish.status, save.status].filter((s) => s === 200).length, 1, `round ${round}: exactly one of the two may win (${finish.status}, ${save.status})`);
  }
});

test('wrong studio passwords are counted even when they arrive together', async () => {
  const env = { SHARES: memoryBucket({ delay: 5 }), STUDIO_PASSWORD: 'the-real-studio-password' };
  const tries = await Promise.all(Array.from({ length: 12 }, () => send(env, '/api/studio/login', 'POST', { password: 'guess' })));
  const statuses = tries.map((r) => r.status);
  assert.equal(statuses.filter((s) => s === 401).length, 10, JSON.stringify(statuses));
  assert.equal(statuses.filter((s) => s === 429).length, 2, JSON.stringify(statuses));
});
