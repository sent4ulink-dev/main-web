/* sent4u reviews — a Cloudflare Worker that keeps reviews in an R2 bucket.

   GET    /reviews        the public list, newest first        -> { reviews: [{ id, name, role, tool, rating, text, at }] }
   POST   /reviews        add a review (it is live straight away, no approval step)
   DELETE /reviews/:id    remove one (owner only: Authorization: Bearer <ADMIN_TOKEN>)

   GET    /claims/:name   is this link name free?                -> { available: true | false }
   POST   /claims         reserve a link name (first come, first served; every name is unique)
   DELETE /claims/:name   free a name again (owner only)

   R2 layout
     reviews/<id>.json    one object per review, including the private bits (email, hashed IP)
     index.json           the public list, rebuilt after every change (this is what GET serves)
     rl/<hash>.json       tiny per-visitor counters for rate limiting (hashed IP, nothing else)
     claims/<name>.json   one object per reserved link name (the name, the optional email, a hashed IP). R2 refuses to overwrite it, which is
                          what makes a name unique even if two people ask at the same instant
     rlc/<hash>.json      the same kind of counters, for claims

   The id starts with an inverted timestamp, so listing the bucket in key order gives newest first. */

const TOOLS = ['Send', 'Pixel', 'Pinky', 'WinXP', 'Marketplace'];
const MAX_LIST = 100;             // how many reviews the public list holds
const MIN_GAP_MS = 60_000;        // one review per visitor per minute…
const MAX_PER_DAY = 5;            // …and five a day
const JSON_TYPE = { 'Content-Type': 'application/json; charset=utf-8' };

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    try {
      if (url.pathname === '/reviews' && request.method === 'GET') return await listReviews(env, cors);
      if (url.pathname === '/reviews' && request.method === 'POST') return await createReview(request, env, cors);
      const del = url.pathname.match(/^\/reviews\/(\d{13}-[a-f0-9]{8})$/);
      if (del && request.method === 'DELETE') return await deleteReview(request, env, cors, del[1]);
      const claim = url.pathname.match(/^\/claims\/([a-z0-9_-]{1,40})$/);
      if (claim && request.method === 'GET') return await checkClaim(env, cors, claim[1]);
      if (claim && request.method === 'DELETE') return await deleteClaim(request, env, cors, claim[1]);
      if (url.pathname === '/claims' && request.method === 'POST') return await createClaim(request, env, cors);
      if (url.pathname === '/') return reply({ ok: true, service: 'sent4u reviews' }, 200, cors);
      return reply({ error: 'Not found' }, 404, cors);
    } catch (err) {
      console.error(err);
      return reply({ error: 'Something went wrong on our side. Please try again in a moment.' }, 500, cors);
    }
  },
};

/* ---------------- responses + CORS ---------------- */

function reply(body, status, cors, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_TYPE, ...cors, ...extra } });
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigins(env);
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (!allowed.length) h['Access-Control-Allow-Origin'] = '*';
  else if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

// browsers always send Origin on a cross-site POST; refuse the ones that come from a site that is not on the list
function originOk(request, env) {
  const allowed = allowedOrigins(env);
  const origin = request.headers.get('Origin');
  return !allowed.length || !origin || allowed.includes(origin);
}

/* ---------------- reading ---------------- */

async function listReviews(env, cors) {
  const stored = await env.BUCKET.get('index.json');
  const body = stored ? await stored.text() : JSON.stringify({ reviews: await rebuildIndex(env) });
  return new Response(body, { status: 200, headers: { ...JSON_TYPE, ...cors, 'Cache-Control': 'public, max-age=20' } });
}

const publicView = r => ({ id: r.id, name: r.name, role: r.role, tool: r.tool, rating: r.rating, text: r.text, at: r.at });

async function rebuildIndex(env) {
  const listing = await env.BUCKET.list({ prefix: 'reviews/', limit: MAX_LIST });
  const items = (await Promise.all(listing.objects.map(async o => {
    const obj = await env.BUCKET.get(o.key);
    if (!obj) return null;
    try { return publicView(await obj.json()); } catch { return null; }
  }))).filter(Boolean);
  await env.BUCKET.put('index.json', JSON.stringify({ reviews: items, updatedAt: Date.now() }), { httpMetadata: { contentType: 'application/json' } });
  return items;
}

/* ---------------- writing ---------------- */

async function createReview(request, env, cors) {
  if (!originOk(request, env)) return reply({ error: 'Reviews can only be sent from the sent4u site.' }, 403, cors);
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return reply({ error: 'Send JSON, please.' }, 415, cors);
  const raw = await request.text();
  if (raw.length > 4000) return reply({ error: 'That is a bit too long.' }, 413, cors);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ error: 'That did not look right. Please try again.' }, 400, cors); }
  if (!body || typeof body !== 'object') return reply({ error: 'That did not look right. Please try again.' }, 400, cors);

  // a bot filled in the hidden field: say yes and keep nothing
  if (body.website) return reply({ ok: true, review: null }, 201, cors);

  const v = validate(body);
  if (v.error) return reply({ error: v.error }, 422, cors);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.TURNSTILE_SECRET && !(await verifyTurnstile(env, body.turnstileToken, ip))) {
    return reply({ error: 'The human check didn’t go through. Please try again.' }, 400, cors);
  }

  const ipHash = await sha256(`${env.IP_SALT || ''}|${ip}`);
  const tooSoon = await rateLimit(env, ipHash, await sha256(v.review.text.toLowerCase()));
  if (tooSoon) return reply({ error: tooSoon }, 429, cors);

  const at = Date.now();
  const id = `${String(9_999_999_999_999 - at).padStart(13, '0')}-${randomHex(4)}`;
  const record = { id, ...v.review, at, email: v.email, ipHash };
  await env.BUCKET.put(`reviews/${id}.json`, JSON.stringify(record), { httpMetadata: { contentType: 'application/json' } });
  await rebuildIndex(env);
  return reply({ ok: true, review: publicView(record) }, 201, cors);
}

// control characters (and the two Unicode line separators) become spaces
const CONTROL = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
const clean = (value, max) => String(value ?? '').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function validate(b) {
  const name = clean(b.name, 40), role = clean(b.role, 40), text = clean(b.text, 280), email = clean(b.email, 80);
  const rating = Number(b.rating), tool = String(b.tool || '');
  if (!name) return { error: 'Add your name — a first name and initial is fine.' };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Pick a star rating first.' };
  if (!TOOLS.includes(tool)) return { error: 'Choose what you used.' };
  if (text.length < 20) return { error: 'Tell us a little more — at least 20 characters.' };
  if (/https?:\/\/|www\./i.test(`${name} ${role} ${text}`)) return { error: 'Please leave links out of your review.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'That email address doesn’t look right.' };
  if (b.consent !== true) return { error: 'Tick the box so we’re allowed to show your review.' };
  return { review: { name, role, tool, rating, text }, email };
}

// one review a minute and five a day per visitor, and the same words twice is refused. Only a hash of the IP is ever stored.
async function rateLimit(env, ipHash, textHash) {
  const key = `rl/${ipHash}.json`;
  const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
  const stored = await env.BUCKET.get(key);
  let s = stored ? await stored.json().catch(() => ({})) : {};
  if (s.day !== day) s = { day, n: 0, last: 0, text: '' };
  if (now - (s.last || 0) < MIN_GAP_MS) return 'That was quick — please wait a minute before sending another review.';
  if (s.n >= MAX_PER_DAY) return 'You’ve sent a few reviews today. Please come back tomorrow.';
  if (s.text === textHash) return 'That review has already been sent.';
  s.n += 1; s.last = now; s.text = textHash;
  await env.BUCKET.put(key, JSON.stringify(s));
  return '';
}

async function verifyTurnstile(env, token, ip) {
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', String(token));
  if (ip && ip !== 'unknown') form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const out = await res.json().catch(() => ({}));
  return out.success === true;
}

/* ---------------- removing (owner only) ---------------- */

async function deleteReview(request, env, cors, id) {
  const sent = request.headers.get('Authorization') || '';
  if (!env.ADMIN_TOKEN || !(await safeEqual(sent, `Bearer ${env.ADMIN_TOKEN}`))) return reply({ error: 'Not allowed.' }, 403, cors);
  await env.BUCKET.delete(`reviews/${id}.json`);
  await rebuildIndex(env);
  return reply({ ok: true }, 200, cors);
}

/* ---------------- claiming a link name ---------------- */

const RESERVED = new Set(['admin', 'administrator', 'support', 'help', 'sent4u', 'sent', 'www', 'api', 'app', 'root', 'mail', 'email', 'billing', 'security',
  'about', 'blog', 'careers', 'terms', 'privacy', 'login', 'logout', 'signup', 'register', 'account', 'settings', 'pricing', 'status', 'team', 'staff',
  'official', 'contact', 'press', 'legal', 'escrow', 'marketplace', 'pixel', 'pinky', 'winxp', 'send', 'null', 'undefined']);

// 3–24 characters: lower-case letters and numbers, with - or _ allowed in the middle
function handleProblem(h) {
  if (!/^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$/.test(h)) return 'Use 3–24 letters, numbers, - or _ (not at the start or end).';
  if (/[-_]{2}/.test(h)) return 'Keep the dashes and underscores apart.';
  if (RESERVED.has(h)) return 'That name is reserved.';
  return '';
}

async function checkClaim(env, cors, handle) {
  const problem = handleProblem(handle);
  if (problem) return reply({ available: false, reason: problem }, 200, cors, { 'Cache-Control': 'public, max-age=5' });
  const taken = await env.BUCKET.get(`claims/${handle}.json`);
  return reply({ available: !taken, ...(taken ? { reason: 'That one is taken.' } : {}) }, 200, cors, { 'Cache-Control': 'public, max-age=5' });
}

async function createClaim(request, env, cors) {
  if (!originOk(request, env)) return reply({ error: 'Names can only be claimed from the sent4u site.' }, 403, cors);
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return reply({ error: 'Send JSON, please.' }, 415, cors);
  const raw = await request.text();
  if (raw.length > 1500) return reply({ error: 'That is a bit too long.' }, 413, cors);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ error: 'That did not look right. Please try again.' }, 400, cors); }
  if (!body || typeof body !== 'object') return reply({ error: 'That did not look right. Please try again.' }, 400, cors);
  if (body.website) return reply({ ok: true, handle: null }, 201, cors);                      // a bot filled in the hidden field

  const handle = String(body.handle || '').trim().toLowerCase();
  const problem = handleProblem(handle);
  if (problem) return reply({ error: problem }, 422, cors);
  const email = clean(body.email, 80);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: 'That email address doesn’t look right.' }, 422, cors);

  const ipHash = await sha256(`${env.IP_SALT || ''}|${request.headers.get('CF-Connecting-IP') || 'unknown'}`);
  const tooMany = await claimLimit(env, ipHash);
  if (tooMany) return reply({ error: tooMany }, 429, cors);

  // R2 only writes if nothing is stored under this name yet; if two people ask at once, exactly one of them gets it
  const stored = await env.BUCKET.put(`claims/${handle}.json`, JSON.stringify({ handle, email, at: Date.now(), ipHash }), {
    httpMetadata: { contentType: 'application/json' },
    onlyIf: { etagDoesNotMatch: '*' },
  });
  if (!stored) return reply({ error: 'Someone just took that one. Try another?' }, 409, cors);
  return reply({ ok: true, handle }, 201, cors);
}

async function claimLimit(env, ipHash) {
  const key = `rlc/${ipHash}.json`;
  const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
  const stored = await env.BUCKET.get(key);
  let s = stored ? await stored.json().catch(() => ({})) : {};
  if (s.day !== day) s = { day, n: 0, last: 0 };
  if (now - (s.last || 0) < 20_000) return 'Give it a few seconds before claiming another name.';
  if (s.n >= 4) return 'That’s plenty of names for today. Come back tomorrow.';
  s.n += 1; s.last = now;
  await env.BUCKET.put(key, JSON.stringify(s));
  return '';
}

async function deleteClaim(request, env, cors, handle) {
  const sent = request.headers.get('Authorization') || '';
  if (!env.ADMIN_TOKEN || !(await safeEqual(sent, `Bearer ${env.ADMIN_TOKEN}`))) return reply({ error: 'Not allowed.' }, 403, cors);
  await env.BUCKET.delete(`claims/${handle}.json`);
  return reply({ ok: true }, 200, cors);
}

/* ---------------- small helpers ---------------- */

function randomHex(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// compare through hashes so the time taken does not depend on how many characters matched
async function safeEqual(a, b) {
  return (await sha256(a)) === (await sha256(b));
}
