/* oxlint-disable typescript/no-floating-promises */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultShareContent } from '../lib/share-content.ts';

test('share API only lets the fulfillment secret mint a share, then anyone with the link can edit and permanently finalize it', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'little-signal-api-'));
  const port = 18942;
  const secret = 'test-fulfillment-secret';
  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DATA_FILE: join(directory, 'shares.json'),
      SHARE_CREATE_SECRET: secret,
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
  const id = 'realOrderId1234567890';

  const missingBeforeCreate = await fetch(`${base}/shares/${id}`);
  assert.equal(missingBeforeCreate.status, 404);

  const deniedEnsure = await fetch(`${base}/shares/${id}/ensure`, {
    method: 'POST',
  });
  assert.equal(deniedEnsure.status, 403);

  const ensured = await fetch(`${base}/shares/${id}/ensure`, {
    method: 'POST',
    headers: { 'x-date-create-secret': secret },
  });
  assert.equal(ensured.status, 201);
  assert.deepEqual(await ensured.json(), { ok: true, existed: false });

  const ensuredAgain = await fetch(`${base}/shares/${id}/ensure`, {
    method: 'POST',
    headers: { 'x-date-create-secret': secret },
  });
  assert.equal(ensuredAgain.status, 200);
  assert.deepEqual(await ensuredAgain.json(), { ok: true, existed: true });

  const fetched = await fetch(`${base}/shares/${id}`).then((response) =>
    response.json(),
  );
  assert.equal(fetched.content.sender, defaultShareContent.sender);
  assert.equal(fetched.finalized, false);
  assert.ok(new Date(fetched.editUntil).getTime() > Date.now());

  const changed = { ...defaultShareContent, sender: 'Test sender' };
  const updated = await fetch(`${base}/shares/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: changed }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).content.sender, changed.sender);

  const finalized = await fetch(`${base}/shares/${id}/finalize`, {
    method: 'POST',
  });
  assert.equal(finalized.status, 200);
  assert.equal((await finalized.json()).finalized, true);

  const lockedUpdate = await fetch(`${base}/shares/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: defaultShareContent }),
  });
  assert.equal(lockedUpdate.status, 423);

  const lockedFinalize = await fetch(`${base}/shares/${id}/finalize`, {
    method: 'POST',
  });
  assert.equal(lockedFinalize.status, 423);

  const missing = await fetch(`${base}/shares/unmintedRealLookingId12`);
  assert.equal(missing.status, 404);

  const health = await fetch(`${base}/health`).then((response) =>
    response.json(),
  );
  assert.deepEqual(health, { ok: true });
});
