import './styles.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { Renderer } from './core/renderer.js';
import { loadAll, assets } from './core/assets.js';
import { createSalon, piece, TABLE, TABLE_TOP, LAYOUT } from './world/salon.js';
import { content } from './content.js';
import { Cake } from './objects/cake.js';
import { Letter } from './objects/letter.js';
import { StarWriting } from './objects/stars.js';
import { Quill } from './objects/quill.js';
import { Casket } from './objects/casket.js';
import { Portraits } from './objects/portraits.js';
import { loadPhotos, loadImage } from './objects/photos.js';
import { DeskCalendar } from './objects/calendar.js';
import { Ensemble } from './objects/ensemble.js';
import { Easel } from './objects/easel.js';
import { Fireworks } from './fx/fireworks.js';
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
import { startPreview, silentAudio, silentTube } from './share/embed.js';

const params = new URLSearchParams(location.search);
const EMBED = params.has('embed') && window.parent !== window;   // the step editor's live preview (share/embed.js)
if (EMBED) document.documentElement.classList.add('embed');
// every letter the textures and the story picture will need
const FONT_SAMPLE = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ${JSON.stringify(content)}`.slice(0, 4000);
const DEBUG = params.has('debug');

// phones: no pinch / double-tap zoom on the card (Safari ignores the viewport's maximum-scale)
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
    loaderText.textContent = 'This salon needs a browser with WebGL 2. Please use Chrome, Edge, Firefox or Safari.';
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
    // the Cyrillic subsets load on demand: ask for them with real Mongolian text before painting textures
    ...["400 30px 'Bad Script'", "600 30px 'Cormorant Garamond'", "700 30px 'Cormorant Garamond'", "italic 600 30px 'Cormorant Garamond'"]
      .map((f) => Promise.race([document.fonts.load(f, FONT_SAMPLE).catch(() => {}), new Promise((res) => setTimeout(res, 6000))])),
  ]);
  if (!await contentReady) { loaderEl.remove(); return; }   // link unavailable: the gate says so
  ui._fillIntro();
  loaderText.textContent = 'Lighting the candles…';
  const maxAniso = R.renderer.capabilities.getMaxAnisotropy();

  // ── the salon ──
  const salon = createSalon(scene);
  const url = (name) => repo.mediaURL(name);
  const photos = await loadPhotos(content.photos, url);
  const presenter = new Presenter(camera);
  const T = (x, z) => new THREE.Vector3(TABLE.x + x, TABLE_TOP, TABLE.z + z);
  // the letter arrives on a silver salver; the wish casket beside it; the cake in the middle
  const letterAt = T(-0.2, 0.36);
  const salver = piece('table', 'salver'); salver.position.copy(letterAt).add(new THREE.Vector3(0, -0.004, 0.0)); scene.add(salver);
  const mantel = LAYOUT.fireplace.pos.clone().add(new THREE.Vector3(-0.22, 1.31, 0.42));
  const o = {
    salonObjects: salon.o,
    cake: new Cake(scene, { position: T(0.02, -0.08), yaw: 0 }),
    letter: new Letter(scene, { position: letterAt.clone().add(new THREE.Vector3(0, 0.014, 0)), yaw: 0 }, content, presenter),
    casket: new Casket(scene, T(0.24, 0.38), -0.25),
    quill: new Quill(scene, LAYOUT.desk),
    stars: new StarWriting(scene, content.name, { scale: 0.098 }),
    photos: new Portraits(scene, LAYOUT.portraits, photos),
    calendar: new DeskCalendar(scene, { position: mantel, yaw: -Math.PI / 2 }, content.date.iso, content.date.label),
    ensemble: new Ensemble(scene, salon),
    easel: new Easel(scene, salon.o.easel),
    confetti: new Confetti(scene),
    sparkles: new Sparkles(scene),
  };
  const audio = EMBED ? silentAudio() : new AudioEngine();
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
  for (const root of [scene]) root.traverse((n) => {
    if (!n.isMesh) return;
    for (const m of [].concat(n.material)) if (m?.map && m.map.anisotropy < maxAniso && m.map.isCanvasTexture) m.map.anisotropy = maxAniso;
  });

  // ── quality ──
  R.onQuality = () => {};
  if (params.has('q')) { R.level = Math.min(+params.get('q'), R.levels.length - 1); R.monitor = () => {}; }
  if (params.has('dpr')) R.forceDpr = +params.get('dpr');
  R.applyLevel(salon.sun);

  // ── story ──
  const director = new Director(camera, R.dof);
  let captureReq = null;
  const capture = (pose, fov = 50, size = 1024) => new Promise((resolve) => { captureReq = { pose, fov, size, resolve }; });
  const tube = EMBED ? silentTube() : new TubePlayer({ onEnd: () => story.stopSong(), onFail: () => { ui.toast('This YouTube song can’t play on this device.'); story.songFailed(); } });
  const story = new Story({ director, ui, audio, o, content, presenter, capture, tube, mediaURL: url });
  // the song in the background, at 40%; it never plays over the concert's song or the voice (story.js)
  // (the concert's player is made when its chapter opens, and goes when it closes: two players at once are heavy on a phone)
  story.bgTube = EMBED ? silentTube() : new TubePlayer({ volume: 40, loop: true, onFail: () => { story.bgOn = false; } });
  // edits repaint the 3D things that show them (envelope, letter page, stars, portraits, calendar, scroll)
  editor.story = story;
  editor.letterBlank = (b) => o.letter.setBlank(b);
  editor.calendarBlank = (b) => o.calendar.setLabelHidden(b);
  const apply = (paths) => {
    let letter = false;
    for (const p of paths) {
      if (p === 'name') { letter = true; o.stars.setName(content.name); o.quill.setName(content.name); }
      else if (p.startsWith('letter.') || p === 'from') letter = true;
      else if (/^photos\.\d+\.caption$/.test(p)) o.photos.setCaption(+p.split('.')[1], getPath(content, p));
      else if (p === 'date.iso') o.calendar.setDate(content.date.iso);
      else if (p === 'date.label') o.calendar.setLabel(content.date.label);
      else if (p === 'wishes.0') o.casket.setWish(content.wishes[0]);
      else if (/^photos\.\d+\.src$/.test(p)) {
        const i = +p.split('.')[1];
        loadImage(url(content.photos[i].src)).then((img) => o.photos.setPhoto(i, img, content.photos[i].src));
      } else if (p === 'song.youtube' && story.current?.id === 'music') { story.stopSong(); story.refreshCard(); }
      else if (p === 'song.voice' && story.current?.id === 'music') { story.stopSong(); story.refreshCard(); }
    }
    if (letter) o.letter.setContent(content);
    story._storyFile = null;   // the story picture is drawn again with the new words
  };
  editor.apply = apply;
  // the step editor's preview runs a salon of its own: while it is open this page lets go of its 3D and its sound
  // (two 3D scenes at once are too much for a phone; closing the editor reloads the page)
  editor.release3d = () => {
    window.__card3dReleased = true;   // (the loading guard must not take this for a crash)
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
  canvas.addEventListener('pointermove', (e) => { canvas.style.cursor = pick(e) ? 'pointer' : ''; }, { passive: true });
  canvas.addEventListener('click', (e) => { const hit = pick(e); if (hit) story.current.onHit?.(hit.object); });

  // compile EVERY shader now — including things that start hidden (sparkles, stars, confetti, pages,
  // firework bursts) — so nothing stalls a frame the first time it appears
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
    window.__app = { R, scene, camera, salon, story, director, o, audio, ui, presenter, editor, THREE, controls, content };
    window.__snap = (name) => { R.render(0.016); return fetch('/__snap', { method: 'POST', body: JSON.stringify({ name, data: canvas.toDataURL('image/jpeg', 0.88) }) }).then((r) => r.text()); };
  }

  // ── loop ──
  gsap.ticker.remove(gsap.updateRoot);
  const timer = new THREE.Timer();
  timer.connect(document);
  let shadowFrame = 0;
  salon.sun.shadow.autoUpdate = false;
  const hemiBase = salon.hemi.intensity, hemiColor = salon.hemi.color.clone();
  let lastTs = 0, drawnAt = -1e9;
  // phones: at most 60 frames a second (a 120 Hz phone would otherwise draw twice as many, for nothing but heat)
  const minGap = R.isMobile ? 1000 / 60 - 2.5 : 0;
  const frame = (ts) => {
    if (ts - drawnAt < minGap) return;
    drawnAt = ts;
    lastTs = ts;
    timer.update(ts);
    const dt = Math.max(0, Math.min(timer.getDelta(), 1 / 15));
    const t = timer.getElapsed();
    gsap.updateRoot(t);

    if (story.viewfinder) {
      // looking through the painter's frame: the square shows exactly what will be painted
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
      let spots = [];
      if (ch === 'moments') spots = o.photos.spots(camera, W, H);
      else if (ch === 'music') {
        // the music and voice buttons sit in front of the keyboard
        const p = o.ensemble.piano.getObjectByName('keys_origin').localToWorld(new THREE.Vector3(0.43, 0.05, 0.12)).project(camera);
        if (p.z < 1) spots = [{ key: 'anchor', act: 'anchor', rect: { x: (p.x * 0.5 + 0.5) * W - 40, y: (-p.y * 0.5 + 0.5) * H - 10, w: 80, h: 20 } }];
      }
      editor.frame(o.letter.screenRect(camera, W, H), ch === 'date' ? o.calendar.labelRect(camera, W, H) : null, spots);
    }
    ui.place(camera, { chapter: story.labelAnchor(), intro: story.introLabel }, dt);
    story.update(dt);
    salon.update(t, R.renderer, camera);
    o.cake.update(t, dt, 0.15);
    o.stars.update(t, dt, R.renderer, camera);
    o.ensemble.update(t, dt);
    o.confetti.update(t, dt);
    o.sparkles.update(t, dt, R.renderer, camera);
    fireworks.update(dt);
    // fireworks light the room through the windows
    salon.hemi.color.copy(hemiColor).lerp(fwColor, Math.min(1, fireworks.flash * 0.35));
    salon.hemi.intensity = hemiBase + fireworks.flash * 0.35;
    audio.update();

    // shadows refresh every 2nd frame (every 3rd-4th on phones)
    shadowFrame = (shadowFrame + 1) % (R.levels[R.level].shadowEvery || 2);
    salon.sun.shadow.needsUpdate = !salon.sun.shadow.map || shadowFrame === 0;
    R.render(dt);
    if (captureReq) {
      const { pose, fov, size, resolve } = captureReq; captureReq = null;
      resolve(renderFrom(pose, fov, size));
    }
    R.monitor(dt, t, salon.sun);
  };
  // The painting: one extra frame through the full post stack from `pose`, rendered square at `size`
  // pixels (HD, independent of the screen), then the normal view again — all inside one frame.
  function renderFrom(pose, fovDeg, size) {
    const r = R.renderer;
    const saved = { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov, aspect: camera.aspect };
    const px = size / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    const savedStarsPx = o.stars.uniforms.uPx.value, savedPR = fireworks.pixelRatio;
    r.setPixelRatio(1); r.setSize(size, size, false); R.composer.setSize(size, size, false);
    camera.position.copy(pose.pos); camera.quaternion.copy(pose.quat);
    camera.fov = fovDeg; camera.aspect = 1;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    o.stars.uniforms.uPx.value = px;
    fireworks.pixelRatio = () => size / innerHeight;
    R.composer.render(0);
    const out = document.createElement('canvas'); out.width = out.height = size;
    out.getContext('2d').drawImage(canvas, 0, 0, size, size);
    o.stars.uniforms.uPx.value = savedStarsPx; fireworks.pixelRatio = savedPR;
    camera.position.copy(saved.pos); camera.quaternion.copy(saved.quat); camera.fov = saved.fov; camera.aspect = saved.aspect;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    R._w = undefined; R._applySize();
    R.render(0);
    return out;
  }
  R.renderer.setAnimationLoop(frame);
  if (DEBUG) window.__frame = (n = 1, ms = 16.7) => { timer.disconnect?.(); for (let i = 0; i < n; i++) frame(lastTs + ms); };

  // ── reveal ──
  window.__cardReady?.();
  loaderEl.classList.add('done');
  setTimeout(() => loaderEl.remove(), 1000);
  if (EMBED) { startPreview({ R, story, ui, o, content, apply, director, camera, capture }); return; }
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
  loaderText.textContent = 'Something went wrong preparing the salon. Please reload the page.';
  window.__cardFailed?.();
});
