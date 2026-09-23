/* oxlint-disable typescript/no-floating-promises */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultShareContent } from '../lib/share-content.ts';

test('share API creates, updates, counts and permanently finalizes a share', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'little-signal-api-'));
  const port = 18941;
  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DATA_FILE: join(directory, 'shares.json'),
      STUDIO_PASSWORD: 'test-password',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    server.kill();
    await rm(directory, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('API did not start.')),
      5000,
    );
    server.stdout.on('data', (chunk) => {
      if (!chunk.toString().includes('Share API listening')) return;
      clearTimeout(timer);
      resolve();
    });
    server.once('error', reject);
    server.stderr.on('data', (chunk) => reject(new Error(chunk.toString())));
  });
  const base = `http://127.0.0.1:${port}`;

  const unlock = (password, ip) =>
    fetch(`${base}/api/studio/unlock`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({ password }),
    });

  const firstFailure = await unlock('wrong-password', '203.0.113.10');
  assert.equal(firstFailure.status, 401);
  assert.deepEqual(await firstFailure.json(), {
    status: 'wrong',
    attemptsRemaining: 1,
  });
  const secondFailure = await unlock('wrong-again', '203.0.113.10');
  assert.equal(secondFailure.status, 429);
  assert.equal((await secondFailure.json()).status, 'locked_out');
  const correctButLocked = await unlock('test-password', '203.0.113.10');
  assert.equal(correctButLocked.status, 429);

  const login = await unlock('test-password', '203.0.113.11');
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  assert.equal(loginBody.status, 'ok');
  const studioToken = loginBody.token;
  assert.equal(typeof studioToken, 'string');

  const denied = await fetch(`${base}/shares`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: defaultShareContent }),
  });
  assert.equal(denied.status, 401);

  const createdResponse = await fetch(`${base}/shares`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${studioToken}`,
    },
    body: JSON.stringify({ content: defaultShareContent }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.match(created.id, /^[A-Za-z0-9_-]{8}$/);
  assert.ok(new Date(created.editUntil).getTime() > Date.now());

  const fetched = await fetch(`${base}/shares/${created.id}`).then((response) =>
    response.json(),
  );
  assert.equal(fetched.content.sender, defaultShareContent.sender);
  assert.equal(fetched.editToken, undefined);
  assert.equal(fetched.editTokenHash, undefined);

  const changed = { ...defaultShareContent, sender: 'Туршилтын илгээгч' };
  const updated = await fetch(`${base}/shares/${created.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: changed }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).content.sender, changed.sender);

  const stats = await fetch(`${base}/stats`).then((response) =>
    response.json(),
  );
  assert.deepEqual(stats, { total: 1, finalized: 0, active: 1 });

  const deniedFinalize = await fetch(`${base}/shares/${created.id}/finalize`, {
    method: 'POST',
  });
  assert.equal(deniedFinalize.status, 403);

  const finalized = await fetch(`${base}/shares/${created.id}/finalize`, {
    method: 'POST',
    headers: { authorization: `Bearer ${created.editToken}` },
  });
  assert.equal(finalized.status, 200);
  assert.equal((await finalized.json()).finalized, true);

  const locked = await fetch(`${base}/shares/${created.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: defaultShareContent }),
  });
  assert.equal(locked.status, 423);

  const createdLockedResponse = await fetch(`${base}/shares`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${studioToken}`,
    },
    body: JSON.stringify({ content: defaultShareContent, finalized: true }),
  });
  assert.equal(createdLockedResponse.status, 201);
  const createdLocked = await createdLockedResponse.json();
  assert.equal(createdLocked.finalized, true);
  assert.equal(
    (
      await fetch(`${base}/shares/${createdLocked.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: defaultShareContent }),
      })
    ).status,
    423,
  );
  assert.deepEqual(
    await fetch(`${base}/stats`).then((response) => response.json()),
    {
      total: 2,
      finalized: 2,
      active: 0,
    },
  );
});
