// An R2 bucket in memory, for tests: get/head/put/delete/list as the Workers
// R2 binding has them, conditions (onlyIf) included.

const toBytes = async (value) => {
  if (value == null) return new Uint8Array();
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  if (typeof value.arrayBuffer === "function") return new Uint8Array(await value.arrayBuffer());
  if (typeof value.getReader === "function") return new Uint8Array(await new Response(value).arrayBuffer());
  throw new Error("unsupported body");
};

export function memoryBucket({ delay = 0 } = {}) {
  const objects = new Map();
  let serial = 0;
  const wait = () => (delay ? new Promise((r) => setTimeout(r, Math.random() * delay)) : Promise.resolve());
  const describe = (key, o) => ({
    key,
    etag: o.etag,
    httpEtag: `"${o.etag}"`,
    size: o.bytes.length,
    uploaded: o.uploaded,
    httpMetadata: { ...o.httpMetadata },
    customMetadata: { ...o.customMetadata },
    writeHttpMetadata(headers) {
      if (o.httpMetadata.contentType) headers.set("content-type", o.httpMetadata.contentType);
      if (o.httpMetadata.cacheControl) headers.set("cache-control", o.httpMetadata.cacheControl);
    },
  });
  const passes = (o, onlyIf) => {
    if (!onlyIf) return true;
    if (onlyIf instanceof Headers) {
      const none = onlyIf.get("if-none-match");
      if (none === "*") return !o;
      if (none) return !o || none.replace(/"/g, "") !== o.etag;
      const match = onlyIf.get("if-match");
      if (match) return Boolean(o) && (match === "*" || match.replace(/"/g, "") === o.etag);
      return true;
    }
    if (onlyIf.etagMatches !== undefined) return Boolean(o) && o.etag === onlyIf.etagMatches;
    if (onlyIf.etagDoesNotMatch !== undefined) return !o || o.etag !== onlyIf.etagDoesNotMatch;
    return true;
  };
  return {
    objects,
    async get(key, options = {}) {
      await wait();
      const o = objects.get(key);
      if (!o) return null;
      let bytes = o.bytes;
      let range;
      if (options.range) {
        const { offset = 0, length, suffix } = options.range;
        const start = suffix !== undefined ? Math.max(0, bytes.length - suffix) : offset;
        const end = suffix !== undefined ? bytes.length : length !== undefined ? Math.min(bytes.length, start + length) : bytes.length;
        bytes = bytes.slice(start, end);
        range = { offset: start, length: end - start };
      }
      return {
        ...describe(key, o),
        range,
        body: new Blob([bytes]).stream(),
        arrayBuffer: async () => bytes.slice().buffer,
        text: async () => new TextDecoder().decode(bytes),
        json: async () => JSON.parse(new TextDecoder().decode(bytes)),
      };
    },
    async head(key) {
      await wait();
      const o = objects.get(key);
      return o ? describe(key, o) : null;
    },
    async put(key, value, options = {}) {
      const bytes = await toBytes(value);
      await wait();
      const current = objects.get(key);
      if (!passes(current, options.onlyIf)) return null;
      const o = { bytes, etag: `e${(serial += 1)}`, uploaded: new Date(), httpMetadata: options.httpMetadata || {}, customMetadata: options.customMetadata || {} };
      objects.set(key, o);
      return describe(key, o);
    },
    async delete(keys) {
      await wait();
      for (const key of [].concat(keys)) objects.delete(key);
    },
    async list({ prefix = "", cursor, limit = 1000, include = [] } = {}) {
      await wait();
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = keys.slice(start, start + limit);
      const truncated = start + limit < keys.length;
      return {
        objects: page.map((k) => {
          const d = describe(k, objects.get(k));
          if (!include.includes("customMetadata")) delete d.customMetadata;
          return d;
        }),
        truncated,
        cursor: truncated ? String(start + limit) : undefined,
        delimitedPrefixes: [],
      };
    },
  };
}
