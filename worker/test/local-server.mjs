// Runs the Worker on http://localhost:8787 with an in-memory bucket, so the site can be tried end to end without Cloudflare.
// Reviews and orders vanish when you stop it. Usage: node test/local-server.mjs   (then set data-api="http://localhost:8787" on the reviews and pricing sections)
// It also plays the payment provider: "checkout" is http://localhost:8787/dev/pay, which marks the order paid and sends the buyer back to the site.
import http from 'node:http';
import worker from '../src/index.js';
import { fakeBucket } from './fake-bucket.mjs';

const port = Number(process.env.PORT || 8787);
const env = {
  BUCKET: fakeBucket(), ALLOWED_ORIGINS: 'http://localhost:4173', ADMIN_TOKEN: 'local-admin', ORDER_SECRET: 'local-order-secret',
  CHECKOUT_URL_SINGLE: `http://localhost:${port}/dev/pay?ref={token}`, CHECKOUT_URL_PACK: `http://localhost:${port}/dev/pay?ref={token}`,
};

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = { ...req.headers, 'CF-Connecting-IP': req.socket.remoteAddress || '127.0.0.1' };
  const pay = req.url.match(/^\/dev\/pay\?ref=([A-Za-z0-9_-]{22})$/);
  if (pay) {                                               // the stand-in payment page: pay instantly, then go back to the site
    await worker.fetch(new Request(`http://localhost:${port}/orders/${pay[1]}/confirm`, { method: 'POST', headers: { Authorization: 'Bearer local-order-secret' } }), env);
    res.writeHead(302, { Location: 'http://localhost:4173/?paid=1' });
    return res.end();
  }
  const out = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), env);
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(port, () => console.log(`reviews Worker (in-memory) on http://localhost:${port}`));
