// node --test tests/  — the card server: studio, host links, five-day editing, the guest list and guest link.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, FIVE_DAYS, FIRST_VISIT_GRACE } from '../server/api.js';
import { createLocalBucket } from '../server/local-bucket.js';
import { freshContent, cleanContent } from '../src/share/content-core.js';
import { defaultParty, defaultLook, cleanLook } from '../src/share/guests-core.js';

function setup() {
  let clock = Date.UTC(2026, 10, 2);
  const api = createApi({ now: () => clock, fetchImpl: async () => new Response('{}', { status: 404 }) });
  const env = { SHARES: createLocalBucket(), STUDIO_PASSWORD: 'secret-pw', CORS_ORIGIN: 'https://card.test', SHARE_CREATE_SECRET: 'store-key' };
  const call = async (path, { method = 'GET', body, token, headers = {} } = {}) => {
    const r = await api.fetch(new Request(`https://card.test${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
    return { status: r.status, data: await r.json() };
  };
  return { call, env, advance: (ms) => { clock += ms; } };
}
async function hostLink(call) {
  const id = 'H'.repeat(32);
  await call(`/api/invitations/${id}/ensure`, { method: 'POST', headers: { 'x-card-create-secret': 'store-key' } });
  return id;
}
const ROSTER = [
  { name: 'Grandma Rose', sex: 'f', age: 'adult' },
  { name: 'Uncle Joe', sex: 'm', age: 'adult' },
  { name: 'Lily', sex: 'f', age: 'child' },
];

test('studio: password, save the draft and its guests, then a host link from that exact revision', async () => {
  const { call } = setup();
  assert.equal((await call('/api/studio/login', { method: 'POST', body: { password: 'nope' } })).status, 401);
  const { data: { token } } = await call('/api/studio/login', { method: 'POST', body: { password: 'secret-pw' } });
  assert.equal((await call('/api/studio/draft')).status, 401, 'needs the token');
  const draft = (await call('/api/studio/draft', { token })).data;
  assert.equal(draft.revision, 0);
  assert.deepEqual(draft.guests, []);
  assert.equal((await call('/api/studio/links', { method: 'POST', body: { revision: 0 }, token })).status, 409, 'save first');
  const content = { ...draft.content, family: 'The Parkers' };
  assert.equal((await call('/api/studio/draft', { method: 'PUT', body: { content, revision: 0 }, token })).data.revision, 1);
  const saved = await call('/api/studio/guests', { method: 'PUT', body: { roster: ROSTER, party: defaultParty() }, token });
  assert.equal(saved.data.guests.length, 3);
  const link = await call('/api/studio/links', { method: 'POST', body: { revision: 1 }, token });
  assert.equal(link.status, 201);
  assert.equal(link.data.url, `https://card.test/?share=${link.data.id}`);
  const host = (await call(`/api/invitations/${link.data.id}`)).data;
  assert.equal(host.content.family, 'The Parkers');
  assert.deepEqual(host.guests.map((g) => g.name), ['Grandma Rose', 'Uncle Joe', 'Lily']);
  assert.equal(host.guestLink, null);
});

test('a host link: edit the wording for five days from the first visit, then permanently finish', async () => {
  const { call, advance } = setup();
  const id = await hostLink(call);
  advance(FIRST_VISIT_GRACE + 1000);
  const first = (await call(`/api/invitations/${id}`)).data;
  assert.equal(first.canEdit, true);
  const edited = { ...first.content, host: 'Ann & Bo' };
  assert.equal((await call(`/api/invitations/${id}`, { method: 'PUT', body: { content: edited, revision: 0 } })).data.revision, 1);
  assert.equal((await call(`/api/invitations/${id}`, { method: 'PUT', body: { content: edited, revision: 0 } })).status, 409, 'stale revision');
  assert.equal((await call(`/api/invitations/${id}/finish`, { method: 'POST', body: { content: edited, revision: 1 } })).data.finished, true);
  assert.equal((await call(`/api/invitations/${id}`, { method: 'PUT', body: { content: edited, revision: 2 } })).status, 423, 'locked for good');
  // …but the guest list is still the host's to manage
  assert.equal((await call(`/api/invitations/${id}/guests`, { method: 'PUT', body: { roster: ROSTER, party: defaultParty() } })).status, 200);
  advance(FIVE_DAYS + 1000);
  assert.equal((await call(`/api/invitations/${id}/guests`, { method: 'PUT', body: { roster: ROSTER, party: defaultParty() } })).status, 200);
});

test('the guest link: pick your name (kept to your phone), dress up, answer once, bring a dish', async () => {
  const { call } = setup();
  const id = await hostLink(call);
  const { guests } = (await call(`/api/invitations/${id}/guests`, { method: 'PUT', body: { roster: ROSTER, party: defaultParty() } })).data;
  const [rose, joe, lily] = guests;
  const made = (await call(`/api/invitations/${id}/guestlink`, { method: 'POST' })).data.guestLink;
  const gid = made.split('?guest=')[1];
  assert.match(gid, /^[A-Za-z0-9_-]{32}$/);
  assert.equal((await call(`/api/invitations/${id}/guestlink`, { method: 'POST' })).data.guestLink, made, 'one guest link per card');
  assert.equal((await call(`/api/guests/${'x'.repeat(32)}`)).status, 404);

  const open = (await call(`/api/guests/${gid}`)).data;
  assert.deepEqual(open.guests.map((g) => [g.name, g.claimed]), [['Grandma Rose', false], ['Uncle Joe', false], ['Lily', false]]);
  assert.equal(open.content.family, 'The Millers');

  // "This is me" — and nobody else can take that name now
  const claim = (await call(`/api/guests/${gid}/claim`, { method: 'POST', body: { id: joe.id } })).data;
  assert.match(claim.key, /^[A-Za-z0-9_-]{32}$/);
  assert.equal((await call(`/api/guests/${gid}/claim`, { method: 'POST', body: { id: joe.id } })).status, 409);
  // one phone may hold a few names (a parent and their child)
  const kid = (await call(`/api/guests/${gid}/claim`, { method: 'POST', body: { id: lily.id } })).data;

  const look = { ...defaultLook(joe), hat: 6, beard: 2 };
  const me = (body, who = joe.id, key = claim.key) => call(`/api/guests/${gid}/me`, { method: 'PUT', body: { id: who, key, ...body } });
  assert.equal((await me({ look })).data.guest.look.hat, 6);
  assert.equal((await me({ look }, joe.id, kid.key)).status, 403, 'someone else’s key');
  assert.equal((await me({ look: { ...look, hat: 99 } })).status, 400);
  assert.equal((await me({ thanks: 'My family and second helpings' })).data.guest.thanks, 'My family and second helpings');
  assert.equal((await me({ rsvp: 'yes' })).data.guest.rsvp, 'yes');
  assert.equal((await me({ rsvp: 'no' })).status, 409, 'the answer is given once');
  assert.equal((await me({ rsvp: 'yes' })).status, 200, 'saying the same again is fine');
  assert.equal((await me({ dish: 'pecan pie' })).data.guest.dish, 'Pecan pie');
  assert.equal((await me({ dish: 'Pecan pie' }, lily.id, kid.key)).status, 409, 'somebody already brings it');
  assert.equal((await me({ dish: 'Caviar' }, lily.id, kid.key)).status, 400, 'not on the list');

  // what the family sees; with the answers hidden, others' yes/no stays private
  const seen = (await call(`/api/guests/${gid}`, { headers: { 'X-Guest-Claims': `${lily.id}.${kid.key}` } })).data;
  assert.deepEqual(seen.mine, [lily.id]);
  const joeSeen = seen.guests.find((g) => g.id === joe.id);
  assert.equal(joeSeen.rsvp, 'yes');
  assert.equal(joeSeen.dish, 'Pecan pie');
  assert.equal(joeSeen.claimed, true);
  assert.equal(joeSeen.claim, undefined, 'the claim hash is never sent');
  await call(`/api/invitations/${id}/guests`, { method: 'PUT', body: { roster: guests.map(({ id: gi, name, sex, age }) => ({ id: gi, name, sex, age })), party: { ...defaultParty(), showAnswers: false } } });
  const hidden = (await call(`/api/guests/${gid}`)).data;
  assert.equal(hidden.guests.find((g) => g.id === joe.id).rsvp, null);
  const own = (await call(`/api/guests/${gid}`, { headers: { 'X-Guest-Claims': `${joe.id}.${claim.key}` } })).data;
  assert.equal(own.guests.find((g) => g.id === joe.id).rsvp, 'yes', 'you always see your own answer');

  // the host: sees everything, frees a name, clears an answer
  const host = (await call(`/api/invitations/${id}`)).data;
  assert.equal(host.guests.find((g) => g.id === joe.id).rsvp, 'yes');
  await call(`/api/invitations/${id}/guest/${joe.id}`, { method: 'PUT', body: { unlock: true, rsvp: null } });
  const after = (await call(`/api/invitations/${id}`)).data.guests.find((g) => g.id === joe.id);
  assert.equal(after.claimed, false);
  assert.equal(after.rsvp, null);
  assert.equal(after.look.hat, 6, 'the character is kept');
  assert.equal((await me({ thanks: 'x' })).status, 403, 'the old phone lost the name');
  assert.equal((await call(`/api/guests/${gid}/claim`, { method: 'POST', body: { id: joe.id } })).status, 200, 'and it can be picked again');

  // the host renames, removes and adds people; what guests set is kept
  const roster = [{ id: joe.id, name: 'Joseph', sex: 'm', age: 'adult' }, { id: rose.id, name: 'Grandma Rose', sex: 'f', age: 'adult' }, { name: 'Baby Max', sex: 'm', age: 'child' }];
  const next = (await call(`/api/invitations/${id}/guests`, { method: 'PUT', body: { roster, party: { ...defaultParty(), dishes: ['Apple pie'] } } })).data.guests;
  assert.deepEqual(next.map((g) => g.name), ['Joseph', 'Grandma Rose', 'Baby Max']);
  assert.equal(next[0].thanks, 'My family and second helpings');
  assert.equal(next[0].dish, null, 'pecan pie came off the list');
  assert.equal((await me({ thanks: 'y' }, lily.id, kid.key)).status, 404, 'Lily was taken off the list');
});

test('the guest list closes a week after the day', async () => {
  const { call, advance } = setup();
  const id = await hostLink(call);
  await call(`/api/invitations/${id}/guests`, { method: 'PUT', body: { roster: ROSTER, party: defaultParty() } });
  const gid = (await call(`/api/invitations/${id}/guestlink`, { method: 'POST' })).data.guestLink.split('?guest=')[1];
  advance(40 * 24 * 60 * 60 * 1000);   // Nov 2 → Dec 12 (the day was Nov 26)
  const g = (await call(`/api/guests/${gid}`)).data;
  assert.equal(g.open, false);
  assert.equal((await call(`/api/guests/${gid}/claim`, { method: 'POST', body: { id: g.guests[0].id } })).status, 423);
  assert.equal((await call(`/api/invitations/${id}/guests`, { method: 'PUT', body: { roster: ROSTER, party: defaultParty() } })).status, 423);
});

test('sent4u links: made on the server secret or when bought for this card; unknown links and other cards\' are not', async () => {
  const { call, env } = setup();
  const id = 'A'.repeat(32);
  assert.equal((await call(`/api/invitations/${id}`)).status, 404);
  assert.equal((await call(`/api/invitations/${id}/ensure`, { method: 'POST' })).status, 403);
  assert.equal((await call(`/api/invitations/${id}/ensure`, { method: 'POST', headers: { 'x-card-create-secret': 'store-key' } })).status, 201);
  assert.equal((await call(`/api/invitations/${id}`)).status, 200);
  assert.equal((await call('/api/invitations/short')).status, 404);
  // the sent4u orders server says which card a link was bought for (GET /links/<id> -> { ok, product })
  const orders = (product) => createApi({ fetchImpl: async (u) => { assert.match(String(u), /^https:\/\/orders\.test\/links\//); return Response.json({ ok: true, product }); } });
  const withOrders = { ...env, ORDERS_API_BASE: 'https://orders.test' };
  const open = (api, link) => api.fetch(new Request(`https://card.test/api/invitations/${link}`), withOrders);
  assert.equal((await open(orders('thanksgiving'), 'B'.repeat(24))).status, 200, 'bought for this card: made on first open');
  assert.equal((await open(orders('picnic'), 'C'.repeat(24))).status, 404, 'bought for another card: not this one');
  assert.equal((await createApi({ fetchImpl: async () => new Response('{}', { status: 404 }) }).fetch(new Request(`https://card.test/api/invitations/${'D'.repeat(24)}`), withOrders)).status, 404, 'unknown: not made');
});

test('content and characters: only their own shape is accepted', () => {
  assert.doesNotThrow(() => cleanContent(freshContent()));
  assert.throws(() => cleanContent({ ...freshContent(), evil: '<script>' }));
  assert.throws(() => cleanContent({ ...freshContent(), date: { ...freshContent().date, iso: 'tomorrow' } }));
  const t = cleanContent({ ...freshContent(), texts: { 'The Table': 'Our Table' } });
  assert.equal(t.texts['The Table'], 'Our Table');
  assert.doesNotThrow(() => cleanLook(defaultLook({ id: 'abcdefgh', name: 'Rose', sex: 'f', age: 'adult' })));
  assert.throws(() => cleanLook({ skin: 1, wings: 2 }));
  assert.throws(() => cleanLook({ skin: -1 }));
});

test('family photos: the host hangs them (and takes them down); everyone on the guest link sees them', async () => {
  const { env } = setup();
  const api = createApi({ now: () => Date.UTC(2026, 10, 2), fetchImpl: async () => new Response('{}', { status: 404 }) });
  const raw = (path, init = {}) => api.fetch(new Request(`https://card.test${path}`, init), env);
  await raw(`/api/invitations/${'H'.repeat(32)}/ensure`, { method: 'POST', headers: { 'x-card-create-secret': 'store-key' } });
  const host = `/api/invitations/${'H'.repeat(32)}`;
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
  assert.equal((await raw(`${host}/photo/2`, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: jpeg })).status, 415, 'pictures only');
  assert.equal((await raw(`${host}/photo/2`, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(900 * 1024 + 1) })).status, 413, 'not too big');
  const up = await raw(`${host}/photo/2`, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: jpeg });
  assert.equal(up.status, 200);
  const photos = (await up.json()).photos;
  assert.equal(photos.length, 6); assert.ok(photos[2]); assert.equal(photos[0], null);
  assert.deepEqual((await (await raw(host)).json()).photos, photos, 'the host sees the list');
  const back = await raw(`${host}/photo/2`);
  assert.equal(back.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(new Uint8Array(await back.arrayBuffer()), jpeg);
  // the family, through the guest link
  const gl = (await (await raw(`${host}/guestlink`, { method: 'POST' })).json()).guestLink.split('guest=')[1];
  assert.deepEqual((await (await raw(`/api/guests/${gl}`)).json()).photos, photos);
  assert.deepEqual(new Uint8Array(await (await raw(`/api/guests/${gl}/photo/2`)).arrayBuffer()), jpeg);
  assert.equal((await raw(`/api/guests/${gl}/photo/2`, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: jpeg })).status, 405, 'guests can’t hang photos');
  // taken down
  assert.equal((await (await raw(`${host}/photo/2`, { method: 'DELETE' })).json()).photos[2], null);
  assert.equal((await raw(`/api/guests/${gl}/photo/2`)).status, 404);
});
