// Shares live in R2, one object per id — the native binding, not the S3-compatible
// client the old Render/Express server needed (that client only existed to reach R2
// from outside Cloudflare; a Worker already has R2 right there as env.BUCKET).
export function createStorage(env) {
  return new R2Storage(env.BUCKET);
}

class R2Storage {
  constructor(bucket) {
    this.bucket = bucket;
  }
  key(id) {
    return `shares/${id}.json`;
  }
  async get(id) {
    const object = await this.bucket.get(this.key(id));
    return object ? await object.json() : null;
  }
  async put(id, record) {
    await this.bucket.put(this.key(id), JSON.stringify(record), {
      httpMetadata: { contentType: 'application/json' },
    });
  }
}
