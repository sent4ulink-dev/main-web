import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import { randomBytes } from "node:crypto";
import { inflateSync } from "node:zlib";
import { z } from "zod";
import { contentSchema, type Share } from "../shared/content.js";
import type { Storage } from "./storage.js";
import { StudioAuth } from "./auth.js";
const ID = /^[A-Za-z0-9_-]{8}$/;
export function createApp(options: {
  storage: Storage;
  password: string;
  origins?: string[];
  now?: () => number;
  photoTtl?: number;
  randomId?: () => string;
}) {
  const app = express(),
    now = options.now ?? Date.now,
    auth = new StudioAuth(options.password, now),
    photos = new Map<string, { data: Buffer; until: number }>(),
    uploads = new Map<string, { count: number; until: number }>();
  let photoBytes = 0;
  let queue: Promise<unknown> = Promise.resolve();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || options.origins?.includes(origin)) cb(null, true);
        else cb(new Error("Origin not allowed"));
      },
    }),
  );
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    next();
  });
  app.use(express.json({ limit: "40kb" }));
  const route =
    (fn: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve()
        .then(() => fn(req, res))
        .catch(next);
    };
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const job = queue.then(fn);
    queue = job.catch(() => {});
    return job;
  };
  const requireId = (req: Request, res: Response) => {
    if (!ID.test(String(req.params.id))) {
      res.status(400).json({ status: "invalid", message: "Invalid share ID" });
      return false;
    }
    return true;
  };
  const authorize = (req: Request, res: Response) => {
    if (
      !auth.authorized(req.headers.authorization?.replace(/^Bearer /, "") ?? "")
    ) {
      res
        .status(401)
        .json({ status: "unauthorized", message: "Unlock Studio again" });
      return false;
    }
    return true;
  };
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.post(
    "/api/studio/unlock",
    route(async (req, res) => {
      const b = z
        .object({ password: z.string().max(1024) })
        .strict()
        .parse(req.body);
      const result = auth.unlock(req.ip ?? "unknown", b.password);
      res
        .status(
          result.status === "ok" ? 200 : result.status === "wrong" ? 401 : 429,
        )
        .json(result);
    }),
  );
  app.post(
    "/shares",
    route(async (req, res) => {
      if (!authorize(req, res)) return;
      const content = contentSchema.parse(req.body);
      await serial(async () => {
        let id = "";
        for (let i = 0; i < 32; i++) {
          id = (
            options.randomId ?? (() => randomBytes(6).toString("base64url"))
          )();
          if (id !== "test" && ID.test(id) && !(await options.storage.get(id)))
            break;
          id = "";
        }
        if (!id) throw new Error("Unable to allocate share ID");
        const createdAt = now();
        const share: Share = {
          id,
          content,
          createdAt,
          editUntil: createdAt + 5 * 86400000,
          finalized: false,
        };
        await options.storage.put(share);
        res.status(201).json({
          status: "ok",
          id,
          editUntil: share.editUntil,
          finalized: false,
          share,
        });
      });
    }),
  );
  app.get(
    "/shares/:id",
    route(async (req, res) => {
      if (!requireId(req, res)) return;
      const share = await options.storage.get(String(req.params.id));
      if (!share)
        return res
          .status(404)
          .json({ status: "missing", message: "Invitation not found" });
      return res.json({ status: "ok", share });
    }),
  );
  const mutate = (finalize: boolean) =>
    route(async (req, res) => {
      if (!requireId(req, res)) return;
      const content = finalize ? null : contentSchema.parse(req.body);
      await serial(async () => {
        const s = await options.storage.get(String(req.params.id));
        if (!s) return res.status(404).json({ status: "missing" });
        if (s.finalized) return res.status(409).json({ status: "finalized" });
        if (s.editUntil <= now())
          return res.status(410).json({ status: "expired" });
        const updated = {
          ...s,
          ...(finalize ? { finalized: true } : { content: content! }),
        };
        await options.storage.put(updated);
        return res.json({ status: "ok", share: updated });
      });
    });
  app.put("/shares/:id", mutate(false));
  app.post("/shares/:id/finalize", mutate(true));
  app.get(
    "/stats",
    route(async (_req, res) => {
      const shares = await options.storage.list();
      res.json({
        status: "ok",
        total: shares.length,
        active: shares.filter((s) => !s.finalized && s.editUntil > now())
          .length,
        finalized: shares.filter((s) => s.finalized).length,
        expired: shares.filter((s) => !s.finalized && s.editUntil <= now())
          .length,
      });
    }),
  );
  const cleanup = () => {
    auth.cleanup();
    for (const [id, p] of photos)
      if (p.until <= now()) {
        photoBytes -= p.data.length;
        photos.delete(id);
      }
    for (const [ip, u] of uploads) if (u.until <= now()) uploads.delete(ip);
  };
  const interval = setInterval(cleanup, 60000);
  interval.unref();
  app.locals.dispose = () => clearInterval(interval);
  app.post(
    "/photos",
    express.raw({ type: "image/png", limit: "5mb" }),
    route(async (req, res) => {
      cleanup();
      const data = req.body as unknown;
      if (!Buffer.isBuffer(data) || !validPng(data))
        return res.status(400).json({
          status: "invalid",
          message: "A valid 1080 × 1920 PNG is required",
        });
      const ip = req.ip ?? "unknown";
      const u = uploads.get(ip) ?? { count: 0, until: now() + 60000 };
      if (u.count >= 6)
        return res.status(429).json({
          status: "limited",
          message: "Please wait a minute before creating another image",
        });
      if (photoBytes + data.length > 64 * 1024 * 1024)
        return res.status(503).json({
          status: "full",
          message: "Image storage is full; try again shortly",
        });
      u.count++;
      uploads.set(ip, u);
      const id = randomBytes(18).toString("base64url");
      photos.set(id, { data, until: now() + (options.photoTtl ?? 15 * 60000) });
      photoBytes += data.length;
      return res.status(201).json({
        status: "ok",
        path: `/photos/${id}`,
        expiresAt: photos.get(id)!.until,
      });
    }),
  );
  app.get(
    "/photos/:id",
    route(async (req, res) => {
      cleanup();
      const id = String(req.params.id);
      if (!/^[A-Za-z0-9_-]{24}$/.test(id))
        return res.status(400).json({ status: "invalid" });
      const photo = photos.get(id);
      if (!photo)
        return res.status(404).json({
          status: "expired",
          message: "This temporary image has expired",
        });
      return res
        .type("png")
        .set("Content-Disposition", 'inline; filename="our-date.png"')
        .send(photo.data);
    }),
  );
  app.use((_req, res) =>
    res.status(404).json({ status: "missing", message: "Endpoint not found" }),
  );
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      void _next;
      const status =
        error instanceof z.ZodError
          ? 400
          : ((error as { status?: number }).status ?? 500);
      res.status(status).json({
        status: status === 400 ? "invalid" : "error",
        message:
          status === 400
            ? "Invalid request content"
            : status === 413
              ? "Request too large"
              : "The request could not be completed. Please try again.",
      });
    },
  );
  return app;
}
function crc32(data: Buffer) {
  let c = 0xffffffff;
  for (const byte of data) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
export function validPng(data: Buffer) {
  try {
    if (
      !data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      return false;
    let offset = 8,
      header = false,
      end = false;
    const chunks: Buffer[] = [];
    while (offset + 12 <= data.length) {
      const size = data.readUInt32BE(offset),
        type = data.toString("ascii", offset + 4, offset + 8),
        finish = offset + 12 + size;
      if (finish > data.length) return false;
      const body = data.subarray(offset + 8, offset + 8 + size);
      if (
        crc32(data.subarray(offset + 4, offset + 8 + size)) !==
        data.readUInt32BE(offset + 8 + size)
      )
        return false;
      if (!header) {
        if (
          type !== "IHDR" ||
          size !== 13 ||
          body.readUInt32BE(0) !== 1080 ||
          body.readUInt32BE(4) !== 1920 ||
          body[8] !== 8 ||
          ![2, 6].includes(body[9]) ||
          body[10] !== 0 ||
          body[11] !== 0 ||
          body[12] !== 0
        )
          return false;
        header = true;
      } else if (type === "IHDR") return false;
      if (type === "IDAT") chunks.push(body);
      if (type === "IEND") {
        end = size === 0 && finish === data.length;
        break;
      }
      offset = finish;
    }
    if (!end || !chunks.length) return false;
    const inflated = inflateSync(Buffer.concat(chunks), {
      maxOutputLength: 1080 * 1920 * 4 + 1920,
    });
    return inflated.length === (1080 * (data[25] === 6 ? 4 : 3) + 1) * 1920;
  } catch {
    return false;
  }
}
