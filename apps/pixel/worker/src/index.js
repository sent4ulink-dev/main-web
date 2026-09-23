/* Pixel share API — a Cloudflare Worker, share content lives in R2 (see wrangler.toml).

   GET    /health                what it says
   POST   /shares/:id/ensure     create a share at a SPECIFIC id if it doesn't already exist (server-to-server only, see below)
   GET    /shares/:id            the public share content and edit metadata; self-heals against the order Worker on a miss
   PUT    /shares/:id            replace validated content, only during the edit window
   POST   /shares/:id/finalize   permanently finalize, only during the edit window

   There is no public studio and no password: an invitation only ever comes into
   existence because the sent4u order Worker calls POST /shares/:id/ensure server-to-
   server, gated by a shared secret, the moment it's paid for. Whoever holds the
   resulting share URL can edit or finalize it within its edit window — the link
   itself is the credential, same trust model as Pinky and WinXP. */
import { createStorage } from './storage.js';

const EDIT_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;
const JSON_TYPE = { 'Content-Type': 'application/json; charset=utf-8' };

// Plain-JS mirror of lib/share-content.ts's defaultShareContent — the same starter
// template every freshly-paid share begins from, before the buyer's first edit. Kept
// as a literal here since this Worker runs with no TS build step, so it can't import
// that file. Bump the comment if that file's shape changes.
function defaultShareContent() {
  return {
    networkLabel: 'LOVE NETWORK',
    invitationEyebrow: '1 NEW MESSAGE',
    invitationQuestion: 'Will you\ngo on a\ndate with me?',
    yesLabel: 'Yes',
    noLabel: 'No',
    noMessages: [
      'Are you sure?',
      'Really?',
      'Hmm, interesting...',
      'Signal must be lost :)',
      'Try the other button?',
      'My heart says ask again.',
    ],
    successTitle: "IT'S A DATE!",
    successAchievement: 'New achievement:',
    successPair: 'YOU + ME',
    successMessage: 'Best decision ever :)',
    continueLabel: 'CONTINUE',
    gamePromptEyebrow: 'A LITTLE GIFT FOR YOU',
    gamePromptTitle: 'BONUS LEVEL\nUNLOCKED',
    gamePromptMessage: 'One quick game before the date.\nSeven hearts. One cute pair.',
    gameStartLabel: 'PLAY',
    gameTitle: 'LOVE SNAKE',
    gameEyebrow: 'BONUS LEVEL / 01',
    gameMeterLabel: 'LOVE METER',
    gameReadyTitle: '7 HEARTS. ONE DATE.',
    gameReadyMessage: 'Collect hearts. Edges wrap around.',
    gameCompleteTitle: 'LEVEL CLEARED!',
    gameCompleteMessage: 'DATE UNLOCKED',
    gameGoal: 'COLLECT 7 HEARTS TO SET THE DATE ♥',
    snakeMessages: [
      'LOVE +1',
      'NICE!',
      "I'M SO LUCKY",
      'SO CUTE',
      'YESSS',
      'ALMOST THERE',
      'PERFECT PAIR',
    ],
    endingEyebrow: 'TOP ACHIEVEMENT: US',
    endingTitle: 'PERFECT PAIR',
    endingMessage: 'Found my way to you.',
    sender: 'Your person',
    notificationText: '1 message\nreceived',
    letterBody:
      "Hi :)\n\nThe date is set!\n\n{activity}\n{date} at {time}\n{place}\n\nSeven hearts collected, and I'd still pick you.\n\n{closing}",
    dateDetailsEyebrow: 'OUR CUTE LITTLE PLAN',
    dateStatus: 'CONFIRMED ♥',
    dateSignoff: "CAN'T WAIT ♥",
    shareImageLabel: 'SAVE IMAGE',
    dateTitle: 'Our date',
    dateMessage: "Can't wait for our time together.",
    smsClosing: "Can't wait to see you. <3",
    activities: [
      { id: 'activity-1', label: 'Coffee and a chat', places: ['A cozy café', 'Your favorite coffee shop', 'Somewhere new'] },
      { id: 'activity-2', label: 'Dinner together', places: ['Our favorite restaurant', 'A cozy spot downtown', 'Dinner at home'] },
      { id: 'activity-3', label: 'Watch a movie together', places: ['The movie theater', 'A movie night at home', 'Your favorite theater'] },
      { id: 'activity-4', label: 'Walk and watch the sunset', places: ['By the river', 'A quiet park', 'Our favorite walking spot'] },
      { id: 'activity-5', label: 'Get dessert', places: ['The ice cream place', 'A little bakery', 'Your favorite dessert spot'] },
    ],
  };
}

const contentKeys = [
  'networkLabel',
  'invitationEyebrow',
  'invitationQuestion',
  'yesLabel',
  'noLabel',
  'successTitle',
  'successAchievement',
  'successPair',
  'successMessage',
  'continueLabel',
  'gamePromptEyebrow',
  'gamePromptTitle',
  'gamePromptMessage',
  'gameStartLabel',
  'gameTitle',
  'gameEyebrow',
  'gameMeterLabel',
  'gameReadyTitle',
  'gameReadyMessage',
  'gameCompleteTitle',
  'gameCompleteMessage',
  'gameGoal',
  'endingEyebrow',
  'endingTitle',
  'endingMessage',
  'sender',
  'notificationText',
  'letterBody',
  'dateDetailsEyebrow',
  'dateStatus',
  'dateSignoff',
  'shareImageLabel',
  'dateTitle',
  'dateMessage',
  'smsClosing',
];
const limits = [
  30, 40, 90, 24, 24, 50, 50, 40, 90, 30, 70, 70, 180, 30, 50, 50, 40, 60, 100,
  60, 70, 100, 60, 50, 100, 40, 50, 800, 70, 50, 70, 40, 60, 180, 120,
];

function cleanContent(value) {
  if (!value || typeof value !== 'object') return null;
  const content = {};
  for (let index = 0; index < contentKeys.length; index++) {
    const key = contentKeys[index];
    const text = value[key];
    if (typeof text !== 'string' || !text.trim() || text.length > limits[index])
      return null;
    content[key] = text.trim();
  }
  for (const [key, length] of [
    ['noMessages', 6],
    ['snakeMessages', 7],
  ]) {
    const messages = value[key];
    if (
      !Array.isArray(messages) ||
      messages.length !== length ||
      messages.some(
        (message) =>
          typeof message !== 'string' || !message.trim() || message.length > 90,
      )
    )
      return null;
    content[key] = messages.map((message) => message.trim());
  }
  if (
    !Array.isArray(value.activities) ||
    value.activities.length < 1 ||
    value.activities.length > 10
  )
    return null;
  content.activities = [];
  for (const item of value.activities) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,40}$/.test(item.id) ||
      typeof item.label !== 'string' ||
      !item.label.trim() ||
      item.label.length > 70 ||
      !Array.isArray(item.places) ||
      item.places.length < 1 ||
      item.places.length > 10
    )
      return null;
    const places = item.places.map((place) =>
      typeof place === 'string' ? place.trim() : '',
    );
    if (places.some((place) => !place || place.length > 70)) return null;
    content.activities.push({ id: item.id, label: item.label.trim(), places });
  }
  return content;
}

function editable(record) {
  return !record.finalized && new Date(record.editUntil).getTime() > Date.now();
}

// The sent4u order Worker mints 128-bit random tokens (22-character base64url); "test"
// is reserved for the demo and is never a real id.
function validId(id) {
  return /^[A-Za-z0-9_-]{6,40}$/.test(id) && id !== 'test';
}

function reply(body, status, cors, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_TYPE, ...cors, ...extra } });
}

function allowedOrigins(env) {
  return String(env.CORS_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
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

// Gates POST /shares/:id/ensure — the endpoint the sent4u order Worker calls,
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
async function selfHealShare(id, storage, env) {
  const ordersApiBase = String(env.ORDERS_API_BASE || '').replace(/\/$/, '');
  if (!ordersApiBase) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${ordersApiBase}/links/${encodeURIComponent(id)}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const { ok, product } = await r.json();
    if (!ok || product !== 'pixel') return null; // exists, but isn't a Pixel link — not ours to heal
  } catch (err) {
    clearTimeout(timer);
    console.warn(`Self-heal verify failed for ${id}:`, err.message);
    return null;
  }
  const createdAt = new Date();
  const record = {
    id,
    content: defaultShareContent(),
    createdAt: createdAt.toISOString(),
    editUntil: new Date(createdAt.getTime() + EDIT_WINDOW_MS).toISOString(),
    finalized: false,
  };
  await storage.put(id, record);
  console.log(`Self-healed ${id} (verified with the order Worker, was never created here)`);
  return record;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const storage = createStorage(env);
    try {
      if (url.pathname === '/health' && request.method === 'GET') return reply({ ok: true }, 200, cors);

      const ensure = url.pathname.match(/^\/shares\/([A-Za-z0-9_-]+)\/ensure$/);
      if (ensure && request.method === 'POST') {
        if (!createSecretOk(request, env)) return reply({ error: 'forbidden' }, 403, cors);
        const id = ensure[1];
        if (!validId(id)) return reply({ error: 'Invalid id.' }, 422, cors);
        const existing = await storage.get(id);
        if (existing) return reply({ ok: true, existed: true }, 200, cors);
        const createdAt = new Date();
        const record = {
          id,
          content: defaultShareContent(),
          createdAt: createdAt.toISOString(),
          editUntil: new Date(createdAt.getTime() + EDIT_WINDOW_MS).toISOString(),
          finalized: false,
        };
        await storage.put(id, record);
        return reply({ ok: true, existed: false }, 201, cors);
      }

      const finalize = url.pathname.match(/^\/shares\/([A-Za-z0-9_-]+)\/finalize$/);
      if (finalize && request.method === 'POST') {
        if (!validId(finalize[1])) return reply({ error: 'Share not found.' }, 404, cors);
        const record = await storage.get(finalize[1]);
        if (!record) return reply({ error: 'Share not found.' }, 404, cors);
        if (!editable(record)) return reply({ error: 'Share is locked.' }, 423, cors);
        const updated = { ...record, finalized: true, finalizedAt: new Date().toISOString() };
        await storage.put(record.id, updated);
        return reply(updated, 200, cors);
      }

      const share = url.pathname.match(/^\/shares\/([A-Za-z0-9_-]+)$/);
      if (share && request.method === 'GET') {
        if (!validId(share[1])) return reply({ error: 'Share not found.' }, 404, cors);
        let record = await storage.get(share[1]);
        if (!record) record = await selfHealShare(share[1], storage, env);
        if (!record) return reply({ error: 'Share not found.' }, 404, cors);
        return reply(record, 200, cors);
      }
      if (share && request.method === 'PUT') {
        if (!validId(share[1])) return reply({ error: 'Share not found.' }, 404, cors);
        const record = await storage.get(share[1]);
        if (!record) return reply({ error: 'Share not found.' }, 404, cors);
        if (!editable(record)) return reply({ error: 'Share is locked.' }, 423, cors);
        const body = await request.json().catch(() => null);
        const content = cleanContent(body?.content);
        if (!content) return reply({ error: 'Invalid content.' }, 400, cors);
        const updated = { ...record, content, updatedAt: new Date().toISOString() };
        await storage.put(record.id, updated);
        return reply(updated, 200, cors);
      }

      return reply({ error: 'Not found.' }, 404, cors);
    } catch (err) {
      console.error(err);
      return reply({ error: 'Internal server error.' }, 500, cors);
    }
  },
};
