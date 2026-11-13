import { DEFAULT_CONTENT, IMAGE_SLOTS, getPath, mergeContent, setPath } from "../src/app/content.js";

// The share links' little server: a Cloudflare Pages Function in production (functions/api, R2 through its
// binding) and a Vite middleware in development, both calling handleApi(request, env). Each invitation is one
// object in an R2 bucket (env.SHARES), "shares/<id>.json", and its photos are "images/<id>/...". A link can be
// edited by whoever has it for five days, or until it is finished; then it is view-only for good. The five days
// start at the link's first visit, not when it is made: until then its editUntil is null (the studio opens a new
// link itself the moment it is made, so an open within a minute of making doesn't count).
// Making a link in the studio needs the studio password (env.STUDIO_PASSWORD, a secret that never reaches the
// browser); without one the studio makes no links at all (env.OPEN_STUDIO opens it, for development).
//
// Sold links come from sent4u: when someone pays, the orders server (env.ORDERS_API_BASE) makes the id and gives
// the buyer the link. The first time that id is opened here, this server asks the orders server whether it really
// sold that id for Petal Isle (GET /links/<id>); if so the invitation is made then. POST /api/shares/<id>/ensure
// makes it earlier, for a caller that knows env.SHARE_CREATE_SECRET (x-petal-create-secret header) or when the
// orders server vouches for the id the same way.

export const EDIT_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;
export const FIRST_VISIT_GRACE_MS = 60 * 1000;
const MAX_BODY_BYTES = 64 * 1024;
// Two wrong passwords lock that address out for a day (kept per address, so
// nobody can lock the owner out from elsewhere).
const MAX_FAILED_UNLOCKS = 2;
const LOCKOUT_MS = 24 * 60 * 60 * 1000;
const ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
// Photos come already shrunk and converted in the browser (WebP, or JPEG
// where a browser can't make WebP); each is "images/<id>/<name>-<w>x<h>.<ext>",
// served at /api/images/<id>/<file>, and deleted when it is replaced.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_FILE = /^[A-Za-z0-9_-]{8,40}-\d{1,5}x\d{1,5}\.(?:webp|jpg)$/;
// Served by this server: by full address (env.PUBLIC_URL) when the site is
// elsewhere; a share's own photos are recognised by their path.
const imageUrl = (base, id, file) => `${base}/api/images/${id}/${file}`;
const IMAGE_CACHE = "public, max-age=31536000, immutable";

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

const shareKey = (id) => `shares/${id}.json`;

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

// Compares the digests, so neither the length nor the first wrong letter of a
// guess shows in how long the answer takes.
async function passwordMatches(candidate, password) {
  if (typeof candidate !== "string" || !password) return false;
  const [a, b] = await Promise.all([sha256(candidate), sha256(password)]);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const UNVISITED = "unvisited"; // in a link's metadata: its five days haven't started
async function readShare(bucket, id) {
  const object = await bucket.get(shareKey(id));
  return object ? object.json() : null;
}
function writeShare(bucket, id, entry) {
  return bucket.put(shareKey(id), JSON.stringify(entry), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { finalized: entry.finalized ? "1" : "0", edituntil: entry.editUntil == null ? UNVISITED : String(entry.editUntil) }, // lowercase: S3 lowercases them
  });
}

async function readBody(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return { tooLarge: true };
  try {
    return { body: text ? JSON.parse(text) : {} };
  } catch {
    return { body: null };
  }
}

// The words of an invitation, as the defaults allow (unknown fields and wrong
// types are dropped), and never locked: a share link's state is its own. Its
// photos are only ever the server's own (from `photos`, by default none), so
// a page can't point them elsewhere or drop one without it being deleted.
function cleanContent(content, photos = DEFAULT_CONTENT) {
  const clean = { ...mergeContent(DEFAULT_CONTENT, content), locked: false };
  for (const path of Object.values(IMAGE_SLOTS)) setPath(clean, path, getPath(photos, path) || "");
  return clean;
}

// The file of a share's own photo at that place, if it has one.
function ownImage(id, content, path) {
  const url = getPath(content, path) || "";
  const marker = `/api/images/${id}/`;
  const at = url.indexOf(marker);
  const file = at >= 0 ? url.slice(at + marker.length) : "";
  return IMAGE_FILE.test(file) ? file : null;
}

// What a photo is, from its first bytes (not from what the page says).
function imageKind(bytes) {
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}

// The password lockout, kept in the bucket under a hash of the address.
async function attemptState(bucket, request, now) {
  const address = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = `locks/${hex(await sha256(address))}.json`;
  const object = await bucket.get(key);
  let state = object ? await object.json() : { fails: 0, lockedUntil: 0 };
  if (state.lockedUntil && now >= state.lockedUntil) state = { fails: 0, lockedUntil: 0 };
  return { key, state };
}
async function checkPassword(bucket, request, candidate, password, now) {
  const { key, state } = await attemptState(bucket, request, now);
  if (state.lockedUntil) {
    const wait = state.lockedUntil - now;
    return json({ error: "locked_out", retryAfterMs: wait }, 429, { "retry-after": String(Math.ceil(wait / 1000)) });
  }
  if (await passwordMatches(candidate, password)) {
    if (state.fails) await bucket.delete(key);
    return null;
  }
  state.fails += 1;
  if (state.fails >= MAX_FAILED_UNLOCKS) {
    state.lockedUntil = now + LOCKOUT_MS;
    await bucket.put(key, JSON.stringify(state));
    return json({ error: "locked_out", retryAfterMs: LOCKOUT_MS }, 429, { "retry-after": String(LOCKOUT_MS / 1000) });
  }
  await bucket.put(key, JSON.stringify(state));
  return json({ error: "wrong_password", attemptsRemaining: MAX_FAILED_UNLOCKS - state.fails }, 401);
}

// How many links were made, still editable and finished (no words, no ids).
async function countShares(bucket, now) {
  const counts = { total: 0, active: 0, finalized: 0 };
  let cursor;
  do {
    const page = await bucket.list({ prefix: "shares/", cursor, include: ["customMetadata"] });
    for (const object of page.objects) {
      counts.total += 1;
      const meta = object.customMetadata || {};
      if (meta.finalized === "1") counts.finalized += 1;
      else if (meta.edituntil === UNVISITED || Number(meta.edituntil ?? meta.editUntil) > now) counts.active += 1;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return counts;
}

const turns = new Map(); // link id -> the last thing asked of it (each waits for the one before)
function inTurn(id, work) {
  const run = (turns.get(id) ?? Promise.resolve()).then(work, work);
  const settled = run.then(() => {}, () => {});
  turns.set(id, settled);
  settled.then(() => { if (turns.get(id) === settled) turns.delete(id); });
  return run;
}

const PRODUCT = "petal"; // what the orders server calls this card
const VERIFY_TIMEOUT_MS = 8000;

// A fresh invitation at that id, with the island's own words.
async function createDefault(bucket, id, now) {
  const entry = { content: cleanContent(DEFAULT_CONTENT), editUntil: null, finalized: false, createdAt: now, updatedAt: now };
  await writeShare(bucket, id, entry);
  return entry;
}

// Was this id really bought for this card? The sent4u orders server knows: GET /links/<id> -> { ok, product }.
// Answers true only for a real, not-refunded link of this card; false when it isn't, or can't be asked.
async function soldByStore(id, env, fetchImpl) {
  const base = String(env.ORDERS_API_BASE || "").replace(/[/]+$/, "");
  if (!base) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${base}/links/${encodeURIComponent(id)}`, { signal: controller.signal });
    if (!response.ok) return false;
    const body = (await response.json()) || {};
    return body.ok === true && body.product === PRODUCT;
  } catch (error) {
    console.warn(`Checking ${id} with the orders server failed:`, error.message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Can this YouTube song play inside the card (the step editor's song box)? Its owner may have closed it to other sites.
// YouTube's own oEmbed answers 401/403 for a song closed to embedding and 400/404 for one that is missing or private;
// anything else: can't tell, so it isn't stopped.
async function youtubeCheck(id, fetchImpl) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 8000);
  const day = { "cache-control": "public, max-age=86400" };
  try {
    const r = await fetchImpl(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { signal: stop.signal });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      return json({ ok: true, title: String(d.title || "").slice(0, 200) }, 200, day);
    }
    if (r.status === 401 || r.status === 403) return json({ ok: false, reason: "blocked" }, 200, day);
    if (r.status === 400 || r.status === 404) return json({ ok: false, reason: "missing" }, 200, day);
  } catch {
    // no answer
  } finally {
    clearTimeout(timer);
  }
  return json({ ok: true });
}

export async function handleApi(request, env = {}, { now = Date.now(), fetchImpl = fetch } = {}) {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const method = request.method;
  const bucket = env.SHARES;
  const password = env.STUDIO_PASSWORD || "";
  const yt = /^\/api\/yt-check\/([A-Za-z0-9_-]{11})$/.exec(url.pathname);
  if (yt) return method === "GET" ? youtubeCheck(yt[1], fetchImpl) : json({ error: "method_not_allowed" }, 405);
  if (!bucket) return json({ error: "not_configured" }, 503);
  try {
    // The studio: is it locked, and how many links so far.
    if (parts[0] === "studio" && parts.length === 1 && method === "GET") {
      return json({ locked: Boolean(password), open: Boolean(password || env.OPEN_STUDIO), shares: await countShares(bucket, now) });
    }
    if (parts[0] === "studio" && parts[1] === "unlock" && parts.length === 2 && method === "POST") {
      if (!password) return json({ ok: true });
      const { body, tooLarge } = await readBody(request);
      if (tooLarge || !body) return json({ error: "invalid_body" }, 400);
      return (await checkPassword(bucket, request, body.password, password, now)) || json({ ok: true });
    }
    // A photo, as it was stored (its name never changes, so it caches for good).
    if (parts[0] === "images" && parts.length === 3 && (method === "GET" || method === "HEAD")) {
      if (!ID_PATTERN.test(parts[1]) || !IMAGE_FILE.test(parts[2])) return json({ error: "not_found" }, 404);
      const object = await bucket.get(`images/${parts[1]}/${parts[2]}`);
      if (!object) return json({ error: "not_found" }, 404);
      const type = object.httpMetadata?.contentType || (parts[2].endsWith(".webp") ? "image/webp" : "image/jpeg");
      return new Response(method === "HEAD" ? null : object.body, { headers: { "content-type": type, "cache-control": IMAGE_CACHE, "x-content-type-options": "nosniff" } });
    }
    if (parts[0] !== "shares") return json({ error: "not_found" }, 404);

    // A new link, from the studio (with its password).
    if (parts.length === 1 && method === "POST") {
      const { body, tooLarge } = await readBody(request);
      if (tooLarge) return json({ error: "too_large" }, 413);
      if (!body) return json({ error: "invalid_body" }, 400);
      if (password) {
        const refused = await checkPassword(bucket, request, body.studioPassword, password, now);
        if (refused) return refused;
      } else if (!env.OPEN_STUDIO) return json({ error: "studio_closed" }, 403);
      let id;
      do id = newId();
      while (await bucket.head(shareKey(id)));
      const entry = { content: cleanContent(body.content), editUntil: null, finalized: false, createdAt: now, updatedAt: now };
      await writeShare(bucket, id, entry);
      return json({ id, editUntil: now + EDIT_WINDOW_MS }, 201); // (when they would end if they started now)
    }

    const id = parts[1];
    if (!ID_PATTERN.test(id || "")) return json({ error: "not_found" }, 404);
    // One thing at a time for each link: a save and a "finish" that arrive
    // together used to both read the link and both write it back, and the
    // save could put the unfinished link back over the finished one.
    return await inTurn(id, async () => {
      // A caller that knows the create secret (or the orders server vouching for the id): make the sold link at its id
      // (never touching one that exists).
      if (parts.length === 3 && parts[2] === "ensure" && method === "POST") {
        if (await bucket.head(shareKey(id))) return json({ ok: true, existed: true });
        const trusted = Boolean(env.SHARE_CREATE_SECRET) && (await passwordMatches(request.headers.get("x-petal-create-secret") || "", env.SHARE_CREATE_SECRET));
        if (!trusted && !(await soldByStore(id, env, fetchImpl))) return json({ error: "not_sold" }, 403);
        await createDefault(bucket, id, now);
        return json({ ok: true, existed: false });
      }
      let entry = await readShare(bucket, id);
      if (!entry && parts.length === 2 && method === "GET" && (await soldByStore(id, env, fetchImpl))) {
        entry = await createDefault(bucket, id, now);
        console.log(`Made ${id} on opening (sent4u sold it, it wasn't made yet)`);
      }
      if (!entry) return json({ error: "not_found" }, 404);

      if (parts.length === 2 && method === "GET") {
        // The first visit: the five days start now.
        if (entry.editUntil == null && !entry.finalized && now - entry.createdAt > FIRST_VISIT_GRACE_MS) {
          entry = { ...entry, editUntil: now + EDIT_WINDOW_MS };
          await writeShare(bucket, id, entry);
        }
        // (a page is always told a time: before the first visit, when they would end if they started now)
        return json({ content: entry.content, editUntil: entry.editUntil ?? now + EDIT_WINDOW_MS, finalized: entry.finalized });
      }
      const closed = entry.finalized ? "finalized" : entry.editUntil != null && now > entry.editUntil ? "edit_window_closed" : null;
      if (parts.length === 2 && method === "PUT") {
        if (closed) return json({ error: closed }, 403);
        const { body, tooLarge } = await readBody(request);
        if (tooLarge) return json({ error: "too_large" }, 413);
        if (!body || !body.content || typeof body.content !== "object") return json({ error: "invalid_content" }, 400);
        await writeShare(bucket, id, { ...entry, content: cleanContent(body.content, entry.content), updatedAt: now });
        return json({ ok: true });
      }
      // A photo for one place (?slot=book): the new one is kept and the one it
      // replaces deleted; DELETE takes it away (back to the drawing).
      if (parts.length === 3 && parts[2] === "images" && (method === "POST" || method === "DELETE")) {
        if (closed) return json({ error: closed }, 403);
        const slot = url.searchParams.get("slot");
        // own keys only: "constructor" or "__proto__" would pass a plain lookup, and the upload below would then be stored and never used
        const path = slot && Object.hasOwn(IMAGE_SLOTS, slot) ? IMAGE_SLOTS[slot] : null;
        if (!path) return json({ error: "invalid_slot" }, 400);
        let next = "";
        if (method === "POST") {
          const bytes = new Uint8Array(await request.arrayBuffer());
          if (bytes.length > MAX_IMAGE_BYTES) return json({ error: "too_large" }, 413);
          const kind = imageKind(bytes);
          const size = /^(\d{1,5})x(\d{1,5})$/.exec(request.headers.get("x-image-size") || "");
          if (!kind || !size || !Number(size[1]) || !Number(size[2])) return json({ error: "invalid_image" }, 400);
          const file = `${newId()}${newId()}-${Number(size[1])}x${Number(size[2])}.${kind}`;
          await bucket.put(`images/${id}/${file}`, bytes, { httpMetadata: { contentType: kind === "webp" ? "image/webp" : "image/jpeg", cacheControl: IMAGE_CACHE } });
          next = imageUrl((env.PUBLIC_URL || "").replace(/[/]$/, ""), id, file);
        }
        const old = ownImage(id, entry.content, path);
        const content = cleanContent(entry.content, entry.content);
        setPath(content, path, next);
        await writeShare(bucket, id, { ...entry, content, updatedAt: now });
        if (old) await bucket.delete(`images/${id}/${old}`);
        return json({ ok: true, url: next });
      }
      if (parts.length === 3 && parts[2] === "finalize" && method === "POST") {
        if (!entry.finalized) await writeShare(bucket, id, { ...entry, finalized: true, finalizedAt: now });
        return json({ ok: true });
      }
      return json({ error: "not_found" }, 404);
    });
  } catch (error) {
    console.error(`${method} ${url.pathname} failed:`, error);
    return json({ error: "storage_error" }, 500);
  }
}
