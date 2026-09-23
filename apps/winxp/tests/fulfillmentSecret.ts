// Matches the SHARE_CREATE_SECRET var playwright.config.ts passes to the wrangler dev
// instance it spawns for browser tests. The specs mint shares the same way the sent4u
// order Worker does: a direct POST to /shares/:id/ensure, gated by this secret.
export const testCreateSecret = "browser-test-fulfillment-secret-only";
