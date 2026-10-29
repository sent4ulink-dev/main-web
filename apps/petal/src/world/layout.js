// The island's layout, as the build wrote it into play.json.
//
// The art was first laid out with its five gardens crowded round one middle.
// The build now stands each of them along one path (tools/cute_isle_layout.py)
// and says here how far each was moved, where the path, its turnings, the
// gate and the crossroads are, and which part of the island a spot is in.
// Spots that were written down in the first layout's coordinates (the guided
// camera views, where butterflies gather…) are put where their garden is now.

// Each garden's middle as first laid out (x, z): the question garden, the
// activity board, the calendar tree, the treasure map, the keepsake book.
const FIRST = { 1: [-5.4, 3.9], 2: [-5.0, -1.75], 3: [-0.5, -4.6], 4: [3.6, 0.7], 5: [5.7, -4.7] };

export function createLayout(play) {
  const data = play?.layout ?? {};
  const moves = data.moves ?? {};
  const regions = data.regions ?? [];

  // The garden a spot of the first layout stood in (the nearest one).
  function gardenAt(x, z) {
    let best = 1;
    let near = Infinity;
    for (const [key, [gx, gz]] of Object.entries(FIRST)) {
      const d = Math.hypot(x - gx, z - gz);
      if (d < near) {
        near = d;
        best = Number(key);
      }
    }
    return best;
  }

  return {
    data,
    gardenAt,
    // A spot [x, y, z] of the first layout, where it is now.
    spot(point, garden = gardenAt(point[0], point[2])) {
      const move = moves[garden] ?? [0, 0, 0];
      return [point[0] + move[0], point[1] + move[1], point[2] + move[2]];
    },
    // The part of the island a spot belongs to (the build merges the island
    // by the same rule: the nearest part, measured to its rim).
    regionOf(x, z) {
      let best = "main";
      let near = Infinity;
      for (const region of regions) {
        const d = Math.hypot(x - region.x, z - region.z) - region.r;
        if (d < near) {
          near = d;
          best = region.name;
        }
      }
      return best;
    },
    // The path: { x, from, to, half } (it runs from z = from to z = to).
    path: data.path ?? null,
    // The turnings: { activity, calendar, place, keepsake } → { junction, stand, side }.
    stops: data.stops ?? {},
    // The crossroads beyond the gate, and the named places for the map.
    hub: data.hub ?? null,
    places: data.places ?? {},
    // The gate across the path's end: { pos, half, pillar, top, leaf }.
    gate: play?.gate ?? null,
  };
}
