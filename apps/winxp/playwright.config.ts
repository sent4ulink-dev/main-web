import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 90000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      // See tests/fulfillmentSecret.ts for why this exact secret value.
      command:
        'npx wrangler dev --config worker/wrangler.toml --port 3002 --var SHARE_CREATE_SECRET:browser-test-fulfillment-secret-only --var CORS_ALLOWED_ORIGINS:http://127.0.0.1:5174',
      url: "http://127.0.0.1:3002/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      env: { DEV_API_TARGET: "http://127.0.0.1:3002" },
      reuseExistingServer: false,
    },
  ],
});
