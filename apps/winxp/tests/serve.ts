import { createApp } from "../server/app";
import { MemoryStorage } from "../server/storage";
createApp({
  storage: new MemoryStorage(),
  password: "browser-test-password-only",
  origins: ["http://127.0.0.1:5174"],
}).listen(3002, "127.0.0.1");
