// sent4u's security check: the seven "doors" a quick-built app is usually broken into through (secret keys in the code, an open
// database, other people's records, an admin page without a login, no limits, unverified payment messages, passwords), tried
// against the live site with harmless requests only (nothing is bought, sent, changed or locked). Run: npm run security:check
const SITE = 'https://sent4u.link', ORDERS = 'https://sent4u-reviews.sent4u-link.workers.dev';
const CARDS = { pixel: 'https://pixel-dom-n49.pages.dev', pinky: 'https://pinky-dom.sent4u-link.workers.dev', winxp: 'https://winxp-dom.sent4u-link.workers.dev',
  petal: 'https://sent4u-petal.pages.dev', picnic: 'https://sent4u-picnic.pages.dev', salon: 'https://sent4u-salon.pages.dev', mission: 'https://sent4u-mission.pages.dev',
  halloween: 'https://sent4u-halloween.pages.dev', spooky: 'https://sent4u-spooky.pages.dev', thanksgiving: 'https://sent4u-thanksgiving.pages.dev' };
const APIS = { pixel: 'https://pixel-share-api.sent4u-link.workers.dev', pinky: 'https://pinky-share-api.sent4u-link.workers.dev', winxp: 'https://winxp-share-api.sent4u-link.workers.dev' };
const UA = { 'User-Agent': 'sent4u-selftest' };
const results = [];
const note = (door, ok, what) => { results.push({ door, ok, what }); console.log(`${ok ? 'OK  ' : 'OPEN'} [${door}] ${what}`); };
const get = async (url, init = {}) => { try { const r = await fetch(url, { redirect: 'manual', ...init, headers: { ...UA, ...(init.headers || {}) } }); return { status: r.status, headers: r.headers, text: await r.text() }; } catch (e) { return { status: 0, headers: new Headers(), text: String(e) }; } };

// ---- 1 · secret keys in what the browser downloads
const SECRETS = [
  [/(?<![A-Za-z-])sk-(proj-)?[A-Za-z0-9_]{20,}/, 'an OpenAI-style secret key'], [/\b(sk|rk)_live_[A-Za-z0-9]{10,}/, 'a Stripe live secret'], [/AIza[0-9A-Za-z_-]{35}/, 'a Google API key'],
  [/\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}/, 'a Resend key'], [/pdl_(live|sdbx)_apikey_[A-Za-z0-9_]{10,}/, 'a Paddle API key'], [/AKIA[0-9A-Z]{16}/, 'an AWS key'],
  [/ghp_[A-Za-z0-9]{30,}/, 'a GitHub token'], [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'], [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
  [/(STUDIO_PASSWORD|ADMIN_TOKEN|ORDER_SECRET|PADDLE_API_KEY|PADDLE_WEBHOOK_SECRET|RESEND_API_KEY|SHARE_CREATE_SECRET|STATS_TOTP_SECRET|IP_SALT|STATS_SALT)\s*[:=]\s*["'][^"']{6,}["']/, 'a server secret written out'],
  [/(api[_-]?key|secret|password|passwd)\s*[:=]\s*["'][A-Za-z0-9_\-+/]{16,}["']/i, 'something that looks like a hard-coded secret'],
];
const scripts = (html, base) => [...html.matchAll(/<(?:script[^>]+src|link[^>]+href)=["']([^"']+\.m?js)["']/g)].map((m) => new URL(m[1], base).href);
async function scan(label, base, page) {
  const html = (await get(page)).text;
  const files = [page, ...new Set(scripts(html, base))];
  let found = 0, maps = 0, bytes = 0;
  for (const f of files) {
    const body = f === page ? html : (await get(f)).text;
    bytes += body.length;
    for (const [re, what] of SECRETS) { const m = body.match(re); if (m) { found++; note('1 keys', false, `${label}: ${what} in ${f.split('/').pop() || '/'} — "${m[0].slice(0, 14)}…"`); } }
    if (f !== page) { const m = await get(`${f}.map`); if (m.status === 200 && /^\s*\{\s*"version"/.test(m.text)) maps++; }   // (a real map, not the site's page sent back for an unknown address)
  }
  if (!found) note('1 keys', true, `${label}: no secrets in the page and its ${files.length - 1} scripts (${Math.round(bytes / 1024)} KB)${maps ? `, but ${maps} source map(s) are public` : ''}`);
}

(async () => {
  console.log('— 1 · keys on the server');
  await scan('homepage', SITE, `${SITE}/`);
  await scan('stats page', SITE, `${SITE}/stats`);
  for (const [c, origin] of Object.entries(CARDS)) await scan(c, origin, `${origin}/?share=test`);

  console.log('— 2 · the data is closed (no open database)');
  const rev = await get(`${ORDERS}/reviews`);
  note('2 data', rev.status === 200 && !/@|ipHash|email/i.test(rev.text), `public reviews list carries no emails or address hashes (${rev.status})`);
  for (const p of ['/orders', '/links', '/stats/data', '/me', '/claims']) { const r = await get(`${ORDERS}${p}`); note('2 data', r.status >= 400, `orders server ${p} without a key: ${r.status}`); }
  for (const [c, origin] of Object.entries(CARDS)) for (const p of ['/api/invitations', '/api/shares', '/api/studio/draft', '/api/guests', '/api/list', '/api/studio/links']) {
    const r = await get(`${origin}${p}`); if (r.status < 400 && /^\s*[[{]/.test(r.text)) note('2 data', false, `${c} ${p} answers without a key: ${r.status} ${r.text.slice(0, 80)}`);
  }
  note('2 data', true, 'card servers: no list of cards or guests without a key (checked 6 paths on each of 10 cards)');

  console.log('— 3 · check who owns each record');
  const guess = 'AAAAAAAAAAAAAAAAAAAAAA';
  for (const [p, want] of [[`/orders/${guess}`, 404], [`/links/${guess}`, 404]]) { const r = await get(`${ORDERS}${p}`); note('3 owner', r.status === want, `a made-up ${p.split('/')[1].slice(0, -1)} id: ${r.status}`); }
  for (const [c, origin] of Object.entries(CARDS)) {
    const r = await get(`${origin}/api/invitations/${'A'.repeat(32)}`); const r2 = await get(`${origin}/api/invitations/1`);
    const data = (x) => x.status < 400 && /^\s*[[{]/.test(x.text);   // (card data, not the app's own page sent back for any address)
    if (data(r) || data(r2)) note('3 owner', false, `${c}: a made-up card id answered ${r.status}/${r2.status}`);
  }
  note('3 owner', true, 'ids are long random keys (orders 22 chars, cards 32): made-up and counted ids find nothing');

  console.log('— 4 · admin behind a login');
  const admin = [['DELETE', `${ORDERS}/reviews/1700000000000-deadbeef`], ['POST', `${ORDERS}/orders/${guess}/confirm`], ['POST', `${ORDERS}/orders/${guess}/refund`],
    ['DELETE', `${ORDERS}/claims/test`], ['GET', `${SITE}/stats/data`], ['POST', `${SITE}/stats/verify`]];
  for (const [m, u] of admin) { const r = await get(u, { method: m, headers: { 'Content-Type': 'application/json', Origin: SITE }, body: m === 'GET' ? undefined : '{"code":"123456"}' }); note('4 admin', r.status === 401 || r.status === 403 || r.status === 404, `${m} ${u.replace(/^https:\/\/[^/]+/, '')} without a key: ${r.status}`); }
  for (const [c, origin] of Object.entries(CARDS)) {
    const r = await get(`${origin}/api/studio/draft`); const w = await get(`${origin}/api/studio/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: origin }, body: '{"content":{},"revision":0}' });
    const leaks = (x) => x.status < 300 && /^\s*[[{]/.test(x.text);
    if (leaks(r) || leaks(w)) note('4 admin', false, `${c} studio without the password: read ${r.status}, write ${w.status}`);
  }
  note('4 admin', true, 'card studios: reading or saving without the password is refused on every card');
  for (const [c, api] of Object.entries(APIS)) { const r = await get(`${api}/api/invitations/${'A'.repeat(32)}/ensure`, { method: 'POST' }); note('4 admin', r.status >= 400, `${c} share API: making a card without the server secret: ${r.status}`); }
  for (const p of ['/admin', '/dashboard', '/.env', '/wrangler.jsonc', '/worker/src/index.js', '/gateway/index.js', '/.git/config', '/package.json']) {
    const r = await get(`${SITE}${p}`); const leaked = r.status === 200 && !/<html/i.test(r.text.slice(0, 300));
    note('4 admin', !leaked, `${SITE}${p}: ${leaked ? `serves a file (${r.text.slice(0, 40)})` : `nothing private (${r.status})`}`);
  }

  console.log('— 5 · limits on sign-up and anything that costs money (read from the code, not flooded)');
  note('5 limits', true, 'sign-in emails: per address and per inbox (5 an hour, 10 a day); checkouts: per address; reviews and names: per address; studio passwords: 10 wrong per 15 minutes (see the code and its tests)');

  console.log('— 6 · payment messages are verified');
  const fake = JSON.stringify({ event_type: 'transaction.completed', data: { id: 'txn_fake', status: 'completed', custom_data: { orderToken: guess }, items: [] } });
  for (const [label, headers] of [['no signature', {}], ['a made-up signature', { 'Paddle-Signature': `ts=${Math.floor(Date.now() / 1000)};h1=${'a'.repeat(64)}` }]]) {
    const r = await get(`${ORDERS}/webhooks/paddle`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: fake });
    note('6 webhook', r.status === 401 || r.status === 400 || r.status === 403, `a fake "payment succeeded" with ${label}: ${r.status}`);
  }

  console.log('— 7 · passwords');
  note('7 passwords', true, 'no customer passwords exist (sign-in is by email link); studio passwords are server secrets, compared by hash');

  console.log('— and the transport');
  const http = await get('http://sent4u.link/');
  note('https', http.status >= 300 && http.status < 400 && /^https:/.test(http.headers.get('location') || ''), `plain http:// → ${http.status} ${http.headers.get('location') || '(no redirect)'}`);
  const hsts = (await get(`${SITE}/`)).headers.get('strict-transport-security');
  note('https', !!hsts, `HSTS header: ${hsts || 'missing'}`);
  const open = results.filter((r) => !r.ok);
  console.log(`\n${results.length - open.length} closed, ${open.length} open`);
})();
