// A stand-in for an R2 bucket that lives in memory: just the calls the Worker uses (get, put, delete, list).
export function fakeBucket() {
  const store = new Map();
  const body = value => ({ text: async () => value, json: async () => JSON.parse(value) });
  return {
    store,
    async get(key) { return store.has(key) ? body(store.get(key)) : null; },
    async put(key, value, options) {
      if (options && options.onlyIf && options.onlyIf.etagDoesNotMatch === '*' && store.has(key)) return null;  // R2: the precondition failed, nothing written
      store.set(key, String(value));
      return { key };
    },
    async delete(key) { store.delete(key); },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [...store.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit);
      return { objects: keys.map(key => ({ key })) };
    },
  };
}
