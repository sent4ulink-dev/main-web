import * as THREE from "three";
import { createCuteIsland, TOUR_STOPS } from "./island.js";
import { createBoardLamps } from "./board-lamps.js";
import { createLayout } from "./layout.js";
import { pointAt } from "./surface.js";
import { createEnvironment } from "./environment.js";
import { createSettingsStore } from "../core/settings.js";
import { detectTier, sharpestRatio } from "../core/sharpness.js";
import { createLensDrops } from "../fx/lens-drops.js";
import { createPlayer } from "../actors/player.js";
import { createFx } from "../fx/particles.js";
import { createAnimals } from "../actors/animals.js";
import { createHost } from "../actors/host.js";
import { createChooser } from "../gameplay/chooser.js";
import { createCelebration } from "../gameplay/celebration.js";
import { createTrail } from "../gameplay/trail.js";
import { createBallroom } from "../gameplay/ballroom.js";
import { createGate } from "../gameplay/gate.js";
import { createChimes } from "../gameplay/chimes.js";
import { createCouple } from "../gameplay/couple.js";
import { footing } from "./pathfind.js";
import { createPlay } from "../gameplay/play.js";
import { createExtras } from "../gameplay/extras.js";
import { sfx } from "../fx/sfx.js";

const ease = (value) => value * value * (3 - 2 * value);
// The guided views of the five gardens, written down as the art was first
// laid out; each goes where its garden stands now (world/layout.js).
const GARDEN_VIEWS = {
  question: {
    garden: 1,
    desktop: { position: [-5.5, 3.55, 11.7], target: [-5.5, 1.72, 4.7], fov: 45 },
    phone: { position: [-5.5, 3.85, 11.8], target: [-5.5, 1.72, 4.7], fov: 52 },
  },
  activities: {
    garden: 2,
    desktop: { position: [-5.15, 3.65, 4.6], target: [-5.15, 1.82, -1.2], fov: 45 },
    phone: { position: [-5.15, 3.95, 4.55], target: [-5.15, 1.95, -0.6], fov: 66 },
  },
  calendar: {
    garden: 3,
    desktop: { position: [-0.55, 4.2, 2.05], target: [-0.55, 2.32, -4.1], fov: 45 },
    phone: { position: [-0.55, 4.3, 1.85], target: [-0.55, 2.4, -3.5], fov: 58 },
  },
  map: {
    garden: 4,
    desktop: { position: [3.6, 3.7, 7.85], target: [3.6, 1.84, 1], fov: 45 },
    phone: { position: [3.6, 3.95, 7.05], target: [3.6, 2, 1.5], fov: 58 },
  },
  keepsake: {
    garden: 5,
    desktop: { position: [5.7, 4.75, 2.05], target: [5.7, 2.78, -4.4], fov: 45 },
    phone: { position: [5.7, 4.85, 1.9], target: [5.7, 2.8, -3.8], fov: 58 },
  },
};
function cameraViews(layout) {
  const views = {};
  for (const [name, view] of Object.entries(GARDEN_VIEWS)) {
    views[name] = {};
    for (const kind of ["desktop", "phone"]) {
      const { position, target, fov } = view[kind];
      views[name][kind] = { position: layout.spot(position, view.garden), target: layout.spot(target, view.garden), fov };
    }
  }
  // The first look (under the clouds): from over the question garden up the
  // whole path, the gardens to either side and the gate at its end. And the
  // last: from over the gate, out to the islands round the crossroads.
  const path = layout.path ?? { x: 0, from: 0, to: -30 };
  const hub = layout.hub ?? [path.x, 1, path.to - 10];
  views.overview = {
    desktop: { position: [path.x + 1.5, 21, 30], target: [path.x, 1.2, path.from - 11], fov: 46 },
    phone: { position: [path.x, 36, 50], target: [path.x, 1.1, path.from - 9], fov: 52 },
  };
  views.finale = {
    desktop: { position: [path.x + 7, 15, path.to + 16], target: [hub[0], 2, hub[2] - 5], fov: 50 },
    phone: { position: [path.x, 30, path.to + 30], target: [hub[0], 1.5, hub[2] - 3], fov: 56 },
  };
  return views;
}

export async function createGrove(
  canvas,
  {
    paused = false,
    reducedMotion = false,
    onState = () => {},
    onMessage = () => {},
    onProject = () => {},
    onSlot = () => {},
    onChoose = () => {},
    onTour = () => {},
    onHint = () => {},
    songPlaying = () => false, // the Music Isle's YouTube song is playing
    onDance = () => {}, // a dance on the Music Isle begins (from a tap)
    character = null, // who you play ("girl" or "boy"); null: as last time
    chooseCharacter = false, // may you choose who you play (edit mode only); a function when it changes
    makerTools = () => true, // the island map: only while the invitation can still be edited
    onCharacter = () => {}, // you chose
    onPlanReady = () => {}, // the dance at the keepsake book is over: the plan is set
    content,
    selections = {},
    settings = createSettingsStore(),
  } = {},
) {
  let width = Math.max(1, canvas.clientWidth || innerWidth);
  let height = Math.max(1, canvas.clientHeight || innerHeight);
  let mobile = width < 700;
  const coarsePhone = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 700;
  const lowPower = Boolean(mobile || coarsePhone || (navigator.deviceMemory && navigator.deviceMemory <= 4));
  // The most beautiful picture the device can hold (no setting for it): the
  // frame governor below steps down if it struggles.
  const quality = detectTier({ phone: mobile || coarsePhone, memory: navigator.deviceMemory, cores: navigator.hardwareConcurrency });
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
  });
  // Adaptive resolution: start sharp (a phone gets a 1080p-class picture; see
  // core/sharpness.js), then trade pixels for frame rate if needed.
  const sharpest = () => sharpestRatio(quality, { dpr: devicePixelRatio || 1, width, height });
  let maxPixelRatio = sharpest();
  let pixelRatio = maxPixelRatio;
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor("#8fc2f7", 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#e6eefb", 60, 200);
  const hemi = new THREE.HemisphereLight("#fff7fb", "#b9a9e6", 1.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff0e2", 1.75);
  sun.position.set(-8, 16, 10);
  scene.add(sun);
  const rim = new THREE.DirectionalLight("#ffd6ec", 0.6);
  rim.position.set(6, 8, -12);
  scene.add(rim);

  let words = content;
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
  const playData = await fetch("/island/play.json?v=26").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const layout = createLayout(playData);
  const CAMERA_VIEWS = cameraViews(layout);
  const island = await createCuteIsland(scene, () => {}, { quality, content, selections, layout });
  // A little lamp over every picture on the boards, lit after dark.
  const boardLamps = createBoardLamps({ scene, slots: island.slots });
  let game = null;
  let hintsMuted = false; // a picking board is open: its own hint is enough
  let hintNow = null; // the walker's hint, shown again once unmuted
  const walker = await createPlayer(scene, camera, canvas.parentElement, {
    character,
    onHint: (text) => {
      hintNow = text;
      onHint(hintsMuted ? null : text);
    },
    onEvent: (type, data) => game?.onWalkerEvent(type, data),
  });
  const fx = createFx(scene);
  walker.setWaterLevel(playData?.zones?.pond?.center?.[1]);
  const env = createEnvironment({
    scene, renderer, hemi, sun, fill: rim, quality, fx, map: walker.map, waterLevel: playData?.zones?.pond?.center?.[1] ?? null,
    time: settings.get().time, weather: "auto", // the weather is always a surprise
    onEvent: (type, data) => game?.onEnvironmentEvent?.(type, data),
  });
  env.sky.addPuffs(island.mistPoints);
  const lens = reducedMotion ? null : createLensDrops(canvas.parentElement, { before: canvas });
  const applyLook = (s) => walker.setLook({ sensitivity: s.sensitivity, invertY: s.invertY });
  applyLook(settings.get());
  sfx.setVolume(settings.get().effects);
  sfx.listen(camera); // the animals' voices are placed around the camera
  const unsubscribeSettings = settings.subscribe((next, patch) => {
    if ("time" in patch) env.setTime(next.time);
    if ("sensitivity" in patch || "invertY" in patch) applyLook(next);
    if ("effects" in patch) sfx.setVolume(next.effects);
  });
  const extras = createExtras(scene, { play: playData, walker, quality });
  // Nothing grows through anything: flowers inside props (under benches, in
  // rocks and bushes), on paths, bridges and the dock, or under the swing,
  // telescope and balloon are cleared before the game picks its flowers.
  if (playData) {
    const map = walker.map;
    const keepClear = [];
    if (playData.swing) {
      const [x, y, z] = playData.swing.pos;
      for (const side of [-1, 1]) {
        keepClear.push({ x: x + Math.cos(playData.swing.yaw) * 0.72 * side, y, z: z - Math.sin(playData.swing.yaw) * 0.72 * side, r: 0.28 });
      }
    }
    if (playData.telescope?.base) keepClear.push({ x: playData.telescope.base[0], y: playData.telescope.base[1], z: playData.telescope.base[2], r: 0.6 });
    if (extras.balloon) keepClear.push({ x: extras.balloon.dock.x, y: extras.balloon.dock.y, z: extras.balloon.dock.z, r: 0.66 });
    const floorBelow = (x, z) => {
      let low = null;
      for (let k = 0; k < 8; k += 1) {
        for (const r of [0.3, 0.5]) {
          const s = map.sample(x + Math.cos(k * 0.785) * r, z + Math.sin(k * 0.785) * r);
          if (s.kind === "floor" && (low === null || s.height < low)) low = s.height;
        }
      }
      return low;
    };
    const cleared = island.clearFlowers((p) => {
      for (const c of keepClear) if ((p.x - c.x) ** 2 + (p.z - c.z) ** 2 < c.r * c.r && Math.abs(p.y - c.y) < 0.8) return true;
      const s = map.sample(p.x, p.z);
      if (s.kind === "body" && s.height > p.y + 0.05) {
        const floor = floorBelow(p.x, p.z);
        return floor === null || p.y - floor < 0.35; // a ground flower inside a prop
      }
      if (s.kind === "body" && s.material === "stone" && Math.abs(s.height - p.y) < 0.12) return true; // perched on a rock or pedestal
      return s.kind === "floor" && (s.material === "stone" || s.material === "wood") && Math.abs(s.height - p.y) < 0.15;
    });
    if (new URLSearchParams(location.search).has("debug")) console.info(`Petal Isle: cleared ${cleared} flowers that grew through props or paths.`);
  }
  const animals = playData ? createAnimals(scene, {
    walker, play: playData, fx, sfx, environment: env, notify: (text) => onMessage(text),
    onEvent: (type) => game?.onAnimalEvent?.(type), debug: new URLSearchParams(location.search).has("debug"),
  }) : null;
  // The other bunny hosts the picking boards (calendar, activities, map).
  const host = createHost(scene, { walker, slots: island.slots, fx, sfx });
  let selectionsNow = selections;
  // Picking on the boards: tap a board to open it, a picture to have the host
  // show it, the same picture again to choose it (no dialogs).
  const muteHints = (on) => {
    hintsMuted = on;
    onHint(on ? null : hintNow);
  };
  const chooser = createChooser({
    camera, walker, island, host, onChoose, muteHints,
    viewport: () => ({ width, height }),
    // The jump and action buttons step aside while a board is open.
    onPicking: (on) => canvas.parentElement?.classList.toggle("picking", on),
    getContent: () => words,
    getSelections: () => selectionsNow,
    notify: (text) => onMessage(text),
    isWalking: () => state === "walking" && walker.active,
  });
  // Has the book dance been seen (the last stop of the paw-print trail)?
  let danced = false;
  try {
    danced = localStorage.getItem("petal-isle-danced") === "1";
  } catch {
    // Storage unavailable: the trail just leads to the book again next visit.
  }
  // The keepsake book: the two bunnies dance under an "It's a date!" ribbon.
  const celebration = createCelebration({
    scene, camera, walker, island, cast: host, fx, sfx, muteHints,
    getSelections: () => selectionsNow,
    notify: (text) => onMessage(text),
    isWalking: () => state === "walking" && walker.active,
    // The game's buttons and stick step out of the shot while they dance.
    onScene: (on) => canvas.parentElement?.classList.toggle("in-scene", on),
    onDanced: () => {
      danced = true;
      try {
        localStorage.setItem("petal-isle-danced", "1");
      } catch {
        // Kept for this visit.
      }
    },
    onEnd: () => onPlanReady(),
    // From the dance on, the other bunny stays with you.
    stays: () => danced && state === "walking",
  });
  // …and walks the island with you, hand in hand (gameplay/couple.js).
  const couple = createCouple({
    walker, actor: host.host, fx, sfx, waterLevel: playData?.zones?.pond?.center?.[1] ?? null,
    getSwing: () => game?.swing ?? null,
  });
  // Has she walked through the big gate (the trail's very last stop)?
  let through = false;
  try {
    through = localStorage.getItem("petal-isle-through") === "1";
  } catch {
    // The trail just leads through the gate again next visit.
  }
  // The big gate at the path's end swings open as she walks up to it. The
  // first time, a line says what lies beyond.
  let gateGreeted = through;
  const gate = createGate({
    gate: layout.gate, leaves: island.gateLeaves, walker, fx, sfx,
    onOpen: () => {
      if (gateGreeted) return;
      gateGreeted = true;
      onMessage(words.play.gate?.opened ?? "");
    },
  });
  // The path's chiming heart stones.
  const chimes = createChimes({ scene, runs: playData?.chimes ?? [], fx, sfx });
  // The Music Isle: the gramophone, and the dance floor where the two bunnies
  // dance.
  const ballroom = playData?.music
    ? createBallroom({
      scene, camera, walker, cast: host, fx, sfx, music: playData.music, muteHints, songPlaying, onStart: onDance,
      isWalking: () => state === "walking" && walker.active,
      onScene: (on) => canvas.parentElement?.classList.toggle("in-scene", on),
      notify: (text) => onMessage(text),
      words: () => words,
      stays: () => danced && state === "walking",
    })
    : null;
  // The paw-print trail: to the activity board, the calendar, the map, and
  // last the book, one after another, so nobody gets lost.
  let guideTimer = 0;
  const trail = (() => {
    const map = walker.map;
    // Open ground near a point (where the trail ends, in front of a board).
    const groundNear = (p) => {
      for (let r = 0; r < 2.5; r += 0.2) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
          const x = p.x + Math.cos(a) * r;
          const z = p.z + Math.sin(a) * r;
          const h = footing(map, x, z, 0.25);
          if (h !== null) return new THREE.Vector3(x, h, z);
          if (r === 0) break;
        }
      }
      return p.clone();
    };
    const stop = (key, f, done) => f && {
      key, done,
      spot: groundNear(f.centre.clone().addScaledVector(f.normal, 2)),
      mark: f.centre.clone().setY(Math.max(...f.points.map((p) => p.box.max.y)) + 0.55),
    };
    const board = (key) => host.stations.find((s) => s.key === key)?.frame;
    const steps = [
      stop("activity", board("activity"), () => Boolean(selectionsNow.activity)),
      stop("calendar", board("calendar"), () => Boolean(selectionsNow.date)),
      stop("place", board("place"), () => Boolean(selectionsNow.place)),
      stop("book", celebration.frame, () => danced),
      // …and out through the gate, to the islands beyond. (It leads up to
      // the gate, which opens as she comes; the step is done once she is through.)
      gate && {
        key: "gate", done: () => through,
        spot: groundNear(gate.beyond(-2.6)),
        mark: gate.centre.clone().setY(gate.centre.y + (layout.gate.top ?? 4.8) + 0.9),
      },
    ].filter(Boolean);
    // Each stop's guide line; after a choice it waits a moment, so the choice's
    // own "…is part of our story now" is read first.
    return createTrail(scene, {
      map, steps,
      onStep: (key, first) => {
        clearTimeout(guideTimer);
        const text = words.play.guide?.[key];
        if (text) guideTimer = setTimeout(() => state === "walking" && onMessage(text), first ? 0 : 2600);
      },
      // Got there: the view eases round to the board (or the book).
      onArrive: (step) => walker.lookToward(step.mark),
    });
  })();
  // The boards and the book stand in the follow camera's way (the walk map
  // only knows their posts), so it doesn't look through them from behind: a
  // row of round blockers along each one, up to its top.
  for (const f of [...host.stations.map((s) => s.frame), celebration.frame].filter(Boolean)) {
    const top = Math.max(...f.points.map((p) => p.box.max.y)) + 0.4;
    const reach = f.half + 0.25;
    for (let along = -reach; along < reach + 0.2; along += 0.45) {
      walker.addCameraBlocker({ x: f.centre.x + f.side.x * along, z: f.centre.z + f.side.z * along, r: 0.35, top: () => top });
    }
  }
  // Leaving walking or the tour: boards and dances are put away at once.
  const putAway = () => {
    celebration.cancel();
    ballroom?.cancel();
    chooser.close({ release: true });
  };
  // Where water can be heard: the pond, and the waterfalls round the island.
  const waterPoints = [];
  {
    const map = walker.map;
    const { x0, z0, x1, z1 } = map.bounds;
    for (let x = x0; x <= x1; x += 0.6) {
      for (let z = z0; z <= z1; z += 0.6) {
        const s = map.sample(x, z);
        if (s.water) waterPoints.push(new THREE.Vector3(x, s.height, z));
      }
    }
    const falls = scene.getObjectByName("Waterfalls");
    if (falls?.geometry) {
      falls.updateWorldMatrix(true, false);
      const cells = new Map();
      const v = new THREE.Vector3();
      const position = falls.geometry.attributes.position;
      for (let i = 0; i < position.count; i += 1) {
        v.fromBufferAttribute(position, i).applyMatrix4(falls.matrixWorld);
        const key = `${Math.round(v.x / 1.5)},${Math.round(v.z / 1.5)}`;
        if (!cells.has(key)) cells.set(key, v.clone());
      }
      waterPoints.push(...cells.values());
    }
  }
  walker.setObstacles(() => (walker.active ? [...(animals ? animals.obstacles(walker.position) : []), ...host.obstacles()] : []));
  game = playData
    ? createPlay({
      scene, world: island.world, walker, animals, fx, sfx, play: playData, balloon: extras.balloon, dom: canvas.parentElement,
      notify: (text) => onMessage(text), getContent: () => words, environment: env, settings, capture, ballroom,
      chooseCharacter, onCharacter, makerTools, couple,
    })
    : null;
  {
    const hints = {
      calendar: "Tap the calendar to choose your day ♡",
      activity: "Tap a picture to choose your adventure ♡",
      place: "Tap a place on the map to choose it ♡",
      keepsake: "Tap the book to mark our date ♡",
    };
    const chosen = { calendar: "date", activity: "activity", place: "place" };
    const box = new THREE.Box3();
    // Wide enough to reach where the paw-print trail rests, in front of each
    // board. A board already chosen from goes quiet: the paw prints lead on.
    const stations = island.slots.map((slot) => {
      const type = slot.userData.content?.type;
      const text = hints[type] || "Tap to open ♡";
      return {
        position: box.setFromObject(slot).getCenter(new THREE.Vector3()),
        radius: 3.8,
        // (…and the book, once its dance has been danced.)
        hint: () => ((chosen[type] && selectionsNow[chosen[type]]) || (type === "keepsake" && danced) ? null : text),
      };
    });
    walker.setStations(stations);
  }
  // Photo mode: draw one fresh frame and read it back in the same task, so no
  // preserved drawing buffer is needed.
  function capture() {
    renderer.render(scene, camera);
    try {
      return renderer.domElement.toDataURL("image/jpeg", 0.95);
    } catch {
      return null;
    }
  }
  // No post-processing: every device renders a single forward pass.
  let state = "intro", station = 0, transition = null;
  let motionPaused = paused, last = performance.now(), lastRender = 0, elapsed = 0, frame, disposed = false;
  let drag = null, dodgeCount = 0, dodgeAt = -1000, noPulse = 0, hoveredSlot = null;
  let activeView = "overview", lookYaw = 0, lookPitch = 0;
  const pointer = new THREE.Vector2(9, 9);
  const pointerPixel = { x: -9999, y: -9999 };
  const raycaster = new THREE.Raycaster();
  const life = new AbortController();
  const poseCamera = new THREE.PerspectiveCamera();
  const noChoiceScale = island.noChoice.scale.clone();
  const noChoiceRotation = island.noChoice.rotation.z;

  function viewPose(name) {
    const view = CAMERA_VIEWS[name];
    if (!view) throw new Error(`The camera view “${name}” is not defined.`);
    const layout = view[mobile ? "phone" : "desktop"];
    poseCamera.position.set(...layout.position);
    poseCamera.up.set(0, 1, 0);
    poseCamera.lookAt(new THREE.Vector3(...layout.target));
    poseCamera.rotateY(lookYaw);
    poseCamera.rotateX(lookPitch);
    return {
      position: poseCamera.position.clone(),
      quaternion: poseCamera.quaternion.clone(),
      fov: layout.fov,
    };
  }
  function applyPose(pose) {
    camera.position.copy(pose.position);
    camera.quaternion.copy(pose.quaternion);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
  function currentPose() {
    return { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov };
  }
  function setState(next) {
    state = next;
    onState(next);
  }
  function moveTo(name, duration, nextState, done) {
    activeView = name;
    lookYaw = 0;
    lookPitch = 0;
    canvas.parentElement?.style.setProperty("--sky-x", "50%");
    const target = viewPose(name);
    if (reducedMotion || motionPaused || duration === 0) {
      applyPose(target);
      setState(nextState);
      done?.();
      return;
    }
    transition = { from: currentPose(), target, elapsed: 0, duration, nextState, done };
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const wasMobile = mobile;
    mobile = width < 700;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // How sharp it may draw depends on the screen's size (at the sharpest it
    // stays there; otherwise the governor climbs back when there is room).
    const wasSharpest = pixelRatio >= maxPixelRatio - 0.01;
    maxPixelRatio = sharpest();
    pixelRatio = wasSharpest ? maxPixelRatio : Math.min(pixelRatio, maxPixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    if (wasMobile !== mobile) {
      const currentView = state === "intro" ? "overview" : TOUR_STOPS[station].view;
      activeView = currentView;
      applyPose(viewPose(currentView));
    }
  }
  // Phones drop the GPU context when the app goes to the background. Keep the
  // page alive and let three.js rebuild its resources when it comes back.
  let contextLost = false;
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    contextLost = true;
    onMessage("Taking a little nap… the island will be back soon.");
  }, { signal: life.signal });
  canvas.addEventListener("webglcontextrestored", () => {
    contextLost = false;
    last = performance.now();
    onMessage("Welcome back to Petal Isle. ♡");
  }, { signal: life.signal });
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  applyPose(viewPose("overview"));
  resize();

  function projectChoice(choice) {
    if (!choice.geometry.boundingBox) choice.geometry.computeBoundingBox();
    const box = choice.geometry.boundingBox;
    const centerLocal = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const center = choice.localToWorld(centerLocal.clone()).project(camera);
    const left = choice.localToWorld(centerLocal.clone().add(new THREE.Vector3(-size.x * 0.55, 0, 0))).project(camera);
    const right = choice.localToWorld(centerLocal.clone().add(new THREE.Vector3(size.x * 0.55, 0, 0))).project(camera);
    const top = choice.localToWorld(centerLocal.clone().add(new THREE.Vector3(0, size.y * 0.55, 0))).project(camera);
    const bottom = choice.localToWorld(centerLocal.clone().add(new THREE.Vector3(0, -size.y * 0.55, 0))).project(camera);
    return {
      x: (center.x * 0.5 + 0.5) * width,
      y: (center.y * -0.5 + 0.5) * height,
      width: Math.max(58, Math.abs(right.x - left.x) * width),
      height: Math.max(58, Math.abs(top.y - bottom.y) * height),
      visible: center.z > -1 && center.z < 1 && Math.abs(center.x) < 1.05 && Math.abs(center.y) < 1.05,
    };
  }
  function enter() {
    if (state !== "intro") return;
    setState("journey");
    moveTo("question", lowPower ? 2.8 : 4.8, "invitation", () => {
      onTour(0, TOUR_STOPS[0]);
      onMessage("A question is waiting. Choose one of the heart stones.");
    });
  }
  function arrive() {
    transition = null;
    station = 0;
    dodgeCount = 0;
    activeView = "question";
    lookYaw = 0;
    lookPitch = 0;
    applyPose(viewPose("question"));
    setState("invitation");
    onTour(0, TOUR_STOPS[0]);
    onMessage("A question is waiting. Choose one of the heart stones.");
  }
  function restart() {
    clearTimeout(yesTimer);
    clearTimeout(guideTimer);
    putAway();
    island.setDetailDistance(detailCap);
    walker.stop();
    game?.show(false);
    transition = null;
    station = 0;
    dodgeCount = 0;
    noPulse = 0;
    island.noChoice.scale.copy(noChoiceScale);
    island.noChoice.rotation.z = noChoiceRotation;
    island.shrine.reset();
    activeView = "overview";
    lookYaw = 0;
    lookPitch = 0;
    applyPose(viewPose("overview"));
    setState("intro");
    onTour(0, TOUR_STOPS[0]);
  }
  // Yes: a moment to take it in, then straight into your bunny.
  let yesTimer = 0;
  function chooseYes() {
    if (state !== "invitation") return;
    island.shrine.celebrate();
    setState("celebrating");
    onMessage(words.question.yesMessage);
    clearTimeout(yesTimer);
    yesTimer = setTimeout(() => {
      if (state === "celebrating") walk();
    }, 2800);
  }
  function visit(index) {
    putAway();
    station = THREE.MathUtils.clamp(index, 0, TOUR_STOPS.length - 1);
    const stop = TOUR_STOPS[station];
    setState("wandering");
    onTour(station, stop);
    onMessage("Flying…");
    moveTo(stop.view, lowPower ? 1.7 : 2.35, "exploring", () => {
      onTour(station, stop);
      onMessage(stop.message);
    });
  }
  function explore() {
    if (state !== "celebrating") return;
    visit(1);
  }
  function nextStop(direction = 1) {
    if (state !== "exploring") return;
    visit(station + direction);
  }
  function returnToStone() {
    if (!["wandering", "exploring"].includes(state)) return;
    putAway();
    station = 0;
    setState("wandering");
    onTour(0, TOUR_STOPS[0]);
    moveTo("question", lowPower ? 1.7 : 2.35, "celebrating", () => onMessage("Back where the story began."));
  }
  // Edit mode: straight to one of the guided views (from anywhere, walking
  // included), ready to edit what is there.
  function goTo(view) {
    const index = TOUR_STOPS.findIndex((stop) => stop.view === view);
    if (index < 0) return;
    clearTimeout(yesTimer);
    putAway();
    if (state === "walking") {
      walker.stop();
      game?.show(false);
      island.setDetailDistance(detailCap);
    }
    station = index;
    onTour(index, TOUR_STOPS[index]);
    setState("wandering");
    moveTo(view, lowPower ? 1.2 : 1.6, view === "question" ? "invitation" : "exploring");
  }
  // Edit mode opens: which of its screens shows what the visitor is looking
  // at (walking: the garden she is nearest to).
  function screenNow() {
    if (state === "intro") return "intro";
    if (state !== "walking") return TOUR_STOPS[station].view;
    const views = { 1: "question", 2: "activities", 3: "calendar", 4: "map", 5: "keepsake" };
    let best = "question";
    let near = Infinity;
    for (const [k, garden] of Object.entries(layout.data?.gardens ?? {})) {
      const d = Math.hypot(walker.position.x - garden.centre[0], walker.position.z - garden.centre[1]);
      if (views[k] && d < near) {
        near = d;
        best = views[k];
      }
    }
    return best;
  }
  // Edit mode is put away: back to where the visitor really was (the
  // clouds, the question, or walking at the same spot).
  function resume(point = {}) {
    if (point.state === "walking") {
      if (state === "walking") return;
      clearTimeout(yesTimer);
      putAway();
      transition = null;
      island.setDetailDistance(Math.min(detailCap, WALK_DETAIL[quality] ?? Infinity));
      setState("walking");
      walker.start(playData?.spawn ? new THREE.Vector3(...playData.spawn) : undefined);
      const spot = point.spot;
      if (spot) {
        const at = new THREE.Vector3(...spot.position);
        walker.placeAt(at, spot.heading, { cameraFrom: at.clone().add(new THREE.Vector3(Math.sin(spot.yaw), 0, Math.cos(spot.yaw))) });
      }
      game?.show(true);
    } else if (point.state === "invitation") {
      if (state === "invitation") return;
      clearTimeout(yesTimer);
      putAway();
      if (state === "walking") {
        walker.stop();
        game?.show(false);
        island.setDetailDistance(detailCap);
      }
      island.shrine.reset();
      arrive();
    } else if (state !== "intro") restart();
  }
  // Edit mode: the editable words in view, each with the four screen corners
  // (canvas pixels, clockwise from top-left) of the box it is painted in, so
  // it can be edited right there.
  const cornerCache = new Map();
  const projected = new THREE.Vector3();
  const inView = new THREE.Vector3();
  function editTargets() {
    const out = [];
    camera.updateMatrixWorld();
    for (const region of island.editRegions()) {
      const id = `${region.key}|${[region.x, region.y, region.w, region.h].map((v) => v.toFixed(1)).join(",")}`;
      let corners = cornerCache.get(id);
      if (!corners) {
        const { w, h } = region.canvas;
        corners = [[region.x, region.y], [region.x + region.w, region.y], [region.x + region.w, region.y + region.h], [region.x, region.y + region.h]]
          .map(([x, y]) => pointAt(region.mesh, x / w, y / h).point);
        cornerCache.set(id, corners);
        if (cornerCache.size > 300) cornerCache.delete(cornerCache.keys().next().value);
      }
      const quad = [];
      for (const p of corners) {
        if (inView.copy(p).applyMatrix4(camera.matrixWorldInverse).z > -0.05) break; // behind the camera
        projected.copy(p).project(camera);
        quad.push([(projected.x * 0.5 + 0.5) * width, (-projected.y * 0.5 + 0.5) * height]);
      }
      if (quad.length < 4) continue;
      const xs = quad.map((q) => q[0]);
      const ys = quad.map((q) => q[1]);
      if (Math.max(...xs) < 0 || Math.min(...xs) > width || Math.max(...ys) < 0 || Math.min(...ys) > height) continue;
      if (Math.max(...xs) - Math.min(...xs) < 16) continue; // too far off to tap
      const ax = quad[1][0] - quad[0][0], ay = quad[1][1] - quad[0][1], bx = quad[3][0] - quad[0][0], by = quad[3][1] - quad[0][1];
      if (ax * by - ay * bx <= 0) continue; // seen from behind
      out.push({
        key: region.key, path: region.path, kind: region.kind || "text", has: Boolean(region.has),
        multiline: Boolean(region.multiline), wrap: Boolean(region.wrap), align: region.align || "center", quad,
        box: { w: region.w, h: region.h }, font: region.font, lineHeight: region.lineHeight, color: region.color,
      });
    }
    return out;
  }
  function recenter() {
    transition = null;
    const name = state === "intro" ? "overview" : TOUR_STOPS[station].view;
    activeView = name;
    lookYaw = 0;
    lookPitch = 0;
    canvas.parentElement?.style.setProperty("--sky-x", "50%");
    applyPose(viewPose(name));
  }
  function dodge() {
    if (state !== "invitation" || performance.now() - dodgeAt < 430) return;
    dodgeAt = performance.now();
    dodgeCount += 1;
    noPulse = 1;
    if (dodgeCount === 1) onMessage(words.question.noMessage);
    else if (dodgeCount === 3) onMessage("The “Yes” heart is still waiting. ♡");
  }
  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointerPixel.x = event.clientX - rect.left;
    pointerPixel.y = event.clientY - rect.top;
    pointer.set((pointerPixel.x / width) * 2 - 1, 1 - (pointerPixel.y / height) * 2);
  }
  // While walking on a phone, distant flowers are skipped (the guided views
  // look at the whole island from afar, so they keep everything).
  const WALK_DETAIL = { low: 22, medium: 32, high: Infinity };
  function walk() {
    if (!["celebrating", "exploring"].includes(state)) return;
    putAway();
    transition = null;
    island.setDetailDistance(Math.min(detailCap, WALK_DETAIL[quality] ?? Infinity));
    setState("walking");
    walker.start(playData?.spawn ? new THREE.Vector3(...playData.spawn) : undefined);
    game?.show(true);
  }
  function stopWalk() {
    if (state !== "walking") return;
    putAway();
    island.setDetailDistance(detailCap);
    walker.stop();
    game?.show(false);
    camera.fov = viewPose("question").fov;
    camera.updateProjectionMatrix();
    station = 0;
    onTour(0, TOUR_STOPS[0]);
    moveTo("question", lowPower ? 1.7 : 2.35, "celebrating", () => onMessage("Back where the story began."));
  }
  function pointerDown(event) {
    if (event.button !== 0) return;
    updatePointer(event);
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startYaw: lookYaw,
      startPitch: lookPitch,
      moved: false,
    };
    canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    updatePointer(event);
    if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.moved ||= Math.hypot(dx, dy) > 5;
      if (drag.moved && state === "walking") {
        walker.drag(event.clientX - (drag.lastX ?? drag.x), event.clientY - (drag.lastY ?? drag.y));
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
      } else if (drag.moved && !transition && !celebration.active && !chooser.active) {
        lookYaw = THREE.MathUtils.clamp(drag.startYaw - dx * 0.0028, -0.62, 0.62);
        lookPitch = THREE.MathUtils.clamp(drag.startPitch - dy * 0.0022, -0.34, 0.34);
        camera.quaternion.copy(viewPose(activeView).quaternion);
        canvas.parentElement?.style.setProperty("--sky-x", `${50 + THREE.MathUtils.radToDeg(lookYaw) * 0.18}%`);
      }
    }
  }
  function pointerUp() {
    if (drag && !drag.moved) {
      raycaster.setFromCamera(pointer, camera);
      if (state === "invitation") {
        if (raycaster.intersectObject(island.noChoice, true).length) dodge();
        else if (raycaster.intersectObject(island.yesChoice, true).length) chooseYes();
      } else if (state === "exploring" || state === "walking") {
        const hit = raycaster.intersectObjects(island.slots, false)[0] || null;
        if (celebration.active) celebration.skip();
        else if (ballroom?.active) ballroom.skip();
        else if (chooser.active) chooser.tap(hit);
        else if (hit && state === "walking" && hit.point.distanceTo(walker.position) >= 4.5) onMessage("Come a little closer to open it.");
        else if (hit && !chooser.open(hit.object) && !celebration.start(hit.object)) onSlot(hit.object.name, hit.object.userData.content);
      }
    }
    if (state === "walking") walker.endDrag();
    drag = null;
  }
  const eventOptions = { signal: life.signal };
  canvas.addEventListener("pointerdown", pointerDown, eventOptions);
  window.addEventListener("pointermove", pointerMove, eventOptions);
  canvas.addEventListener("pointerup", pointerUp, eventOptions);
  canvas.addEventListener("pointercancel", () => { drag = null; }, eventOptions);

  // Frame governor: if the device struggles, lower the render resolution in
  // small steps down to a floor that still looks sharp (1.5 on high-density
  // screens), then cap to 30 fps, and only then go softer. Frames count as
  // slow against the screen's own pace, so a phone holding pages to 30 fps to
  // save battery doesn't lose sharpness for nothing.
  let frameCap = 0, slowTime = 0, fastTime = 0;
  // How far away flowers are still drawn, if the device needed it trimmed.
  let detailCap = Infinity;
  function setDetailCap(value) {
    detailCap = value;
    island.setDetailDistance(Math.min(detailCap, state === "walking" ? WALK_DETAIL[quality] ?? Infinity : Infinity));
  }
  let pace = 1 / 60; // the screen's frame interval: follows shorter frames at once, longer ones slowly
  function setPixelRatio(value) {
    pixelRatio = value;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
  }
  function governFrameRate(dt) {
    if (document.hidden || dt > 0.6) return; // ignore tab switches, not slow frames
    pace += (dt - pace) * (dt < pace ? 0.25 : 0.02);
    const budget = frameCap ? 1 / 26 : Math.max(1 / 50, pace * 1.5);
    if (dt > budget) { slowTime += dt; fastTime = 0; } else { fastTime += dt; slowTime = Math.max(0, slowTime - dt * 0.5); }
    if (slowTime > 1.5) {
      slowTime = 0;
      const floor = Math.min(maxPixelRatio, devicePixelRatio >= 2 ? 1.5 : 1);
      if (pixelRatio > floor + 0.01) setPixelRatio(Math.max(floor, pixelRatio - 0.25));
      else if (!frameCap) frameCap = 30;
      else if (detailCap > 22) setDetailCap(detailCap === Infinity ? 32 : 22); // fewer far-off flowers
      else if (pixelRatio > 1.01) setPixelRatio(Math.max(1, pixelRatio - 0.25));
    } else if (fastTime > 6 && pixelRatio < maxPixelRatio && !frameCap) {
      fastTime = 0;
      setPixelRatio(Math.min(maxPixelRatio, pixelRatio + 0.25));
    }
  }
  // Telescope "scope view": the zoomed lens view is rendered into a small
  // target and shown as a round brass-rimmed window in the corner.
  let scopeKit = null;
  function renderScope() {
    if (!scopeKit) {
      const size = quality === "low" ? 384 : 512; // crisp on a phone's sharper picture
      const target = new THREE.WebGLRenderTarget(size, size, { colorSpace: THREE.SRGBColorSpace });
      const lens = new THREE.PerspectiveCamera(13, 1, 1.2, 600); // near clip starts past the end of the tube
      const overlayScene = new THREE.Scene();
      const overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: target.texture, toneMapped: false }));
      const rim = new THREE.Mesh(new THREE.RingGeometry(1, 1.09, 48), new THREE.MeshBasicMaterial({ color: "#e2b866", toneMapped: false }));
      const shade = new THREE.Mesh(new THREE.RingGeometry(0.82, 1.0, 48), new THREE.MeshBasicMaterial({ color: "#1c1424", transparent: true, opacity: 0.35, toneMapped: false }));
      overlayScene.add(disc, shade, rim);
      scopeKit = { target, lens, overlayScene, overlayCamera, group: [disc, shade, rim] };
    }
    const { target, lens, overlayScene, overlayCamera, group } = scopeKit;
    const eye = game.scopeView.eye(new THREE.Vector3());
    const dir = game.scopeView.direction(new THREE.Vector3());
    lens.position.copy(eye);
    lens.lookAt(eye.clone().add(dir));
    renderer.setRenderTarget(target);
    renderer.render(scene, lens);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    // Place the round window in the top-right corner, sized to the screen.
    const aspect = width / height;
    overlayCamera.left = -aspect;
    overlayCamera.right = aspect;
    overlayCamera.updateProjectionMatrix();
    const radius = Math.min(0.36, aspect * 0.34);
    for (const mesh of group) {
      mesh.scale.setScalar(radius);
      mesh.position.set(aspect - radius - 0.08, 0.62 - radius * 0.2, 0);
    }
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(overlayScene, overlayCamera);
    renderer.autoClear = true;
  }
  function animate(now) {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    if (contextLost) return;
    if (frameCap && now - lastRender < 1000 / frameCap - 2) return;
    lastRender = now;
    const wallDt = (now - last) / 1000;
    governFrameRate(wallDt);
    const realDt = Math.min(wallDt, 0.1);
    last = now;
    const active = !motionPaused && !document.hidden;
    const dt = active ? realDt : 0;
    elapsed += dt;
    if (transition && active) {
      transition.elapsed = Math.min(transition.duration, transition.elapsed + wallDt);
      const amount = ease(transition.elapsed / transition.duration);
      camera.position.lerpVectors(transition.from.position, transition.target.position, amount);
      camera.quaternion.slerpQuaternions(transition.from.quaternion, transition.target.quaternion, amount);
      camera.fov = THREE.MathUtils.lerp(transition.from.fov, transition.target.fov, amount);
      camera.updateProjectionMatrix();
      if (transition.elapsed >= transition.duration) {
        const completed = transition;
        transition = null;
        setState(completed.nextState);
        completed.done?.();
      }
    }
    island.update(elapsed, dt, state === "celebrating");
    island.cull(camera);
    boardLamps.update(elapsed);
    // Moving props first (the balloon carries the bunny), then the bunny.
    extras.update(elapsed, realDt);
    if (state === "walking") {
      walker.update(elapsed, realDt);
      game?.update(elapsed, realDt);
    }
    animals?.update(elapsed, dt, walker.active ? walker.position : null);
    chooser.update(realDt);
    celebration.update(elapsed, realDt);
    couple.update(elapsed, realDt, {
      on: danced, walking: state === "walking" && walker.active, rain: env.weights.rain,
      busy: chooser.active || celebration.active || Boolean(ballroom?.active) || Boolean(host.presenting),
    });
    const feet = state === "walking" && walker.active ? walker.position : null;
    gate?.update(realDt, feet);
    chimes?.update(realDt, feet);
    if (gate && !through && feet && feet.z < gate.centre.z - 1.2) {
      through = true;
      try {
        localStorage.setItem("petal-isle-through", "1");
      } catch {
        // Kept for this visit.
      }
    }
    ballroom?.update(elapsed, realDt);
    trail.update(elapsed, realDt, {
      active: state === "walking" && walker.active && !chooser.active && !celebration.active && !ballroom?.active && !walker.sitting,
      you: walker.position, camera,
    });
    host.update(elapsed, realDt, { camera });
    fx.update(realDt, camera);
    env.update(camera, elapsed, dt, walker.active ? walker.position : null);
    lens?.update(dt, env.weights.rain);
    walker.setWeather(env.weights.rain, env.weights.snow);
    host.setWeather(env.weights.rain, env.weights.snow);
    noPulse = Math.max(0, noPulse - dt * 2.5);
    island.noChoice.scale.copy(noChoiceScale).multiplyScalar(1 + Math.sin(noPulse * Math.PI * 5) * noPulse * 0.055);
    island.noChoice.rotation.z = noChoiceRotation + Math.sin(noPulse * Math.PI * 7) * noPulse * 0.1;
    camera.updateMatrixWorld();
    const yes = projectChoice(island.yesChoice), no = projectChoice(island.noChoice);
    onProject(yes, no);
    let nextHover = null;
    if ((state === "exploring" || state === "walking") && !drag) {
      raycaster.setFromCamera(pointer, camera);
      nextHover = raycaster.intersectObjects(island.slots, false)[0]?.object || null;
    }
    if (nextHover !== hoveredSlot) {
      hoveredSlot = nextHover;
      canvas.style.cursor = hoveredSlot ? "pointer" : "grab";
    }
    const shown = chooser.candidateSlot;
    for (const slot of island.slots) {
      if (!slot.material?.emissive) continue;
      slot.material.emissiveIntensity = celebration.glow(slot, elapsed)
        ?? (slot === shown ? 0.3 + Math.sin(elapsed * 5) * 0.08 : slot === hoveredSlot ? 0.22 : 0.04);
    }
    if (game?.scopeView?.active) renderScope();
    else renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  if (new URLSearchParams(location.search).has("debug")) {
    window.__grove = { THREE, scene, camera, renderer, island, walker, extras, env, fx, settings, animals, host, chooser, celebration, trail, ballroom, lens, gate, chimes, layout, couple, get game() { return game; }, quality, get pixelRatio() { return pixelRatio; }, get frameCap() { return frameCap; } };
  }
  return {
    enter, arrive, restart, recenter, chooseYes, explore, nextStop, returnToStone, walk, stopWalk,
    nudge() {}, dodge,
    // How far the walk has come: each stop of the trail, done or not.
    progress: () => ({
      activity: Boolean(selectionsNow.activity), calendar: Boolean(selectionsNow.date), place: Boolean(selectionsNow.place),
      book: danced, gate: through || !gate,
    }),
    pause(value) { motionPaused = value; },
    setContent(next) { words = next; island.setContent(next); },
    // Edit mode: new words at `path`, redrawn where they show; where the
    // editable words are on screen; the guided views; who you play.
    preview(next, path) { words = next; island.preview(next, path); },
    editTargets,
    goTo,
    screenNow,
    resume,
    // Where she walks just now (for resume).
    walkSpot: () => ({ position: walker.position.toArray(), heading: walker.heading, yaw: walker.yaw }),
    chooseCharacter() { game?.chooseCharacter(); },
    setSelections(next) {
      selectionsNow = next;
      island.setSelections(next);
    },
    environment: env,
    quality,
    // While walking: the map, a photo and the character, for the ⚙ sheet.
    extras: () => (state === "walking" && game ? game.extras() : []),
    // How near the water you are (0..1) and which side it is on (-1..1); the
    // same for the Music Isle's gramophone, and whether you are dancing.
    soundscape() {
      const ear = state === "walking" ? walker.position : camera.position;
      const tune = ballroom?.presence(ear) ?? { level: 0, pan: 0 };
      const music = { gramophone: tune.level, gramophonePan: tune.pan, dancing: Boolean(ballroom?.active) };
      let best = Infinity;
      let near = null;
      for (const p of waterPoints) {
        const d = p.distanceToSquared(ear);
        if (d < best) {
          best = d;
          near = p;
        }
      }
      if (!near) return { water: 0, waterPan: 0, ...music };
      const m = camera.matrixWorld.elements;
      const dx = near.x - m[12];
      const dz = near.z - m[14];
      return {
        water: THREE.MathUtils.clamp(1 - (Math.sqrt(best) - 1.5) / 12, 0, 1) ** 1.5,
        waterPan: (dx * m[0] + dz * m[2]) / (Math.hypot(dx, dz) || 1),
        ...music,
      };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      life.abort();
      resizeObserver.disconnect();
      unsubscribeSettings();
      lens?.dispose();
      boardLamps.dispose();
      island.dispose();
      env.dispose();
      walker.dispose();
      game?.dispose();
      animals?.dispose();
      clearTimeout(yesTimer);
      clearTimeout(guideTimer);
      trail.dispose();
      gate?.dispose();
      chimes?.dispose();
      ballroom?.dispose();
      celebration.dispose();
      couple.dispose();
      host.dispose();
      fx.dispose();
      if (scopeKit) {
        scopeKit.target.dispose();
        scopeKit.group.forEach((mesh) => { mesh.geometry.dispose(); mesh.material.dispose(); });
      }
      extras.dispose();
      renderer.dispose();
    },
  };
}
