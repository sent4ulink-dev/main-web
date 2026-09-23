// Runs the Worker on http://localhost:8787 with an in-memory bucket, so the site can be tried end to end without Cloudflare.
// Reviews and orders vanish when you stop it. Usage: node test/local-server.mjs   (then set data-api="http://localhost:8787" on the
// reviews and pricing sections)
//
// It also plays Paddle, so the whole buy -> webhook -> choose-your-links flow works with no real Paddle account:
//   - PADDLE_API_BASE points back at this same server, at /dev/paddle, which fakes the Transactions API (POST /dev/paddle/transactions).
//   - The checkout URL it hands back is this server's own /dev/pay page: "paying" there sends a real, correctly signed
//     transaction.completed webhook to /webhooks/paddle (the same endpoint and the same signature check a real Paddle webhook goes through)
//     before redirecting to http://localhost:4173/?paid=1, exactly like the real return trip.
import http from 'node:http';
import worker from '../src/index.js';
import { fakeBucket } from './fake-bucket.mjs';

const port = Number(process.env.PORT || 8787);
const PADDLE_WEBHOOK_SECRET = 'local-paddle-webhook-secret';
const env = {
  BUCKET: fakeBucket(), ALLOWED_ORIGINS: 'http://localhost:4173', ADMIN_TOKEN: 'local-admin', ORDER_SECRET: 'local-order-secret',
  PADDLE_API_KEY: 'local-paddle-key', PADDLE_API_BASE: `http://localhost:${port}/dev/paddle`, PADDLE_WEBHOOK_SECRET,
  PADDLE_PRICE_SINGLE: 'pri_dev_single', PADDLE_PRICE_PACK: 'pri_dev_pack',
};

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function paddleSignature(secret, rawBody, ts = Math.floor(Date.now() / 1000)) {
  return `ts=${ts};h1=${await hmacHex(secret, `${ts}:${rawBody}`)}`;
}

let nextTxn = 1;
const pendingTokens = new Map();   // fake Paddle transaction id -> our order token, only kept in this dev server's memory

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = { ...req.headers, 'CF-Connecting-IP': req.socket.remoteAddress || '127.0.0.1' };

  // the fake Paddle API: creates a "transaction" and hands back a checkout URL on this same dev server
  if (req.url === '/dev/paddle/transactions' && req.method === 'POST') {
    const { items, custom_data } = JSON.parse(body || '{}');
    const id = `txn_dev_${nextTxn++}`;
    const token = custom_data && custom_data.orderToken;
    if (token) pendingTokens.set(id, token);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: { id, checkout: { url: `http://localhost:${port}/dev/pay?txn=${id}` } } }));
  }

  // the stand-in payment page: pay instantly, send a real signed webhook, then go back to the site
  const pay = req.url.match(/^\/dev\/pay\?txn=(txn_dev_\d+)$/);
  if (pay) {
    const id = pay[1], token = pendingTokens.get(id);
    if (token) {
      const raw = JSON.stringify({ event_type: 'transaction.completed', data: { id, custom_data: { orderToken: token } } });
      const sig = await paddleSignature(PADDLE_WEBHOOK_SECRET, raw);
      await worker.fetch(new Request(`http://localhost:${port}/webhooks/paddle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Paddle-Signature': sig }, body: raw,
      }), env);
    }
    res.writeHead(302, { Location: 'http://localhost:4173/?paid=1' });
    return res.end();
  }

  const out = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), env);
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(port, () => console.log(`reviews Worker (in-memory) on http://localhost:${port}`));
