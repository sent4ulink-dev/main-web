// Prints bounding boxes (metres, Y-up) of each node in the optimized models.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/core';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'node:fs';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const f = (v) => v.map((x) => x.toFixed(3)).join(',');
for (const file of readdirSync('public/models').filter((n) => n.endsWith('.glb'))) {
  const doc = await io.read('public/models/' + file);
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  const b = getBounds(scene);
  console.log(`${file.padEnd(30)} min=${f(b.min)} max=${f(b.max)} size=${f(b.max.map((m, i) => m - b.min[i]))}`);
  if (process.argv.includes('-v')) for (const n of scene.listChildren()) { const nb = getBounds(n); console.log(`    ${n.getName().padEnd(34)} min=${f(nb.min)} max=${f(nb.max)}`); }
}
