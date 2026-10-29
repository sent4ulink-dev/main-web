import * as THREE from "three";
import { createFallbackBunny, loadBunny } from "./bunny.js";
import { findPath } from "../world/pathfind.js";

// The host: the other bunny (the boy when you play the girl, and the other way
// round). When you open a picking board it pops up beside it with a
// heart-tipped wand; tap a picture and it runs over and points at it, hopping
// for the ones it can't reach; when you choose, it cheers. The chooser
// (gameplay/chooser.js) tells it what to do. At the keepsake book a second
// bunny, dressed as you, joins it for a little dance (gameplay/celebration.js),
// and from then on it stays with you (gameplay/couple.js leads it).

export const BOARDS = [
  { key: "calendar", prefixes: ["SLOT_01"] },
  { key: "activity", prefixes: ["SLOT_02", "SLOT_03", "SLOT_04"] },
  { key: "place", prefixes: ["SLOT_05", "SLOT_06", "SLOT_07"] },
];
const RUN = 2.6; // m/s
const REACH = 1.2; // the highest point (above its feet) it can show without hopping
const HOP = 0.42; // hop height, metres
const HOP_TIME = 0.52; // seconds in the air
const HOP_REST = 0.16; // seconds on the ground between hops
const RADIUS = 0.3;
const TIPTOE_TIME = 1.4; // up on its toes, stretching
const PANT_TIME = 2.4; // catching its breath
// How worn out it gets: a hop, a stretch, a metre run; it recovers standing.
const EFFORT = { hop: 1, tiptoe: 0.6, metre: 0.25, rest: 0.12 };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rand = (a, b) => a + Math.random() * (b - a);

// Where a board is, which way it faces (towards visitors), how wide it is.
export function boardFrame(items) {
  const centre = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const box = new THREE.Box3();
  const points = [];
  for (const slot of items) {
    slot.updateWorldMatrix(true, false);
    box.setFromObject(slot);
    const c = box.getCenter(new THREE.Vector3());
    points.push({ slot, centre: c, box: box.clone() });
    centre.add(c);
    // Average every normal: the calendar is curved round the trunk, so one
    // vertex alone can point well off to the side.
    const normals = slot.geometry.attributes.normal;
    if (normals) {
      const sum = new THREE.Vector3();
      for (let i = 0; i < normals.count; i += 1) {
        sum.x += normals.getX(i);
        sum.y += normals.getY(i);
        sum.z += normals.getZ(i);
      }
      if (sum.lengthSq() > 1e-9) normal.add(sum.normalize().transformDirection(slot.matrixWorld));
    }
  }
  centre.divideScalar(items.length);
  normal.y = 0;
  if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1);
  normal.normalize();
  if (normal.z < 0) normal.negate(); // the boards face the visitors (+z)
  const side = new THREE.Vector3(normal.z, 0, -normal.x); // to the right as you face the board
  let half = 0;
  for (const p of points) {
    for (const corner of [p.box.min, p.box.max]) half = Math.max(half, Math.abs(corner.clone().sub(centre).dot(side)));
  }
  return { centre, normal, side, half, points };
}

export const roomy = (map, x, z) => map.isOpenGround(x, z)
  && [[0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]].every(([dx, dz]) => map.isOpenGround(x + dx, z + dz));

// The first roomy spot of these, on the ground.
function firstRoomy(map, spots) {
  for (const p of spots) {
    const y = map.surface(p.x, p.z);
    if (y !== null && roomy(map, p.x, p.z)) return new THREE.Vector3(p.x, y, p.z);
  }
  return null;
}
function* around(origin, frame, fronts, alongs) {
  for (const front of fronts) {
    for (const along of alongs) yield origin.clone().addScaledVector(frame.side, along).addScaledVector(frame.normal, front);
  }
}

// Where it waits: on open ground beside one end of the board…
function readySpot(map, frame) {
  const alongs = [0.55, 0.85, 1.2].flatMap((a) => [-(frame.half + a), frame.half + a]);
  return firstRoomy(map, around(frame.centre, frame, [0.7, 1.0, 1.35, 1.7], alongs));
}
// …or, on a narrow screen, in front of it near the middle (under the pictures).
function frontSpot(map, frame) {
  return firstRoomy(map, around(frame.centre, frame, [0.9, 1.1, 1.35, 1.6, 1.9], [0, -0.3, 0.3, -0.6, 0.6, -0.9, 0.9]));
}

// One bunny that moves on its own: it loads its rig, runs along a route round
// anything in the way, hops, turns, points its wand and plays the rig's
// gestures. style() says which character it is.
function createActor(scene, map, { fx, sfx, style, name, wand = false, preload = true }) {
  const rigs = {};
  let rig = null;
  let current = null; // the character the rig is
  let shown = false;
  const pos = new THREE.Vector3(); // its feet
  let route = []; // waypoints still to run
  let arrive = null; // called on reaching the end of the route
  let pace = RUN;
  let heading = 0;
  let facing = 0; // the way it is running
  let hopClock = -1; // < 0: on the ground
  let hopsLeft = 0;
  let keepHopping = () => false;
  // Showing something: { keep, high, move, clock, pantClock, breathAt }.
  let routine = null;
  let effort = 0; // how worn out it is
  let resting = false; // catching its breath: the wand down, eyes on you
  let looking = false; // turned round to you for a moment ("this one?")
  let drift = 0; // how fast a glide() is moving it this frame (dance steps)
  let led = null; // this frame it is led from outside (walking with you): see lead()
  let company = false; // …and so it was last frame: it is no body in your way
  let wandOn = wand;
  let weather = [0, 0]; // how hard it rains and snows (0..1)
  let face = null; // () => the yaw to turn to when standing (null: towards the camera)
  let gaze = null; // a point to look at (null: the camera)
  let aim = null; // a point to show with the wand
  const leftOf = new THREE.Vector3();
  const mouth = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const state = {
    speed: 0, run: 0, grounded: true, vy: 0, gliding: false, turn: 0, accel: 0, sitting: false, seat: false,
    rail: false, scope: false, wading: false, swing: 0, idle: 0, landed: 0, look: null, shelter: true,
    pointer: wand, point: null, pointHand: 1,
  };

  function load(next) {
    if (!rigs[next]) {
      rigs[next] = loadBunny(next).catch(() => createFallbackBunny()).then((r) => {
        r.root.visible = false;
        r.root.name = name;
        r.shadow.position.y = 0.012 / r.root.scale.y;
        scene.add(r.root);
        return r;
      });
    }
    return rigs[next];
  }
  async function ensure() {
    const next = style();
    if (next === current && rig) return rig;
    current = next;
    const r = await load(next);
    if (current !== next) return rig; // switched again while it loaded
    if (rig && rig !== r) rig.root.visible = false;
    rig = r;
    rig.root.visible = shown;
    return rig;
  }
  if (preload) ensure();

  // What it does next while showing something. Out of reach: a hop or a
  // stretch up on tiptoe, and once it is properly worn out (a few hops in a
  // row), right after one, it stops to catch its breath; the more tired, the
  // likelier. Within reach: it points a while. Either way it now and then
  // turns round to you ("this one?"), sometimes with a little wave.
  function nextMove() {
    resting = false;
    looking = false;
    if (!routine.keep()) {
      routine = null;
      return;
    }
    const last = routine.move;
    let move;
    if (routine.high()) {
      const tired = Math.min(0.85, Math.max(0, (effort - 2.6) / 2.4));
      const justTried = last === "hop" || last === "tiptoe";
      if (justTried && Math.random() < tired) move = "pant";
      else if (last !== "look" && last !== "pant" && Math.random() < 0.4) move = "look";
      else move = Math.random() < 0.55 ? "tiptoe" : "hop";
    } else move = last === "point" && Math.random() < 0.6 ? "look" : "point";
    routine.move = move;
    if (move === "hop") {
      hopsLeft = 1;
      routine.clock = HOP_TIME + HOP_REST + rand(0.15, 0.45);
    } else if (move === "tiptoe") {
      effort += EFFORT.tiptoe;
      rig?.play("tiptoe", TIPTOE_TIME);
      routine.clock = TIPTOE_TIME + rand(0.2, 0.5);
    } else if (move === "pant") {
      effort = Math.max(0, effort - 3.5);
      rig?.play("pant", PANT_TIME);
      resting = true;
      routine.pantClock = 0;
      routine.breathAt = 0.05;
      sfx.pant?.(PANT_TIME);
      routine.clock = PANT_TIME + 0.3;
    } else if (move === "look") {
      looking = true;
      if (Math.random() < 0.5) rig?.play("wave", 1.2);
      rig?.express("happy", 1.1);
      routine.clock = rand(1.3, 2);
    } else {
      routine.clock = rand(2, 3.5); // pointing at it a while
    }
  }

  return {
    warm: ensure,
    get shown() { return shown; },
    get position() { return pos; },
    get heading() { return heading; },
    get running() { return route.length > 0; },
    get airborne() { return hopClock >= 0 && hopClock < HOP_TIME; },
    // Pop up here, facing yaw (a sparkle and a pop, unless quiet).
    appear(at, yaw = heading, { quiet = false } = {}) {
      pos.copy(at);
      heading = facing = yaw;
      route = [];
      arrive = null;
      hopClock = -1;
      hopsLeft = 0;
      keepHopping = () => false;
      routine = null;
      resting = false;
      looking = false;
      shown = true;
      const reveal = () => {
        if (!shown || !rig) return;
        rig.root.visible = true;
        rig.root.position.copy(pos);
        rig.root.rotation.y = heading;
        if (!quiet) {
          fx.sparkle(pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 18, "#ffd6ea");
          sfx.pop();
        }
      };
      if (rig && current === style()) reveal();
      else ensure().then(reveal);
    },
    vanish({ quiet = false } = {}) {
      if (!shown) return;
      if (!quiet && rig?.root.visible) {
        fx.sparkle(pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 14, "#ffd6ea");
        sfx.poof?.();
      }
      shown = false;
      route = [];
      arrive = null;
      aim = null;
      routine = null;
      resting = false;
      looking = false;
      if (rig) rig.root.visible = false;
    },
    // Run to a spot round anything in the way, then call then().
    runTo(spot, then = null, speed = RUN) {
      route = findPath(map, pos, spot) || findPath(map, pos, spot, { radius: 0.08 }) || [spot.clone()];
      let from = pos;
      for (const point of route) {
        effort += from.distanceTo(point) * EFFORT.metre;
        from = point;
      }
      arrive = then;
      pace = speed;
    },
    // Hop `count` times on the spot, and on for as long as keep() says.
    hop(count = 1, keep = () => false) {
      hopsLeft = count;
      keepHopping = keep;
      routine = null;
      resting = false;
      looking = false;
    },
    // One happy hop, then, for as long as keep() says: if high() says the
    // point is out of reach, more tries (hops, stretches on tiptoe, a rest
    // when worn out), else pointing; and now and then a turn round to you.
    reach(keep, high = () => true) {
      hopsLeft = 1;
      keepHopping = () => false;
      resting = false;
      looking = false;
      routine = { keep, high, move: "hop", clock: HOP_TIME + HOP_REST + 0.2, pantClock: 0, breathAt: 0 };
    },
    // Step straight to a spot this frame (a dance), going this fast so its
    // feet keep time.
    glide(at, speed = 0) {
      route = [];
      arrive = null;
      pos.copy(at);
      drift = speed;
    },
    turnTo(fn) { face = fn; },
    lookAt(point) { gaze = point; },
    pointAt(point) { aim = point; },
    holdWand(on) { wandOn = on; },
    // Led from outside for this frame (it walks with you): where it is, which
    // way it faces and what it is doing (the rig's own state: speed,
    // grounded, vy, gliding, sitting, seat, swing, rail, wading, idle, look,
    // hold, holdHand, cuddle…), and `ground`, the height under it (or null).
    lead(next) { led = next; },
    // The weather it dresses for: a scarf in the snow; and, walking with you,
    // an umbrella in the rain (its paws are busy while it shows a board).
    setWeather(rain, snow) { weather = [rain, snow]; },
    setHolding(flowers, carrots) { rig?.setHolding?.(flowers, carrots); },
    play(type, duration) { rig?.play(type, duration); },
    express(kind, seconds) { rig?.express(kind, seconds); },
    cheer() { rig?.cheer(); },
    update(time, dt, camera) {
      if (!shown || !rig) {
        led = null;
        return;
      }
      if (current !== style()) ensure();
      const scale = rig.root.scale.y;
      if (led) {
        const { position, heading: yaw, ground = null, ...pose } = led;
        led = null;
        company = true;
        pos.copy(position);
        heading = facing = yaw;
        route = [];
        arrive = null;
        hopClock = -1;
        hopsLeft = 0;
        routine = null;
        resting = looking = false;
        rig.root.position.copy(pos);
        rig.root.rotation.y = heading;
        rig.setWeather?.(weather[0], weather[1]);
        rig.shadow.visible = ground !== null && !pose.sitting;
        if (ground !== null) rig.shadow.position.y = (ground - pos.y) / scale + 0.012 / scale;
        Object.assign(state, {
          speed: 0, run: 0, grounded: true, vy: 0, gliding: false, turn: 0, accel: 0, sitting: false, seat: false, seatEdge: 0.1,
          rail: false, scope: false, wading: false, swing: 0, idle: 0, landed: 0, look: null, shelter: false,
          hold: null, holdHand: 0, cuddle: 0, umbrellaHand: 0, ...pose, pointer: false, point: null,
        });
        rig.update(time, dt, state);
        return;
      }
      if (company) {
        // Back on its own: standing, wand as it was left.
        company = false;
        rig.shadow.visible = true;
        rig.shadow.position.y = 0.012 / scale;
        Object.assign(state, { gliding: false, sitting: false, seat: false, rail: false, wading: false, swing: 0, hold: null, cuddle: 0, turn: 0, accel: 0, umbrellaHand: 0 });
      }
      rig.setWeather?.(0, weather[1]);
      state.pointer = wandOn;
      let speed = 0;
      if (route.length) {
        // Along the route, waypoint by waypoint.
        let budget = pace * dt;
        while (budget > 0 && route.length) {
          const next = route[0];
          const dx = next.x - pos.x;
          const dz = next.z - pos.z;
          const d = Math.hypot(dx, dz);
          if (d > 1e-4) facing = Math.atan2(dx, dz);
          if (d <= budget) {
            pos.x = next.x;
            pos.z = next.z;
            budget -= d;
            route.shift();
          } else {
            pos.x += (dx / d) * budget;
            pos.z += (dz / d) * budget;
            budget = 0;
          }
        }
        pos.y = map.surface(pos.x, pos.z) ?? pos.y;
        heading += wrap(facing - heading) * Math.min(1, dt * 14);
        if (route.length) speed = pace;
        else {
          const done = arrive;
          arrive = null;
          done?.();
        }
      } else if (drift > 0) {
        speed = drift;
        drift = 0;
      }
      // Trying to reach something too high, one move after another.
      if (routine && !route.length) {
        routine.clock -= dt;
        if (resting) {
          // A puff of breath with every huff, slowing as it recovers.
          routine.pantClock += dt;
          if (routine.pantClock >= routine.breathAt) {
            routine.breathAt += 0.3 + Math.min(1, routine.pantClock / PANT_TIME) * 0.12;
            ahead.set(Math.sin(heading), 0, Math.cos(heading));
            rig.head.getWorldPosition(mouth).addScaledVector(ahead, 0.2).y -= 0.08;
            fx.breath?.(mouth, ahead);
          }
        }
        if (routine.clock <= 0) nextMove();
      }
      // Hopping on the spot.
      state.landed = 0;
      let lift = 0;
      if (!route.length && hopClock < 0 && (hopsLeft > 0 || keepHopping())) {
        hopClock = 0;
        effort += EFFORT.hop;
        sfx.hop?.();
      }
      if (!route.length && hopClock < 0) effort = Math.max(0, effort - dt * EFFORT.rest);
      if (hopClock >= 0) {
        hopClock += dt;
        const t = hopClock / HOP_TIME;
        if (t < 1) {
          lift = HOP * 4 * t * (1 - t);
          state.vy = (HOP * 4 * (1 - 2 * t)) / HOP_TIME;
        } else if (hopClock >= HOP_TIME + HOP_REST) {
          hopClock = -1;
          hopsLeft = Math.max(0, hopsLeft - 1);
        }
      }
      const airborne = hopClock >= 0 && hopClock < HOP_TIME;
      if (!airborne && state.grounded === false) state.landed = 2.4;
      state.grounded = !airborne;
      if (!airborne) state.vy = 0;
      // Standing: turn the way it is told, else towards you (and always to
      // you while it catches its breath or checks with you).
      const toYou = resting || looking;
      if (!route.length) {
        const want = toYou || !face ? Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z) : face();
        heading += wrap(want - heading) * Math.min(1, dt * 8);
      }
      rig.root.position.set(pos.x, pos.y + lift, pos.z);
      rig.root.rotation.y = heading;
      // Point with the paw on the side of the target.
      if (aim) {
        leftOf.set(Math.cos(heading), 0, -Math.sin(heading));
        state.pointHand = (aim.x - pos.x) * leftOf.x + (aim.z - pos.z) * leftOf.z >= 0 ? 1 : 0;
      }
      state.point = route.length || toYou ? null : aim;
      state.speed = speed;
      state.run = speed > 2 ? 1 : 0;
      state.look = route.length ? null : toYou ? camera.position : aim || gaze || camera.position;
      state.idle = 0;
      rig.update(time, dt, state);
    },
    // For your bunny's movement: it is solid.
    obstacle() {
      return shown && !company ? { x: pos.x, y: pos.y, z: pos.z, r: RADIUS, h: 0.95 } : null;
    },
    dispose() {
      for (const promise of Object.values(rigs)) {
        promise.then((r) => {
          scene.remove(r.root);
          r.dispose();
        });
      }
    },
  };
}

export function createHost(scene, { walker, slots, fx, sfx }) {
  const map = walker.map;
  const stations = BOARDS.map(({ key, prefixes }) => {
    const items = prefixes.map((prefix) => slots.find((s) => s.name.startsWith(prefix))).filter(Boolean);
    if (!items.length) return null;
    const frame = boardFrame(items);
    const position = readySpot(map, frame);
    return position ? { key, frame, position } : null;
  }).filter(Boolean);

  const host = createActor(scene, map, {
    fx, sfx, name: "Host bunny", wand: true,
    style: () => (walker.character === "boy" ? "girl" : "boy"),
  });
  // A stand-in for you in the book dance (your own bunny steps aside for it),
  // loaded once the island is up.
  const partner = createActor(scene, map, { fx, sfx, name: "Partner bunny", style: () => walker.character, preload: false });
  const warmTimer = setTimeout(() => partner.warm(), 8000);
  let station = null;
  let layout = "side"; // "side": it stands beside what it shows; "front": in front, just under it
  const aim = new THREE.Vector3(); // what it shows
  let party = 0;
  let camera = null;

  // Where it waits at a board.
  function readyFor(next, how) {
    if (how !== "front") return next.position;
    next.front ||= frontSpot(map, next.frame) || next.position;
    return next.front;
  }

  // Where to stand to show a point on the board: just beside it (like a
  // presenter next to a slide), on the side it is coming from, on open ground.
  // In front of the board (narrow screens) it stands a step out from it, a
  // little to that side of the point, so it can turn and point up at it.
  function spotFor(point, half) {
    const f = station.frame;
    const pos = host.position;
    const from = (pos.x - point.x) * f.side.x + (pos.z - point.z) * f.side.z >= 0 ? 1 : -1;
    if (layout === "front") {
      const under = point.clone().setY(f.centre.y).addScaledVector(f.normal, f.normal.dot(f.centre.clone().sub(point)));
      const alongs = [0.35, 0.6, 0.15, 0.85].flatMap((a) => [from * a, -from * a]);
      const spot = firstRoomy(map, around(under, f, [0.9, 1.1, 1.35, 1.6, 1.9], alongs));
      if (spot) return spot;
    }
    // (Boards stand on frames and feet, so the ground right in front may be
    // taken: step further out if it is.)
    for (const front of [0.55, 0.8, 1.05, 1.3, 1.6]) {
      for (const sign of [from, -from]) {
        for (const extra of [0.2, 0.4, 0.65]) {
          const p = point.clone().addScaledVector(f.side, sign * (half + extra)).addScaledVector(f.normal, front);
          const y = map.surface(p.x, p.z);
          if (y !== null && roomy(map, p.x, p.z)) return new THREE.Vector3(p.x, y, p.z);
        }
      }
    }
    // Anywhere open close to the point, last of all.
    for (let r = 0.6; r < 2.6; r += 0.3) {
      for (let k = 0; k < 12; k += 1) {
        const a = (k / 12) * Math.PI * 2;
        const p = point.clone().addScaledVector(f.normal, 0.8 + Math.max(0, Math.sin(a)) * r).addScaledVector(f.side, Math.cos(a) * r);
        const y = map.surface(p.x, p.z);
        if (y !== null && roomy(map, p.x, p.z)) return new THREE.Vector3(p.x, y, p.z);
      }
    }
    return pos.clone();
  }
  // Half way between you and what it shows, a little towards the picture.
  const presenting = () => {
    const p = host.position;
    const toAim = Math.atan2(aim.x - p.x, aim.z - p.z);
    if (!camera) return toAim;
    const toYou = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
    return toYou + wrap(toAim - toYou) * 0.3;
  };

  return {
    stations,
    host,
    partner,
    get presenting() { return station?.key ?? null; },
    // Where it would wait at this board ("side" or "front" layout).
    readyFor(key, how = "side") {
      const next = stations.find((s) => s.key === key);
      return next ? readyFor(next, how).clone() : null;
    },
    // Pop up beside a board (or in front of it), wand ready.
    present(key, { layout: how = "side" } = {}) {
      const next = stations.find((s) => s.key === key);
      if (!next) return;
      station = next;
      layout = how;
      party = 0;
      aim.copy(next.frame.centre);
      host.holdWand(true);
      host.pointAt(null);
      host.lookAt(null);
      host.turnTo(null); // waiting: facing you
      host.appear(readyFor(next, how));
    },
    // Run over to show this point (on the board; half: half the width of the
    // picture), and hop if it is too high. Returns where it will stand.
    show(point, half = 0.3) {
      if (!station) return null;
      aim.copy(point);
      party = 0;
      host.pointAt(null);
      host.turnTo(presenting);
      const spot = spotFor(point, half);
      host.runTo(spot, () => {
        host.pointAt(aim);
        // One cute hop; then more tries while the point is out of reach, or
        // pointing at it; and now and then a turn round to you.
        host.reach(() => station !== null && party <= 0, () => aim.y - host.position.y > REACH);
      });
      return spot.clone();
    },
    // You chose: a happy little dance.
    celebrate() {
      if (!station) return;
      party = 2.4;
      host.pointAt(null);
      host.hop(0);
      host.turnTo(null); // cheering with you
      host.cheer();
      host.express("love", 2.4);
      host.play("dance", 2.2);
      const pos = host.position;
      fx.hearts(pos.clone().add(new THREE.Vector3(0, 1.1, 0)), 9);
      fx.sparkle(pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 18, "#fff3a8");
      sfx.fanfare();
    },
    leave() {
      station = null;
      host.vanish();
    },
    // The weather the two dress for (your stand-in wears what you wear).
    setWeather(rain, snow) {
      host.setWeather(rain, snow);
      partner.setWeather(rain, snow);
    },
    update(time, dt, { camera: view }) {
      camera = view;
      party = Math.max(0, party - dt);
      host.update(time, dt, view);
      partner.update(time, dt, view);
    },
    // For your bunny's movement: they are solid.
    obstacles() {
      return [host.obstacle(), partner.obstacle()].filter(Boolean);
    },
    dispose() {
      clearTimeout(warmTimer);
      host.dispose();
      partner.dispose();
    },
  };
}
