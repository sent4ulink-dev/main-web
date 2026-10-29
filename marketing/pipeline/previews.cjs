// The style previews of the website's demo section (assets/styles/<card>.webp): each card's live demo on its opening
// screen, at 390x640 and DPR 2 (resized to 520x853 afterwards).
// node previews.cjs <outdir> <card> [<card> ...]      (WAIT=ms to let a slow 3D card settle; default 12000)
const { chromium } = require('playwright');
const [,, out, ...cards] = process.argv;
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const card of cards) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(`https://sent4u.link/?share=test-${card}`, { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForTimeout(+(process.env.WAIT || 12000));
    await p.screenshot({ path: `${out}/${card}.png`, timeout: 180000 });
    console.log('shot', card);
    await ctx.close();
  }
  await b.close();
})();
