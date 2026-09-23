import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// vinext writes a Wrangler redirect for its Worker build. Pages must use the
// root Pages configuration and upload the separate static build instead.
await rm(join(root, '.wrangler', 'deploy', 'config.json'), { force: true });

console.log('Cloudflare Pages output points to dist/pages');
