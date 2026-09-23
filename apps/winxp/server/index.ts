import "dotenv/config";
import { createApp } from "./app.js";
import { configuredStorage } from "./storage.js";
if (!process.env.STUDIO_PASSWORD || process.env.STUDIO_PASSWORD.length < 8)
  throw new Error("Set server-only STUDIO_PASSWORD to at least 8 characters");
const app = createApp({
  storage: configuredStorage(),
  password: process.env.STUDIO_PASSWORD,
  origins: (process.env.CORS_ALLOWED_ORIGINS ?? "http://127.0.0.1:5173")
    .split(",")
    .map((s) => s.trim()),
  photoTtl:
    Math.max(1, Math.min(60, Number(process.env.PHOTO_TTL_MINUTES) || 15)) *
    60000,
});
app.listen(Number(process.env.PORT) || 3001, "0.0.0.0", () =>
  console.log(
    `Invitation API listening on port ${Number(process.env.PORT) || 3001}`,
  ),
);
