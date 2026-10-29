import * as THREE from "three";
import { loadWalkMap } from "../world/walkmap.js";
import { CHARACTERS, createFallbackBunny, loadBunny } from "./bunny.js";
import { createInput } from "../core/input.js";
import { approachAngle, clamp, damp, wrapAngle } from "../core/math.js";
import { environment } from "../core/uniforms.js";

// The walkthrough: you play a bunny with a third-person camera. The bunny
// walks and runs, hops onto anything with a body (benches, rocks, the well),
// flutters her ears to glide across gaps, wades in the pond, sits, and falls
// back to safety from the edge of the world. Ground, bodies and water come
// from the baked walk map (world/walkmap.js).

export const WALKMAP_VERSION = "28";

const GRAVITY = 18;
const JUMP_SPEED = 5.9;     // about a 0.97 m hop
const WALK_SPEED = 2.2;     // her one easy pace (no sprinting)
const STEP = 0.32;          // climb this much without jumping
const FOOT = 0.12;          // footprint radius
const BODY_CLEARANCE = 0.2; // her dress, from the animals around her
const HEAD_CLEARANCE = 0.31; // her head (0.27 m across at 1.12 scale) plus a little
const LEDGE_ASSIST = 0.2;   // in the air, slide onto a ledge up to this far above the feet
const COYOTE = 0.12;        // a jump still works this long after walking off a ledge
const JUMP_BUFFER = 0.14;   // a jump pressed this early before landing still happens
const GLIDE_GRAVITY = 0.3;  // ear flutter: fall far slower…
const GLIDE_FALL = 1.35;    // …and never faster than this
const GLIDE_TIME = 1.6;     // seconds of flutter per hop
const RESPAWN_BELOW = -7;
const CAMERA_HEIGHT = 0.62;
const VIEW_DISTANCE = 6.4;  // the follow camera, far enough back to see the island round her
const FOLLOW_RATE = 2.2;    // how eagerly it swings round behind her as she turns…
const FOLLOW_MAX = 1.5;     // …but never faster than this (rad/s), so circling stays gentle
const LOOK_HOLD = 1.6;      // after you turn the camera yourself, it waits this long
const CAMERA_LIFTS = [0.18, 0.36]; // how much higher it may look from to see over something
const WADE_DEPTH = 0.16;

export async function createPlayer(scene, camera, dom, { onHint = () => {}, onEvent = () => {}, character: chosen = null } = {}) {
  const map = await loadWalkMap("/island/walkmap", WALKMAP_VERSION);
  const input = createInput(dom);

  // ------------------------------------------------------- characters --
  const stored = (key, fallback) => {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const models = {};
  async function modelFor(style) {
    if (!models[style]) {
      models[style] = loadBunny(style).catch((error) => {
        console.warn(`The ${style} bunny could not load, using the simple one:`, error);
        return createFallbackBunny();
      }).then((rig) => {
        rig.root.visible = false;
        rig.onEvent = rigEvent;
        scene.add(rig.root);
        return rig;
      });
    }
    return models[style];
  }
  let character = (chosen ?? stored("petal-isle-character", "girl")) === "boy" ? "boy" : "girl";
  let bunny = await modelFor(character);
  let holding = [0, 0];

  // ------------------------------------------------------------- state --
  const position = new THREE.Vector3();
  const lastSafe = new THREE.Vector3();
  const velocity = new THREE.Vector2(); // horizontal (x, z)
  let heading = Math.PI;
  let turnRate = 0;
  let accel = 0;
  let lastSpeed = 0;
  let speed = 0;
  let vy = 0;
  let grounded = true;
  let coyote = 0;
  let jumpBuffer = 0;
  let glideLeft = 0;
  let gliding = false;
  let apexY = 0;
  let landed = 0;
  let sitting = null; // { pos, yaw, dynamic?, ground?, locked?, pose?, aim?, balloon?, swing? }
  let wading = false;
  let wadeTimer = 0;
  let safeTimer = 0;
  let idle = 0;
  let active = false;
  let hidden = false; // tucked out of view while a board fills the screen
  let frozen = false; // a little scene plays (the book dance): she waits
  let urge = 0; // how hard the player pushes to move or jump right now
  let gesture = null; // { t, duration, mid, onMid, onEnd, faceYaw, midDone, slide }
  let hopArc = null; // smooth hop onto / off a seat
  let lookProvider = null;
  let company = null; // () => { hold, holdHand, cuddle }: the other bunny walks with her
  let waterLevel = null;
  // Things only the camera stays out of (a parked balloon's rope cage).
  const cameraBlockers = new Set();
  const stations = [];
  let lastHint = null;

  // Camera rig.
  let yaw = 0;
  let pitch = 0.42;
  let distance = VIEW_DISTANCE;
  let wantDistance = VIEW_DISTANCE;
  let camReach = VIEW_DISTANCE;
  let dragging = false;
  let lookHold = 0; // > 0: you turned the camera; it stays put this long
  let follow = 1; // 0..1: eases the camera back into following after you let go
  let camLift = 0; // extra tilt to see over something behind her
  let lookGoal = null; // { point, time }: a gentle turn of the view towards something
  let cameraOverride = null;
  const look = { sensitivity: 1, invertY: false };
  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const forward = new THREE.Vector3();

  function rigEvent(type, data) {
    if (type === "zzz") onEvent("zzz", { position: data });
    else if (type === "step" && grounded && active) {
      const cell = map.sample(position.x, position.z);
      onEvent("step", { foot: data, material: cell.material, water: cell.water, position: position.clone() });
    }
  }

  // ---------------------------------------------------------- physics --
  const FOOTPRINT = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  // On the ground: every footprint point must be solid and low enough to step onto.
  function canWalk(x, z, fromY) {
    for (const [dx, dz] of FOOTPRINT) {
      const h = map.surface(x + dx * FOOT, z + dz * FOOT);
      if (h === null || h - fromY > STEP) return false;
    }
    return true;
  }
  // In the air: pass over anything lower than the feet (with a little ledge assist).
  function canFly(x, z, y) {
    for (const [dx, dz] of FOOTPRINT) {
      const h = map.surface(x + dx * FOOT, z + dz * FOOT);
      if (h !== null && h > y + (vy <= 2 ? LEDGE_ASSIST : 0.05)) return false;
    }
    return true;
  }
  function place(x, z) {
    for (let radius = 0; radius < 4; radius += 0.1) {
      for (let a = 0; a < Math.PI * 2; a += 0.3) {
        const px = x + Math.cos(a) * radius;
        const pz = z + Math.sin(a) * radius;
        const s = map.sample(px, pz);
        const h = map.surface(px, pz);
        if (h !== null && s.kind === "floor" && canWalk(px, pz, h)) {
          position.set(px, h, pz);
          lastSafe.copy(position);
          return true;
        }
      }
    }
    return false;
  }
  function freeSpotNear(x, z) {
    for (let radius = 0; radius < 2.5; radius += 0.15) {
      for (let a = 0; a < Math.PI * 2; a += 0.4) {
        const px = x + Math.cos(a) * radius;
        const pz = z + Math.sin(a) * radius;
        const h = map.surface(px, pz);
        if (h !== null && canWalk(px, pz, h)) return new THREE.Vector3(px, h, pz);
      }
    }
    return null;
  }

  function standUp() {
    if (!sitting) return;
    const spot = sitting;
    sitting = null;
    if (!spot.ground) {
      // Hop off the seat onto open ground in front of it.
      const from = position.clone();
      const ahead = freeSpotNear(position.x + Math.sin(heading) * 0.55, position.z + Math.cos(heading) * 0.55) || from.clone();
      // Out of the balloon basket takes a bigger hop, over the wicker wall.
      hopArc = { from, t: 0, duration: spot.balloon ? 0.55 : 0.35, landing: true, to: ahead, lift: spot.balloon ? 0.85 : 0.35 };
    }
    onEvent("stand", spot);
  }

  function respawn() {
    onEvent("fall", { position: position.clone() });
    position.copy(lastSafe);
    grounded = true;
    vy = 0;
    velocity.set(0, 0);
    bunny.express("surprised", 1.2);
    onEvent("respawn", { position: position.clone() });
    camTarget.set(position.x, position.y + CAMERA_HEIGHT, position.z);
    camPos.set(position.x + Math.sin(yaw) * distance, position.y + 2, position.z + Math.cos(yaw) * distance);
  }

  // Animals she keeps clear of: a function returning [{ x, y, z, r, h }].
  // Her head is much wider than her feet, so anything reaching up to head
  // height keeps a head's width away.
  let obstacles = () => [];
  function clearanceTo(o) {
    if (o.y > position.y + 1.0 || o.y + o.h < position.y - 0.05) return -Infinity; // above or below her
    const top = o.y + o.h - position.y;
    const reach = top > 0.42 ? HEAD_CLEARANCE : top > 0.3 ? BODY_CLEARANCE + ((top - 0.3) / 0.12) * (HEAD_CLEARANCE - BODY_CLEARANCE) : BODY_CLEARANCE;
    return reach + o.r;
  }
  function crowding(x, z, list) {
    let worst = 0;
    for (const o of list) {
      const need = clearanceTo(o);
      if (need !== -Infinity) worst = Math.max(worst, need - Math.hypot(x - o.x, z - o.z));
    }
    return worst;
  }

  // ------------------------------------------------------------ update --
  function updateMovement(time, dt, intent) {
    // Camera-relative intent.
    const fwdX = -Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    let mx = fwdX * intent.y + rightX * intent.x;
    let mz = fwdZ * intent.y + rightZ * intent.x;
    const length = Math.hypot(mx, mz);
    const magnitude = Math.min(1, length);
    if (length > 0.001) {
      mx /= length;
      mz /= length;
    }
    const top = WALK_SPEED * (wading && grounded ? 0.62 : 1);
    const response = grounded ? 12 : 3.5;
    velocity.x = damp(velocity.x, mx * magnitude * top, response, dt);
    velocity.y = damp(velocity.y, mz * magnitude * top, response, dt);
    speed = velocity.length();
    accel = damp(accel, dt > 0 ? (speed - lastSpeed) / dt : 0, 10, dt);
    lastSpeed = speed;

    const before = heading;
    if (magnitude > 0.05) heading = approachAngle(heading, Math.atan2(mx, mz), grounded ? 12 : 6, dt);
    turnRate = damp(turnRate, dt > 0 ? wrapAngle(heading - before) / dt : 0, 12, dt);

    // Jump (buffered) and coyote time.
    if (intent.jumpPressed) jumpBuffer = JUMP_BUFFER;
    else jumpBuffer = Math.max(0, jumpBuffer - dt);
    if (jumpBuffer > 0 && (grounded || coyote > 0)) {
      vy = JUMP_SPEED;
      grounded = false;
      coyote = 0;
      jumpBuffer = 0;
      glideLeft = GLIDE_TIME;
      apexY = position.y;
      onEvent("jump", { water: wading, position: position.clone() });
    }

    // Horizontal move with wall sliding; she never walks into an animal
    // (moving away from one is always allowed).
    const near = obstacles();
    const crowded = near.length ? crowding(position.x, position.z, near) : 0;
    if (speed > 0.0005) {
      const nx = position.x + velocity.x * dt;
      const nz = position.z + velocity.y * dt;
      const walkable = grounded ? (x, z) => canWalk(x, z, position.y) : (x, z) => canFly(x, z, position.y);
      const ok = near.length ? (x, z) => walkable(x, z) && crowding(x, z, near) <= Math.max(0, crowded - 1e-4) : walkable;
      if (ok(nx, nz)) position.set(nx, position.y, nz);
      else if (ok(nx, position.z)) {
        position.x = nx;
        velocity.y *= 0.5;
      } else if (ok(position.x, nz)) {
        position.z = nz;
        velocity.x *= 0.5;
      } else velocity.multiplyScalar(0.3);
    }

    // An animal came to her (a hopping bunny): ease out of its way.
    if (crowded > 0.005 && grounded) {
      for (const o of near) {
        const need = clearanceTo(o);
        const dx = position.x - o.x;
        const dz = position.z - o.z;
        const d = Math.hypot(dx, dz) || 1e-4;
        if (need === -Infinity || need - d <= 0.005) continue;
        const k = Math.min(need - d, (need - d) * dt * 6 + 0.002);
        if (canWalk(position.x + (dx / d) * k, position.z + (dz / d) * k, position.y)) {
          position.x += (dx / d) * k;
          position.z += (dz / d) * k;
        }
      }
    }

    const support = map.support(position.x, position.z, FOOT);
    const cell = map.sample(position.x, position.z);
    // In the pond she wades at most knee-deep, whatever the bed below does.
    const ground = cell.water && waterLevel !== null && support.height !== null ? Math.max(support.height, waterLevel - WADE_DEPTH) : support.height;
    if (grounded) {
      if (ground === null || ground < position.y - 0.35) {
        grounded = false; // walked off a ledge
        vy = 0;
        coyote = COYOTE;
        apexY = position.y;
      } else {
        position.y = damp(position.y, ground, ground > position.y ? 22 : 16, dt);
      }
    }
    gliding = false;
    if (!grounded) {
      coyote = Math.max(0, coyote - dt);
      gliding = intent.jumpHeld && vy < 0 && glideLeft > 0;
      if (gliding && glideLeft === GLIDE_TIME) onEvent("glide", { position: position.clone() });
      vy -= GRAVITY * (gliding ? GLIDE_GRAVITY : 1) * dt;
      if (gliding) {
        vy = Math.max(vy, -GLIDE_FALL);
        glideLeft = Math.max(0, glideLeft - dt);
      }
      position.y += vy * dt;
      apexY = Math.max(apexY, position.y);
      if (ground !== null && vy <= 0 && position.y <= ground) {
        const impact = -vy;
        position.y = ground;
        grounded = true;
        landed = impact;
        const water = cell.kind === "floor" && cell.water;
        onEvent(water ? "splash" : "land", { position: position.clone(), speed: impact, fall: apexY - ground, material: cell.material });
        if (apexY - ground > 2.4) bunny.express("surprised", 0.9);
        vy = 0;
      } else if (position.y < RESPAWN_BELOW) {
        respawn();
      }
    }
    wading = grounded && cell.kind === "floor" && cell.water;
    if (wading && speed > 0.3) {
      wadeTimer -= dt;
      if (wadeTimer <= 0) {
        wadeTimer = 0.45;
        onEvent("wade", { position: position.clone() });
      }
    }
    safeTimer -= dt;
    if (grounded && !wading && safeTimer <= 0 && cell.kind === "floor" && support.voids === 0) {
      safeTimer = 0.4;
      lastSafe.copy(position);
    }
  }

  function updateSeat(time, dt, intent) {
    speed = 0;
    velocity.set(0, 0);
    if (hopArc) {
      hopArc.t = Math.min(1, hopArc.t + dt / hopArc.duration);
      const k = hopArc.t * hopArc.t * (3 - 2 * hopArc.t);
      let target;
      if (hopArc.landing) target = hopArc.to;
      else if (sitting) {
        target = sitting.dynamic ? sitting.dynamic(time).pos.clone() : new THREE.Vector3(...sitting.pos);
        const want = sitting.dynamic ? sitting.dynamic(time).yaw : sitting.yaw;
        heading = approachAngle(heading, want, 12, dt);
      } else target = position.clone();
      position.lerpVectors(hopArc.from, target, k);
      position.y += Math.sin(Math.PI * hopArc.t) * (hopArc.lift ?? 0.35);
      if (hopArc.t >= 1) {
        position.copy(target);
        if (hopArc.landing) {
          grounded = true;
          vy = 0;
        }
        hopArc = null;
      }
      return;
    }
    if (!sitting) return;
    if (sitting.aim) {
      yaw -= intent.x * dt * 1.3;
      pitch = clamp(pitch - intent.y * dt * 0.7, 0.12, 1.0);
    }
    if (sitting.dynamic) {
      const pose = sitting.dynamic(time);
      position.copy(pose.pos);
      heading = pose.yaw;
    } else if (!sitting.ground) {
      position.set(...sitting.pos);
      heading = approachAngle(heading, sitting.yaw, 12, dt);
    }
  }

  function updateCamera(time, dt, intent) {
    if (!sitting?.aim && (intent.lookX || intent.lookY)) {
      yaw -= intent.lookX * dt * 2.4 * look.sensitivity;
      pitch = clamp(pitch + intent.lookY * dt * 1.4 * look.sensitivity * (look.invertY ? -1 : 1), 0.12, 1.0);
      lookHold = LOOK_HOLD;
    }
    // Follow her: as she turns, the camera swings round behind her. Not while
    // you hold the view yourself (a drag or the right stick, and a moment
    // after), not on a seat, and not when she runs straight at the camera
    // (it would spin round and turn her controls back to front).
    if (dragging) lookHold = LOOK_HOLD;
    else lookHold = Math.max(0, lookHold - dt);
    follow = lookHold > 0 ? 0 : Math.min(1, follow + dt / 0.6);
    if (follow > 0 && !sitting && !cameraOverride && speed > 0.3) {
      const behind = wrapAngle(heading + Math.PI - yaw);
      if (Math.abs(behind) < 2.4) {
        const pace = Math.min(1.3, speed / WALK_SPEED) * follow;
        const turn = behind * (1 - Math.exp(-dt * FOLLOW_RATE * pace));
        yaw += clamp(turn, -FOLLOW_MAX * pace * dt, FOLLOW_MAX * pace * dt);
      }
    }
    // Turning to look at something (where the paw prints led): once she
    // stands still, for a few seconds at most. A drag takes over at once.
    if (lookGoal) {
      lookGoal.time -= dt;
      if (dragging || lookGoal.time <= 0 || sitting || cameraOverride) lookGoal = null;
      else if (speed < 0.3) {
        const { point } = lookGoal;
        const turn = wrapAngle(Math.atan2(position.x - point.x, position.z - point.z) - yaw);
        yaw += turn * (1 - Math.exp(-dt * 2.4));
        if (Math.abs(turn) < 0.02) lookGoal = null;
      }
    }
    distance = damp(distance, wantDistance, 2.5, dt);
    const lead = tmp.set(velocity.x, 0, velocity.y).multiplyScalar(0.12);
    camTarget.lerp(new THREE.Vector3(position.x + lead.x, position.y + CAMERA_HEIGHT, position.z + lead.z), 1 - Math.exp(-dt * 10));
    // Where the line from the bunny back to the camera, tilted up this much,
    // first meets something solid (Infinity: it doesn't).
    const blockedAt = (tilt) => {
      const dx = Math.sin(yaw) * Math.cos(tilt);
      const dz = Math.cos(yaw) * Math.cos(tilt);
      const up = Math.sin(tilt);
      for (let d = 0.35; d < distance; d += 0.1) {
        const px = camTarget.x + dx * d;
        const pz = camTarget.z + dz * d;
        const py = camTarget.y + up * d;
        const h = map.surface(px, pz);
        if (h !== null && h > py - 0.18) return d;
        for (const b of cameraBlockers) {
          if ((px - b.x) ** 2 + (pz - b.z) ** 2 < b.r * b.r && py < b.top()) return d;
        }
      }
      return Infinity;
    };
    // Something in the way: first try looking over it from a little higher,
    // and only then come in closer.
    let lift = 0;
    if (blockedAt(pitch) < Infinity) lift = CAMERA_LIFTS.find((extra) => pitch + extra <= 1.25 && blockedAt(pitch + extra) === Infinity) ?? 0;
    camLift = damp(camLift, lift, 3, dt);
    const tilt = pitch + camLift;
    const dirX = Math.sin(yaw) * Math.cos(tilt);
    const dirZ = Math.cos(yaw) * Math.cos(tilt);
    const rise = Math.sin(tilt);
    const hit = blockedAt(tilt);
    const reach = hit < Infinity ? Math.max(0.8, hit - 0.22) : distance;
    camReach = damp(camReach, reach, reach < camReach ? 14 : 3, dt);
    const want = new THREE.Vector3(camTarget.x + dirX * camReach, camTarget.y + rise * camReach, camTarget.z + dirZ * camReach);
    const floor = map.surface(want.x, want.z);
    if (floor !== null) want.y = Math.max(want.y, floor + 0.35);
    camPos.lerp(want, 1 - Math.exp(-dt * 6));
    if (cameraOverride) {
      cameraOverride(camera, dt, time);
    } else {
      camera.position.copy(camPos);
      camera.lookAt(camTarget);
      if (Math.abs(camera.fov - 55) > 0.05) {
        camera.fov = damp(camera.fov, 55, 4, dt);
        camera.updateProjectionMatrix();
      }
    }
  }

  // The nearest station's hint, within its radius on the ground (how high its
  // board hangs doesn't matter). A hint can be a function, and say nothing.
  function updateHints() {
    let hint = null;
    let best = Infinity;
    for (const station of stations) {
      const d = Math.hypot(station.position.x - position.x, station.position.z - position.z);
      if (d >= station.radius || d >= best) continue;
      const text = typeof station.hint === "function" ? station.hint() : station.hint;
      if (!text) continue;
      best = d;
      hint = text;
    }
    if (hint !== lastHint) {
      lastHint = hint;
      onHint(hint);
    }
  }

  const api = {
    map,
    input,
    get active() { return active; },
    get position() { return position; },
    get heading() { return heading; },
    get grounded() { return grounded; },
    get gliding() { return gliding; },
    get sitting() { return sitting; },
    get speed() { return speed; },
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get idle() { return idle; },
    get asleep() { return bunny.asleep; },
    get forward() { return forward.set(Math.sin(heading), 0, Math.cos(heading)); },
    get character() { return character; },
    get characters() { return Object.keys(CHARACTERS); },
    get hasDate() { return true; },
    get busy() { return Boolean(gesture || hopArc); },
    heightAt: (x, z) => map.surface(x, z),
    sampleAt: (x, z) => map.sample(x, z),
    setStations(list) { stations.splice(0, stations.length, ...list); },
    setLookProvider(fn) { lookProvider = fn; },
    // The other bunny is with her: fn() says which paw holds his and where,
    // and how far she leans on him (null: she is on her own).
    setCompany(fn) { company = fn; },
    setWaterLevel(y) { waterLevel = Number.isFinite(y) ? y : null; },
    setHolding(flowers, carrots) {
      holding = [flowers, carrots];
      bunny.setHolding(flowers, carrots);
    },
    get holding() { return holding; },
    async setCharacter(next) {
      if (!CHARACTERS[next]) return;
      try { localStorage.setItem("petal-isle-character", next); } catch { /* optional */ }
      if (next === character) return;
      const rig = await modelFor(next);
      const old = bunny;
      character = next;
      bunny = rig;
      old.setHolding(0, 0);
      old.root.visible = false;
      bunny.setHolding(...holding);
      bunny.root.visible = active && !hidden;
      bunny.cheer();
      onEvent("character", { character: next, position: position.clone() });
    },
    cheer() { bunny.cheer(); },
    // Hide the bunny for a while without stopping play (a picking board fills
    // the view); moving on works as usual.
    setHidden(on) {
      hidden = on;
      bunny.root.visible = active && !hidden;
    },
    // Hold still while a little scene plays; `urge` still tells if the player
    // wants to move on.
    setFrozen(on) { frozen = on; },
    get urge() { return urge; },
    // Put her down here, facing `face` (after a scene played with a stand-in);
    // cameraFrom: a point the follow camera should look from.
    placeAt(at, face = heading, { cameraFrom = null } = {}) {
      const h = map.surface(at.x, at.z);
      position.set(at.x, h ?? at.y, at.z);
      lastSafe.copy(position);
      heading = face;
      if (cameraFrom) yaw = Math.atan2(cameraFrom.x - at.x, cameraFrom.z - at.z);
      velocity.set(0, 0);
      speed = 0;
      vy = 0;
      grounded = true;
      gesture = null;
      hopArc = null;
      camTarget.set(position.x, position.y + CAMERA_HEIGHT, position.z);
    },
    setWeather(rain, snow) { bunny.setWeather?.(rain, snow); },
    express(kind, seconds) { bunny.express(kind, seconds); },
    play(type, duration = 1.2) {
      bunny.play(type, duration);
      idle = 0;
    },
    // Her telescope eye relative to her feet, in her own frame (or null).
    scopeEyeOffset(target = new THREE.Vector3()) {
      return bunny?.scopeEyeOffset ? bunny.scopeEyeOffset(target) : null;
    },
    handWorld(index, target = new THREE.Vector3()) {
      return bunny.handWorld ? bunny.handWorld(index, target) : target.copy(position).add(new THREE.Vector3(0, 0.3, 0));
    },
    // A gesture ("pick", "pull", "pet"…): the bunny stops, turns toward `face`
    // (stepping in to `approach` metres), and callbacks fire at the grab
    // moment (mid) and at the end.
    perform(type, { duration = 1, mid = 0.5, onMid, onEnd, face, approach = 0 } = {}) {
      if (gesture || hopArc || !grounded || sitting) return false;
      gesture = {
        t: 0, duration, mid, onMid, onEnd, midDone: false,
        faceYaw: face ? Math.atan2(face.x - position.x, face.z - position.z) : heading,
      };
      if (face && approach > 0) {
        for (const o of obstacles()) {
          const need = Math.hypot(o.x - face.x, o.z - face.z) < 0.25 ? clearanceTo(o) : -Infinity;
          if (need !== -Infinity) approach = Math.max(approach, need + 0.12);
        }
        const flat = new THREE.Vector3(face.x - position.x, 0, face.z - position.z);
        const gap = flat.length() - approach;
        if (gap > 0.05) {
          const to = position.clone().addScaledVector(flat.normalize(), gap);
          if (canWalk(to.x, to.z, position.y)) gesture.slide = { from: position.clone(), to };
        }
      }
      velocity.set(0, 0);
      speed = 0;
      idle = 0;
      bunny.play(type, duration);
      return true;
    },
    // Animals to keep clear of: fn() -> [{ x, y, z, r, h }].
    setObstacles(fn) { obstacles = fn || (() => []); },
    // A custom camera (telescope views); null restores the follow camera.
    setCameraOverride(fn) {
      cameraOverride = fn;
      if (!fn) camPos.copy(camera.position);
    },
    // true: wide view, a number: that camera distance, false: normal.
    setView(far) { wantDistance = typeof far === "number" ? far : far ? 11 : VIEW_DISTANCE; },
    // Ease the view round (from behind her) to look at a point.
    lookToward(point) {
      lookGoal = { point: point.clone(), time: 4 };
    },
    start(from = new THREE.Vector3(-5.5, 0, 6.2)) {
      place(from.x, from.z);
      heading = Math.PI;
      yaw = 0;
      vy = 0;
      velocity.set(0, 0);
      grounded = true;
      sitting = null;
      active = true;
      idle = 0;
      hidden = false;
      frozen = false;
      bunny.root.visible = true;
      input.setEnabled(true);
      camTarget.set(position.x, position.y + CAMERA_HEIGHT, position.z);
      camPos.copy(camera.position);
    },
    stop() {
      active = false;
      lookGoal = null;
      sitting = null;
      gesture = null;
      hopArc = null;
      bunny.root.visible = false;
      input.setEnabled(false);
      onHint(null);
      lastHint = null;
    },
    jump() { input.pressJump(); setTimeout(() => input.releaseJump(), 60); },
    pressJump() { input.pressJump(); },
    releaseJump() { input.releaseJump(); },
    // spot: { pos: [x,y,z], yaw, dynamic?, ... } or null to sit on the ground.
    sit(spot = null) {
      if (!grounded && !sitting) return;
      if (sitting) {
        if (!sitting.locked?.()) standUp();
        return;
      }
      if (gesture) return;
      if (spot) {
        sitting = { ...spot };
        hopArc = { from: position.clone(), t: 0, duration: spot.balloon ? 0.6 : 0.45, lift: spot.balloon ? 0.85 : 0.35 };
      } else sitting = { ground: true };
      speed = 0;
      velocity.set(0, 0);
      onEvent("sit", sitting);
    },
    drag(dx, dy) {
      yaw -= dx * 0.006 * look.sensitivity;
      pitch = clamp(pitch + dy * 0.004 * look.sensitivity * (look.invertY ? -1 : 1), 0.12, 1.0);
      dragging = true;
    },
    setLook({ sensitivity = 1, invertY = false } = {}) {
      look.sensitivity = sensitivity;
      look.invertY = invertY;
    },
    endDrag() { dragging = false; },
    // A column the follow camera will not enter: { x, z, r, top() }.
    addCameraBlocker(blocker) {
      cameraBlockers.add(blocker);
      return () => cameraBlockers.delete(blocker);
    },
    // A runtime body for props built in the browser (swing posts, telescope…).
    addCollider: (shape, top) => map.addCollider(shape, top),
    removeCollider: (id) => map.removeCollider(id),
    update(time, dt) {
      if (!active) return;
      const intent = input.poll(dt);
      if (intent.active) idle = 0;
      else idle += dt;
      urge = Math.hypot(intent.x, intent.y) + (intent.jumpPressed ? 1 : 0);
      if (gesture || hopArc?.landing || frozen) {
        intent.x = intent.y = 0;
        intent.jumpPressed = false;
      }
      if (sitting && !hopArc && (Math.hypot(intent.x, intent.y) > 0.3 || intent.jumpPressed)) {
        if (!sitting.locked?.()) standUp();
        intent.jumpPressed = false;
      }

      if (gesture) {
        gesture.t += dt;
        if (gesture.slide) {
          const k = Math.min(1, gesture.t / (gesture.duration * 0.22));
          position.lerpVectors(gesture.slide.from, gesture.slide.to, k * k * (3 - 2 * k));
          const h = map.surface(position.x, position.z);
          if (h !== null) position.y = h;
          if (k >= 1) gesture.slide = null;
        }
        heading = approachAngle(heading, gesture.faceYaw, 10, dt);
        if (!gesture.midDone && gesture.t >= gesture.duration * gesture.mid) {
          gesture.midDone = true;
          gesture.onMid?.();
        }
        if (gesture && gesture.t >= gesture.duration) {
          const done = gesture.onEnd;
          gesture = null;
          done?.();
        }
      }

      landed = 0;
      if (sitting || hopArc) updateSeat(time, dt, intent);
      else updateMovement(time, dt, intent);

      bunny.root.position.copy(position);
      bunny.root.rotation.y = heading;
      const below = map.surface(position.x, position.z);
      bunny.shadow.visible = below !== null && !sitting;
      if (below !== null) bunny.shadow.position.y = (below - position.y) / bunny.root.scale.y + 0.012;
      const look = lookProvider ? lookProvider(position, heading) : null;
      const with_ = company ? company() : null;
      bunny.update(time, dt, {
        hold: with_?.hold ?? null, holdHand: with_?.holdHand ?? 0, cuddle: with_?.cuddle ?? 0,
        speed, run: 0, grounded: grounded && !hopArc, vy, gliding, turn: turnRate, accel,
        // In the balloon basket she stands at the rim instead of sitting.
        sitting: Boolean(sitting) && !hopArc && sitting.pose !== "scope" && !sitting.balloon,
        seat: Boolean(sitting && !sitting.ground && sitting.pose !== "scope" && !sitting.balloon),
        rail: Boolean(sitting?.balloon) && !hopArc,
        seatEdge: sitting?.edge ?? 0.1,
        scope: sitting?.pose === "scope" && !hopArc, wading, swing: sitting?.swingAngle?.() || 0,
        grip: sitting?.grip?.() ?? null,
        shelter: Boolean(sitting?.balloon || sitting?.swing || sitting?.pose === "scope"),
        idle, look, landed,
      });
      environment.uPlayer.value.copy(position);
      updateCamera(time, dt, intent);
      updateHints();
    },
    dispose() {
      input.dispose();
      for (const promise of Object.values(models)) {
        promise.then((rig) => {
          scene.remove(rig.root);
          rig.dispose();
        });
      }
    },
  };
  return api;
}
