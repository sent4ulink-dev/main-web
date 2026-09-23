/* WinXP share API — a Cloudflare Worker. Share content lives in R2, temporary story
   photos and the upload throttle counter live in KV (see wrangler.toml).

   GET    /health                     what it says
   POST   /shares/:id/ensure          create a share at a SPECIFIC id if it doesn't already exist (server-to-server only, see below)
   GET    /shares/:id                 the public share content and edit metadata; self-heals against the order Worker on a miss
   PUT    /shares/:id                 replace validated content, only during the edit window
   POST   /shares/:id/finalize        permanently finalize, only during the edit window
   POST   /photos                     image/png, max 5 MiB; validates signature, dimensions, chunks, CRC and bounded decompression
   GET    /photos/:id                 a temporary PNG; expired/missing images return structured JSON

   There is no public studio and no password: an invitation only ever comes into
   existence because the sent4u order Worker calls POST /shares/:id/ensure
   server-to-server, gated by a shared secret, the moment it's paid for. Whoever holds
   the resulting share URL can edit or finalize it within its edit window — the link
   itself is the credential, same trust model as Pixel and Pinky.

   The old Express server also capped TOTAL photo storage at 64 MiB, tracked in a
   process-local counter — that existed to protect that one process's own RAM. KV
   storage isn't bounded by this Worker's memory the same way, so that global cap is
   dropped here; the per-file 5 MiB limit, PNG validation and the per-IP throttle above
   are what actually bound abuse now. */
import { z } from "zod";
import { contentSchema, freshContent, type Share } from "../../shared/content.js";
import { createStorage } from "./storage.js";
import { validPng } from "./png.js";

const EDIT_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;
const ID = /^[A-Za-z0-9_-]{6,40}$/;
const PHOTO_ID = /^[A-Za-z0-9_-]{24}$/;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_UPLOADS_PER_MINUTE = 6;
const JSON_TYPE = { "Content-Type": "application/json; charset=utf-8" };

export interface Env {
  BUCKET: R2Bucket;
  PHOTOS: KVNamespace;
  CORS_ALLOWED_ORIGINS?: string;
  SHARE_CREATE_SECRET?: string;
  ORDERS_API_BASE?: string;
  PHOTO_TTL_MINUTES?: string;
  // Test-only clock override — never set in production, where this is just Date.now.
  now?: () => number;
}

function now(env: Env): number {
  return env.now ? env.now() : Date.now();
}

function reply(body: unknown, status: number, cors: Record<string, string>, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_TYPE, ...cors, ...extra } });
}

function allowedOrigins(env: Env): string[] {
  return String(env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigins(env);
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-date-create-secret",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (!allowed.length) h["Access-Control-Allow-Origin"] = "*";
  else if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

// Gates POST /shares/:id/ensure — the endpoint the sent4u order Worker calls,
// server-to-server, the moment a paid order generates this id. Never called from a
// browser: there is no public studio, no password, no way to mint a share id from
// this app at all — a real invitation only ever exists because it was paid for.
function createSecretOk(request: Request, env: Env): boolean {
  if (!env.SHARE_CREATE_SECRET) return true; // not configured yet — dev convenience only
  return request.headers.get("x-date-create-secret") === env.SHARE_CREATE_SECRET;
}

function editable(record: Share, env: Env): boolean {
  return !record.finalized && record.editUntil > now(env);
}

const MAX_WRITE_ATTEMPTS = 4;

// Re-reads and re-applies `mutate` each time a conditional write loses a race against
// another request touching the same share — see storage.ts. `mutate` returns null to
// signal "stop, don't write" (e.g. it discovered the share is already finalized).
async function mutateShare(
  storage: ReturnType<typeof createStorage>,
  id: string,
  mutate: (current: Share) => Share | null,
): Promise<{ outcome: "missing" | "declined" | "conflict" | "ok"; share?: Share }> {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
    const current = await storage.get(id);
    if (!current) return { outcome: "missing" };
    const next = mutate(current.share);
    if (!next) return { outcome: "declined", share: current.share };
    if (await storage.put(next, current.etag)) return { outcome: "ok", share: next };
  }
  return { outcome: "conflict" };
}

// Self-heal: if a share isn't in storage yet, ask the sent4u order Worker whether this
// id was ever actually issued (paid for, and for this product) before creating it here.
// Covers the gap where the background /ensure call after a purchase is still mid-retry
// when the buyer clicks the link; without this a link nobody did anything wrong to just
// 404s forever. A random unpaid id still gets rejected, since the Worker only confirms
// ids that exist in a real, unrevoked order.
async function selfHealShare(id: string, storage: ReturnType<typeof createStorage>, env: Env): Promise<Share | null> {
  const ordersApiBase = String(env.ORDERS_API_BASE || "").replace(/\/$/, "");
  if (!ordersApiBase) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${ordersApiBase}/links/${encodeURIComponent(id)}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const body = (await r.json()) as { ok?: boolean; product?: string };
    if (!body.ok || body.product !== "winxp") return null; // exists, but isn't a WinXP link — not ours to heal
  } catch (err) {
    clearTimeout(timer);
    console.warn(`Self-heal verify failed for ${id}:`, (err as Error).message);
    return null;
  }
  const createdAt = now(env);
  const share: Share = { id, content: freshContent(), createdAt, editUntil: createdAt + EDIT_WINDOW_MS, finalized: false };
  if (!(await storage.create(share))) {
    // Someone else created it in the moment between our get() and now — read what they wrote.
    const existing = await storage.get(id);
    return existing?.share ?? null;
  }
  console.log(`Self-healed ${id} (verified with the order Worker, was never created here)`);
  return share;
}

// A soft, best-effort throttle — KV is eventually consistent, so two requests racing
// at the same instant from the same IP can both slip through. That's an acceptable
// looseness for anti-abuse (not a security boundary); the per-file 5 MiB cap and PNG
// validation below are what actually bound the damage a burst can do.
async function throttled(ip: string, env: Env): Promise<boolean> {
  const key = `throttle:${ip}`;
  const count = Number((await env.PHOTOS.get(key)) ?? "0");
  if (count >= MAX_UPLOADS_PER_MINUTE) return true;
  await env.PHOTOS.put(key, String(count + 1), { expirationTtl: 60 });
  return false;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const storage = createStorage(env.BUCKET);
    try {
      if (url.pathname === "/health" && request.method === "GET") return reply({ status: "ok" }, 200, cors);

      const ensure = url.pathname.match(/^\/shares\/([A-Za-z0-9_-]+)\/ensure$/);
      if (ensure && request.method === "POST") {
        if (!createSecretOk(request, env)) return reply({ status: "forbidden" }, 403, cors);
        const id = ensure[1];
        if (!ID.test(id)) return reply({ status: "invalid", message: "Invalid share ID" }, 400, cors);
        const createdAt = now(env);
        const share: Share = { id, content: freshContent(), createdAt, editUntil: createdAt + EDIT_WINDOW_MS, finalized: false };
        if (await storage.create(share)) return reply({ status: "ok", share }, 201, cors);
        const existing = await storage.get(id); // someone else created it first — return what's really there
        return reply({ status: "ok", share: existing?.share ?? share }, 200, cors);
      }

      const finalize = url.pathname.match(/^\/shares\/([A-Za-z0-9_-]+)\/finalize$/);
      if (finalize && request.method === "POST") {
        if (!ID.test(finalize[1])) return reply({ status: "invalid", message: "Invalid share ID" }, 400, cors);
        const result = await mutateShare(storage, finalize[1], (current) => {
          if (current.finalized || !editable(current, env)) return null;
          return { ...current, finalized: true };
        });
        if (result.outcome === "missing") return reply({ status: "missing" }, 404, cors);
        if (result.outcome === "conflict") return reply({ status: "error", message: "Please try again." }, 409, cors);
        if (result.outcome === "declined")
          return reply({ status: result.share!.finalized ? "finalized" : "expired" }, result.share!.finalized ? 409 : 410, cors);
        return reply({ status: "ok", share: result.share }, 200, cors);
      }

      const share = url.pathname.match(/^\/shares\/([A-Za-z0-9_-]+)$/);
      if (share && request.method === "GET") {
        if (!ID.test(share[1])) return reply({ status: "invalid", message: "Invalid share ID" }, 400, cors);
        let s = (await storage.get(share[1]))?.share ?? null;
        if (!s) s = await selfHealShare(share[1], storage, env);
        if (!s) return reply({ status: "missing", message: "Invitation not found" }, 404, cors);
        return reply({ status: "ok", share: s }, 200, cors);
      }
      if (share && request.method === "PUT") {
        if (!ID.test(share[1])) return reply({ status: "invalid", message: "Invalid share ID" }, 400, cors);
        const body = await request.json().catch(() => null);
        const content = contentSchema.parse(body);
        const result = await mutateShare(storage, share[1], (current) => {
          if (current.finalized || !editable(current, env)) return null;
          return { ...current, content };
        });
        if (result.outcome === "missing") return reply({ status: "missing" }, 404, cors);
        if (result.outcome === "conflict") return reply({ status: "error", message: "Please try again." }, 409, cors);
        if (result.outcome === "declined")
          return reply({ status: result.share!.finalized ? "finalized" : "expired" }, result.share!.finalized ? 409 : 410, cors);
        return reply({ status: "ok", share: result.share }, 200, cors);
      }

      if (url.pathname === "/photos" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
        if (await throttled(ip, env))
          return reply({ status: "limited", message: "Please wait a minute before creating another image" }, 429, cors);
        const contentType = request.headers.get("Content-Type") ?? "";
        if (!contentType.includes("image/png"))
          return reply({ status: "invalid", message: "A valid 1080 × 1920 PNG is required" }, 400, cors);
        // Reject an honestly-declared oversized body before reading it at all; still
        // guarded again after reading, in case Content-Length is missing or understated.
        const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
        if (declaredLength > MAX_PHOTO_BYTES) return reply({ status: "error", message: "Request too large" }, 413, cors);
        const buffer = new Uint8Array(await request.arrayBuffer());
        if (buffer.byteLength > MAX_PHOTO_BYTES) return reply({ status: "error", message: "Request too large" }, 413, cors);
        if (!(await validPng(buffer)))
          return reply({ status: "invalid", message: "A valid 1080 × 1920 PNG is required" }, 400, cors);
        const id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
        const ttlMinutes = Math.max(1, Math.min(60, Number(env.PHOTO_TTL_MINUTES) || 15));
        await env.PHOTOS.put(`photo:${id}`, buffer, { expirationTtl: ttlMinutes * 60 });
        return reply(
          { status: "ok", path: `/photos/${id}`, expiresAt: now(env) + ttlMinutes * 60000 },
          201,
          cors,
        );
      }

      const photo = url.pathname.match(/^\/photos\/([A-Za-z0-9_-]+)$/);
      if (photo && request.method === "GET") {
        if (!PHOTO_ID.test(photo[1])) return reply({ status: "invalid" }, 400, cors);
        const data = await env.PHOTOS.get(`photo:${photo[1]}`, "arrayBuffer");
        if (!data) return reply({ status: "expired", message: "This temporary image has expired" }, 404, cors);
        return new Response(data, {
          status: 200,
          headers: { ...cors, "Content-Type": "image/png", "Content-Disposition": 'inline; filename="our-date.png"' },
        });
      }

      return reply({ status: "missing", message: "Endpoint not found" }, 404, cors);
    } catch (err) {
      const status = err instanceof z.ZodError ? 400 : 500;
      console.error(err);
      return reply(
        { status: status === 400 ? "invalid" : "error", message: status === 400 ? "Invalid request content" : "The request could not be completed. Please try again." },
        status,
        cors,
      );
    }
  },
};
