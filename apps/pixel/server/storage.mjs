import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

function r2Configured(env) {
  return Boolean(
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET,
  );
}

export function createStorage(env = process.env) {
  return r2Configured(env)
    ? new R2Storage(env)
    : new JsonStorage(env.DATA_FILE);
}

class JsonStorage {
  constructor(file) {
    this.file = resolve(file || 'server/data/shares.json');
    this.pending = Promise.resolve();
  }

  async readAll() {
    try {
      return JSON.parse(await readFile(this.file, 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') return {};
      throw error;
    }
  }

  async writeAll(records) {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(records, null, 2));
    await rename(temporary, this.file);
  }

  async get(id) {
    return (await this.readAll())[id] ?? null;
  }

  async put(id, record) {
    this.pending = this.pending.then(async () => {
      const records = await this.readAll();
      records[id] = record;
      await this.writeAll(records);
    });
    await this.pending;
  }

  async list() {
    return Object.values(await this.readAll());
  }
}

class R2Storage {
  constructor(env) {
    this.bucket = env.R2_BUCKET;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  key(id) {
    return `shares/${id}.json`;
  }

  async get(id) {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.key(id) }),
      );
      return JSON.parse(await response.Body.transformToString());
    } catch (error) {
      if (
        error?.name === 'NoSuchKey' ||
        error?.$metadata?.httpStatusCode === 404
      )
        return null;
      throw error;
    }
  }

  async put(id, record) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(id),
        Body: JSON.stringify(record),
        ContentType: 'application/json',
      }),
    );
  }

  async list() {
    const records = [];
    let token;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: 'shares/',
          ContinuationToken: token,
        }),
      );
      for (const object of page.Contents ?? []) {
        const match = object.Key?.match(/^shares\/(.+)\.json$/);
        if (!match) continue;
        const record = await this.get(match[1]);
        if (record) records.push(record);
      }
      token = page.NextContinuationToken;
    } while (token);
    return records;
  }
}
