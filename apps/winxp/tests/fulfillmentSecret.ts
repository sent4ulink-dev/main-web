// Shared between tests/serve.ts (the browser-test API server) and the Playwright
// specs, which mint shares the same way the sent4u order Worker does: a direct
// POST to /shares/:id/ensure, gated by this secret.
export const testCreateSecret = "browser-test-fulfillment-secret-only";
