// The card as the editor's live preview (?embed=1, inside the editor's frame): the same base, running, with no sound,
// no owner bar and nothing to press. The editor (live-preview.js) tells it which part to show and hands it the words as
// they are typed; everything that shows them (the dossier, the name on the wall, the loot case, the polaroids, the
// timer, the chapter text, the first screen and the closing words) follows at once.
import * as THREE from 'three';
import gsap from 'gsap';
import { getPath, replaceContent } from './content-core.js';
import { drawStoryImage } from './storyImage.js';
import { SCOPE_FOV } from '../story/story.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const portrait = () => innerWidth / innerHeight < 1.1;

/** A sound engine that makes no sound (the preview is silent; no tap ever wakes the audio up). */
export const silentAudio = () => new Proxy({ muted: true, ready: false, blowTime: 0 }, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve()) });
/** A YouTube player that never plays (no players are made in the preview). */
export const silentTube = () => ({ available: false, wanted: false, prepare() {}, show() {}, play: () => false, stop() {}, destroy() {}, setMuted() {} });

/** The leaf paths whose value differs between two contents ('name', 'photos.2.caption', 'intro.words.1', ...). */
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
 * `capture(pose, fov, size)` renders the scene from a pose into a picture (for the saved picture).
 */
export function startPreview({ R, story, ui, o, content, apply, director, capture }) {
  let scene = null, sub = null, token = 0;
  const chapter = (id) => story.chapters.findIndex((c) => c.id === id);
  // (the story marks the page 'moving' while the camera glides to a chapter)
  const settled = async (t) => { do await wait(0.12); while (t === token && document.body.classList.contains('moving')); return t === token; };
  // the date step shows the day itself, not the defuse game (no timer counts down in the preview)
  story.armTimer = () => {};
  story._timerCard = () => ({ eyebrow: '', title: '', body: story._dateBody() });

  // the first screen, as it is before "Open your gift"
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
    else if (s === 'wishes' && sb === 'open') story.openCase();
    else if (s === 'spray' && sb === 'stars') { if (o.spray.state === 'done') story.lookAtWall(); else story.fireSpray(); }
  }

  function setContent(c) {
    const paths = changedPaths(content, c);
    if (!paths.length) return;
    replaceContent(content, c);
    apply(paths);
    if (paths.some((p) => p === 'name' || p.startsWith('intro.'))) ui._fillIntro();
    // the words on screen (chapter text, closing words) change in place, so a letter stays open and the wall stays in view
    for (const el of document.querySelectorAll('#chapter [data-k], #finale [data-k]')) {
      if (el.dataset.kind === 'date') continue;
      const v = getPath(content, el.dataset.k);
      if (v != null && typeof v !== 'object') el.textContent = String(v);
    }
    if (paths.includes('date.iso') && story.current?.id === 'date') story.refreshCard();
  }

  /** The frame changed shape (phone ↔ computer): the same place, framed for the new screen (once the camera has
   *  arrived: cutting into a glide would stop it short, and what waits for the arrival would never come). */
  function reframe() {
    R.resize();
    if (gsap.isTweening(director._st)) { clearTimeout(reframe.t); reframe.t = setTimeout(reframe, 250); return; }
    if (story.index < 0) { director.cut(story.intro.shot); return; }
    const ch = story.current;
    if (ch.id === 'spray' && story._onWall) director.cut(portrait() ? story.wallShotPortrait : story.wallShot);
    else if (ch.id === 'moments' && story.photoIndex >= 0) story.showPhoto(story.photoIndex);
    else if (ch.id === 'wishes' && o.loot.opened) {
      // the prize card, close up (as the case opening ends)
      const wp = o.loot.winnerPoint, p = portrait();
      director.cut({ pos: wp.clone().addScaledVector(story.nCase, p ? 1.45 : 1.1).add(V(0, 0.05, 0)), target: wp.clone(), fov: 36, ...(p ? { portraitFov: 56 } : { frameX: 0 }) });
    } else director.cut(story._shot(ch));
  }

  /** The saved picture, as it would come out now: the last shot through the scope, on the courtyard at dusk. */
  async function picture() {
    if (o.spray.state !== 'done') o.spray.complete();   // (the name is always on the wall at the end)
    const { pos, look } = o.sniper.eyePose(), up = V(0, 1, 0);
    o.sniper.setVisible(false);
    const shot = await capture({ pos: pos.clone(), quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, up)) }, SCOPE_FOV, 1024);
    o.sniper.setVisible(true);
    const bp = V(2.3, 0.95, 4.4), bl = V(-1.9, 2.5, -5.2);   // (the same backdrop as story.js's captureMoment)
    const bg = await capture({ pos: bp, quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(bp, bl, up)) }, 62, { w: 540, h: 960 });
    const cv = await drawStoryImage({ photo: shot, bg, content, base: import.meta.env.BASE_URL });
    return new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.85));
  }

  ui._fillIntro();
  intro();
  window.__ez = { show, setContent, reframe, picture, dpr: (v) => { R.forceDpr = v; R.resize(); } };
}
