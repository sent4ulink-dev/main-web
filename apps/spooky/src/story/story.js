import * as THREE from 'three';
import gsap from 'gsap';
import { esc } from '../ui/ui.js';
import { drawStoryImage, canvasToFile, shareOrDownload } from '../share/storyImage.js';
import { getPath } from '../share/content-core.js';
import { downloadICS } from '../objects/graves.js';
import { MOON_DIR } from '../world/nightsky.js';
import { monthDay } from '../util/textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const LENS_FOV = 44;                        // the box camera's view
const portraitScreen = () => innerWidth / innerHeight < 1.1;

/** A shot that looks at `at` from `dist` metres along the horizontal normal `n`, raised by `up`. */
function front(at, n, dist, up, fov, extra = {}) {
  return { pos: at.clone().addScaledVector(n, dist).add(V(0, up, 0)), target: at.clone(), fov, ...extra };
}
const normalOf = (yaw) => V(Math.sin(yaw), 0, Math.cos(yaw));

/**
 * Halloween night on the haunted hill, chapter by chapter: the invitation in the coffin mailbox, the name carved
 * into the giant pumpkin, our memories hanging from the dead tree, the date plan rising out of the graves, the
 * witch's cauldron (and its ghost with a wish), the haunted gramophone, trick or treat on the mansion's porch, bats
 * round the moon and fireworks — and a spirit photograph to keep, with an uninvited guest in it.
 */
export class Story {
  constructor(ctx) {
    Object.assign(this, ctx); // director, ui, audio, o (objects), content, presenter, capture(), tube, mediaURL, yard
    this.index = -1;
    this.viewfinder = null;    // while set, main.js looks through the box camera
    this.shake = 0;            // camera shake (metres), read and decayed by main.js
    this._build();
  }

  _build() {
    const o = this.o, yard = this.yard;
    this.intro = { shot: { pos: V(0.4, 1.85, 12.6), target: V(-0.2, 3.6, -10), fov: 50 } };
    this.introLabel = { at: V(0, 4.2, 2), r: 0, place: 'center', placePortrait: 'center' };
    this.photoIndex = -1;

    const letterAt = o.letter.group.position.clone();
    const nMail = normalOf(yard.o.mailbox.rotation.y);
    const pumpkinAt = o.carving.focusPoint, nPumpkin = o.carving.faceNormal;
    const potAt = o.potion.focusPoint.lerp(o.potion.tablePoint, 0.42), nPot = normalOf(yard.o.cauldron.rotation.y);   // the pot and its table
    const gramAt = o.gram.focusPoint, nGram = o.gram.normal;
    const bucketAt = o.trick.focusPoint, nBucket = o.trick.normal;
    const graves = o.graves, stonesAt = graves.centre;
    this.datesShot = { pos: V(-1.65, 2.6, 5.64), target: V(2.05, 0.45, 0.1), fov: 56, frameX: -0.21 };
    this.datesShotPortrait = { pos: V(-0.85, 2.35, 4.55), target: V(2.2, -0.35, 0.15), fov: 46, portraitFov: 74 };
    const skyFrom = V(0.7, 1.3, 2.6);

    this.chapters = [
      {
        id: 'letter', navTitle: 'Invitation',
        shot: front(letterAt.clone().add(V(0, 0.02, 0)), nMail, 1.85, 0.2, 34, { frameX: -0.12 }),
        shotPortrait: front(letterAt.clone().add(V(0, 0.0, 0)), nMail, 2.3, 0.25, 34, { portraitFov: 54 }),
        hits: () => o.letter.hitTargets.concat(o.mailbox.hitTargets),
        enter: () => this._letterCard(),
        arrive: () => this.openCoffin(),
        label: () => (o.letter.reading ? { at: o.letter.letterCenter, r: 0.08, place: 'side', placePortrait: 'below' } : { at: o.letter.focusPoint, r: 0.12 }),
        onHit: () => (o.letter.reading ? this.closeLetter() : this.openLetter()),
        leave: () => { if (o.letter.reading) this.closeLetter(true); },
      },
      {
        id: 'pumpkin', navTitle: 'Pumpkin',
        shot: front(pumpkinAt, nPumpkin, 3.1, 0.55, 38, { frameX: -0.1 }),
        shotPortrait: front(pumpkinAt, nPumpkin, 3.9, 0.75, 38, { portraitFov: 62 }),
        hits: () => o.carving.hitTargets,
        enter: () => this._pumpkinCard(),
        label: () => ({ at: pumpkinAt.clone().add(V(0, 0.05, 0)), r: 1.0, place: 'side', placePortrait: 'below' }),
        onHit: () => this.carve(),
      },
      {
        id: 'moments', navTitle: 'Memories',
        shot: o.photos.treeShot(false), shotPortrait: o.photos.treeShot(true),
        hits: () => o.photos.cards.map((p) => p.card),
        enter: () => { this.photoIndex = -1; return { eyebrow: 'Hanging in the tree', title: 'Our memories', body: '', actions: this._photoActions() }; },
        label: () => {
          const p = o.photos;
          if (this.photoIndex >= 0) { const c2 = p.ordered[this.photoIndex]; return { at: c2.card.getWorldPosition(V(0, 0, 0)), r: Math.max(c2.w, c2.h) * 0.62 }; }
          return { at: p.focusPoint, r: 1.2, place: 'side', placePortrait: 'below' };
        },
        onHit: (mesh) => {
          const i = o.photos.ordered.findIndex((p) => p.card === mesh);
          if (i >= 0) this.showPhoto(i);
        },
      },
      {
        id: 'date', navTitle: 'Plan',
        shot: this.datesShot, shotPortrait: this.datesShotPortrait,
        hits: () => [],
        enter: () => this._dateCard(),
        arrive: () => this.raiseStones(),
        label: () => (this._atCrypt ? { at: graves.plaquePoint, r: 0.7, place: 'below', placePortrait: 'below' } : { at: stonesAt, r: 2.4, place: 'side', placePortrait: 'below' }),
        leave: () => { this._atCrypt = false; },
      },
      {
        id: 'potion', navTitle: 'Cauldron',
        shot: front(potAt, nPot, 2.55, 0.8, 40, { frameX: -0.1 }),
        shotPortrait: front(potAt, nPot, 3.3, 0.95, 40, { portraitFov: 64 }),
        hits: () => o.potion.hitTargets,
        enter: () => this._potionCard(),
        label: () => (o.potion.done ? { at: o.potion.scrollPoint, r: 0.45, place: 'side', placePortrait: 'below' } : { at: potAt.clone().add(V(0, 0.2, 0)), r: 0.8, place: 'side', placePortrait: 'below' }),
        arrive: () => { o.potion.faceTowards(this.director.currentPos()); this.audio.startBubbling(); },
        onHit: (mesh) => this.addIngredient(mesh.userData.item ?? o.potion.nextItem()),
        // pick an ingredient up off the table and throw it into the pot (a tap just tosses it in)
        grab: (mesh) => mesh.userData.item !== undefined && !this._adding && o.potion.grab(mesh.userData.item) && (this.audio.pop(1.2), true),
        dragPoint: () => o.potion.heldPoint,
        drag: (p) => o.potion.dragTo(p),
        release: () => this.addIngredient(-1, 'held'),
        leave: () => { this.audio.stopBubbling(); if (o.potion.held >= 0) o.potion.release(); },
      },
      {
        id: 'music', navTitle: 'Record',
        shot: front(gramAt, nGram, 3.1, 0.75, 42, { frameX: -0.1 }),
        shotPortrait: front(gramAt, nGram, 3.9, 0.9, 42, { portraitFov: 66 }),
        hits: () => o.gram.hitTargets,
        enter: () => {
          this.tube.prepare(this.content.song.youtube);
          this.tube.show(true);
          return { eyebrow: '', title: 'Spooky Tunes', body: '<p class="hand no-edit">Spin the record and make the ghosts dance.</p>', actions: this._songActions() };
        },
        label: () => ({ at: gramAt.clone().add(V(0, 0.1, 0)), r: 0.9, place: 'side', placePortrait: 'below' }),
        onHit: () => this.toggleSong(),
        leave: () => { this.stopSong(); this.tube.show(false); },
      },
      {
        id: 'trick', navTitle: 'Trick?',
        shot: front(bucketAt, nBucket, 2.4, 0.95, 40, { frameX: -0.1 }),
        shotPortrait: front(bucketAt, nBucket, 2.9, 1.1, 40, { portraitFov: 64 }),
        hits: () => o.trick.hitTargets,
        enter: () => this._trickCard(),
        label: () => ({ at: bucketAt.clone().add(V(0, 0.1, 0)), r: 0.45, place: 'side', placePortrait: 'below' }),
        onHit: () => this.treat(),
      },
      {
        // bats gather round the moon as a heart; fireworks over the hill
        id: 'sky', navTitle: 'Moon', duration: 3.6,
        shot: { pos: skyFrom, target: skyFrom.clone().addScaledVector(MOON_DIR, 30).add(V(0, -3.0, 0)), fov: 46 },
        shotPortrait: { pos: skyFrom.clone().add(V(0, 0, 1.5)), target: skyFrom.clone().addScaledVector(MOON_DIR, 30).add(V(0, -2.5, 0)), fov: 46, portraitFov: 66 },
        hits: () => [],
        enter: () => null,
        label: () => null,
        arrive: () => this.startSky(),
        leave: () => queueMicrotask(() => { if (!['sky', 'finale'].includes(this.current?.id)) this.stopShow(); }),
      },
      {
        id: 'finale', navTitle: 'Finale', duration: 3.8,
        shot: { pos: V(-1.5, 2.3, 12.9), target: V(0.9, 2.9, -8), fov: 54 },
        shotPortrait: { pos: V(-1.0, 2.25, 13.8), target: V(0.8, 3.2, -8), fov: 54, portraitFov: 82, mobileOffset: V(0, 0.5, 0) },
        hits: () => (this._capturing ? [] : o.spirit.hitTargets),
        enter: () => null,
        label: () => this._capLabel?.() || null,
        arrive: () => this.startFinale(),
        onHit: () => this.captureMoment(),
        leave: () => this.endFinale(),
      },
    ];
  }

  /** A content field, rendered so the owner can edit it in place (inline editing). */
  k(path) { return `<span data-k="${path}">${esc(getPath(this.content, path) ?? '')}</span>`; }
  _shot(ch) { return portraitScreen() && ch.shotPortrait ? ch.shotPortrait : ch.shot; }
  labelAnchor() { return this.current?.label?.() || null; }
  refreshCard() { const card = this.current?.enter(); if (card) this.ui.showCard(card, { reveal: true }); }
  get editing() { return document.body.classList.contains('editing'); }

  // ── the gate ─────────────────────────────────────────
  openGate() {
    if (this._gateOpen) return;
    this._gateFresh = true;
    this._gateOpen = true;
    const { gateL, gateR } = this.yard.o;
    this.audio.creak(1.8);
    if (gateL) gsap.to(gateL.rotation, { y: -1.75, duration: 2.6, ease: 'power2.inOut' });   // swinging out toward you
    if (gateR) gsap.to(gateR.rotation, { y: 1.7, duration: 2.8, delay: 0.15, ease: 'power2.inOut' });
  }

  // ── the invitation ───────────────────────────────────
  openCoffin() {
    const m = this.o.mailbox;
    if (m.opened) return;
    m.opened = true;
    this.audio.creak(1.1, 0.7);
    if (m.lid) gsap.to(m.lid.rotation, { y: -2.25, duration: 1.6, ease: 'back.out(1.2)' });
    if (m.glow) gsap.to(m.glow.material, { opacity: 0.22, duration: 1.2, delay: 0.3 });
  }

  _letterCard() {
    const o = this.o;
    return { eyebrow: '', title: '', body: '', actions: [{ label: o.letter.opened ? 'Read again' : 'Open the invitation', icon: '✉', primary: true, onClick: () => this.openLetter() }] };
  }

  async openLetter() {
    const o = this.o;
    if (o.letter.reading || this._letterBusy) return;
    this._letterBusy = true;
    this.openCoffin();
    this.audio.paper();
    this.ui.holdCard();
    const first = !o.letter.opened;
    document.body.classList.add('reading');
    const opening = this._opening = o.letter.open(() => { this.director.focusOverride = 0.5; });
    await wait(first ? 3.4 : 2.4);
    if (this.current?.id === 'letter') {
      this.ui.showCard({ eyebrow: '', title: '', body: '', actions: [{ label: 'Close the invitation', icon: '✉', primary: true, onClick: () => this.closeLetter() }] });
      this.ui.revealCard();
    }
    await opening;
    this._letterBusy = false;
  }

  async closeLetter(leaving = false) {
    const o = this.o;
    if (leaving && this._letterBusy) await this._opening;
    if (!o.letter.reading || (this._letterBusy && !leaving)) return;
    this._letterBusy = true;
    this.audio.paper();
    this.director.focusOverride = null;
    document.body.classList.remove('reading');
    if (!leaving) this.ui.holdCard();
    await o.letter.close();
    this._letterBusy = false;
    if (!leaving && this.current?.id === 'letter') { this.ui.showCard(this._letterCard()); this.ui.revealCard(); }
  }

  // ── the pumpkin ──────────────────────────────────────
  _pumpkinCard() {
    const c = this.content.magic;
    if (this.o.carving.carved) return { eyebrow: '', title: esc(c.reveal), body: `<p class="hand no-edit">${esc(c.note)}</p>`, actions: [] };
    return { eyebrow: '', title: '', body: `<p class="hand no-edit">${esc(c.hint)}</p>`, actions: [{ label: 'Carve', icon: '🔪', primary: true, onClick: () => this.carve() }] };
  }

  async carve() {
    const o = this.o, A = this.audio;
    if (o.carving.carved) return;
    const ch = this.index;
    this.ui.holdCard();
    this.ui.setActions([]);
    await o.carving.carve(4.6, (c) => A.knife(c));
    if (this.index !== ch) return;
    A.ignite();
    o.sparkles.burst(o.carving.focusPoint.add(V(0, 0.3, 0)));
    this.ui.showCard(this._pumpkinCard(), { reveal: true });
  }

  // ── the memories ─────────────────────────────────────
  _photoActions() {
    const n = this.o.photos.cards.length, i = this.photoIndex;
    if (i < 0) return [{ label: 'Take a closer look', icon: '🔍', primary: true, onClick: () => this.showPhoto(0) }];
    return [
      { label: '‹ Previous', disabled: i <= 0, onClick: () => this.showPhoto(i - 1) },
      { label: 'Next ›', primary: true, disabled: i >= n - 1, onClick: () => this.showPhoto(i + 1) },
      { label: 'All photos', onClick: () => this.allPhotos() },
    ];
  }

  showPhoto(i) {
    const p = this.o.photos, n = p.cards.length;
    if (i < 0 || i >= n) return;
    this.photoIndex = i;
    this.ui.holdCard();
    const card = p.ordered[i];
    this.audio.whoosh();
    this.director.moveTo(p.shotFor(i), 2.0).then(() => {
      if (this.current?.id !== 'moments' || this.photoIndex !== i) return;
      this.ui.setTitle(this.k(`photos.${p.cards.indexOf(card)}.caption`));
      this.ui.setBody('');
      this.ui.setActions(this._photoActions());
      this.ui.revealCard();
    });
  }

  allPhotos() {
    this.photoIndex = -1;
    this.ui.showCard(this.current.enter());
    this.director.moveTo(this._shot(this.current), 2.0).then(() => { if (this.current?.id === 'moments' && this.photoIndex < 0) this.ui.revealCard(); });
  }

  // ── the date plan ────────────────────────────────────
  _planBody() {
    const rows = this.content.plan.map((p, i) => `<li><span class="plan-time" data-k="plan.${i}.time">${esc(p.time)}</span><span class="plan-title" data-k="plan.${i}.title">${esc(p.title)}</span></li>`).join('');
    return `<ul class="plan">${rows}</ul>`;
  }

  _dateBody() {
    const d = new Date(`${this.content.date.iso}T12:00:00`);
    return `<div class="big-date"><span data-k="date.iso" data-kind="date">${monthDay(d)}</span></div><p class="hand">${this.k('date.note')}</p>`;
  }

  _dateCard() {
    const g = this.o.graves;
    if (!g.risen && !this.editing) return { eyebrow: '', title: '', body: '', actions: [] };
    if (this._atCrypt) {
      return { eyebrow: esc(this.content.date.label), title: '', body: this._dateBody(), actions: [
        { label: 'Add to calendar', icon: '📅', primary: true, onClick: () => this.saveCalendar() },
        { label: '‹ Plan', onClick: () => this.backToStones() },
      ] };
    }
    return { eyebrow: 'Our plan for the night', title: '', body: this._planBody(), actions: [
      { label: 'Date', icon: '🕯', primary: true, onClick: () => this.toCrypt() },
      { label: 'Add to calendar', icon: '📅', onClick: () => this.saveCalendar() },
    ] };
  }

  async raiseStones() {
    const g = this.o.graves, A = this.audio;
    if (g.risen) return;
    if (this.editing) { g.complete(); this.refreshCard(); return; }
    const ch = this.index;
    this.ui.holdCard();
    A.thunder(0.2, 0.7);
    await g.riseAll({
      onRumble: () => { A.rumble(); this.shake = Math.max(this.shake, 0.012); },
      onBreak: () => { A.thud(); this.shake = Math.max(this.shake, 0.03); },
    });
    if (this.index !== ch) return;
    this.audio.tada('a', 0.35);
    this.ui.showCard(this._dateCard(), { reveal: true });
  }

  async toCrypt() {
    const g = this.o.graves;
    this.ui.holdCard();
    this._atCrypt = true;
    const portrait = portraitScreen();
    const shot = front(g.plaquePoint.add(V(0, -0.35, 0)), g.cryptNormal, portrait ? 3.5 : 2.7, -0.55, 42, portrait ? { portraitFov: 62 } : { frameX: -0.12 });
    await this.director.moveTo(shot, 2.4);
    if (this.current?.id !== 'date' || !this._atCrypt) return;
    g.openCrypt(true);
    this.audio.creak(2.2, 0.55);
    this.audio.chime();
    this.ui.showCard(this._dateCard(), { reveal: true });
  }

  async backToStones() {
    this.ui.holdCard();
    this._atCrypt = false;
    this.o.graves.openCrypt(false);
    await this.director.moveTo(this._shot(this.current), 2.2);
    if (this.current?.id === 'date') this.ui.showCard(this._dateCard(), { reveal: true });
  }

  saveCalendar() {
    downloadICS(this.content);
    this.ui.toast('Calendar file ready — open it to save it 📅', 3200);
  }

  // ── the cauldron ─────────────────────────────────────
  _potionCard() {
    const p = this.o.potion;
    if (p.done) return { eyebrow: '', title: '', body: document.body.classList.contains('editing') ? `<p class="hand">✦ ${this.k('wishes.0')}</p>` : '', actions: [] };
    const left = 3 - p.added;
    return { eyebrow: 'Magic potion', title: '', body: `<p class="hand no-edit">Grab an ingredient from the table and toss it into the cauldron — ${left} left.</p>`, actions: [{ label: 'Add an ingredient', icon: '🧪', primary: true, onClick: () => this.addIngredient(p.nextItem()) }] };
  }

  async addIngredient(i, via = 'toss') {
    const p = this.o.potion, A = this.audio;
    if (p.done || this._adding || (via !== 'held' && i < 0)) return;
    this._adding = true;
    if (via !== 'held') A.whoosh();
    const opts = { onSplash: (n) => { A.splash(); A.bubbleBurst(n); } };
    const ok = await (via === 'held' ? p.release(opts) : p.toss(i, opts));
    this._adding = false;
    if (!ok || this.current?.id !== 'potion') return;
    if (p.added < 3) { this.ui.setBody(this._potionCard().body); return; }
    // the last one: smoke, and the ghost comes up with the scroll
    const ch = this.index;
    this.ui.holdCard();
    this.ui.setActions([]);
    await wait(0.4);
    await p.summon({ onRise: () => { A.magicPoof(); A.ghostOoo(); this.shake = 0.015; }, onUnroll: () => { A.paper(); A.tada('c', 0.4); } });
    if (this.index !== ch) return;
    const portrait = portraitScreen();
    await this.director.moveTo(front(p.scrollPoint, p.facing, portrait ? 1.55 : 1.25, 0.06, 36, portrait ? { portraitFov: 54 } : { frameX: -0.08 }), 1.6);
    if (this.index !== ch) return;
    A.sparkle();
    this.ui.showCard(this._potionCard(), { reveal: true });
  }

  // ── the gramophone ───────────────────────────────────
  _songActions() {
    const c = this.content, playing = this.o.gram.playing;
    return [
      ...(c.song.voice ? [{ label: this._songKind === 'voice' && playing ? 'Pause' : 'Hear the whisper', icon: '👻', primary: true, id: 'btn-voice', onClick: () => this.toggleSong('voice') }] : []),
      { label: this._songKind === 'music' && playing ? 'Pause' : 'Spin the record', icon: '♪', primary: !c.song.voice, id: 'btn-song', onClick: () => this.toggleSong('music') },
    ];
  }

  toggleSong(kind = this.content.song.voice ? 'voice' : 'music') {
    const gram = this.o.gram, song = this.content.song;
    if (gram.playing) { const same = this._songKind === kind; this.stopSong(); if (same) return; }
    this._songKind = kind;
    const token = (this._songToken = (this._songToken || 0) + 1);
    const still = () => token === this._songToken && gram.playing;
    gram.play();
    this.audio.needle();
    const voice = song.voice && this.mediaURL(song.voice);
    if (kind === 'voice' && voice) this.audio.playVoice(voice, { ghost: true }).then(() => { if (still()) this.stopSong(); });
    else if (this.tube.play()) this.audio.musicDuck(1);
    else this.audio.playOrgan((m, d) => { if (still()) gram.pulse(Math.min(1, d * 1.5)); });
    // the party arrives: the zombie grunts his way out of the ground, the witch whoops overhead
    setTimeout(() => { if (still()) this.audio.sfx('zombie_grunt', { gain: 0.4 }); }, 600);
    setTimeout(() => { if (still()) this.audio.sfx('witch_yay', { gain: 0.32, verb: 0.4 }); }, 1800);
    setTimeout(() => { if (still()) this.audio.sfx('zombie_laugh', { gain: 0.3 }); }, 4200);
    this._songLabel();
  }

  stopSong() {
    const gram = this.o.gram;
    this._songToken = (this._songToken || 0) + 1;
    if (!gram.playing) return;
    gram.stop();
    this.audio.stopOrgan();
    this.audio.stopVoice();
    this.tube.stop();
    this.audio.musicDuck(0);
    this._songLabel();
  }

  _songLabel() {
    const on = this.o.gram.playing, v = document.getElementById('btn-voice'), m = document.getElementById('btn-song');
    if (v) v.lastChild.textContent = on && this._songKind === 'voice' ? 'Pause' : 'Hear the whisper';
    if (m) m.lastChild.textContent = on && this._songKind === 'music' ? 'Pause' : 'Spin the record';
  }

  // ── trick or treat ───────────────────────────────────
  _trickCard() {
    return { eyebrow: '', title: 'Trick or treat?', body: '', actions: [
      { label: 'Treat', icon: '🍬', primary: true, onClick: () => this.treat() },
      { label: 'Trick', icon: '👻', onClick: () => this.trick() },
    ] };
  }

  async treat() {
    const o = this.o, A = this.audio;
    if (o.trick.busy) return;
    A.candy();
    const p = o.trick.treat();
    o.sparkles.burst(o.trick.focusPoint.add(V(0, 0.3, 0)));
    this.ui.feed(this.content.from, '🍬', `Candy for ${this.content.name}!`, { gold: true });
    await p;
  }

  /**
   * The trick, in beats: the lights die and the music stops; a heartbeat; two red eyes open in the black doorway
   * and the door creaks open as the camera creeps toward it; bats burst out past you; lightning — and the ghost
   * those eyes belonged to flies at your face: BOO (a punch-in, a shake, a red flash). A laugh; the door slams;
   * the lights stutter back on.
   */
  async trick() {
    const o = this.o, A = this.audio, y = this.yard, T = o.trick;
    if (T.busy || this._tricking) return;
    this._tricking = true;
    const ch = this.index, alive = () => this.index === ch;
    this.ui.holdCard();
    A.musicDuck(1);
    y.blackout(7.5);
    A.lightsOut();
    this.ui.dim(true);
    const back = this._shot(this.current);
    await wait(0.7);
    if (!alive()) return this._endTrick();
    A.heartbeat(7);
    // creeping toward the door as it creaks open on the dark… and two red eyes open in there
    T.openDoor(true);
    A.creak(2.4, 0.8);
    const dp = T.doorPoint;
    this.director.moveTo({ pos: dp.clone().add(V(0.15, 0.2, 3.0)), target: dp.clone(), fov: 36, portraitFov: portraitScreen() ? 56 : undefined }, 2.8);
    await wait(1.7);
    if (!alive()) return this._endTrick();
    T.showEyes(true);
    await wait(1.6);
    if (!alive()) return this._endTrick();
    // the bats
    T.batSwarm(1.5);
    A.batFlutter();
    this.shake = 0.02;
    await wait(1.0);
    if (!alive()) return this._endTrick();
    // lightning…
    y.strike({ big: true });
    this.ui.lightning();
    A.thunder(0, 1);
    await wait(0.45);
    T.showEyes(false);
    // …BOO
    await T.trick({
      onBoo: () => {
        A.boo();
        this.shake = 0.14;
        this.punch = 14;
        this.ui.boo('BOO!');
        this.ui.redFlash();
        setTimeout(() => A.cackle(1, 'dracula'), 900);
      },
    });
    if (!alive()) return this._endTrick();
    A.sfx('door_slam', { gain: 0.7, verb: 0.5 });
    T.openDoor(false);
    this.shake = 0.04;
    await wait(0.6);
    this._endTrick();
    await this.director.moveTo(back, 1.8);
    if (this.current?.id === 'trick') this.ui.revealCard();
  }

  _endTrick() {
    this._tricking = false;
    this.o.trick.showEyes(false);
    this.o.trick.openDoor(false);
    this.yard.blackout(0.4);   // the lights stutter back on
    this.ui.dim(false);
    this.audio.musicDuck(0);
  }

  // ── the moon, the bats, the fireworks ────────────────
  startSky() {
    const token = this._token;
    this.audio.setQuiet(0.4);
    this.yard.bats.heart(true);
    this.audio.batFlutter();
    this.o.party.start();
    this._storm(token);
    setTimeout(() => { if (token === this._token && this.current?.id === 'sky') this.next(); }, 15000);
  }

  /** Lightning, again and again: big forked strikes beside the moon, the whole hill lit up. */
  _storm(token) {
    const ch = this.current?.id;
    if (token !== this._token || !['sky', 'finale'].includes(ch)) return;
    const moonAz = Math.atan2(MOON_DIR.x, -MOON_DIR.z);
    this.yard.strike({ big: true, az: moonAz + (Math.random() - 0.5) * 0.9 });
    this.ui.lightning();
    if (Math.random() < 0.4) setTimeout(() => { if (token === this._token) { this.yard.strike({ big: true, az: moonAz + (Math.random() - 0.5) * 1.2 }); this.ui.lightning(); } }, 260);
    this._stormT = setTimeout(() => this._storm(token), (ch === 'sky' ? 2400 : 6500) + Math.random() * 2400);
  }

  /** The finale's fireworks: all of them come out of the witches' potions (no separate show from the ground). */
  _fireworks() {
    this.o.party.start({ show: true });
    this.audio.startCrackle();
  }

  stopShow() { this.o.fireworks.stopShow(); this.audio.stopCrackle(); this.yard.bats.heart(false); this.o.party.stop(); this.audio.setQuiet(1); clearTimeout(this._stormT); }

  startFinale() {
    const o = this.o;
    this.ui.hideCard();
    if (!o.carving.carved) o.carving.complete();
    this.yard.bats.heart(true);
    this.audio.setQuiet(0.4);
    this.audio.music('cute');
    this.ui.showFinale({ onAgain: () => this.restart(), onCapture: () => this.captureMoment() });
    this._fireworks();
    clearTimeout(this._stormT);
    this._stormT = setTimeout(() => this._storm(this._token), 3000);
  }

  endFinale() {
    this.ui.hideFinale();
    this.stopShow();
    this._cancelCapture();
  }

  /**
   * The spirit photograph: over to the old box camera — tap to look through its ground glass, tap the shutter:
   * the flash powder goes off, and when the photo develops someone has crept into it.
   */
  async captureMoment() {
    if (this._capturing || this.current?.id !== 'finale') return;
    const o = this.o, d = this.director, ui = this.ui, cam = o.spirit;
    const token = (this._capToken = (this._capToken || 0) + 1);
    const alive = () => token === this._capToken && this.current?.id === 'finale';
    this._capturing = true;
    ui.hideFinale();
    ui.hideCard();
    // 1 — the camera on its tripod
    await d.moveTo(cam.heroShot(portraitScreen()), 2.6);
    if (!alive()) return;
    this._capLabel = () => ({ at: cam.center, r: 0.6, place: 'side', placePortrait: 'below' });
    await new Promise((resolve) => {
      this._aimGo = resolve;
      ui.showCard({ eyebrow: '', title: '', body: '<p class="hand no-edit">An old camera… they say it can even catch ghosts.</p>', actions: [{ label: 'Look through the camera', icon: '📷', primary: true, onClick: () => resolve() }] }, { reveal: true });
    });
    this._aimGo = null;
    if (!alive()) return;
    ui.hideCard();
    this._capLabel = null;
    // 2 — through the ground glass
    const { pos, look } = cam.eyePose();
    this.audio.click();
    await d.moveTo({ pos, target: look, fov: LENS_FOV }, 1.6);
    if (!alive()) return;
    const base = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, V(0, 1, 0)));
    this.viewfinder = { fov: LENS_FOV, pose: () => ({ pos, quat: base }) };
    await new Promise((resolve) => { this._shoot = resolve; ui.showViewfinder(resolve); });
    this._shoot = null;
    if (!alive()) return;
    // 3 — the exposure (with a guest), the poof
    const pose = this.viewfinder.pose();
    this.audio.flashPowder(); ui.flash(); ui.viewfinderShot();
    cam.poof();
    cam.photobomb(true, pose);
    const coarse = matchMedia('(pointer: coarse)').matches;
    const shot = await this.capture({ pos: pose.pos.clone(), quat: pose.quat.clone() }, LENS_FOV, coarse ? 1280 : 1600);
    cam.photobomb(false);
    // the story picture's backdrop: the carved name-pumpkin, the photo tree, the bat heart round the moon, a witch
    // and her friends — staged for a moment, with a bolt of lightning, then put away again
    const poster = this.posterShot();
    this.posers.show(true, poster);
    // the sky stays clear for the poster's own bat heart and lightning (drawn round the moon afterwards)
    this.yard.calm();
    const hidden = [...this.o.fireworks.bursts.map((b) => b.pts), this.yard.bats.group].filter((o) => o.visible);
    hidden.forEach((o) => { o.visible = false; });
    const bg = await this.capture({ pos: poster.pos, quat: poster.quat }, poster.fov, coarse ? { w: 540, h: 960 } : { w: 720, h: 1280 });
    this.posers.show(false);
    hidden.forEach((o) => { o.visible = true; });
    bg.moon = this.posterMoon(poster);
    this.viewfinder = null; ui.hideViewfinder();
    if (!alive()) return;
    this._photo = { shot, bg };
    this._storyFile = null;
    drawStoryImage({ photo: shot, bg, content: this.content, base: import.meta.env.BASE_URL })
      .then((cv) => canvasToFile(cv, `halloween-${Date.now()}.png`))
      .then((file) => { if (token === this._capToken) this._storyFile = file; })
      .catch((err) => console.warn('story image failed', err));
    // back out; the photograph develops in front of you
    await d.moveTo(cam.heroShot(portraitScreen()), 1.4);
    if (!alive()) return;
    const camPos = this.director.currentPos();
    const at = camPos.clone().addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(this.director.camera?.quaternion || new THREE.Quaternion()), 2.5);
    o.photo.show(shot, at, camPos);
    this.audio.develop();
    this.presenter.present(o.photo.group, { width: o.photo.size.w, height: o.photo.size.h, fillH: 0.78, fillHPortrait: 0.46, x: -0.14, y: 0.02, yPortrait: 0.17 }, { duration: 1.3 });
    this._capLabel = () => ({ at: o.photo.group.getWorldPosition(V(0, 0, 0)), r: o.photo.size.h * 0.56, place: 'side', placePortrait: 'below' });
    await wait(4.2);
    if (!alive()) return;
    this.audio.ghostOoo(0.5);
    ui.showCard({
      eyebrow: '', title: '', body: '<p class="hand no-edit">Wait… who is that in the photo? 👻</p>',
      actions: [
        { label: 'Save the photo', icon: '⬇', primary: true, onClick: () => this.savePhoto() },
        { label: 'Back to the fireworks', onClick: () => this.backToFinale() },
        { label: '↻ Watch again', onClick: () => this.restart() },
      ],
    }, { reveal: true });
  }

  /** The poster's backdrop camera: low in front of the giant pumpkin, looking up past the tree to the moon. */
  posterShot() {
    const c = this.o.carving, at = c.facePoint, n = c.faceNormal;
    const side = new THREE.Vector3(n.z, 0, -n.x);   // to the right as the camera looks at the pumpkin
    const pos = at.clone().addScaledVector(n, 3.0).addScaledVector(side, 0.95).setY(0.95);
    pos.z = Math.min(pos.z, 6.0);   // inside the fence
    const look = pos.clone().addScaledVector(MOON_DIR, 30).addScaledVector(side, -4.5).add(V(0, -5.2, 0));
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, V(0, 1, 0)));
    return { pos, look, quat, fov: 70, side, n, at };
  }

  /** Where the moon sits in the poster's backdrop, as fractions of its width and height. */
  posterMoon(poster) {
    const cam = new THREE.PerspectiveCamera(poster.fov, 720 / 1280, 0.1, 500);
    cam.position.copy(poster.pos); cam.quaternion.copy(poster.quat); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const p = poster.pos.clone().addScaledVector(MOON_DIR, 200).project(cam);
    return { x: p.x * 0.5 + 0.5, y: -p.y * 0.5 + 0.5, r: 0.095 / Math.tan(THREE.MathUtils.degToRad(poster.fov) / 2) * 0.5 };
  }

  async savePhoto() {
    if (!this._photo) return;
    let file = this._storyFile;
    if (!file) {
      this.ui.toast('Getting the photo ready…');
      const cv = await drawStoryImage({ photo: this._photo.shot, bg: this._photo.bg, content: this.content, base: import.meta.env.BASE_URL });
      file = await canvasToFile(cv, `halloween-${Date.now()}.png`);
      this._storyFile = file;
    }
    const r = await shareOrDownload(file, { title: `${this.content.finale.title}, ${this.content.name}!` });
    if (r === 'downloaded') this.ui.toast('Saved 🎃');
  }

  _cancelCapture() {
    this._capToken = (this._capToken || 0) + 1;
    this._capturing = false;
    this._capLabel = null;
    if (this.viewfinder) { this.viewfinder = null; this.ui.hideViewfinder(); }
    this.director.focusOverride = null;
    this._aimGo = null;
    this.presenter.release(this.o.photo.group);
    this.o.photo.hide();
    this.o.spirit.reset();
  }

  async backToFinale() {
    this.ui.hideCard();
    this._cancelCapture();
    await this.director.moveTo(this._shot(this.current), 2.2);
    if (this.current?.id === 'finale') this.ui.showFinale({ onAgain: () => this.restart(), onCapture: () => this.captureMoment() });
  }

  restart() {
    const o = this.o;
    this.audio.music('waltz');
    this.endFinale();
    this.ui.hideCard();
    o.letter.reset(); o.carving.reset(); o.graves.reset(); o.potion.reset(); o.gram.reset(); o.trick.reset();
    this._atCrypt = false;
    const m = o.mailbox;
    m.opened = false;
    if (m.lid) gsap.to(m.lid.rotation, { y: 0, duration: 0.8 });
    if (m.glow) m.glow.material.opacity = 0;
    this.goTo(0);
  }

  update(dt) {
    this.shake *= Math.exp(-dt * 10);
  }

  // ── navigation ───────────────────────────────────────
  get current() { return this.chapters[this.index]; }

  next() { if (this.index < this.chapters.length - 1) this.goTo(this.index + 1); }
  prev() { if (this.index > 0) this.goTo(this.index - 1); }

  goTo(i) {
    if (i === this.index) return;
    const prev = this.current;
    prev?.leave?.();
    this.ui.closeSheets();
    this.index = i;
    const ch = this.current;
    this.ui.updateNav(i);
    this.openGate();
    this.o.spirit.root.visible = ch.id === 'finale';   // the old camera only turns up for the last picture
    const card = ch.enter();
    if (card) this.ui.showCard(card); else this.ui.hideCard();
    const token = (this._token = (this._token || 0) + 1);
    document.body.classList.add('moving');
    // the very first step: watch the gate creak open (drifting up to it), then glide in through it
    const firstIn = prev === undefined && i === 0 && this._gateFresh;
    this._gateFresh = false;
    const move = firstIn
      ? this.director.moveTo({ pos: V(0.25, 1.8, 10.4), target: V(0, 2.0, 0), fov: 46, portraitFov: portraitScreen() ? 66 : undefined }, 2.9).then(() => token === this._token && this.director.moveTo(this._shot(ch), 3.2))
      : this.director.moveTo(this._shot(ch), ch.duration || 3.0);
    move.then(async () => {
      if (token !== this._token) return;
      document.body.classList.remove('moving');
      ch.arrive?.();
      if (token === this._token && card) setTimeout(() => { if (token === this._token) this.ui.revealCard(); }, 250);
    });
  }

  startIntro() { this.director.cut(this.intro.shot); }
}
