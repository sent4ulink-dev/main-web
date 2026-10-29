import * as THREE from "three";

// The big gate across the path's end, with the islands beyond it. It opens by
// itself as the bunny walks up to it (from either side), in a shower of
// sparkles, and swings shut again once she has gone on her way. Shut, it is a
// wall right across the path and out past both edges of the island (nobody
// hops or glides round it); open, only its two leaves stand in the way.

const SWING = 1.57; // how far each leaf opens (radians): a right angle, standing open along the way through
const OPEN_TIME = 1.5; // seconds to swing open…
const SHUT_TIME = 2.6; // …and to swing shut
const OPEN_AT = 6; // metres: it opens when she comes this near
const SHUT_AT = 10.5; // …and shuts once she is this far off again
const smooth = (t) => t * t * (3 - 2 * t);

// gate: play.json's { pos, half, leaf }; leaves: the two leaf objects of the
// island; walker: for the bodies that keep her out; onOpen(): it begins to open.
export function createGate({ gate, leaves = [], walker, fx, sfx, onOpen = () => {} }) {
  if (!gate || leaves.length < 2) return null;
  const centre = new THREE.Vector3(...gate.pos);
  const reach = gate.leaf ?? gate.half;
  // Each leaf swings on a hinge at its pillar. (The compressed model keeps a
  // leaf's own origin at its middle, so the hinge is a group of its own.)
  const [west, east] = leaves[0].position.x <= leaves[1].position.x ? leaves : [leaves[1], leaves[0]];
  const hinge = (leaf, side) => {
    const pivot = new THREE.Group();
    pivot.name = `Gate hinge ${side < 0 ? "L" : "R"}`;
    leaf.parent.updateWorldMatrix(true, false);
    pivot.position.copy(leaf.parent.worldToLocal(new THREE.Vector3(centre.x + side * gate.half, centre.y, centre.z)));
    leaf.parent.add(pivot);
    pivot.attach(leaf);
    return pivot;
  };
  const left = hinge(west, -1);
  const right = hinge(east, 1);
  let wanted = false; // should it be open?
  let amount = 0; // 0 shut … 1 wide open
  let sparkle = 0;

  // Shut: one wall across the path, far past its edges and far above her hop.
  let wall = null;
  // Wide open: each leaf where it rests, so she can't walk through the wood.
  let folded = [];
  function bodies() {
    const shut = !wanted && amount <= 0;
    if (shut && wall === null) {
      wall = walker.addCollider({ type: "box", x: centre.x, z: centre.z, halfX: gate.half + 3.6, halfZ: 0.2, yaw: 0 }, centre.y + 9);
    } else if (!shut && wall !== null) {
      walker.removeCollider(wall);
      wall = null;
    }
    const open = amount >= 0.9;
    if (open && !folded.length) {
      for (const side of [-1, 1]) {
        const yaw = side < 0 ? SWING : Math.PI - SWING;
        const hx = centre.x + side * gate.half;
        folded.push(walker.addCollider({
          type: "box", x: hx + Math.cos(yaw) * reach * 0.5, z: centre.z - Math.sin(yaw) * reach * 0.5, halfX: reach * 0.5, halfZ: 0.09, yaw,
        }, centre.y + 3.4));
      }
    } else if (!open && folded.length) {
      folded.forEach((id) => walker.removeCollider(id));
      folded = [];
    }
  }
  function pose() {
    const turn = smooth(amount) * SWING;
    left.rotation.y = turn;
    right.rotation.y = -turn;
  }
  bodies();
  pose();

  return {
    centre,
    // Open, or on its way open.
    get isOpen() { return wanted; },
    get amount() { return amount; },
    // A spot just through the gate, on the far side.
    beyond(metres = 2.2) {
      return new THREE.Vector3(centre.x, centre.y, centre.z - metres);
    },
    // position: where the bunny is while she walks (null otherwise: it shuts).
    update(dt, position = null) {
      const away = position ? Math.hypot(position.x - centre.x, position.z - centre.z) : Infinity;
      const next = away < (wanted ? SHUT_AT : OPEN_AT);
      if (next !== wanted) {
        wanted = next;
        if (wanted) {
          if (amount < 0.3) sfx?.chime?.();
          sparkle = 0;
          onOpen();
        }
      }
      const before = amount;
      amount = Math.min(1, Math.max(0, amount + (wanted ? dt / OPEN_TIME : -dt / SHUT_TIME)));
      if (amount === before) return;
      pose();
      bodies();
      if (!wanted) return;
      // Sparkles spill out of the widening gap, and a puff of hearts at the end.
      sparkle -= dt;
      if (sparkle <= 0 && fx) {
        sparkle = 0.14;
        const spread = (Math.random() - 0.5) * gate.half * 1.6 * amount;
        fx.sparkle(new THREE.Vector3(centre.x + spread, centre.y + 0.6 + Math.random() * 2.4, centre.z - 0.2), 5, Math.random() < 0.5 ? "#fff3a8" : "#ffd6ea");
      }
      if (before < 1 && amount >= 1) {
        fx?.hearts(new THREE.Vector3(centre.x, centre.y + 1.6, centre.z), 10);
        sfx?.twinkle?.();
      }
    },
    dispose() {
      if (wall !== null) walker.removeCollider(wall);
      folded.forEach((id) => walker.removeCollider(id));
      left.rotation.y = 0;
      right.rotation.y = 0;
      for (const [pivot, leaf] of [[left, west], [right, east]]) {
        pivot.parent?.attach(leaf);
        pivot.removeFromParent();
      }
    },
  };
}
