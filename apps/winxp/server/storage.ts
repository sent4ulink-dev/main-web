import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { shareSchema, type Share } from "../shared/content.js";
export interface Storage {
  get(id: string): Promise<Share | null>;
  put(share: Share): Promise<void>;
  list(): Promise<Share[]>;
}
export class MemoryStorage implements Storage {
  records = new Map<string, Share>();
  async get(id: string) {
    return structuredClone(this.records.get(id) ?? null);
  }
  async put(s: Share) {
    this.records.set(s.id, structuredClone(s));
  }
  async list() {
    return structuredClone([...this.records.values()]);
  }
}
export class JsonStorage implements Storage {
  private cache: Map<string, Share> | null = null;
  constructor(private file: string) {}
  private async load() {
    if (this.cache) return this.cache;
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(this.file, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") raw = [];
      else
        throw new Error(
          "Cannot load share storage; existing file was preserved",
        );
    }
    if (!Array.isArray(raw)) throw new Error("Invalid storage format");
    const values = raw.map((v) => shareSchema.parse(v));
    this.cache = new Map(values.map((s) => [s.id, s]));
    return this.cache;
  }
  async get(id: string) {
    return structuredClone((await this.load()).get(id) ?? null);
  }
  async list() {
    return structuredClone([...(await this.load()).values()]);
  }
  async put(s: Share) {
    const next = new Map(await this.load());
    next.set(s.id, shareSchema.parse(s));
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${randomBytes(8).toString("hex")}.tmp`;
    await writeFile(tmp, JSON.stringify([...next.values()]), { mode: 0o600 });
    await rename(tmp, this.file);
    this.cache = next;
  }
}
export class R2Storage implements Storage {
  constructor(
    private client: S3Client,
    private bucket: string,
  ) {}
  async get(id: string) {
    try {
      const r = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: `shares/${id}.json` }),
      );
      const parsed = shareSchema.parse(
        JSON.parse(await r.Body!.transformToString()),
      );
      if (parsed.id !== id) throw new Error("Mismatched stored ID");
      return parsed;
    } catch (e) {
      if (
        (e as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      )
        return null;
      throw e;
    }
  }
  async put(s: Share) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `shares/${s.id}.json`,
        Body: JSON.stringify(shareSchema.parse(s)),
        ContentType: "application/json",
      }),
    );
  }
  async list() {
    const shares: Share[] = [];
    let cursor: string | undefined;
    do {
      const r = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: "shares/",
          ContinuationToken: cursor,
        }),
      );
      for (const item of r.Contents ?? []) {
        const match = item.Key?.match(/^shares\/([A-Za-z0-9_-]{8})\.json$/);
        if (match) {
          const s = await this.get(match[1]);
          if (s) shares.push(s);
        }
      }
      cursor = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (cursor);
    return shares;
  }
}
export function configuredStorage() {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
  } = process.env;
  if (
    [
      R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME,
    ].some(Boolean) &&
    ![
      R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME,
    ].every(Boolean)
  )
    throw new Error("Set all four R2 variables, or none");
  return R2_ACCOUNT_ID &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_BUCKET_NAME
    ? new R2Storage(
        new S3Client({
          region: "auto",
          endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
          },
        }),
        R2_BUCKET_NAME,
      )
    : new JsonStorage(process.env.DATA_FILE ?? "./data/shares.json");
}
