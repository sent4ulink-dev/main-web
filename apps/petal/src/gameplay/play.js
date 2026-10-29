import { createLayout } from "../world/layout.js";
import * as THREE from "three";
import { createProgress } from "./progress.js";
import { SEAT_GAP } from "./couple.js";
import { BASKET_SHARE } from "./extras.js";
import { createPickables } from "./pickables.js";
import { createLamps } from "./lamps.js";
import { createHearts } from "./hearts.js";
import { createSwing } from "./swing.js";
import { createCarving } from "./carving.js";
import { createScope } from "./scope.js";
import { createMinimap } from "../ui/minimap.js";
import { createPhotoBooth } from "../ui/photo.js";
import { button, el } from "../ui/dom.js";
import { environment as shared } from "../core/uniforms.js";

// The walkthrough game: everything you can do while walking (pick flowers and
// carrots, find hearts, carve the sakura, swing, sit, make a wish, use the
// telescope, ride the balloon, pet and feed the animals), the buttons, the
// island map and photo mode. The screen stays clear: the map, photo and
// character live in the ⚙ sheet (extras) and on keys. Each activity lives in
// its own module; this file wires them together and decides what the action
// button does.

export function createPlay({
  scene, world, walker, animals, fx, sfx, play, dom, notify, getContent, balloon = null, environment = null, settings = null,
  capture = () => null, ballroom = null,
  chooseCharacter = false, onCharacter = () => {},
  makerTools = () => true, // the island map: only while the invitation can still be edited
  couple = null, // the other bunny, once it walks with you (gameplay/couple.js)
}) {
  // May you choose who you play now (edit mode, which comes and goes)?
  const mayChoose = () => Boolean(typeof chooseCharacter === "function" ? chooseCharacter() : chooseCharacter);
  const V = (a) => new THREE.Vector3(...a);
  const counts = { flowers: 0, carrots: 0 };
  // Splashes and rings sit on the pond's surface (its bed is a bowl below).
  const waterLevel = play.zones?.pond?.center?.[1] ?? null;
  const onWater = (p) => (waterLevel === null ? p : new THREE.Vector3(p.x, Math.max(p.y, waterLevel + 0.02), p.z));

  // ------------------------------------------------------------- state --
  // The hidden hearts found so far are kept in this browser.
  const progress = createProgress();

  // --------------------------------------------------------- buttons --
  const buttons = el("div", "play-buttons");
  buttons.hidden = true;
  const actionButton = button("", { className: "play-action" });
  actionButton.hidden = true;
  const viewButton = button("🎥", { className: "play-round", ariaLabel: "Change the camera view" });
  viewButton.hidden = true;
  const sitButton = button("🪑", { className: "play-round", ariaLabel: "Sit" });
  const jumpButton = button("⤒", { className: "play-round play-jump", ariaLabel: "Jump (hold to glide)" });
  buttons.append(actionButton, viewButton, sitButton, jumpButton);
  dom.append(buttons);

  // Character chooser.
  const chooser = el("dialog", "sheet who-dialog");
  chooser.setAttribute("aria-labelledby", "who-title");
  const whoTitle = el("h2", "", "Choose your character");
  whoTitle.id = "who-title";
  const choices = el("div", "who-choices");
  const pickGirl = button("🎀 Girl bunny", { className: "who-choice" });
  const pickBoy = button("🎩 Boy bunny", { className: "who-choice" });
  choices.append(pickGirl, pickBoy);
  chooser.append(whoTitle, el("p", "", "You can change this any time in ⚙ Settings."), choices);
  dom.append(chooser);
  // Who you play is chosen in edit mode only; the invitation then keeps it.
  const choose = async (who) => {
    chooser.close();
    onCharacter(who);
    await walker.setCharacter(who);
    notify(who === "boy" ? "Let’s go, little gentleman! ♡" : "Let’s go, little lady! ♡");
  };
  pickGirl.addEventListener("click", () => choose("girl"));
  pickBoy.addEventListener("click", () => choose("boy"));

  // --------------------------------------------------------- activities --
  const pickables = createPickables({
    world, walker, fx, sfx,
    onCollect: (item) => {
      if (item.kind === "carrot") {
        counts.carrots += 1;
        notify(counts.carrots === 1 ? "A carrot! The bunnies will like that…" : `You have ${counts.carrots} carrots in your basket.`);
      } else {
        counts.flowers += 1;
        if (counts.flowers === 12) {
          notify("A perfect bouquet of twelve flowers. ♡");
          walker.express("love", 2);
        }
      }
      walker.setHolding(Math.min(12, counts.flowers), counts.carrots);
    },
  });
  const lamps = createLamps({ scene, world });
  const hearts = createHearts({
    scene, positions: play.hearts || [], found: progress.hearts,
    onFound: (i, pos) => {
      fx.hearts(pos, 8);
      fx.sparkle(pos, 12, "#ffc2d9");
      sfx.chime();
      walker.cheer();
      progress.save();
      if (hearts.found.size === hearts.total) {
        sfx.fanfare();
        fx.confetti(pos);
        walker.express("love", 2.5);
        notify(getContent().play.secret);
      } else notify(`💗 A hidden heart! ${hearts.found.size} / ${hearts.total}`);
    },
  });
  const swing = play.swing ? createSwing({ scene, walker, data: play.swing, sfx }) : null;
  const carving = createCarving({
    world, host: dom, sfx,
    onCarved: () => {
      if (play.carve) fx.sparkle(V(play.carve.pos), 18, "#ffe2c0");
      sfx.chime();
      notify("Carved into the old sakura tree forever. ♡");
    },
  });
  const scope = createScope({ scene, walker, data: play.telescope, notify, sfx });
  scope?.onChange((active) => {
    viewButton.hidden = !active;
    refresh(true);
  });
  const wells = (play.wells || []).map(V);
  const benches = play.benches || [];
  // A seat spot for a bench: 7 cm forward of its middle, on the seat top
  // (its front edge is then 10 cm ahead). The blanket is a ground spot.
  // If the cat naps on that bench she sits a little along, away from it.
  // With the other bunny along, the two share the seat: she a little to one
  // side, and `beside` is where he sits (on her far side from the cat).
  const benchSpot = (bench) => {
    if (bench.ground) return { pos: bench.pos, yaw: bench.yaw, ground: true };
    const [x, y, z] = bench.pos;
    const ax = Math.cos(bench.yaw);
    const az = -Math.sin(bench.yaw);
    const seat = (along) => [x + Math.sin(bench.yaw) * 0.07 + ax * along, y + 0.03, z + Math.cos(bench.yaw) * 0.07 + az * along];
    const cat = animals?.catPosition;
    const catSide = cat && Math.hypot(cat.x - x, cat.z - z) < 0.8 ? ((cat.x - x) * ax + (cat.z - z) * az > 0 ? 1 : -1) : 0;
    const his = catSide ? -catSide : couple?.side ?? -1; // which side of her he sits on
    const along = couple?.together ? (catSide ? 0 : -his * SEAT_GAP / 2) : -catSide * 0.15;
    return { pos: seat(along), yaw: bench.yaw, edge: 0.1, beside: seat(along + his * SEAT_GAP) };
  };
  const carvePos = play.carve ? V(play.carve.pos) : null;

  // --------------------------------------------------------------- map --
  const zone = (key) => (play.zones?.[key] ? V(play.zones[key].center) : null);
  const meadow = zone("meadow");
  const pond = zone("pond");
  const musicIsle = zone("music");
  const isles = getContent().isles;
  // Where the build put each place (play.json), with the name it goes by.
  const layout = createLayout(play);
  const named = (key, name) => (layout.places[key] ? [{ name, x: layout.places[key][0], z: layout.places[key][2] }] : []);
  const places = [
    ...named("question", isles.question), ...named("activity", isles.activity), ...named("calendar", isles.calendar),
    ...named("map", isles.map), ...named("keepsake", isles.keepsake), ...named("crossroads", isles.crossroads),
    ...named("grove", isles.grove), ...named("perch", isles.perch),
    ...(layout.gate ? [{ name: isles.gate, x: layout.gate.pos[0], z: layout.gate.pos[2] + 1.6 }] : []),
    ...(meadow ? [{ name: isles.meadow, x: meadow.x, z: meadow.z }] : []),
    ...(pond ? [{ name: isles.pond, x: pond.x, z: pond.z }] : []),
    ...(musicIsle ? [{ name: isles.music, x: musicIsle.x, z: musicIsle.z + 1.6 }] : []),
  ];
  const landmarks = [
    // (written down in the first layout: each goes with its garden)
    ...[["💌", -5.5, 5.8], ["🎨", -5.15, -1.8], ["🗓️", -0.6, -3.9], ["🗺️", 3.6, 0.6], ["📖", 5.7, -4.4]].map(([icon, x, z]) => {
      const [nx, , nz] = layout.spot([x, 0, z]);
      return { icon, x: nx, z: nz };
    }),
    ...(layout.gate ? [{ icon: "🚪", x: layout.gate.pos[0], z: layout.gate.pos[2] }] : []),
    ...wells.map((w) => ({ icon: "🪙", x: w.x, z: w.z })),
    ...(scope ? [{ icon: "🔭", x: scope.base.x, z: scope.base.z }] : []),
    ...(swing ? [{ icon: "🎠", x: swing.base.x, z: swing.base.z }] : []),
    ...(pond ? [{ icon: "🦆", x: pond.x, z: pond.z }] : []),
    ...((play.carrots || []).length ? [{ icon: "🥕", x: play.carrots[0][0] + 0.8, z: play.carrots[0][2] + 0.5 }] : []),
    ...(balloon ? [{ icon: "🎈", x: balloon.dock.x, z: balloon.dock.z }] : []),
    ...(ballroom ? [{ icon: "🎶", x: ballroom.floor.x, z: ballroom.floor.z }] : []),
  ];
  const minimap = createMinimap(dom, {
    map: walker.map, places, landmarks, corner: false,
    getStats: () => [`Hearts ${hearts.found.size} / ${hearts.total}`],
  });

  // ------------------------------------------------------------- photo --
  const photos = createPhotoBooth(dom, {
    capture,
    caption: () => getContent().play.photoCaption || "Our little world ♡",
  });
  jumpButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    jumpButton.setPointerCapture(event.pointerId);
    walker.pressJump();
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) jumpButton.addEventListener(type, () => walker.releaseJump());
  sitButton.addEventListener("click", () => sitHere());
  actionButton.addEventListener("click", () => runAction());
  viewButton.addEventListener("click", () => scope?.cycle());
  const unsubscribe = [
    walker.input.on("action", () => walker.active && runAction()),
    walker.input.on("sit", () => walker.active && sitHere()),
    walker.input.on("view", () => walker.active && scope?.cycle()),
    walker.input.on("photo", () => walker.active && photos.take()),
    walker.input.on("map", () => walker.active && makerTools() && minimap.open()),
  ];

  // ------------------------------------------------------- the actions --
  function wish(well) {
    const wishes = getContent().play.wishes.filter(Boolean);
    sfx.coin();
    walker.cheer();
    fx.sparkle(well.clone().add(new THREE.Vector3(0, 0.3, 0)), 20, "#ffe08a");
    setTimeout(() => fx.hearts(well.clone().add(new THREE.Vector3(0, 0.6, 0)), 5), 600);
    notify(`🪙 ${wishes[Math.floor(Math.random() * wishes.length)] || "Your wish is safe in the well."}`);
  }
  function contextAction() {
    const p = walker.position;
    if (walker.sitting?.pose === "scope") return { label: "🔭 Step away from the telescope", run: () => scope.stop() };
    if (walker.sitting?.balloon) {
      return balloon.state === "docked"
        ? { label: "🎈 Climb out of the basket", run: () => walker.sit() }
        : { label: "🎈 Flying… look around you", run: () => notify("Hold on tight! We will land back in the meadow. ♡") };
    }
    if (walker.sitting) return walker.sitting.swing ? { label: "Get off the swing", run: () => walker.sit() } : { label: "Stand up", run: () => walker.sit() };
    if (ballroom?.onFloor(p)) {
      return {
        label: getContent().play.dance?.button || "💃 Dance",
        run: () => ballroom.start(),
      };
    }
    if (balloon && balloon.state === "docked" && balloon.distanceTo(p) < 1.8) {
      return { label: "🎈 Fly in the hot-air balloon", run: () => { walker.sit(balloon.board(couple?.together ? -couple.side * BASKET_SHARE : 0)); sfx.ding(); notify("Everyone aboard! Hold on tight… 🎈"); } };
    }
    const animal = animals?.nearest(p);
    const item = pickables.nearest(p);
    // A bunny grazing by the carrot patch shouldn't stop you pulling a carrot:
    // whichever is nearer comes first.
    const itemFirst = item && animal && Math.hypot(item.pos.x - p.x, item.pos.z - p.z) < Math.hypot(animal.position.x - p.x, animal.position.z - p.z);
    if (animal && !itemFirst) {
      if (animal.kind === "bunny" && counts.carrots > 0) {
        return {
          label: "🥕 Feed the bunny",
          run: () => walker.perform("pet", {
            duration: 1.4, mid: 0.5, face: animal.position, approach: 0.42,
            onMid: () => {
              animals.feed(animal);
              counts.carrots -= 1;
              walker.setHolding(Math.min(12, counts.flowers), counts.carrots);
            },
          }),
        };
      }
      const names = { bunny: "Pet the bunny", cat: "Pet the cat", duck: "Pet the duck", frog: "Pet the frog", swan: "Pet the swan" };
      return {
        label: `♡ ${names[animal.kind] || "Say hello"}`,
        run: () => walker.perform("pet", {
          duration: 1.8, mid: 0.35, face: animal.position, approach: 0.42,
          onMid: () => animals.pet(animal),
        }),
      };
    }
    if (carving.available && carvePos && Math.hypot(carvePos.x - p.x, carvePos.z - p.z) < 1.8) return { label: "✎ Carve into the tree", run: () => carving.open() };
    const well = wells.find((w) => w.distanceTo(p) < 1.6);
    if (well) return { label: "🪙 Whisper a wish", run: () => wish(well) };
    if (scope?.near(p)) return { label: "🔭 Look through the telescope", run: () => scope.look() };
    if (swing && swing.base.distanceTo(p) < 1.3) {
      return { label: "Sit on the swing", run: () => { walker.sit(swing.spot()); swing.occupied = true; } };
    }
    if (item) return { label: item.kind === "carrot" ? "🥕 Pull a carrot" : "🌸 Pick a flower", run: () => pickables.pick(item) };
    const bench = benches.find((b) => V(b.pos).distanceTo(p) < 1.1);
    if (bench) return { label: bench.ground ? "Sit on the blanket" : "Sit on the chair", run: () => walker.sit(benchSpot(bench)) };
    return null;
  }
  let current = null;
  function runAction() {
    const action = contextAction();
    if (action) action.run();
    refresh(true);
  }
  function sitHere() {
    const bench = benches.find((b) => V(b.pos).distanceTo(walker.position) < 1.1);
    walker.sit(bench && !walker.sitting ? benchSpot(bench) : null);
  }
  function refresh(force = false) {
    const action = walker.active ? contextAction() : null;
    if (!force && action?.label === current?.label) return;
    current = action;
    actionButton.hidden = !action;
    if (action) actionButton.textContent = action.label;
    sitButton.textContent = walker.sitting ? "⤓" : "🪑";
    sitButton.setAttribute("aria-label", walker.sitting ? "Stand up" : "Sit");
  }
  // ------------------------------------------------------------ balloon --
  if (balloon) {
    balloon.onEvent = (type) => {
      if (type === "takeoff") {
        walker.setView(11); // pull well back: the whole island below
        sfx.fanfare();
        walker.express("happy", 2.4);
        walker.play("wave", 1.8);
        flightClock = 2.6;
        notify("Up, up we go! Look how big Petal Isle is. 🎈");
      } else if (type === "land") {
        walker.setView(false);
        sfx.chime();
        fx.sparkle(walker.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 18, "#ffd3e4");
        notify("We landed softly in the meadow. ♡");
      }
      refresh(true);
    };
  }

  // ---------------------------------------------------- secret gardens --
  const satellites = (play.satellites || []).map(V);
  let secretFound = new Set();
  try {
    secretFound = new Set(JSON.parse(localStorage.getItem("petal-isle-secret-gardens") || "[]"));
  } catch {
    secretFound = new Set();
  }
  function checkSecrets() {
    if (!walker.active) return;
    const p = walker.position;
    satellites.forEach((s, i) => {
      if (!secretFound.has(i) && Math.hypot(p.x - s.x, p.z - s.z) < 1.8 && Math.abs(p.y - s.y) < 1.2) {
        secretFound.add(i);
        try {
          localStorage.setItem("petal-isle-secret-gardens", JSON.stringify([...secretFound]));
        } catch {
          // Kept for this visit.
        }
        fx.sparkle(p.clone().add(new THREE.Vector3(0, 0.6, 0)), 16, "#d9b8ff");
        notify(`🗝️ A secret garden! ${secretFound.size} / ${satellites.length}`);
      }
    });
  }

  // Faces she pulls up in the balloon: delight, love, wonder at the view.
  const FLIGHT_MOODS = ["love", "surprised", "happy", "love", "happy"];
  let flightClock = 0;
  let flightMood = 0;

  let refreshTimer = 0;
  return {
    scopeView: scope ? scope.view : { active: false },
    swing,
    // For the ⚙ sheet while walking: the map (while the invitation can still
    // be edited), a photo, and who you are.
    extras() {
      return [
        ...(makerTools() ? [{ label: "🗺️ Island map", run: () => minimap.open() }] : []),
        { label: "📷 Take a photo", run: () => photos.take() },
        ...(mayChoose() ? [{ label: "🐰 Change character", run: () => chooser.showModal() }] : []),
      ];
    },
    chooseCharacter() {
      if (mayChoose() && !chooser.open) chooser.showModal();
    },
    show(visible) {
      buttons.hidden = !visible;
      if (visible) {
        let asked = false;
        try {
          asked = localStorage.getItem("petal-isle-character") !== null;
        } catch {
          asked = true;
        }
        if (!asked && mayChoose()) setTimeout(() => chooser.showModal(), 400);
      } else {
        scope?.reset();
        if (swing) swing.occupied = false;
      }
      refresh(true);
    },
    onWalkerEvent(type, data) {
      if (type === "jump") {
        sfx.jump();
        if (data.water) fx.splash(onWater(data.position), 0.5);
      } else if (type === "land") {
        if (data.speed > 4) sfx.land(data.material);
        if (data.fall > 0.6 && data.material === "grass") fx.dust?.(data.position, Math.min(1.4, data.fall * 0.5));
      } else if (type === "splash") {
        fx.splash(onWater(data.position), Math.min(1.3, 0.5 + data.speed * 0.12));
        sfx.splash();
      } else if (type === "wade") {
        fx.ripple(onWater(data.position), 0.7);
        sfx.wade();
      } else if (type === "step") {
        // (No footstep sounds: they got tiresome.) Little prints in settled
        // snow and on soaked ground.
        const printable = shared.uSnow.value > 0.3 || (shared.uWet.value > 0.6 && data.material !== "wood" && data.material !== "stone");
        if (printable && !data.water) fx.footprint?.(data.position, walker.heading, data.foot ? 1 : -1);
      } else if (type === "glide") {
        sfx.flutter?.();
      } else if (type === "fall") {
        notify("Oh! A cloud caught you. ☁️");
      } else if (type === "respawn") {
        fx.sparkle(data.position.clone().add(new THREE.Vector3(0, 0.4, 0)), 16, "#ffffff");
      } else if (type === "zzz") {
        fx.zzz?.(data.position);
      } else if (type === "character") {
        fx.sparkle(data.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 20, "#ffd3e4");
      } else if (type === "stand" && data.swing && swing) {
        swing.occupied = false;
      }
      refresh(true);
    },
    onEnvironmentEvent(type, data) {
      if (!walker.active) return;
      if (type === "rainbow") {
        notify("Look up — a rainbow! 🌈");
      } else if (type === "shooting-star") {
        notify("A shooting star! Whisper a wish… 🌠");
        walker.express("love", 2);
      } else if (type === "weather") {
        const lines = {
          rain: "A soft rain is falling. ☔", snow: "It is snowing on Petal Isle! ❄️", petals: "A wind of petals! 🌸",
          mist: "Mist is drifting over the gardens…", cloudy: "Clouds are gathering.", clear: "The sun is back. ☀️",
        };
        if (lines[data.weather]) notify(lines[data.weather]);
      } else if (type === "time" && data.label === "night") {
        notify("The stars are out. The lanterns glow brighter at night. ✨");
      }
    },
    update(time, dt) {
      pickables.update(dt);
      hearts.update(time, walker.active ? walker.position : null);
      swing?.update(time, dt);
      scope?.update(dt);
      lamps.update(time);
      checkSecrets();
      if (walker.sitting?.balloon && balloon?.state === "flying") {
        flightClock -= dt;
        if (flightClock <= 0) {
          flightClock = 3.2 + Math.random() * 1.6;
          walker.express(FLIGHT_MOODS[flightMood++ % FLIGHT_MOODS.length], 2.8);
          if (Math.random() < 0.4) walker.play(Math.random() < 0.5 ? "wave" : "cheer", 1.6);
        }
      }
      if (walker.active) minimap.update(dt, walker.position, walker.heading, walker.yaw);
      refreshTimer -= dt;
      if (refreshTimer <= 0 && walker.active) {
        refreshTimer = 0.2;
        refresh();
      }
    },
    dispose() {
      unsubscribe.forEach((off) => off());
      buttons.remove();
      chooser.remove();
      minimap.dispose();
      photos.dispose();
      carving.dispose();
      hearts.dispose();
      lamps.dispose();
      swing?.dispose();
      scope?.dispose();
    },
  };
}
