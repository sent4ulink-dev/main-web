import "dotenv/config";
import { createApp } from "./app.js";
import { configuredStorage } from "./storage.js";
const app = createApp({
  storage: configuredStorage(),
  createSecret: process.env.SHARE_CREATE_SECRET,
  ordersApiBase: process.env.ORDERS_API_BASE,
  origins: (process.env.CORS_ALLOWED_ORIGINS ?? "http://127.0.0.1:5173")
    .split(",")
    .map((s) => s.trim()),
  photoTtl:
    Math.max(1, Math.min(60, Number(process.env.PHOTO_TTL_MINUTES) || 15)) *
    60000,
});
app.listen(Number(process.env.PORT) || 3001, "0.0.0.0", () => {
  console.log(
    `Invitation API listening on port ${Number(process.env.PORT) || 3001}`,
  );
  console.log(
    `Fulfillment /ensure: ${process.env.SHARE_CREATE_SECRET ? "secret-gated" : "OPEN (SHARE_CREATE_SECRET unset)"}`,
  );
});
