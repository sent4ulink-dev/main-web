// Where generated shares actually live. R2 is used when configured (Cloudflare
// Account/Access keys set) — one object per share, so they're individually
// browsable in the R2 dashboard. Falls back to a local JSON file otherwise,
// purely so local dev (and anyone without R2 keys set) keeps working unchanged.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'shares.json');
const KEY_PREFIX = 'shares/';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

export const usingR2 = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);

const client = usingR2
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
    })
  : null;

function keyFor(id) {
  return `${KEY_PREFIX}${id}.json`;
}

function isNotFound(err) {
  return err.name === 'NoSuchKey' || err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404;
}

async function r2Get(id) {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: keyFor(id) }));
    return JSON.parse(await res.Body.transformToString());
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

async function r2Put(id, data) {
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: keyFor(id),
      Body: JSON.stringify(data),
      ContentType: 'application/json'
    })
  );
}

async function r2Exists(id) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: keyFor(id) }));
    return true;
  } catch (err) {
    if (isNotFound(err)) return false;
    throw err;
  }
}

async function r2ListIds() {
  const ids = [];
  let ContinuationToken;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, Prefix: KEY_PREFIX, ContinuationToken })
    );
    for (const obj of res.Contents ?? []) {
      ids.push(obj.Key.slice(KEY_PREFIX.length, -'.json'.length));
    }
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return ids;
}

// ---- Local-file fallback (used only when R2 isn't configured) ----

function fileLoadAll() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function fileSaveAll(store) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

// ---- Public API — same shape regardless of backend ----

export async function getShare(id) {
  if (usingR2) return r2Get(id);
  return fileLoadAll()[id] ?? null;
}

export async function putShare(id, data) {
  if (usingR2) return r2Put(id, data);
  const store = fileLoadAll();
  store[id] = data;
  fileSaveAll(store);
}

export async function shareExists(id) {
  if (usingR2) return r2Exists(id);
  return id in fileLoadAll();
}

export async function listShareIds() {
  if (usingR2) return r2ListIds();
  return Object.keys(fileLoadAll());
}
