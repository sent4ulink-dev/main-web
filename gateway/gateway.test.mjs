// Run with: node gateway/gateway.test.mjs — the gateway's visit counting (the STATS database and the site's files are faked).
import assert from 'node:assert/strict';
import gateway from './index.js';

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
function setup() {
  const written = [];
  const db = { prepare: (sql) => ({ sql, args: [], bind(...a) { this.args = a; return this; } }), async batch(stmts) { written.push(...stmts); return []; } };
  const env = { STATS: db, STATS_SALT: 'test', STATS_TZ_OFFSET_MIN: '480', PICNIC_ORIGIN: 'https://picnic.test', ASSETS: { fetch: async () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }) } };
  return { env, written };
}
async function visit({ path = '/', cf = {}, ua = UA, cookie = '', dest = 'document' } = {}) {
  const { env, written } = setup();
  const req = new Request(`https://sent4u.link${path}`, { headers: { 'User-Agent': ua, 'Sec-Fetch-Dest': dest, Accept: 'text/html', 'CF-Connecting-IP': '203.0.113.9', ...(cookie ? { Cookie: cookie } : {}) } });
  Object.defineProperty(req, 'cf', { value: cf });
  const waits = [];
  await gateway.fetch(req, env, { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  const tables = written.map((s) => (s.sql.match(/INTO (\w+)/) || [])[1]);
  const net = written.find((s) => s.sql.includes('INTO networks'));
  const hit = written.find((s) => s.sql.includes('INTO hits'));
  return { tables, auto: net ? net.args[3] : null, org: net ? net.args[1] : null, hitKind: hit ? (hit.sql.includes("'auto'") ? 'auto' : hit.args[1]) : null };
}

// a card's own server, for the visits that open a card (never the network in a test)
globalThis.fetch = async () => new Response('<html>card</html>', { headers: { 'Content-Type': 'text/html' } });

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('  ok  ' + name); };

await test('a person on a home or mobile network is a visitor, with their country and network', async () => {
  const r = await visit({ cf: { asn: 55805, asOrganization: 'Mobicom Corporation', country: 'MN' } });
  assert.deepEqual(r.tables.sort(), ['countries', 'hits', 'networks', 'visitors']);
  assert.equal(r.auto, 0); assert.equal(r.hitKind, 'home');
});

await test('data centres, clouds and VPN networks are counted apart as probably automated', async () => {
  for (const cf of [{ asn: 9009, asOrganization: 'M247 Europe SRL', country: 'RO' }, { asn: 16509, asOrganization: 'Amazon.com, Inc.', country: 'US' },
    { asn: 14061, asOrganization: 'DigitalOcean, LLC', country: 'DE' }, { asn: 999999, asOrganization: 'Some Hosting Ltd', country: 'SE' },
    { asn: 999998, asOrganization: 'Datacamp Limited', country: 'TH' }]) {
    const r = await visit({ cf });
    assert.equal(r.auto, 1, cf.asOrganization);
    assert.deepEqual(r.tables.sort(), ['hits', 'networks'], cf.asOrganization);   // not a visitor, no country or referrer counts
    assert.equal(r.hitKind, 'auto');
  }
});

await test('home providers that only look like cloud names are people', async () => {
  for (const cf of [{ asn: 16591, asOrganization: 'Google Fiber Inc.', country: 'US' }, { asn: 13335, asOrganization: 'Cloudflare, Inc.', country: 'MN' },
    { asn: 27831, asOrganization: 'COLOMBIA MOVIL', country: 'CO' }, { asn: 7922, asOrganization: 'Comcast Cable Communications, LLC', country: 'US' }]) {
    const r = await visit({ cf });
    assert.equal(r.auto, 0, cf.asOrganization);
    assert.ok(r.tables.includes('visitors'), cf.asOrganization);
  }
});

await test('the owner\'s own browser, bots, and file requests are not counted at all', async () => {
  assert.deepEqual((await visit({ cookie: 's4u_owner=1', cf: { asn: 55805, asOrganization: 'Mobicom Corporation', country: 'MN' } })).tables, []);
  assert.deepEqual((await visit({ ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' })).tables, []);
  assert.deepEqual((await visit({ dest: 'image' })).tables, []);
  assert.deepEqual((await visit({ path: '/?share=test-picnic&embed=1', cf: { asn: 55805, asOrganization: 'Mobicom Corporation', country: 'MN' } })).tables, []);
  assert.deepEqual((await visit({ path: '/?share=test-winxp&embed=1', cf: { asn: 55805, asOrganization: 'Mobicom Corporation', country: 'MN' } })).tables, []);   // (a card with no address set)
});

await test('opening a demo counts as a demo open of that card', async () => {
  assert.equal((await visit({ path: '/?share=test-picnic', cf: { asn: 55805, asOrganization: 'Mobicom Corporation', country: 'MN' } })).hitKind, 'demo');
});

await test('plain http is sent to https, and every answer asks for https from now on (HSTS)', async () => {
  const { env } = setup();
  const r = await gateway.fetch(new Request('http://sent4u.link/?share=test-picnic'), env, { waitUntil() {} });
  assert.equal(r.status, 301); assert.equal(r.headers.get('Location'), 'https://sent4u.link/?share=test-picnic');
  const post = await gateway.fetch(new Request('http://sent4u.link/checkout', { method: 'POST', body: '{}' }), env, { waitUntil() {} });
  assert.equal(post.status, 308);   // (a POST stays a POST)
  const ok = await gateway.fetch(new Request('https://sent4u.link/', { headers: { 'User-Agent': UA } }), env, { waitUntil() {} });
  assert.match(ok.headers.get('Strict-Transport-Security') || '', /max-age=\d+/);
});

console.log(`\n${passed} gateway tests passed`);
