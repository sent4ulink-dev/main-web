/* Pinky share API — a Cloudflare Worker, share content lives in R2 (see wrangler.toml).

   GET    /health                     what it says
   POST   /api/shares/:id/ensure      create a share at a SPECIFIC id if it doesn't already exist (server-to-server only, see below)
   GET    /api/shares/:id             the public share content and edit metadata; self-heals against the order Worker on a miss
   PUT    /api/shares/:id             replace validated content, only during the edit window
   POST   /api/shares/:id/finalize    permanently finalize, only during the edit window

   There is no public studio and no password: an invitation only ever comes into
   existence because the sent4u order Worker calls POST /api/shares/:id/ensure
   server-to-server, gated by a shared secret, the moment it's paid for. Whoever holds
   the resulting share URL can edit or finalize it within its edit window — the link
   itself is the credential, same trust model as Pixel and WinXP. */
import { getShare, putShare } from './storage.js';

const EDIT_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;
const JSON_TYPE = { 'Content-Type': 'application/json; charset=utf-8' };

// Same starter template as src/utils/demoShare.ts's getDemoContent() — the same
// content every freshly-paid share begins from, before the buyer's first edit. Kept
// as a literal here since this Worker runs with no TS build step, so it can't import
// that file. Bump the comment if that file's shape changes.
function defaultShareContent() {
  return {
    question: 'Will you go on a date with me?',
    yesLabel: 'Yes',
    noLabel: 'No',
    noPleaTexts: [
      'Are you sure? 🥺',
      'Really sure? 💔',
      'Think again! 🧸',
      'Look how big YES is! 👉',
      "Don't break my heart! 🌹",
      'What if I bring chocolates? 🍫',
      'Pwetty please? ✨',
      'Last chance to reconsider! 💌',
      "You don't mean no... right? 🥹",
      'YES is the only answer! 💖',
    ],
    celebrationWord: 'Monica',
    activities: [
      { id: 'a1', emoji: '🌅', text: 'Sunset Picnic in the Park' },
      { id: 'a2', emoji: '🎬', text: 'VIP Cinema & Cozy Lounge' },
      { id: 'a3', emoji: '🍷', text: 'Wine Tasting & Candlelit Jazz' },
    ],
    restaurants: [
      {
        id: 'r1',
        name: "L'Amore Sky Rooftop & Italian Bistro",
        mapsLink: 'https://www.google.com/maps/search/?api=1&query=L+Amore+Sky+Rooftop+Italian+Bistro',
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
        rating: '4.9',
        reviewCount: '1,840+ reviews',
        hours: '5:00 PM – 11:30 PM (Daily)',
      },
      {
        id: 'r2',
        name: 'Sakura Garden Omakase & Cocktail Lounge',
        mapsLink: 'https://www.google.com/maps/search/?api=1&query=Sakura+Garden+Omakase+Cocktail+Lounge',
        imageUrl: 'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?auto=format&fit=crop&w=800&q=80',
        rating: '4.9',
        reviewCount: '2,120+ reviews',
        hours: '5:30 PM – 12:00 AM (Daily)',
      },
    ],
    musicUrl: '',
  };
}

// A saved plan is a few KB of text (pictures are links, not data); anything far bigger is not a plan.
const MAX_CONTENT_CHARS = 64 * 1024;
// No value in a plan may be a javascript:, data: or vbscript: address: the page opens some of them (the map link) as they are.
function hasScriptUrl(value) {
  if (typeof value === 'string') return /^(javascript|data|vbscript):/i.test(value.replace(/[\u0000-\u0020\u007f-\u00a0]/g, ''));
  if (value && typeof value === 'object') return Object.values(value).some(hasScriptUrl);
  return false;
}

function reply(body, status, cors, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_TYPE, ...cors, ...extra } });
}

// Can this YouTube song play inside the card (the step editor's song box)? Its owner may have closed it to other
// sites. YouTube's own oEmbed answers 401/403 for a song closed to embedding and 400/404 for one that is missing or
// private; anything else: can't tell, so it isn't stopped.
async function youtubeCheck(id, cors) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 8000);
  const day = { 'Cache-Control': 'public, max-age=86400' };
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { signal: stop.signal });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      return reply({ ok: true, title: String(d.title || '').slice(0, 200) }, 200, cors, day);
    }
    if (r.status === 401 || r.status === 403) return reply({ ok: false, reason: 'blocked' }, 200, cors, day);
    if (r.status === 400 || r.status === 404) return reply({ ok: false, reason: 'missing' }, 200, cors, day);
  } catch {
    // no answer
  } finally {
    clearTimeout(timer);
  }
  return reply({ ok: true }, 200, cors);
}

function allowedOrigins(env) {
  return String(env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigins(env);
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-date-create-secret',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (!allowed.length) h['Access-Control-Allow-Origin'] = '*';
  else if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

// Gates POST /api/shares/:id/ensure — the endpoint the sent4u order Worker calls,
// server-to-server, the moment a paid order generates this id. Never called from a
// browser: there is no public studio, no password, no way to mint a share id from
// this app at all — a real invitation only ever exists because it was paid for.
async function createSecretOk(request, env) {
  if (!env.SHARE_CREATE_SECRET) return false; // not configured: nobody may create a share this way
  // compared as digests, so the time taken says nothing about how much of a guess was right
  const digest = async (v) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  const [a, b] = await Promise.all([digest(request.headers.get('x-date-create-secret') || ''), digest(env.SHARE_CREATE_SECRET)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Self-heal: if a share isn't in storage yet, ask the sent4u order Worker whether this
// id was ever actually issued (paid for, and for this product) before creating it here.
// Covers the gap where the background /ensure call after a purchase is still mid-retry
// when the buyer clicks the link; without this a link nobody did anything wrong to just
// 404s forever. A random unpaid id still gets rejected, since the Worker only confirms
// ids that exist in a real, unrevoked order.
async function selfHealShare(id, bucket, env) {
  const ordersApiBase = String(env.ORDERS_API_BASE || '').replace(/\/$/, '');
  if (!ordersApiBase && !env.ORDERS) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await (env.ORDERS ? env.ORDERS.fetch(`https://orders/links/${encodeURIComponent(id)}`, { signal: controller.signal }) : fetch(`${ordersApiBase}/links/${encodeURIComponent(id)}`, { signal: controller.signal }));
    clearTimeout(timer);
    if (!r.ok) return null;
    const { ok, product } = await r.json();
    if (!ok || product !== 'pinky') return null; // exists, but isn't a Pinky link — not ours to heal
  } catch (err) {
    clearTimeout(timer);
    console.warn(`Self-heal verify failed for ${id}:`, err.message);
    return null;
  }
  const entry = {
    content: defaultShareContent(),
    editUntil: Date.now() + EDIT_WINDOW_MS,
    finalized: false,
    createdAt: Date.now(),
  };
  await putShare(bucket, id, entry);
  console.log(`Self-healed ${id} (verified with the order Worker, was never created here)`);
  return entry;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const bucket = env.BUCKET;
    try {
      if (url.pathname === '/health' && request.method === 'GET') return reply({ ok: true }, 200, cors);

      const ensure = url.pathname.match(/^\/api\/shares\/([^/]+)\/ensure$/);
      if (ensure && request.method === 'POST') {
        if (!(await createSecretOk(request, env))) return reply({ error: 'forbidden' }, 403, cors);
        const id = ensure[1];
        const existing = await getShare(bucket, id);
        if (existing) return reply({ ok: true, existed: true }, 200, cors);
        const editUntil = Date.now() + EDIT_WINDOW_MS;
        await putShare(bucket, id, { content: defaultShareContent(), editUntil, finalized: false, createdAt: Date.now() });
        return reply({ ok: true, existed: false }, 200, cors);
      }

      const finalize = url.pathname.match(/^\/api\/shares\/([^/]+)\/finalize$/);
      if (finalize && request.method === 'POST') {
        const entry = await getShare(bucket, finalize[1]);
        if (!entry) return reply({ error: 'not_found' }, 404, cors);
        entry.finalized = true;
        await putShare(bucket, finalize[1], entry);
        return reply({ ok: true }, 200, cors);
      }

      const share = url.pathname.match(/^\/api\/shares\/([^/]+)$/);
      if (share && request.method === 'GET') {
        let entry = await getShare(bucket, share[1]);
        if (!entry) entry = await selfHealShare(share[1], bucket, env);
        if (!entry) return reply({ error: 'not_found' }, 404, cors);
        return reply({ content: entry.content, editUntil: entry.editUntil, finalized: entry.finalized }, 200, cors);
      }
      if (share && request.method === 'PUT') {
        const entry = await getShare(bucket, share[1]);
        if (!entry) return reply({ error: 'not_found' }, 404, cors);
        if (entry.finalized) return reply({ error: 'finalized' }, 403, cors);
        if (Date.now() > entry.editUntil) return reply({ error: 'edit_window_closed' }, 403, cors);
        const raw = await request.text();
        if (raw.length > MAX_CONTENT_CHARS) return reply({ error: 'too_large' }, 413, cors);
        let body = null;
        try { body = JSON.parse(raw); } catch { /* invalid below */ }
        const content = body?.content;
        if (!content || typeof content !== 'object' || Array.isArray(content) || hasScriptUrl(content)) return reply({ error: 'invalid_content' }, 400, cors);
        entry.content = content;
        await putShare(bucket, share[1], entry);
        return reply({ ok: true }, 200, cors);
      }

      const yt = url.pathname.match(/^\/api\/yt-check\/([A-Za-z0-9_-]{11})$/);
      if (yt && request.method === 'GET') return youtubeCheck(yt[1], cors);

      return reply({ error: 'not_found' }, 404, cors);
    } catch (err) {
      console.error(`${request.method} ${url.pathname} failed:`, err);
      return reply({ error: 'storage_error' }, 500, cors);
    }
  },
};
