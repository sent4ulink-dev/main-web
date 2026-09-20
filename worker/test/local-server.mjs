// Runs the Worker on http://localhost:8787 with an in-memory bucket, so the site can be tried end to end without Cloudflare.
// Reviews vanish when you stop it. Usage: node test/local-server.mjs   (then set data-api="http://localhost:8787" on the reviews section)
import http from 'node:http';
import worker from '../src/index.js';
import { fakeBucket } from './fake-bucket.mjs';

const env = { BUCKET: fakeBucket(), ALLOWED_ORIGINS: 'http://localhost:4173', ADMIN_TOKEN: 'local-admin' };
const port = Number(process.env.PORT || 8787);

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = { ...req.headers, 'CF-Connecting-IP': req.socket.remoteAddress || '127.0.0.1' };
  const out = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), env);
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(port, () => console.log(`reviews Worker (in-memory) on http://localhost:${port}`));
