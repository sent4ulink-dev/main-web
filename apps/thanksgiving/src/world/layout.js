// Where everything is in the farmhouse (metres; three.js: +Y up, the front door looks out along +Z).
// The great room runs back from the front door along -Z: the welcome sign and the sideboard by the door,
// the long table down the middle (as long as the guest list needs), the living room at the far end.
export const FLOOR = 0.45;                 // the house sits up on its porch
export const HALF_W = 3.3;                 // the room is as wide as the house front
export const ROOM_H = 3.7;
export const WALL_Z = -0.11;               // the inside face of the front wall
export const TABLE_TOP = 0.74;
export const TABLE_W = 1.12;
export const SEAT = 0.62;                  // elbow room per person
export const SIDE_X = 0.86;                // a chair's centre from the table's middle
export const HEAD_Z = -5.2;                // the table's head end (a roomy hall by the door first)

/** Everything that depends on how many people sit down. */
export function layoutFor(seated) {
  const perSide = Math.max(4, Math.ceil(seated / 2));
  const L = perSide * SEAT + 0.75;
  const zHead = HEAD_Z, zEnd = zHead - L;
  const zBack = zEnd - 7.2;
  return {
    perSide, L, zHead, zEnd, zBack,
    mid: (zHead + zEnd) / 2,
    seat(i) {   // seat i: alternating sides, front to back (so neighbours in the list sit across from each other)
      const side = i % 2 === 0 ? -1 : 1, row = Math.floor(i / 2);
      const z = zHead - 0.38 - row * SEAT - 0.06;
      return { side, row, x: side * SIDE_X, z, yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2 };
    },
    living: { tv: zBack + 0.55, coffee: zBack + 1.85, sofa: zBack + 3.05 },
  };
}

export const SPOTS = {
  sign: { x: 2.35, z: -1.45, yaw: -1.25 },        // the welcome easel by the door, turned toward the room
  sideboard: { x: -HALF_W + 0.3, z: -2.6, yaw: Math.PI / 2 },
  dress: { x: -1.35, z: -3.0 },                   // where you stand to dress up
  wishbone: { x: 0.2, z: -3.0 },
  tripod: { x: 1.05, z: -3.75 },                 // the family camera, off to one side of the table's head
};
