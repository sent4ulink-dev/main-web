import { createApp } from "../server/app";
import { MemoryStorage } from "../server/storage";
import { testCreateSecret } from "./fulfillmentSecret";
createApp({
  storage: new MemoryStorage(),
  createSecret: testCreateSecret,
  origins: ["http://127.0.0.1:5174"],
}).listen(3002, "127.0.0.1");
