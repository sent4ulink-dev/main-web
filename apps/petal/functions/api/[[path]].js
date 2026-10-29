// Petal Isle's share-link server on Cloudflare Pages: this site's own /api/..., always awake. It is server/api.js
// (the same handler the Vite dev server uses) with the R2 bucket bound as SHARES and the secrets (STUDIO_PASSWORD,
// optionally SHARE_CREATE_SECRET) set on the Pages project. Only this site's own pages (and sent4u.link, which shows
// this card through its gateway: CORS_ORIGIN) may change things, and every write is checked against what was read, the
// request being run again when someone changed it meanwhile (edge/cardkit.js): Cloudflare may run several copies at once.
import { handleApi } from "../../server/api.js";
import { fromOtherSite, json, runGuarded } from "../../edge/cardkit.js";

const sitesAllowedToWrite = (env) => String(env.CORS_ORIGIN || "").split(",").map((site) => site.trim()).filter(Boolean);

export async function onRequest({ request, env }) {
  if (!env.SHARES) return json({ error: "not_configured" }, 503);
  if (fromOtherSite(request, sitesAllowedToWrite(env))) return json({ error: "forbidden" }, 403);
  return runGuarded(request, env.SHARES, (copy, bucket) => handleApi(copy, { ...env, PUBLIC_URL: "", SHARES: bucket }));
}
