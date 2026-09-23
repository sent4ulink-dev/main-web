import cors from 'cors';
import express from 'express';
import { createStorage } from './storage.mjs';

const app = express();
const storage = createStorage();
const port = Number(process.env.PORT || 8787);
const editWindowMs = 5 * 24 * 60 * 60 * 1000;

app.disable('x-powered-by');
app.use(
  cors({
    origin(origin, callback) {
      const allowed = (process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (!origin || allowed.length === 0 || allowed.includes(origin))
        return callback(null, true);
      callback(new Error('Origin is not allowed.'));
    },
  }),
);
app.use(express.json({ limit: '32kb' }));

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

// Plain-JS mirror of lib/share-content.ts's defaultShareContent — the same starter
// template every freshly-paid share begins from, before the buyer's first edit. Kept
// as a literal here since this server runs directly under Node with no TS build step,
// so it can't import that file. Bump the comment if that file's shape changes.
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

function publicRecord(record) {
  return record;
}

// Gates POST /shares/:id/ensure — the endpoint the sent4u order Worker calls,
// server-to-server, the moment a paid order generates this id (see
// worker/src/index.js's generateLinks). Never called from a browser: there is no
// public studio any more, no password, no way to mint a share id from this app at
// all — a real invitation only ever exists because it was paid for.
const SHARE_CREATE_SECRET = process.env.SHARE_CREATE_SECRET;
function requireCreateSecret(request, response, next) {
  if (!SHARE_CREATE_SECRET) return next(); // not configured yet — dev convenience only
  if (request.get('x-date-create-secret') !== SHARE_CREATE_SECRET)
    return response.status(403).json({ error: 'forbidden' });
  next();
}

// Self-heal: if a share isn't in storage yet, ask the sent4u order Worker whether this
// id was ever actually issued (paid for, and for this product) before creating it here.
// Covers the gap where the background /ensure call after a purchase is still mid-retry
// when the buyer clicks the link; without this a link nobody did anything wrong to just
// 404s forever. A random unpaid id still gets rejected, since the Worker only confirms
// ids that exist in a real, unrevoked order.
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
    editUntil: new Date(createdAt.getTime() + editWindowMs).toISOString(),
    finalized: false,
  };
  await storage.put(id, record);
  console.log(`Self-healed ${id} (verified with the order Worker, was never created here)`);
  return record;
}

app.get('/health', (_request, response) => response.json({ ok: true }));

// POST /shares/:id/ensure — create a share at a SPECIFIC id if it doesn't already
// exist (no-op otherwise, never overwrites existing content). This is the *only* way
// a share ever comes into existence: there is no public, unauthenticated "create a
// share" endpoint any more.
app.post(
  '/shares/:id/ensure',
  requireCreateSecret,
  route(async (request, response) => {
    const id = request.params.id;
    if (!validId(id)) return response.status(422).json({ error: 'Invalid id.' });
    const existing = await storage.get(id);
    if (existing) return response.json({ ok: true, existed: true });
    const createdAt = new Date();
    const record = {
      id,
      content: defaultShareContent(),
      createdAt: createdAt.toISOString(),
      editUntil: new Date(createdAt.getTime() + editWindowMs).toISOString(),
      finalized: false,
    };
    await storage.put(id, record);
    response.status(201).json({ ok: true, existed: false });
  }),
);

app.get(
  '/shares/:id',
  route(async (request, response) => {
    if (!validId(request.params.id))
      return response.status(404).json({ error: 'Share not found.' });
    let record = await storage.get(request.params.id);
    if (!record) record = await selfHealShare(request.params.id);
    if (!record) return response.status(404).json({ error: 'Share not found.' });
    response.json(publicRecord(record));
  }),
);

app.put(
  '/shares/:id',
  route(async (request, response) => {
    if (!validId(request.params.id))
      return response.status(404).json({ error: 'Share not found.' });
    const record = await storage.get(request.params.id);
    if (!record)
      return response.status(404).json({ error: 'Share not found.' });
    if (!editable(record))
      return response.status(423).json({ error: 'Share is locked.' });
    const content = cleanContent(request.body?.content);
    if (!content)
      return response.status(400).json({ error: 'Invalid content.' });
    const updated = { ...record, content, updatedAt: new Date().toISOString() };
    await storage.put(record.id, updated);
    response.json(publicRecord(updated));
  }),
);

// Whoever holds the link can finalize it within the edit window — same trust model
// as PUT above (there is no separate owner token any more; the link itself, only
// ever handed to the buyer who paid for it, is the credential).
app.post(
  '/shares/:id/finalize',
  route(async (request, response) => {
    if (!validId(request.params.id))
      return response.status(404).json({ error: 'Share not found.' });
    const record = await storage.get(request.params.id);
    if (!record)
      return response.status(404).json({ error: 'Share not found.' });
    if (!editable(record))
      return response.status(423).json({ error: 'Share is locked.' });
    const updated = {
      ...record,
      finalized: true,
      finalizedAt: new Date().toISOString(),
    };
    await storage.put(record.id, updated);
    response.json(publicRecord(updated));
  }),
);

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Internal server error.' });
});

app.listen(port, () => {
  console.log(`Share API listening on ${port}`);
  console.log(`Fulfillment /ensure: ${SHARE_CREATE_SECRET ? 'secret-gated' : 'OPEN (SHARE_CREATE_SECRET unset)'}`);
});
