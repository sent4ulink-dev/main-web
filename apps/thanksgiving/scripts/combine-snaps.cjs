// Dev helper: tile debug snapshots (art/snaps/<name>.jpg) into art/snaps/_combo.jpg, 2 per row.
// Usage: node scripts/combine-snaps.cjs name1 name2 …
const sharp = require('sharp');
(async () => {
  const names = process.argv.slice(2), W = +(process.env.W || 800);
  const imgs = await Promise.all(names.map((n) => sharp(`art/snaps/${n}.jpg`).resize(W).toBuffer({ resolveWithObject: true })));
  const rowH = Math.max(...imgs.map((i) => i.info.height));
  const rows = Math.ceil(imgs.length / 2);
  await sharp({ create: { width: W * 2, height: rowH * rows, channels: 3, background: '#000' } })
    .composite(imgs.map((i, k) => ({ input: i.data, left: (k % 2) * W, top: Math.floor(k / 2) * rowH })))
    .jpeg({ quality: 82 }).toFile('art/snaps/_combo.jpg');
})();
