import './styles.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { Renderer } from './core/renderer.js';
import { loadAll, assets } from './core/assets.js';
import { StylizedSky } from './world/skyStylized.js';
import { createForest } from './world/forest.js';
import { createGround } from './world/ground.js';
import { Grass } from './world/grass.js';
import { createFlora } from './world/flora.js';
import { createPicnic } from './world/picnic.js';
import { wind } from './world/wind.js';
import { exclude, POST_A, POST_B, TREE_HOOKS, PHOTO_LINE, BALLOON_ANCHOR } from './world/layout.js';
import { heightAt } from './world/terrain.js';
import { content } from './content.js';
import { Cake } from './objects/cake.js';
import { Letter } from './objects/letter.js';
import { Balloons } from './objects/balloons.js';
import { CrystalBall, StarWriting } from './objects/magic.js';
import { InstantCamera } from './objects/instantCamera.js';
import { WishJar } from './objects/jar.js';
import { PhotoLine, loadPhotos, loadImage } from './objects/photos.js';
import { DeskCalendar } from './objects/calendar.js';
import { CassettePlayer } from './objects/cassette.js';
import { EveningLights } from './objects/lights.js';
import { Fireworks } from './fx/fireworks.js';
import { Confetti, Fireflies, MusicNotes, Sparkles } from './fx/effects.js';
import { AudioEngine } from './audio/audio.js';
import { TubePlayer } from './audio/tube.js';
import { UI } from './ui/ui.js';
import { Director } from './story/director.js';
import { Story } from './story/story.js';
import { placeholderPhoto } from './util/textures.js';
import { Presenter } from './util/present.js';
import { ModeRepository, selectMode } from './share/repository.js';
import { CardEditor } from './share/editor.js';
import { getPath } from './share/content-core.js';

const params = new URLSearchParams(location.search);
// every letter the textures and the story picture will need
const FONT_SAMPLE = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ${JSON.stringify(content)}`.slice(0, 4000);
const DEBUG = params.has('debug');

// phones: no pinch / double-tap zoom on the card (Safari ignores the viewport's maximum-scale)
for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
const S = THREE.MathUtils.smoothstep;

const canvas = document.getElementById('scene');
const loaderEl = document.getElementById('loader');
const pctEl = loaderEl.querySelector('.loader-pct');
const barEl = loaderEl.querySelector('.bar');
const loaderText = loaderEl.querySelector('.loader-text');

function setProgress(p) {
  const v = Math.round(p * 92);
  pctEl.textContent = `${v}%`;
  barEl.style.strokeDashoffset = String(327 * (1 - v / 100));
}

function webglOK() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch { return false; }
}

async function boot() {
  if (!webglOK()) {
    loaderText.textContent = 'This picnic needs a browser with WebGL 2. Please use Chrome, Edge, Firefox or Safari.';
    return;
  }
  const R = new Renderer(canvas);
  const { scene, camera } = R;
  const ui = new UI(content);
  // the card's content: the studio draft (after its password), the local demo, or a saved link
  const repo = new ModeRepository(selectMode(location.search));
  const editor = new CardEditor({ repo, content });
  editor.toast = (m) => ui.toast(m);
  const contentReady = editor.boot();
  await Promise.all([
    contentReady,
    loadAll(setProgress),
    // font subsets load on demand: ask for them with the real text before painting textures
    ...['500 30px Caveat', '700 30px Caveat']
      .map((f) => document.fonts.load(f, FONT_SAMPLE).catch(() => {})),
  ]);
  if (!await contentReady) { loaderEl.remove(); return; }   // link unavailable: the gate says so
  ui._fillIntro();
  loaderText.textContent = 'Lighting the candles…';
  // crisp textures at grazing angles (tablecloth, table, labels): full anisotropic filtering
  const maxAniso = R.renderer.capabilities.getMaxAnisotropy();
  for (const root of Object.values(assets.models)) {
    root.traverse((n) => {
      if (!n.isMesh) return;
      for (const m of [].concat(n.material)) for (const k of ['map', 'normalMap', 'emissiveMap']) if (m?.[k]) m[k].anisotropy = maxAniso;
    });
  }

  // ── world: painted twilight sky (no HDRI), storybook meadow, Blender forest ──
  const sky = new StylizedSky(R.renderer, scene);
  const sunUniforms = { uSunDir: { value: sky.sunDir.clone() }, uSunColor: { value: new THREE.Color(1.0, 0.82, 0.62) } };
  createGround(scene);
  const grass = new Grass(scene, { exclude: (x, z) => exclude(x, z), sunDir: sunUniforms.uSunDir.value, sunColor: sunUniforms.uSunColor.value });
  const picnic = createPicnic(scene);
  const flora = createFlora(scene);
  const forest = createForest(scene, { exclude });
  const A = picnic.anchors;

  // ── chapter objects ──
  const url = (name) => repo.mediaURL(name);
  const photos = await loadPhotos(content.photos, url);
  const cover = await loadCover(content.song.cover, photos, url);
  const postTop = (p, dy = 0) => new THREE.Vector3(p.x, heightAt(p.x, p.z) + p.h + dy, p.z);
  const presenter = new Presenter(camera);
  const o = {
    cake: new Cake(picnic.group, A.cake),
    letter: new Letter(picnic.group, A.letter, content, presenter),
    balloons: new Balloons(scene, BALLOON_ANCHOR),
    crystal: new CrystalBall(picnic.group, A.crystal),
    stars: new StarWriting(scene, content.name),
    jar: new WishJar(picnic.group, A.jar),
    photos: new PhotoLine(scene, new THREE.Vector3(PHOTO_LINE.x + 0.06, PHOTO_LINE.y, POST_B.z - 0.06), new THREE.Vector3(PHOTO_LINE.x + 0.06, PHOTO_LINE.y, POST_A.z + 0.06), photos),
    instant: new InstantCamera(picnic.group, A.instant),
    calendar: new DeskCalendar(picnic.group, A.calendar, content.date.iso, content.date.label),
    cassette: new CassettePlayer(picnic.group, A.cassette, { image: cover }),
    lights: new EveningLights(scene, [
      { a: postTop(POST_B, -0.05), b: postTop(POST_A, -0.05), sag: 0.32, bulbs: 30 },
      { a: postTop(POST_B, -0.05), b: TREE_HOOKS[0], sag: 0.45, bulbs: 14 },
      { a: TREE_HOOKS[1], b: postTop(POST_A, -0.05), sag: 0.5, bulbs: 14 },
      { a: TREE_HOOKS[0], b: TREE_HOOKS[1], sag: 0.22, bulbs: 9 },
    ]),
    confetti: new Confetti(scene),
    sparkles: new Sparkles(scene),
    notes: new MusicNotes(scene),
  };
  o.notes.origin.copy(o.cassette.focusPoint);
  const fireflies = new Fireflies(scene);

  // camera flash light (always present so the shader light count never changes)
  const flashLight = new THREE.PointLight(0xffffff, 0, 6, 2);
  flashLight.position.copy(o.instant.focusPoint).add(new THREE.Vector3(0.1, 0.15, 0));
  scene.add(flashLight);

  const audio = new AudioEngine();
  const fireworks = new Fireworks(scene, camera, {
    onBurst: ({ position, color, distance, type }) => {
      const p = position.clone().project(camera);
      audio.firework({ distance, pan: p.x, big: type === 'crossette' || type === 'heart' });
      fwColor.copy(color);
    },
  });
  o.fireworks = fireworks;
  fireworks.pixelRatio = () => R.renderer.getPixelRatio();   // spark size follows the live resolution
  const fwColor = new THREE.Color(1, 0.8, 0.6);

  // ── quality ──
  R.onQuality = (L) => grass.setDensity(L.grass);
  if (params.has('q')) { R.level = Math.min(+params.get('q'), R.levels.length - 1); R.monitor = () => {}; }
  if (params.has('dpr')) R.forceDpr = +params.get('dpr');
  R.applyLevel(sky.sun);

  // ── story ──
  const director = new Director(camera, R.dof);
  // render the scene from another viewpoint (the instant camera's lens) into a square image
  let captureReq = null;
  const capture = (pose, fov = 50, size = 1024) => new Promise((resolve) => { captureReq = { pose, fov, size, resolve }; });
  const tube = new TubePlayer({ onEnd: () => story.stopSong(), onFail: () => ui.toast('This YouTube song cannot be played here.') });
  const story = new Story({ director, ui, audio, sky, wind, o, content, presenter, capture, tube, mediaURL: url });
  // edits repaint the 3D things that show them (envelope, letter page, stars, polaroids, calendar)
  editor.story = story;
  editor.letterBlank = (b) => o.letter.setBlank(b);
  editor.calendarBlank = (b) => o.calendar.setLabelHidden(b);
  editor.apply = (paths) => {
    let letter = false;
    for (const p of paths) {
      if (p === 'name') { letter = true; o.stars.setName(content.name); }
      else if (p.startsWith('letter.') || p === 'from') letter = true;
      else if (/^photos\.\d+\.caption$/.test(p)) o.photos.setCaption(+p.split('.')[1], getPath(content, p));
      else if (p === 'date.iso') o.calendar.setDate(content.date.iso);
      else if (p === 'date.label') o.calendar.setLabel(content.date.label);
      else if (/^photos\.\d+\.src$/.test(p)) {
        const i = +p.split('.')[1];
        loadImage(url(content.photos[i].src)).then((img) => {
          o.photos.setPhoto(i, img, content.photos[i].src);
          if (content.song.cover === i) loadCover(i, o.photos.images, url).then((im) => o.cassette.setImage(im));
        });
      } else if (p === 'song.cover') loadCover(content.song.cover, o.photos.images, url).then((im) => o.cassette.setImage(im));
      else if (p === 'song.youtube' && story.current?.id === 'song') { story.stopSong(); story.refreshCard(); }
      else if (p === 'song.voice' && story.current?.id === 'song') { story.stopSong(); story.refreshCard(); }
    }
    if (letter) o.letter.setContent(content);
    story._storyFile = null;   // the story picture is drawn again with the new words
  };
  story.flashLight = (p, k = 30) => { if (p) flashLight.position.copy(p).add(new THREE.Vector3(-0.15, 0.08, 0)); flashLight.intensity = k; };
  ui.setupNav(story.chapters, { onPrev: () => story.prev(), onNext: () => story.next(), onJump: (i) => story.goTo(i) });
  ui.el.sound.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    tube.setMuted(audio.muted);
    ui.el.sound.textContent = audio.muted ? '🔇' : '🔊';
    ui.el.sound.setAttribute('aria-pressed', String(audio.muted));
    ui.el.sound.setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
  });
  story.startIntro();
  if (params.has('cam')) {
    const v = params.get('cam').split(',').map(Number);
    director.cut({ pos: new THREE.Vector3(v[0], v[1], v[2]), target: new THREE.Vector3(v[3], v[4], v[5]), fov: v[6] || 40 });
  }

  // ── picking 3D objects ──
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (e) => {
    const ch = story.current;
    if (!ch) return null;
    const targets = ch.hits();
    if (!targets.length) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(targets, true)[0] || null;
  };
  canvas.addEventListener('pointermove', (e) => { canvas.style.cursor = pick(e) ? 'pointer' : ''; }, { passive: true });
  canvas.addEventListener('click', (e) => {
    const hit = pick(e);
    if (hit) story.current.onHit?.(hit.object);
  });

  // pre-compile every shader so nothing hitches later
  director.update(0, 0.016);
  // compile EVERY shader now — including things that start hidden (sparkles, star writing, confetti,
  // the instant photo, firework bursts) — so nothing stalls a frame the first time it appears
  const hidden = [];
  scene.traverse((n) => { if (!n.visible) { hidden.push(n); n.visible = true; } });
  const warmers = fireworks.warmers();
  scene.add(...warmers);
  await R.renderer.compileAsync(scene, camera);
  scene.remove(...warmers);
  for (const n of hidden) n.visible = false;
  setProgress(1); pctEl.textContent = '100%';

  if (DEBUG) {
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
    const controls = new OrbitControls(camera, canvas);
    controls.enabled = params.has('orbit');
    window.__app = { R, scene, camera, sky, grass, picnic, flora, forest, wind, story, director, o, audio, ui, presenter, editor, THREE, controls };
    // debug: save the current frame (canvas only) to art/snaps/<name>.jpg via the dev server
    window.__snap = (name) => { R.render(0.016); return fetch('/__snap', { method: 'POST', body: JSON.stringify({ name, data: canvas.toDataURL('image/jpeg', 0.88) }) }).then((r) => r.text()); };
  }

  // ── loop ──
  // GSAP is ticked from the render loop: tweens and rendering always land on the same frame.
  gsap.ticker.remove(gsap.updateRoot);
  const timer = new THREE.Timer();
  timer.connect(document);
  let lastTod = -1;
  let shadowFrame = 0;
  sky.sun.shadow.autoUpdate = false;
  let lastTs = 0;
  const frame = (ts) => {
    lastTs = ts;
    timer.update(ts);
    const dt = Math.max(0, Math.min(timer.getDelta(), 1 / 15));
    const t = timer.getElapsed();
    gsap.updateRoot(t);

    wind.update(t, dt);
    const tod = story.timeOfDay.v;
    if (Math.abs(tod - lastTod) > 0.002) { sky.setTime(tod); lastTod = tod; }
    const dusk = S(tod, 0.4, 1.0);
    sky.update(t, camera);

    if (story.viewfinder) {
      // looking through the instant camera: the frame's square shows exactly what the photo will be
      const pose = story.viewfinder.pose();
      camera.position.copy(pose.pos);
      camera.quaternion.copy(pose.quat);
      const half = THREE.MathUtils.degToRad(story.viewfinder.fov) / 2;
      const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) * innerHeight / ui.viewfinderSize()));
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    } else if (!(DEBUG && params.has('orbit'))) director.update(t, dt);
    presenter.update();
    if (editor.editing) {
      const W = innerWidth, H = ui.stageHeight(), ch = story.current?.id;
      // editing the song: the tape goes into the walkman first, so its picture and buttons sit on the walkman
      if (ch === 'song' && !o.cassette.loaded && !document.body.classList.contains('moving')) o.cassette.load();
      // tap-to-add-a-photo spots over the polaroids (moments) and the cassette label (song)
      const spots = ch === 'moments' ? o.photos.spots(camera, W, H)
        : ch === 'song' ? [{ key: 'cover', path: 'song.cover', slot: -1, rect: o.cassette.labelRect(camera, W, H), filled: typeof content.song.cover === 'string' && !!content.song.cover }].filter((s) => s.rect) : [];
      editor.frame(o.letter.screenRect(camera, W, H), ch === 'date' ? o.calendar.labelRect(camera, W, H) : null, spots);
    }
    // never look out from inside the instant camera (its dark outline would fill the screen)
    o.instant.model.visible = !story.viewfinder && camera.position.distanceTo(o.instant.focusPoint) > 0.17;
    ui.place(camera, { chapter: story.labelAnchor(), intro: story.introLabel }, dt);
    story.update(dt);
    o.cake.update(t, dt, wind.uniforms.uWindStrength.value);
    o.balloons.update(t, dt);
    o.jar.update(t, dt, camera, dusk);
    o.photos.update(t);
    o.cassette.update(t, dt);
    o.crystal.update(t, R.renderer, camera);
    o.stars.update(t, dt, R.renderer, camera);
    o.lights.setLevel(1);
    o.lights.update(t);
    o.confetti.update(t, dt);
    o.sparkles.update(t, dt, R.renderer, camera);
    o.notes.update(t, dt);
    fireworks.update(dt);
    fireflies.update(t, dt, camera, 0.6 + 0.4 * dusk);
    // fireworks light up the meadow
    sky.hemi.color.copy(sky.hemiBaseColor).lerp(fwColor, Math.min(1, fireworks.flash * 0.6));
    sky.hemi.intensity = sky.hemiBase + fireworks.flash * 0.8;
    flashLight.intensity *= Math.exp(-dt * 9);
    audio.update(wind.gust, 0.55 + 0.45 * tod);

    // shadows refresh every 2nd frame (every 3rd-4th on phones): leaves still dapple, at a fraction of the cost
    shadowFrame = (shadowFrame + 1) % (R.levels[R.level].shadowEvery || 2);
    // (always render it when missing — a shader sampling an absent shadow map is a GL error)
    sky.sun.shadow.needsUpdate = !sky.sun.shadow.map || (shadowFrame === 0 && sky.sun.intensity > 0.05);
    R.render(dt);
    if (captureReq) {
      const { pose, fov, size, resolve } = captureReq; captureReq = null;
      resolve(renderFrom(pose, fov, size));
    }
    R.monitor(dt, t, sky.sun);
  };
  // The photo: one extra frame through the full post stack from `pose`, rendered square at `size`
  // pixels (HD, independent of the screen), then the normal view again — all inside one frame.
  function renderFrom(pose, fovDeg, size) {
    const r = R.renderer;
    const saved = { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov, aspect: camera.aspect, dpr: r.getPixelRatio() };
    const px = size / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    const savedStarsPx = o.stars.uniforms.uPx.value, savedPR = fireworks.pixelRatio;
    o.instant.model.visible = false;
    r.setPixelRatio(1); r.setSize(size, size, false); R.composer.setSize(size, size, false);
    camera.position.copy(pose.pos); camera.quaternion.copy(pose.quat);
    camera.fov = fovDeg; camera.aspect = 1;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    o.stars.uniforms.uPx.value = px;                         // sparkles keep their on-screen size
    fireworks.pixelRatio = () => size / innerHeight;
    R.composer.render(0);
    const out = document.createElement('canvas'); out.width = out.height = size;
    out.getContext('2d').drawImage(canvas, 0, 0, size, size);
    // back to the screen
    o.stars.uniforms.uPx.value = savedStarsPx; fireworks.pixelRatio = savedPR;
    o.instant.model.visible = true;
    camera.position.copy(saved.pos); camera.quaternion.copy(saved.quat); camera.fov = saved.fov; camera.aspect = saved.aspect;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    R._w = undefined; R._applySize();
    R.render(0);
    return out;
  }
  R.renderer.setAnimationLoop(frame);
  // debug: step the loop by hand (a background tab gets no animation frames)
  // (continues from the last frame's timestamp, so a pause between calls doesn't jump the clock)
  // (the timer normally pauses while the page is hidden; stepping by hand ignores that)
  if (DEBUG) window.__frame = (n = 1, ms = 16.7) => { timer.disconnect?.(); for (let i = 0; i < n; i++) frame(lastTs + ms); };

  // ── reveal ──
  loaderEl.classList.add('done');
  setTimeout(() => loaderEl.remove(), 1000);
  ui.showIntro(async () => {
    try { await audio.init(); } catch (e) { console.warn('audio init failed', e); }
    ui.hideIntro();
    audio.sparkle();
    o.confetti.burst(new THREE.Vector3(0.2, 0.85, 0.3), 1.1);
    setTimeout(() => story.goTo(0), 900);
  });
  if (params.has('ch')) { await audio.init().catch(() => {}); ui.hideIntro(); story.goTo(+params.get('ch')); }
}

/** The image for the cassette label: one of the photos (by index) or its own uploaded picture. */
async function loadCover(cover, photos, url) {
  if (typeof cover === 'string' && cover) {
    const img = await loadImage(url(cover));
    if (img) return img;
  }
  const i = typeof cover === 'number' ? cover : 0;
  const p = photos[i] || photos[0];
  // a painted placeholder carries its caption; on the cassette just the picture reads better
  return p.src ? p.image : placeholderPhoto(i, '');
}

boot().catch((e) => {
  console.error(e);
  loaderText.textContent = 'Something went wrong preparing the picnic. Please reload the page.';
});
