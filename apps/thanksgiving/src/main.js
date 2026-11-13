import './styles.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { Renderer } from './core/renderer.js';
import { loadAll } from './core/assets.js';
import { content } from './content.js';
import { World } from './world/world.js';
import { FLOOR, HALF_W, SPOTS } from './world/layout.js';
import { WelcomeSign } from './objects/sign.js';
import { TV } from './objects/tv.js';
import { FamilyWall } from './objects/gallery.js';
import { PhotoWall } from './share/photos.js';
import { Wishbone } from './objects/wishbone.js';
import { TripodCamera, Polaroid } from './objects/photo.js';
import { Confetti } from './fx/confetti.js';
import { AudioEngine } from './audio/audio.js';
import { UI } from './ui/ui.js';
import { Director } from './story/director.js';
import { Story } from './story/story.js';
import { Presenter } from './util/present.js';
import { ModeRepository, selectMode } from './share/repository.js';
import { CardEditor } from './share/editor.js';
import { Roster } from './party/roster.js';
import { DressUp } from './party/builder.js';
import { HostPanel } from './party/hostpanel.js';
import { THANKS_MAX } from './share/guests-core.js';
import { startPreview, silentAudio } from './share/embed.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const EMBED = params.has('embed') && window.parent !== window;   // the editor's live preview (share/embed.js)
if (EMBED) document.documentElement.classList.add('embed');
for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });

const canvas = document.getElementById('scene');
const loaderEl = document.getElementById('loader');
const pctEl = loaderEl.querySelector('.loader-pct'), barEl = loaderEl.querySelector('.bar'), loaderText = loaderEl.querySelector('.loader-text');
function setProgress(p) { const v = Math.round(p * 92); pctEl.textContent = `${v}%`; barEl.style.strokeDashoffset = String(327 * (1 - v / 100)); }
function webglOK() { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } }

async function boot() {
  if (!webglOK()) { loaderText.textContent = 'This card needs a browser with WebGL 2 — try Chrome, Edge, Firefox or Safari.'; return; }
  const R = new Renderer(canvas);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); loaderText.textContent = 'Reloading…'; }, false);
  canvas.addEventListener('webglcontextrestored', () => location.reload(), false);
  const { scene, camera } = R;
  const ui = new UI(content);
  const repo = new ModeRepository(selectMode(location.search));
  const editor = new CardEditor({ repo, content });
  editor.toast = (m) => ui.toast(m);
  editor.showLink = (url) => ui.showLink(url, { title: 'Your new card', note: 'This is the host’s link: whoever has it can edit the wording for 5 days and run the guest list until the big day. They make the guest link for the family from inside it.' });
  const contentReady = editor.boot();
  await Promise.all([
    contentReady, loadAll(setProgress),
    ...["700 30px 'Playfair Display'", "600 30px 'Playfair Display'", "400 30px 'Great Vibes'", "700 30px 'Caveat'", "800 30px 'Nunito'", "600 30px 'Nunito'"].map((f) => document.fonts.load(f).catch(() => {})),
  ]);
  const data = await contentReady;
  if (!data) { loaderEl.remove(); return; }
  loaderText.textContent = 'Setting the table…';

  // ── the guest list and the house ──
  const roster = new Roster(repo);
  roster.load(data);
  const world = new World(scene);
  world.setGuests(roster.guests, { party: roster.party, hideNo: roster.answersShown });
  const H = world.house.o;
  const o = {
    sign: new WelcomeSign(H.sign, scene), tv: new TV(H.tv, content), horn: world.table.horn,
    wall: new FamilyWall(scene, { x: -HALF_W + 0.02, zc: SPOTS.sideboard.z, floor: FLOOR }),
    wishbone: new Wishbone(scene), tripod: new TripodCamera(scene), polaroid: new Polaroid(scene), confetti: new Confetti(scene),
    door: H.door,
  };
  o.wall.setFamily(content.family);   // (the board starts clean: the welcome is chalked on it when you arrive)
  H.sofa.updateMatrixWorld(true);
  o.sofaSeats = ['seat_l', 'seat_c', 'seat_r'].map((n) => { const a = H.sofa.getObjectByName(n); return a ? a.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.04, 0)) : H.sofa.position.clone().add(new THREE.Vector3(0, 0.6, 0)); });
  const audio = EMBED ? silentAudio() : new AudioEngine();
  R.applyLevel();
  if (params.has('q')) { R.level = Math.min(+params.get('q'), R.levels.length - 1); R.monitor = () => {}; }
  if (params.has('dpr')) R.forceDpr = +params.get('dpr');

  // ── the story ──
  const director = new Director(camera, null);
  const presenter = new Presenter(camera);
  let captureReq = null;
  const capture = (pose, fov = 50, size = 1024) => new Promise((resolve) => { captureReq = { pose, fov, size, resolve }; });
  const dress = new DressUp(document.getElementById('dock'));
  let story = null;
  const hostPanel = new HostPanel(document.getElementById('guests-sheet'), roster, {
    toast: (m) => ui.toast(m),
    onDress: (id) => story.hostDress(id),
    onSaved: () => { story.reseat(); if (story.current?.id === 'you') story.refreshCard(); },
  });
  const photos = new PhotoWall({ repo, roster, wall: o.wall, ui });
  story = new Story({ director, ui, audio, world, o, content, roster, presenter, capture, dress, hostPanel, repo, photos, preview: EMBED });
  photos.load().catch((e) => console.warn('photos failed', e));
  ui.fillIntro({ who: roster.me ? `Welcome back, ${roster.me.name}!` : null });
  editor.story = story; editor.roster = roster;
  editor.guestLink = repo.mode.kind === 'studio' ? null : () => roster.guestLink || roster.makeGuestLink();
  // the editor runs the card live in its own frame: this page's scene steps aside meanwhile (one 3D card at a time)
  editor.release3d = () => { R.renderer.setAnimationLoop(null); try { R.renderer.dispose(); R.renderer.forceContextLoss(); } catch { /* already gone */ } };
  editor.apply = (paths) => {
    if (paths.some((p) => /^(family|date|place|letter|host)/.test(p)) && o.sign.shown) o.sign.paint(content, o.sign.shown);
    if (paths.includes('family')) o.wall.setFamily(content.family);
    if (paths.some((p) => /^(parade|football)/.test(p))) o.tv.setChannel(o.tv.channel);
    if (paths.includes('family')) ui.fillIntro({ who: roster.me ? `Welcome back, ${roster.me.name}!` : null });
  };
  document.getElementById('guests-toggle').onclick = () => hostPanel.open();
  document.getElementById('guest-link').onclick = () => story.shareGuestLink();
  ui.setupNav(story.chapters, { onPrev: () => story.prev(), onNext: () => story.next(), onJump: (i) => story.goTo(i) });
  ui.el.sound.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    ui.el.sound.textContent = audio.muted ? '🔇' : '🔊';
    ui.el.sound.setAttribute('aria-pressed', String(audio.muted));
    ui.el.sound.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
  });
  // the chapter text's own buttons (names, answers, dishes) and the thankful line's counter
  ui.el.card.addEventListener('click', (e) => story.onCardClick(e));
  ui.el.card.addEventListener('input', (e) => {
    if (!e.target.matches?.('[data-thanks]')) return;
    const c = e.target.parentElement.querySelector('.field-count'); if (c) c.textContent = `${e.target.value.length}/${THANKS_MAX}`;
  });
  story.startIntro();
  // the family keeps arriving: a guest's phone checks the list now and then
  if (repo.role === 'guest') {
    setInterval(async () => {
      if (document.hidden || dress.isOpen || story._wish || story._capturing || ['thanks', 'photo'].includes(story.current?.id)) return;
      const before = JSON.stringify(roster.guests);
      if (await roster.refresh() && JSON.stringify(roster.guests) !== before) story.reseat();
    }, 60000);
  }

  // ── tapping things: people at the table, the horn, the camera ──
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('click', (e) => {
    const ch = story.current; if (!ch || dress.isOpen) return;
    const r = canvas.getBoundingClientRect();
    if (ch.hitPeople?.()) {
      const a = world.crowd.pick(e.clientX - r.left, e.clientY - r.top, camera, r.width, r.height);
      if (a) { ch.onPerson?.(a); return; }
    }
    const targets = ch.hits?.() || [];
    if (!targets.length) return;
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(targets, true)[0];
    if (hit) ch.onHit?.(hit.object);
  });
  canvas.addEventListener('pointermove', (e) => {
    const ch = story.current; if (!ch) return;
    const r = canvas.getBoundingClientRect();
    let pointer = false;
    if (ch.hitPeople?.()) pointer = !!world.crowd.pick(e.clientX - r.left, e.clientY - r.top, camera, r.width, r.height);
    canvas.style.cursor = pointer || (ch.hits?.() || []).length ? (pointer ? 'pointer' : '') : '';
  }, { passive: true });

  // compile every shader now (including things that start hidden), so nothing stalls a frame later
  director.cut(story.intro.shot); director.update(0, 0.016);
  const hidden = [];
  scene.traverse((n) => { if (!n.visible) { hidden.push(n); n.visible = true; } });
  await R.renderer.compileAsync(scene, camera);
  for (const n of hidden) n.visible = false;
  setProgress(1); pctEl.textContent = '100%';

  if (DEBUG) {
    window.__app = { R, scene, camera, world, story, director, o, audio, ui, roster, editor, repo, THREE, content, gsap };
    window.__snap = (name) => { R.render(0.016); return fetch('/__snap', { method: 'POST', body: JSON.stringify({ name, data: canvas.toDataURL('image/jpeg', 0.88) }) }).then((x) => x.text()); };
  }

  // ── the loop ──
  gsap.ticker.remove(gsap.updateRoot);
  const timer = new THREE.Timer();
  timer.connect(document);
  let lastTs = 0;
  const frame = (ts) => {
    lastTs = ts;
    timer.update(ts);
    const dt = Math.max(0, Math.min(timer.getDelta(), 1 / 15)), t = timer.getElapsed();
    gsap.updateRoot(t);
    if (story.viewfinder) {
      const pose = story.viewfinder.pose();
      camera.position.copy(pose.pos); camera.quaternion.copy(pose.quat);
      if (Math.abs(camera.fov - story.viewfinder.fov) > 0.01) { camera.fov = story.viewfinder.fov; camera.updateProjectionMatrix(); }
    } else director.update(t, dt);
    if (story.shake > 0.0005) { const s = story.shake; camera.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s)); }
    presenter.update();
    ui.place(camera, { chapter: story.labelAnchor(), intro: story.introLabel, bubble: story.bubbleAnchor() }, dt);
    story.update(dt);
    world.update(t, dt, camera);
    o.tv.update(t); o.sign.update(dt); o.wishbone.update(t, dt); o.confetti.update(t, dt); o.polaroid.update(t);
    audio.update();
    R.render(dt);
    if (captureReq) { const { pose, fov, size, resolve } = captureReq; captureReq = null; resolve(renderFrom(pose, fov, size)); }
    R.monitor(dt, t);
  };
  // The family photo: one extra frame through the full post stack from `pose`, at `size` pixels (HD,
  // whatever the screen), then the normal view again — all inside one frame.
  function renderFrom(pose, fovDeg, size) {
    const w = size.w || size, h = size.h || size, r = R.renderer;
    const saved = { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov, aspect: camera.aspect };
    r.setPixelRatio(1); r.setSize(w, h, false); R.composer.setSize(w, h, false);
    camera.position.copy(pose.pos); camera.quaternion.copy(pose.quat);
    camera.fov = fovDeg; camera.aspect = w / h; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    scene.updateMatrixWorld();
    R.composer.render(0);
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    out.getContext('2d').drawImage(canvas, 0, 0, w, h);
    camera.position.copy(saved.pos); camera.quaternion.copy(saved.quat); camera.fov = saved.fov; camera.aspect = saved.aspect;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    R._w = undefined; R._applySize(); R.render(0);
    return out;
  }
  R.renderer.setAnimationLoop(frame);
  if (DEBUG) window.__frame = (n = 1, ms = 16.7) => { timer.disconnect?.(); for (let i = 0; i < n; i++) frame(lastTs + ms); };

  // ── the porch ──
  loaderEl.classList.add('done');
  setTimeout(() => loaderEl.remove(), 1000);
  if (EMBED) { startPreview({ R, story, ui, o, content, roster, repo, photos, director, world, camera, capture }); return; }
  ui.showIntro(async () => {
    try { await audio.init(); } catch (e) { console.warn('audio init failed', e); }
    ui.hideIntro();
    setTimeout(() => story.goTo(0), 500);
  });
  if (params.has('ch')) { await audio.init().catch(() => {}); ui.hideIntro(); story._walkIn = false; story.goTo(+params.get('ch')); }
  void FLOOR;
}

boot().catch((e) => { console.error(e); loaderText.textContent = 'Something went wrong while setting up. Please reload the page.'; });
