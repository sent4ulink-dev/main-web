// A stand-in for an R2 bucket that lives in memory: just the calls the Worker uses (get, put, delete, list),
// including R2's "only write if" preconditions (etagDoesNotMatch: "*" and etagMatches).
export function fakeBucket() {
  const store = new Map();
  const etags = new Map();
  let version = 0;
  const body = (key, value) => ({ etag: etags.get(key), text: async () => value, json: async () => JSON.parse(value) });
  return {
    store,
    async get(key) { return store.has(key) ? body(key, store.get(key)) : null; },
    async put(key, value, options) {
      const only = options && options.onlyIf;
      if (only && only.etagDoesNotMatch === '*' && store.has(key)) return null;   // R2: the precondition failed, nothing written
      if (only && only.etagMatches && etags.get(key) !== only.etagMatches) return null;
      store.set(key, String(value));
      etags.set(key, `v${++version}`);
      return { key };
    },
    async delete(key) { store.delete(key); etags.delete(key); },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [...store.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit);
      return { objects: keys.map(key => ({ key })) };
    },
  };
}
