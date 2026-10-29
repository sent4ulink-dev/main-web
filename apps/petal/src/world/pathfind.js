import * as THREE from "three";

// Finding a way round posts, pots and benches for the bunnies that walk on
// their own (the host and the dance partner): A* over the walk map near the
// start and the goal (10 cm cells), pulled tight into straight runs.

const STEP_UP = 0.2; // the most a bunny steps up or down from one cell to the next
const RING = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
const NEIGHBOURS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

// The ground height if a bunny of this radius fits here (dry, nothing tall
// within reach), else null.
export function footing(map, x, z, radius = 0.16) {
  const s = map.sample(x, z);
  if (s.height === null || s.water) return null;
  for (const [dx, dz] of RING) {
    const h = map.surface(x + dx * radius, z + dz * radius);
    if (h === null || Math.abs(h - s.height) > STEP_UP) return null;
  }
  return s.height;
}

// Waypoints from `from` to `to` (not including from), or null if there is no
// way within `pad` metres of the straight line. grid: the cell size (coarser
// is quicker over long distances); budget: how many cells it may expand.
export function findPath(map, from, to, { radius = 0.16, pad = 2, grid: GRID = 0.1, budget: limit = 8000 } = {}) {
  const x0 = Math.min(from.x, to.x) - pad;
  const z0 = Math.min(from.z, to.z) - pad;
  const cols = Math.round((Math.max(from.x, to.x) + pad - x0) / GRID) + 1;
  const rows = Math.round((Math.max(from.z, to.z) + pad - z0) / GRID) + 1;
  const count = cols * rows;
  const height = new Float32Array(count);
  const known = new Uint8Array(count); // 0: not looked at yet, 1: fits, 2: doesn't
  const xOf = (i) => x0 + (i % cols) * GRID;
  const zOf = (i) => z0 + Math.floor(i / cols) * GRID;
  const fits = (i) => {
    if (!known[i]) {
      const h = footing(map, xOf(i), zOf(i), radius);
      known[i] = h === null ? 2 : 1;
      height[i] = h ?? 0;
    }
    return known[i] === 1;
  };
  const cellOf = (p) => Math.round((p.z - z0) / GRID) * cols + Math.round((p.x - x0) / GRID);
  const start = cellOf(from);
  const end = cellOf(to);
  for (const [i, p] of [[start, from], [end, to]]) {
    known[i] = 1;
    height[i] = map.surface(p.x, p.z) ?? p.y;
  }
  // A* with a binary heap of [cost + guess, cell].
  const cost = new Float32Array(count).fill(Infinity);
  const came = new Int32Array(count).fill(-1);
  const done = new Uint8Array(count);
  const heap = [];
  const push = (f, i) => {
    heap.push([f, i]);
    for (let k = heap.length - 1; k > 0;) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) {
        const l = 2 * k + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (l + 1 < heap.length && heap[l + 1][0] < heap[m][0]) m = l + 1;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top[1];
  };
  const ec = end % cols;
  const er = Math.floor(end / cols);
  const guess = (i) => {
    const dc = Math.abs((i % cols) - ec);
    const dr = Math.abs(Math.floor(i / cols) - er);
    return (Math.max(dc, dr) + 0.414 * Math.min(dc, dr)) * GRID;
  };
  cost[start] = 0;
  push(guess(start), start);
  let found = false;
  for (let budget = limit; heap.length && budget > 0; budget -= 1) {
    const i = pop();
    if (done[i]) continue;
    if (i === end) {
      found = true;
      break;
    }
    done[i] = 1;
    const c = i % cols;
    const r = Math.floor(i / cols);
    for (const [dc, dr, step] of NEIGHBOURS) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const j = nr * cols + nc;
      if (done[j] || !fits(j) || Math.abs(height[j] - height[i]) > STEP_UP) continue;
      if (dc && dr && (!fits(r * cols + nc) || !fits(nr * cols + c))) continue; // no cutting corners
      const next = cost[i] + step * GRID;
      if (next < cost[j]) {
        cost[j] = next;
        came[j] = i;
        push(next + guess(j), j);
      }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let i = end; i !== -1; i = came[i]) cells.push(i);
  cells.reverse();
  // Pull tight: from each turn, run straight to the furthest cell in plain view.
  const straight = (a, b) => {
    const ax = xOf(a);
    const az = zOf(a);
    const length = Math.hypot(xOf(b) - ax, zOf(b) - az);
    let last = height[a];
    for (let t = 0.05; t < length; t += 0.05) {
      const k = t / length;
      const i = cellOf({ x: ax + (xOf(b) - ax) * k, z: az + (zOf(b) - az) * k });
      if (!fits(i) || Math.abs(height[i] - last) > STEP_UP) return false;
      last = height[i];
    }
    return true;
  };
  const path = [];
  for (let k = 0; k < cells.length - 1;) {
    let far = k + 1;
    while (far + 1 < cells.length && straight(cells[k], cells[far + 1])) far += 1;
    path.push(new THREE.Vector3(xOf(cells[far]), height[cells[far]], zOf(cells[far])));
    k = far;
  }
  if (path.length) path[path.length - 1].copy(to);
  return path;
}
