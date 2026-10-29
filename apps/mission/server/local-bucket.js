import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Just enough of an R2 bucket (get, head, put, delete, list) for development
// and tests: kept in memory, and in a JSON file when one is given, so links
// made with `npm run dev` outlive a restart (photos are kept as base64).
export function createLocalBucket(file = null) {
  const store = new Map();
  if (file) {
    try {
      for (const [key, saved] of Object.entries(JSON.parse(readFileSync(file, "utf8")))) {
        store.set(key, { ...saved, body: saved.base64 ? Uint8Array.from(Buffer.from(saved.base64, "base64")) : saved.body });
      }
    } catch {
      // Nothing saved yet.
    }
  }
  const persist = () => {
    if (!file) return;
    const saved = {};
    for (const [key, { body, ...rest }] of store) {
      saved[key] = typeof body === "string" ? { ...rest, body } : { ...rest, base64: Buffer.from(body).toString("base64") };
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(saved));
  };
  const bytes = (body) => (typeof body === "string" ? new TextEncoder().encode(body) : body);
  const object = (key, { body, customMetadata, httpMetadata }) => ({
    key,
    customMetadata,
    httpMetadata,
    size: bytes(body).length,
    body: bytes(body),
    text: async () => (typeof body === "string" ? body : new TextDecoder().decode(body)),
    json: async () => JSON.parse(typeof body === "string" ? body : new TextDecoder().decode(body)),
    arrayBuffer: async () => bytes(body).slice().buffer,
  });
  return {
    async get(key) {
      return store.has(key) ? object(key, store.get(key)) : null;
    },
    async head(key) {
      return store.has(key) ? { key, customMetadata: store.get(key).customMetadata, httpMetadata: store.get(key).httpMetadata } : null;
    },
    async put(key, body, { customMetadata = {}, httpMetadata = {} } = {}) {
      const value = typeof body === "string" ? body : new Uint8Array(body instanceof ArrayBuffer ? body : body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength));
      store.set(key, { body: value, customMetadata: { ...customMetadata }, httpMetadata: { ...httpMetadata } });
      persist();
    },
    async delete(key) {
      store.delete(key);
      persist();
    },
    async list({ prefix = "", cursor, limit = 1000 } = {}) {
      const keys = [...store.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = keys.slice(start, start + limit);
      const truncated = start + limit < keys.length;
      return { objects: page.map((key) => ({ key, customMetadata: store.get(key).customMetadata })), truncated, cursor: truncated ? String(start + limit) : undefined };
    },
    // For tests: every key it holds.
    keys: () => [...store.keys()],
  };
}
