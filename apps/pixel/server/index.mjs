import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import cors from 'cors';
import express from 'express';
import { createStorage } from './storage.mjs';

const app = express();
const storage = createStorage();
const port = Number(process.env.PORT || 8787);
const editWindowMs = 5 * 24 * 60 * 60 * 1000;
const studioSessionMs = 60 * 60 * 1000;
const lockoutMs = 24 * 60 * 60 * 1000;
const maxPasswordFailures = 2;
const passwordAttempts = new Map();
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

app.disable('x-powered-by');
app.set('trust proxy', 1);
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

function validId(id) {
  return /^[A-Za-z0-9_-]{8}$/.test(id) && id !== 'test';
}

function publicRecord(record) {
  const { editTokenHash: _secret, ...safe } = record;
  return safe;
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function tokenMatches(record, authorization = '') {
  const supplied = authorization.replace(/^Bearer\s+/i, '');
  if (!supplied || !record.editTokenHash) return false;
  const actual = Buffer.from(tokenHash(supplied));
  const expected = Buffer.from(record.editTokenHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function secureEqual(actual, expected) {
  const actualHash = createHash('sha256').update(actual).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function createStudioToken() {
  const payload = `${Date.now() + studioSessionMs}.${randomBytes(12).toString('base64url')}`;
  const signature = createHmac('sha256', process.env.STUDIO_PASSWORD)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function validStudioToken(authorization = '') {
  const token = authorization.replace(/^Bearer\s+/i, '');
  const separator = token.lastIndexOf('.');
  if (separator < 1 || !process.env.STUDIO_PASSWORD) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expiresAt = Number(payload.split('.')[0]);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  const expected = createHmac('sha256', process.env.STUDIO_PASSWORD)
    .update(payload)
    .digest('base64url');
  return secureEqual(signature, expected);
}

app.get('/health', (_request, response) => response.json({ ok: true }));

app.post('/api/studio/unlock', (request, response) => {
  const expected = process.env.STUDIO_PASSWORD;
  if (!expected)
    return response
      .status(503)
      .json({ status: 'error', message: 'Studio password is not configured.' });

  const ip = request.ip || request.socket.remoteAddress || 'unknown';
  let attempt = passwordAttempts.get(ip);
  if (attempt?.lockedUntil > Date.now()) {
    const retryAfterMs = attempt.lockedUntil - Date.now();
    return response
      .status(429)
      .set('Retry-After', String(Math.ceil(retryAfterMs / 1000)))
      .json({ status: 'locked_out', retryAfterMs });
  }
  if (attempt?.lockedUntil) {
    passwordAttempts.delete(ip);
    attempt = undefined;
  }

  const supplied =
    typeof request.body?.password === 'string' ? request.body.password : '';
  if (secureEqual(supplied, expected)) {
    passwordAttempts.delete(ip);
    return response
      .set('Cache-Control', 'no-store')
      .json({ status: 'ok', token: createStudioToken() });
  }

  const failures = (attempt?.fails ?? 0) + 1;
  if (failures >= maxPasswordFailures) {
    const lockedUntil = Date.now() + lockoutMs;
    passwordAttempts.set(ip, { fails: failures, lockedUntil });
    return response
      .status(429)
      .set('Retry-After', String(Math.ceil(lockoutMs / 1000)))
      .json({ status: 'locked_out', retryAfterMs: lockoutMs });
  }

  const attemptsRemaining = maxPasswordFailures - failures;
  passwordAttempts.set(ip, { fails: failures, lockedUntil: 0 });
  response.status(401).json({ status: 'wrong', attemptsRemaining });
});

app.post(
  '/shares',
  route(async (request, response) => {
    if (!process.env.STUDIO_PASSWORD)
      return response
        .status(503)
        .json({ error: 'Studio password is not configured.' });
    if (!validStudioToken(request.get('authorization')))
      return response.status(401).json({ error: 'Studio login is invalid.' });
    const content = cleanContent(request.body?.content);
    if (!content)
      return response.status(400).json({ error: 'Invalid content.' });
    let id;
    do id = randomBytes(6).toString('base64url');
    while (await storage.get(id));
    const createdAt = new Date();
    const editToken = randomBytes(24).toString('base64url');
    const finalized = request.body?.finalized === true;
    const record = {
      id,
      content,
      createdAt: createdAt.toISOString(),
      editUntil: new Date(createdAt.getTime() + editWindowMs).toISOString(),
      finalized,
      ...(finalized ? { finalizedAt: createdAt.toISOString() } : {}),
      editTokenHash: tokenHash(editToken),
    };
    await storage.put(id, record);
    response.status(201).json({ ...publicRecord(record), editToken });
  }),
);

app.get(
  '/shares/:id',
  route(async (request, response) => {
    if (!validId(request.params.id))
      return response.status(404).json({ error: 'Share not found.' });
    const record = await storage.get(request.params.id);
    if (!record)
      return response.status(404).json({ error: 'Share not found.' });
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

app.post(
  '/shares/:id/finalize',
  route(async (request, response) => {
    if (!validId(request.params.id))
      return response.status(404).json({ error: 'Share not found.' });
    const record = await storage.get(request.params.id);
    if (!record)
      return response.status(404).json({ error: 'Share not found.' });
    if (!tokenMatches(record, request.get('authorization')))
      return response.status(403).json({ error: 'Owner token is invalid.' });
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

app.get(
  '/stats',
  route(async (_request, response) => {
    const records = await storage.list();
    const finalized = records.filter((record) => record.finalized).length;
    const active = records.filter(editable).length;
    response.json({ total: records.length, finalized, active });
  }),
);

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Internal server error.' });
});

app.listen(port, () => console.log(`Share API listening on ${port}`));
