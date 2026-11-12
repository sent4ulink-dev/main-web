// The card as the editor's live preview (?embed=1, inside the editor's frame): the same salon, running, with no sound,
// no owner bar and nothing to press. The editor (live-preview.js) tells it which part to show and hands it the words as
// they are typed; everything that shows them (the letter, the quill's golden stars, the casket's scroll, the portraits,
// the calendar, the chapter text, the first screen and the closing words) follows at once.
import * as THREE from 'three';
import gsap from 'gsap';
import { getPath, replaceContent } from './content-core.js';
import { drawStoryImage } from './storyImage.js';
import { PAINT_FOV } from '../story/story.js';

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

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
 * `capture(pose, fov, size)` renders the scene from a pose into a square picture (for the saved picture).
 */
export function startPreview({ R, story, ui, o, content, apply, director, capture }) {
  let scene = null, sub = null, token = 0;
  const chapter = (id) => story.chapters.findIndex((c) => c.id === id);
  // (the story marks the page 'moving' while the camera glides to a chapter)
  const settled = async (t) => { do await wait(0.12); while (t === token && document.body.classList.contains('moving')); return t === token; };

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
    else if (s === 'wishes' && sb === 'open') story.openCasket();
    else if (s === 'quill' && sb === 'stars') { if (o.quill.written) story.lookAtStars(); else story.writeName(); }
  }

  function setContent(c) {
    const paths = changedPaths(content, c);
    if (!paths.length) return;
    replaceContent(content, c);
    apply(paths);
    if (paths.some((p) => p === 'name' || p.startsWith('intro.'))) ui._fillIntro();
    // the words on screen (chapter text, closing words) change in place, so a letter stays open and the stars stay up
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
    if (ch.id === 'quill' && story._starsShown) director.cut(story._heartShot());
    else if (ch.id === 'moments' && story.photoIndex >= 0) story.showPhoto(story.photoIndex);
    else director.cut(story._shot(ch));
  }

  /** "Save the picture", as it would come out now: the evening from the painter's place, with the words round it. */
  // The 3D snapshot is taken again only when something it shows has changed: typing the picture's own words (share.*)
  // just redraws them over the same snapshot. (Each snapshot briefly re-sizes the card's drawing buffers, which a phone
  // can't afford after every pause in typing.)
  let snap = null;
  async function picture() {
    story._ensureStars();   // (the name always hangs in the stars at the end)
    const key = JSON.stringify({ ...content, share: null });
    if (snap?.key !== key) {
      const { pos, look } = story.painterPose;
      const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0)));
      snap = { key, shot: await capture({ pos: pos.clone(), quat }, PAINT_FOV, 1024) };
    }
    const shot = snap.shot;
    const cv = await drawStoryImage({ photo: shot, content, base: import.meta.env.BASE_URL });
    return new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.85));
  }

  ui._fillIntro();
  intro();
  window.__ez = { show, setContent, reframe, picture, dpr: (v) => { R.forceDpr = v; R.resize(); } };
}
