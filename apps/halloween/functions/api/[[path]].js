// The invitation's server on Cloudflare Pages: this site's own /api/..., always
// awake. It is server/api.js with the R2 bucket bound as SHARES and the secrets
// (STUDIO_PASSWORD, and optionally SHARE_CREATE_SECRET) set on the Pages
// project. Changes are accepted only from this site's own pages (CORS_ORIGIN
// defaults to the site's address), and every write is checked against what was
// read, the whole request being run again when someone changed it meanwhile
// (runGuarded, edge/cardkit.js): Cloudflare may run several copies at once.
import api from '../../server/api.js';
import { runGuarded } from '../../edge/cardkit.js';

export async function onRequest({ request, env }) {
  if (!env.SHARES) return Response.json({ error: 'Invitation storage is not connected.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const settings = { ...env, CORS_ORIGIN: env.CORS_ORIGIN || new URL(request.url).origin };
  return runGuarded(request, env.SHARES, (copy, bucket) => api.fetch(copy, { ...settings, SHARES: bucket }));
}
