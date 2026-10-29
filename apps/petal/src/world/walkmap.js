// Walk map: the height of the surface under every 10 cm of Petal Isle, baked
// in Blender (tools/build_cute_isle.py). Version 2 stores the top of every
// solid body (benches, rocks, fences, trunks…) so the bunny can hop onto them,
// flags pond water for wading, and keeps a material per cell for footsteps.
//
//   uint16 per cell: 0 = open sky; bits 0-13 = (height + offset) / scale,
//   bit 14 = top of a body, bit 15 = water. Then one material byte per cell.
//
// Props built in the browser (swing, telescope, balloon) register colliders
// at runtime with addCollider(), so they have bodies too.

export const MATERIALS = ["none", "grass", "stone", "wood", "water", "leaf", "sand", "cloth", "metal"];
const WALL = 99; // version 1 obstacles: too tall to climb
const FOOTPRINT = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const VOID = Object.freeze({ kind: "void", water: false, material: "none", height: null });

export function createWalkMap(meta, heights, materials = null) {
  const version = meta.version || 1;
  const { cols, rows, cell, x0, z0 } = meta;
  const mask = meta.heightMask ?? (version >= 2 ? 0x3fff : 0x7fff);
  const bodyBit = version >= 2 ? (meta.bodyBit ?? 0x4000) : 0;
  const waterBit = meta.waterBit ?? 0x8000;
  const names = meta.materials || MATERIALS;
  const colliders = new Map();
  let nextCollider = 1;

  const index = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c);
  const raw = (c, r) => {
    const i = index(c, r);
    return i < 0 ? 0 : heights[i];
  };
  const isBody = (v) => (version >= 2 ? (v & bodyBit) !== 0 : v === 1);
  const decode = (v) => {
    if (v === 0) return null;
    if (version < 2 && v === 1) return WALL;
    return (v & mask) * meta.scale - meta.offset;
  };

  function colliderTop(x, z) {
    let top = -Infinity;
    for (const collider of colliders.values()) {
      if (collider.contains(x, z)) top = Math.max(top, collider.top());
    }
    return top;
  }

  // Baked surface height: bodies are flat-topped cells; floors blend with the
  // neighbouring floor cells of the same surface so slopes stay smooth.
  function baked(x, z) {
    const fx = (x - x0) / cell;
    const fz = (z - z0) / cell;
    const v = raw(Math.round(fx), Math.round(fz));
    if (v === 0) return null;
    const h = decode(v);
    if (isBody(v)) return h;
    const c0 = Math.floor(fx);
    const r0 = Math.floor(fz);
    let sum = 0;
    let weight = 0;
    for (let k = 0; k < 4; k += 1) {
      const dc = k & 1;
      const dr = k >> 1;
      const n = raw(c0 + dc, r0 + dr);
      if (n === 0 || isBody(n)) continue;
      const hn = decode(n);
      if (Math.abs(hn - h) > 0.15) continue;
      const w = (dc ? fx - c0 : 1 - (fx - c0)) * (dr ? fz - r0 : 1 - (fz - r0)) + 1e-4;
      sum += hn * w;
      weight += w;
    }
    return weight > 0 ? sum / weight : h;
  }

  function surface(x, z) {
    const base = baked(x, z);
    if (!colliders.size) return base;
    const extra = colliderTop(x, z);
    if (extra === -Infinity) return base;
    return base === null ? extra : Math.max(base, extra);
  }

  function sample(x, z) {
    const c = Math.round((x - x0) / cell);
    const r = Math.round((z - z0) / cell);
    const v = raw(c, r);
    const extra = colliders.size ? colliderTop(x, z) : -Infinity;
    if (v === 0 && extra === -Infinity) return VOID;
    const base = baked(x, z);
    if (extra !== -Infinity && (base === null || extra > base)) {
      return { kind: "body", water: false, material: "wood", height: extra };
    }
    const i = index(c, r);
    const body = isBody(v);
    const water = !body && (v & waterBit) !== 0;
    const material = materials ? names[materials[i]] || "none" : water ? "water" : body ? "stone" : "grass";
    return { kind: body ? "body" : "floor", water, material, height: base };
  }

  // Highest surface under a round footprint (the bunny stands on the highest
  // point it touches), and how many footprint points hang over open sky.
  function support(x, z, radius = 0.12) {
    let top = -Infinity;
    let voids = 0;
    for (const [dx, dz] of FOOTPRINT) {
      const h = surface(x + dx * radius, z + dz * radius);
      if (h === null) voids += 1;
      else if (h > top) top = h;
    }
    return { height: top === -Infinity ? null : top, voids };
  }

  // Open, dry, level floor (for animals, docks and spawn points).
  function isOpenGround(x, z) {
    const s = sample(x, z);
    return s.kind === "floor" && !s.water;
  }

  // shape: { type: "circle", x, z, radius } or { type: "box", x, z, halfX, halfZ, yaw }
  // top: a height, or a function returning the current height (moving props).
  function addCollider(shape, top) {
    const topFn = typeof top === "function" ? top : () => top;
    let contains;
    if (shape.type === "box") {
      const cos = Math.cos(shape.yaw || 0);
      const sin = Math.sin(shape.yaw || 0);
      contains = (x, z) => {
        const dx = x - shape.x;
        const dz = z - shape.z;
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        return Math.abs(lx) <= shape.halfX && Math.abs(lz) <= shape.halfZ;
      };
    } else {
      const r2 = shape.radius * shape.radius;
      contains = (x, z) => (x - shape.x) ** 2 + (z - shape.z) ** 2 <= r2;
    }
    const id = nextCollider++;
    colliders.set(id, { contains, top: topFn });
    return id;
  }

  return {
    meta,
    version,
    cell,
    bounds: { x0, z0, x1: x0 + (cols - 1) * cell, z1: z0 + (rows - 1) * cell },
    surface,
    height: surface,
    sample,
    support,
    isOpenGround,
    addCollider,
    removeCollider: (id) => colliders.delete(id),
    // Raw access for the minimap and tooling.
    cols,
    rows,
    rawAt: (c, r) => raw(c, r),
    decode,
    isBodyValue: isBody,
    waterBit,
  };
}

export async function loadWalkMap(base = "/island/walkmap", cacheKey = "") {
  const suffix = cacheKey ? `?v=${cacheKey}` : "";
  const [meta, buffer] = await Promise.all([
    fetch(`${base}.json${suffix}`).then((r) => {
      if (!r.ok) throw new Error(`Walk map meta: HTTP ${r.status}`);
      return r.json();
    }),
    fetch(`${base}.bin${suffix}`).then((r) => {
      if (!r.ok) throw new Error(`Walk map data: HTTP ${r.status}`);
      return r.arrayBuffer();
    }),
  ]);
  const count = meta.cols * meta.rows;
  const heights = new Uint16Array(buffer, 0, count);
  const materials = buffer.byteLength >= count * 3 ? new Uint8Array(buffer, count * 2, count) : null;
  return createWalkMap(meta, heights, materials);
}
