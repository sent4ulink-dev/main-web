/* sent4u gateway — the Worker behind sent4u.link itself.

   Every invitation link is the same shape, no matter which of the three apps it's for:
   sent4u.link/?share=<id>. This Worker decides which app that id belongs to and reverse-
   proxies the request there, so the app's real domain (wherever it's actually hosted)
   never shows up in the address bar. Everything else — the marketing site, reviews,
   pricing — is served straight from this Worker's own static assets, unchanged.

   How an id resolves to a product:
     - test-pixel / test-pinky / test-winxp   the three "Open live demo" links on the
                                               marketing site — always resolve locally,
                                               no network call, no such thing exists in
                                               the orders Worker (demo ids are never real).
     - anything else                          asked of the orders Worker's GET /links/:id
                                               (see /worker). A real id only resolves once
                                               it's actually been paid for.

   Only the top-level document (path "/") ever carries ?share=; a proxied app's own JS,
   CSS, fonts, etc. are plain same-origin requests with no query string to read the id
   from. So once a document is proxied for a given product, this Worker remembers that
   choice in a short-lived cookie and uses it to keep routing that browser's follow-up
   asset requests to the same app — falling back to this site's own assets if the app
   doesn't have the file, so a stale cookie can never break normal marketing-site
   browsing.

   The orders Worker's own browser-facing routes (checkout, orders, sign-in) are also
   proxied straight through, unconditionally — not because of ?share=, but so the
   sign-in session cookie those set is a first-party sent4u.link cookie rather than one
   shared cross-site with the orders Worker's own *.workers.dev address (which browsers
   increasingly restrict or block outright). Reviews and claims don't need this — they
   never read a cookie — so they're left on the direct cross-origin data-api call they
   already use. */

const DEMO_PRODUCTS = {
  'test-pixel': 'pixel',
  'test-pinky': 'pinky',
  'test-winxp': 'winxp',
};
const PRODUCTS = ['pixel', 'pinky', 'winxp'];
const COOKIE_NAME = 's4u_app';
const COOKIE_MAX_AGE = 6 * 60 * 60; // 6 hours — long enough for one browsing session
const API_PATHS = [/^\/auth\//, /^\/me$/, /^\/checkout$/, /^\/orders\//];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (API_PATHS.some(re => re.test(url.pathname))) {
      const ordersApiBase = (env.ORDERS_API_BASE ?? '').replace(/\/$/, '');
      if (!ordersApiBase) return new Response('Not configured.', { status: 501 });
      return proxy(ordersApiBase, request);
    }
    if (url.pathname === '/') {
      const shareId = url.searchParams.get('share');
      const product = shareId ? await resolveProduct(shareId, env) : null;
      const origin = product && originFor(product, env);
      if (origin) return withAppCookie(await proxy(origin, request), product);
      // No id, an id nobody recognizes, or a recognized product that isn't deployed yet:
      // show the marketing site, and drop any stale app cookie so it can't misroute the
      // asset requests this same page is about to make.
      return withClearedAppCookie(await env.ASSETS.fetch(request));
    }
    const cookieProduct = readCookie(request, COOKIE_NAME);
    const origin = cookieProduct && originFor(cookieProduct, env);
    if (origin) {
      const proxied = await proxy(origin, request);
      if (proxied.status !== 404) return proxied;
    }
    return env.ASSETS.fetch(request);
  },
};

async function resolveProduct(id, env) {
  if (id in DEMO_PRODUCTS) return DEMO_PRODUCTS[id];
  const ordersApiBase = (env.ORDERS_API_BASE ?? '').replace(/\/$/, '');
  if (!ordersApiBase) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${ordersApiBase}/links/${encodeURIComponent(id)}`, {
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
  const value = { pixel: env.PIXEL_ORIGIN, pinky: env.PINKY_ORIGIN, winxp: env.WINXP_ORIGIN }[product];
  return value ? value.replace(/\/$/, '') : null;
}

async function proxy(origin, request) {
  const target = new URL(request.url);
  const upstream = new URL(origin);
  target.protocol = upstream.protocol;
  target.host = upstream.host;
  const proxied = new Request(target, request);
  proxied.headers.set('Host', upstream.host);
  return fetch(proxied);
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
    `${COOKIE_NAME}=${product}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`,
  );
  return next;
}

function withClearedAppCookie(response) {
  const next = new Response(response.body, response);
  next.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`);
  return next;
}
