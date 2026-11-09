// The card as the editor's live preview (?embed=1, inside the editor's frame): the same haunted hill, running, with no
// sound, no owner bar and nothing to press. The editor (live-preview.js) tells it which part to show and hands it the
// words as they are typed; everything that shows them (the invitation, the carved pumpkin, the photos in the tree, the
// gravestones and the crypt's plaque, the cauldron's scroll, the chapter text, the first screen and the closing words)
// follows at once.
import * as THREE from 'three';
import gsap from 'gsap';
import { getPath, replaceContent } from './content-core.js';
import { drawStoryImage } from './storyImage.js';
import { LENS_FOV } from '../story/story.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const portrait = () => innerWidth / innerHeight < 1.1;

/** A sound engine that makes no sound (the preview is silent; no tap ever wakes the audio up). */
export const silentAudio = () => new Proxy({ muted: true, ready: false, blowTime: 0 }, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve()) });
/** A YouTube player that never plays (no players are made in the preview). */
export const silentTube = () => ({ available: false, wanted: false, prepare() {}, show() {}, play: () => false, stop() {}, destroy() {}, setMuted() {} });

/** The leaf paths whose value differs between two contents ('name', 'photos.2.caption', 'plan.1.time', ...). */
function changedPaths(a, b, base = '', out = []) {
  if (a === b) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) changedPaths(a[k], b[k], base ? `${base}.${k}` : k, out);
    return out;
  }
  out.push(base);
  return out;
}

/**
 * `apply(paths)` repaints the 3D things that show those paths (main.js; the private studio's editor uses it too).
 * `capture(pose, fov, size)` renders the scene from a pose into a picture (for the saved photo).
 */
export function startPreview({ R, story, ui, o, content, apply, director, capture, yard }) {
  let scene = null, sub = null, token = 0;
  const chapter = (id) => story.chapters.findIndex((c) => c.id === id);
  // (the story marks the page 'moving' while the camera glides to a chapter)
  const settled = async (t) => { do await wait(0.12); while (t === token && document.body.classList.contains('moving')); return t === token; };
  const potionShot = () => {   // the ghost's scroll, close up (as the potion ends)
    const p = o.potion, pt = portrait(), at = p.scrollPoint;
    return { pos: at.clone().addScaledVector(p.facing, pt ? 1.55 : 1.25).add(V(0, 0.06, 0)), target: at.clone(), fov: 36, ...(pt ? { portraitFov: 54 } : { frameX: -0.08 }) };
  };
  const finale = () => ui.showFinale({ onAgain: () => {}, onCapture: () => {} });   // (nothing in the preview is pressed)
  // the plan is up as soon as the camera arrives (the stones don't rise one by one in the preview)
  story.raiseStones = async () => { if (!o.graves.risen) o.graves.complete(); story.refreshCard(); };

  // the first screen, as it is before the gate opens
  function intro() {
    const prev = story.current;
    prev?.leave?.();
    story.index = -1; story._token = (story._token || 0) + 1;
    document.body.classList.remove('moving');
    ui.closeSheets(); ui.hideCard(); ui.hideFinale();
    const el = ui.el.intro;
    el.hidden = false; el.style.transition = 'opacity .6s'; el.style.opacity = '1';
    ui._fillIntro();
    ui.el.nav.hidden = true;
    if (prev) director.moveTo(story.intro.shot, 2.4); else director.cut(story.intro.shot);
  }

  async function show(s, sb = null) {
    if (s === scene && sb === sub) return;
    const t = ++token; scene = s; sub = sb;
    if (s === 'intro') return intro();
    if (!ui.el.intro.hidden) { ui.el.intro.hidden = true; clearInterval(ui._wordTimer); }
    const i = chapter(s);
    if (i < 0) return;
    if (story.current?.id !== s) story.goTo(i);
    if (sb == null || !await settled(t)) return;
    // the part of the chapter the step is about (what a tap would show)
    if (s === 'letter' && sb === 'read') story.openLetter();
    else if (s === 'moments' && Number.isInteger(sb)) story.showPhoto(sb);
    else if (s === 'pumpkin' && sb === 'carve') story.carve();
    else if (s === 'potion' && sb === 'open') {
      // straight to the ghost holding up the scroll (no ingredients to throw in the preview)
      if (!o.potion.done) { o.potion.complete(); o.potion.faceTowards(director.currentPos()); }
      await director.moveTo(potionShot(), 1.6);
      if (t === token) ui.showCard(story._potionCard(), { reveal: true });
    } else if (s === 'date') {
      // the crypt (the night) or the stones (the plan)
      if (sb === 'crypt' && !story._atCrypt) story.toCrypt();
      else if (sb === 'plan' && story._atCrypt) story.backToStones();
    }
  }

  function setContent(c) {
    const paths = changedPaths(content, c);
    if (!paths.length) return;
    replaceContent(content, c);
    apply(paths);
    if (paths.some((p) => p === 'name' || p.startsWith('intro.'))) ui._fillIntro();
    // the words on screen (chapter text, closing words) change in place, so a letter stays open
    for (const el of document.querySelectorAll('#chapter [data-k], #finale [data-k]')) {
      if (el.dataset.kind === 'date') continue;
      const v = getPath(content, el.dataset.k);
      if (v != null && typeof v !== 'object') el.textContent = String(v);
    }
    // (words the card writes without a marker: the night's name over the crypt, the carved pumpkin's, the closing title)
    const id = story.current?.id;
    if ((id === 'date' && paths.some((p) => p === 'date.iso' || p === 'date.label')) || (id === 'pumpkin' && o.carving.carved && paths.some((p) => p.startsWith('magic.')))) story.refreshCard();
    if (id === 'finale' && paths.includes('finale.title') && !ui.el.finale.hidden) finale();
  }

  /** The frame changed shape (phone ↔ computer): the same place, framed for the new screen (once the camera has
   *  arrived: cutting into a glide would stop it short, and what waits for the arrival would never come). */
  function reframe() {
    R.resize();
    if (gsap.isTweening(director._st)) { clearTimeout(reframe.t); reframe.t = setTimeout(reframe, 250); return; }
    if (story.index < 0) { director.cut(story.intro.shot); return; }
    const ch = story.current;
    if (ch.id === 'moments' && story.photoIndex >= 0) story.showPhoto(story.photoIndex);
    else if (ch.id === 'potion' && o.potion.done) director.cut(potionShot());
    else if (ch.id === 'date' && story._atCrypt) { story._atCrypt = false; story.toCrypt(); }
    else director.cut(story._shot(ch));
  }

  /** The saved photo, as it would come out now: the view through the old camera (a ghost creeps in), on the poster. */
  async function picture() {
    if (!o.carving.carved) o.carving.complete();   // (the name is always carved at the end)
    const cam = o.spirit, { pos, look } = cam.eyePose(), up = V(0, 1, 0);
    const pose = { pos: pos.clone(), quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, up)) };
    cam.photobomb(true, pose);
    const shot = await capture(pose, LENS_FOV, 1024);
    cam.photobomb(false);
    // (the same poster backdrop as story.js's captureMoment)
    const poster = story.posterShot();
    story.posers.show(true, poster);
    const hidden = [...o.fireworks.bursts.map((b) => b.pts), yard.bats.group].filter((x) => x.visible);
    hidden.forEach((x) => { x.visible = false; });
    const bg = await capture({ pos: poster.pos, quat: poster.quat }, poster.fov, { w: 540, h: 960 });
    story.posers.show(false);
    hidden.forEach((x) => { x.visible = true; });
    bg.moon = story.posterMoon(poster);
    const cv = await drawStoryImage({ photo: shot, bg, content, base: import.meta.env.BASE_URL });
    return new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.85));
  }

  ui._fillIntro();
  intro();
  window.__ez = { show, setContent, reframe, picture, dpr: (v) => { R.forceDpr = v; R.resize(); } };
}
