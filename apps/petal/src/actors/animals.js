import { createLayout } from "../world/layout.js";
import * as THREE from "three";
import { createHerd } from "./herd.js";
import { BIRD, BUNNY, DUCK, FISH, FROG, OWL, SWAN } from "./species.js";
import { createCat } from "./cat.js";
import { bankSpots, isOpenWater, koiJump, planLanes } from "./pond.js";
import { approachAngle, clamp, damp, wrapAngle } from "../core/math.js";
import { environment as shared } from "../core/uniforms.js";

const PUSHERS = shared.uPushers.value;
const CAT_ALONG = 0.44; // how far along its bench the cat naps (the seat is 1.2 m)

// The island's residents. Each species is one instanced draw call whose parts
// (heads, ears, wings, tails, legs, eyelids) move on the GPU (herd.js); this
// file decides what every animal does, reading the player, the time of day
// and the weather:
//   bunnies graze, twitch their ears, hop off when you run, come closer when
//   you stand still, cuddle up when you sit on the grass, follow you after a
//   carrot, and sleep at night;
//   a mother duck leads her ducklings round the lily pond (bottoms up now and
//   then), frogs puff their throats and leap away, koi jump, songbirds peck
//   and fly off (and hide at night and in the rain), two swans meet and bend
//   their necks into a heart, an owl watches the Lantern Grove after dark,
//   and a cat naps on a bench.

export function createAnimals(scene, { walker, play, fx, sfx, notify = () => {}, environment = null, onEvent = () => {}, debug = false }) {
  const map = walker.map;
  const V = (a) => new THREE.Vector3(...a);
  const rand = (a, b) => a + Math.random() * (b - a);
  const ground = (x, z, fallback = 0) => map.surface(x, z) ?? fallback;
  // Room for a whole animal: open, dry ground all around, never inside a prop.
  const dry = (x, z) => map.isOpenGround(x, z) && [[0.14, 0], [-0.14, 0], [0, 0.14], [0, -0.14]].every(([dx, dz]) => map.isOpenGround(x + dx, z + dz));
  const facing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
  const night = () => shared.uNight.value;
  const rain = () => environment?.weights.rain ?? 0;
  function randomSpot(center, radius, tries = 30) {
    for (let i = 0; i < tries; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * Math.sqrt(Math.random());
      const x = center.x + Math.cos(a) * r;
      const z = center.z + Math.sin(a) * r;
      if (dry(x, z)) return new THREE.Vector3(x, ground(x, z), z);
    }
    return center.clone();
  }
  const say = (() => {
    const last = new Map();
    return (text, key, cooldown = 45000) => {
      const now = performance.now();
      if (last.has(key) && now - last.get(key) < cooldown) return;
      last.set(key, now);
      notify(text);
    };
  })();

  // ------------------------------------------------------------ bunnies --
  const meadow = play.zones.meadow ? { center: V(play.zones.meadow.center), radius: play.zones.meadow.radius } : null;
  // Two bunnies live in the activity garden (spots written down in the first
  // layout go with their garden: world/layout.js).
  const layout = createLayout(play);
  const gardenZone = { center: new THREE.Vector3(...layout.spot([-4.6, 0.5, 0.4])), radius: 2.2 };
  const bunnyZones = [meadow, meadow, meadow, meadow, meadow, gardenZone, gardenZone].filter(Boolean);
  const bunnyHerd = createHerd(scene, {
    name: "bunnies", geometry: BUNNY.geometry(), parts: BUNNY.parts, count: bunnyZones.length,
    tints: ["#ffffff", "#f0d2b4", "#ffffff", "#e2d9e4", "#fff2e4", "#d7b394", "#ffffff"],
  });
  const bunnies = bunnyZones.map((zone) => {
    const pos = randomSpot(zone.center, zone.radius);
    return {
      zone, pos, from: pos.clone(), to: pos.clone(), heading: Math.random() * 6, hop: 1, hops: 0, timer: rand(0.5, 3),
      fed: 0, lastPet: 0, petT: 0, face: null, mode: "idle", headYaw: 0, headPitch: 0, ears: [0, 0], earKick: [0, 0],
      blink: rand(1, 4), graze: rand(0, 6), cuddle: null,
    };
  });
  function startHops(b, target, count) {
    b.target = target;
    b.hops = count;
    b.hop = 1;
  }
  function nextHop(b) {
    const dir = new THREE.Vector3().subVectors(b.target, b.pos).setY(0);
    const dist = dir.length();
    if (dist < 0.15 || b.hops <= 0) {
      b.hops = 0;
      return;
    }
    dir.normalize().multiplyScalar(Math.min(0.5, dist));
    const nx = b.pos.x + dir.x;
    const nz = b.pos.z + dir.z;
    const crowded = bunnies.some((o) => o !== b && Math.hypot(o.to.x - nx, o.to.z - nz) < 0.36)
      || Math.hypot(walker.position.x - nx, walker.position.z - nz) < 0.42;
    if (!dry(nx, nz) || crowded) {
      b.hops = 0;
      return;
    }
    b.from.copy(b.pos);
    b.to.set(nx, ground(nx, nz, b.pos.y), nz);
    b.heading = facing(b.from, b.to);
    b.hop = 0;
    b.hops -= 1;
  }

  // ------------------------------------------------ pond: ducks and more --
  const pond = play.zones.pond ? { center: V(play.zones.pond.center), radius: play.zones.pond.radius } : null;
  // Everyone in the pond keeps to open water (never through the dock, the
  // boat or each other): round lanes, outermost first - mum and her
  // ducklings, two more ducks, then the swans circling the middle, where they
  // meet to make their heart.
  const openWater = (x, z) => isOpenWater(map, x, z);
  const lanes = pond ? planLanes(openWater, pond.center, pond.radius, [
    { name: "mum", share: 0.6, half: 0.12 },
    { name: "duck", share: 0.47, half: 0.12 },
    { name: "duck", share: 0.33, half: 0.12 },
    { name: "swans", share: 0.17, half: 0.2 },
  ]) : [];
  if (debug && pond) console.info("[animals] pond lanes", lanes.map((l) => `${l.name} ${l.radius.toFixed(2)}${l.clear ? "" : " (blocked)"}`).join(", "));
  const duckHerd = pond ? createHerd(scene, { name: "ducks", geometry: DUCK.geometry(), parts: DUCK.parts, count: 7, tints: ["#ffffff", "#fff6d6", "#ffffff", "#ffe36e", "#ffe36e", "#ffe88a", "#ffe36e"] }) : null;
  // Ducks 0-2 paddle their lanes (duck 1 the other way round); 3-6 are
  // ducklings in a row behind duck 0.
  const ducks = pond ? Array.from({ length: 7 }, (_, i) => {
    const lane = lanes[Math.min(i, 2)].radius;
    return {
      duckling: i >= 3, lane, angle: i < 3 ? i * 2.1 : 0, dir: i === 1 ? -1 : 1, speed: [0.2, 0.26, 0.22][Math.min(i, 2)] / lane,
      quack: 0, pos: pond.center.clone(), heading: 0, petT: 0, face: null, dive: 0, diveClock: rand(8, 20), flap: 0, blink: rand(1, 4),
    };
  }) : [];
  const frogHerd = pond ? createHerd(scene, { name: "frogs", geometry: FROG.geometry(), parts: FROG.parts, count: 3, tints: ["#ffffff", "#e8ffd8", "#ffffff"] }) : null;
  const banks = pond ? bankSpots(map, openWater, pond.center, pond.radius, 12) : [];
  const bank = (k) => new THREE.Vector3(banks[k].x, banks[k].y, banks[k].z);
  const frogs = banks.length >= 4 ? [0, 1, 2].map((i) => {
    const spot = Math.floor((i * banks.length) / 3);
    return { spot, pos: bank(spot), from: bank(spot), to: bank(spot), hop: 1, hopTime: 0.5, hopHeight: 0.3, cool: 0, heading: facing(bank(spot), pond.center), croak: 0, croakClock: rand(3, 9), petT: 0, blink: rand(1, 4) };
  }) : [];
  const fishHerd = pond ? createHerd(scene, { name: "koi", geometry: FISH.geometry(), parts: FISH.parts, count: 2, tints: ["#ffe0cc", "#ffffff"] }) : null;
  const fish = pond ? [0, 1].map(() => ({ timer: rand(2, 6), t: 1, from: new THREE.Vector3(), to: new THREE.Vector3() })) : [];
  const swanHerd = pond ? createHerd(scene, { name: "swans", geometry: SWAN.geometry(), parts: SWAN.parts, count: 2, tints: ["#ffffff", "#fff8f8"] }) : null;
  const swans = pond ? [0, 1].map((i) => ({ angle: i * Math.PI, pos: pond.center.clone(), heading: 0, yaw: 0, pitch: 0, wings: 0, petT: 0, face: null })) : [];
  let romance = { clock: 18, t: -1, seen: false };

  // --------------------------------------------------------------- birds --
  const homes = [
    ...[[-4, 0.5, 4], [3, 1, -1], [-1, 1, -5.5], [5.5, 1.3, -5.5]].map((p) => new THREE.Vector3(...layout.spot(p))),
    meadow?.center, pond ? pond.center.clone().add(new THREE.Vector3(2.5, 0, 2)) : null,
  ].filter(Boolean);
  const birdHerd = createHerd(scene, { name: "birds", geometry: BIRD.geometry(), parts: BIRD.parts, count: 8, tints: ["#9fd4ff", "#ffb3cf", "#ffe08a", "#c9b2ff", "#ffffff", "#9fd4ff", "#ffc9a8", "#ffb3cf"] });
  const birds = Array.from({ length: 8 }, (_, i) => {
    const home = homes[i % homes.length];
    return { home, pos: randomSpot(home, 1.8), state: "perched", timer: 0, vel: new THREE.Vector3(), heading: Math.random() * 6, peck: Math.random() * 5, look: 0, lookClock: rand(1, 3), shown: 1, blink: rand(1, 4) };
  });

  // ------------------------------------------------------------ the owl --
  const grove = play.swing ? V(play.swing.pos) : null;
  const perch = grove && (play.lamps || []).length
    ? play.lamps.map(V).sort((a, b) => a.distanceTo(grove) - b.distanceTo(grove))[0].clone().add(new THREE.Vector3(0, 0.21, 0))
    : null;
  const owlHerd = perch ? createHerd(scene, { name: "owl", geometry: OWL.geometry(), parts: OWL.parts, count: 1, tints: ["#ffffff"], emissive: { color: "#6a5a8a", intensity: 0.35 } }) : null;
  const owl = { shown: 0, yaw: 0, tilt: 0, blink: 3, hoot: 6 };

  // ------------------------------------------------------------ the cat --
  const bench = play.benches.find((b) => !b.ground && b.pos[2] < -12) || play.benches[2] || play.benches[0];
  const catSpot = V(bench.pos).addScaledVector(new THREE.Vector3(Math.cos(bench.yaw), 0, -Math.sin(bench.yaw)), CAT_ALONG);
  const cat = createCat(scene, { position: catSpot, heading: bench.yaw });
  cat.pos = cat.position;

  // Blink timer shared by everyone: returns 1 while the eyes are shut.
  function blinkOf(a, dt, asleep = false) {
    if (asleep) return 1;
    a.blink -= dt;
    if (a.blink < -0.12) a.blink = Math.random() < 0.2 ? 0.2 : rand(2, 5);
    return a.blink < 0 ? 1 : 0;
  }

  const api = {
    // Where the sleepy cat naps (so the bunny can sit along from it).
    get catPosition() { return cat.pos; },
    // Animals the bunny keeps her body clear of: { x, y, z, r, h } (feet
    // position, radius and height) for those within `range` metres.
    obstacles(position, range = 3) {
      const out = [];
      const add = (p, r, h) => {
        if (Math.abs(p.x - position.x) < range && Math.abs(p.z - position.z) < range) out.push({ x: p.x, y: p.y, z: p.z, r, h });
      };
      bunnies.forEach((b) => add(b.pos, 0.15, 0.32));
      add(cat.pos, 0.28, 0.3); // lies across its bench, 0.55 m nose to tail
      frogs.forEach((f) => add(f.pos, 0.09, 0.12));
      ducks.forEach((d) => add(d.pos, d.duckling ? 0.08 : 0.14, d.duckling ? 0.14 : 0.26));
      swans.forEach((s) => add(s.pos, 0.2, 0.48));
      return out;
    },
    // Nearest animal the bunny can pet or feed.
    nearest(position, reach = 1.3) {
      let best = null;
      const k = reach / 1.3;
      const consider = (kind, index, pos, range) => {
        const d = pos.distanceTo(position);
        if (d < range * k && (!best || d < best.distance)) best = { kind, index, distance: d, position: pos.clone() };
      };
      bunnies.forEach((b, i) => consider("bunny", i, b.pos, 1.1));
      consider("cat", 0, cat.pos, 1.2);
      ducks.forEach((d, i) => consider("duck", i, d.pos, d.duckling ? 1.0 : 1.3));
      frogs.forEach((f, i) => consider("frog", i, f.pos, 1.0));
      swans.forEach((s, i) => consider("swan", i, s.pos, 1.5));
      return best;
    },
    // Each animal plays a little happy reaction while being petted.
    pet(target) {
      const face = walker.position.clone();
      if (target.kind === "bunny") {
        const b = bunnies[target.index];
        b.lastPet = performance.now();
        b.petT = 1.7;
        b.hops = 0;
        b.face = face;
        fx.hearts(b.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 5);
        sfx.pop();
      } else if (target.kind === "cat") {
        const wasAsleep = !cat.awake;
        cat.pet(face);
        fx.hearts(cat.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 6);
        sfx.purr();
        notify(wasAsleep ? "The sleepy cat woke up and stretched… it seems to want more petting. ♡" : "Purrr… it is rubbing its head against your paw. ♡");
      } else if (target.kind === "duck") {
        const d = ducks[target.index];
        d.petT = 1.3;
        d.face = face;
        sfx.quack(d.pos);
        fx.hearts(d.pos.clone().add(new THREE.Vector3(0, 0.25, 0)), 4);
        fx.ripple(d.pos, 0.8);
      } else if (target.kind === "frog") {
        const f = frogs[target.index];
        f.petT = 1.2;
        f.cool = 3;
        f.heading = facing(f.pos, face);
        sfx.ribbit(f.pos);
        fx.hearts(f.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 3);
      } else if (target.kind === "swan") {
        const s = swans[target.index];
        s.petT = 1.6;
        s.face = face;
        fx.hearts(s.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 6);
        sfx.chime();
      }
    },
    feed(target) {
      const b = bunnies[target.index];
      b.fed = 30;
      b.lastPet = performance.now();
      fx.hearts(b.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 8);
      sfx.pop();
      notify("Crunch! This bunny will follow you for a while. ♡");
    },
    update(time, dt, player) {
      const near = player && walker.active ? player : null;
      this.still = walker.speed < 0.2 ? (this.still || 0) + dt : 0;
      const dark = night();
      const wet = rain();
      const sittingDown = near && walker.sitting && (walker.sitting.ground || walker.sitting.pos) && !walker.sitting.pose && !walker.sitting.balloon && !walker.sitting.swing;

      // ---------------------------------------------------------- bunnies --
      bunnies.forEach((b, i) => {
        const asleep = dark > 0.65;
        const d = near ? b.pos.distanceTo(near) : 99;
        let wantYaw = 0;
        let wantPitch = 0;
        let earBack = asleep ? 0.9 : wet > 0.5 ? 0.6 : 0;
        if (b.petT > 0) {
          b.petT -= dt;
          b.heading = approachAngle(b.heading, facing(b.pos, b.face), 10, dt);
          earBack = 0.7;
        } else if (b.hop < 1) {
          b.hop = Math.min(1, b.hop + dt / 0.32);
          b.pos.lerpVectors(b.from, b.to, b.hop);
          b.pos.y = THREE.MathUtils.lerp(b.from.y, b.to.y, b.hop) + Math.sin(Math.PI * b.hop) * 0.16;
          if (b.hop >= 1) b.timer = b.hops > 0 ? 0.08 : rand(1, 4);
          earBack += 0.35;
        } else if (asleep) {
          b.hops = 0;
        } else {
          b.timer -= dt;
          b.fed = Math.max(0, b.fed - dt);
          if (b.fed > 0 && near && d > 0.9) {
            const behind = near.clone().add(new THREE.Vector3(Math.sin(i * 1.7) * 0.5, 0, Math.cos(i * 1.7) * 0.5));
            startHops(b, behind, 3);
            nextHop(b);
          } else if (sittingDown && d < 5 && d > 0.75 && b.timer <= 0) {
            // Cuddle up beside you when you sit down.
            if (!b.cuddle) b.cuddle = new THREE.Vector3(Math.cos(i * 2.4) * 0.8, 0, Math.sin(i * 2.4) * 0.8);
            startHops(b, near.clone().add(b.cuddle), 4);
            nextHop(b);
            if (b.hop >= 1) b.timer = rand(0.4, 1.2);
          } else if (near && this.still > 0.8 && d > 0.8 && d < 3.5 && b.timer <= 0) {
            const close = b.pos.clone().sub(near).setY(0).normalize().multiplyScalar(0.6).add(near);
            startHops(b, close, 3);
            nextHop(b);
            if (b.hop >= 1) b.timer = rand(0.5, 1.5);
          } else if (b.timer <= 0) {
            if (b.hops > 0) nextHop(b);
            else if (!sittingDown) {
              startHops(b, randomSpot(b.zone.center, b.zone.radius), 1 + Math.floor(Math.random() * 4));
              nextHop(b);
              if (b.hop >= 1) b.timer = rand(1, 3);
            }
          }
          if (!sittingDown) b.cuddle = null;
        }
        // Where the head goes: toward you when you are close, else grazing.
        if (near && d < 3.2 && !asleep) {
          wantYaw = clamp(wrapAngle(facing(b.pos, near) - b.heading), -1.1, 1.1);
          wantPitch = sittingDown && d < 1.4 ? 0.15 : -0.12;
        } else if (!asleep && b.hop >= 1) {
          b.graze += dt;
          const nibble = Math.sin(b.graze * 0.7) > 0.2;
          wantPitch = nibble ? 0.5 + Math.sin(time * 14 + i) * 0.05 : 0;
          wantYaw = Math.sin(b.graze * 0.4 + i) * 0.35;
        }
        if (asleep) wantPitch = 0.3;
        b.headYaw = damp(b.headYaw, wantYaw, 6, dt);
        b.headPitch = damp(b.headPitch, wantPitch, 6, dt);
        // Ears: random twitches, back while hopping or when it rains.
        for (let k = 0; k < 2; k += 1) {
          if (!asleep && Math.random() < dt * 0.35) b.earKick[k] = 1;
          b.earKick[k] = Math.max(0, b.earKick[k] - dt * 5);
          b.ears[k] = damp(b.ears[k], earBack + Math.sin(b.earKick[k] * Math.PI) * -0.5, 10, dt);
        }
        let squash = b.hop < 1 ? 1 + Math.sin(Math.PI * b.hop) * 0.12 : 1 + Math.sin(time * (asleep ? 1.4 : 6) + i) * (asleep ? 0.03 : 0.015);
        let roll = 0;
        const pos = b.pos.clone();
        if (b.petT > 0) {
          const env = Math.min(1, b.petT * 3, (1.7 - b.petT) * 4);
          roll = Math.sin(time * 18) * 0.16 * env;
          squash = 1 + Math.sin(time * 12) * 0.08 * env;
          if (b.petT < 0.4) pos.y += Math.sin((b.petT / 0.4) * Math.PI) * 0.16;
        }
        bunnyHerd.place(i, pos, b.heading, { roll, squash: asleep ? squash * 0.88 : squash });
        const legs = b.hop < 1 ? Math.sin(Math.PI * b.hop) * 0.9 : 0;
        bunnyHerd.animate(i, b.headYaw, b.headPitch, b.ears[0], b.ears[1], Math.sin(time * 9 + i) * 0.25 * (b.petT > 0 || b.hop < 1 ? 1 : 0.2), -legs, blinkOf(b, dt, asleep));
      });
      bunnyHerd.commit();

      // ------------------------------------------------------------ pond --
      if (pond) {
        const waterY = pond.center.y;
        const onLane = (d, a, r, bob) => {
          d.pos.set(pond.center.x + Math.cos(a) * r, waterY - 0.02 + bob, pond.center.z + Math.sin(a) * r);
          return d.dir > 0 ? -a : Math.PI - a;
        };
        ducks.forEach((d, i) => {
          if (d.duckling) {
            // Ducklings paddle in a row in mum's wake, a body length apart.
            const mum = ducks[0];
            d.dir = mum.dir;
            const a = mum.angle - (mum.dir * (0.34 + (i - 3) * 0.24)) / mum.lane;
            d.heading = onLane(d, a, mum.lane + Math.sin(time * 1.7 + i) * 0.015, Math.sin(time * 3 + i) * 0.008);
          } else {
            if (d.petT > 0) d.petT -= dt;
            else d.angle += d.dir * d.speed * (dark > 0.65 ? 0.3 : 1) * dt;
            d.heading = onLane(d, d.angle, d.lane, Math.sin(time * 2 + i) * 0.01);
          }
          const asleep = dark > 0.7;
          d.diveClock -= dt;
          if (d.diveClock <= 0 && !asleep && !d.duckling) {
            d.diveClock = rand(10, 24);
            d.dive = 1.6;
          }
          d.dive = Math.max(0, d.dive - dt);
          const diving = d.dive > 0 ? Math.sin((d.dive / 1.6) * Math.PI) : 0;
          if (near && d.pos.distanceTo(near) < 1.6 && time - d.quack > 5 && !asleep) {
            d.quack = time;
            d.flap = 0.8;
            sfx.quack(d.pos);
            fx.ripple(d.pos, 0.6);
          }
          if (wet > 0.5 && Math.random() < dt * 0.25) d.flap = 0.6;
          d.flap = Math.max(0, d.flap - dt);
          const flap = d.flap > 0 ? Math.abs(Math.sin(time * 26)) * 0.9 : 0;
          let pitch = diving * 1.2;
          let roll = Math.sin(time * 1.6 + i) * 0.05;
          const pos = d.pos.clone();
          let yaw = 0;
          const headPitch = asleep ? 0.9 : Math.sin(time * 2 + i) * 0.08;
          if (d.petT > 0) {
            const env = Math.min(1, d.petT * 3, (1.3 - d.petT) * 4);
            pos.y += Math.abs(Math.sin(time * 10)) * 0.05 * env;
            roll = Math.sin(time * 30) * 0.22 * env;
            pitch = -0.15 * env;
          }
          if (near && d.pos.distanceTo(near) < 3 && !asleep) yaw = clamp(wrapAngle(facing(d.pos, near) - d.heading), -1, 1);
          if (asleep) yaw = 2.2; // head tucked back under a wing
          duckHerd.place(i, pos, d.petT > 0 ? facing(d.pos, d.face) : d.heading, { pitch, roll, scale: d.duckling ? 0.55 : 1 });
          duckHerd.animate(i, yaw, headPitch, flap, flap, Math.sin(time * 7 + i) * 0.3, 0, blinkOf(d, dt, asleep));
        });
        duckHerd.commit();

        frogs.forEach((f, i) => {
          f.cool -= dt;
          f.croakClock -= dt * (1 + wet * 2 + dark);
          if (f.croakClock <= 0) {
            f.croakClock = rand(4, 10);
            f.croak = 1.2;
            if (near && f.pos.distanceTo(near) < 6) sfx.ribbit(f.pos);
          }
          f.croak = Math.max(0, f.croak - dt);
          if (f.petT > 0) {
            f.petT -= dt;
          } else if (f.hop < 1) {
            f.hop = Math.min(1, f.hop + dt / f.hopTime);
            f.pos.lerpVectors(f.from, f.to, f.hop);
            f.pos.y += Math.sin(Math.PI * f.hop) * f.hopHeight;
            if (f.hop >= 1) {
              fx.dust(f.pos, 0.4);
              f.heading = facing(f.pos, pond.center);
            }
          } else if ((near && f.pos.distanceTo(near) < 1.1 && f.cool <= 0) || (wet > 0.5 && Math.random() < dt * 0.08)) {
            const taken = new Set(frogs.filter((o) => o !== f).map((o) => o.spot));
            const free = banks.map((_, k) => k).filter((k) => k !== f.spot && !taken.has(k));
            const close = free.filter((k) => Math.min((k - f.spot + banks.length) % banks.length, (f.spot - k + banks.length) % banks.length) <= 2);
            const pick = close.length ? close : free;
            if (pick.length) {
              f.cool = 1.5;
              f.spot = pick[Math.floor(Math.random() * pick.length)];
              f.from.copy(f.pos);
              f.to.copy(bank(f.spot));
              const span = f.from.distanceTo(f.to);
              f.hopTime = 0.4 + span * 0.12;
              f.hopHeight = 0.22 + span * 0.08;
              f.heading = facing(f.from, f.to);
              f.hop = 0;
              sfx.ribbit(f.pos);
            }
          }
          const puff = f.croak > 0 ? Math.abs(Math.sin(f.croak * 9)) * 1.1 : 0;
          let squash = 1 + Math.sin(time * 5 + i) * 0.03;
          const pos = f.pos.clone();
          if (f.petT > 0) {
            const env = Math.min(1, f.petT * 3, (1.2 - f.petT) * 4);
            squash *= 1 - 0.08 * env;
            if (f.petT < 0.35) pos.y += Math.sin((f.petT / 0.35) * Math.PI) * 0.12;
          }
          frogHerd.place(i, pos, f.heading, { pitch: f.hop < 1 ? -0.4 : 0, squash });
          frogHerd.animate(i, 0, 0, 0, 0, puff + (f.petT > 0 ? 0.6 : 0), f.hop < 1 ? -1.1 * Math.sin(Math.PI * f.hop) : 0, blinkOf(f, dt, dark > 0.9));
        });
        frogHerd.commit();

        fish.forEach((f, i) => {
          if (f.t >= 1) {
            f.timer -= dt;
            if (f.timer <= 0) {
              const busy = (x, z) => ducks.some((d) => Math.hypot(d.pos.x - x, d.pos.z - z) < 0.45) || swans.some((s) => Math.hypot(s.pos.x - x, s.pos.z - z) < 0.6);
              const jump = koiJump(openWater, pond.center, pond.radius, { busy });
              if (jump) {
                f.from.set(jump.from.x, waterY, jump.from.z);
                f.to.set(jump.to.x, waterY, jump.to.z);
                f.t = 0;
                fx.ripple(f.from, 0.5);
              } else f.timer = 1;
            }
            fishHerd.hide(i);
          } else {
            f.t = Math.min(1, f.t + dt / 0.9);
            const pos = new THREE.Vector3().lerpVectors(f.from, f.to, f.t);
            pos.y += Math.sin(Math.PI * f.t) * 0.55;
            fishHerd.place(i, pos, facing(f.from, f.to), { pitch: -Math.cos(Math.PI * f.t) * 0.9 });
            fishHerd.animate(i, 0, 0, 0, 0, Math.sin(time * 22) * 0.6);
            if (f.t >= 1) {
              f.timer = rand(3, 9);
              fx.splash(f.to, 0.35);
            }
          }
        });
        fishHerd.commit();

        // Swans: glide apart, then meet in the middle and make a heart.
        romance.clock -= dt;
        if (romance.t < 0 && romance.clock <= 0 && dark < 0.7) romance.t = 0;
        const loving = romance.t >= 0;
        if (loving) {
          romance.t += dt;
          if (romance.t > 3.2 && romance.t - dt <= 3.2) {
            fx.hearts(pond.center.clone().add(new THREE.Vector3(0, 0.55, 0)), 7);
            if (near && near.distanceTo(pond.center) < 11) {
              onEvent("swans");
              say("The two swans drew a heart. ♡", "swans", 60000);
            }
          }
          if (romance.t > 9) {
            romance = { clock: rand(28, 45), t: -1 };
          }
        }
        swans.forEach((s, i) => {
          const side = i ? 1 : -1;
          let target;
          if (loving && romance.t < 8) {
            target = pond.center.clone().add(new THREE.Vector3(side * 0.24, 0, 0));
            s.heading = approachAngle(s.heading, side > 0 ? -Math.PI / 2 : Math.PI / 2, 2, dt);
          } else {
            s.angle += dt * 0.12;
            const r = lanes[3].radius;
            const a = s.angle + i * Math.PI;
            target = new THREE.Vector3(pond.center.x + Math.cos(a) * r, 0, pond.center.z + Math.sin(a) * r);
            s.heading = approachAngle(s.heading, -a, 2, dt);
          }
          s.pos.x = damp(s.pos.x, target.x, 0.6, dt);
          s.pos.z = damp(s.pos.z, target.z, 0.6, dt);
          s.pos.y = waterY - 0.03 + Math.sin(time * 1.3 + i) * 0.008;
          const inLove = loving && romance.t > 2 && romance.t < 7.5 ? 1 : 0;
          s.pitch = damp(s.pitch, inLove * 0.4, 2.5, dt);
          s.yaw = damp(s.yaw, 0, 2.5, dt);
          s.wings = damp(s.wings, inLove * 0.35 + (s.petT > 0 ? 0.25 : 0), 3, dt);
          s.petT = Math.max(0, s.petT - dt);
          swanHerd.place(i, s.pos, s.heading, { roll: Math.sin(time * 1.1 + i) * 0.02 });
          swanHerd.animate(i, s.yaw, s.pitch, s.wings, s.wings, 0, 0, blinkOf(s, dt, dark > 0.8));
        });
        swanHerd.commit();
      }

      // ------------------------------------------------------------ birds --
      const hideBirds = dark > 0.6 || wet > 0.6;
      birds.forEach((b, i) => {
        b.shown = damp(b.shown, hideBirds ? 0 : 1, 2, dt);
        if (b.state === "perched") {
          b.peck += dt;
          b.lookClock -= dt;
          if (b.lookClock <= 0) {
            b.lookClock = rand(0.6, 2.4);
            b.look = rand(-0.9, 0.9);
          }
          if (near && b.pos.distanceTo(near) < 2.0 && b.shown > 0.5) {
            b.state = "flying";
            b.timer = rand(9, 15);
            const away = b.pos.clone().sub(near).setY(0).normalize();
            b.vel.set(away.x * 2.4, 2.2, away.z * 2.4);
            b.heading = Math.atan2(away.x, away.z);
            if (b.pos.distanceTo(near) < 3) sfx.chirp(b.pos);
          }
          const peck = Math.max(0, Math.sin(b.peck * 3)) * 0.7;
          birdHerd.place(i, b.pos, b.heading, { scale: b.shown });
          birdHerd.animate(i, b.look, peck, 0, 0, Math.sin(time * 4 + i) * 0.1, 0, blinkOf(b, dt));
        } else {
          b.timer -= dt;
          b.vel.y += dt * 0.6;
          b.pos.addScaledVector(b.vel, dt);
          const fade = clamp((b.timer - 5) / 3, 0, 1) * b.shown;
          const flap = Math.sin(time * 34 + i) * 1.1;
          birdHerd.place(i, b.pos, b.heading, { pitch: -0.3, scale: fade });
          birdHerd.animate(i, 0, -0.2, flap, flap, 0.3, 0, 0);
          if (b.timer <= 0) {
            b.pos = randomSpot(b.home, 2.2);
            b.state = "perched";
            b.heading = Math.random() * 6;
          }
        }
      });
      birdHerd.commit();

      // -------------------------------------------------------------- owl --
      if (owlHerd) {
        owl.shown = damp(owl.shown, dark > 0.45 ? 1 : 0, 1.5, dt);
        if (owl.shown > 0.02) {
          const d = near ? near.distanceTo(perch) : 99;
          const want = near && d < 9 ? wrapAngle(facing(perch, near) - Math.PI / 2) : Math.sin(time * 0.3) * 1.4;
          owl.yaw = damp(owl.yaw, clamp(want, -2.2, 2.2), 3, dt);
          owl.tilt = damp(owl.tilt, near && d < 3 ? Math.sin(time * 1.5) * 0.25 : 0, 3, dt);
          owl.hoot -= dt;
          if (owl.hoot <= 0 && near && d < 10) {
            owl.hoot = rand(10, 18);
            sfx.hoot?.(perch);
          }
          owlHerd.place(0, perch, Math.PI / 2, { scale: owl.shown, roll: owl.tilt * 0.3 });
          owlHerd.animate(0, owl.yaw, -0.1 + owl.tilt * 0.2, 0, 0, 0, 0, Math.max(0, Math.sin(time * 0.7)) > 0.97 ? 1 : 0.18);
        } else owlHerd.hide(0);
        owlHerd.commit();
      }

      // The six animals closest to the player part the flowers around them.
      if (near) {
        const candidates = [];
        bunnies.forEach((b) => candidates.push([b.pos, 0.34]));
        frogs.forEach((f) => candidates.push([f.pos, 0.24]));
        birds.forEach((b) => b.state === "perched" && b.shown > 0.5 && candidates.push([b.pos, 0.16]));
        candidates.push([cat.pos, 0.3]);
        candidates.sort((a, b) => a[0].distanceToSquared(near) - b[0].distanceToSquared(near));
        for (let k = 0; k < PUSHERS.length; k += 1) {
          const c = candidates[k];
          if (c && c[0].distanceTo(near) < 14) PUSHERS[k].set(c[0].x, c[0].y, c[0].z, c[1]);
          else PUSHERS[k].set(0, -100, 0, 0);
        }
      }
      cat.update(time, dt, near);
      if (near && !cat.awake && Math.random() < dt * 0.4 && cat.pos.distanceTo(near) < 3) {
        fx.sparkle(cat.pos.clone().add(new THREE.Vector3(0.1, 0.35, 0)), 2, "#ffffff");
      }
      const inMeadow = Boolean(near && meadow && near.distanceTo(meadow.center) < meadow.radius);
      if (inMeadow && !this.inMeadow) say(dark > 0.65 ? "Bunny Meadow. Shh… the bunnies are asleep." : "Bunny Meadow. The bunnies love carrots…", "meadow");
      this.inMeadow = inMeadow;
    },
    dispose() {
      [bunnyHerd, duckHerd, frogHerd, fishHerd, swanHerd, birdHerd, owlHerd].forEach((herd) => herd?.dispose());
      cat.dispose();
    },
  };
  return api;
}
