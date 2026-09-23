import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getShare, putShare, usingR2 } from './storage.js';

const EDIT_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;
// Server-side only — never sent to the browser. Powers "Fetch from Maps" in the
// Restaurant editor. Unset simply disables that feature (the manual fields still work).
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Gates POST /api/shares/:id/ensure — the endpoint the sent4u order Worker calls,
// server-to-server, the moment a paid order generates this id (see worker/src/index.js's
// generateLinks). Never called from a browser: there is no public studio any more, no
// password screen, no way to mint a share id from this app at all — a real invitation
// only ever exists because it was paid for, and a static shared secret here is what
// proves the caller really is that Worker and not a random script guessing ids.
const SHARE_CREATE_SECRET = process.env.SHARE_CREATE_SECRET;
function requireCreateSecret(req, res, next) {
  if (!SHARE_CREATE_SECRET) return next(); // not configured yet — dev convenience only
  if (req.get('x-date-create-secret') !== SHARE_CREATE_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

// Plain-JS mirror of src/utils/demoShare.ts's getDemoContent() — the same starter
// template every freshly-paid share begins from, before the buyer's first edit. Kept
// as a literal here since this server runs directly under Node with no TS build step,
// so it can't import that file. Bump the comment if that file's shape changes.
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
      'YES is the only answer! 💖'
    ],
    celebrationWord: 'Monica',
    activities: [
      { id: 'a1', emoji: '🌅', text: 'Sunset Picnic in the Park' },
      { id: 'a2', emoji: '🎬', text: 'VIP Cinema & Cozy Lounge' },
      { id: 'a3', emoji: '🍷', text: 'Wine Tasting & Candlelit Jazz' }
    ],
    restaurants: [
      {
        id: 'r1',
        name: "L'Amore Sky Rooftop & Italian Bistro",
        mapsLink: 'https://www.google.com/maps/search/?api=1&query=L+Amore+Sky+Rooftop+Italian+Bistro',
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
        rating: '4.9',
        reviewCount: '1,840+ reviews',
        hours: '5:00 PM – 11:30 PM (Daily)'
      },
      {
        id: 'r2',
        name: 'Sakura Garden Omakase & Cocktail Lounge',
        mapsLink: 'https://www.google.com/maps/search/?api=1&query=Sakura+Garden+Omakase+Cocktail+Lounge',
        imageUrl: 'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?auto=format&fit=crop&w=800&q=80',
        rating: '4.9',
        reviewCount: '2,120+ reviews',
        hours: '5:30 PM – 12:00 AM (Daily)'
      }
    ],
    musicUrl: ''
  };
}

// Self-heal: if a share isn't in storage yet, ask the sent4u order Worker whether this
// id was ever actually issued (paid for, and for this product) before creating it here.
// Covers the gap where the background /ensure call after a purchase is still mid-retry
// (cold Render backend) — or has exhausted its retries — when the buyer clicks the
// link; without this a link nobody did anything wrong to just 404s forever. A random
// unpaid id still gets rejected, since the Worker only confirms ids that exist in a
// real, unrevoked order.
const ORDERS_API_BASE = (process.env.ORDERS_API_BASE ?? '').replace(/\/$/, '');
async function selfHealShare(id) {
  if (!ORDERS_API_BASE) return null; // not configured — self-heal simply can't run; /ensure remains the normal path
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const r = await fetch(`${ORDERS_API_BASE}/links/${encodeURIComponent(id)}`, { signal: controller.signal });
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
    createdAt: Date.now()
  };
  await putShare(id, entry);
  console.log(`Self-healed ${id} (verified with the order Worker, was never created here)`);
  return entry;
}

const app = express();
// Frontend (Cloudflare) and backend (Render) are on different origins in production —
// set CORS_ORIGIN to the deployed frontend's exact origin; defaults to allow-all for local dev.
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Express 4 doesn't catch rejections thrown inside an async route handler — without
// this, a storage error (bad R2 config, R2 down, ...) just hangs the request until
// Render's own proxy times out, which shows up in the browser as a bare "Failed to
// fetch"/no-CORS-header error with zero indication of what actually went wrong.
function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error(`${req.method} ${req.path} failed:`, err);
      if (!res.headersSent) res.status(500).json({ error: 'storage_error', message: err.message });
    });
  };
}

// POST /api/shares/:id/ensure — create a share at a SPECIFIC id if it doesn't
// already exist (no-op otherwise, never overwrites existing content). This is what
// the sent4u order Worker calls right after a purchase generates this id, so it's
// already real by the time the buyer opens it. Content starts from the same default
// template above — the buyer edits it into their actual invitation from the link.
// This is the *only* way a share ever comes into existence: there is no public,
// unauthenticated "create a share" endpoint any more.
app.post(
  '/api/shares/:id/ensure',
  requireCreateSecret,
  asyncRoute(async (req, res) => {
    const id = req.params.id;
    const existing = await getShare(id);
    if (existing) return res.json({ ok: true, existed: true });

    const editUntil = Date.now() + EDIT_WINDOW_MS;
    await putShare(id, { content: defaultShareContent(), editUntil, finalized: false, createdAt: Date.now() });
    res.json({ ok: true, existed: false });
  })
);

app.get(
  '/api/shares/:id',
  asyncRoute(async (req, res) => {
    let entry = await getShare(req.params.id);
    if (!entry) entry = await selfHealShare(req.params.id);
    if (!entry) return res.status(404).json({ error: 'not_found' });
    res.json({ content: entry.content, editUntil: entry.editUntil, finalized: entry.finalized });
  })
);

app.put(
  '/api/shares/:id',
  asyncRoute(async (req, res) => {
    const entry = await getShare(req.params.id);
    if (!entry) return res.status(404).json({ error: 'not_found' });
    if (entry.finalized) return res.status(403).json({ error: 'finalized' });
    if (Date.now() > entry.editUntil) return res.status(403).json({ error: 'edit_window_closed' });
    const content = req.body?.content;
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'invalid_content' });
    }
    entry.content = content;
    await putShare(req.params.id, entry);
    res.json({ ok: true });
  })
);

app.post(
  '/api/shares/:id/finalize',
  asyncRoute(async (req, res) => {
    const entry = await getShare(req.params.id);
    if (!entry) return res.status(404).json({ error: 'not_found' });
    entry.finalized = true;
    await putShare(req.params.id, entry);
    res.json({ ok: true });
  })
);

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
app.get('/api/maps/resolve', async (req, res) => {
  const mapsLink = req.query.url;
  if (!mapsLink || typeof mapsLink !== 'string') {
    return res.status(400).json({ error: 'missing_url' });
  }
  if (!GOOGLE_PLACES_API_KEY) {
    return res.status(503).json({ error: 'not_configured' });
  }
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
    if (!name) return res.status(422).json({ error: 'unrecognized_link' });
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
      url.searchParams.set('key', GOOGLE_PLACES_API_KEY);
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
      return res.status(404).json({
        error: 'place_not_found',
        googleStatus: findData.status,
        googleMessage: findData.error_message,
        debugQuery: name
      });
    }

    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detailsUrl.searchParams.set('place_id', placeId);
    detailsUrl.searchParams.set('fields', 'name,rating,user_ratings_total,opening_hours,photos');
    detailsUrl.searchParams.set('key', GOOGLE_PLACES_API_KEY);
    const detailsData = await fetch(detailsUrl).then((r) => r.json());
    const place = detailsData.result;
    if (!place) {
      console.error('Place Details returned no result:', detailsData.status, detailsData.error_message);
      return res
        .status(404)
        .json({ error: 'place_not_found', googleStatus: detailsData.status, googleMessage: detailsData.error_message });
    }

    const photoRef = place.photos?.[0]?.photo_reference;
    res.json({
      name: place.name,
      rating: place.rating != null ? String(place.rating) : undefined,
      reviewCount:
        place.user_ratings_total != null ? `${place.user_ratings_total.toLocaleString()}+ reviews` : undefined,
      hours: formatHours(place.opening_hours),
      // Relative path — the frontend prefixes it with its own API base (same as every
      // other endpoint here) so the key-bearing Google URL never reaches the browser.
      photoUrl: photoRef ? `/api/maps/photo?ref=${encodeURIComponent(photoRef)}` : undefined
    });
  } catch (err) {
    console.error('Maps resolve failed:', err);
    res.status(502).json({ error: 'resolve_failed' });
  }
});

// Proxies a Place Photo through our own server so the API key never appears in an <img src>.
app.get('/api/maps/photo', async (req, res) => {
  const ref = req.query.ref;
  if (!ref || typeof ref !== 'string') return res.status(400).end();
  if (!GOOGLE_PLACES_API_KEY) return res.status(503).end();
  try {
    const photoUrl = new URL('https://maps.googleapis.com/maps/api/place/photo');
    photoUrl.searchParams.set('maxwidth', '800');
    photoUrl.searchParams.set('photo_reference', ref);
    photoUrl.searchParams.set('key', GOOGLE_PLACES_API_KEY);
    const photoResp = await fetch(photoUrl);
    if (!photoResp.ok) return res.status(502).end();
    res.set('Content-Type', photoResp.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(await photoResp.arrayBuffer()));
  } catch (err) {
    console.error('Maps photo proxy failed:', err);
    res.status(502).end();
  }
});

// Render injects PORT automatically in production; API_PORT is the local-dev override.
const PORT = process.env.PORT || process.env.API_PORT || 8787;
app.listen(PORT, () => {
  console.log(`Share API listening on :${PORT}`);
  console.log(`Share storage: ${usingR2 ? `R2 (bucket "${process.env.R2_BUCKET_NAME}")` : 'local file (server/data/shares.json)'}`);
  console.log(`Fulfillment /ensure: ${SHARE_CREATE_SECRET ? 'secret-gated' : 'OPEN (SHARE_CREATE_SECRET unset)'}`);
});
