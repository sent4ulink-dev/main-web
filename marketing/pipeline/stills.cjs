// Still screenshots of a card at chosen moments, in one session on the virtual clock (for the website's phone mockup).
// node stills.cjs <outdir> '<steps json>' [dpr]
//   steps: ["step", s] | ["tap", "regex"] | ["sel", "css"] | ["css", "rules"] | ["shot", "name"]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const [,, out, stepsJ, dpr = '2'] = process.argv;
const URL = process.env.URL || 'https://sent4u.link/?share=test-spooky';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: +dpr, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  await ctx.addInitScript({ path: path.join(__dirname, 'vclock.js') });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  const step = (ms) => p.evaluate((m) => window.__step(m), ms);
  const btn = (re) => p.getByRole('button', { name: new RegExp(re) }).first();
  for (const [kind, arg] of JSON.parse(stepsJ)) {
    if (kind === 'step') for (let k = 0; k < arg * 8; k++) await step(1000 / 8);
    if (kind === 'tap') await btn(arg).dispatchEvent('click').catch(() => console.log('miss', arg));
    if (kind === 'sel') await p.locator(arg).first().dispatchEvent('click').catch(() => console.log('miss', arg));
    if (kind === 'css') await p.addStyleTag({ content: arg });
    if (kind === 'shot') { await p.screenshot({ path: `${out}/${arg}.png`, timeout: 180000 }); console.log('shot', arg); }
  }
  await b.close();
})();
