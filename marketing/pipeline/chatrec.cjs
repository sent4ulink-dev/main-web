// Record the chat screen in real time with the send tap at an exact time. Prints OFFSET: recording seconds at the shot start.
// node chatrec.cjs out.webm <sendAt seconds>
const { chromium, devices } = require('playwright');
const path = require('path');
const [,, out, sendAt] = process.argv;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, recordVideo: { dir: path.dirname(out) + '/tmp-chat', size: { width: 390, height: 844 } } });
  const tCreate = Date.now(); const p = await ctx.newPage();
  await p.goto('file://' + path.join(__dirname, 'chat.html')); await p.waitForTimeout(1500);
  const T0 = Date.now(); console.log('OFFSET', ((T0 - tCreate) / 1000).toFixed(3));
  await p.waitForTimeout(Math.max(0, T0 + +sendAt * 1000 - Date.now()));
  await p.evaluate(() => window.sendLink()); await p.waitForTimeout(2500);
  const v = p.video(); await ctx.close(); await b.close(); require('fs').renameSync(await v.path(), out); console.log('saved', out);
})();
