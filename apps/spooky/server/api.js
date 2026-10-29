import { freshContent, cleanContent, mediaOf } from '../src/share/content-core.js';
import { deletePrefix } from '../edge/cardkit.js';

// The card's server (same design as the other sent4u cards): the private studio (a password, one
// draft, links made from it) and the links themselves, each its own saved card that its holder may edit
// for five days. Everything is JSON in one bucket (env.SHARES: R2 on Cloudflare, a file on this computer):
//   shares/<id>.json    {content, createdAt, editingDeadline, finalized, revision}
//   studio/draft.json   {content, revision}
//   attempts/<key>.json {windowStart, attempts}   (wrong studio passwords)
//   media/<scope>/<name> uploaded photos (WebP/JPEG) and the one voice message, scope = 'studio' or a link id.
//     The content names them 'media/<name>'; anything a saved content no longer names is deleted at once,
//     a new link gets copies of the studio's files, and a link taken back loses all of its own.
// sent4u sells the links: the orders server mints an id when someone pays, and the card is made the first time
// that id is opened (or earlier, by POST …/<id>/ensure); the card asks the orders server whether the id was
// really bought for this card (askStore below).
export const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
// The five days start at a link's first visit (the studio's own check right after making it doesn't count).
export const FIRST_VISIT_GRACE = 60 * 1000;
const PRODUCT = 'spooky';   // what the orders server calls this card
const ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const DRAFT_KEY = 'studio/draft.json';
const shareKey = (id) => `shares/${id}.json`;
// what may be uploaded: type → [extension, largest size]. Photos are shrunk to WebP in the browser first.
const UPLOADS = { 'image/webp': ['webp', 700e3], 'image/jpeg': ['jpg', 700e3], 'audio/webm': ['webm', 800e3], 'audio/ogg': ['ogg', 800e3], 'audio/mp4': ['m4a', 800e3] };
const TYPES = { webp: 'image/webp', jpg: 'image/jpeg', webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4', mp4: 'audio/mp4' };
const MEDIA_FILE = /^[A-Za-z0-9_-]{16,40}\.(webp|jpg|webm|ogg|m4a|mp4)$/;
const MOST_FILES = 10;   // 5 photos, a cover, a voice — and a little room for one being replaced
const encoder = new TextEncoder();
const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extra } });
const base64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function createShareID() { return base64(crypto.getRandomValues(new Uint8Array(24))); }
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
  if (raw.length > 180000) throw Object.assign(new Error('Content is too large.'), { status: 413 });
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
const linkState = (r, now) => ({ content: r.content, revision: r.revision, createdAt: r.createdAt, editingDeadline: shownDeadline(r, now), finished: !!r.finalized, canEdit: canEdit(r, now) });
const closed = (r, now) => json({ error: r.finalized ? 'Editing has been closed for good.' : 'The five-day editing window has ended.', finished: !!r.finalized, editingDeadline: shownDeadline(r, now), canEdit: false }, 423);
const newLink = (content, now) => ({ content, createdAt: now, editingDeadline: null, finalized: false, revision: 0 });
async function listKeys(bucket, prefix) {
  const keys = []; let cursor;
  do { const page = await bucket.list({ prefix, cursor }); keys.push(...page.objects.map((o) => o.key)); cursor = page.truncated ? page.cursor : undefined; } while (cursor);
  return keys;
}
async function upload(request, bucket, scope) {
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase(), kind = UPLOADS[type];
  if (!kind) return json({ error: 'Only photos or audio can be saved.' }, 415);
  if (Number(request.headers.get('content-length') || 0) > kind[1]) return json({ error: 'The file is too large.' }, 413);
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > kind[1]) return json({ error: 'The file is too large.' }, 413);
  if ((await listKeys(bucket, `media/${scope}/`)).length >= MOST_FILES) return json({ error: 'Save first, then try again.' }, 429);
  const file = `${createShareID().slice(0, 22)}.${kind[0]}`;
  await bucket.put(`media/${scope}/${file}`, bytes, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  return json({ name: `media/${file}` }, 201);
}
// delete every file of this scope the content doesn't name any more
async function prune(bucket, scope, content) {
  const keep = new Set(mediaOf(content).map((m) => `media/${scope}/${m.slice(6)}`));
  for (const key of await listKeys(bucket, `media/${scope}/`)) if (!keep.has(key)) await bucket.delete(key);
}

export function createApi({ now = () => Date.now(), randomID = createShareID, fetchImpl = (...a) => fetch(...a) } = {}) {
  // one thing at a time per record (a save and a "finish" arriving together)
  const turns = new Map();
  function inTurn(key, work) { const run = (turns.get(key) ?? Promise.resolve()).then(work, work); const settled = run.then(() => {}, () => {}); turns.set(key, settled); settled.then(() => { if (turns.get(key) === settled) turns.delete(key); }); return run; }
  // Was this id really bought for this card? The sent4u orders server knows: GET /links/<id> -> { ok, product }.
  // Answers { valid: true } only for a real, not-refunded link of this card; {} when it can't be asked.
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
    try {
      if (!bucket) throw new Error('Card storage unavailable');
      const media = /^\/api\/media\/([A-Za-z0-9_-]{16,64}|studio)\/([^/]+)$/.exec(path);
      if (media) {
        if (request.method !== 'GET' || !MEDIA_FILE.test(media[2])) return json({ error: 'Not found.' }, 404);
        const object = await bucket.get(`media/${media[1]}/${media[2]}`);
        if (!object) return json({ error: 'Not found.' }, 404);
        return new Response(object.body, { headers: { 'Content-Type': TYPES[media[2].split('.').pop()], 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
      }
      const studio = path.startsWith('/api/studio/');
      const linkMatch = /^\/api\/invitations\/([^/]+)(\/finish|\/ensure|\/media)?$/.exec(path);
      if (!studio && !linkMatch) return json({ error: 'Not found.' }, 404);
      const origins = (env.CORS_ORIGIN || '*').split(',').map((v) => v.trim()).filter(Boolean), origin = request.headers.get('Origin');
      if (request.method !== 'GET' && origin && !origins.includes('*') && !origins.includes(origin)) return json({ error: 'This request must come from this website.' }, 403);
      if (path === '/api/studio/login') {
        if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
        if (!env.STUDIO_PASSWORD) return json({ error: 'The studio password is not set.' }, 503);
        const body = await bodyOf(request, ['password']);
        if (typeof body.password !== 'string' || body.password.length > 512) return json({ error: 'Please enter your password.' }, 400);
        const address = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0].trim() || 'unavailable-ip';
        const key = `attempts/${base64(await hash(address))}.json`;
        return inTurn(key, async () => {
          const attempts = await read(bucket, key), current = attempts && attempts.windowStart + 15 * 60 * 1000 > time ? attempts : null;
          if (current && current.attempts >= 10) return json({ error: 'Too many wrong attempts. Try again in 15 minutes.' }, 429, { 'Retry-After': '900' });
          if (!equal(await hash(body.password), await hash(env.STUDIO_PASSWORD))) { await write(bucket, key, current ? { ...current, attempts: current.attempts + 1 } : { windowStart: time, attempts: 1 }); return json({ error: 'Wrong password.' }, 401); }
          if (attempts) await bucket.delete(key);
          return json({ token: await token(env.STUDIO_PASSWORD, time) });
        });
      }
      if (studio) {
        if (!await authorized(request, env, time)) return json({ error: 'Please enter your password again to continue.' }, 401);
        if (path === '/api/studio/draft') {
          if (request.method === 'GET') { const d = await read(bucket, DRAFT_KEY); return json({ content: d ? d.content : freshContent(), revision: d?.revision || 0, finished: false, canEdit: true }); }
          if (request.method !== 'PUT') return json({ error: 'Method not allowed.' }, 405);
          const body = await bodyOf(request, ['content', 'revision']), content = checkedContent(body);
          return inTurn(DRAFT_KEY, async () => {
            const d = await read(bucket, DRAFT_KEY);
            if ((d?.revision || 0) !== body.revision) return json({ error: 'Changed in another window. Reload before saving.' }, 409);
            await write(bucket, DRAFT_KEY, { content, revision: body.revision + 1 });
            await prune(bucket, 'studio', content);
            return json({ revision: body.revision + 1, finished: false, canEdit: true });
          });
        }
        if (path === '/api/studio/media' && request.method === 'POST') return inTurn(DRAFT_KEY, () => upload(request, bucket, 'studio'));
        if (path === '/api/studio/links' && request.method === 'POST') {
          const body = await bodyOf(request, ['revision']), d = await read(bucket, DRAFT_KEY);
          if (!d || !Number.isInteger(body.revision) || body.revision !== d.revision) return json({ error: 'Save successfully before generating a link.' }, 409);
          for (let retry = 0; retry < 8; retry++) {
            const id = randomID(); if (!ID_PATTERN.test(id)) throw new Error('Invalid generated ID');
            const made = await inTurn(id, async () => {
              if (await bucket.head(shareKey(id))) return false;
              // the link gets its own copies of the draft's photos and voice
              for (const m of mediaOf(d.content)) { const o = await bucket.get(`media/studio/${m.slice(6)}`); if (o) await bucket.put(`media/${id}/${m.slice(6)}`, await o.arrayBuffer(), { httpMetadata: o.httpMetadata }); }
              await write(bucket, shareKey(id), newLink(d.content, time)); return true;
            });
            // the link uses the site's own public address (never a dev address unless that's where the studio runs)
            const site = (env.PUBLIC_ORIGIN || origin || (origins.includes('*') ? url.origin : origins[0])).replace(/\/$/, '');
            if (made) return json({ id, url: `${site}/?share=${id}`, createdAt: time, editingDeadline: time + FIVE_DAYS }, 201);
          }
          throw new Error('ID collision retry limit');
        }
        return json({ error: 'Not found.' }, 404);
      }
      const [, id, action] = linkMatch;
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
        if (request.method === 'GET' && !action) {
          if (record.editingDeadline == null && !record.finalized && at - record.createdAt > FIRST_VISIT_GRACE) { record = { ...record, editingDeadline: at + FIVE_DAYS }; await write(bucket, shareKey(id), record); }
          return json(linkState(record, at));
        }
        if (action === '/media') {
          if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
          return canEdit(record, at) ? upload(request, bucket, id) : closed(record, at);
        }
        const finish = action === '/finish';
        if (!(request.method === 'PUT' && !action) && !(request.method === 'POST' && finish)) return json({ error: 'Method not allowed.' }, 405);
        if (!canEdit(record, at)) return closed(record, at);
        const body = await bodyOf(request, ['content', 'revision']), content = checkedContent(body);
        if (body.revision !== record.revision) return json({ error: 'Changed in another window. Reload before saving.' }, 409);
        record = { ...record, content, revision: record.revision + 1, finalized: finish };
        await write(bucket, shareKey(id), record);
        await prune(bucket, id, content);
        return json({ revision: record.revision, finished: finish, editingDeadline: shownDeadline(record, at), canEdit: canEdit(record, at) });
      });
    } catch (error) {
      if (error.status) return json({ error: error.message }, error.status);
      console.error('Card request failed:', path, error.message);
      return json({ error: 'Connection error. Please try again.' }, 503);
    }
  } };
}
export default createApi();
