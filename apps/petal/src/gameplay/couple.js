import * as THREE from "three";
import { SWING_BACK, SWING_RATE } from "./swing.js";

// The two of you. Once the dance at the keepsake book has been danced, the
// other bunny no longer goes away: it walks the island beside you, hand in
// hand; hops and glides when you do; sits down next to you (on a bench, the
// blanket, the grass) and leans on you; rides the balloon with you; stands by
// at the telescope; and at the swing it goes round behind and pushes.
// Whenever a scene needs it (a board, a dance) it goes off to that and comes
// back after. It is led from here, frame by frame (actors/host.js: lead).

// (A bunny's head is half a metre across: any nearer and two heads run into each other.)
export const GAP = 0.6; // metres between you, side by side
export const SEAT_GAP = 0.54; // …and sitting together, cheek to cheek
const BEHIND = 0.62; // where it walks when there is no room beside you
const PACE = 4.4; // its fastest (m/s): it catches up, but never darts
const FAR = 4; // further off than this, it pops over to you
const SEAT_TIME = 0.45; // its hop onto a seat (as long as yours)
const PUSH_FROM = SWING_BACK + 0.36; // how far behind the swing it stands to push: the seat comes back to its paws
const PUSH_TIME = 0.7; // one push…
const PUSH_LEAD = 0.32; // …begun this long before the seat is furthest back
const WADE_DEPTH = 0.16; // (actors/player.js)
const HAND = 0.3; // how high above the ground paws meet

const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const smooth = (t) => t * t * (3 - 2 * t);
const rand = (a, b) => a + Math.random() * (b - a);

// Which side of you it walks on (-1: your own -x side, 1: your +x side), and
// whether paws can be held there. Your -x paw may carry a carrot or the
// umbrella, your +x paw the bouquet: it keeps to a side whose paw is free,
// and to `now` while that one is. In the rain it is always at your +x side,
// away from your umbrella, with its own in its far paw.
export function sideFor(now, { flowers = 0, carrots = 0, rain = 0 } = {}) {
  const wet = rain >= 0.3;
  const free = { [-1]: carrots === 0 && !wet, 1: flowers === 0 };
  const side = wet ? 1 : !free[now] && free[-now] ? -now : now;
  return { side, hold: free[side] };
}

// The swing's angle is sin(time * rate) * reach: true on the frame a push
// should begin, a little before the seat is furthest back.
export function pushDue(before, now, rate = SWING_RATE, lead = PUSH_LEAD) {
  const at = Math.PI / 2 - lead * rate; // the phase a push begins at
  const turns = (time) => Math.floor((time * rate - at) / TAU);
  return turns(now) > turns(before);
}

// walker: your bunny; actor: the other one (host.js); getSwing(): the swing
// (gameplay/swing.js) once the game is up.
export function createCouple({ walker, actor, fx, sfx, getSwing = () => null, waterLevel = null }) {
  const map = walker.map;
  const pos = new THREE.Vector3(); // its feet
  const before = new THREE.Vector3(); // where you were last frame
  const hand = new THREE.Vector3(); // where paws meet
  const eyes = new THREE.Vector3(); // its face, for you to look at
  const yours = new THREE.Vector3(); // …and yours
  const sky = new THREE.Vector3();
  let heading = 0;
  let side = -1;
  let joined = false;
  let speed = 0;
  let vy = 0;
  let airborne = false;
  let landed = 0;
  let holding = false;
  let beside = true; // it has its place at your side (not behind you)
  let blocked = 0; // seconds its side has had no room
  let prefer = 0; // seconds the other side's paw has been the free one
  let still = 0; // seconds you have both stood still
  let glance = 0; // > 0: looking at each other as you walk
  let nextGlance = 5;
  let seat = null; // sitting beside you: { of, from, to, yaw, ground, edge, side, t }
  let lean = 0; // 0..1 and a little over: leaning on each other
  let greeted = false;
  let nuzzle = 0;
  let moment = 4; // seconds to the next little moment
  let pushes = 0;
  let lastTime = 0;
  let mode = "walk";

  const ground = (x, z) => {
    const h = map.surface(x, z);
    if (h === null || waterLevel === null) return h;
    return map.sample(x, z).water ? Math.max(h, waterLevel - WADE_DEPTH) : h;
  };
  const standable = (x, z, y, reach = 0.5) => {
    const h = map.surface(x, z);
    return h !== null && Math.abs(h - y) < reach;
  };

  // What your own bunny does about it: the paw that holds its paw, and how
  // far you lean on it.
  const company = () => {
    const at = seat?.side ?? side;
    return { hold: holding ? hand : null, holdHand: at < 0 ? 0 : 1, cuddle: at * lean };
  };
  // You look at it when you stand together, and now and then as you walk.
  const lookFor = () => (joined && mode !== "push" && (still > 1.2 || glance > 0 || nuzzle > 0) ? eyes : null);

  function letGo() {
    joined = false;
    seat = null;
    holding = false;
    lean = 0;
    walker.setCompany(null);
    walker.setLookProvider(null);
    const swing = getSwing();
    if (swing) swing.pushed = false;
  }

  // The nearest spot with footing round you (behind you first), when there
  // is no room at your side: a stepping stone, a narrow ledge.
  function anywhereNear(p, h) {
    let best = null;
    for (const r of [0.34, 0.5, 0.7, 0.95, 1.2]) {
      for (let k = 0; k < 12; k += 1) {
        const a = h + Math.PI + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6);
        const x = p.x + Math.sin(a) * r;
        const z = p.z + Math.cos(a) * r;
        if (standable(x, z, p.y, 0.6)) {
          best = [x, z];
          break;
        }
      }
      if (best) break;
    }
    return best;
  }

  // Where it wants to be while you walk: at your side, else the other side,
  // else behind you, else wherever there is footing (in the air: at your side).
  function walkSlot(p, h, dt, items) {
    const lx = Math.cos(h);
    const lz = -Math.sin(h);
    const at = (s) => [p.x + lx * s * GAP, p.z + lz * s * GAP];
    const wanted = sideFor(side, items);
    if (!walker.grounded) {
      beside = true;
      return at(side);
    }
    const ok = (s) => standable(...at(s), p.y);
    // The other side: when this one has no room, or its paw is the free one.
    blocked = !ok(side) && ok(-side) ? blocked + dt : 0;
    prefer = wanted.side !== side && ok(-side) ? prefer + dt : 0;
    if (blocked > 0.2 || prefer > 1) {
      side = -side;
      blocked = prefer = 0;
    }
    if (ok(side)) {
      beside = true;
      return at(side);
    }
    beside = false;
    const back = [p.x - Math.sin(h) * BEHIND, p.z - Math.cos(h) * BEHIND];
    if (standable(...back, p.y)) return back;
    return anywhereNear(p, h) ?? at(side);
  }

  // A step towards (x, z): carried along with you, and closing the rest of
  // the way at a walk. Returns how far off it still is.
  function stepTo(x, z, dt, { carry = true, pace = PACE, gain = 7 } = {}) {
    const p = walker.position;
    const fromX = pos.x;
    const fromZ = pos.z;
    const moved = Math.hypot(p.x - before.x, p.z - before.z);
    if (carry && moved < 0.5) {
      pos.x += p.x - before.x;
      pos.z += p.z - before.z;
    }
    const dx = x - pos.x;
    const dz = z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) {
      const step = Math.min(d, Math.min(pace, d * gain) * dt);
      pos.x += (dx / d) * step;
      pos.z += (dz / d) * step;
    }
    const went = Math.hypot(pos.x - fromX, pos.z - fromZ);
    speed = damp(speed, dt > 0 ? went / dt : 0, 14, dt);
    if (went > 0.004 && speed > 0.35) heading += wrap(Math.atan2(pos.x - fromX, pos.z - fromZ) - heading) * Math.min(1, dt * 11);
    return Math.hypot(x - pos.x, z - pos.z);
  }

  // Its height: on the ground under it, hopping as high as you hop, and
  // beside you in the air where there is no ground.
  function settle(dt, { ride = null } = {}) {
    const p = walker.position;
    const under = ground(pos.x, pos.z);
    let want;
    if (ride !== null) want = ride;
    else if (walker.grounded || walker.sitting) want = under !== null && Math.abs(under - p.y) < 1.2 ? under : p.y;
    else if (under === null) want = p.y;
    else {
      const yoursUnder = map.surface(p.x, p.z);
      want = yoursUnder === null ? Math.max(under, p.y) : under + Math.max(0, p.y - yoursUnder);
    }
    const from = pos.y;
    pos.y = damp(pos.y, want, want > pos.y ? 22 : 16, dt);
    if (Math.abs(pos.y - want) < 0.004) pos.y = want;
    const was = airborne;
    const fell = vy;
    vy = dt > 0 ? (pos.y - from) / dt : 0;
    airborne = ride === null && (under === null || pos.y - under > 0.05);
    landed = was && !airborne ? Math.min(6, Math.max(0, -fell)) : 0;
    return under;
  }

  function join() {
    joined = true;
    const p = walker.position;
    const h = walker.heading;
    if (actor.shown) {
      pos.copy(actor.position);
      heading = actor.heading;
    } else {
      const [x, z] = walkSlot(p, h, 0, { flowers: walker.holding[0], carrots: walker.holding[1] });
      pos.set(x, ground(x, z) ?? p.y, z);
      heading = h;
      actor.appear(pos, heading);
    }
    before.copy(p);
    actor.holdWand(false);
    actor.pointAt(null);
    actor.lookAt(null);
    actor.turnTo(null);
    actor.hop(0);
    speed = vy = 0;
    airborne = false;
    seat = null;
    lean = still = glance = nuzzle = 0;
    moment = 3;
    walker.setCompany(company);
    walker.setLookProvider(lookFor);
    // Together: the first time, a puff of hearts over the two of you.
    if (greeted) return;
    greeted = true;
    fx.hearts(pos.clone().lerp(p, 0.5).add(new THREE.Vector3(0, 1.1, 0)), 7);
    sfx.twinkle?.();
    actor.express("love", 2.2);
    walker.express("love", 2.2);
  }

  // It sits down next to you: on your seat, or on the grass beside you.
  function sitBeside(spot) {
    const p = walker.position;
    const yaw = spot.yaw ?? walker.heading;
    const at = spot.pos ? new THREE.Vector3(...spot.pos) : p.clone();
    let to = null;
    if (spot.beside) to = new THREE.Vector3(...spot.beside);
    else {
      for (const s of [side, -side]) {
        const x = at.x + Math.cos(yaw) * s * SEAT_GAP;
        const z = at.z - Math.sin(yaw) * s * SEAT_GAP;
        const h = map.surface(x, z);
        if (h !== null && Math.abs(h - at.y) < 0.4) {
          to = new THREE.Vector3(x, h, z);
          break;
        }
      }
    }
    // No room: it stands by you.
    if (!to) return { of: spot, standing: true };
    const along = (to.x - at.x) * Math.cos(yaw) - (to.z - at.z) * Math.sin(yaw);
    return { of: spot, from: pos.clone(), to, at, yaw, ground: Boolean(spot.ground), edge: spot.edge ?? 0.1, side: along >= 0 ? 1 : -1, t: 0 };
  }

  // A little moment as you sit together: a heart or two, a happy face, and
  // now and then it nuzzles up to you.
  function sweetMoment() {
    const p = walker.position;
    const between = pos.clone().lerp(p, 0.5).add(new THREE.Vector3(0, 0.78, 0));
    const roll = Math.random();
    if (roll < 0.3) {
      nuzzle = 1.5;
      fx.hearts(between, 3);
      sfx.kiss?.();
      actor.express("love", 2);
      walker.express("love", 2);
    } else {
      fx.hearts(between, roll < 0.7 ? 1 : 2);
      (roll < 0.65 ? actor : walker).express("happy", 1.8);
    }
  }

  return {
    // It is with you now; and on which side of you (-1: your own -x side).
    get together() { return joined; },
    get side() { return side; },
    get position() { return pos; },
    get mode() { return mode; },
    get holding() { return holding; },
    // on: the book's dance has been danced; walking: you walk now; busy: a
    // board or a dance has the other bunny; rain: how hard it rains (0..1).
    update(time, dt, { on = false, walking = false, busy = false, rain = 0 } = {}) {
      const since = lastTime;
      lastTime = time;
      if (busy) {
        if (joined) letGo();
        return;
      }
      if (!on || !walking) {
        if (joined) letGo();
        if (actor.shown) actor.vanish({ quiet: true }); // nobody to walk with
        return;
      }
      if (!joined) join();
      const p = walker.position;
      const h = walker.heading;
      const sitting = walker.sitting;
      const swing = getSwing();
      const pose = { sitting: false, seat: false, seatEdge: 0.1, rail: false, idle: walker.idle, look: null, cuddle: 0, shelter: false };
      let under = null;
      let leanTo = 0;
      holding = false;
      mode = sitting?.swing && swing ? "push" : sitting?.balloon ? "ride" : sitting?.pose === "scope" ? "watch" : sitting ? "sit" : "walk";
      if (swing) swing.pushed = false;
      if (mode !== "sit") seat = null;
      glance = Math.max(0, glance - dt);
      nuzzle = Math.max(0, nuzzle - dt);
      yours.set(p.x, p.y + 0.62, p.z);

      if (mode === "sit") {
        if (seat?.of !== sitting) seat = sitBeside(sitting);
        if (seat.standing) {
          stepTo(...walkSlot(p, h, dt, {}), dt);
          under = settle(dt);
          pose.look = yours;
        } else {
          // The hop onto the seat, then leaning on each other.
          seat.t = Math.min(1, seat.t + dt / SEAT_TIME);
          const k = smooth(seat.t);
          pos.lerpVectors(seat.from, seat.to, k);
          pos.y += Math.sin(Math.PI * seat.t) * 0.32;
          heading += wrap(seat.yaw - heading) * Math.min(1, dt * 12);
          speed = 0;
          vy = 0;
          airborne = seat.t < 1;
          landed = 0;
          const settled = seat.t >= 1 && !walker.busy;
          leanTo = settled ? (nuzzle > 0 ? 1.7 : 1) : 0;
          pose.sitting = seat.t >= 1;
          pose.seat = pose.sitting && !seat.ground;
          pose.seatEdge = seat.edge;
          pose.cuddle = -seat.side * lean;
          pose.look = nuzzle > 0 ? yours : null;
          holding = settled;
          hand.set((pos.x + p.x) / 2 + Math.sin(seat.yaw) * 0.1, (pos.y + p.y) / 2 + 0.21, (pos.z + p.z) / 2 + Math.cos(seat.yaw) * 0.1);
          under = seat.ground ? map.surface(pos.x, pos.z) : null;
          if (settled && !walker.asleep) {
            moment -= dt;
            if (moment <= 0) {
              moment = rand(3.5, 6.5);
              sweetMoment();
            }
          }
        }
      } else if (mode === "push") {
        // Round behind the swing, and a push each time the seat comes back.
        const fx_ = Math.sin(swing.yaw);
        const fz = Math.cos(swing.yaw);
        let tx = swing.base.x - fx_ * PUSH_FROM;
        let tz = swing.base.z - fz * PUSH_FROM;
        const behind = standable(tx, tz, swing.base.y, 0.6);
        if (!behind) {
          // No room behind it: it cheers you on from the side.
          tx = swing.base.x + Math.cos(swing.yaw) * side * 1.3 + fx_ * 0.5;
          tz = swing.base.z - Math.sin(swing.yaw) * side * 1.3 + fz * 0.5;
        }
        const off = stepTo(tx, tz, dt, { carry: false, pace: 3.2 });
        under = settle(dt);
        const there = off < 0.12;
        if (there) heading += wrap((behind ? swing.yaw : Math.atan2(p.x - pos.x, p.z - pos.z)) - heading) * Math.min(1, dt * 9);
        swing.pushed = there && behind;
        pose.shelter = true; // both paws for pushing: no umbrella
        pose.idle = 0;
        pose.look = yours;
        if (there && walker.sitting && !walker.busy && pushDue(since, time)) {
          pushes += 1;
          actor.play(behind ? "push" : "clap", behind ? PUSH_TIME : 1.1);
          actor.express("happy", 2.4);
          // You, on the seat: all smiles.
          walker.express(pushes % 4 === 0 ? "love" : "happy", 2.8);
          if (pushes % 2 === 0) fx.hearts(yours.clone().add(new THREE.Vector3(0, 0.5, 0)), 2);
        }
      } else if (mode === "ride") {
        // In the balloon's basket, at the rim beside you (you each have a
        // side of it, when it was boarded together).
        const apart = sitting.shared ? GAP : 0.4;
        const tx = p.x + Math.cos(h) * side * apart;
        const tz = p.z - Math.sin(h) * side * apart;
        const off = stepTo(tx, tz, dt, { pace: 6, gain: 12 });
        settle(dt, { ride: p.y });
        heading += wrap(h - heading) * Math.min(1, dt * 10);
        pose.rail = off < 0.2 && !walker.busy;
        pose.shelter = true; // under the balloon
        pose.idle = 0;
        airborne = !pose.rail;
        speed = 0;
      } else {
        const watching = mode === "watch";
        const items = { flowers: walker.holding[0], carrots: walker.holding[1], rain };
        const [tx, tz] = walkSlot(p, h, dt, items);
        if (Math.hypot(tx - pos.x, tz - pos.z) > FAR) {
          // You are suddenly somewhere else (a fall, a landing): it pops over.
          fx.sparkle(pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 10, "#ffd6ea");
          pos.set(tx, ground(tx, tz) ?? p.y, tz);
          fx.sparkle(pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 14, "#ffd6ea");
          speed = 0;
        }
        const off = stepTo(tx, tz, dt);
        under = settle(dt);
        // Standing: it turns your way a little, and you look at each other.
        const quiet = walker.speed < 0.2 && speed < 0.3 && !airborne;
        still = quiet ? still + dt : 0;
        if (quiet) {
          const toYou = Math.atan2(p.x - pos.x, p.z - pos.z);
          heading += wrap(h + wrap(toYou - h) * (still > 1.2 && !watching ? 0.5 : 0) - heading) * Math.min(1, dt * 6);
        } else {
          nextGlance -= dt;
          if (nextGlance <= 0) {
            nextGlance = rand(6, 11);
            glance = 1.5;
          }
        }
        if (watching) pose.look = sky.set(p.x + Math.sin(h) * 9, p.y + 6, p.z + Math.cos(h) * 9);
        else pose.look = still > 1.2 || glance > 0 ? yours : null;
        // Hand in hand, while there is room at your side and the paw is free.
        holding = !watching && beside && sideFor(side, items).hold && walker.grounded && !airborne && !walker.busy
          && off < 0.25 && Math.abs(pos.y - p.y) < 0.3;
        if (holding) {
          const rest = walker.idle > 16 ? 0.08 : 0; // (sat down for a rest on the grass)
          hand.set((pos.x + p.x) / 2, (pos.y + p.y) / 2 + HAND - rest, (pos.z + p.z) / 2);
        }
        // Resting on the grass together, they lean on each other too.
        leanTo = holding && walker.idle > 18 ? 0.7 : 0;
        pose.cuddle = -side * lean;
        if (watching) pose.idle = 0;
      }
      lean = damp(lean, leanTo, leanTo > lean ? 3 : 5, dt);
      eyes.set(pos.x, pos.y + 0.62, pos.z);
      before.copy(p);
      actor.lead({
        position: pos, heading, ground: under,
        speed, grounded: !airborne, vy, gliding: airborne && mode === "walk" && (walker.gliding || under === null), landed,
        wading: !airborne && Boolean(map.sample(pos.x, pos.z).water),
        hold: holding ? hand : null, holdHand: (seat?.side ?? side) < 0 ? 1 : 0,
        // Its umbrella is in its far paw, away from you.
        umbrellaHand: (seat?.side ?? side) < 0 ? 0 : 1,
        ...pose,
      });
    },
    dispose() {
      if (joined) letGo();
    },
  };
}
