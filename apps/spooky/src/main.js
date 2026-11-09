import './styles.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { Renderer } from './core/renderer.js';
import { loadAll } from './core/assets.js';
import { createGraveyard, piece } from './world/graveyard.js';
import { content } from './content.js';
import { MailLetter } from './objects/mailletter.js';
import { Carving } from './objects/carve.js';
import { HangingPhotos } from './objects/hangtree.js';
import { loadPhotos, loadImage } from './objects/photos.js';
import { PlanStones } from './objects/graves.js';
import { Cauldron } from './objects/potion.js';
import { Gramophone } from './objects/gramophone.js';
import { TrickOrTreat } from './objects/trick.js';
import { SpiritCamera, SpiritPhoto } from './objects/spiritcam.js';
import { Fireworks } from './fx/fireworks.js';
import { Celebration } from './fx/celebration.js';
import { Posers } from './objects/posers.js';
import { decorateCoffin } from './objects/coffindeco.js';
import { glowTexture } from './world/nightTextures.js';
import { MOON_DIR } from './world/nightsky.js';
import { Sparkles } from './fx/effects.js';
import { AudioEngine } from './audio/audio.js';
import { TubePlayer } from './audio/tube.js';
import { UI } from './ui/ui.js';
import { Director } from './story/director.js';
import { Story } from './story/story.js';
import { Presenter } from './util/present.js';
import { ModeRepository, selectMode } from './share/repository.js';
import { CardEditor } from './share/editor.js';
import { getPath } from './share/content-core.js';
import { startPreview, silentAudio, silentTube } from './share/embed.js';

const params = new URLSearchParams(location.search);
const EMBED = params.has('embed') && window.parent !== window;   // the step editor's live preview (share/embed.js)
if (EMBED) document.documentElement.classList.add('embed');
// every letter the textures and the story picture will need
const FONT_SAMPLE = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz 0123456789 ${JSON.stringify(content)}`.slice(0, 4000);
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
  // if a phone's GPU drops the context (memory pressure, a long time in the background), come back cleanly
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); loaderText.textContent = 'Reloading…'; }, false);
  canvas.addEventListener('webglcontextrestored', () => location.reload(), false);
  const { scene, camera } = R;
  R.renderer.setClearColor(0x120c1c);
  const ui = new UI(content);
  const repo = new ModeRepository(selectMode(location.search));
  const editor = new CardEditor({ repo, content });
  editor.toast = (m) => ui.toast(m);
  const contentReady = editor.boot();
  await Promise.all([
    contentReady,
    loadAll(setProgress),
    ...["400 30px 'Rubik Wet Paint'", "400 30px 'Rubik'", "500 30px 'Rubik'", "700 30px 'Rubik'", "400 30px 'Yeseva One'", "400 30px 'Bad Script'", "700 30px 'Caveat'"]
      .map((f) => Promise.race([document.fonts.load(f, FONT_SAMPLE).catch(() => {}), new Promise((res) => setTimeout(res, 6000))])),
  ]);
  if (!await contentReady) { loaderEl.remove(); return; }
  ui._fillIntro();
  loaderText.textContent = 'Waking the ghosts…';
  const maxAniso = R.renderer.capabilities.getMaxAnisotropy();

  // ── the graveyard ──
  const yard = createGraveyard(scene);
  const Y = yard.o;
  const url = (name) => repo.mediaURL(name);
  const photos = await loadPhotos(content.photos, url);
  const presenter = new Presenter(camera);
  const sparkles = new Sparkles(scene);
  const letterSpot = Y.mailbox.getObjectByName('letter_spot');
  Y.mailbox.updateMatrixWorld(true);
  const mailboxTargets = [];
  Y.mailbox.traverse((m) => { if (m.isMesh && !m.userData.isOutline) mailboxTargets.push(m); });
  // a soft purple glow inside the coffin once its lid is open, and the coffin dressed up
  const coffinGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(64), color: 0xb070ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  coffinGlow.scale.set(0.45, 0.55, 1);
  coffinGlow.position.copy(Y.mailbox.localToWorld(new THREE.Vector3(0, 1.38, 0.05)));
  scene.add(coffinGlow);
  const coffinDeco = decorateCoffin(Y.mailbox, { makeBat: () => piece('bat', { outline: 0.001 }), makePumpkin: () => piece('pumpkin', { outline: 0.0012 }), lookAt: Y.mailbox.localToWorld(new THREE.Vector3(-1.5, 1.0, 2.0)) });
  const o = {
    mailbox: { lid: Y.mailbox.getObjectByName('coffin_lid'), glow: coffinGlow, opened: false, hitTargets: mailboxTargets },
    letter: new MailLetter(scene, { position: letterSpot ? letterSpot.getWorldPosition(new THREE.Vector3()) : Y.mailbox.position.clone().add(new THREE.Vector3(0, 1.3, 0)), yaw: Y.mailbox.rotation.y }, content, presenter),
    carving: new Carving(Y.pumpkin, content.name),
    photos: new HangingPhotos(scene, Y.tree, photos, new THREE.Vector3(-1.6, 1.8, 2.6)),
    graves: new PlanStones(scene, yard, content),
    potion: new Cauldron(scene, Y.cauldron, content.wishes[0], yard.brewLight),
    gram: new Gramophone(scene, Y.gramophone),
    trick: new TrickOrTreat(scene, Y.bucket, camera, { mansion: Y.mansion, makeBat: () => piece('bat', { outline: 0.001 }) }),
    spirit: new SpiritCamera(scene, Y.camera, new THREE.Vector3(-0.15, 2.5, -10)),
    photo: new SpiritPhoto(scene, content),
    sparkles,
  };
  o.spirit.root.visible = false;
  const audio = EMBED ? silentAudio() : new AudioEngine();
  yard.onLightning = (big) => audio.thunder(big ? 0.15 + Math.random() * 0.3 : 0.6 + Math.random() * 1.2, big ? 0.7 : 0.5 + Math.random() * 0.4);
  const fireworks = new Fireworks(scene, camera, {
    onBurst: ({ position, distance, type }) => {
      const p = position.clone().project(camera);
      audio.firework({ distance, pan: p.x, big: type === 'crossette' || type === 'heart' });
    },
  });
  o.fireworks = fireworks;
  // the sky's party: witches flinging potion fireworks, ghosts looping, zombies dancing (watched from the path)
  o.party = new Celebration(scene, { from: new THREE.Vector3(0.7, 1.3, 2.6), dir: MOON_DIR, fireworks, onThrow: () => { audio.fling(); if (Math.random() < 0.3) audio.cackle(0.4); } });
  fireworks.pixelRatio = () => R.renderer.getPixelRatio();
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
  let story = null;
  const tube = EMBED ? silentTube() : new TubePlayer({ onEnd: () => story.stopSong(), onFail: () => { ui.toast('This YouTube song can’t play on this device.'); story.songFailed(); } });
  story = new Story({ director, ui, audio, o, content, presenter, capture, tube, mediaURL: url, yard, posers: new Posers(scene, [Y.lamps[0]]) });
  // the song in the background, at 40%; it never plays over the record's song or the whisper (story.js)
  // (the record's player is made when its chapter opens, and goes when it closes: two players at once are heavy on a phone)
  story.bgTube = EMBED ? silentTube() : new TubePlayer({ volume: 40, loop: true, onFail: () => { story.bgOn = false; } });
  // edits repaint the 3D things that show them (the letter, the pumpkin, polaroids, the stones, the scroll)
  editor.story = story;
  editor.letterBlank = (b) => o.letter.setBlank(b);
  editor.calendarBlank = () => {};
  const apply = (paths) => {
    let letter = false;
    for (const p of paths) {
      if (p === 'name') { letter = true; o.carving.setName(content.name); o.photo.setNames(); }
      else if (p === 'from') { letter = true; o.photo.setNames(); }
      else if (p.startsWith('letter.')) letter = true;
      else if (/^photos\.\d+\.caption$/.test(p)) o.photos.setCaption(+p.split('.')[1], getPath(content, p));
      else if (p.startsWith('plan.')) o.graves.setPlan(content.plan);
      else if (p === 'date.iso' || p === 'date.label') { o.graves.setDate(content.date.iso, content.date.label); o.photo.setNames(); }
      else if (p === 'wishes.0') o.potion.setWish(content.wishes[0]);
      else if (/^photos\.\d+\.src$/.test(p)) {
        const i = +p.split('.')[1];
        loadImage(url(content.photos[i].src)).then((img) => o.photos.setPhoto(i, img, content.photos[i].src));
      } else if ((p === 'song.youtube' || p === 'song.voice') && story.current?.id === 'music') { story.stopSong(); story.refreshCard(); }
    }
    if (letter) o.letter.setContent(content);
    story._storyFile = null;
  };
  editor.apply = apply;
  // the step editor's preview runs a haunted hill of its own: while it is open this page lets go of its 3D and its sound
  // (two 3D scenes at once are too much for a phone; closing the editor reloads the page)
  editor.release3d = () => {
    story.stopSong(); story.bgTube.stop(); audio.setMuted?.(true);
    R.renderer.setAnimationLoop(null);
    try { R.renderer.dispose(); R.renderer.forceContextLoss(); } catch { /* already gone */ }
  };
  ui.setupNav(story.chapters, { onPrev: () => story.prev(), onNext: () => story.next(), onJump: (i) => story.goTo(i) });
  ui.el.sound.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    tube.setMuted(audio.muted);
    story.bgTube.setMuted(audio.muted);
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
  // some chapters let you pick things up and throw them (the cauldron's ingredients)
  let dragging = false, moved = false, suppressClick = false, downAt = [0, 0];
  const dragPlane = new THREE.Plane(), dragHit = new THREE.Vector3(), camDir = new THREE.Vector3();
  canvas.addEventListener('pointerdown', (e) => {
    const ch = story.current;
    if (!ch?.grab) return;
    const hit = pick(e);
    if (!hit || !ch.grab(hit.object)) return;
    dragging = true; moved = false; downAt = [e.clientX, e.clientY];
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) { canvas.style.cursor = pick(e) ? (story.current?.grab ? 'grab' : 'pointer') : ''; return; }
    if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 8) moved = true;
    const p = story.current?.dragPoint?.();
    if (!p) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    camera.getWorldDirection(camDir);
    dragPlane.setFromNormalAndCoplanarPoint(camDir, p);
    if (ray.ray.intersectPlane(dragPlane, dragHit)) story.current.drag(dragHit);
  }, { passive: true });
  const endDrag = () => { if (!dragging) return; dragging = false; suppressClick = true; canvas.style.cursor = ''; story.current?.release?.(moved); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    const hit = pick(e); if (hit) story.current.onHit?.(hit.object);
  });

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
      // looking through the box camera: the frame shows exactly what will be captured
      const pose = story.viewfinder.pose();
      camera.position.copy(pose.pos);
      camera.quaternion.copy(pose.quat);
      const half = THREE.MathUtils.degToRad(story.viewfinder.fov) / 2;
      const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) * innerHeight / ui.viewfinderSize()));
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    } else if (!(DEBUG && params.has('orbit'))) director.update(t, dt);
    if (story.punch) { camera.fov = Math.max(10, camera.fov - story.punch); camera.updateProjectionMatrix(); story.punch = 0; }
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
        // the music and voice buttons sit just under the gramophone
        const p = o.gram.root.localToWorld(new THREE.Vector3(0, 0.25, 0.4)).project(camera);
        if (p.z < 1) spots = [{ key: 'anchor', act: 'anchor', rect: { x: (p.x * 0.5 + 0.5) * W - 40, y: (-p.y * 0.5 + 0.5) * H - 10, w: 80, h: 20 } }];
      }
      editor.frame(o.letter.screenRect(camera, W, H), null, spots);
    }
    ui.place(camera, { chapter: story.labelAnchor(), intro: story.introLabel }, dt);
    story.update(dt);
    yard.pumpkinGlow = o.carving.light;
    yard.update(t, dt, R.renderer, camera);
    o.carving.update(t);
    o.photos.update(t);
    o.graves.update(t, dt);
    o.potion.update(t, dt, R.renderer, camera);
    o.gram.update(t, dt);
    o.trick.update(t, dt);
    o.spirit.update(t, dt);
    o.photo.update(t);
    coffinDeco.update(t);
    o.party.update(t, dt);
    sparkles.update(t, dt, R.renderer, camera);
    fireworks.update(dt);
    // fireworks light up the hill
    yard.hemi.intensity += fireworks.flash * 0.35;
    audio.update();

    shadowFrame = (shadowFrame + 1) % (R.levels[R.level].shadowEvery || 2);
    yard.sun.shadow.needsUpdate = !yard.sun.shadow.map || shadowFrame === 0;
    R.render(dt);
    yard.hemi.intensity -= fireworks.flash * 0.35;
    if (captureReq) {
      const { pose, fov, size, resolve } = captureReq; captureReq = null;
      resolve(renderFrom(pose, fov, size));
    }
    R.monitor(dt, t, yard.sun);
  };
  // The last shot: one extra frame through the full post stack from `pose`, rendered at `size` pixels
  // (HD, independent of the screen), then the normal view again — all inside one frame.
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
    scene.updateMatrixWorld();
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
  if (EMBED) { startPreview({ R, story, ui, o, content, apply, director, camera, capture, yard }); return; }
  story.bgTube.prepare(content.song.bg);   // the 3D is loaded by now, and a tap on the intro's button can start it
  ui.showIntro(async () => {
    story.startBackground();   // right in the tap: phones allow sound to start only there
    try { await audio.init(); } catch (e) { console.warn('audio init failed', e); }
    ui.hideIntro();
    audio.sparkle();
    setTimeout(() => story.goTo(0), 700);
  });
  if (params.has('ch')) { await audio.init().catch(() => {}); ui.hideIntro(); story.goTo(+params.get('ch')); }
}

boot().catch((e) => {
  console.error(e);
  loaderText.textContent = 'Something went wrong while getting ready. Please reload the page.';
});
