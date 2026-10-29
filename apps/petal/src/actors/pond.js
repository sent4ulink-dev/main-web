// Pond navigation, read from the walk map. Open water is a water cell that is
// not a dock, a moored boat or anything standing in it; the swimmers keep to
// round lanes inside it, the frogs sit on the bank and the koi jump clear of
// everything. Pure functions over an `open(x, z)` predicate, so they can be
// tested without a scene.

export function isOpenWater(map, x, z) {
  const s = map.sample(x, z);
  return s.kind === "floor" && s.water && s.material === "water";
}

// Is the ring at `radius`, with a swimmer `half` wide on it, open water all
// the way round?
export function ringIsClear(open, cx, cz, radius, half, steps = 96) {
  for (let k = 0; k < steps; k += 1) {
    const a = (k / steps) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (const r of [radius - half, radius, radius + half]) {
      if (!open(cx + c * r, cz + s * r)) return false;
    }
  }
  return true;
}

// Lanes, outermost first. Each starts at its share of the pond radius and
// moves in until its swimmer clears the shore, the dock, the boat and the
// lane outside it. `clear` is false if no clear ring was found; the lane then
// keeps its starting radius, so the swimmers still never share a lane.
export function planLanes(open, center, radius, lanes, gap = 0.08) {
  let inner = Infinity;
  return lanes.map((lane) => {
    const start = Math.max(lane.half + 0.05, Math.min(lane.share * radius, inner - gap - lane.half));
    let r = start;
    while (r >= lane.half + 0.05 && !ringIsClear(open, center.x, center.z, r, lane.half)) r -= 0.05;
    const clear = r >= lane.half + 0.05;
    if (!clear) r = start;
    inner = r - lane.half;
    return { ...lane, radius: r, clear };
  });
}

// Spots on the bank all round the pond: walk out from the middle until the
// open water ends, then step onto dry floor (lawn or a flat shore stone).
// Directions that end at the dock, the boat or a prop are skipped.
export function bankSpots(map, open, center, radius, count = 9) {
  const spots = [];
  for (let k = 0; k < count; k += 1) {
    const a = (k / count) * Math.PI * 2 + 0.3;
    const c = Math.cos(a);
    const s = Math.sin(a);
    let r = radius * 0.4;
    while (r < radius * 1.8 && open(center.x + c * r, center.z + s * r)) r += 0.05;
    if (r >= radius * 1.8) continue;
    const x = center.x + c * (r + 0.14);
    const z = center.z + s * (r + 0.14);
    const ground = map.sample(x, z);
    if (ground.kind !== "floor" || ground.water || ground.height == null) continue;
    spots.push({ x, y: ground.height, z, angle: a });
  }
  return spots;
}

function clearAround(open, x, z, r) {
  return open(x, z) && open(x + r, z) && open(x - r, z) && open(x, z + r) && open(x, z - r);
}

// A koi jump: a short arc between two open-water spots, with open water all
// round both ends and the middle, away from anything `busy(x, z)` reports
// (the ducks and swans).
export function koiJump(open, center, radius, { busy = () => false, rand = Math.random, length = 0.9 } = {}) {
  for (let i = 0; i < 16; i += 1) {
    const a = rand() * Math.PI * 2;
    const r = radius * 0.7 * Math.sqrt(rand());
    const from = { x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r };
    const dir = rand() * Math.PI * 2;
    const to = { x: from.x + Math.cos(dir) * length, z: from.z + Math.sin(dir) * length };
    const mid = { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 };
    if ([from, mid, to].every((p) => clearAround(open, p.x, p.z, 0.2)) && !busy(from.x, from.z) && !busy(to.x, to.z)) {
      return { from, to };
    }
  }
  return null;
}
