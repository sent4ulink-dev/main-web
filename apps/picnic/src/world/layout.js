import * as THREE from 'three';

// Picnic layout in metres. The table sits at the origin, long side along Z.
// The "front" of the table faces +X: that's where the camera stands for every close-up,
// so all chapter objects face +X. Screen-left (from the front) is +Z.
export const TABLE_TOP_Y = 0.746;
export const TOP = TABLE_TOP_Y + 0.006;        // surface of the tablecloth
export const TABLE = { halfX: 0.623, halfZ: 1.462, cx: -0.005 };  // measured table-top board extents

export const TREE = { x: -3.55, z: 0.35 };
export const STUMP = { x: 1.9, z: 2.75, top: 0.355 };
export const POST_A = { x: -1.5, z: -1.95, h: 2.35 };   // screen-right post
export const POST_B = { x: -1.5, z: 1.95, h: 2.35 };    // screen-left post
export const POSTS = [POST_A, POST_B];
export const TREE_HOOKS = [new THREE.Vector3(-3.05, 2.95, 1.05), new THREE.Vector3(-3.1, 3.0, -0.45)];
export const PHOTO_LINE = { x: -1.5, y: 1.95, sag: 0.13 };
export const BALLOON_ANCHOR = new THREE.Vector3(0.26, TOP, 1.2);
export const FACE = Math.PI / 2;   // yaw that turns a +Z-facing model toward the camera (+X)

/** Chapter objects: front row, facing the camera. [x, z, yaw] */
export const ON_TABLE = {
  letter: [0.33, 0.84, FACE],
  jar: [0.33, 0.47, 0],
  cake: [0.04, 0.05, 0],
  crystal: [0.3, -0.42, FACE],
  calendar: [0.33, -0.8, FACE],
  instant: [0.36, -1.065, FACE],
  cassette: [0.34, -1.31, FACE],
};

/** Food, presents and decorations (back row). [name, x, z, yaw, scale] */
export const DECOR = [
  ['bread_basket', -0.32, 1.02, 0.25, 1],
  ['present_pink', -0.36, 1.34, 0.3, 1],
  ['present_gold', -0.05, 1.37, -0.4, 1],
  ['pie', -0.3, 0.5, 0, 1],
  ['berry_bowl', -0.05, 0.72, 0, 1],
  ['potted_plant', -0.52, 0.2, 0, 1],
  ['bottle', -0.43, -0.06, 0.4, 1],
  ['glass', -0.24, -0.16, 0, 1],
  ['glass_wine', -0.24, -0.16, 0, 1],
  ['sausage_board', -0.3, -0.56, 1.5708, 1],
  ['dip_bowl', -0.04, -0.78, 0, 1],
  ['cheese', -0.36, -0.98, 0.4, 1],
  ['olive_bowl', -0.08, -1.08, 0, 1],
  ['present_mint', -0.38, -1.33, 0.2, 1],
  ['present_lilac', -0.08, -1.36, -0.25, 1],
  ['present_blue', 0.36, 1.42, 0.5, 0.85],
  ['napkin', 0.46, 0.22, 0.12, 0.8],
  ['fork', 0.47, 0.2, 1.5708, 1],
  ['knife', 0.52, 0.25, 1.5708, 1],
  ['napkin', 0.47, -0.58, -0.1, 0.8],
];

/** Exclusion for grass/flowers: returns 0 (blocked) … 1 (free). pad grows the blocked area. */
export function exclude(x, z, pad = 0) {
  if (Math.hypot(x - STUMP.x, z - STUMP.z) < 0.78 + pad) return 0;
  if (Math.hypot(x - (TREE.x + 0.2), z - (TREE.z + 1.0)) < 0.9 + pad) return pad > 0 ? 0 : 0.35;
  for (const p of POSTS) if (Math.hypot(x - p.x, z - p.z) < 0.12 + pad) return 0;
  if (Math.abs(x) < 1.25 + pad && Math.abs(z) < 1.65 + pad) return pad > 0 ? 0 : 0.55;
  return 1;
}

export const local = (x, z) => ({ x, z });
