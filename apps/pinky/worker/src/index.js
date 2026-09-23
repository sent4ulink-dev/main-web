/* Pinky share API — a Cloudflare Worker, share content lives in R2 (see wrangler.toml).

   GET    /health                     what it says
   POST   /api/shares/:id/ensure      create a share at a SPECIFIC id if it doesn't already exist (server-to-server only, see below)
   GET    /api/shares/:id             the public share content and edit metadata; self-heals against the order Worker on a miss
   PUT    /api/shares/:id             replace validated content, only during the edit window
   POST   /api/shares/:id/finalize    permanently finalize, only during the edit window
   GET    /api/maps/resolve           resolves a pasted Google Maps link to name/rating/hours/photo (needs GOOGLE_PLACES_API_KEY)
   GET    /api/maps/photo             proxies a Place Photo so the Google API key never reaches the browser

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

function reply(body, status, cors, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_TYPE, ...cors, ...extra } });
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
function createSecretOk(request, env) {
  if (!env.SHARE_CREATE_SECRET) return true; // not configured yet — dev convenience only
  return request.headers.get('x-date-create-secret') === env.SHARE_CREATE_SECRET;
}

// Self-heal: if a share isn't in storage yet, ask the sent4u order Worker whether this
// id was ever actually issued (paid for, and for this product) before creating it here.
// Covers the gap where the background /ensure call after a purchase is still mid-retry
// when the buyer clicks the link; without this a link nobody did anything wrong to just
// 404s forever. A random unpaid id still gets rejected, since the Worker only confirms
// ids that exist in a real, unrevoked order.
async function selfHealShare(id, bucket, env) {
  const ordersApiBase = String(env.ORDERS_API_BASE || '').replace(/\/$/, '');
  if (!ordersApiBase) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${ordersApiBase}/links/${encodeURIComponent(id)}`, { signal: controller.signal });
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

// Today's line out of Google's Mon-first weekday_text array, or a condensed "(Daily)"
// form when every day reads the same.
function formatHours(openingHours) {
  const weekdayText = openingHours?.weekday_text;
  if (!Array.isArray(weekdayText) || weekdayText.length !== 7) return undefined;
  const timesOnly = weekdayText.map((line) => line.replace(/^[^:]+:\s*/, ''));
  if (timesOnly.every((t) => t === timesOnly[0])) return `${timesOnly[0]} (Daily)`;
  const todayIndex = (new Date().getDay() + 6) % 7; // JS: 0=Sun; Google's array: 0=Mon
  return `${timesOnly[todayIndex]} (Today)`;
}

// Resolves a pasted Google Maps link to the same rating/reviews/hours/photo you'd see
// searching the place on Google — via the official Places API, not by scraping the page.
async function resolveMaps(request, env, cors) {
  const mapsLink = new URL(request.url).searchParams.get('url');
  if (!mapsLink) return reply({ error: 'missing_url' }, 400, cors);
  if (!env.GOOGLE_PLACES_API_KEY) return reply({ error: 'not_configured' }, 503, cors);
  try {
    // Short links redirect to one of two shapes depending on where they were
    // shared from: maps.app.goo.gl/... (from the Maps app) lands on a real
    // /maps/place/<name>/@<lat>,<lng>,<zoom>z URL; share.google/... (from a
    // Search business panel) lands on a plain google.com/search?q=<name>&...
    // page instead — no /maps/place/ path at all, just the name in `q`.
    const resolved = await fetch(mapsLink, { redirect: 'follow' });
    const finalUrl = resolved.url || mapsLink;
    const parsedUrl = new URL(finalUrl);

    const placeMatch = finalUrl.match(/\/maps\/place\/([^/@]+)/);
    const name = placeMatch
      ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
      : parsedUrl.searchParams.get('q');
    if (!name) return reply({ error: 'unrecognized_link' }, 422, cors);
    const coordMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

    // Text Search instead of Find Place From Text — for a share.google link there's no
    // @lat,lng to bias with (unlike maps.app.goo.gl), so a short, generic name ("56°
    // Coffee Bar") can otherwise match a same-ish-named place anywhere in the world
    // (tried the API's `region` bias param first — it sometimes zeroed out real
    // results entirely instead of just deprioritizing, so dropped it). Baking a
    // location hint straight into the query text works far better in practice.
    // This app's whole audience is Mongolia, so the hint is Ulaanbaatar — falls
    // back to the bare name if the hinted search comes up empty, since not every
    // place someone looks up is actually there.
    async function textSearch(query) {
      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
      url.searchParams.set('query', query);
      if (coordMatch) {
        url.searchParams.set('location', `${coordMatch[1]},${coordMatch[2]}`);
        url.searchParams.set('radius', '10000');
      }
      url.searchParams.set('key', env.GOOGLE_PLACES_API_KEY);
      return fetch(url).then((r) => r.json());
    }

    const hintedQuery = coordMatch ? name : `${name}, Ulaanbaatar, Mongolia`;
    let findData = await textSearch(hintedQuery);
    if (!findData.results?.[0]?.place_id && findData.status === 'ZERO_RESULTS' && hintedQuery !== name) {
      findData = await textSearch(name);
    }
    const placeId = findData.results?.[0]?.place_id;
    if (!placeId) {
      // findData.status is Google's own reason (ZERO_RESULTS, REQUEST_DENIED,
      // OVER_QUERY_LIMIT, INVALID_REQUEST, ...) — surfaced here since otherwise
      // this is the single hardest failure to diagnose from the outside.
      console.error('Text Search returned no place_id:', findData.status, findData.error_message, 'query:', name);
      return reply(
        { error: 'place_not_found', googleStatus: findData.status, googleMessage: findData.error_message, debugQuery: name },
        404,
        cors,
      );
    }

    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detailsUrl.searchParams.set('place_id', placeId);
    detailsUrl.searchParams.set('fields', 'name,rating,user_ratings_total,opening_hours,photos');
    detailsUrl.searchParams.set('key', env.GOOGLE_PLACES_API_KEY);
    const detailsData = await fetch(detailsUrl).then((r) => r.json());
    const place = detailsData.result;
    if (!place) {
      console.error('Place Details returned no result:', detailsData.status, detailsData.error_message);
      return reply(
        { error: 'place_not_found', googleStatus: detailsData.status, googleMessage: detailsData.error_message },
        404,
        cors,
      );
    }

    const photoRef = place.photos?.[0]?.photo_reference;
    return reply(
      {
        name: place.name,
        rating: place.rating != null ? String(place.rating) : undefined,
        reviewCount: place.user_ratings_total != null ? `${place.user_ratings_total.toLocaleString()}+ reviews` : undefined,
        hours: formatHours(place.opening_hours),
        // Relative path — the frontend prefixes it with its own API base (same as every
        // other endpoint here) so the key-bearing Google URL never reaches the browser.
        photoUrl: photoRef ? `/api/maps/photo?ref=${encodeURIComponent(photoRef)}` : undefined,
      },
      200,
      cors,
    );
  } catch (err) {
    console.error('Maps resolve failed:', err);
    return reply({ error: 'resolve_failed' }, 502, cors);
  }
}

// Proxies a Place Photo through our own Worker so the API key never appears in an <img src>.
async function mapsPhoto(request, env, cors) {
  const ref = new URL(request.url).searchParams.get('ref');
  if (!ref) return new Response(null, { status: 400, headers: cors });
  if (!env.GOOGLE_PLACES_API_KEY) return new Response(null, { status: 503, headers: cors });
  try {
    const photoUrl = new URL('https://maps.googleapis.com/maps/api/place/photo');
    photoUrl.searchParams.set('maxwidth', '800');
    photoUrl.searchParams.set('photo_reference', ref);
    photoUrl.searchParams.set('key', env.GOOGLE_PLACES_API_KEY);
    const photoResp = await fetch(photoUrl);
    if (!photoResp.ok) return new Response(null, { status: 502, headers: cors });
    return new Response(photoResp.body, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': photoResp.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('Maps photo proxy failed:', err);
    return new Response(null, { status: 502, headers: cors });
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const bucket = env.BUCKET;
    try {
      if (url.pathname === '/health' && request.method === 'GET') return reply({ ok: true }, 200, cors);
      if (url.pathname === '/api/maps/resolve' && request.method === 'GET') return await resolveMaps(request, env, cors);
      if (url.pathname === '/api/maps/photo' && request.method === 'GET') return await mapsPhoto(request, env, cors);

      const ensure = url.pathname.match(/^\/api\/shares\/([^/]+)\/ensure$/);
      if (ensure && request.method === 'POST') {
        if (!createSecretOk(request, env)) return reply({ error: 'forbidden' }, 403, cors);
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
        const body = await request.json().catch(() => null);
        const content = body?.content;
        if (!content || typeof content !== 'object') return reply({ error: 'invalid_content' }, 400, cors);
        entry.content = content;
        await putShare(bucket, share[1], entry);
        return reply({ ok: true }, 200, cors);
      }

      return reply({ error: 'not_found' }, 404, cors);
    } catch (err) {
      console.error(`${request.method} ${url.pathname} failed:`, err);
      return reply({ error: 'storage_error', message: err.message }, 500, cors);
    }
  },
};
