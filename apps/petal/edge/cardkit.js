// The sent4u cards' server toolkit, for Cloudflare Pages Functions
// (the same file in every card's repository, edge/cardkit.js). Only web APIs
// are used (fetch, crypto.subtle, Request/Response), so it runs on Cloudflare
// and, for the tests, in Node.
//
// Storage is the card's R2 bucket (an R2 binding, or anything with the same
// get/head/put/delete/list). Cloudflare may run several copies of a server at
// once, so nothing is kept in memory between requests: password lockouts and
// rate limits live in the bucket too, and every change to a stored document is
// made with a condition (only if nobody changed it since it was read), tried
// again from the start when someone did.

export const DAY_MS = 24 * 60 * 60 * 1000;

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers },
  });

// A change (anything but GET/HEAD/OPTIONS) asked for by a page on another
// website is refused: only this site's own pages may change things, and the
// sites in `allowed` (sent4u.link, which shows this card through its gateway,
// so the browser's Origin is sent4u.link). Calls from servers (the sent4u
// orders server) carry no Origin and pass.
export function fromOtherSite(request, allowed = []) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  const origin = request.headers.get("origin");
  return Boolean(origin) && origin !== new URL(request.url).origin && !allowed.includes(origin);
}

// The visitor's address, as Cloudflare saw it (it can't be forged from outside).
export const clientAddress = (request) =>
  request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

const encoder = new TextEncoder();
export async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", typeof text === "string" ? encoder.encode(text) : text));
}
export const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function hmac(secret, text, encoding = "hex") {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(text)));
  return encoding === "hex" ? hex(bytes) : base64url(bytes);
}

// Compares the digests, so neither the length nor the first wrong letter of a
// guess shows in how long the answer takes. Never true for an empty secret.
export async function sameSecret(candidate, secret) {
  if (typeof candidate !== "string" || typeof secret !== "string" || !secret) return false;
  const [a, b] = await Promise.all([sha256(candidate), sha256(secret)]);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const randomId = (bytes = 6) => base64url(crypto.getRandomValues(new Uint8Array(bytes)));

// A JSON body, refused over maxBytes: { body } (null when it isn't JSON) or { tooLarge: true }.
export async function readJson(request, maxBytes) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) return { tooLarge: true };
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > maxBytes) return { tooLarge: true };
  if (!bytes.length) return { body: {} };
  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { body: null };
  }
}

// ---- Documents with conditions ----

// { value, etag } or null.
export async function getDoc(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  return { value: JSON.parse(await object.text()), etag: object.etag };
}

// Writes only if the document is still what was read (etag), or still absent
// (etag null). False when someone changed it meanwhile.
export async function putDoc(bucket, key, value, etag, options = {}) {
  const onlyIf = etag ? { etagMatches: etag } : new Headers({ "If-None-Match": "*" });
  const written = await bucket.put(key, JSON.stringify(value), { httpMetadata: { contentType: "application/json" }, ...options, onlyIf });
  return written !== null;
}

// Reads a document, asks change(value or null) what it should become, and
// writes that with a condition; starts again (up to 8 times) when someone
// changed it meanwhile. change answers { value } to write (value undefined:
// write nothing) and anything else to pass back; updateDoc answers that.
export async function updateDoc(bucket, key, change, options = {}) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await getDoc(bucket, key);
    const outcome = await change(current ? current.value : null);
    if (!outcome || outcome.value === undefined) return outcome;
    const extra = typeof options === "function" ? options(outcome.value) : options;
    if (await putDoc(bucket, key, outcome.value, current ? current.etag : null, extra)) return outcome;
    await new Promise((resolve) => setTimeout(resolve, 15 + Math.random() * 40 * (attempt + 1)));
  }
  throw Object.assign(new Error(`${key} kept changing`), { status: 503 });
}

// ---- Password lockout ----

// The studio password, with the lockout every card has had: a number of wrong
// guesses (2) locks that address out for a day. Kept per address (so nobody
// can lock the owner out from elsewhere), under a keyed hash of it (the bucket
// may be public, and an address must not be readable there).
// Answers { state: "ok" } | { state: "wrong", attemptsRemaining } | { state: "locked", retryAfterMs }.
export async function checkPassword({ bucket, request, candidate, password, now = Date.now(), maxFails = 2, lockMs = DAY_MS, prefix = "locks/" }) {
  const key = `${prefix}${await hmac(password, `lock:${clientAddress(request)}`)}.json`;
  const fresh = (state) => (state && !(state.lockedUntil && now >= state.lockedUntil) ? state : { fails: 0, lockedUntil: 0 });
  const first = fresh((await getDoc(bucket, key))?.value);
  if (first.lockedUntil) return { state: "locked", retryAfterMs: first.lockedUntil - now };
  if (await sameSecret(candidate, password)) {
    if (first.fails) await bucket.delete(key);
    return { state: "ok" };
  }
  return updateDoc(bucket, key, (stored) => {
    const state = fresh(stored);
    if (state.lockedUntil) return { value: undefined, state: "locked", retryAfterMs: state.lockedUntil - now };
    const fails = state.fails + 1;
    if (fails >= maxFails) return { value: { fails, lockedUntil: now + lockMs }, state: "locked", retryAfterMs: lockMs };
    return { value: { fails, lockedUntil: 0 }, state: "wrong", attemptsRemaining: maxFails - fails };
  });
}

// ---- Rate limit ----

// At most `limit` uses of `name` per window for one address. { ok } or { ok: false, retryAfterMs }.
export async function rateLimit({ bucket, request, name, secret, limit, windowMs, now = Date.now(), prefix = "limits/" }) {
  const key = `${prefix}${await hmac(secret || name, `${name}:${clientAddress(request)}`)}.json`;
  return updateDoc(bucket, key, (stored) => {
    const state = stored && now < stored.resetAt ? stored : { count: 0, resetAt: now + windowMs };
    if (state.count >= limit) return { value: undefined, ok: false, retryAfterMs: state.resetAt - now };
    return { value: { count: state.count + 1, resetAt: state.resetAt }, ok: true, remaining: limit - state.count - 1 };
  });
}

// ---- Signed studio sessions ----

// "<expires>.<random>.<signature>", signed with the studio password: nothing
// to keep on the server, and every session ends when the password changes.
export async function signSession(password, ttlMs, now = Date.now()) {
  const payload = `${now + ttlMs}.${randomId(12)}`;
  return `${payload}.${await hmac(password, payload, "base64url")}`;
}
export async function validSession(password, token, now = Date.now()) {
  if (!password || typeof token !== "string") return false;
  const cut = token.lastIndexOf(".");
  if (cut < 1) return false;
  const payload = token.slice(0, cut);
  const expires = Number(payload.split(".")[0]);
  if (!Number.isFinite(expires) || expires <= now) return false;
  return sameSecret(token.slice(cut + 1), await hmac(password, payload, "base64url"));
}

// Every object under a prefix, deleted (a card's photos when it is taken back).
export async function deletePrefix(bucket, prefix) {
  let count = 0;
  for (;;) {
    const page = await bucket.list({ prefix });
    if (!page.objects.length) return count;
    for (const object of page.objects) {
      await bucket.delete(object.key);
      count += 1;
    }
  }
}

// ---- Guarded bucket (for handlers written with plain get/put) ----

// A bucket that remembers what each key was when this request read it, and
// writes only if it is still that: a handler written with plain get/head/put
// gets the same safety as updateDoc. When a write is refused, conflicted is
// set and the write throws; runGuarded then runs the whole request again.
export function guardBucket(bucket) {
  const seen = new Map(); // key -> etag, or null for "was absent"
  const guarded = {
    conflicted: false,
    async get(key, options) {
      const object = await bucket.get(key, options);
      if (!options?.range) seen.set(key, object ? object.etag : null);
      return object;
    },
    async head(key) {
      const object = await bucket.head(key);
      seen.set(key, object ? object.etag : null);
      return object;
    },
    async put(key, value, options = {}) {
      if (!seen.has(key) || options.onlyIf) return bucket.put(key, value, options);
      const etag = seen.get(key);
      const onlyIf = etag ? { etagMatches: etag } : new Headers({ "If-None-Match": "*" });
      const written = await bucket.put(key, value, { ...options, onlyIf });
      if (written === null) {
        guarded.conflicted = true;
        throw Object.assign(new Error(`${key} changed meanwhile`), { conflict: true });
      }
      seen.set(key, written.etag);
      return written;
    },
    async delete(keys) {
      for (const key of [].concat(keys)) seen.set(key, null);
      return bucket.delete(keys);
    },
    list: (options) => bucket.list(options),
  };
  return guarded;
}

// Runs handler(request, bucket) with a guarded bucket, again (with the same
// request, read afresh) while its writes keep being refused.
export async function runGuarded(request, bucket, handler) {
  const body = request.method === "GET" || request.method === "HEAD" ? null : await request.arrayBuffer();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const guarded = guardBucket(bucket);
    const copy = new Request(request.url, { method: request.method, headers: request.headers, body });
    let response;
    try {
      response = await handler(copy, guarded);
    } catch (error) {
      if (!guarded.conflicted) throw error;
    }
    if (!guarded.conflicted) return response;
    await new Promise((resolve) => setTimeout(resolve, 15 + Math.random() * 40 * (attempt + 1)));
  }
  return json({ error: "busy" }, 503, { "retry-after": "1" });
}
