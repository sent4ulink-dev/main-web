// A stand-in for a KV namespace that lives in memory: get/put/delete, with put's
// expirationTtl actually expiring entries (checked against the real clock, so a test
// that wants to see something expire moves it into the past directly via `store`,
// the same way the R2 rate-limit tests do — see fake-bucket.mjs).
export function fakeKV() {
  const store = new Map(); // key -> { value, expiresAt }
  return {
    store,
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key, value, options) {
      const expiresAt = options && options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined;
      store.set(key, { value: String(value), expiresAt });
    },
    async delete(key) {
      store.delete(key);
    },
  };
}
