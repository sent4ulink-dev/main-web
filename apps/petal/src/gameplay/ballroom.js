import * as THREE from "three";
import { environment } from "../core/uniforms.js";

// The Music Isle: an old gramophone plays beside a checkered dance floor
// (its record spins, its flower-petal horn nods to the beat and little notes
// float out of it), and on the floor you can ask for a dance. The other bunny
// pops in and the two of you dance: a bow, a waltz round and round each
// other, a twirl, side-hops, claps, a double spin, cheek to cheek, a bow and a
// big heart, while the record plays up. With a song from YouTube (see
// app/jukebox.js) the round of moves goes on for as long as the song plays.
// Your own bunny steps aside for a stand-in that looks just like her (as at
// the keepsake book) and is put back where the stand-in ends. A tap, or a
// push on the controls, ends it early. After dark a paper lantern floating
// over the middle of the floor lights it, and the dancers on it.

const GAP = 0.45; // each dancer this far from the middle
const GATHER_LIMIT = 3; // seconds for your stand-in to reach her spot
const FOCUS_TIME = 1.2;
const CLAP_RATE = 15; // the rig's clap: paws meet when cos(time * 15) = -1
const BEAT = 60 / 132; // the gramophone's waltz (app/gramophone.js)
// The dance in three parts, step by step (seconds from the start of each):
// a bow to begin; a round of moves, again and again while a song from
// YouTube plays (once to the gramophone's waltz); and the close finish.
const PARTS = {
  opening: { length: 1.3, steps: [[0, "bow"]] },
  round: { length: 11.1, steps: [[0, "waltz"], [5.0, "twirl"], [6.2, "hops"], [7.7, "clap"], [9.1, "spin"], [10.05, "spin again"]] },
  finale: { length: 4.5, steps: [[0, "close"], [1.2, "bow"], [2.4, "heart"], [3.3, "farewell"], [4.5, "end"]] },
};
const WALTZ = { from: 0.1, to: 4.9, turns: 1.5 }; // in a round: round each other, one and a half times
const NOTE_COLORS = ["#ff8fbd", "#c9a8ff", "#ffcf6b", "#ff9fc3"];

const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

// A music note painted once: an oval head, a stem and a flag (♪), or two
// heads under a beam (♫).
function noteTexture(beamed) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const g = canvas.getContext("2d");
  g.fillStyle = "#ffffff";
  g.strokeStyle = "#ffffff";
  g.lineWidth = 9;
  g.lineCap = "round";
  const head = (x, y) => {
    g.beginPath();
    g.ellipse(x, y, 17, 12, -0.45, 0, Math.PI * 2);
    g.fill();
  };
  if (beamed) {
    head(36, 98);
    head(92, 86);
    g.beginPath();
    g.moveTo(50, 94);
    g.lineTo(50, 26);
    g.lineTo(106, 14);
    g.lineTo(106, 82);
    g.stroke();
  } else {
    head(52, 96);
    g.beginPath();
    g.moveTo(66, 92);
    g.lineTo(66, 18);
    g.quadraticCurveTo(80, 40, 100, 48);
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The gramophone: a little wooden cabinet with a spinning record and a tone
// arm, a crank on its side, a heart on its front and a big horn shaped like a
// morning glory, striped in two pinks, nodding towards the floor.
function buildGramophone() {
  const group = new THREE.Group();
  group.name = "Gramophone";
  const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
  const wood = lambert("#b97a50");
  const dark = lambert("#8a5536");
  const gold = lambert("#f2c46d", { emissive: "#6b4a10", emissiveIntensity: 0.25 });
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(0.36, 0.02, 0.36), gold, 0, 0.01, 0);
  add(new THREE.BoxGeometry(0.34, 0.13, 0.34), wood, 0, 0.085, 0);
  add(new THREE.BoxGeometry(0.35, 0.012, 0.35), dark, 0, 0.152, 0);
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, -0.03);
  heartShape.bezierCurveTo(-0.034, -0.006, -0.036, 0.026, -0.017, 0.03);
  heartShape.bezierCurveTo(-0.006, 0.031, 0, 0.021, 0, 0.015);
  heartShape.bezierCurveTo(0, 0.021, 0.006, 0.031, 0.017, 0.03);
  heartShape.bezierCurveTo(0.036, 0.026, 0.034, -0.006, 0, -0.03);
  add(new THREE.ShapeGeometry(heartShape, 6), lambert("#ff7fae", { side: THREE.DoubleSide }), 0, 0.085, 0.1715);
  // The turntable and its record.
  add(new THREE.CylinderGeometry(0.152, 0.152, 0.012, 32), lambert("#8f3e5c"), 0, 0.164, 0.01);
  const disc = new THREE.Group();
  disc.position.set(0, 0.172, 0.01);
  disc.add(new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.006, 40), lambert("#2a2026")));
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.007, 24), lambert("#ff7fae"));
  disc.add(label);
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.0072, 0.008), lambert("#fff4f8"));
  mark.position.x = 0.02;
  disc.add(mark); // so you can see it turn
  group.add(disc);
  add(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 8), gold, 0, 0.18, 0.01);
  // The tone arm, from a post at the back corner onto the record.
  add(new THREE.CylinderGeometry(0.012, 0.014, 0.04, 10), gold, 0.13, 0.175, -0.12);
  const arm = add(new THREE.CylinderGeometry(0.006, 0.006, 0.19, 8), gold, 0.075, 0.192, -0.045);
  arm.rotation.set(Math.PI / 2, 0, 0.62);
  add(new THREE.BoxGeometry(0.03, 0.016, 0.04), dark, 0.02, 0.184, 0.03);
  // The crank on its side.
  const crank = add(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8), gold, 0.215, 0.09, 0);
  crank.rotation.z = Math.PI / 2;
  add(new THREE.SphereGeometry(0.02, 10, 8), dark, 0.27, 0.12, 0);
  add(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), gold, 0.265, 0.1, 0);
  // The horn: a curved neck up from the back, then the flaring bell.
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.15, -0.13), new THREE.Vector3(0, 0.3, -0.17), new THREE.Vector3(0, 0.43, -0.1), new THREE.Vector3(0, 0.47, 0),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 24, 0.022, 10, false), gold));
  const horn = new THREE.Group();
  horn.position.set(0, 0.47, 0);
  horn.rotation.x = 0.9; // pointing up and out, towards the floor
  const profile = [];
  for (let i = 0; i <= 18; i += 1) {
    const t = i / 18;
    profile.push(new THREE.Vector2(0.024 + 0.21 * t ** 2.6, t * 0.36));
  }
  const bellGeometry = new THREE.LatheGeometry(profile, 32);
  // Stripes like the petals of a flower.
  const colors = [];
  const position = bellGeometry.attributes.position;
  const pink = new THREE.Color("#ff8fbd");
  const blush = new THREE.Color("#ffd3e4");
  for (let i = 0; i < position.count; i += 1) {
    const angle = Math.atan2(position.getZ(i), position.getX(i));
    const c = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 8 + 0.25) % 2 ? pink : blush;
    colors.push(c.r, c.g, c.b);
  }
  bellGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  horn.add(new THREE.Mesh(bellGeometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.234, 0.012, 8, 40), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.36;
  horn.add(rim);
  group.add(horn);
  group.scale.setScalar(1.3);
  return { group, disc, horn, mouth: new THREE.Vector3(0, 0.36, 0) };
}

// A round paper lantern, pink and cream, with a little tassel: it floats over
// the dance floor and glows after dark.
function buildLantern() {
  const group = new THREE.Group();
  group.name = "Dance floor lantern";
  const shell = new THREE.SphereGeometry(0.3, 20, 14);
  shell.scale(1, 0.86, 1);
  const position = shell.attributes.position;
  const colors = [];
  const pink = new THREE.Color("#ff9fc3");
  const cream = new THREE.Color("#fff1dc");
  for (let i = 0; i < position.count; i += 1) {
    const c = Math.floor(((Math.atan2(position.getZ(i), position.getX(i)) + Math.PI) / (Math.PI * 2)) * 10 + 0.5) % 2 ? pink : cream;
    colors.push(c.r, c.g, c.b);
  }
  shell.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const paper = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: "#ffb768", emissiveIntensity: 0.12 });
  group.add(new THREE.Mesh(shell, paper));
  const wood = new THREE.MeshLambertMaterial({ color: "#9a6a4a" });
  const cap = new THREE.CylinderGeometry(0.1, 0.12, 0.04, 14);
  for (const y of [0.26, -0.26]) {
    const ring = new THREE.Mesh(cap, wood);
    ring.position.y = y;
    group.add(ring);
  }
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 8), new THREE.MeshLambertMaterial({ color: "#ff7fae" }));
  tassel.position.y = -0.38;
  tassel.rotation.x = Math.PI;
  group.add(tassel);
  // A soft halo round it at night.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d");
  const fade = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  fade.addColorStop(0, "rgba(255,236,196,1)");
  fade.addColorStop(0.35, "rgba(255,206,150,0.45)");
  fade.addColorStop(1, "rgba(255,190,130,0)");
  g.fillStyle = fade;
  g.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false }));
  glow.scale.setScalar(2.3);
  glow.visible = false;
  group.add(glow);
  return {
    group, paper, glow,
    dispose() {
      shell.dispose();
      cap.dispose();
      tassel.geometry.dispose();
      tassel.material.dispose();
      paper.dispose();
      wood.dispose();
      texture.dispose();
      glow.material.dispose();
    },
  };
}

export function createBallroom({
  scene, camera, walker, cast, fx, sfx, music, isWalking, muteHints = () => {}, onScene = () => {}, notify = () => {}, words = () => ({}),
  songPlaying = () => false, onStart = () => {},
  stays = () => false, // the other bunny stays with you afterwards (gameplay/couple.js)
}) {
  const { host, partner } = cast;
  const floor = new THREE.Vector3(...music.floor);
  const radius = music.radius;
  const stand = new THREE.Vector3(...music.gramophone.pos);
  const gramophone = buildGramophone();
  gramophone.group.position.copy(stand);
  gramophone.group.rotation.y = music.gramophone.yaw;
  scene.add(gramophone.group);
  // Where notes come out (the horn's mouth) and which way.
  gramophone.group.updateMatrixWorld(true);
  const mouth = gramophone.horn.localToWorld(gramophone.mouth.clone());
  const outward = mouth.clone().sub(gramophone.horn.localToWorld(new THREE.Vector3(0, 0, 0))).normalize();

  // The floor's lantern: a paper lantern that floats over its middle. By day
  // it is only pretty; as night falls it glows and a warm light falls from it
  // onto the floor and whoever dances there. (The light is always in the
  // scene, at no strength by day, so nothing has to be rebuilt at dusk.)
  const lantern = buildLantern();
  const lanternAt = new THREE.Vector3(floor.x, floor.y + 3.1, floor.z);
  lantern.group.position.copy(lanternAt);
  scene.add(lantern.group);
  const stageLight = new THREE.PointLight("#ffd6a3", 0, 15, 2);
  stageLight.position.copy(lanternAt).y -= 0.25;
  scene.add(stageLight);

  // Notes floating out of the horn.
  const textures = [noteTexture(false), noteTexture(true)];
  const notes = [];
  for (let i = 0; i < 16; i += 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[i % 2], color: NOTE_COLORS[i % NOTE_COLORS.length], transparent: true, depthWrite: false, opacity: 0 }));
    sprite.visible = false;
    sprite.renderOrder = 4;
    scene.add(sprite);
    notes.push({ sprite, age: 0, life: 0, from: new THREE.Vector3(), drift: new THREE.Vector3(), sway: 0, size: 0.2 });
  }
  let noteTimer = 0;
  function releaseNote(dancing) {
    const note = notes.find((n) => !n.sprite.visible);
    if (!note) return;
    note.age = 0;
    note.life = dancing ? 3.4 : 3;
    note.from.copy(mouth);
    note.drift.copy(outward).multiplyScalar(0.35).add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.42, (Math.random() - 0.5) * 0.25));
    note.sway = Math.random() * Math.PI * 2;
    note.size = 0.16 + Math.random() * 0.08;
    note.sprite.visible = true;
  }

  let show = null;
  const focus = { from: null, t: 0 };
  const poser = new THREE.PerspectiveCamera();
  const spot = new THREE.Vector3();

  // The two dancers' places so far: round the middle of the floor, at
  // `angle`, `apart` from each other (every round turns them on a little).
  function places() {
    const u = show.u;
    let angle = show.angle + show.rounds * WALTZ.turns * Math.PI * 2;
    let apart = GAP;
    if (show.part === "round") {
      angle += smooth(clamp((u - WALTZ.from) / (WALTZ.to - WALTZ.from), 0, 1)) * WALTZ.turns * Math.PI * 2;
      if (u > 6.2 && u < 7.6) apart += Math.sin(((u - 6.2) / 1.4) * Math.PI) * 0.17; // side-hops: out and back
    } else if (show.part === "finale") {
      apart = GAP - smooth(clamp(u / 0.8, 0, 1)) * 0.17; // cheek to cheek
    }
    return { angle, apart };
  }
  function placeDancers(dt) {
    const { angle, apart } = places();
    for (const [actor, sign] of [[partner, 1], [host, -1]]) {
      spot.set(show.middle.x + Math.cos(angle) * apart * sign, 0, show.middle.z + Math.sin(angle) * apart * sign);
      spot.y = walker.map.surface(spot.x, spot.z) ?? show.middle.y;
      const speed = dt > 0 ? Math.hypot(spot.x - actor.position.x, spot.z - actor.position.z) / dt : 0;
      actor.glide(spot, speed > 0.05 ? speed : 0);
    }
  }

  // Facing each other, turned a little to you so you see their faces.
  const towards = (a, b) => () => {
    const other = yawTo(a.position, b.position);
    return other + wrap(yawTo(a.position, camera.position) - other) * 0.3;
  };
  const both = (fn) => [host, partner].forEach(fn);
  const facingEachOther = () => {
    host.turnTo(towards(host, partner));
    partner.turnTo(towards(partner, host));
    host.lookAt(show.heads.partner);
    partner.lookAt(show.heads.host);
  };
  const facingYou = () => both((b) => {
    b.turnTo(null);
    b.lookAt(null);
  });

  // The camera circles slowly round the floor, far enough back for both of
  // them (an upright phone needs more room across).
  function orbit() {
    const aspect = camera.aspect || 1;
    const half = Math.tan(THREE.MathUtils.degToRad(25));
    const distance = Math.max(3.7, 1.1 / half, 1.5 / (half * aspect));
    const azimuth = show.azimuth + show.clock * 0.035;
    const elevation = 0.5; // looking down a little, so neither hides the other as they turn
    const target = show.middle.clone().add(new THREE.Vector3(0, 0.55, 0));
    poser.position.set(
      target.x + Math.sin(azimuth) * Math.cos(elevation) * distance,
      target.y + Math.sin(elevation) * distance,
      target.z + Math.cos(azimuth) * Math.cos(elevation) * distance,
    );
    poser.up.set(0, 1, 0);
    poser.lookAt(target);
    return { position: poser.position, quaternion: poser.quaternion, fov: 50 };
  }
  function cameraRig(cam, dt) {
    if (!show) return;
    if (!focus.from) focus.from = { position: cam.position.clone(), quaternion: cam.quaternion.clone(), fov: cam.fov };
    focus.t = Math.min(1, focus.t + dt / FOCUS_TIME);
    const k = smooth(focus.t);
    const to = orbit();
    cam.position.lerpVectors(focus.from.position, to.position, k);
    cam.quaternion.slerpQuaternions(focus.from.quaternion, to.quaternion, k);
    cam.fov = THREE.MathUtils.lerp(focus.from.fov, to.fov, k);
    cam.updateProjectionMatrix();
  }

  function step(name) {
    const mid = show.middle;
    const above = (y) => mid.clone().add(new THREE.Vector3(0, y, 0));
    if (name === "bow") {
      facingEachOther();
      both((b) => {
        b.play("bow", 1.1);
        b.express("happy", 1.4);
      });
      fx.sparkle(above(0.9), 12, "#ffe7a8");
      sfx.chime();
    } else if (name === "waltz") {
      facingEachOther();
      both((b) => {
        b.play("dance", WALTZ.to - WALTZ.from);
        b.express("happy", WALTZ.to - WALTZ.from);
      });
      fx.hearts(above(1.1), 6);
    } else if (name === "twirl") {
      both((b) => {
        b.play("twirl", 1.0);
        fx.sparkle(b.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 16, "#ffe7a8");
      });
      sfx.twirl?.();
    } else if (name === "hops") {
      both((b) => b.hop(2));
    } else if (name === "clap") {
      facingYou();
      both((b) => b.play("clap", 1.2));
      show.clapUntil = show.u + 1.2;
    } else if (name === "spin" || name === "spin again") {
      // You spin in the first round, the other bunny in the next, and so on.
      const [spinner, watcher] = show.rounds % 2 ? [host, partner] : [partner, host];
      spinner.play("twirl", 0.9);
      fx.sparkle(spinner.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 14, "#ffd6ea");
      sfx.twirl?.();
      if (name === "spin") {
        watcher.turnTo(towards(watcher, spinner));
        watcher.cheer();
      }
    } else if (name === "close") {
      facingEachOther();
      both((b) => b.express("love", 2.6));
      fx.hearts(above(1.15), 8);
    } else if (name === "heart") {
      fx.bigHeart?.(above(1.3));
      fx.sparkle(above(1.3), 24, "#ffd6ea");
      fx.confetti(above(1.7));
      sfx.kiss?.();
      danced();
    } else if (name === "farewell") {
      facingYou();
      host.play("wave", 1.2);
      both((b) => b.express("happy", 1.2));
      const line = words().play?.dance?.end;
      if (line) notify(line);
    } else if (name === "end") {
      finish();
    }
  }

  function finish() {
    const s = show;
    show = null;
    if (!stays()) host.vanish();
    host.holdWand(true);
    host.lookAt(null);
    host.turnTo(null);
    walker.placeAt(partner.position, partner.heading, { cameraFrom: camera.position });
    partner.vanish({ quiet: true });
    partner.turnTo(null);
    partner.lookAt(null);
    walker.setHidden(false);
    walker.setFrozen(false);
    walker.setCameraOverride(null);
    muteHints(false);
    onScene(false);
    s.onEnd?.();
  }

  // The first round counts as a dance, even if it is cut short after.
  function danced() {
    if (show.danced) return;
    show.danced = true;
    show.onDanced?.();
  }
  function begin() {
    show.phase = "dance";
    show.part = "opening";
    show.u = 0;
    show.next = 0;
  }
  // On to the next part: another round while the song plays, else the finish.
  function nextPart() {
    if (show.part === "round") {
      show.rounds += 1;
      danced();
    }
    show.part = show.part === "opening" || (show.part === "round" && songPlaying()) ? "round" : "finale";
    show.u = 0;
    show.next = 0;
  }

  return {
    get active() { return Boolean(show); },
    floor,
    // Standing on the dance floor (where the dance can start).
    onFloor(p) {
      return Math.hypot(p.x - floor.x, p.z - floor.z) < radius - 0.2 && Math.abs(p.y - floor.y) < 0.4;
    },
    // How loud the gramophone is where you are (0..1), and from which side.
    presence(ear) {
      const dx = stand.x - ear.x;
      const dz = stand.z - ear.z;
      const d = Math.hypot(dx, dz);
      const m = camera.matrixWorld.elements;
      return {
        level: show ? 1 : clamp(1 - (d - 3) / 13, 0, 1) ** 1.5,
        pan: d > 0.01 ? (dx * m[0] + dz * m[2]) / d : 0,
      };
    },
    // On the floor: the dance begins. onDanced: when it reaches the big heart.
    start({ onDanced, onEnd } = {}) {
      if (show || !isWalking()) return false;
      // Side by side across the camera's view, in the middle of the floor.
      const view = new THREE.Vector3(floor.x - camera.position.x, 0, floor.z - camera.position.z).normalize();
      const angle = Math.atan2(-view.x, view.z); // across the view: you on the right, the host on the left
      const middle = floor.clone();
      show = {
        phase: "gather", part: "opening", clock: 0, u: 0, next: 0, rounds: 0, danced: false, middle, angle, onDanced, onEnd,
        azimuth: Math.atan2(camera.position.x - floor.x, camera.position.z - floor.z),
        clapUntil: -1, lastClap: null,
        heads: { host: new THREE.Vector3(), partner: new THREE.Vector3() },
      };
      const yours = middle.clone().add(new THREE.Vector3(Math.cos(angle) * GAP, 0, Math.sin(angle) * GAP));
      const theirs = middle.clone().add(new THREE.Vector3(-Math.cos(angle) * GAP, 0, -Math.sin(angle) * GAP));
      yours.y = walker.map.surface(yours.x, yours.z) ?? middle.y;
      theirs.y = walker.map.surface(theirs.x, theirs.z) ?? middle.y;
      show.yours = yours;
      focus.from = null;
      focus.t = 0;
      muteHints(true);
      onScene(true);
      const line = words().play?.dance?.start;
      if (line) notify(line);
      host.holdWand(false);
      host.pointAt(null);
      host.hop(0);
      host.appear(theirs, yawTo(theirs, yours));
      host.turnTo(() => yawTo(host.position, partner.position));
      partner.appear(walker.position, walker.heading, { quiet: true });
      partner.setHolding?.(...walker.holding);
      partner.turnTo(null);
      partner.lookAt(null);
      walker.setHidden(true);
      walker.setFrozen(true);
      walker.setCameraOverride(cameraRig);
      onStart(); // the song (if any) starts from this tap
      partner.runTo(yours, () => {
        if (show?.phase === "gather") begin();
      }, 2.2);
      return true;
    },
    skip() {
      if (show) finish();
    },
    cancel() {
      if (show) finish();
    },
    update(time, dt) {
      // The lantern bobs and turns; its light comes up with the night.
      const night = environment.uNight.value;
      lantern.group.position.y = lanternAt.y + Math.sin(time * 0.9) * 0.06;
      lantern.group.rotation.y = time * 0.25;
      lantern.paper.emissiveIntensity = 0.12 + night * 1.25;
      lantern.glow.material.opacity = night * (0.55 + Math.sin(time * 2.1) * 0.03);
      lantern.glow.visible = night > 0.02;
      stageLight.intensity = night * (17 + Math.sin(time * 2.1) * 0.5);
      // The record turns, the horn nods to the beat, notes drift out.
      const dancing = Boolean(show && show.phase === "dance");
      gramophone.disc.rotation.y -= dt * (dancing ? 4.2 : 3.5);
      const beat = (time / BEAT) % 3;
      gramophone.horn.rotation.x = 0.9 + Math.sin(beat * Math.PI * 2 / 3) * (dancing ? 0.06 : 0.03);
      gramophone.horn.scale.setScalar(1 + Math.max(0, Math.cos((beat % 1) * Math.PI * 2)) * (dancing ? 0.035 : 0.015));
      noteTimer -= dt;
      if (noteTimer <= 0) {
        releaseNote(dancing);
        noteTimer = dancing ? 0.35 + Math.random() * 0.25 : 0.9 + Math.random() * 0.8;
      }
      for (const note of notes) {
        if (!note.sprite.visible) continue;
        note.age += dt;
        const t = note.age / note.life;
        if (t >= 1) {
          note.sprite.visible = false;
          continue;
        }
        note.sprite.position.copy(note.from).addScaledVector(note.drift, note.age);
        note.sprite.position.x += Math.sin(note.sway + note.age * 2.4) * 0.12 * t;
        note.sprite.position.z += Math.cos(note.sway + note.age * 2.1) * 0.08 * t;
        note.sprite.material.opacity = Math.min(1, t * 6) * (1 - smooth(clamp((t - 0.65) / 0.35, 0, 1)));
        note.sprite.material.rotation = Math.sin(note.sway + note.age * 3) * 0.3;
        note.sprite.scale.setScalar(note.size * (0.7 + 0.3 * Math.min(1, t * 4)));
      }
      if (!show) return;
      show.clock += dt;
      if (walker.urge > 0.3) {
        finish();
        return;
      }
      show.heads.host.copy(host.position).setY(host.position.y + 0.55);
      show.heads.partner.copy(partner.position).setY(partner.position.y + 0.55);
      if (show.phase === "gather") {
        if (show.clock > GATHER_LIMIT) {
          partner.appear(show.yours, yawTo(show.yours, host.position), { quiet: true });
          begin();
        }
        return;
      }
      show.u += dt;
      const part = PARTS[show.part];
      while (show && show.next < part.steps.length && show.u >= part.steps[show.next][0]) step(part.steps[show.next++][1]);
      if (!show) return;
      if (show.u >= part.length) nextPart();
      placeDancers(dt);
      // A clap each time their paws meet.
      if (show.part === "round" && show.u < show.clapUntil) {
        const clap = Math.floor((time * CLAP_RATE + Math.PI) / (Math.PI * 2));
        if (show.lastClap !== null && clap !== show.lastClap) sfx.clap?.();
        show.lastClap = clap;
      }
    },
    dispose() {
      scene.remove(lantern.group, stageLight);
      lantern.dispose();
      scene.remove(gramophone.group);
      gramophone.group.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      for (const note of notes) {
        scene.remove(note.sprite);
        note.sprite.material.dispose();
      }
      textures.forEach((t) => t.dispose());
    },
  };
}
