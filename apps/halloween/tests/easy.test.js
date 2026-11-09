// The step editor's pieces that run without a browser: the song check on the server, and what it saves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../server/api.js';
import { forEditing, forSaving, forShowing, steps, SONG_KEY } from '../site/easy/easy-steps.js';
import { WORDS } from '../site/easy/words.js';
import { defaultPlan, cleanContent } from '../site/plan-core.js';

test('yt-check: whether a YouTube song can play inside the card', async () => {
  const answer = (status, body = {}) => async (u) => { assert.match(String(u), /^https:\/\/www\.youtube\.com\/oembed\?format=json&url=/); return Response.json(body, { status }); };
  const check = async (fetchImpl) => (await (await createApi({ fetchImpl }).fetch(new Request('https://card.test/api/yt-check/dQw4w9WgXcQ'), {})).json());
  assert.deepEqual(await check(answer(200, { title: 'A song' })), { ok: true, title: 'A song' });
  assert.deepEqual(await check(answer(401)), { ok: false, reason: 'blocked' });
  assert.deepEqual(await check(answer(404)), { ok: false, reason: 'missing' });
  assert.deepEqual(await check(answer(500)), { ok: true }, 'cannot tell: not stopped');
  assert.equal((await createApi({ fetchImpl: answer(200) }).fetch(new Request('https://card.test/api/yt-check/dQw4w9WgXcQ', { method: 'POST' }), {})).status, 405);
});

test('the editor shows every word, and saves only what was changed', () => {
  const content = forEditing({ plan: { ...defaultPlan }, texts: { 'invitation:2': 'Pumpkin picking' } });
  assert.equal(content.texts['quest:1'], WORDS['quest:1'], 'a box shows the card’s own words');
  assert.equal(content.texts['invitation:2'], 'Pumpkin picking', 'and the link’s own words over them');
  content.texts['quest:1'] = 'A sweet';            // changed
  content.texts['quest:2'] = '   ';                // emptied: back to the card's own
  content.texts[SONG_KEY] = 'https://youtu.be/dQw4w9WgXcQ';
  content.plan.location = '';                      // emptied: back to the default
  const saved = forSaving(content, { plan: defaultPlan });
  assert.deepEqual(saved.texts, { 'invitation:2': 'Pumpkin picking', 'quest:1': 'A sweet', [SONG_KEY]: 'https://youtu.be/dQw4w9WgXcQ' });
  assert.equal(saved.plan.location, defaultPlan.location);
  assert.doesNotThrow(() => cleanContent(saved), 'what is saved passes the server’s check');
  assert.equal(forShowing({ plan: defaultPlan, texts: { 'quest:2': '' } }).texts['quest:2'], WORDS['quest:2'], 'an emptied box shows the card’s own words');
});

test('the date and time boxes write what the card shows', () => {
  const plan = steps.find((s) => s.id === 'plan').cards[0].fields;
  const c = { plan: { ...defaultPlan }, texts: {} };
  const date = plan.find((f) => f.type === 'date'), start = plan.find((f) => f.label === 'Starts at');
  assert.equal(date.get(c), '2026-10-31');
  date.set(c, '2026-11-02');
  assert.equal(c.plan.date, 'November 2, 2026');
  assert.equal(start.get(c), '20:00');
  start.set(c, '19:30');
  assert.equal(c.plan.startTime, '7:30 PM');
  assert.ok(Object.keys(WORDS).every((k) => /^[a-zA-Z]+:\d+$/.test(k)), 'every word key is one the server accepts');
});
