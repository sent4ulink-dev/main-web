// The card as the editor's live preview (?embed=1, inside the editor's frame): the same card, running, with no
// porch button, no sound and no host controls. The editor (live-preview.js) tells it which part to show and
// hands it the words as they are typed; everything on screen (the chalkboard, the porch, the plaque, the TV,
// the chapter text, the closing words) follows at once.
import { Vector3, Quaternion, Matrix4 } from 'three';
import gsap from 'gsap';
import { replaceContent } from './content-core.js';
import { drawStoryImage } from './storyImage.js';

const portrait = () => innerWidth / innerHeight < 1.1;

/** A sound engine that makes no sound (the preview is silent; no tap ever wakes the audio up). */
export const silentAudio = () => new Proxy({ muted: true, ready: false }, { get: (t, k) => (k in t ? t[k] : () => {}) });

export function startPreview({ R, story, ui, o, content, roster, repo, photos, director, world, camera, capture }) {
  let scene = null, sub = null, introKey = '', signDue = false;

  // the porch: the invitation's first screen (as it is before "Come on in")
  function porch() {
    const prev = story.current;
    prev?.leave?.(null);
    story.index = -1; story._token = (story._token || 0) + 1;
    ui.closeSheets(); ui.hint(null); ui.hideCard(); ui.hideFinale();
    world.life.setMode('table');
    const intro = ui.el.intro;
    intro.hidden = false; intro.style.transition = 'opacity .6s'; intro.style.opacity = '1';
    ui.el.topbar.hidden = true; ui.el.nav.hidden = true;
    story.intro.shot.portraitFov = portrait() ? 64 : undefined;
    // (from inside the house, out through the front door)
    if (prev) director.moveTo({ ...story.intro.shot, ...(director.camera.position.z < 0 ? { via: new Vector3(0, 1.95, -0.4) } : {}) }, 2.6);
    else director.cut(story.intro.shot);
    story._walkIn = true;   // (in again from the porch: through the front door)
  }

  function show(s, sb = null) {
    if (s === scene && sb === sub) return;
    scene = s; sub = sb;
    if (s === 'intro') return porch();
    if (!ui.el.intro.hidden) ui.hideIntro();
    if (s === 'dress') {
      // someone being dressed up: up from the table, into the dressing corner
      story._previewDress = sb;
      const g = roster.byId(sb); if (!g) return;
      if (story.current?.id === 'you') { story._youStep = 'dress'; story._standUp(g); director.moveTo(story._shot(story.current), 1.0); return; }
      s = 'you';
    }
    if (s === 'gameday') {
      if (story.current?.id === 'gameday') { if (sb && story._tvChannel !== sb) story.channel(sb); return; }
      story._tvChannel = sb || 'parade';
    }
    const i = story.chapters.findIndex((c) => c.id === s);
    if (i >= 0) story.goTo(i);
  }

  /** The board shows the new words (straight away, or once the chalk that's writing now is done). */
  function board() {
    const s = o.sign;
    if (s.busy) { signDue = true; return; }
    if (s.shown) s.paint(content, s.shown, { greeting: null });
  }
  setInterval(() => { if (signDue && !o.sign.busy) { signDue = false; board(); } }, 200);

  function setContent(c) {
    replaceContent(content, c);
    const k = JSON.stringify([content.intro, content.family]);
    if (k !== introKey) { introKey = k; ui.fillIntro({ who: null }); }
    o.wall.setFamily(content.family);
    board();
    const ch = story.current, card = ch?.card?.();
    if (card && !ui.el.chapter.hidden) ui.updateCard(card);
    if (!ui.el.finale.hidden) ui.fillFinale();
  }

  /** The photos on the wall changed (hung or taken down in the editor). */
  async function setPhotos(list) {
    const old = roster.photos || [];
    roster.photos = list;
    for (let n = 0; n < Math.max(old.length, list.length); n++) {
      if ((old[n] || 0) === (list[n] || 0)) continue;
      await photos._show(n, list[n] ? await repo.photoBlob(n, list[n]) : null);
    }
    if (story.current?.id === 'family') ui.updateCard(story._wallCard());
  }

  /** The guest list changed (saved in the editor): everyone takes their seat again. */
  function setGuests(list, party) {
    roster.guests = list.map((g) => ({ ...g, look: g.look || null }));
    roster.party = party;
    story.reseat();
    const ch = story.current, card = ch?.card?.();
    if (card && !ui.el.chapter.hidden) ui.updateCard(card);
  }
  /** One person's look, as it is being picked (they bounce a little with each change). */
  function setLook(id, look) {
    const g = roster.byId(id); if (g) g.look = look;
    const a = world.actors.get(id) || (story._standIn?.id === id ? story._standIn : null);
    a?.set(look);
  }

  /** The frame changed shape (phone ↔ computer): the same place, framed for the new screen (once the camera
   *  has arrived: cutting into a glide would stop it short, and what waits for the arrival would never come). */
  function reframe() {
    R.resize();
    if (gsap.isTweening(director._st)) { clearTimeout(reframe.t); reframe.t = setTimeout(reframe, 250); return; }
    if (story.index < 0) { story.intro.shot.portraitFov = portrait() ? 64 : undefined; director.cut(story.intro.shot); return; }
    const ch = story.current;
    director.cut(ch.id === 'gameday' && story._tvWideNow ? story._tvWide(portrait()) : story._shot(ch));
  }

  /** "Save the picture", as it would come out now: the family through the tripod's lens, with the words round it. */
  // The 3D snapshot is taken again only when something it shows has changed: typing the picture's own words (share.*)
  // just redraws them over the same snapshot. (Each snapshot briefly re-sizes the card's drawing buffers, which a phone
  // can't afford after every pause in typing.)
  let snap = null;
  async function picture() {
    const key = JSON.stringify([{ ...content, share: null }, story.current?.id, camera.position.toArray().map((v) => v.toFixed(2)), world.seated.length]);
    if (snap?.key !== key) snap = { key, shot: await snapshot() };
    const cv = await drawStoryImage({ photo: snap.shot, content, people: world.seated.length, base: import.meta.env.BASE_URL });
    return new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.85));
  }
  async function snapshot() {
    const size = portrait() ? { w: 960, h: 1280 } : { w: 1280, h: 960 };
    let pose = { pos: camera.position.clone(), quat: camera.quaternion.clone() }, fov = camera.fov;
    const outside = story.current?.id === 'photo';
    if (outside) {
      const { eye, look, fov: f } = story._photoEye();
      pose = { pos: eye, quat: new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(eye, look, new Vector3(0, 1, 0))) }; fov = f;
      o.tripod.show(false);   // (looking through it)
    }
    const shot = await capture(pose, fov, size);
    if (outside && story.current?.id === 'photo') o.tripod.show(true);
    return shot;
  }

  ui.fillIntro({ who: null });
  porch();
  window.__ez = { show, setContent, setPhotos, setGuests, setLook, reframe, picture, dpr: (v) => { R.forceDpr = v; R.resize(); } };
}
