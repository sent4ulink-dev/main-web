// Capture a card frame by frame (24 fps) on the virtual clock, with taps at exact times.
// node cap.cjs <outdir> <seconds> '<pre json>' '<actions json>' [dpr]
//   pre:     steps run before capturing (fast, not recorded): ["step", s] | ["tap", "regex"] | ["sel", "css"] | ["css", "rules"] | ["focus", "text"]
//   actions: [t, kind, arg, arg2] at capture time t (s): tap / sel / focus / type / press (one key) / speed (time-lapse factor) / tapwhen (tap as soon as
//            the button exists, then set speed to arg2)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const [,, out, secs, preJ, actJ, dpr = '1.5'] = process.argv;
const PRE = JSON.parse(preJ || '[]'), ACT = JSON.parse(actJ || '[]');
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
  const doAct = async (kind, arg) => {
    if (kind === 'tap') await btn(arg).dispatchEvent('click').catch(() => console.log('miss', arg));
    if (kind === 'sel') await p.locator(arg).first().dispatchEvent('click').catch(() => console.log('miss', arg));
    if (kind === 'css') await p.addStyleTag({ content: arg });
    if (kind === 'focus') { await p.getByText(arg, { exact: true }).first().click({ force: true }).catch(() => console.log('miss', arg)); await p.keyboard.press('Control+A'); await p.evaluate((l) => window.kbdShow && window.kbdShow(l), +(process.env.LIFT || 0)); }
    if (kind === 'type') await p.keyboard.type(arg);
    if (kind === 'press') await p.keyboard.press(arg);
    if (kind === 'kbd') await p.addScriptTag({ path: path.join(__dirname, 'kbd.js') });
  };
  for (const [kind, arg] of PRE) {
    if (kind === 'step') for (let k = 0; k < arg * 4; k++) await step(1000 / 4); else await doAct(kind, arg);
  }
  let speed = 1; const pending = []; const N = Math.round(+secs * 24); const t0 = Date.now(); const log = [];
  for (let i = 0; i < N; i++) {
    const t = i / 24;
    for (const a of ACT) if (!a.done && a[0] <= t + 1e-6) {
      a.done = true;
      if (a[1] === 'speed') speed = +a[2];
      else if (a[1] === 'tapwhen') pending.push(a);
      else { await doAct(a[1], a[2]); log.push(`${t.toFixed(2)} ${a[1]} ${a[2]}`); }
    }
    for (const a of pending.splice(0)) {
      if (await btn(a[2]).count() && await btn(a[2]).isVisible()) { await doAct('tap', a[2]); speed = +(a[3] || 1); log.push(`${t.toFixed(2)} tapwhen ${a[2]}`); }
      else pending.push(a);
    }
    await step(1000 / 24 * speed);
    await p.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90, timeout: 180000 });
  }
  console.log(log.join('\n')); console.log('captured', N, 'frames in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  await b.close();
})();
