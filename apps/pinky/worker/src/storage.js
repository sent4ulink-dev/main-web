// Shares live in R2, one object per id — the native binding, not the S3-compatible
// client the old Render/Express server needed (that client only existed to reach R2
// from outside Cloudflare; a Worker already has R2 right there as env.BUCKET).
const KEY_PREFIX = 'shares/';

function keyFor(id) {
  return `${KEY_PREFIX}${id}`;
}

export async function getShare(bucket, id) {
  const object = await bucket.get(keyFor(id));
  return object ? await object.json() : null;
}

export async function putShare(bucket, id, data) {
  await bucket.put(keyFor(id), JSON.stringify(data), {
    httpMetadata: { contentType: 'application/json' },
  });
}
