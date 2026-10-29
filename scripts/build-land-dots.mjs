// Bakes the two globes' land dots into small binary files, so the page doesn't have to fetch the 138 KB coastline
// GeoJSON, draw it onto a big canvas and read every pixel back on each visit (well over 100 ms of a frozen page on a
// laptop, twice). Run it again only if the coastlines or a dot grid change:  node scripts/build-land-dots.mjs
//
// The grids are the ones the globes built in the browser before. A dot is land when the middle of its pixel on the
// same-sized map is inside the land polygons (even-odd rule, so lakes stay holes), which is what the canvas test did.
// Output: Int16 pairs (latitude, longitude) in hundredths of a degree.
import { readFileSync, writeFileSync } from 'node:fs';

const geo = JSON.parse(readFileSync('assets/data/ne_110m_land.geojson', 'utf8'));
const DEG = Math.PI / 180;

// a land test on a W x H map: every ring in map pixels, with its vertical extent so most rings are skipped quickly
function landTest(W, H){
  const rings = [];
  for (const f of geo.features){
    const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const poly of polys) for (const ring of poly){
      const pts = ring.map(([lon, lat]) => [(lon + 180) / 360 * W, (90 - lat) / 180 * H]);
      const ys = pts.map(p => p[1]);
      rings.push({ pts, minY: Math.min(...ys), maxY: Math.max(...ys) });
    }
  }
  return (lat, lon) => {
    const px = Math.min(W - 1, Math.max(0, Math.floor((lon + 180) / 360 * W))) + 0.5;
    const py = Math.min(H - 1, Math.max(0, Math.floor((90 - lat) / 180 * H))) + 0.5;
    let inside = false;
    for (const { pts, minY, maxY } of rings){
      if (py < minY || py > maxY) continue;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++){
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  };
}

function save(file, out){
  writeFileSync(`assets/data/${file}`, Buffer.from(new Int16Array(out).buffer));
  console.log(`${out.length / 2} land dots -> assets/data/${file} (${out.length * 2} bytes)`);
}

// the hero globe (earth-scene.js): rows STEP degrees apart, each row offset half a step from the last, on a 2048x1024 map
{
  const STEP = 1.55, isLand = landTest(2048, 1024), out = [];
  let row = 0;
  for (let lat = -90 + STEP / 2; lat < 90; lat += STEP, row++){
    const n = Math.max(1, Math.round(360 * Math.cos(lat * DEG) / STEP));
    const shift = (row % 2) * 0.5;
    for (let i = 0; i < n; i++){
      const lon = -180 + (i + shift) * 360 / n;
      if (isLand(lat, lon)) out.push(Math.round(lat * 100), Math.round(lon * 100));
    }
  }
  save('land-dots.bin', out);
}

// the closing globe (finale.js): a coarser grid on phones, on a 1440x720 map
for (const [file, STEP] of [['land-cta.bin', 1.25], ['land-cta-phone.bin', 2]]){
  const isLand = landTest(1440, 720), out = [];
  for (let lat = -84; lat <= 84; lat += STEP){
    const lonStep = STEP / Math.max(Math.cos(lat * DEG), 0.05);
    for (let lon = -180; lon < 180; lon += lonStep) if (isLand(lat, lon)) out.push(Math.round(lat * 100), Math.round(lon * 100));
  }
  save(file, out);
}
