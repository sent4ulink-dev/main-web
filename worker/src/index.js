/* sent4u reviews — a Cloudflare Worker that keeps reviews in an R2 bucket.

   GET    /reviews        the public list, newest first        -> { reviews: [{ id, name, role, tool, rating, text, at }] }
   POST   /reviews        add a review (it is live straight away, no approval step)
   DELETE /reviews/:id    remove one (owner only: Authorization: Bearer <ADMIN_TOKEN>)

   GET    /claims/:name   is this link name free?                -> { available: true | false }
   POST   /claims         reserve a link name (first come, first served; every name is unique)
   DELETE /claims/:name   free a name again (owner only)

   POST   /checkout                 start an order for a pack: { pack: "single" | "pack" }  -> { token, checkoutUrl }  (creates a Paddle transaction)
   GET    /orders/:token            the order: how many links were paid for, how many are left, the links made so far
   POST   /orders/:token/generate   make links from a paid order: { items: { pixel: 3, picnic: 2, salon: 3 } }  (never more than were paid for)
   POST   /orders/:token/confirm    mark it paid by hand (owner only: Authorization: Bearer <ORDER_SECRET>) — Paddle itself uses the webhook below
   POST   /orders/:token/refund     the payment was refunded: the order's links stop working (same secret)
   POST   /webhooks/paddle          Paddle calls this when a transaction completes (authenticated by its own signature, not a bearer token)

   GET    /links/:id                is this a real, still-good link, and which product is it? -> { ok: true, product } or 404  (public, read-only —
                                     this is what the gateway that picks which app to serve for sent4u.link/?share=<id> calls, and what each app's
                                     own backend calls to self-heal a link that's opened before /generate has fully landed)

   Signing in — no passwords: a visitor gives their email, gets a one-time link, clicking it signs them in. This is what lets someone see every
   order they've ever paid for (not just the one this browser remembers) — see "Sign-in" in the README for the Resend setup this needs.

   POST   /auth/request-link    { email }  ->  { ok: true }  (always, whether or not the email is rate-limited or fails to send — never reveals
                                which emails have signed in before)
   GET    /auth/verify          ?token=<from the email>  ->  302 redirect to /, with the session cookie set. Meant to be opened directly (it's the
                                link in the email), not fetched.
   POST   /auth/logout          clears the session cookie
   GET    /me                   the signed-in visitor's own orders  ->  { email, orders: [...] }, or 401 if not signed in

   R2 layout
     orders/<token>.json  one object per order (pack, credits, status, the links made, and which signed-in visitor made it, if any); the token is
                          a random 128-bit secret and is the buyer's key regardless of whether they ever sign in
     tx/<paddleId>.json   Paddle's own transaction id -> our order token, so a webhook that lacks custom_data can still find the order
     links/<id>.json      one object per link that was made: which product it is and which order it came from (the page that serves ?share=<id> reads this)
     rlo/<hash>.json      per-visitor counters for starting orders
     reviews/<id>.json    one object per review, including the private bits (email, hashed IP)
     index.json           the public list, rebuilt after every change (this is what GET serves)
     rl/<hash>.json       tiny per-visitor counters for rate limiting (hashed IP, nothing else)
     claims/<name>.json   one object per reserved link name (the name, the optional email, a hashed IP). R2 refuses to overwrite it, which is
                          what makes a name unique even if two people ask at the same instant
     rlc/<hash>.json      the same kind of counters, for claims
     users/<hash>.json    one object per signed-in visitor (the order tokens they've made while signed in), keyed by a hash of their email —
                          never the email itself, so a bucket listing never exposes an address

   The id starts with an inverted timestamp, so listing the bucket in key order gives newest first.

   KV layout (see AUTH in wrangler.toml) — both auto-expire, nothing to clean up by hand
     login:<token>    a pending sign-in link's destination email, 15-minute TTL, deleted the moment it's used (one-time)
     session:<token>  a signed-in visitor's email, 30-day TTL
     rla:<hash>       per-visitor counters for requesting sign-in links */

const TOOLS = ['Send', 'Pixel', 'Pinky', 'WinXP', 'Petal Isle', 'Picnic', 'Heritage', 'Salon', 'Mission', 'Halloween', 'Halloween Night', 'Thanksgiving', 'Marketplace'];   // Salon = Heritage's old name
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
      if (url.pathname === '/auth/request-link' && request.method === 'POST') return await requestLoginLink(request, env, cors);
      // /auth/verify is the address in emails sent before the confirmation page existed: it shows the same page
      if ((url.pathname === '/auth/confirm' || url.pathname === '/auth/verify') && request.method === 'GET') return await confirmPage(request, env);
      if (url.pathname === '/auth/confirm' && request.method === 'POST') return await confirmLogin(request, env);
      if (url.pathname === '/auth/status' && request.method === 'GET') return await loginStatus(request, env, cors);
      if (url.pathname === '/auth/logout' && request.method === 'POST') return await logout(request, env, cors);
      if (url.pathname === '/me' && request.method === 'GET') return await getMe(request, env, cors);
      if (url.pathname === '/checkout' && request.method === 'POST') return await createCheckout(request, env, cors);
      const order = url.pathname.match(/^\/orders\/([A-Za-z0-9_-]{22})(?:\/(generate|confirm|refund|refund-request))?$/);
      if (order && !order[2] && request.method === 'GET') return await getOrder(env, cors, order[1]);
      if (order && order[2] === 'generate' && request.method === 'POST') return await generateLinks(request, env, cors, order[1]);
      if (order && order[2] === 'confirm' && request.method === 'POST') return await confirmOrder(request, env, cors, order[1]);
      if (order && order[2] === 'refund' && request.method === 'POST') return await refundOrder(request, env, cors, order[1]);
      if (order && order[2] === 'refund-request' && request.method === 'POST') return await requestRefund(request, env, cors, order[1]);
      if (url.pathname === '/webhooks/paddle' && request.method === 'POST') return await paddleWebhook(request, env, cors);
      const link = url.pathname.match(/^\/links\/([A-Za-z0-9_-]{22})$/);
      if (link && request.method === 'GET') return await getLink(env, cors, link[1]);
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
  'official', 'contact', 'press', 'legal', 'escrow', 'marketplace', 'pixel', 'pinky', 'winxp', 'petal', 'picnic', 'salon', 'mission', 'halloween', 'spooky', 'thanksgiving', 'send', 'null', 'undefined']);

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

/* ---------------- signing in: no passwords, a link in an email to confirm it's you ----------------
   Nothing is stored until someone confirms from the inbox — the same trust anyone already places in "forgot password" email on every
   other site. There is no password to steal in a breach and nothing to reuse from a leak elsewhere.

   1. POST /auth/request-link {email}: emails a link, and gives the asking browser a waiting cookie (s4u_signin) and a two-digit
      number to show while it waits.
   2. The link opens a confirmation page (GET only shows it, so a mail scanner that opens links can't use it up). Opened in the browser
      that asked, it is one button: "Sign me in". Opened somewhere else (the email on a phone, the site on a laptop), the page asks which
      number the other screen shows: picking the right one signs that waiting browser in, picking a wrong one cancels the whole request.
      That stops someone who asks for a link to another person's email from getting signed in when that person taps the link without
      thinking. The same page can also just sign in the browser it's open in.
   3. The waiting browser asks GET /auth/status every few seconds and gets its session the moment the request is confirmed.
   A session lasts 90 days and is renewed while it's used, so a browser that has signed in once doesn't need another email: that keeps
   the number of emails (and the monthly email allowance) down. */

const SESSION_COOKIE = 's4u_session';
const PENDING_COOKIE = 's4u_signin';
const SESSION_TTL_S = 90 * 24 * 60 * 60;       // 90 days…
const SESSION_RENEW_MS = 7 * 24 * 60 * 60 * 1000;   // …counted again from the latest visit, at most once a week
const LOGIN_TOKEN_TTL_S = 15 * 60;             // the link in the email is only good for 15 minutes
const userKey = hash => `users/${hash}.json`;

function isEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

// The cookies carry no Domain attribute, so the browser scopes them to whichever host actually answered — sent4u.link, since the
// gateway proxies /auth/* and /me there (see gateway/index.js): first-party cookies, not ones shared cross-site with this Worker's own
// *.workers.dev address. Visiting that address directly still works for API calls, just without a saved session.
const sessionCookie = token => `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_S}; SameSite=Lax; HttpOnly; Secure`;
const pendingCookie = (id, maxAge = LOGIN_TOKEN_TTL_S) => `${PENDING_COOKIE}=${id}; Path=/auth; Max-Age=${maxAge}; SameSite=Lax; HttpOnly; Secure`;
function setSessionCookie(headers, token) {
  headers['Set-Cookie'] = sessionCookie(token);
}
function clearSessionCookie(headers) {
  headers['Set-Cookie'] = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure`;
}

async function startSession(env, email) {
  const token = randomToken();
  await env.AUTH.put(`session:${token}`, JSON.stringify({ email, renewedAt: Date.now() }), { expirationTtl: SESSION_TTL_S });
  return token;
}

async function readSession(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const stored = await env.AUTH.get(`session:${token}`);
  return stored ? { token, ...JSON.parse(stored) } : null;
}

async function sessionEmail(request, env) {
  const session = await readSession(request, env);
  return session ? session.email : null;
}

async function readUser(env, email) {
  const hash = await sha256(email);
  const stored = await env.BUCKET.get(userKey(hash));
  return { hash, user: stored ? await stored.json() : { email, orders: [], createdAt: Date.now() } };
}

// Called once at checkout, while the order is still just "pending" — not worth a compare-and-swap loop here (worst case, two orders
// started in the same instant both append fine since each write reads its own fresh copy moments apart; a lost update would just mean
// one order takes a moment longer to show up under "my links", not lose any money or access).
async function addOrderToUser(env, email, token) {
  const { hash, user } = await readUser(env, email);
  if (user.orders.includes(token)) return;
  user.orders.push(token);
  await env.BUCKET.put(userKey(hash), JSON.stringify(user), JSON_OBJECT);
}

// A handful of sign-in emails per visitor per hour is plenty, and keeps this from being a way to mail-bomb someone else's inbox.
async function loginLimit(env, ipHash) {
  const key = `rla/${ipHash}.json`;
  const now = Date.now(), hour = Math.floor(now / 3_600_000);
  const stored = await env.BUCKET.get(key);
  let s = stored ? await stored.json().catch(() => ({})) : {};
  if (s.hour !== hour) s = { hour, n: 0, last: 0 };
  if (now - (s.last || 0) < 5000) return true;
  if (s.n >= 5) return true;
  s.n += 1; s.last = now;
  await env.BUCKET.put(key, JSON.stringify(s));
  return false;
}

async function sendLoginEmail(env, email, link) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM || 'sent4u <onboarding@resend.dev>',
      to: [email],
      subject: 'Sign in to sent4u',
      text: `Confirm it's you to sign in to sent4u:\n\n${link}\n\nOpen it on any device: if it isn't the one you're signing in on, it asks for the number that device is showing. The link expires in 15 minutes. If you didn't ask to sign in, just ignore this — nothing happens unless you confirm.`,
      html: `<p>Confirm it's you to sign in to sent4u:</p><p><a href="${link}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#7c5cff;color:#fff;text-decoration:none;font-weight:600">Confirm sign-in</a></p><p style="color:#666">Open it on any device: if it isn't the one you're signing in on, it asks for the number that device is showing. The link expires in 15 minutes. If you didn't ask to sign in, just ignore this — nothing happens unless you confirm.</p><p style="color:#999;font-size:12px">${link}</p>`,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 500)}`);
}

const twoDigits = () => String(10 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90));

async function requestLoginLink(request, env, cors) {
  if (!originOk(request, env)) return reply({ error: 'Sign-in can only be started from the sent4u site.' }, 403, cors);
  const { body, fail } = await readBody(request, cors, 300);
  if (fail) return fail;
  const email = clean(body.email, 254).toLowerCase();
  if (!env.RESEND_API_KEY) return reply({ error: 'Sign-in isn’t switched on yet. Please check back soon.' }, 501, cors);
  // Always the same reply whether the email is well-formed, rate-limited, or the send itself fails — a number to show and a waiting
  // cookie — never letting a visitor probe whether a given address has an account (every address gets one automatically on first
  // sign-in, so there's nothing to probe anyway, but keeping the response uniform costs nothing).
  const pending = randomToken(), code = twoDigits();
  const headers = { 'Set-Cookie': pendingCookie(pending) };
  if (!isEmail(email)) return reply({ ok: true, code }, 200, cors, headers);

  const ipHash = await sha256(`${env.IP_SALT || ''}|${request.headers.get('CF-Connecting-IP') || 'unknown'}`);
  if (await loginLimit(env, ipHash)) return reply({ ok: true, code }, 200, cors, headers);

  const token = randomToken();
  await env.AUTH.put(`pending:${pending}`, JSON.stringify({ email, code, confirmed: false }), { expirationTtl: LOGIN_TOKEN_TTL_S });
  await env.AUTH.put(`login:${token}`, JSON.stringify({ email, pending }), { expirationTtl: LOGIN_TOKEN_TTL_S });
  const origin = String(env.LINK_ORIGIN || 'https://sent4u.link').replace(/[/]+$/, '');
  try {
    await sendLoginEmail(env, email, `${origin}/auth/confirm?token=${token}`);
  } catch (err) {
    console.error('sign-in email failed to send:', err);
  }
  return reply({ ok: true, code }, 200, cors, headers);
}

// "le***@example.com": enough to recognise your own address on the confirmation page, not enough to read someone else's
function maskEmail(email) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, Math.min(6, name.length - 2)))}@${domain}`;
}
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The confirmation page and its answers: small, self-contained HTML in the site's colours (it is served at sent4u.link/auth/confirm).
function page(title, body, status = 200, headers = {}) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} — sent4u</title>
<link rel="icon" href="/assets/brand/favicon.ico" sizes="16x16 32x32 48x48">
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#08080c;color:#f3f2f7;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:100%;max-width:420px;padding:32px 28px;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:#14141f;text-align:center}
.logo{display:block;width:fit-content;margin:0 auto 22px}.logo img{display:block;height:34px;width:auto}h1{margin:0 0 8px;font-size:1.4rem}p{margin:0 0 20px;color:#a3a1b0}b{color:#f3f2f7}
form{margin:0}button,.btn{display:inline-block;width:100%;padding:13px 20px;border:0;border-radius:999px;background:#fff;color:#0b0b12;font:600 1rem system-ui,sans-serif;cursor:pointer;text-decoration:none}
.ghost{margin-top:12px;background:transparent;color:#a3a1b0;border:1px solid rgba(255,255,255,.14)}.codes{display:flex;gap:12px;justify-content:center;margin:0 0 18px}
.codes button{width:76px;height:64px;padding:0;font-size:1.6rem;border-radius:16px;background:#191926;color:#f3f2f7;border:1px solid rgba(255,255,255,.14)}.codes button:hover{border-color:#7c5cff}
.or{margin:22px 0 12px;font-size:.85rem}
</style></head><body><main><a class="logo" href="/"><img src="/assets/brand/logo.webp" width="507" height="120" alt="sent4u"></a>${body}</main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', ...headers } });
}
const expiredPage = () => page('Link expired', '<h1>This link has expired</h1><p>Sign-in links work for 15 minutes and only once. Go back to sent4u and ask for a new one.</p><a class="btn" href="/">Back to sent4u</a>', 410);

async function confirmPage(request, env) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const stored = /^[A-Za-z0-9_-]{22}$/.test(token) && (await env.AUTH.get(`login:${token}`));
  if (!stored) return expiredPage();
  const { email, pending } = JSON.parse(stored);
  const here = `<form method="post" action="/auth/confirm"><input type="hidden" name="token" value="${token}"><button type="submit">Yes, sign me in</button></form>`;
  const waiting = pending && (await env.AUTH.get(`pending:${pending}`));
  // the browser that asked: one button
  if (!waiting || readCookie(request, PENDING_COOKIE) === pending) {
    return page('Confirm sign-in', `<h1>Sign in to sent4u?</h1><p>As <b>${escapeHtml(maskEmail(email))}</b></p>${here}`);
  }
  // somewhere else: which number is the other screen showing? (the right one, and two others, in a random order)
  const { code } = JSON.parse(waiting);
  const options = new Set([code]);
  while (options.size < 3) options.add(twoDigits());
  const shuffled = [...options].sort(() => crypto.getRandomValues(new Uint8Array(1))[0] - 128);
  const buttons = shuffled.map(n => `<button type="submit" name="choice" value="${n}">${n}</button>`).join('');
  return page('Confirm sign-in', `<h1>Signing in on another device?</h1><p>As <b>${escapeHtml(maskEmail(email))}</b>. Tap the number that the other screen is showing.</p>
<form method="post" action="/auth/confirm"><input type="hidden" name="token" value="${token}"><div class="codes">${buttons}</div></form>
<p class="or">Not signing in anywhere else? Then only sign in here:</p>${here.replace('Yes, sign me in', 'Sign in on this device')}`);
}

async function confirmLogin(request, env) {
  if (!originOk(request, env)) return page('Not allowed', '<h1>That didn’t work</h1><p>Please open the link from your email again.</p>', 403);
  const form = await request.formData().catch(() => null);
  const token = String((form && form.get('token')) || '');
  const choice = form && form.get('choice');
  const stored = /^[A-Za-z0-9_-]{22}$/.test(token) && (await env.AUTH.get(`login:${token}`));
  if (!stored) return expiredPage();
  await env.AUTH.delete(`login:${token}`);          // one confirmation per link, whatever happens below
  const { email, pending } = JSON.parse(stored);

  if (choice !== null && choice !== undefined) {    // approving the other device
    const waiting = pending && (await env.AUTH.get(`pending:${pending}`));
    if (!waiting) return expiredPage();
    const record = JSON.parse(waiting);
    if (String(choice) !== record.code) {
      await env.AUTH.delete(`pending:${pending}`);
      return page('Sign-in cancelled', '<h1>That number didn’t match</h1><p>So nothing was signed in. If it was you, ask for a new link on the device you’re signing in on.</p><a class="btn" href="/">Back to sent4u</a>');
    }
    await env.AUTH.put(`pending:${pending}`, JSON.stringify({ ...record, confirmed: true }), { expirationTtl: LOGIN_TOKEN_TTL_S });
    return page('Signed in', '<h1>You’re signed in</h1><p>Your other device is signing in now. You can close this page.</p>');
  }

  // signing in right here: the browser that asked also stops waiting
  if (pending && readCookie(request, PENDING_COOKIE) === pending) await env.AUTH.delete(`pending:${pending}`);
  const session = await startSession(env, email);
  const origin = String(env.LINK_ORIGIN || 'https://sent4u.link').replace(/[/]+$/, '');
  const headers = new Headers({ Location: `${origin}/?signedin=1`, 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', sessionCookie(session));
  headers.append('Set-Cookie', pendingCookie('', 0));
  return new Response(null, { status: 303, headers });
}

// The waiting browser asks this every few seconds: has the request been confirmed (here or on another device)?
async function loginStatus(request, env, cors) {
  const headers = new Headers({ ...JSON_TYPE, ...cors, 'Cache-Control': 'no-store' });
  const answer = body => new Response(JSON.stringify(body), { status: 200, headers });
  if (await readSession(request, env)) { headers.append('Set-Cookie', pendingCookie('', 0)); return answer({ signedIn: true }); }
  const pending = readCookie(request, PENDING_COOKIE);
  const waiting = pending && (await env.AUTH.get(`pending:${pending}`));
  if (!waiting) return answer({ signedIn: false, expired: true });
  const record = JSON.parse(waiting);
  if (!record.confirmed) return answer({ signedIn: false, waiting: true });
  await env.AUTH.delete(`pending:${pending}`);
  headers.append('Set-Cookie', sessionCookie(await startSession(env, record.email)));
  headers.append('Set-Cookie', pendingCookie('', 0));
  return answer({ signedIn: true });
}

async function logout(request, env, cors) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await env.AUTH.delete(`session:${token}`);
  const headers = {};
  clearSessionCookie(headers);
  return reply({ ok: true }, 200, cors, headers);
}

async function getMe(request, env, cors) {
  const session = await readSession(request, env);
  if (!session) return reply({ error: 'Not signed in.' }, 401, cors);
  const extra = { 'Cache-Control': 'no-store' };
  // still in use: count the 90 days again from today (at most once a week, so a busy visitor doesn't rewrite it every page)
  if (Date.now() - (session.renewedAt || 0) > SESSION_RENEW_MS) {
    await env.AUTH.put(`session:${session.token}`, JSON.stringify({ email: session.email, renewedAt: Date.now() }), { expirationTtl: SESSION_TTL_S });
    setSessionCookie(extra, session.token);
  }
  const { user } = await readUser(env, session.email);
  const orders = (await Promise.all(user.orders.map(t => readOrder(env, t)))).filter(Boolean).map(({ order }) => publicOrder(order));
  orders.sort((a, b) => (b.links[0]?.at || 0) - (a.links[0]?.at || 0));
  return reply({ email: session.email, orders }, 200, cors, extra);
}

/* ---------------- orders: packs of links ----------------
   1 link is $3.99 and a pack of 8 is $14.99 (the same price everywhere, in USD), sold as two one-time Prices in Paddle — a Merchant of Record, so Paddle is the legal seller and
   collects and remits VAT/GST worldwide; this Worker never has to. Checkout is Paddle's own hosted page: this Worker only creates the
   transaction (POST /checkout) and hands back its checkout URL. When Paddle confirms the payment it POSTs to /webhooks/paddle, which this
   Worker verifies by that request's own signature and marks the order paid — only then can the buyer make links, and never more than they
   paid for: with 8 they can split them as they like, e.g. 3 Pixel + 2 Pinky + 3 WinXP, in one go or over several visits.
   See worker/README.md "Orders" for how to set the Paddle side of this up. */

// no prototype: a plain {} would let pack="__proto__" (or "constructor", "toString", …) resolve PACKS[pack] to an inherited
// object instead of failing the lookup below, silently turning credits/amount into undefined further down.
const PACKS = Object.assign(Object.create(null), { single: { credits: 1, amount: 399 }, pack: { credits: 8, amount: 1499 } });
// every style a buyer can make a link for; the ids are what the gateway and each style's own server know it by
const PRODUCTS = ['pixel', 'pinky', 'winxp', 'petal', 'picnic', 'salon', 'mission', 'halloween', 'spooky', 'thanksgiving'];
const JSON_OBJECT = { httpMetadata: { contentType: 'application/json' } };
const WEBHOOK_TOLERANCE_S = 300;                                // reject a Paddle-Signature whose timestamp is older than this (clock skew + retry headroom)

const orderKey = token => `orders/${token}.json`;
const txKey = id => `tx/${id}.json`;                            // Paddle's transaction id -> our order token
const REFUND_WINDOW_MS = 10 * 60 * 1000;                        // a buyer can undo a purchase themselves for 10 minutes after paying
// …and only while no link has been made: a link that exists can be sent, opened and enjoyed, so a refund after that would be a free card
const refundableUntil = o => (o.status === 'paid' && o.paidAt && o.paddleTransactionId && !o.links.length ? o.paidAt + REFUND_WINDOW_MS : null);
const publicOrder = o => ({ token: o.token, pack: o.pack, credits: o.credits, remaining: o.credits - o.links.length, amount: o.amount, status: o.status, links: o.links, paidAt: o.paidAt || null, refundableUntil: refundableUntil(o) });

function randomToken(bytes = 16) {
  const raw = String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes)));
  return btoa(raw).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function readOrder(env, token) {
  const stored = await env.BUCKET.get(orderKey(token));
  if (!stored) return null;
  return { order: await stored.json(), etag: stored.etag };
}

const isOwner = async (request, env) => !!env.ORDER_SECRET && await safeEqual(request.headers.get('Authorization') || '', `Bearer ${env.ORDER_SECRET}`);

async function readBody(request, cors, max) {
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return { fail: reply({ error: 'Send JSON, please.' }, 415, cors) };
  const raw = await request.text();
  if (raw.length > max) return { fail: reply({ error: 'That is a bit too long.' }, 413, cors) };
  try {
    const body = JSON.parse(raw);
    if (body && typeof body === 'object') return { body };
  } catch { /* falls through */ }
  return { fail: reply({ error: 'That did not look right. Please try again.' }, 400, cors) };
}

async function createCheckout(request, env, cors) {
  if (!originOk(request, env)) return reply({ error: 'Orders can only be started from the sent4u site.' }, 403, cors);
  const { body, fail } = await readBody(request, cors, 500);
  if (fail) return fail;
  const pack = String(body.pack || '');
  if (!PACKS[pack] || !Number.isInteger(PACKS[pack].credits)) return reply({ error: 'Choose 1 link or a pack of 8.' }, 422, cors);   // belt and suspenders: credits must be a real number before anything is charged
  const priceId = pack === 'single' ? env.PADDLE_PRICE_SINGLE : env.PADDLE_PRICE_PACK;
  if (!env.PADDLE_API_KEY || !priceId) return reply({ error: 'Checkout isn’t switched on yet. Please check back soon.' }, 501, cors);

  const ipHash = await sha256(`${env.IP_SALT || ''}|${request.headers.get('CF-Connecting-IP') || 'unknown'}`);
  const tooMany = await orderLimit(env, ipHash);
  if (tooMany) return reply({ error: tooMany }, 429, cors);

  const token = randomToken();
  let paddle;
  try {
    paddle = await paddleCreateTransaction(env, priceId, token);
  } catch (err) {
    console.error('paddle: could not create a transaction', err);
    return reply({ error: 'Checkout isn’t reachable right now. Please try again in a moment.' }, 502, cors);
  }

  // Signed-in visitors get this order added to "My links" automatically — everyone else can still open it later from the checkout
  // redirect or /?order=<token>, same as before sign-in existed. Not required to buy at all.
  const email = await sessionEmail(request, env);
  const order = { token, pack, credits: PACKS[pack].credits, amount: PACKS[pack].amount, status: 'pending', createdAt: Date.now(), links: [], ipHash, paddleTransactionId: paddle.id, userEmail: email || undefined };
  await env.BUCKET.put(orderKey(token), JSON.stringify(order), JSON_OBJECT);
  await env.BUCKET.put(txKey(paddle.id), JSON.stringify({ token }), JSON_OBJECT);   // lets a webhook that only carries the transaction id still find this order
  if (email) await addOrderToUser(env, email, token);
  return reply({ ok: true, token, checkoutUrl: paddle.checkoutUrl }, 201, cors);
}

// Creates a Paddle transaction for one price and returns its hosted checkout link. custom_data carries our own order token, so the
// transaction.completed webhook (see paddleWebhook) can mark the right order paid without a lookup, in the normal case.
async function paddleCreateTransaction(env, priceId, token) {
  const base = String(env.PADDLE_API_BASE || 'https://api.paddle.com').replace(/\/+$/, '');
  const res = await fetch(`${base}/transactions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.PADDLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ price_id: priceId, quantity: 1 }],
      collection_mode: 'automatic',
      custom_data: { orderToken: token },
      // no checkout.url: Paddle uses the default payment link set in its dashboard (https://sent4u.link/pay, which runs Paddle.js), and
      // the checkout link it returns is that address with ?_ptxn=<transaction id>, which makes Paddle.js open the payment window
    }),
  });
  const json = await res.json().catch(() => null);
  const id = json && json.data && json.data.id;
  const checkoutUrl = json && json.data && json.data.checkout && json.data.checkout.url;
  if (!res.ok || !id || !checkoutUrl) throw new Error(`paddle ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  return { id, checkoutUrl };
}

// a few orders an hour per visitor is plenty, and it keeps the bucket from filling with abandoned ones
async function orderLimit(env, ipHash) {
  const key = `rlo/${ipHash}.json`;
  const now = Date.now(), hour = Math.floor(now / 3_600_000);
  const stored = await env.BUCKET.get(key);
  let s = stored ? await stored.json().catch(() => ({})) : {};
  if (s.hour !== hour) s = { hour, n: 0, last: 0 };
  if (now - (s.last || 0) < 3000) return 'One moment, please.';
  if (s.n >= 12) return 'That’s plenty of orders for one hour. Please try again a little later.';
  s.n += 1; s.last = now;
  await env.BUCKET.put(key, JSON.stringify(s));
  return '';
}

async function getOrder(env, cors, token) {
  const found = await readOrder(env, token);
  if (!found) return reply({ error: 'We couldn’t find that order.' }, 404, cors);
  return reply(publicOrder(found.order), 200, cors, { 'Cache-Control': 'no-store' });
}

// The compare-and-set loop shared by the webhook (Paddle says a transaction completed) and the manual owner-only route below (for fixing
// an order by hand, or testing). Idempotent: a repeated "paid" notice for an already-paid order is a no-op, not an error — Paddle retries
// webhooks it isn't sure were received, so this will be called more than once for the same transaction in normal operation.
async function markPaid(env, token) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const found = await readOrder(env, token);
    if (!found) return { error: 'not_found' };
    const { order, etag } = found;
    if (order.status === 'refunded' || order.status === 'refunding') return { error: 'refunded' };
    if (order.status === 'paid') return { order };
    const next = { ...order, status: 'paid', paidAt: Date.now() };
    if (await env.BUCKET.put(orderKey(token), JSON.stringify(next), { ...JSON_OBJECT, onlyIf: { etagMatches: etag } })) return { order: next };
  }
  return { error: 'busy' };
}

async function confirmOrder(request, env, cors, token) {
  if (!(await isOwner(request, env))) return reply({ error: 'Not allowed.' }, 403, cors);
  const { order, error } = await markPaid(env, token);
  if (error === 'not_found') return reply({ error: 'We couldn’t find that order.' }, 404, cors);
  if (error === 'refunded') return reply({ error: 'That order was refunded.' }, 409, cors);
  if (error === 'busy') return reply({ error: 'That order is busy. Please try again.' }, 409, cors);
  return reply(publicOrder(order), 200, cors);
}

async function generateLinks(request, env, cors, token) {
  if (!originOk(request, env)) return reply({ error: 'Links can only be made from the sent4u site.' }, 403, cors);
  const { body, fail } = await readBody(request, cors, 500);
  if (fail) return fail;

  const asked = body.items && typeof body.items === 'object' && !Array.isArray(body.items) ? body.items : null;
  if (!asked || Object.keys(asked).some(k => !PRODUCTS.includes(k))) return reply({ error: 'Choose one of the styles.' }, 422, cors);
  const items = {};
  let want = 0;
  for (const product of PRODUCTS) {
    const n = asked[product] ?? 0;
    if (!Number.isInteger(n) || n < 0 || n > 8) return reply({ error: 'Those numbers don’t look right.' }, 422, cors);
    items[product] = n; want += n;
  }
  if (want < 1) return reply({ error: 'Choose at least one link.' }, 422, cors);

  const origin = String(env.LINK_ORIGIN || 'https://sent4u.link').replace(/[/]+$/, '');
  for (let attempt = 0; attempt < 4; attempt++) {
    const found = await readOrder(env, token);
    if (!found) return reply({ error: 'We couldn’t find that order.' }, 404, cors);
    const { order, etag } = found;
    if (order.status !== 'paid') return reply({ error: order.status === 'refunded' || order.status === 'refunding' ? 'This order was refunded.' : 'This order hasn’t been paid yet.' }, 402, cors);
    const remaining = order.credits - order.links.length;
    if (want > remaining) return reply({ error: remaining ? `You only have ${remaining} link${remaining === 1 ? '' : 's'} left.` : 'All the links in this pack have been made.' }, 422, cors);

    const at = Date.now(), made = [];
    for (const product of PRODUCTS) for (let i = 0; i < items[product]; i++) {
      const id = randomToken();
      made.push({ product, id, url: `${origin}/?share=${id}`, at });
    }
    // the links exist the moment they are written; if the order changed underneath us (a second tab, a double tap), undo them and look again
    await Promise.all(made.map(l => env.BUCKET.put(`links/${l.id}.json`, JSON.stringify({ id: l.id, product: l.product, order: token, createdAt: at }), { ...JSON_OBJECT, onlyIf: { etagDoesNotMatch: '*' } })));
    const next = { ...order, links: [...order.links, ...made] };
    if (await env.BUCKET.put(orderKey(token), JSON.stringify(next), { ...JSON_OBJECT, onlyIf: { etagMatches: etag } })) return reply(publicOrder(next), 200, cors);
    await Promise.all(made.map(l => env.BUCKET.delete(`links/${l.id}.json`)));
  }
  return reply({ error: 'That order is busy. Please try again.' }, 409, cors);
}

async function refundOrder(request, env, cors, token) {
  if (!(await isOwner(request, env))) return reply({ error: 'Not allowed.' }, 403, cors);
  const found = await readOrder(env, token);
  if (!found) return reply({ error: 'We couldn’t find that order.' }, 404, cors);
  const next = { ...found.order, status: 'refunded', refundedAt: Date.now() };
  await env.BUCKET.put(orderKey(token), JSON.stringify(next), JSON_OBJECT);
  await setLinksRevoked(env, next, true);
  return reply(publicOrder(next), 200, cors);
}

// A link stops working the moment its order is refunded (or a refund is on its way), and works again if Paddle turns the refund down.
async function setLinksRevoked(env, order, revoked) {
  await Promise.all(order.links.map(l => env.BUCKET.put(`links/${l.id}.json`,
    JSON.stringify({ id: l.id, product: l.product, order: order.token, createdAt: l.at, ...(revoked ? { revoked: true } : {}) }), JSON_OBJECT)));
}

// The same compare-and-set loop as markPaid, for any change to an order: change(order) returns the new order, or null for "leave it".
async function updateOrder(env, token, change) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const found = await readOrder(env, token);
    if (!found) return { error: 'not_found' };
    const next = change(found.order);
    if (!next) return { order: found.order, unchanged: true };
    if (await env.BUCKET.put(orderKey(token), JSON.stringify(next), { ...JSON_OBJECT, onlyIf: { etagMatches: found.etag } })) return { order: next };
  }
  return { error: 'busy' };
}

/* ---------------- refunds the buyer asks for themselves ----------------
   For 10 minutes after paying (from the moment Paddle confirmed the payment), and only until the first link is made, whoever holds the order — its token is the buyer's key,
   the same one that makes the links — can undo the purchase: the links stop working at once and Paddle is asked for a full refund
   (an "adjustment"). Paddle reviews most refunds before the money moves (status pending_approval) and tells /webhooks/paddle when it
   decides: approved makes the order "refunded" for good, rejected gives the buyer their links back. After the 10 minutes this route
   says no; anything else goes through support and the Paddle dashboard by hand. */
async function requestRefund(request, env, cors, token) {
  if (!originOk(request, env)) return reply({ error: 'Refunds can only be asked for from the sent4u site.' }, 403, cors);
  if (!env.PADDLE_API_KEY) return reply({ error: 'Refunds aren’t switched on yet. Please contact us.' }, 501, cors);
  const now = Date.now();
  let refused = '';
  const { order, error } = await updateOrder(env, token, o => {
    if (o.status === 'refunding' || o.status === 'refunded') { refused = 'This order has already been refunded.'; return null; }
    if (o.status !== 'paid') { refused = 'This order hasn’t been paid yet.'; return null; }
    const until = refundableUntil(o);
    if (o.links.length) { refused = 'Links have already been made from this order, so it can’t be refunded.'; return null; }
    if (!until || now > until) { refused = 'The 10 minutes for an instant refund have passed, so this order can’t be refunded.'; return null; }
    return { ...o, status: 'refunding', refundRequestedAt: now };
  });
  if (error === 'not_found') return reply({ error: 'We couldn’t find that order.' }, 404, cors);
  if (error === 'busy') return reply({ error: 'That order is busy. Please try again.' }, 409, cors);
  if (refused) return reply({ error: refused }, 409, cors);
  await setLinksRevoked(env, order, true);

  try {
    const adjustment = await paddleRefund(env, order.paddleTransactionId);
    const saved = await updateOrder(env, token, o => (o.status === 'refunding' ? { ...o, refundAdjustmentId: adjustment.id, refundStatus: adjustment.status } : null));
    return reply(publicOrder(saved.order || order), 200, cors);
  } catch (err) {
    console.error('paddle: could not create a refund', token, err);
    // Paddle didn't take it: put the order back the way it was, so the buyer still has what they paid for and can try again
    const back = await updateOrder(env, token, o => {
      if (o.status !== 'refunding' || o.refundAdjustmentId) return null;
      const { refundRequestedAt, ...rest } = o;
      return { ...rest, status: 'paid' };
    });
    if (back.order && back.order.status === 'paid' && !back.unchanged) await setLinksRevoked(env, back.order, false);
    return reply({ error: 'The refund couldn’t be started just now. Please try again in a moment.' }, 502, cors);
  }
}

async function paddleRefund(env, transactionId) {
  const base = String(env.PADDLE_API_BASE || 'https://api.paddle.com').replace(/\/+$/, '');
  const res = await fetch(`${base}/adjustments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.PADDLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'refund', type: 'full', transaction_id: transactionId, reason: 'Asked for by the buyer within 10 minutes of buying' }),
  });
  const json = await res.json().catch(() => null);
  const data = json && json.data;
  if (!res.ok || !data || !data.id) throw new Error(`paddle ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  return { id: data.id, status: data.status };
}

// Paddle's word on a refund or chargeback for one of our transactions (adjustment.created / adjustment.updated). Only a full refund
// or a chargeback stops the links: a partial refund made by hand in the dashboard (a goodwill gesture) leaves them working.
async function settleAdjustment(env, adjustment) {
  if (adjustment.action !== 'refund' && adjustment.action !== 'chargeback') return;
  const token = await tokenForTransaction(env, adjustment.transaction_id);
  if (!token) return;
  const full = adjustment.type === 'full' || adjustment.action === 'chargeback';
  if (adjustment.status === 'approved' && full) {
    const { order, unchanged } = await updateOrder(env, token, o => (o.status === 'refunded' ? null : { ...o, status: 'refunded', refundedAt: Date.now(), refundStatus: 'approved' }));
    if (order && !unchanged) await setLinksRevoked(env, order, true);
  } else if (adjustment.status === 'rejected' && adjustment.action === 'refund') {
    // Paddle turned it down: whatever the buyer asked for, they keep what they paid for
    const { order, unchanged } = await updateOrder(env, token, o => (o.status === 'refunding' ? { ...o, status: 'paid', refundStatus: 'rejected' } : null));
    if (order && !unchanged) await setLinksRevoked(env, order, false);
  }
}

async function tokenForTransaction(env, transactionId) {
  if (!transactionId) return null;
  const stored = await env.BUCKET.get(txKey(transactionId));
  return stored ? (await stored.json()).token : null;
}

// Public and read-only, on purpose: this is called both by whatever picks which app to serve for a given share id, and by
// each app's own backend (to self-heal a link opened in the gap before its content record exists — see each app's /ensure).
// It only ever confirms "this id is real, for this product" or 404s; it never returns anything about the order it came from.
async function getLink(env, cors, id) {
  const stored = await env.BUCKET.get(`links/${id}.json`);
  if (!stored) return reply({ error: 'Not found.' }, 404, cors, { 'Cache-Control': 'no-store' });
  const link = await stored.json();
  if (link.revoked) return reply({ error: 'This link was refunded.' }, 404, cors, { 'Cache-Control': 'no-store' });
  return reply({ ok: true, product: link.product }, 200, cors, { 'Cache-Control': 'public, max-age=60' });
}

/* ---------------- Paddle's webhook -----------------
   Paddle POSTs here when a transaction completes. There is no Origin to check (this is server to server, not a browser) and no
   Authorization header either — the Paddle-Signature header is the only thing that authenticates this request, so it is checked before
   anything else touches the body. Refunds and chargebacks arrive as adjustment.created / adjustment.updated: an approved full refund or
   a chargeback stops the order's links, and a refund Paddle rejects gives them back (see settleAdjustment). POST /orders/:token/refund
   (with ORDER_SECRET) is still there for fixing an order by hand. */
async function paddleWebhook(request, env, cors) {
  const raw = await request.text();                              // the signature covers these exact bytes: read before anything parses them
  if (!env.PADDLE_WEBHOOK_SECRET) return reply({ error: 'Not configured.' }, 501, cors);
  if (!(await verifyPaddleSignature(raw, request.headers.get('Paddle-Signature') || '', env.PADDLE_WEBHOOK_SECRET))) {
    return reply({ error: 'Bad signature.' }, 401, cors);
  }
  let event;
  try { event = JSON.parse(raw); } catch { return reply({ error: 'Bad payload.' }, 400, cors); }

  if (event && event.event_type === 'transaction.completed') {
    const data = event.data || {};
    let token = data.custom_data && data.custom_data.orderToken;
    if (!token && data.id) {                                      // fallback: look the transaction id up in the secondary index
      const stored = await env.BUCKET.get(txKey(data.id));
      if (stored) token = (await stored.json()).token;
    }
    if (token) {
      const { error } = await markPaid(env, token);
      if (error && error !== 'refunded') console.error('paddle webhook: could not mark paid', token, error);
    } else {
      console.error('paddle webhook: transaction.completed with no matching order', data.id);
    }
  }
  if (event && (event.event_type === 'adjustment.created' || event.event_type === 'adjustment.updated')) await settleAdjustment(env, event.data || {});
  // other event types (transaction.payment_failed, transaction.canceled, …) need no action here: the order just stays pending
  // and the buyer's own "still waiting" retry loop (see script.js) picks it up whenever it does get paid.
  return reply({ ok: true }, 200, cors);
}

// Paddle-Signature looks like "ts=<unix-seconds>;h1=<hex>" (more than one h1= can appear while a secret is being rotated — every one
// must be checked, since the request is valid if any of them matches, but there is only ever one secret configured here).
async function verifyPaddleSignature(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(';').map(p => p.split('=').map(s => s.trim())));
  const ts = Number(parts.ts);
  if (!ts || !parts.h1) return false;
  if (Math.abs(Date.now() / 1000 - ts) > WEBHOOK_TOLERANCE_S) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}:${rawBody}`));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
  return await safeEqual(hex, parts.h1);
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
