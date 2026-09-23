import type { APIRequestContext } from "@playwright/test";
import { testCreateSecret } from "../fulfillmentSecret";
// There is no public studio any more: a real invitation only ever comes into
// existence because the sent4u order Worker calls POST /shares/:id/ensure
// server-to-server. These specs mint shares the same way, directly against the
// browser-test API server (tests/serve.ts), then load /?share=<id> like a buyer
// would after checkout.
export function freshId() {
  return `Test${crypto.randomUUID().replace(/-/g, "")}`.slice(0, 20);
}
export async function mintShare(
  request: APIRequestContext,
  id = freshId(),
): Promise<string> {
  const response = await request.post(
    `http://127.0.0.1:3002/shares/${id}/ensure`,
    { headers: { "x-date-create-secret": testCreateSecret } },
  );
  if (!response.ok())
    throw new Error(`Failed to mint share ${id}: ${response.status()}`);
  return id;
}
