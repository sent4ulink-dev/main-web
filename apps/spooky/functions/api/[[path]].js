// The card's server on Cloudflare Pages: this site's own /api/..., always awake. It is server/api.js with
// the R2 bucket bound as SHARES and the secrets (STUDIO_PASSWORD, optionally SHARE_CREATE_SECRET and
// PUBLIC_ORIGIN) set on the Pages project. Every write is checked against what was read, and the request
// run again if someone changed it meanwhile (runGuarded, edge/cardkit.js): Cloudflare may run several copies.
import api from '../../server/api.js';
import { runGuarded } from '../../edge/cardkit.js';

export async function onRequest({ request, env }) {
  if (!env.SHARES) return Response.json({ error: 'Card storage is not connected.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const settings = { ...env, CORS_ORIGIN: env.CORS_ORIGIN || new URL(request.url).origin };
  return runGuarded(request, env.SHARES, (copy, bucket) => api.fetch(copy, { ...settings, SHARES: bucket }));
}
