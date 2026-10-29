// Deploys one of the cards in apps/ (salon, picnic, mission, halloween, petal) to its Cloudflare Pages project.
//   node scripts/deploy-card.mjs salon        (after `npm run build` inside apps/salon; or just `npm run deploy` there)
//
// Why not just `wrangler pages deploy` inside the card's folder: Pages looks upwards for its config and finds this
// repository's root wrangler.jsonc (the main site's Worker) instead of the card's own wrangler.toml, and it refuses
// `--config`. So the card is copied, with only what the deploy needs, into an empty folder outside the repository,
// where its own wrangler.toml is the only config there is. Wrangler is run there with whatever login the shell has
// (use the isolated sent4u one: XDG_CONFIG_HOME=C:/Users/56/.sent4u-wrangler, CLOUDFLARE_ACCOUNT_ID=...).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const card = process.argv[2];
if (!card || !/^[a-z]+$/.test(card)) {
  console.error('Usage: node scripts/deploy-card.mjs <salon|picnic|mission|halloween|petal|spooky>');
  process.exit(2);
}
const source = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'apps', card);
if (!existsSync(join(source, 'wrangler.toml')) || !existsSync(join(source, 'dist'))) {
  console.error(`apps/${card} needs a wrangler.toml and a built dist/ (run "npm run build" in apps/${card} first).`);
  process.exit(2);
}

// sent4u.link answers the paths excluded in run_worker_first (root wrangler.jsonc) straight from the main site's storage,
// without the gateway: a card file on one of them would get the site's file, or a 404. Refuse to deploy such a card.
const config = readFileSync(resolve(source, '..', '..', 'wrangler.jsonc'), 'utf8');
const direct = JSON.parse(config.match(/"run_worker_first":\s*(\[[^\]]*\])/)[1])
  .filter(p => p.startsWith('!/')).map(p => p.slice(2));                     // "vendor/*", "script.js", ...
const isDirect = f => direct.some(p => p.endsWith('/*') ? f.startsWith(p.slice(0, -1)) : f === p);
const clashes = readdirSync(join(source, 'dist'), { recursive: true }).map(f => String(f).replaceAll('\\', '/')).filter(isDirect);
if (clashes.length) {
  console.error(`apps/${card}/dist has files on paths sent4u.link serves from the main site, so the card would never get them:\n  ${clashes.join('\n  ')}\nMove or rename them in the card.`);
  process.exit(2);
}

const staged = join(tmpdir(), 'sent4u-deploy', card);
rmSync(staged, { recursive: true, force: true });
mkdirSync(staged, { recursive: true });
// the Pages Function (functions/) imports from server/, edge/ and the card's shared source (src/ or site/)
for (const name of ['wrangler.toml', 'package.json', 'dist', 'functions', 'server', 'edge', 'src', 'site']) {
  if (existsSync(join(source, name))) cpSync(join(source, name), join(staged, name), { recursive: true });
}

const run = spawnSync('npx', ['wrangler', 'pages', 'deploy', ...process.argv.slice(3)], { cwd: staged, stdio: 'inherit', shell: true });
rmSync(staged, { recursive: true, force: true });
process.exit(run.status ?? 1);
