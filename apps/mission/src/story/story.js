import * as THREE from 'three';
import gsap from 'gsap';
import { esc } from '../ui/ui.js';
import { drawStoryImage, canvasToFile, shareOrDownload } from '../share/storyImage.js';
import { getPath } from '../share/content-core.js';
import { LAYOUT, FOOTLOCKER_TOP } from '../world/courtyard.js';
import { monthDay } from '../util/textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const SCOPE_FOV = 40;                       // the scope's (zoomed) view
const portraitScreen = () => innerWidth / innerHeight < 1.1;

/** A shot that looks at `at` from `dist` metres along the horizontal normal `n`, raised by `up`. */
function front(at, n, dist, up, fov, extra = {}) {
  return { pos: at.clone().addScaledVector(n, dist).add(V(0, up, 0)), target: at.clone(), fov, ...extra };
}
const normalOf = (yaw) => V(Math.sin(yaw), 0, Math.cos(yaw));

/**
 * Operation Birthday, chapter by chapter, in a sandstone courtyard at golden hour: the mission dossier, the
 * rifle that writes the name on the wall in bullet holes, the case opening that lands on the wish, the squad's
 * polaroids, the party timer you have to stop, the field radio, the candles (MVP!), the grenade salute into
 * dusk and fireworks — and the finale's last shot, taken through a scope and printed as an MVP card.
 */
export class Story {
  constructor(ctx) {
    Object.assign(this, ctx); // director, ui, audio, o (objects), content, presenter, capture(), tube, mediaURL, yard
    this.index = -1;
    this.blowMode = null;
    this.holdProgress = 0;
    this.blown = false;
    this.viewfinder = null;    // while set, main.js looks through the scope
    this.shake = 0;            // camera shake (metres), read and decayed by main.js
    this._build();
    addEventListener('keydown', (e) => {
      if (this.current?.id !== 'date' || !this._atKeypad) return;
      const k = /^[0-9]$/.test(e.key) ? e.key : e.key === 'Enter' ? 'OK' : (e.key === 'Backspace' || e.key === 'Delete') ? 'C' : null;
      if (k) { e.preventDefault(); this.pressKey(k); }
    });
  }

  _build() {
    const c = this.content, o = this.o, audio = this.audio, L = LAYOUT;
    this.intro = { shot: { pos: V(0.2, 2.1, 9.2), target: V(0, 1.7, -3), fov: 50 } };
    this.introLabel = { at: V(0, 3.1, -1.5), r: 0, place: 'center', placePortrait: 'center' };
    this.photoIndex = -1;

    // where everything is
    const letterAt = o.letter.group.position.clone();
    const nLetter = normalOf(o.letter.group.rotation.y);
    const rest = o.spray.focusPoint, heart = L.heart.clone();
    const aimDir = heart.clone().sub(rest).normalize();
    const right = new THREE.Vector3().crossVectors(aimDir, V(0, 1, 0)).normalize();
    this.rifleShot = { pos: rest.clone().addScaledVector(aimDir, -1.35).addScaledVector(right, 0.42).add(V(0, 0.42, 0)), target: heart.clone().add(V(0, -0.1, 0)), fov: 42 };
    this.rifleShotPortrait = { pos: rest.clone().addScaledVector(aimDir, -1.7).addScaledVector(right, 0.3).add(V(0, 0.55, 0)), target: heart.clone().add(V(0, -0.3, 0)), fov: 42, portraitFov: 66 };
    this.wallShot = { pos: V(-2.9, 2.15, -0.35), target: heart.clone().add(V(0, -0.05, 0)), fov: 50 };
    this.wallShotPortrait = { pos: V(-3.0, 2.05, 0.9), target: heart.clone().add(V(0, 0.1, 0)), fov: 50, portraitFov: 82, mobileOffset: V(0, 0.3, 0) };
    const caseAt = o.loot.group.position.clone(), nCase = normalOf(o.loot.group.rotation.y);
    this.nCase = nCase;
    const timerAt = o.timer.focusPoint, nTimer = normalOf(o.timer.group.rotation.y);
    const deviceAt = o.timer.group.localToWorld(V(0, 0.13, 0));   // the middle of the whole device (not its display)
    const radioAt = o.radio.focusPoint, nRadio = normalOf(o.radio.group.rotation.y);
    const cakeAt = V(0, FOOTLOCKER_TOP + 0.2, 0);

    this.chapters = [
      {
        id: 'letter', navTitle: 'Mission',
        shot: front(letterAt.clone().add(V(0, 0.1, 0)), nLetter, 0.8, 0.22, 34, { frameX: -0.11 }),
        hits: () => o.letter.hitTargets,
        enter: () => this._letterCard(),
        label: () => (o.letter.reading ? { at: o.letter.letterCenter, r: 0.08, place: 'side', placePortrait: 'below' } : { at: o.letter.focusPoint, r: 0.09 }),
        onHit: () => (o.letter.reading ? this.closeLetter() : this.openLetter()),
        leave: () => { if (o.letter.reading) this.closeLetter(true); },
      },
      {
        id: 'spray', navTitle: 'Name on the wall',
        shot: this.rifleShot, shotPortrait: this.rifleShotPortrait,
        hits: () => o.spray.hitTargets,
        enter: () => this._sprayCard(),
        label: () => (this._onWall ? { at: heart.clone().add(V(0, -1.55, 0)), r: 0.3, place: 'below', placePortrait: 'below' } : { at: o.spray.focusPoint.clone().add(V(0, 0.15, 0)), r: 0.35, place: 'side', placePortrait: 'above' }),
        onHit: () => (o.spray.state === 'idle' ? this.fireSpray() : this.lookAtWall()),
        leave: () => { this._onWall = false; },
      },
      {
        id: 'wishes', navTitle: 'Loot',
        shot: front(caseAt.clone().add(V(0, 0.28, 0)), nCase, 1.85, 0.6, 40, { frameX: -0.1 }),
        shotPortrait: front(caseAt.clone().add(V(0, 0.36, 0)), nCase, 2.25, 0.7, 40, { portraitFov: 66 }),
        hits: () => o.loot.hitTargets,
        enter: () => {
          o.loot.unstow();
          return {
            eyebrow: '', title: '',
            body: document.body.classList.contains('editing') ? `<p class="hand reveal-in">✦ ${this.k('wishes.0')}</p>` : '',
            actions: o.loot.opened ? [] : [{ label: 'Open the loot case', icon: '🔓', primary: true, onClick: () => this.openCase() }],
          };
        },
        leave: () => o.loot.stow(),
        label: () => (o.loot.opened ? { at: o.loot.winnerPoint, r: 0.25, place: 'below', placePortrait: 'below' } : { at: o.loot.focusPoint, r: 0.45 }),
        onHit: () => this.openCase(),
      },
      {
        id: 'moments', navTitle: 'Photos',
        shot: o.photos.boardShot(false), shotPortrait: o.photos.boardShot(true),
        hits: () => o.photos.cards.map((p) => p.card),
        enter: () => { this.photoIndex = -1; return { eyebrow: 'Team memories', title: 'Best moments', body: '', actions: this._photoActions() }; },
        label: () => {
          const p = o.photos;
          if (this.photoIndex >= 0) { const c2 = p.ordered[this.photoIndex]; return { at: c2.card.getWorldPosition(V(0, 0, 0)), r: Math.max(c2.w, c2.h) * 0.62 }; }
          return { at: p.focusPoint, r: 0.62, place: 'side', placePortrait: 'below' };
        },
        onHit: (mesh) => {
          const i = o.photos.ordered.findIndex((p) => p.card === mesh);
          if (i >= 0) this.showPhoto(i);
        },
      },
      {
        id: 'date', navTitle: 'Secret code',
        shot: front(deviceAt, nTimer, 1.35, 0.5, 36),
        shotPortrait: front(deviceAt, nTimer, 1.7, 0.6, 36, { portraitFov: 60 }),
        hits: () => (this._atKeypad ? o.timer.keyTargets : o.timer.hitTargets),
        enter: () => this._timerCard(),
        label: () => (this._atKeypad ? { at: o.timer.keypadPoint, r: 0.09, place: 'side', placePortrait: 'above' } : { at: deviceAt, r: 0.36, place: 'side', placePortrait: 'below' }),
        arrive: () => this.armTimer(),
        onHit: (mesh) => (mesh.userData.key && this._atKeypad ? this.pressKey(mesh.userData.key) : (o.timer.state !== 'done' && !this._atKeypad ? this.toKeypad() : null)),
        leave: () => this._leaveTimer(),
      },
      {
        id: 'music', navTitle: 'Radio',
        shot: front(radioAt, nRadio, 1.35, 0.42, 40, { frameX: -0.1 }),
        shotPortrait: front(radioAt, nRadio, 1.7, 0.5, 40, { portraitFov: 62 }),
        hits: () => o.radio.hitTargets,
        enter: () => {
          this.tube.prepare(c.song.youtube);
          this.tube.show(true);
          return { eyebrow: 'On air', title: 'Birthday radio', body: `<p>${this.k('song.note')}</p>`, actions: this._songActions() };
        },
        label: () => ({ at: o.radio.focusPoint, r: 0.42, place: 'side', placePortrait: 'below' }),
        onHit: () => this.toggleSong(),
        leave: () => { this.stopSong(); this.tube.show(false); },
      },
      {
        id: 'candles', navTitle: 'Candles',
        shot: { pos: V(0.05, 1.12, 1.12), target: cakeAt.clone().add(V(0, 0.04, 0)), fov: 38, frameX: -0.12 },
        shotPortrait: { pos: V(0.05, 1.2, 1.25), target: cakeAt.clone().add(V(0, 0.05, 0)), fov: 36, portraitFov: 58 },
        hits: () => o.cake.hitTargets,
        enter: () => ({
          eyebrow: 'Whisper a wish', title: 'Blow out your candles',
          body: this.blown ? '<p class="hand">Your wish is on its way. ★</p>' : '',
          actions: this.blown ? [] : [
            { label: 'Use the microphone', icon: '🎤', primary: true, onClick: () => this.useMic() },
            { label: 'Press and blow', icon: '🌬️', hold: (down) => this.hold(down) },
          ],
        }),
        label: () => ({ at: o.cake.focusPoint, r: 0.2 }),
        leave: () => this.stopBlow(),
      },
      {
        // the salute: grenades over the walls, smoke, a flash, fireworks into the dusk
        id: 'sky', navTitle: 'Fireworks', duration: 3.6,
        shot: { pos: V(0, 1.75, 7.6), target: V(0, 4.0, -6), fov: 60 },
        shotPortrait: { pos: V(0, 1.9, 8.8), target: V(0, 4.4, -6), fov: 60, portraitFov: 84 },
        hits: () => [],
        enter: () => null,
        label: () => null,
        arrive: () => this.startSky(),
        leave: () => queueMicrotask(() => { if (!['sky', 'finale'].includes(this.current?.id)) this.stopShow(); }),
      },
      {
        id: 'finale', navTitle: 'Finale', duration: 3.8,
        shot: { pos: V(0.4, 2.25, 7.6), target: V(-0.4, 1.9, -2.5), fov: 54 },
        shotPortrait: { pos: V(0.3, 2.1, 8.6), target: V(-0.4, 2.0, -2.5), fov: 54, portraitFov: 82, mobileOffset: V(0, 0.5, 0) },
        hits: () => (this._capturing ? [] : o.spray.hitTargets),
        enter: () => null,
        label: () => this._capLabel?.() || null,
        arrive: () => this.startFinale(),
        onHit: () => this.captureMoment(),
        leave: () => this.endFinale(),
      },
    ];
    // the marksman's perch, high out front: the cake below, the heart on the wall, the gate behind
    this.scopePose = { pos: V(-0.8, 4.6, 8.2), look: V(-1.7, 1.45, -2.8) };
    void audio;
  }

  /** A content field, rendered so the owner can edit it in place (inline editing). */
  k(path) { return `<span data-k="${path}">${esc(getPath(this.content, path) ?? '')}</span>`; }
  /** A chapter's shot for this screen (some have their own for phones held upright). */
  _shot(ch) { return portraitScreen() && ch.shotPortrait ? ch.shotPortrait : ch.shot; }

  labelAnchor() { return this.current?.label?.() || null; }

  _quiet(seconds, update) {
    this.ui.holdCard();
    clearTimeout(this._quietT);
    const ch = this.index;
    this._quietT = setTimeout(() => { if (this.index !== ch) return; update?.(); this.ui.revealCard(); }, seconds * 1000);
  }

  refreshCard() { const card = this.current?.enter(); if (card) this.ui.showCard(card, { reveal: true }); }

  // ── the dossier ──────────────────────────────────────
  _letterCard() {
    const o = this.o;
    return { eyebrow: '', title: '', body: '', actions: [{ label: o.letter.opened ? 'Read again' : 'Open the folder', icon: '📁', primary: true, onClick: () => this.openLetter() }] };
  }

  async openLetter() {
    const o = this.o;
    if (o.letter.reading || this._letterBusy) return;
    this._letterBusy = true;
    this.audio.paper();
    this.ui.holdCard();
    const first = !o.letter.opened;
    const opening = this._opening = o.letter.open(() => { this.director.focusOverride = 0.5; });
    await wait(first ? 3.4 : 2.4);
    if (this.current?.id === 'letter') {
      this.ui.showCard({ eyebrow: '', title: '', body: '', actions: [{ label: 'Close the folder', icon: '📁', primary: true, onClick: () => this.closeLetter() }] });
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
    if (!leaving) this.ui.holdCard();
    await o.letter.close();
    this._letterBusy = false;
    if (!leaving && this.current?.id === 'letter') { this.ui.showCard(this._letterCard()); this.ui.revealCard(); }
  }

  // ── the name in bullet holes ─────────────────────────
  _sprayCard() {
    const s = this.o.spray;
    if (s.state === 'done') return { eyebrow: '', title: this.k('magic.reveal'), body: `<p class="hand">${this.k('magic.note')}</p>`, actions: [{ label: 'Look at the wall', icon: '🎯', primary: true, onClick: () => this.lookAtWall() }] };
    return { eyebrow: '', title: 'Rifle ready', body: '', actions: [{ label: 'Open fire', icon: '🎯', primary: true, onClick: () => this.fireSpray() }] };
  }

  async fireSpray() {
    const o = this.o, A = this.audio;
    if (o.spray.state !== 'idle') return;
    const ch = this.index;
    const alive = () => this.index === ch;
    this.ui.holdCard();
    A.click();
    o.spray.onTink = (n) => A.tink(n);
    const done = o.spray.fire(() => { A.gunshot({ pan: 0.3 }); this.shake = Math.max(this.shake, 0.01); });
    // the first rounds from behind the rifle, then over to the wall to watch the letters appear
    setTimeout(() => { if (alive()) { this._onWall = true; this.director.moveTo(portraitScreen() ? this.wallShotPortrait : this.wallShot, 3.4); } }, 1300);
    await done;
    if (!alive()) return;
    A.sparkle(); A.chime();
    this.o.sparkles.burst(LAYOUT.heart.clone().add(V(0, 0, 0.3)));
    this.ui.feed(this.content.from, '🎯', 'wrote the name on the wall', { gold: true });
    this.ui.showCard({ eyebrow: '', title: this.k('magic.reveal'), body: `<p class="hand">${this.k('magic.note')}</p>`, actions: [{ label: 'Back to the rifle', onClick: () => this.backToRifle() }] });
    this.ui.revealCard();
  }

  async lookAtWall() {
    this.ui.holdCard();
    this._onWall = true;
    await this.director.moveTo(portraitScreen() ? this.wallShotPortrait : this.wallShot, 2.4);
    if (this.current?.id !== 'spray') return;
    this.ui.showCard({ eyebrow: '', title: this.k('magic.reveal'), body: `<p class="hand">${this.k('magic.note')}</p>`, actions: [{ label: 'Back to the rifle', onClick: () => this.backToRifle() }] });
    this.ui.revealCard();
  }

  async backToRifle() {
    this.ui.holdCard();
    await this.director.moveTo(this._shot(this.current), 2.2);
    this._onWall = false;
    this.ui.showCard(this._sprayCard(), { reveal: true });
  }

  // ── the case opening ─────────────────────────────────
  async openCase() {
    const o = this.o, A = this.audio;
    if (o.loot.opened) return;
    const ch = this.index;
    this.ui.holdCard();
    this.ui.setActions([]);
    // so close the reel runs off both edges of the screen
    const sp = o.loot.stripPoint, portrait = portraitScreen();
    const vfov = THREE.MathUtils.degToRad(portrait ? 64 : 40), hhalf = Math.atan(Math.tan(vfov / 2) * (innerWidth / innerHeight));
    const dist = (o.loot.stripWidth / 2) / Math.tan(hhalf) / (portrait ? 1.42 : 1.12);   // edge to edge (bigger cards on phones)
    this.director.moveTo(front(sp, this.nCase, dist, 0.04, portrait ? 40 : 40, portrait ? { portraitFov: 64 } : {}), 1.6);
    await o.loot.open(this.content.wishes[0], {
      onRattle: () => A.rattle(),
      onLatch: () => A.latch(),
      onBlast: () => { A.blast(); this.shake = 0.02; },
      onTick: () => A.tick(),
      onLand: () => { A.legendary(); o.sparkles.burst(o.loot.winnerPoint); this.ui.feed(this.content.name, '★', 'got a legendary gift', { gold: true }); },
    });
    if (this.index !== ch) return;
    const wp = o.loot.winnerPoint;
    await this.director.moveTo(front(wp, this.nCase, portraitScreen() ? 1.45 : 1.1, 0.05, 36, portraitScreen() ? { portraitFov: 56 } : { frameX: 0 }), 1.2);
  }

  // ── the polaroids ────────────────────────────────────
  _photoActions() {
    const n = this.o.photos.cards.length, i = this.photoIndex;
    if (i < 0) return [{ label: 'Look closer', icon: '🔍', primary: true, onClick: () => this.showPhoto(0) }];
    return [
      { label: '‹ Previous', disabled: i <= 0, onClick: () => this.showPhoto(i - 1) },
      { label: 'Next ›', primary: true, disabled: i >= n - 1, onClick: () => this.showPhoto(i + 1) },
      { label: 'All pictures', onClick: () => this.allPhotos() },
    ];
  }

  showPhoto(i) {
    const p = this.o.photos, n = p.cards.length;
    if (i < 0 || i >= n) return;
    this.photoIndex = i;
    this.ui.holdCard();
    clearTimeout(this._quietT);
    const card = p.ordered[i];
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

  // ── the party timer ──────────────────────────────────
  _dateBody() {
    const d = new Date(`${this.content.date.iso}T12:00:00`);
    return `<div class="big-date"><span data-k="date.iso" data-kind="date">${monthDay(d)}</span></div><p class="hand">${this.k('date.label')}</p>`;
  }

  _timerCard() {
    const t = this.o.timer;
    if (t.state === 'done' || document.body.classList.contains('editing')) return { eyebrow: '', title: '', body: this._dateBody() };
    if (this._atKeypad) return { eyebrow: 'Secret code', title: '', body: '<p class="hand">Enter your birthday:<br><b>MONTH · DAY</b> (4 digits)</p>', actions: [{ label: '‹ Back', onClick: () => this.leaveKeypad() }] };
    return { eyebrow: 'The clock is ticking!', title: 'Defuse the device', body: '<p class="hand">The secret code is your birthday.</p>', actions: [{ label: 'Defuse', icon: '✂️', primary: true, onClick: () => this.toKeypad() }] };
  }

  armTimer() {
    const t = this.o.timer;
    if (t.state !== 'idle' || document.body.classList.contains('editing')) return;
    this._wrong = 0;
    t.arm(45, (u) => this.audio.beep(u)).then((r) => this._timerDone(r));
  }

  /** In close to the keypad: type the code. */
  async toKeypad() {
    const t = this.o.timer;
    if (t.state === 'done' || this._atKeypad) return;
    if (t.state === 'idle') this.armTimer();
    this._atKeypad = true;
    this.ui.holdCard();
    t.beginEntry();
    this.audio.click();
    const kp = t.keypadPoint.lerp(t.focusPoint, 0.42), n = normalOf(t.group.rotation.y);
    await this.director.moveTo(portraitScreen()
      ? { pos: kp.clone().addScaledVector(n, 0.36).add(V(0, 0.5, 0)), target: kp.clone().add(V(0, 0, 0)), fov: 40, portraitFov: 50 }
      : { pos: kp.clone().addScaledVector(n, 0.34).add(V(0, 0.45, 0)), target: kp.clone().add(V(0, 0, 0)), fov: 36, frameX: -0.06 }, 1.4);
    if (this.current?.id !== 'date' || !this._atKeypad) return;
    this.ui.showCard(this._timerCard(), { reveal: true });
  }

  async leaveKeypad() {
    this._atKeypad = false;
    this.ui.holdCard();
    await this.director.moveTo(this._shot(this.current), 1.4);
    if (this.current?.id === 'date') this.ui.showCard(this._timerCard(), { reveal: true });
  }

  pressKey(label) {
    const A = this.audio, r = this.o.timer.press(label);
    if (!r) return;
    if (r === 'digit') A.keyBeep();
    else if (r === 'clear') A.keyBeep(true);
    else if (r === 'wrong') {
      A.buzzer(); this.shake = 0.008;
      this._wrong = (this._wrong || 0) + 1;
      if (this._wrong >= 3) this.ui.toast(`Hint: ${this.o.timer.code.slice(0, 2)} · ${this.o.timer.code.slice(2)} 😉`, 4000);
    } else if (r === 'right') A.keyBeep();
  }

  _timerDone(result) {
    if (result !== 'defused' && result !== 'timeout') return;
    const o = this.o, A = this.audio;
    if (this.current?.id !== 'date') return;
    this.ui.holdCard();
    if (result === 'defused') A.defused();
    setTimeout(() => {
      if (this.current?.id !== 'date') return;
      // the canisters fire: confetti and sparks, a hop, a shake
      A.cannons(); o.timer.hop();
      const cans = o.timer.canisterPoints();
      o.confetti.burst(cans[1].clone().add(V(0, 0.1, 0)), 0.8);
      o.sparkles.burst(cans[1]);
      this.shake = 0.02;
      this.ui.feed(this.content.from, '✂', result === 'defused' ? `${this.content.name} cracked the code!` : 'time is up — but confetti!', { gold: result === 'defused' });
      this._atKeypad = false;
      this.director.moveTo(this._shot(this.current), 1.6).then(() => {
        if (this.current?.id === 'date') this.ui.showCard({ eyebrow: '', title: '', body: this._dateBody() }, { reveal: true });
      });
    }, result === 'defused' ? 900 : 100);
  }

  _leaveTimer() {
    this._atKeypad = false;
    if (this.o.timer.state === 'armed' || this.o.timer.state === 'entry') this.o.timer.reset();
  }

  // ── the radio ────────────────────────────────────────
  _songActions() {
    const c = this.content, playing = this.o.radio.playing;
    return [
      ...(c.song.voice ? [{ label: this._songKind === 'voice' && playing ? 'Pause' : 'Play the call', icon: '📻', primary: true, id: 'btn-voice', onClick: () => this.toggleSong('voice') }] : []),
      { label: this._songKind === 'music' && playing ? 'Pause' : 'Play the song', icon: '♪', primary: !c.song.voice, id: 'btn-song', onClick: () => this.toggleSong('music') },
    ];
  }

  /** Play / stop: 'voice' plays the recorded message as a radio call, 'music' the YouTube song or the radio's own. */
  toggleSong(kind = this.content.song.voice ? 'voice' : 'music') {
    const radio = this.o.radio, song = this.content.song;
    if (radio.playing) { const same = this._songKind === kind; this.stopSong(); if (same) return; }
    this._songKind = kind;
    const token = (this._songToken = (this._songToken || 0) + 1);
    const still = () => token === this._songToken && radio.playing;
    radio.play();
    const voice = song.voice && this.mediaURL(song.voice);
    if (kind === 'voice' && voice) { radio.autoplay(true); this.audio.playVoice(voice, { radio: true }).then(() => { if (still()) this.stopSong(); }); }
    else if (this.tube.play()) radio.autoplay(true);
    else this.audio.playConcert((m, d) => { if (still()) radio.press(m, d); });
    this._songLabel();
  }

  stopSong() {
    const radio = this.o.radio;
    this._songToken = (this._songToken || 0) + 1;
    if (!radio.playing) return;
    radio.stop(); radio.autoplay(false);
    this.audio.stopConcert();
    this.audio.stopVoice();
    this.tube.stop();
    this._songLabel();
  }

  _songLabel() {
    const on = this.o.radio.playing, v = document.getElementById('btn-voice'), m = document.getElementById('btn-song');
    if (v) v.lastChild.textContent = on && this._songKind === 'voice' ? 'Pause' : 'Play the call';
    if (m) m.lastChild.textContent = on && this._songKind === 'music' ? 'Pause' : 'Play the song';
  }

  // ── candles ──────────────────────────────────────────
  async useMic() {
    try {
      await this.audio.startMic();
      this.blowMode = 'mic';
      this.ui.toast('Listening… blow gently into the microphone 🌬️');
      this.ui.setBlowMeter(0);
    } catch {
      this.ui.toast('Microphone unavailable — press and hold the button instead.');
    }
  }

  hold(down) {
    if (this.blown) return;
    this.blowMode = down ? 'hold' : (this.blowMode === 'hold' ? null : this.blowMode);
    if (down) { this.audio.blow(0.6); this.ui.setBlowMeter(this.holdProgress); }
    else if (this.blowMode !== 'mic') this.ui.setBlowMeter(null);
  }

  stopBlow() {
    this.blowMode = null;
    this.holdProgress = 0;
    this.audio.stopMic();
    this.ui.setBlowMeter(null);
  }

  /** Candles out: confetti, sparkles — and the MVP banner. */
  blowOut() {
    if (this.blown) return;
    this.blown = true;
    this.stopBlow();
    const o = this.o;
    this.audio.blow(1.2);
    o.cake.setLit(false);
    this.ui.holdCard();
    this.ui.setActions([]);
    const cake = o.cake.focusPoint;
    setTimeout(() => { if (this.current?.id === 'candles') this.director.moveTo({ pos: V(0.5, 1.7, 2.7), target: cake.clone().add(V(0, 0.45, 0)), fov: 46, portraitFov: portraitScreen() ? 70 : undefined }, 1.6); }, 600);
    setTimeout(() => {
      if (this.current?.id !== 'candles') return;
      o.sparkles.burst(cake.clone().add(V(0, 0.12, 0)));
      o.confetti.burst(cake.clone().add(V(0, 0.3, 0)), 1.2);
      this.audio.legendary(); this.audio.cannons();
      this.ui.banner('★ MVP ★', this.content.name);
      this.ui.feed(this.content.name, '🎂', 'blew out all the candles in one breath!', { gold: true });
    }, 1500);
    setTimeout(() => { if (this.current?.id === 'candles') this.next(); }, 6200);
  }

  update(dt) {
    // camera shake fades out
    this.shake *= Math.exp(-dt * 10);
    if (this.blown || !this.blowMode) return;
    if (this.blowMode === 'mic') {
      const level = this.audio.micLevel(dt);
      this.ui.setBlowMeter(Math.max(level, this.audio.blowTime / 0.5));
      this.o.cake.flames.forEach((f) => { f.material.uniforms.uWind.value = level * 2.5; });
      if (this.audio.blowTime > 0.5) this.blowOut();
    } else if (this.blowMode === 'hold') {
      this.holdProgress = Math.min(1, this.holdProgress + dt / 1.3);
      this.ui.setBlowMeter(this.holdProgress);
      this.o.cake.flames.forEach((f) => { f.material.uniforms.uWind.value = this.holdProgress * 2.5; });
      if (this.holdProgress >= 1) this.blowOut();
    }
  }

  // ── the salute, the finale and the last shot ─────────
  _dusk(to, seconds) {
    const st = { v: this.yard.dusk };
    gsap.killTweensOf(this._duskSt || {});
    this._duskSt = st;
    this.audio.setNight(to > 0.5);
    gsap.to(st, { v: to, duration: seconds, ease: 'sine.inOut', onUpdate: () => this.yard.setDusk(st.v) });
  }

  startSky() {
    const o = this.o, token = this._token;
    this._dusk(1, 7);
    if (this._showDone) { this._fireworks(); return; }
    o.grenades.run().then(() => {
      if (token !== this._token) return;
      this._showDone = true;
      this._fireworks();
      setTimeout(() => { if (token === this._token && this.current?.id === 'sky') this.next(); }, 9000);
    });
  }

  /** The flash's afterimage (main.js wires the grenades' onFlash here). */
  flash() {
    const c = this.content;
    this.ui.flashbang([`${c.finale.title},`, `${c.name}!`, c.age ? `${c.age} years old` : '']);
    this.shake = 0.05;
  }

  _fireworks() {
    if (this.o.fireworks.auto) return;
    this.o.fireworks.startShow(V(0, 0, -70), 60);
    this.audio.startCrackle();
  }

  stopShow() { this.o.fireworks.stopShow(); this.o.grenades.stop(); this.audio.stopCrackle(); }

  startFinale() {
    const o = this.o;
    this.ui.hideCard();
    if (this.yard.dusk < 0.99) this._dusk(1, 3);
    if (o.spray.state !== 'done') o.spray.complete();
    this.ui.showFinale({ onAgain: () => this.restart(), onCapture: () => this.captureMoment() });
    this._fireworks();
    o.confetti.burst(V(0, 1.6, 0), 1.3);
  }

  endFinale() {
    this.ui.hideFinale();
    this.stopShow();
    this._cancelCapture();
  }

  /**
   * The last shot: up the tower to the rifle — you see it first — tap "Aim" and the view glides into the
   * scope (it sways with your breath), tap to fire: the boom, the flash, the bolt works, and the picture comes
   * back on an MVP board.
   */
  async captureMoment() {
    if (this._capturing || this.current?.id !== 'finale') return;
    const o = this.o, d = this.director, ui = this.ui, sn = o.sniper;
    const token = (this._capToken = (this._capToken || 0) + 1);
    const alive = () => token === this._capToken && this.current?.id === 'finale';
    this._capturing = true;
    ui.hideFinale();
    ui.hideCard();
    // 1 — the rifle, up close, the courtyard far beyond the muzzle
    await d.moveTo(sn.heroShot(portraitScreen()), 2.8);
    if (!alive()) return;
    this._capLabel = () => ({ at: sn.center, r: 0.5, place: 'side', placePortrait: 'below' });
    await new Promise((resolve) => {
      this._aimGo = resolve;
      ui.showCard({ eyebrow: '', title: '', body: '', actions: [{ label: 'Aim', icon: '🎯', primary: true, onClick: () => resolve() }] }, { reveal: true });
    });
    this._aimGo = null;
    if (!alive()) return;
    ui.hideCard();
    this._capLabel = null;
    // 2 — into the scope
    const { pos, look } = sn.eyePose();
    this.audio.scopeIn();
    await d.moveTo({ pos, target: look, fov: SCOPE_FOV }, 1.5);
    if (!alive()) return;
    sn.setVisible(false);
    const base = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, V(0, 1, 0)));
    const t0 = performance.now(), sway = new THREE.Quaternion(), e = new THREE.Euler();
    this.viewfinder = {
      fov: SCOPE_FOV,
      pose: () => {
        const t = (performance.now() - t0) / 1000;
        e.set(Math.sin(t * 0.9) * 0.0032 + Math.sin(t * 2.3) * 0.0009, Math.sin(t * 0.6) * 0.0045, 0);
        return { pos, quat: base.clone().multiply(sway.setFromEuler(e)) };
      },
    };
    await new Promise((resolve) => { this._shoot = resolve; ui.showViewfinder(resolve); });
    this._shoot = null;
    if (!alive()) return;
    // 3 — the shot
    const pose = this.viewfinder.pose();
    this.audio.sniperShot(); ui.flash(); ui.viewfinderShot();
    const coarse = matchMedia('(pointer: coarse)').matches;
    const shot = await this.capture({ pos: pose.pos.clone(), quat: pose.quat.clone() }, SCOPE_FOV, coarse ? 1280 : 1600);
    // the story picture's backdrop: the courtyard at dusk, from low down, in portrait
    const bp = V(2.3, 0.95, 4.4), bl = V(-1.9, 2.5, -5.2);
    const bq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(bp, bl, V(0, 1, 0)));
    const bg = await this.capture({ pos: bp, quat: bq }, 62, coarse ? { w: 540, h: 960 } : { w: 720, h: 1280 });
    this.viewfinder = null; ui.hideViewfinder();
    sn.fire();
    setTimeout(() => sn.setVisible(true), 650);   // (once the view has backed out of the scope)
    this.shake = 0.05;
    if (!alive()) return;
    this._photo = { shot, bg };
    this._storyFile = null;
    drawStoryImage({ photo: shot, bg, content: this.content, base: import.meta.env.BASE_URL })
      .then((cv) => canvasToFile(cv, `torson-odor-${Date.now()}.png`))
      .then((file) => { if (token === this._capToken) this._storyFile = file; })
      .catch((err) => console.warn('story image failed', err));
    // out of the scope as the bolt is worked, then the MVP board floats in
    d.moveTo(sn.heroShot(portraitScreen()), 1.2);
    setTimeout(() => { if (alive()) { this.audio.bolt(); sn.cycleBolt(); } }, 450);
    await wait(1.5);
    if (!alive()) return;
    // back down to the courtyard view; the board flips in there, with nothing between you and it
    await d.moveTo(this._shot(this.current), 1.6);
    if (!alive()) return;
    const cam = this.director.currentPos();
    const at = cam.clone().addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(this.director.camera?.quaternion || new THREE.Quaternion()), 3);
    o.mvp.show(shot, at, cam);
    this.audio.legendary();
    this.presenter.present(o.mvp.group, { width: o.mvp.size.w, height: o.mvp.size.h, fillH: 0.8, fillHPortrait: 0.52, x: -0.14, y: 0, yPortrait: 0.12 }, { duration: 1.3 });
    this._capLabel = () => ({ at: o.mvp.group.getWorldPosition(V(0, 0, 0)), r: 0.5, place: 'side', placePortrait: 'below' });
    await wait(1.4);
    if (!alive()) return;
    ui.showCard({
      eyebrow: '', title: '', body: '',
      actions: [
        { label: 'Save the picture', icon: '⬇', primary: true, onClick: () => this.savePhoto() },
        { label: 'Back to the fireworks', onClick: () => this.backToFinale() },
        { label: '↻ Watch again', onClick: () => this.restart() },
      ],
    }, { reveal: true });
  }

  async savePhoto() {
    if (!this._photo) return;
    let file = this._storyFile;
    if (!file) {
      this.ui.toast('Preparing the picture…');
      const cv = await drawStoryImage({ photo: this._photo.shot, bg: this._photo.bg, content: this.content, base: import.meta.env.BASE_URL });
      file = await canvasToFile(cv, `torson-odor-${Date.now()}.png`);
      this._storyFile = file;
    }
    const r = await shareOrDownload(file, { title: `${this.content.finale.title}, ${this.content.name}!` });
    if (r === 'downloaded') this.ui.toast('Saved — GG! 🏆');
  }

  _cancelCapture() {
    this._capToken = (this._capToken || 0) + 1;
    this._capturing = false;
    this._capLabel = null;
    if (this.viewfinder) { this.viewfinder = null; this.ui.hideViewfinder(); }
    this.director.focusOverride = null;
    this._aimGo = null;
    this.presenter.release(this.o.mvp.group);
    this.o.mvp.hide();
    this.o.sniper.reset();
  }

  async backToFinale() {
    this.ui.hideCard();
    this._cancelCapture();
    await this.director.moveTo(this._shot(this.current), 2.2);
    if (this.current?.id === 'finale') this.ui.showFinale({ onAgain: () => this.restart(), onCapture: () => this.captureMoment() });
  }

  restart() {
    const o = this.o;
    this.endFinale();
    this.ui.hideCard();
    o.letter.reset(); o.spray.reset(); o.loot.reset(); o.timer.reset(); o.radio.reset(); o.grenades.reset();
    o.cake.setLit(true, true);
    this.blown = false; this._showDone = false;
    this._dusk(0, 2.5);
    this.goTo(0);
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
    const card = ch.enter();
    if (card) this.ui.showCard(card); else this.ui.hideCard();
    const token = (this._token = (this._token || 0) + 1);
    clearTimeout(this._quietT);
    document.body.classList.add('moving');
    // stepping back before the salute: the evening returns to golden hour
    if (i < 7 && this.yard.dusk > 0) { this._dusk(0, 2.5); this.o.grenades.reset(); this._showDone = false; }
    const move = this.director.moveTo(this._shot(ch), ch.duration || 3.0);
    move.then(async () => {
      if (token !== this._token) return;
      document.body.classList.remove('moving');
      const playing = ch.arrive?.();
      if (ch.textAfterArrive && playing?.then) await playing;
      if (token === this._token && card) setTimeout(() => { if (token === this._token) this.ui.revealCard(); }, 250);
    });
  }

  startIntro() { this.director.cut(this.intro.shot); }
}
