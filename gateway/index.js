/* sent4u gateway — the Worker behind sent4u.link itself.

   Every invitation link is the same shape, no matter which of the apps (styles) it's for:
   sent4u.link/?share=<id>. This Worker decides which app that id belongs to and reverse-
   proxies the request there, so the app's real domain (wherever it's actually hosted)
   never shows up in the address bar. Everything else — the marketing site, reviews,
   pricing — is served straight from this Worker's own static assets, unchanged.

   How an id resolves to a product:
     - test-<style>                           the "Open live demo" links on the marketing
                                               site (test-pixel, test-picnic, ...) — always
                                               resolve locally, no network call, no such
                                               thing exists in the orders Worker (demo ids
                                               are never real).
     - anything else                          asked of the orders Worker's GET /links/:id
                                               (see /worker). A real id only resolves once
                                               it's actually been paid for.

   Only the top-level document (path "/") ever carries ?share=; a proxied app's own JS,
   CSS, fonts, etc. are plain same-origin requests with no query string to read the id
   from. So once a document is proxied for a given product, this Worker remembers that
   choice in a short-lived cookie and uses it to keep routing that browser's follow-up
   asset requests to the same app — falling back to this site's own assets if the app
   doesn't have the file, so a stale cookie can never break normal marketing-site
   browsing. (This site's own /assets/, /vendor/ and page scripts never reach this Worker
   at all: Cloudflare serves them straight from storage, see run_worker_first in
   wrangler.jsonc. An app's own files have names this site doesn't use, so they miss
   storage and still arrive here.)

   The orders Worker's own browser-facing routes (checkout, orders, sign-in) are also
   proxied straight through, unconditionally — not because of ?share=, but so the
   sign-in session cookie those set is a first-party sent4u.link cookie rather than one
   shared cross-site with the orders Worker's own *.workers.dev address (which browsers
   increasingly restrict or block outright). Reviews and claims don't need this — they
   never read a cookie — so they're left on the direct cross-origin data-api call they
   already use. */

// Every style and the env var holding where it's deployed. A style whose origin isn't set yet just falls
// through to the marketing site, so a new one can be added here before it's live.
const ORIGIN_VARS = {
  pixel: 'PIXEL_ORIGIN',
  pinky: 'PINKY_ORIGIN',
  winxp: 'WINXP_ORIGIN',
  petal: 'PETAL_ORIGIN',
  picnic: 'PICNIC_ORIGIN',
  salon: 'SALON_ORIGIN',
  mission: 'MISSION_ORIGIN',
  halloween: 'HALLOWEEN_ORIGIN',
  spooky: 'SPOOKY_ORIGIN',
  thanksgiving: 'THANKSGIVING_ORIGIN',
};
const PRODUCTS = Object.keys(ORIGIN_VARS);
// Thanksgiving's family guest link (/?guest=<id>, made by that card's own server for everyone at the table) opens
// Thanksgiving: it is the only style that makes guest links.
const guestOf = (id) => (id && /^[A-Za-z0-9_-]{16,64}$/.test(id) ? 'thanksgiving' : null);
const DEMO_PRODUCTS = Object.fromEntries(PRODUCTS.map(p => [`test-${p}`, p]));
const COOKIE_NAME = 's4u_app';
const COOKIE_MAX_AGE = 6 * 60 * 60; // 6 hours — long enough for one browsing session
const API_PATHS = [/^\/auth\//, /^\/me$/, /^\/checkout$/, /^\/orders\//];
const SITE_PAGES = /^\/(pay|terms|privacy|refunds)(\.html)?\/?$/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (API_PATHS.some(re => re.test(url.pathname))) {
      const ordersApiBase = (env.ORDERS_API_BASE ?? '').replace(/\/$/, '');
      if (!ordersApiBase) return new Response('Not configured.', { status: 501 });
      return proxy(ordersApiBase, request, env.ORDERS);
    }
    // The site's own pages (checkout, legal) are never an app's: an app answers any unknown path with its own page, so a
    // buyer who looked at a card a moment ago would otherwise get that card instead of the payment window. These pages also
    // drop the cookie, like the home page, so the style sheet and scripts they load come from this site too.
    if (SITE_PAGES.test(url.pathname)) return withClearedAppCookie(await env.ASSETS.fetch(request));
    if (url.pathname === '/') {
      const shareId = url.searchParams.get('share');
      const product = shareId ? await resolveProduct(shareId, env) : guestOf(url.searchParams.get('guest'));
      const origin = product && originFor(product, env);
      if (origin) return withAppCookie(await proxyApp(origin, request), product);
      // No id, an id nobody recognizes, or a recognized product that isn't deployed yet:
      // show the marketing site, and drop any stale app cookie so it can't misroute the
      // asset requests this same page is about to make.
      return withClearedAppCookie(await env.ASSETS.fetch(request));
    }
    const appProduct = await productOfPage(request, url, env) || readCookie(request, COOKIE_NAME);
    const origin = appProduct && originFor(appProduct, env);
    if (origin) {
      const proxied = await proxyApp(origin, request);
      // an app's own API answers 404 with a JSON body its page understands: pass that through as it is
      if (url.pathname.startsWith('/api/')) return proxied;
      // a Pages app answers a file it doesn't have with its own index.html (status 200): that's a miss too
      const pageForAFile = /\.[a-z0-9]{2,5}$/i.test(url.pathname) && !url.pathname.endsWith('.html')
        && (proxied.headers.get('Content-Type') || '').startsWith('text/html');
      if (proxied.status !== 404 && !pageForAFile) return proxied;
    }
    return env.ASSETS.fetch(request);
  },
};

// Which app the page asking for this file is showing, from its Referer (sent4u.link/?share=<id>). A buyer with several
// links open in tabs has one cookie but many pages: without this, the tab opened first would load its sounds and pictures
// from whichever card was opened last. Files asked for by a style sheet or script carry that file as the Referer
// instead, and fall back to the cookie.
async function productOfPage(request, url, env) {
  const referer = request.headers.get('Referer');
  if (!referer) return null;
  try {
    const page = new URL(referer);
    if (page.origin !== url.origin || page.pathname !== '/') return null;
    const id = page.searchParams.get('share');
    return id ? await resolveProduct(id, env, { cached: true }) : guestOf(page.searchParams.get('guest'));
  } catch {
    return null;
  }
}

// Real ids already looked up, so a page's dozens of file requests don't each ask the orders Worker again. Only the
// files use this: the page itself is always checked fresh, so a refunded link stops working at once.
const knownLinks = new Map();
const KNOWN_FOR_MS = 10 * 60 * 1000;

async function resolveProduct(id, env, { cached = false } = {}) {
  if (id in DEMO_PRODUCTS) return DEMO_PRODUCTS[id];
  const known = knownLinks.get(id);
  if (cached && known && known.until > Date.now()) return known.product;
  const product = await lookUpLink(id, env);
  if (product) {
    if (knownLinks.size > 5000) knownLinks.clear();
    knownLinks.set(id, { product, until: Date.now() + KNOWN_FOR_MS });
  }
  return product;
}

async function lookUpLink(id, env) {
  const ordersApiBase = (env.ORDERS_API_BASE ?? '').replace(/\/$/, '');
  if (!ordersApiBase) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await (env.ORDERS || globalThis).fetch(`${ordersApiBase}/links/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    });
    if (!r.ok) return null;
    const body = await r.json();
    return PRODUCTS.includes(body.product) ? body.product : null;
  } catch (err) {
    console.warn(`Gateway: link lookup failed for ${id}:`, err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function originFor(product, env) {
  const value = env[ORIGIN_VARS[product]];
  return value ? value.replace(/\/$/, '') : null;
}

// The orders Worker is reached through its service binding (ORDERS in wrangler.jsonc) when there is one: a request to its public
// workers.dev address arrives with Cloudflare's own address as CF-Connecting-IP, so every visitor would share one rate-limit counter.
async function proxy(origin, request, binding = null) {
  const target = new URL(request.url);
  const upstream = new URL(origin);
  target.protocol = upstream.protocol;
  target.host = upstream.host;
  const proxied = new Request(target, request);
  proxied.headers.set('Host', upstream.host);
  return binding ? binding.fetch(proxied) : fetch(proxied);
}

// A card app gets no cookies (sent4u.link's are the sign-in session's and this gateway's own, and no app uses any) and can set none:
// the apps are other sites served under this address, and must never see or replace the session.
async function proxyApp(origin, request) {
  const outgoing = new Request(request);
  outgoing.headers.delete('Cookie');
  const response = await proxy(origin, outgoing);
  if (!response.headers.has('Set-Cookie')) return response;
  const next = new Response(response.body, response);
  next.headers.delete('Set-Cookie');
  return next;
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function withAppCookie(response, product) {
  const next = new Response(response.body, response);
  next.headers.append(
    'Set-Cookie',
    `${COOKIE_NAME}=${product}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly; Secure`,
  );
  return next;
}

function withClearedAppCookie(response) {
  const next = new Response(response.body, response);
  next.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure`);
  return next;
}
