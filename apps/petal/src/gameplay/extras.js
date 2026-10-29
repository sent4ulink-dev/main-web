import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { colored } from "../core/geometry.js";
import { addNearFade, environment } from "../core/uniforms.js";

// Ambient life around the islands: a striped hot-air balloon drifting on a
// slow loop, a second balloon docked in the Bunny Meadow that the bunny can
// ride on a scenic flight, and fireflies over the Lantern Grove.

const SCALE = 1.3; // the balloon that drifts round the islands
// The one you ride is bigger, and its basket wide enough for two bunnies side
// by side (a bunny's head is half a metre across).
const RIDE = { scale: 1.45, basket: 1.0, depth: 0.8 };
// Local heights before the scale. Like a real balloon, the basket hangs well
// below the envelope on long suspension ropes, with the burner frame high
// above the passengers: they stand 0.27 m below the rim and are 0.95 m tall
// to the tips of their ears, so the frame sits well over a metre above their
// feet.
const BASKET_TOP = -2.97;
const BASKET_HEIGHT = 0.42;
const BASKET_FLOOR = BASKET_TOP - BASKET_HEIGHT + 0.01; // where you stand
const FRAME_Y = BASKET_TOP + 0.69;
const RIM_ABOVE = 0.27; // the rim, above the feet of who stands in the basket (metres)
// The little step they stand on inside the basket (metres), to see over the rim.
const STEP_UP = (BASKET_TOP - BASKET_FLOOR) * RIDE.scale - RIM_ABOVE;
export const BASKET_SHARE = 0.3; // two in the basket: each stands this far to one side of its middle
// Room each balloon needs: the envelope is ~1.4 m wide and the basket hangs
// ~4.4 m below its centre.
const BALLOON_RADIUS = 1.06 * SCALE;
const BALLOON_GAP = BALLOON_RADIUS + 1.06 * RIDE.scale + 3;

// The decorative balloon's loop: an ellipse round the islands, widened until
// it never comes within BALLOON_GAP of the rideable balloon's route (the two
// fly at the same heights, so only the ground plan matters). `route` is a list
// of points sampled along that route.
export function ambientLoop(route, { rx = 30, rz = 22, cx = 0, cz = -6, gap = BALLOON_GAP } = {}) {
  const clearance = (k) => {
    let min = Infinity;
    for (let i = 0; i < 160; i += 1) {
      const a = (i / 160) * Math.PI * 2;
      const x = Math.cos(a) * rx * k + cx;
      const z = Math.sin(a) * rz * k + cz;
      for (const p of route) min = Math.min(min, Math.hypot(p.x - x, p.z - z));
    }
    return min;
  };
  let k = 1;
  while (route.length && k < 2 && clearance(k) < gap) k += 0.04;
  return { rx: rx * k, rz: rz * k, cx, cz };
}

// Radius of the envelope at local height y (an inverted teardrop).
function envelopeRadius(y) {
  const t = (y + 1.25) / 2.55;
  const r = t < 0.62
    ? 0.3 + 0.76 * Math.pow(Math.sin((t / 0.62) * Math.PI * 0.5), 1.15)
    : 1.06 * Math.pow(Math.cos(((t - 0.62) / 0.38) * Math.PI * 0.5), 0.75);
  return Math.max(0.035, r);
}

function balloonMesh(gores, emissive = 0.08, { scale = SCALE, basket = 0.72, depth = basket } = {}) {
  // Envelope: open at the throat, with coloured gores separated by darker
  // load tapes (the seams that carry the weight).
  const profile = [];
  const steps = 22;
  for (let i = 0; i <= steps; i += 1) {
    const y = -1.25 + (i / steps) * 2.55;
    profile.push(new THREE.Vector2(envelopeRadius(y), y));
  }
  const segments = 48;
  const envelope = new THREE.LatheGeometry(profile, segments);
  const pos = envelope.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const tape = new THREE.Color("#b8a2b4");
  const perGore = segments / gores.length;
  for (let i = 0; i < pos.count; i += 1) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i)) + Math.PI;
    const seg = Math.round((a / (Math.PI * 2)) * segments) % segments;
    c.set(gores[Math.floor(seg / perGore) % gores.length]);
    if (seg % perGore === 0) c.lerp(tape, 0.55); // load tape
    if (pos.getY(i) > 1.2) c.lerp(new THREE.Color("#fff4f8"), 0.4); // crown panel
    colors.set([c.r, c.g, c.b], i * 3);
  }
  envelope.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  envelope.deleteAttribute("uv");
  const parts = [envelope];

  // Fabric skirt below the throat.
  parts.push(colored(new THREE.CylinderGeometry(0.3, 0.26, 0.2, 24, 1, true).translate(0, -1.35, 0), "#d9a3c0"));

  // Burner frame (square) with the burner and pilot light.
  const half = 0.17;
  for (const [x0, z0, x1, z1] of [[-half, -half, half, -half], [half, -half, half, half], [half, half, -half, half], [-half, half, -half, -half]]) {
    parts.push(rod(new THREE.Vector3(x0, FRAME_Y, z0), new THREE.Vector3(x1, FRAME_Y, z1), 0.012, "#6e6a78"));
  }
  parts.push(colored(new THREE.CylinderGeometry(0.075, 0.09, 0.14, 12).translate(0, FRAME_Y + 0.03, 0), "#9a98a6"));
  parts.push(colored(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12).translate(0, FRAME_Y + 0.12, 0), "#5c5a66"));

  // Suspension ropes: sixteen cables from the load tapes on the lower
  // envelope down to the corners of the burner frame.
  const anchorY = -0.95;
  const anchorR = envelopeRadius(anchorY) * 0.98;
  for (let k = 0; k < 16; k += 1) {
    const a = (k / 16) * Math.PI * 2 + Math.PI / 16;
    const top = new THREE.Vector3(Math.cos(a) * anchorR, anchorY, Math.sin(a) * anchorR);
    const corner = new THREE.Vector3(Math.sign(Math.cos(a)) * half, FRAME_Y, Math.sign(Math.sin(a)) * half);
    parts.push(rod(top, corner, 0.0065, "#f3e3c8"));
  }

  // Wicker basket: woven bands, padded leather rim, flexi-poles to the frame.
  const w = basket, d = depth, h = BASKET_HEIGHT, t = 0.045, top = BASKET_TOP, mid = top - h / 2;
  parts.push(colored(new THREE.BoxGeometry(w, 0.04, d).translate(0, top - h, 0), "#a8703f"));
  for (const [x, z, sx, sz] of [[0, d / 2, w, t], [0, -d / 2, w, t], [w / 2, 0, t, d], [-w / 2, 0, t, d]]) {
    const wall = new THREE.BoxGeometry(sx, h, sz, 1, 8, 1).translate(x, mid, z);
    const wp = wall.attributes.position;
    const wc = new Float32Array(wp.count * 3);
    for (let i = 0; i < wp.count; i += 1) {
      const band = Math.floor((wp.getY(i) - (top - h)) / (h / 8)) % 2;
      c.set(band ? "#c9925f" : "#b37d4e");
      wc.set([c.r, c.g, c.b], i * 3);
    }
    wall.setAttribute("color", new THREE.BufferAttribute(wc, 3));
    wall.deleteAttribute("uv");
    parts.push(wall);
    parts.push(colored(new THREE.BoxGeometry(sx + 0.04, 0.06, sz + 0.04).translate(x, top, z), "#7a4a30"));
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const low = new THREE.Vector3(x * (w / 2 - 0.02), top, z * (d / 2 - 0.02));
    const high = new THREE.Vector3(x * half, FRAME_Y, z * half);
    parts.push(rod(low, high, 0.014, "#5a4a3e"));
  }
  // Two little gas tanks in the back corners of the basket.
  parts.push(colored(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 10).translate(-(w / 2 - 0.12), top - h + 0.15, -(d / 2 - 0.12)), "#c7c9d6"));
  parts.push(colored(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 10).translate(w / 2 - 0.12, top - h + 0.15, -(d / 2 - 0.12)), "#c7c9d6"));

  const material = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: "#ffffff", emissiveIntensity: emissive, side: THREE.DoubleSide });
  // The camera can end up among the ropes next to a parked balloon: they
  // dissolve instead of striping the screen.
  material.onBeforeCompile = (shader) => addNearFade(shader, 0.5, 1.4);
  material.customProgramCacheKey = () => "balloon-near-fade";
  const mesh = new THREE.Mesh(mergeGeometries(parts), material);
  mesh.scale.setScalar(scale);
  return mesh;
}

function rod(a, b, radius, color) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(radius, radius, d.length(), 5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return colored(g, color);
}

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const g = canvas.getContext("2d");
  const gradient = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, "rgba(255,255,220,1)");
  gradient.addColorStop(0.3, "rgba(240,255,150,0.6)");
  gradient.addColorStop(1, "rgba(200,255,120,0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

// Find an open, dry, level patch (about 1.3 m clear all around) near `centre`.
function findDock(walker, centre) {
  const map = walker.map;
  // Level open ground for the basket, and nothing tall (trees, posts) close
  // enough for the envelope above to touch.
  const clear = (x, z) => {
    if (!map.isOpenGround(x, z)) return null;
    const h0 = map.surface(x, z);
    for (let r = 0.3; r <= 2.8; r += 0.25) {
      for (let k = 0; k < 16; k += 1) {
        const a = (k / 16) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        const s = map.sample(px, pz);
        if (r <= 1.6 && (!map.isOpenGround(px, pz) || Math.abs(map.surface(px, pz) - h0) > 0.25)) return null;
        if (s.kind === "body" && s.height > h0 + 1.1) return null;
      }
    }
    return h0;
  };
  for (let r = 0; r < 7; r += 0.4) {
    for (let k = 0; k < 24; k += 1) {
      const a = (k / 24) * Math.PI * 2;
      const x = centre.x + Math.cos(a) * r, z = centre.z + Math.sin(a) * r;
      const h = clear(x, z);
      if (h !== null) return new THREE.Vector3(x, h, z);
    }
  }
  return null;
}

export function createExtras(scene, { play, walker, quality = "high" } = {}) {
  // Decorative balloon on a slow loop around everything.
  const ship = balloonMesh(["#ffb3cf", "#fff4f8", "#c9b2ff", "#fff4f8", "#9fd4ff", "#fff4f8", "#ffe08a", "#fff4f8"]);
  ship.name = "Hot-air balloon";
  scene.add(ship);

  // Rideable balloon docked in the Bunny Meadow, on the spot the island keeps
  // clear for it (away from the picnic and the carrots).
  const meadow = play?.zones?.meadow ? new THREE.Vector3(...play.zones.meadow.center) : null;
  const near = play?.balloon ? new THREE.Vector3(...play.balloon) : meadow?.clone().add(new THREE.Vector3(1.5, 0, 2.5));
  const dock = walker && near ? findDock(walker, near) : null;
  let ride = null;
  if (dock) {
    const mesh = balloonMesh(["#ff8fb8", "#ffe4ee", "#ff8fb8", "#fff4f8", "#ffb3cf", "#ffe4ee"], 0.1, RIDE);
    mesh.name = "Rideable hot-air balloon";
    const rest = dock.clone().add(new THREE.Vector3(0, -BASKET_FLOOR * RIDE.scale, 0));
    mesh.position.copy(rest);
    scene.add(mesh);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 10), new THREE.MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.9, toneMapped: false }));
    flame.position.set(0, FRAME_Y + 0.36, 0); // licks up from the burner toward the throat
    flame.visible = false;
    mesh.add(flame);

    // Scenic loop: lift off, sail down one side of the path past the gardens
    // to where the walk began, back up the other side, then round the
    // islands (pond, grove, Music Isle) and glide back down.
    const up = rest.clone().add(new THREE.Vector3(0, 6, 0));
    const path = play?.layout?.path ?? { x: 0, from: 0, to: -30 };
    const over = (spot, high, dx = 0, dz = 0) => (spot ? [new THREE.Vector3(spot[0] + dx, high, spot[2] + dz)] : []);
    const route = [
      rest, rest.clone().add(new THREE.Vector3(0, 2.5, 0)), up,
      new THREE.Vector3(path.x - 7, 10, path.to + 3), new THREE.Vector3(path.x - 10, 10.5, (path.from + path.to) / 2),
      new THREE.Vector3(path.x - 8, 9.5, path.from + 5), new THREE.Vector3(path.x, 10, path.from + 15),
      new THREE.Vector3(path.x + 9, 10, path.from + 3), new THREE.Vector3(path.x + 11, 10.5, (path.from + path.to) / 2),
      new THREE.Vector3(path.x + 10, 10, path.to + 2),
      ...over(play?.zones?.pond?.center, 10.5, 1, 1), ...over(play?.swing?.pos, 11.5), ...over(play?.music?.floor, 10.5),
      up.clone().add(new THREE.Vector3(2, 1, -2)), rest.clone().add(new THREE.Vector3(0, 2.5, 0)), rest,
    ];
    const curve = new THREE.CatmullRomCurve3(route, false, "centripetal");
    const duration = Math.max(50, curve.getLength() / 2.6);
    // The docked basket is solid (hop onto its rim); it leaves with the balloon.
    const rim = rest.y + (BASKET_TOP + 0.03) * RIDE.scale;
    walker.addCollider({
      type: "box", x: rest.x, z: rest.z, halfX: (RIDE.basket / 2) * RIDE.scale + 0.03, halfZ: (RIDE.depth / 2) * RIDE.scale + 0.03, yaw: 0,
    }, () => (ride?.state === "docked" ? rim : -Infinity));
    // …and the follow camera stays out of the rope cage above it.
    walker.addCameraBlocker?.({ x: rest.x, z: rest.z, r: 0.8 * RIDE.scale, top: () => (ride?.state === "docked" ? rest.y + 0.6 * RIDE.scale : -Infinity) });
    ride = {
      mesh, flame, curve, rest, duration,
      state: "docked", // docked -> boarding -> flying -> docked
      t: 0,
      heading: 0,
      onEvent: () => {},
    };
  }

  // The decorative balloon keeps well clear of the ride's whole route.
  const way = play?.layout?.path;
  const loop = ambientLoop(ride ? ride.curve.getSpacedPoints(240) : [], way ? { rx: 34, rz: 50, cx: way.x, cz: (way.from + way.to) / 2 - 14 } : {});

  const count = quality === "low" ? 24 : 48;
  const grove = play?.swing ? new THREE.Vector3(...play.swing.pos) : new THREE.Vector3(-1.5, 1.3, -19.6);
  const seeds = Array.from({ length: count }, (_, i) => ({
    x: grove.x + (Math.random() - 0.5) * 11,
    z: grove.z + 1.6 + (Math.random() - 0.5) * 11,
    y: grove.y + 0.3 + Math.random() * 1.6,
    phase: i * 1.37,
    speed: 0.4 + Math.random() * 0.5,
  }));
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const texture = glowTexture();
  const fireflies = new THREE.Points(geometry, new THREE.PointsMaterial({
    map: texture, size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: "#fff7b0",
  }));
  fireflies.frustumCulled = false;
  scene.add(fireflies);

  const seat = new THREE.Vector3();
  const tangent = new THREE.Vector3();

  return {
    // The rideable balloon, for the walkthrough (null if no clear dock found).
    balloon: ride && {
      get state() { return ride.state; },
      get dock() { return ride.rest; },
      set onEvent(fn) { ride.onEvent = fn; },
      distanceTo(p) { return Math.hypot(p.x - ride.rest.x, p.z - ride.rest.z); },
      // Seat spot for walker.sit(): follows the basket and locks until
      // landing. aside: how far to her own +x side of the middle she stands
      // (two share the basket: one each side).
      board(aside = 0) {
        ride.state = "boarding";
        ride.t = 0;
        const floor = BASKET_FLOOR * RIDE.scale + STEP_UP;
        // She stands on a little step at the front of the basket, so she can
        // see over the rim with her paws on it.
        const front = (RIDE.depth / 2) * RIDE.scale - 0.42;
        const stand = () => seat.copy(ride.mesh.position).add(new THREE.Vector3(
          Math.sin(ride.heading) * front + Math.cos(ride.heading) * aside, floor, Math.cos(ride.heading) * front - Math.sin(ride.heading) * aside,
        ));
        return {
          balloon: true,
          shared: aside !== 0,
          pos: stand().toArray(),
          yaw: ride.heading,
          locked: () => ride.state !== "docked",
          dynamic: () => ({ pos: stand(), yaw: ride.heading }),
        };
      },
    },
    update(time, dt = 0) {
      const a = time * 0.025;
      ship.position.set(Math.cos(a) * loop.rx + loop.cx, 9 + Math.sin(time * 0.3) * 0.6, Math.sin(a) * loop.rz + loop.cz);
      ship.rotation.y = -a;
      ship.rotation.z = Math.sin(time * 0.4) * 0.04;

      if (ride) {
        if (ride.state === "docked") {
          ride.mesh.position.copy(ride.rest);
          ride.mesh.position.y += Math.sin(time * 1.2) * 0.02;
          ride.mesh.rotation.z = Math.sin(time * 0.8) * 0.015;
          // (Back square on its spot, where its solid sides are.)
          ride.heading -= Math.atan2(Math.sin(ride.heading), Math.cos(ride.heading)) * Math.min(1, dt * 1.5);
          ride.mesh.rotation.y = ride.heading;
          ride.flame.visible = false;
        } else if (ride.state === "boarding") {
          ride.t += dt;
          ride.flame.visible = true;
          ride.flame.scale.setScalar(0.8 + Math.random() * 0.4);
          if (ride.t > 1.4) {
            ride.state = "flying";
            ride.t = 0;
            ride.onEvent("takeoff");
          }
        } else if (ride.state === "flying") {
          ride.t = Math.min(1, ride.t + dt / ride.duration);
          // Ease in and out so lift-off and landing are gentle.
          const u = ride.t < 0.5 ? 2 * ride.t * ride.t : 1 - Math.pow(-2 * ride.t + 2, 2) / 2;
          const s = THREE.MathUtils.lerp(u, ride.t, 0.6);
          ride.curve.getPointAt(s, ride.mesh.position);
          ride.curve.getTangentAt(Math.min(0.999, s), tangent);
          if (Math.hypot(tangent.x, tangent.z) > 0.2) {
            const want = Math.atan2(tangent.x, tangent.z);
            let diff = want - ride.heading;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            ride.heading += diff * Math.min(1, dt * 1.5);
          }
          ride.mesh.rotation.y = ride.heading;
          ride.mesh.rotation.z = Math.sin(time * 0.6) * 0.03;
          ride.flame.visible = Math.sin(time * 2.5) > -0.3;
          ride.flame.scale.setScalar(0.8 + Math.random() * 0.4);
          if (ride.t >= 1) {
            ride.state = "docked";
            ride.onEvent("land");
          }
        }
      }

      seeds.forEach((s, i) => {
        positions[i * 3] = s.x + Math.sin(time * s.speed + s.phase) * 0.5;
        positions[i * 3 + 1] = s.y + Math.sin(time * s.speed * 1.3 + s.phase * 2) * 0.25;
        positions[i * 3 + 2] = s.z + Math.cos(time * s.speed * 0.8 + s.phase) * 0.5;
      });
      geometry.attributes.position.needsUpdate = true;
      // Fireflies come out at dusk.
      const dusk = Math.min(1, Math.max(0, (environment.uNight.value - 0.15) / 0.5));
      fireflies.visible = dusk > 0.01;
      fireflies.material.opacity = (0.65 + Math.sin(time * 3) * 0.25) * dusk;
      fireflies.material.size = 0.16 + dusk * 0.06;
    },
    dispose() {
      scene.remove(ship, fireflies);
      ship.geometry.dispose();
      ship.material.dispose();
      if (ride) {
        scene.remove(ride.mesh);
        ride.mesh.geometry.dispose();
        ride.mesh.material.dispose();
        ride.flame.geometry.dispose();
        ride.flame.material.dispose();
      }
      geometry.dispose();
      fireflies.material.dispose();
      texture.dispose();
    },
  };
}
