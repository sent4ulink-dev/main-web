// Shares live in R2, one object per id — the native binding, not the S3-compatible
// client the old Render/Express server needed (that client only existed to reach R2
// from outside Cloudflare; a Worker already has R2 right there as env.BUCKET).
//
// The old Express server serialized every share mutation through one in-process
// queue, so a finalize racing an update could never lose one of them. A Worker has no
// such single queue (different requests can land on different isolates), so this uses
// R2's conditional write instead — the same compare-and-swap pattern the orders
// Worker already uses for order/link mutations (see /worker at the repo root):
// read the current object's etag, write back only `onlyIf` it hasn't changed
// underneath you, and retry from a fresh read when it has.
import { shareSchema, type Share } from "../../shared/content.js";

export interface StoredShare {
  share: Share;
  etag: string;
}

export interface Storage {
  get(id: string): Promise<StoredShare | null>;
  /** True if created, false if a share already existed at this id (left untouched). */
  create(share: Share): Promise<boolean>;
  /** True if written, false if the object changed since `etag` was read (caller should re-read and retry). */
  put(share: Share, etag: string): Promise<boolean>;
}

function keyFor(id: string) {
  return `shares/${id}.json`;
}

export function createStorage(bucket: R2Bucket): Storage {
  return {
    async get(id) {
      const object = await bucket.get(keyFor(id));
      if (!object) return null;
      return { share: shareSchema.parse(await object.json()), etag: object.etag };
    },
    async create(share) {
      const parsed = shareSchema.parse(share);
      const result = await bucket.put(keyFor(share.id), JSON.stringify(parsed), {
        httpMetadata: { contentType: "application/json" },
        onlyIf: { etagDoesNotMatch: "*" },
      });
      return result !== null;
    },
    async put(share, etag) {
      const parsed = shareSchema.parse(share);
      const result = await bucket.put(keyFor(share.id), JSON.stringify(parsed), {
        httpMetadata: { contentType: "application/json" },
        onlyIf: { etagMatches: etag },
      });
      return result !== null;
    },
  };
}
