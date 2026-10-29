import './styles.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { Renderer } from './core/renderer.js';
import { loadAll } from './core/assets.js';
import { createCourtyard, LAYOUT, FOOTLOCKER_TOP, SNIPER_TARGET } from './world/courtyard.js';
import { content } from './content.js';
import { Cake } from './objects/cake.js';
import { Letter } from './objects/letter.js';
import { Spray } from './objects/spray.js';
import { LootCase } from './objects/lootcase.js';
import { PhotoBoard } from './objects/board.js';
import { loadPhotos, loadImage } from './objects/photos.js';
import { PartyCharge } from './objects/charge.js';
import { FieldRadio } from './objects/radio.js';
import { MvpCard } from './objects/mvp.js';
import { Sniper } from './objects/sniper.js';
import { Fireworks } from './fx/fireworks.js';
import { GrenadeShow } from './fx/grenades.js';
import { Confetti, Sparkles } from './fx/effects.js';
import { AudioEngine } from './audio/audio.js';
import { TubePlayer } from './audio/tube.js';
import { UI } from './ui/ui.js';
import { Director } from './story/director.js';
import { Story } from './story/story.js';
import { Presenter } from './util/present.js';
import { ModeRepository, selectMode } from './share/repository.js';
import { CardEditor } from './share/editor.js';
import { getPath } from './share/content-core.js';
import { loadLicensedFonts } from './licensedFonts.js';

const params = new URLSearchParams(location.search);
// every letter the textures and the story picture will need
const FONT_SAMPLE = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ${JSON.stringify(content)}`.slice(0, 4000);
const DEBUG = params.has('debug');

for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });

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
    loaderText.textContent = 'This needs a browser with WebGL 2. Please use Chrome, Edge, Firefox or Safari.';
    return;
  }
  const R = new Renderer(canvas);
  const { scene, camera } = R;
  const ui = new UI(content);
  const repo = new ModeRepository(selectMode(location.search));
  const editor = new CardEditor({ repo, content });
  editor.toast = (m) => ui.toast(m);
  const contentReady = editor.boot();
  await Promise.all([
    contentReady,
    loadAll(setProgress),
    loadLicensedFonts(),
    ...["400 30px 'Cousine'", "700 30px 'Cousine'", "700 30px 'Oswald'", "600 30px 'Oswald'", "500 30px 'Oswald'", "400 30px 'Black Ops One'", "400 30px 'Rubik'", "500 30px 'Rubik'", "800 30px 'Rubik'", "500 30px 'Roboto Mono'", "700 30px 'Caveat'"]
      .map((f) => document.fonts.load(f, FONT_SAMPLE).catch(() => {})),
  ]);
  if (!await contentReady) { loaderEl.remove(); return; }
  ui._fillIntro();
  loaderText.textContent = 'Preparing the base…';
  const maxAniso = R.renderer.capabilities.getMaxAnisotropy();

  // ── the courtyard ──
  const yard = createCourtyard(scene);
  const url = (name) => repo.mediaURL(name);
  const photos = await loadPhotos(content.photos, url);
  const presenter = new Presenter(camera);
  const L = LAYOUT;
  const onTop = (spot, h) => spot.pos.clone().add(new THREE.Vector3(0, h, 0));
  const confetti = new Confetti(scene, 520);
  const sparkles = new Sparkles(scene);
  const o = {
    yardObjects: yard.o,
    cake: new Cake(scene, { position: new THREE.Vector3(0, FOOTLOCKER_TOP, 0), yaw: 0 }),
    letter: new Letter(scene, { position: onTop(L.dossierCrate, 0.462), yaw: 0.18 }, content, presenter),
    spray: new Spray(scene, { rest: yard.o.sandbagTop, heart: L.heart }, content.name),
    loot: new LootCase(scene, onTop(L.caseCrate, 0.622 * 0.85), L.caseCrate.rotY, content.wishes[0]),
    photos: new PhotoBoard(scene, yard.o.pallet, photos, { name: content.name, iso: content.date.iso }),
    timer: new PartyCharge(scene, onTop(L.timerBarrel, 0.884), L.timerBarrel.rotY, content.date.iso),
    radio: new FieldRadio(scene, yard.o.radioCrate.localToWorld(new THREE.Vector3(-0.16, 0.622, 0)), L.radioCrate.rotY),
    mvp: new MvpCard(scene, content.name),
    sniper: new Sniper(scene, { rest: yard.o.sniperRest, target: SNIPER_TARGET }),
    confetti, sparkles,
  };
  const audio = new AudioEngine();
  const fwColor = new THREE.Color(1, 0.8, 0.6);
  const fireworks = new Fireworks(scene, camera, {
    onBurst: ({ position, color, distance, type }) => {
      const p = position.clone().project(camera);
      audio.firework({ distance, pan: p.x, big: type === 'crossette' || type === 'heart' });
      fwColor.copy(color);
    },
  });
  o.fireworks = fireworks;
  fireworks.pixelRatio = () => R.renderer.getPixelRatio();
  let story = null;
  o.grenades = new GrenadeShow(scene, { fireworks, confetti, sparkles, audio, onFlash: () => story?.flash() });
  scene.traverse((n) => {
    if (!n.isMesh) return;
    for (const m of [].concat(n.material)) if (m?.map && m.map.anisotropy < maxAniso && m.map.isCanvasTexture) m.map.anisotropy = maxAniso;
  });

  // ── quality ──
  R.onQuality = () => {};
  if (params.has('q')) { R.level = Math.min(+params.get('q'), R.levels.length - 1); R.monitor = () => {}; }
  if (params.has('dpr')) R.forceDpr = +params.get('dpr');
  R.applyLevel(yard.sun);

  // ── story ──
  const director = new Director(camera, R.dof);
  let captureReq = null;
  const capture = (pose, fov = 50, size = 1024) => new Promise((resolve) => { captureReq = { pose, fov, size, resolve }; });
  const tube = new TubePlayer({ onEnd: () => story.stopSong(), onFail: () => ui.toast('This YouTube song cannot be played here.') });
  story = new Story({ director, ui, audio, o, content, presenter, capture, tube, mediaURL: url, yard });
  // edits repaint the 3D things that show them (dossier, the name on the wall, polaroids, timer, the wish card)
  editor.story = story;
  editor.letterBlank = (b) => o.letter.setBlank(b);
  editor.calendarBlank = () => {};
  editor.apply = (paths) => {
    let letter = false;
    for (const p of paths) {
      if (p === 'name') { letter = true; o.spray.setName(content.name); o.mvp.setName(content.name); o.photos.setDetails(content.name, content.date.iso); }
      else if (p.startsWith('letter.') || p === 'from') letter = true;
      else if (/^photos\.\d+\.caption$/.test(p)) o.photos.setCaption(+p.split('.')[1], getPath(content, p));
      else if (p === 'date.iso') { o.timer.setDate(content.date.iso); o.photos.setDetails(content.name, content.date.iso); letter = true; }
      else if (p === 'wishes.0') o.loot.setWish(content.wishes[0]);
      else if (/^photos\.\d+\.src$/.test(p)) {
        const i = +p.split('.')[1];
        loadImage(url(content.photos[i].src)).then((img) => o.photos.setPhoto(i, img, content.photos[i].src));
      } else if ((p === 'song.youtube' || p === 'song.voice') && story.current?.id === 'music') { story.stopSong(); story.refreshCard(); }
    }
    if (letter) o.letter.setContent(content);
    story._storyFile = null;
  };
  ui.setupNav(story.chapters, { onPrev: () => story.prev(), onNext: () => story.next(), onJump: (i) => story.goTo(i) });
  ui.el.sound.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    tube.setMuted(audio.muted);
    ui.el.sound.textContent = audio.muted ? '🔇' : '🔊';
    ui.el.sound.setAttribute('aria-pressed', String(audio.muted));
    ui.el.sound.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
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
  canvas.addEventListener('click', (e) => { const hit = pick(e); if (hit) story.current.onHit?.(hit.object); });

  // compile every shader now, including things that start hidden, so nothing stalls a frame later
  director.update(0, 0.016);
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
    window.__app = { R, scene, camera, yard, story, director, o, audio, ui, presenter, editor, THREE, controls, content };
    window.__snap = (name) => { R.render(0.016); return fetch('/__snap', { method: 'POST', body: JSON.stringify({ name, data: canvas.toDataURL('image/jpeg', 0.88) }) }).then((r) => r.text()); };
  }

  // ── loop ──
  gsap.ticker.remove(gsap.updateRoot);
  const timer = new THREE.Timer();
  timer.connect(document);
  let shadowFrame = 0;
  yard.sun.shadow.autoUpdate = false;
  let lastTs = 0;
  const frame = (ts) => {
    lastTs = ts;
    timer.update(ts);
    const dt = Math.max(0, Math.min(timer.getDelta(), 1 / 15));
    const t = timer.getElapsed();
    gsap.updateRoot(t);

    if (story.viewfinder) {
      // looking through the scope: the circle shows exactly what will be captured
      const pose = story.viewfinder.pose();
      camera.position.copy(pose.pos);
      camera.quaternion.copy(pose.quat);
      const half = THREE.MathUtils.degToRad(story.viewfinder.fov) / 2;
      const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) * innerHeight / ui.viewfinderSize()));
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    } else if (!(DEBUG && params.has('orbit'))) director.update(t, dt);
    if (story.shake > 0.0005) {
      const s = story.shake;
      camera.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
    }
    presenter.update();
    if (editor.editing) {
      const W = innerWidth, H = ui.stageHeight(), ch = story.current?.id;
      let spots = [];
      if (ch === 'moments') spots = o.photos.spots(camera, W, H);
      else if (ch === 'music') {
        // the music and voice buttons sit just under the radio
        const p = o.radio.group.localToWorld(new THREE.Vector3(0, -0.04, 0.2)).project(camera);
        if (p.z < 1) spots = [{ key: 'anchor', act: 'anchor', rect: { x: (p.x * 0.5 + 0.5) * W - 40, y: (-p.y * 0.5 + 0.5) * H - 10, w: 80, h: 20 } }];
      }
      editor.frame(o.letter.screenRect(camera, W, H), null, spots);
    }
    ui.place(camera, { chapter: story.labelAnchor(), intro: story.introLabel }, dt);
    story.update(dt);
    yard.update(t, dt, R.renderer, camera);
    o.cake.update(t, dt, 0.15);
    o.spray.update(t, dt, R.renderer, camera);
    o.timer.update(t, dt);
    o.loot.update(t, dt);
    o.sniper.update(t, dt);
    o.radio.update(t, dt);
    o.grenades.update(t, dt, camera);
    confetti.update(t, dt);
    sparkles.update(t, dt, R.renderer, camera);
    fireworks.update(dt);
    // fireworks light up the courtyard at dusk
    yard.hemi.intensity += fireworks.flash * 0.3;
    audio.update();

    shadowFrame = (shadowFrame + 1) % (R.levels[R.level].shadowEvery || 2);
    yard.sun.shadow.needsUpdate = !yard.sun.shadow.map || shadowFrame === 0;
    R.render(dt);
    yard.hemi.intensity -= fireworks.flash * 0.3;
    if (captureReq) {
      const { pose, fov, size, resolve } = captureReq; captureReq = null;
      resolve(renderFrom(pose, fov, size));
    }
    R.monitor(dt, t, yard.sun);
  };
  // The last shot: one extra frame through the full post stack from `pose`, rendered square at `size`
  // pixels (HD, independent of the screen), then the normal view again — all inside one frame.
  function renderFrom(pose, fovDeg, size) {
    const w = size.w || size, h = size.h || size;
    const r = R.renderer;
    const saved = { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov, aspect: camera.aspect };
    const savedPR = fireworks.pixelRatio;
    r.setPixelRatio(1); r.setSize(w, h, false); R.composer.setSize(w, h, false);
    camera.position.copy(pose.pos); camera.quaternion.copy(pose.quat);
    camera.fov = fovDeg; camera.aspect = w / h;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    fireworks.pixelRatio = () => h / innerHeight;
    R.composer.render(0);
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    out.getContext('2d').drawImage(canvas, 0, 0, w, h);
    fireworks.pixelRatio = savedPR;
    camera.position.copy(saved.pos); camera.quaternion.copy(saved.quat); camera.fov = saved.fov; camera.aspect = saved.aspect;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    R._w = undefined; R._applySize();
    R.render(0);
    return out;
  }
  R.renderer.setAnimationLoop(frame);
  if (DEBUG) window.__frame = (n = 1, ms = 16.7) => { timer.disconnect?.(); for (let i = 0; i < n; i++) frame(lastTs + ms); };

  // ── reveal ──
  loaderEl.classList.add('done');
  setTimeout(() => loaderEl.remove(), 1000);
  ui.showIntro(async () => {
    try { await audio.init(); } catch (e) { console.warn('audio init failed', e); }
    ui.hideIntro();
    audio.sparkle();
    setTimeout(() => story.goTo(0), 700);
  });
  if (params.has('ch')) { await audio.init().catch(() => {}); ui.hideIntro(); story.goTo(+params.get('ch')); }
}

boot().catch((e) => {
  console.error(e);
  loaderText.textContent = 'Something went wrong preparing the mission. Please reload the page.';
});
