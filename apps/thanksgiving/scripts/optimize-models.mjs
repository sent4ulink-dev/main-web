// Packs the Blender exports (art/blender/export/*.glb) into web-ready models in public/models/:
// welded, deduplicated, lightly simplified and meshopt-compressed. Node names are kept (the app finds props by name).
// Usage: node scripts/optimize-models.mjs
import { mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, meshopt, simplify } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'art', 'blender', 'export');
const OUT = join(ROOT, 'public', 'models');
const SIMPLIFY = { thanksgiving: 0.75, avatar: 0.8 };   // share of vertices kept (a small error budget keeps every shape)

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
await mkdir(OUT, { recursive: true });
for (const file of (await readdir(SRC)).filter((f) => f.endsWith('.glb'))) {
  const id = file.replace('.glb', '');
  const doc = await io.read(join(SRC, file));
  // UVs only where the app paints a texture (the chalkboard, the TV screen, the plaid sofa): the rest are toon colours
  for (const mesh of doc.getRoot().listMeshes()) {
    if (/sign_face|tv_screen|sofa_fabric/.test(mesh.getName())) continue;
    for (const prim of mesh.listPrimitives()) for (const sem of prim.listSemantics()) if (sem.startsWith('TEXCOORD')) prim.setAttribute(sem, null);
  }
  await doc.transform(
    weld(), dedup(), prune({ keepLeaves: true, keepAttributes: true }),   // (the sign's and the TV's screens get their texture in the app: keep their UVs)
    ...(SIMPLIFY[id] ? [simplify({ simplifier: MeshoptSimplifier, ratio: SIMPLIFY[id], error: id === 'avatar' ? 0.0003 : 0.0006 })] : []),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await io.write(join(OUT, file), doc);
  const kb = (p) => stat(p).then((s) => (s.size / 1024).toFixed(0));
  console.log(`${id}: ${await kb(join(SRC, file))} KB → ${await kb(join(OUT, file))} KB`);
}
