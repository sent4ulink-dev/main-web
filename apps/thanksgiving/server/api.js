import { freshContent, cleanContent } from '../src/share/content-core.js';
import { cleanRoster, cleanParty, cleanLook, cleanThanks, defaultParty, GUEST_ID } from '../src/share/guests-core.js';
import { rateLimit, sha256, hex } from '../edge/cardkit.js';

// The card's server (same design as the other sent4u cards, plus a guest list): the private studio
// (a password, one draft, host links made from it) and the host links, each its own saved card whose holder
// may edit its words for five days. A host link also holds the guest list and can make one guest link that
// the whole family shares. Everything is JSON in one bucket (env.SHARES: R2 on Cloudflare, a file locally):
//   shares/<id>.json        a host link {content, createdAt, editingDeadline, finalized, revision, guests, party, guestLink}
//   studio/draft.json       the studio's draft {content, revision, guests, party}
//   guestlinks/<gid>.json   {id}: the guest link that opens host link <id>
//   attempts/<key>.json     wrong studio passwords;  limits/<key>.json  claim rate limits
//   media/<id>/photo<n>     the host's family photos for the wall (n = 0…5; the record's `photos` holds their versions)
// A guest: {id, name, sex, age, look, rsvp, thanks, dish, claim, at}. `claim` is the hash of the key kept on the
// phone that said "This is me"; only that phone (or the host) may change that guest, and an answer (yes/no)
// can be given once (the host can clear it).
// sent4u sells the host links: the orders server mints an id when someone pays, and the card is made the first time
// that id is opened (or earlier, by POST …/<id>/ensure); the card asks the orders server whether the id was really
// bought for this card (askStore below). A refunded link is revoked by the orders server itself.
export const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
export const FIRST_VISIT_GRACE = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const PRODUCT = 'thanksgiving';   // what the orders server calls this card
const ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const DRAFT_KEY = 'studio/draft.json';
const shareKey = (id) => `shares/${id}.json`;
const guestLinkKey = (gid) => `guestlinks/${gid}.json`;
const encoder = new TextEncoder();
const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extra } });
const base64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function createShareID() { return base64(crypto.getRandomValues(new Uint8Array(24))); }
const newGuestID = () => base64(crypto.getRandomValues(new Uint8Array(6)));
async function hash(value) { return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
function equal(a, b) { let r = a.length ^ b.length; for (let i = 0; i < a.length; i++) r |= a[i] ^ (b[i] || 0); return r === 0; }
async function signature(value, password) { const key = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))); }
async function token(password, now) { const payload = base64(encoder.encode(JSON.stringify({ role: 'studio', nonce: createShareID(), expires: now + 12 * 60 * 60 * 1000 }))); return `${payload}.${base64(await signature(payload, password))}`; }
async function authorized(request, env, now) {
  if (!env.STUDIO_PASSWORD) return false;
  const value = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1];
  if (!value || value.length > 700) return false;
  try {
    const [payload, sig] = value.split('.');
    if (!equal(encoder.encode(sig), encoder.encode(base64(await signature(payload, env.STUDIO_PASSWORD))))) return false;
    const d = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
    return d.role === 'studio' && ID_PATTERN.test(d.nonce) && Number.isFinite(d.expires) && d.expires > now;
  } catch { return false; }
}
async function bodyOf(request, allowed) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw Object.assign(new Error('Expected JSON content.'), { status: 415 });
  const raw = await request.text();
  if (raw.length > 120000) throw Object.assign(new Error('Content is too large.'), { status: 413 });
  let body; try { body = JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((k) => !allowed.includes(k))) throw Object.assign(new Error('Invalid request fields.'), { status: 400 });
  return body;
}
function checkedContent(body) {
  if (!Number.isInteger(body.revision) || body.revision < 0) throw Object.assign(new Error('Invalid revision.'), { status: 400 });
  return cleanContent(body.content);
}
async function read(bucket, key) { const o = await bucket.get(key); return o ? o.json() : null; }
const write = (bucket, key, value) => bucket.put(key, JSON.stringify(value), { httpMetadata: { contentType: 'application/json' } });
const canEdit = (r, now) => !r.finalized && (r.editingDeadline == null || now < r.editingDeadline);
const shownDeadline = (r, now) => r.editingDeadline ?? now + FIVE_DAYS;
// the guest list stays open until a week after the day (at least a month after the link was made, at most 400 days)
function guestsUntil(r) {
  const day = Date.parse(`${r.content?.date?.iso}T23:59:59Z`);
  const from = r.createdAt || 0;
  return Math.min(Math.max(Number.isFinite(day) ? day + 7 * DAY : 0, from + 30 * DAY), from + 400 * DAY);
}
const guestsOpen = (r, now) => r.createdAt == null || now < guestsUntil(r);
const closed = (r, now) => json({ error: r.finalized ? 'This card’s wording was finished permanently.' : 'The five days for editing the wording are over.', finished: !!r.finalized, editingDeadline: shownDeadline(r, now), canEdit: false }, 423);
const guestsClosed = () => json({ error: 'The guest list is closed now — the day has passed.' }, 423);
const newLink = (content, now, { guests = [], party = defaultParty() } = {}) => ({ content, createdAt: now, editingDeadline: null, finalized: false, revision: 0, guests, party, guestLink: null, photos: [] });
export const PHOTO_SLOTS = 6, PHOTO_MAX = 900 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/webp', 'image/png'];
const photoKey = (id, n) => `media/${id}/photo${n}`;
const photoList = (r) => Array.from({ length: PHOTO_SLOTS }, (_, n) => r.photos?.[n] || null);
async function servePhoto(bucket, id, n) {
  const o = await bucket.get(photoKey(id, n));
  if (!o) return json({ error: 'No photo here.' }, 404);
  const bytes = o.arrayBuffer ? await o.arrayBuffer() : o.body;
  return new Response(bytes, { headers: { 'Content-Type': o.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' } });
}

// ── the guest list ──────────────────────────────────────────────────────────
const hostView = (g) => ({ id: g.id, name: g.name, sex: g.sex, age: g.age, look: g.look, rsvp: g.rsvp, thanks: g.thanks, dish: g.dish, claimed: !!g.claim, at: g.at });
function publicView(g, party, mine) {
  return { id: g.id, name: g.name, sex: g.sex, age: g.age, look: g.look, claimed: !!g.claim, thanks: g.thanks, dish: party.potluck ? g.dish : null, rsvp: party.showAnswers || mine ? g.rsvp : null };
}
/** The host's list: names, man/woman, adult/child, in table order; everything a guest set themselves is kept. */
function applyRoster(record, roster, party, now) {
  const old = new Map((record.guests || []).map((g) => [g.id, g]));
  const used = new Set(old.keys());
  const guests = roster.map((r) => {
    const g = r.id && old.get(r.id);
    if (g) return { ...g, name: r.name, sex: r.sex, age: r.age };
    let id; do { id = newGuestID(); } while (used.has(id));
    used.add(id);
    return { id, name: r.name, sex: r.sex, age: r.age, look: null, rsvp: null, thanks: '', dish: null, claim: null, at: now };
  });
  // a dish the host took off the list frees whoever had picked it
  const dishes = new Set(party.dishes.map((d) => d.toLowerCase()));
  for (const g of guests) if (g.dish && !dishes.has(g.dish.toLowerCase())) g.dish = null;
  return { ...record, guests, party };
}
/** One guest's changes. asHost: the host may also clear an answer and free the name from its phone. */
function editGuest(record, gid, body, { asHost, now }) {
  const i = (record.guests || []).findIndex((g) => g.id === gid);
  if (i < 0) throw Object.assign(new Error('That guest is no longer on the list.'), { status: 404 });
  const g = { ...record.guests[i] }, party = record.party || defaultParty();
  if ('look' in body) g.look = cleanLook(body.look);
  if ('thanks' in body) g.thanks = cleanThanks(body.thanks);
  if ('dish' in body) {
    if (body.dish === null) g.dish = null;
    else {
      if (!party.potluck) throw Object.assign(new Error('There is no potluck this year.'), { status: 409 });
      const want = typeof body.dish === 'string' ? party.dishes.find((d) => d.toLowerCase() === body.dish.trim().toLowerCase()) : null;
      if (!want) throw Object.assign(new Error('That dish is not on the list.'), { status: 400 });
      const taken = record.guests.find((o) => o.id !== gid && o.dish && o.dish.toLowerCase() === want.toLowerCase());
      if (taken) throw Object.assign(new Error(`${taken.name} is already bringing that.`), { status: 409, data: { takenBy: taken.id } });
      g.dish = want;
    }
  }
  if ('rsvp' in body) {
    const v = body.rsvp;
    if (asHost) { if (![null, 'yes', 'no'].includes(v)) throw Object.assign(new Error('Invalid answer.'), { status: 400 }); g.rsvp = v; }
    else {
      if (!['yes', 'no'].includes(v)) throw Object.assign(new Error('Invalid answer.'), { status: 400 });
      if (g.rsvp && g.rsvp !== v) throw Object.assign(new Error('Your answer is already in — ask the host if it needs to change.'), { status: 409 });
      g.rsvp = v;
    }
  }
  if (body.unlock === true) { if (!asHost) throw Object.assign(new Error('Not allowed.'), { status: 403 }); g.claim = null; }
  g.at = now;
  const guests = record.guests.slice(); guests[i] = g;
  return { record: { ...record, guests }, guest: g };
}
/** The phones' claims sent along with a guest's request: "id.key,id.key". Answers the ids they really hold. */
async function verifiedClaims(record, header) {
  const out = new Set();
  if (!header || header.length > 3000) return out;
  for (const part of header.split(',').slice(0, 50)) {
    const [id, key] = part.trim().split('.');
    if (!GUEST_ID.test(id || '') || !/^[A-Za-z0-9_-]{32}$/.test(key || '')) continue;
    const g = record.guests?.find((x) => x.id === id);
    if (g?.claim && g.claim === hex(await sha256(key))) out.add(id);
  }
  return out;
}

export function createApi({ now = () => Date.now(), randomID = createShareID, fetchImpl = (...a) => fetch(...a) } = {}) {
  // one thing at a time per record (a save and a "finish" arriving together, two guests at once)
  const turns = new Map();
  function inTurn(key, work) { const run = (turns.get(key) ?? Promise.resolve()).then(work, work); const settled = run.then(() => {}, () => {}); turns.set(key, settled); settled.then(() => { if (turns.get(key) === settled) turns.delete(key); }); return run; }
  // Was this id really bought for this card? The sent4u orders server knows: GET /links/<id> -> { ok, product }.
  async function askStore(id, env) {
    const base = String(env.ORDERS_API_BASE || '').replace(/[/]+$/, '');
    if (!base) return {};
    const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
    try {
      const r = await fetchImpl(`${base}/links/${encodeURIComponent(id)}`, { signal: c.signal });
      if (!r.ok) return {};
      const body = (await r.json()) || {};
      return { valid: body.ok === true && body.product === PRODUCT };
    } catch (e) { console.warn(`Checking ${id} with the orders server failed:`, e.message); return {}; } finally { clearTimeout(t); }
  }
  return { async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname, time = now(), bucket = env.SHARES;
    const origins = (env.CORS_ORIGIN || '*').split(',').map((v) => v.trim()).filter(Boolean), origin = request.headers.get('Origin');
    const site = () => (env.PUBLIC_ORIGIN || origin || (origins.includes('*') ? url.origin : origins[0])).replace(/\/$/, '');
    const hostState = (r, at) => ({
      content: r.content, revision: r.revision, createdAt: r.createdAt, editingDeadline: shownDeadline(r, at), finished: !!r.finalized, canEdit: canEdit(r, at),
      guests: (r.guests || []).map(hostView), party: r.party || defaultParty(), guestsOpen: guestsOpen(r, at),
      guestLink: r.guestLink ? `${site()}/?guest=${r.guestLink}` : null, photos: photoList(r),
    });
    try {
      if (!bucket) throw new Error('Card storage unavailable');
      const studio = path.startsWith('/api/studio/');
      const linkMatch = /^\/api\/invitations\/([^/]+)(\/finish|\/ensure|\/guests|\/guestlink|\/guest\/[^/]+|\/photo\/[0-5])?$/.exec(path);
      const guestMatch = /^\/api\/guests\/([^/]+)(\/claim|\/me|\/photo\/[0-5])?$/.exec(path);
      if (!studio && !linkMatch && !guestMatch) return json({ error: 'Not found.' }, 404);
      if (request.method !== 'GET' && origin && !origins.includes('*') && !origins.includes(origin)) return json({ error: 'This request must come from this website.' }, 403);

      // ── the studio ──
      if (path === '/api/studio/login') {
        if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
        if (!env.STUDIO_PASSWORD) return json({ error: 'The studio password is not set.' }, 503);
        const body = await bodyOf(request, ['password']);
        if (typeof body.password !== 'string' || body.password.length > 512) return json({ error: 'Enter your password.' }, 400);
        const address = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0].trim() || 'unavailable-ip';
        const key = `attempts/${base64(await hash(address))}.json`;
        return inTurn(key, async () => {
          const attempts = await read(bucket, key), current = attempts && attempts.windowStart + 15 * 60 * 1000 > time ? attempts : null;
          if (current && current.attempts >= 10) return json({ error: 'Too many wrong passwords. Try again in 15 minutes.' }, 429, { 'Retry-After': '900' });
          if (!equal(await hash(body.password), await hash(env.STUDIO_PASSWORD))) { await write(bucket, key, current ? { ...current, attempts: current.attempts + 1 } : { windowStart: time, attempts: 1 }); return json({ error: 'Wrong password.' }, 401); }
          if (attempts) await bucket.delete(key);
          return json({ token: await token(env.STUDIO_PASSWORD, time) });
        });
      }
      if (studio) {
        if (!await authorized(request, env, time)) return json({ error: 'Please enter your password again to continue.' }, 401);
        const draft = async () => { const d = await read(bucket, DRAFT_KEY); return d ? { guests: [], party: defaultParty(), ...d } : { content: freshContent(), revision: 0, guests: [], party: defaultParty() }; };
        if (path === '/api/studio/draft') {
          if (request.method === 'GET') { const d = await draft(); return json({ content: d.content, revision: d.revision, finished: false, canEdit: true, guests: d.guests.map(hostView), party: d.party, guestsOpen: true, guestLink: null }); }
          if (request.method !== 'PUT') return json({ error: 'Method not allowed.' }, 405);
          const body = await bodyOf(request, ['content', 'revision']), content = checkedContent(body);
          return inTurn(DRAFT_KEY, async () => {
            const d = await draft();
            if ((d.revision || 0) !== body.revision) return json({ error: 'It was changed in another window. Reload before saving.' }, 409);
            await write(bucket, DRAFT_KEY, { ...d, content, revision: body.revision + 1 });
            return json({ revision: body.revision + 1, finished: false, canEdit: true });
          });
        }
        if (path === '/api/studio/guests' && request.method === 'PUT') {
          const body = await bodyOf(request, ['roster', 'party']), roster = cleanRoster(body.roster), party = cleanParty(body.party);
          return inTurn(DRAFT_KEY, async () => { const d = applyRoster(await draft(), roster, party, time); await write(bucket, DRAFT_KEY, d); return json({ guests: d.guests.map(hostView), party: d.party }); });
        }
        const sg = /^\/api\/studio\/guest\/([^/]+)$/.exec(path);
        if (sg && request.method === 'PUT') {
          const body = await bodyOf(request, ['look', 'thanks', 'dish', 'rsvp', 'unlock']);
          return inTurn(DRAFT_KEY, async () => { const { record, guest } = editGuest(await draft(), sg[1], body, { asHost: true, now: time }); await write(bucket, DRAFT_KEY, record); return json({ guest: hostView(guest) }); });
        }
        if (path === '/api/studio/links' && request.method === 'POST') {
          const body = await bodyOf(request, ['revision']), d = await draft();
          if (!await bucket.head(DRAFT_KEY) || !Number.isInteger(body.revision) || body.revision !== d.revision) return json({ error: 'Save successfully before making a link.' }, 409);
          for (let retry = 0; retry < 8; retry++) {
            const id = randomID(); if (!ID_PATTERN.test(id)) throw new Error('Invalid generated ID');
            const made = await inTurn(id, async () => {
              if (await bucket.head(shareKey(id))) return false;
              // the new link gets the draft's guest list as it is (nobody has claimed a name there yet)
              await write(bucket, shareKey(id), newLink(d.content, time, { guests: d.guests.map((g) => ({ ...g, claim: null })), party: d.party })); return true;
            });
            if (made) return json({ id, url: `${site()}/?share=${id}`, createdAt: time, editingDeadline: time + FIVE_DAYS }, 201);
          }
          throw new Error('ID collision retry limit');
        }
        return json({ error: 'Not found.' }, 404);
      }

      // ── the guest link: everyone in the family ──
      if (guestMatch) {
        const [, gid, action] = guestMatch;
        if (!ID_PATTERN.test(gid)) return json({ error: 'This link was not found.' }, 404);
        const link = await read(bucket, guestLinkKey(gid));
        if (!link || !ID_PATTERN.test(link.id || '')) return json({ error: 'This link was not found.' }, 404);
        const id = link.id;
        if (action?.startsWith('/photo/') && request.method === 'GET') return servePhoto(bucket, id, +action.slice(7));
        if (action === '/claim' && request.method === 'POST') {
          const limited = await rateLimit({ bucket, request, name: 'claim', secret: env.STUDIO_PASSWORD || id, limit: 60, windowMs: 60 * 60 * 1000, now: time });
          if (!limited.ok) return json({ error: 'Too many tries from here. Please wait a little.' }, 429, { 'Retry-After': String(Math.ceil(limited.retryAfterMs / 1000)) });
        }
        return await inTurn(id, async () => {
          const at = now();
          const record = await read(bucket, shareKey(id));
          if (!record || record.guestLink !== gid) return json({ error: 'This link was not found.' }, 404);
          const party = record.party || defaultParty();
          if (request.method === 'GET' && !action) {
            const mine = await verifiedClaims(record, request.headers.get('X-Guest-Claims'));
            return json({ content: record.content, party, open: guestsOpen(record, at), mine: [...mine], guests: (record.guests || []).map((g) => publicView(g, party, mine.has(g.id))), photos: photoList(record) });
          }
          if (!guestsOpen(record, at)) return guestsClosed();
          if (action === '/claim') {
            if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
            const body = await bodyOf(request, ['id']);
            const i = (record.guests || []).findIndex((g) => g.id === body.id);
            if (i < 0) return json({ error: 'That name is no longer on the list.' }, 404);
            if (record.guests[i].claim) return json({ error: `${record.guests[i].name} already joined from another phone. Ask the host if that wasn’t you.` }, 409);
            const key = createShareID().slice(0, 32);
            const guests = record.guests.slice(); guests[i] = { ...guests[i], claim: hex(await sha256(key)), at };
            await write(bucket, shareKey(id), { ...record, guests });
            return json({ id: body.id, key, guest: publicView(guests[i], party, true) });
          }
          if (action === '/me') {
            if (request.method !== 'PUT') return json({ error: 'Method not allowed.' }, 405);
            const body = await bodyOf(request, ['id', 'key', 'look', 'thanks', 'dish', 'rsvp']);
            const { id: who, key, ...changes } = body;
            if (!(record.guests || []).some((g) => g.id === who)) return json({ error: 'That name is no longer on the list.' }, 404);
            const mine = await verifiedClaims(record, `${who}.${key}`);
            if (!mine.has(who)) return json({ error: 'This phone can’t change that guest. Ask the host to free the name.' }, 403);
            const { record: next, guest } = editGuest(record, who, changes, { asHost: false, now: at });
            await write(bucket, shareKey(id), next);
            return json({ guest: publicView(guest, party, true) });
          }
          return json({ error: 'Method not allowed.' }, 405);
        });
      }

      // ── a host link ──
      const [, id, action = ''] = linkMatch;
      if (!ID_PATTERN.test(id)) return json({ error: 'This link was not found.' }, 404);
      return await inTurn(id, async () => {
        const at = now();
        if (action === '/ensure') {
          if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
          if (await bucket.head(shareKey(id))) return json({ ok: true, existed: true });
          const secret = request.headers.get('x-card-create-secret') || request.headers.get('x-birthday-create-secret') || '';
          const trusted = !!env.SHARE_CREATE_SECRET && equal(await hash(secret), await hash(env.SHARE_CREATE_SECRET));
          if (!trusted && (await askStore(id, env)).valid !== true) return json({ error: 'Forbidden.' }, 403);
          await write(bucket, shareKey(id), newLink(freshContent(), at));
          return json({ ok: true, existed: false }, 201);
        }
        let record = await read(bucket, shareKey(id));
        if (!record && request.method === 'GET' && !action && (await askStore(id, env)).valid === true) { record = newLink(freshContent(), at); await write(bucket, shareKey(id), record); }
        if (!record) return json({ error: 'This link was not found.' }, 404);
        record = { guests: [], party: defaultParty(), guestLink: null, ...record };
        if (request.method === 'GET' && !action) {
          if (record.editingDeadline == null && !record.finalized && at - record.createdAt > FIRST_VISIT_GRACE) { record = { ...record, editingDeadline: at + FIVE_DAYS }; await write(bucket, shareKey(id), record); }
          return json(hostState(record, at));
        }
        if (action.startsWith('/photo/')) {
          // the family photos on the wall: the host puts one up (or takes it down) any time until the day has passed
          const n = +action.slice(7);
          if (request.method === 'GET') return servePhoto(bucket, id, n);
          if (!guestsOpen(record, at)) return guestsClosed();
          const photos = photoList(record);
          if (request.method === 'DELETE') {
            await bucket.delete(photoKey(id, n));
            photos[n] = null; record = { ...record, photos }; await write(bucket, shareKey(id), record);
            return json({ photos });
          }
          if (request.method !== 'PUT') return json({ error: 'Method not allowed.' }, 405);
          const type = (request.headers.get('content-type') || '').split(';')[0].trim();
          if (!PHOTO_TYPES.includes(type)) return json({ error: 'Choose a JPEG, PNG or WebP picture.' }, 415);
          const bytes = await request.arrayBuffer();
          if (!bytes.byteLength) return json({ error: 'That picture is empty.' }, 400);
          if (bytes.byteLength > PHOTO_MAX) return json({ error: 'That picture is too big.' }, 413);
          await bucket.put(photoKey(id, n), bytes, { httpMetadata: { contentType: type } });
          photos[n] = at; record = { ...record, photos }; await write(bucket, shareKey(id), record);
          return json({ photos });
        }
        if (action === '/guests' || action === '/guestlink' || action.startsWith('/guest/')) {
          if (!guestsOpen(record, at)) return guestsClosed();
          if (action === '/guests') {
            if (request.method !== 'PUT') return json({ error: 'Method not allowed.' }, 405);
            const body = await bodyOf(request, ['roster', 'party']);
            record = applyRoster(record, cleanRoster(body.roster), cleanParty(body.party), at);
            await write(bucket, shareKey(id), record);
            return json({ guests: record.guests.map(hostView), party: record.party });
          }
          if (action === '/guestlink') {
            if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
            if (!record.guestLink) {
              let gid;
              for (let retry = 0; ; retry++) {
                if (retry > 8) throw new Error('ID collision retry limit');
                gid = randomID();
                if (ID_PATTERN.test(gid) && gid !== id && !await bucket.head(guestLinkKey(gid))) break;
              }
              await write(bucket, guestLinkKey(gid), { id });
              record = { ...record, guestLink: gid };
              await write(bucket, shareKey(id), record);
            }
            return json({ guestLink: `${site()}/?guest=${record.guestLink}` });
          }
          if (request.method !== 'PUT') return json({ error: 'Method not allowed.' }, 405);
          const body = await bodyOf(request, ['look', 'thanks', 'dish', 'rsvp', 'unlock']);
          const { record: next, guest } = editGuest(record, action.slice(7), body, { asHost: true, now: at });
          await write(bucket, shareKey(id), next);
          return json({ guest: hostView(guest) });
        }
        const finish = action === '/finish';
        if (!(request.method === 'PUT' && !action) && !(request.method === 'POST' && finish)) return json({ error: 'Method not allowed.' }, 405);
        if (!canEdit(record, at)) return closed(record, at);
        const body = await bodyOf(request, ['content', 'revision']), content = checkedContent(body);
        if (body.revision !== record.revision) return json({ error: 'It was changed in another window. Reload before saving.' }, 409);
        record = { ...record, content, revision: record.revision + 1, finalized: finish };
        await write(bucket, shareKey(id), record);
        return json({ revision: record.revision, finished: finish, editingDeadline: shownDeadline(record, at), canEdit: canEdit(record, at) });
      });
    } catch (error) {
      if (error.conflict) throw error;   // a guarded write lost a race: runGuarded runs the request again
      if (error.status) return json({ error: error.message, ...(error.data || {}) }, error.status);
      console.error('Card request failed:', path, error.message);
      return json({ error: 'Connection problem. Please try again.' }, 503);
    }
  } };
}
export default createApi();
