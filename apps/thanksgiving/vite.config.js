import { defineConfig, loadEnv } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

// Dev-only helper: the page can POST a canvas frame to /__snap and it is saved to art/snaps/<name>.jpg
// (used for visual checks while developing; not part of the production build).
const snapPlugin = {
  name: 'dev-snap',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__snap', (req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try {
          const { name, data } = JSON.parse(body);
          const safe = String(name).replace(/[^a-z0-9_-]/gi, '_');
          mkdirSync('art/snaps', { recursive: true });
          writeFileSync(`art/snaps/${safe}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
          res.end('ok');
        } catch (e) { res.statusCode = 400; res.end(String(e)); }
      });
    });
  },
};

// Dev-only: the card's API (studio, links, editing) on this same address, with the links kept in a
// file in ignored .sites-runtime/ — the same server code that runs on Cloudflare (functions/api).
// Set STUDIO_PASSWORD in .env.local (or the shell) to open the studio at http://localhost:5173/.
const cardApi = {
  name: 'card-api',
  apply: 'serve',
  async configureServer(server) {
    const { default: api } = await import('./server/api.js');
    const { createLocalBucket } = await import('./server/local-bucket.js');
    const env = { ...loadEnv('development', process.cwd(), ''), SHARES: createLocalBucket('.sites-runtime/shares.json'), CORS_ORIGIN: '*' };
    server.middlewares.use(async (req, res, next) => {
      if (!req.url.startsWith('/api/')) return next();
      try {
        const chunks = []; for await (const c of req) chunks.push(c);
        const url = new URL(req.url, `http://${req.headers.host}`);
        const response = await api.fetch(new Request(url, { method: req.method, headers: new Headers(req.headers), ...(req.method === 'GET' || req.method === 'HEAD' ? {} : { body: Buffer.concat(chunks) }) }), env);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (e) { res.statusCode = 500; res.end(String(e)); }
    });
  },
};

export default defineConfig({
  base: './',
  server: { port: 5177, host: '127.0.0.1' },
  plugins: [snapPlugin, cardApi],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 0,
  },
});
