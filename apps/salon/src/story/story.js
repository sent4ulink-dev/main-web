import * as THREE from 'three';
import gsap from 'gsap';
import { esc } from '../ui/ui.js';
import { drawStoryImage, canvasToFile, shareOrDownload } from '../share/storyImage.js';
import { getPath } from '../share/content-core.js';
import { TABLE, TABLE_TOP, LAYOUT, WINDOWS } from '../world/salon.js';
import { CANVAS } from '../objects/easel.js';
import { monthDay } from '../util/textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
export const PAINT_FOV = 56;   // the painter's view

/**
 * The evening in Mozart's and Beethoven's Vienna, chapter by chapter: a letter on a silver salver, the quill
 * that writes the name in golden stars, the wish casket, the portrait gallery, the calendar on the mantel,
 * the concert of instruments that play themselves, the candles, fireworks over the city, and — the finale —
 * the evening painted as a portrait on the easel.
 */
export class Story {
  constructor(ctx) {
    Object.assign(this, ctx); // director, ui, audio, o (objects), content, presenter, capture(), tube, mediaURL
    this.index = -1;
    this.blowMode = null;
    this.holdProgress = 0;
    this.blown = false;
    this.viewfinder = null;    // while set, main.js looks through the painter's eye
    this._build();
  }

  _build() {
    const c = this.content, o = this.o, audio = this.audio;
    const T = (x, y, z) => V(TABLE.x + x, y, TABLE.z + z);
    // the doorway: the whole salon, the tea table under the chandelier, the windows onto the city
    this.intro = { shot: { pos: V(0.15, 1.8, 4.75), target: V(0, 1.55, -2.2), fov: 52 } };
    this.introLabel = { at: V(0, 3.05, -1.4), r: 0, place: 'center', placePortrait: 'center' };
    // the name in golden stars hangs over the table; this is where you see it best
    this.heart = V(TABLE.x, 2.18, TABLE.z + 0.55);
    o.stars.place(this.heart, V(0, 1.6, 5));
    this.heartShot = { pos: V(0.55, 1.55, 4.1), target: V(0.05, 2.15, 0.55), fov: 50 };
    this.heartShotPortrait = { pos: V(0.3, 1.5, 4.6), target: V(0.05, 2.15, 0.55), fov: 50, portraitFov: 80, mobileOffset: V(0, 0.75, 0) };
    this.photoIndex = -1;
    const desk = LAYOUT.desk.pos, fp = LAYOUT.fireplace.pos, cal = o.calendar.focusPoint;
    const win = WINDOWS[1];

    this.chapters = [
      {
        id: 'letter', navTitle: 'Letter',
        shot: { pos: T(-0.18, 1.02, 1.2), target: T(-0.18, 0.87, 0.62), fov: 34, frameX: -0.11 },
        hits: () => o.letter.hitTargets,
        enter: () => this._letterCard(),
        label: () => (o.letter.reading ? { at: o.letter.letterCenter, r: 0.08, place: 'side', placePortrait: 'below' } : { at: o.letter.focusPoint, r: 0.09 }),
        onHit: () => (o.letter.reading ? this.closeLetter() : this.openLetter()),
        leave: () => { if (o.letter.reading) this.closeLetter(true); },
      },
      {
        id: 'quill', navTitle: 'Golden ink',
        shot: { pos: desk.clone().add(V(-0.12, 1.28, 0.95)), target: desk.clone().add(V(-0.05, 0.8, 0.05)), fov: 36, frameX: -0.1 },
        hits: () => o.quill.hitTargets,
        enter: () => this._quillCard(),
        label: () => (this._starsShown ? { at: this.heart, r: 1.15, place: 'below', placePortrait: 'below' } : { at: o.quill.focusPoint, r: 0.12 }),
        onHit: () => (o.quill.written ? this.lookAtStars() : this.writeName()),
        leave: () => { this._starsShown = false; },
      },
      {
        id: 'wishes', navTitle: 'Wishes',
        shot: { pos: T(0.22, 1.08, 1.22), target: T(0.22, 0.9, 0.66), fov: 36, frameX: -0.1 },
        hits: () => o.casket.hitTargets,
        enter: () => ({
          eyebrow: '', title: '',
          body: document.body.classList.contains('editing') ? `<p class="hand reveal-in">✦ ${this.k('wishes.0')}</p>` : '',
          actions: o.casket.opened ? [] : [{ label: 'Open the casket', icon: '✨', primary: true, onClick: () => this.openCasket() }],
        }),
        label: () => ({ at: o.casket.focusPoint, r: 0.08 }),
        onHit: () => this.openCasket(),
      },
      {
        id: 'moments', navTitle: 'Portraits',
        shot: { pos: V(-1.5, 2.05, 0.25), target: V(-6, 2.2, 0.25), fov: 50 },
        shotPortrait: { pos: V(-1.3, 2.25, 0.45), target: V(-6, 2.25, 0.45), fov: 50, portraitFov: 72, mobileOffset: V(0, 0.6, 0) },
        hits: () => o.photos.cards.flatMap((p) => [p.card, p.frame]),
        enter: () => { this.photoIndex = -1; return { eyebrow: 'Our memories', title: 'The portrait gallery', body: '', actions: this._photoActions() }; },
        label: () => {
          const p = o.photos;
          if (this.photoIndex >= 0) { const c2 = p.ordered[this.photoIndex]; return { at: c2.card.getWorldPosition(V(0, 0, 0)), r: Math.max(c2.w, c2.h) * 0.62 }; }
          return { at: p.focusPoint.add(V(0, -0.75, 0)), r: 0.3, place: 'below', placePortrait: 'below' };
        },
        onHit: (mesh) => {
          const i = o.photos.ordered.findIndex((p) => p.card === mesh || p.frame === mesh);
          if (i >= 0) this.showPhoto(i);
        },
      },
      {
        id: 'date', navTitle: 'Our day',
        shot: { pos: cal.clone().add(V(-0.6, 0.34, 0.0)), target: cal.clone().add(V(0, 0.0, 0.0)), fov: 34, frameX: -0.12 },
        hits: () => o.calendar.hitTargets,
        enter: () => {
          const d = new Date(`${c.date.iso}T12:00:00`);
          return { eyebrow: '', title: '', body: `<div class="big-date"><span data-k="date.iso" data-kind="date">${monthDay(d)}</span></div>` };
        },
        label: () => ({ at: o.calendar.focusPoint, r: 0.1 }),
        textAfterArrive: true,
        arrive: () => { this.spinClock(2.2); return o.calendar.reveal().then(() => audio.chime()); },
        onHit: () => o.calendar.reveal(),
      },
      {
        id: 'music', navTitle: 'Concert',
        shot: { pos: V(-1.0, 1.85, -0.55), target: V(-2.9, 1.0, -2.75), fov: 44 },
        shotPortrait: { pos: V(-1.15, 2.0, -0.75), target: V(-2.8, 1.35, -2.9), fov: 44, portraitFov: 76, mobileOffset: V(0, 0.55, 0) },
        hits: () => o.ensemble.hitTargets,
        enter: () => {
          this.tube.prepare(c.song.youtube);
          this.tube.show(true);
          return { eyebrow: 'Listen', title: 'The birthday concert', body: `<p>${this.k('song.note')}</p>`, actions: this._songActions() };
        },
        label: () => ({ at: o.ensemble.focusPoint, r: 0.9, place: 'side', placePortrait: 'below' }),
        onHit: () => this.toggleSong(),
        leave: () => { this.stopSong(); this.tube.show(false); this.tube.destroy(); },
      },
      {
        id: 'candles', navTitle: 'Candles',
        shot: { pos: T(0.06, 1.12, 0.92), target: T(0.03, 1.0, -0.08), fov: 34, frameX: -0.12 },
        hits: () => o.cake.hitTargets,
        enter: () => ({
          eyebrow: 'Whisper a wish', title: 'Blow out your candles',
          body: this.blown ? '<p class="hand">Your wish is on its way. ✨</p>' : '',
          actions: this.blown ? [] : [
            { label: 'Use the microphone', icon: '🎤', primary: true, onClick: () => this.useMic() },
            { label: 'Press and blow', icon: '🌬️', hold: (down) => this.hold(down) },
          ],
        }),
        label: () => ({ at: o.cake.focusPoint, r: 0.2 }),
        leave: () => this.stopBlow(),
      },
      {
        // at the middle window: fireworks over the rooftops of Vienna
        id: 'sky', navTitle: 'Fireworks', duration: 4.2,
        shot: { pos: V(win.x, 2.0, -3.4), target: V(win.x, 9.5, -40), fov: 54 },
        shotPortrait: { pos: V(win.x, 2.0, -3.55), target: V(win.x, 9.5, -40), fov: 54, portraitFov: 70 },
        hits: () => [],
        enter: () => null,
        label: () => null,
        arrive: () => this.startSky(),
        leave: () => queueMicrotask(() => { if (!['sky', 'finale'].includes(this.current?.id)) this.stopShow(); }),
      },
      {
        id: 'finale', navTitle: 'Best wishes', duration: 4.2,
        shot: { pos: V(0.35, 1.95, 4.55), target: V(0, 1.8, -1.6), fov: 52 },
        shotPortrait: { pos: V(0.25, 1.8, 4.7), target: V(0, 1.85, -1.6), fov: 52, portraitFov: 82, mobileOffset: V(0, 0.6, 0) },
        hits: () => (this._capturing ? [] : o.easel.hitTargets),
        enter: () => null,
        label: () => this._capLabel?.() || null,
        arrive: () => this.startFinale(),
        onHit: () => this.captureMoment(),
        leave: () => this.endFinale(),
      },
    ];
    // the painter's eye (beside the easel): the table, the name in the stars, the windows behind
    this.painterPose = { pos: V(2.35, 1.72, 3.65), look: V(-0.15, 1.75, -0.2) };
  }

  /** A content field, rendered so the owner can edit it in place (inline editing). */
  k(path) { return `<span data-k="${path}">${esc(getPath(this.content, path) ?? '')}</span>`; }
  /** A chapter's shot for this screen (some have their own for phones held upright). */
  _shot(ch) { return innerWidth / innerHeight < 1.1 && ch.shotPortrait ? ch.shotPortrait : ch.shot; }
  _heartShot() { return innerWidth / innerHeight < 1.1 ? this.heartShotPortrait : this.heartShot; }

  /** The anchor the floating chapter text should sit beside, this frame. */
  labelAnchor() { return this.current?.label?.() || null; }

  /** Hide the words while an animation plays, then bring them back (fresh) once it's done. */
  _quiet(seconds, update) {
    this.ui.holdCard();
    clearTimeout(this._quietT);
    const ch = this.index;
    this._quietT = setTimeout(() => { if (this.index !== ch) return; update?.(); this.ui.revealCard(); }, seconds * 1000);
  }

  /** Show the current chapter's text again (after an edit changed what it holds). */
  refreshCard() { const card = this.current?.enter(); if (card) this.ui.showCard(card, { reveal: true }); }

  /** The song in the background (quiet, set on the link): starts with the first tap, waits while the concert or the voice plays. */
  startBackground() {
    this.bgOn = !!this.bgTube?.available;
    if (this.bgOn) this.bgTube.play();
  }

  /** The concert's YouTube song can't play on this device: the fortepiano plays instead. */
  songFailed() {
    const ens = this.o.ensemble, token = this._songToken;
    if (!ens.playing || this._songKind !== 'music') return;
    ens.autoplay(false);
    this.audio.playConcert((m, d) => { if (token === this._songToken && ens.playing) ens.press(m, d); });
  }

  // ── the letter ───────────────────────────────────────
  _letterCard() {
    const o = this.o;
    return { eyebrow: '', title: '', body: '', actions: [{ label: o.letter.opened ? 'Read again' : 'Open the letter', icon: '💌', primary: true, onClick: () => this.openLetter() }] };
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
      this.ui.showCard({ eyebrow: '', title: '', body: '', actions: [{ label: 'Put the letter back', icon: '✉️', primary: true, onClick: () => this.closeLetter() }] });
      this.ui.revealCard();
    }
    await opening;
    this._letterBusy = false;
  }

  async closeLetter(leaving = false) {
    const o = this.o;
    if (leaving && this._letterBusy) await this._opening;   // leaving mid-opening: let it finish, then put it away
    if (!o.letter.reading || (this._letterBusy && !leaving)) return;
    this._letterBusy = true;
    this.audio.paper();
    this.director.focusOverride = null;
    if (!leaving) this.ui.holdCard();
    await o.letter.close();
    this._letterBusy = false;
    if (!leaving && this.current?.id === 'letter') { this.ui.showCard(this._letterCard()); this.ui.revealCard(); }
  }

  // ── the quill and the golden stars ───────────────────
  _quillCard() {
    const o = this.o;
    if (o.quill.written) return { eyebrow: '', title: this.k('magic.reveal'), body: `<p class="hand">${this.k('magic.note')}</p>`, actions: [{ label: 'See your name', icon: '✨', primary: true, onClick: () => this.lookAtStars() }] };
    return { eyebrow: '', title: 'The quill writes by itself', body: '', actions: [{ label: 'Wake the quill', icon: '🪶', primary: true, onClick: () => this.writeName() }] };
  }

  async writeName() {
    const o = this.o;
    if (o.quill.written || this._writing) return;
    this._writing = true;
    this.ui.holdCard();
    this.audio.magic();
    setTimeout(() => this.audio.quill(2.8), 1500);
    await o.quill.write(this.content.name);
    this._writing = false;
    if (this.current?.id !== 'quill') return;
    // the golden letters fly up off the page and write the name in a heart over the table
    o.stars.launch(o.quill.paperCenter);
    this.audio.sparkle();
    this._starsShown = true;
    await this.director.moveTo(this._heartShot(), 3.0);
    await wait(Math.max(0, o.stars.duration - 3.0) + 0.6);
    if (this.current?.id !== 'quill') return;
    this.audio.chime();
    this.ui.showCard({ eyebrow: '', title: this.k('magic.reveal'), body: `<p class="hand">${this.k('magic.note')}</p>`, actions: [{ label: 'Back to the desk', onClick: () => this.backToDesk() }] });
    this.ui.revealCard();
  }

  async lookAtStars() {
    this.ui.holdCard();
    this._starsShown = true;
    await this.director.moveTo(this._heartShot(), 2.4);
    if (this.current?.id !== 'quill') return;
    this.ui.showCard({ eyebrow: '', title: this.k('magic.reveal'), body: `<p class="hand">${this.k('magic.note')}</p>`, actions: [{ label: 'Back to the desk', onClick: () => this.backToDesk() }] });
    this.ui.revealCard();
  }

  async backToDesk() {
    this.ui.holdCard();
    await this.director.moveTo(this.current.shot, 2.2);
    this._starsShown = false;
    this.ui.showCard(this._quillCard(), { reveal: true });
  }

  /** The finale always has the name in the stars — if the quill hasn't written it, it does so now. */
  _ensureStars() {
    const o = this.o;
    if (o.stars.running) return;
    o.quill.write(this.content.name);
    o.stars.launch(o.quill.paperCenter);
  }

  // ── the casket, the portraits ────────────────────────
  openCasket() {
    const o = this.o;
    if (o.casket.opened) return;
    o.casket.open(this.content.wishes[0]);
    this.audio.pop?.();
    setTimeout(() => { this.audio.sparkle(); o.sparkles.burst(o.casket.scrollPoint); }, 900);
    this.director.moveTo({ ...this.current.shot, target: this.current.shot.target.clone().add(V(0, 0.1, 0)) }, 1.6);
    this.ui.holdCard();
    this.ui.setActions([]);
  }

  _photoActions() {
    const n = this.o.photos.cards.length, i = this.photoIndex;
    if (i < 0) return [{ label: 'Look closer', icon: '🔍', primary: true, onClick: () => this.showPhoto(0) }];
    return [
      { label: '‹ Previous', disabled: i <= 0, onClick: () => this.showPhoto(i - 1) },
      { label: 'Next ›', primary: true, disabled: i >= n - 1, onClick: () => this.showPhoto(i + 1) },
      { label: 'All pictures', onClick: () => this.allPhotos() },
    ];
  }

  /** Glide the camera to portrait i, straight on. */
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

  /** The mantel clock's hands race round (travelling to the day), then settle back on the real time. */
  spinClock(seconds = 2) {
    const clock = this.o.salonObjects.clock;
    const h = clock.getObjectByName('clock_hour'), m = clock.getObjectByName('clock_minute');
    if (!h || !m) return;
    clock.userData.spin = true;
    gsap.to(m.rotation, { z: m.rotation.z - Math.PI * 2 * 6, duration: seconds, ease: 'power2.inOut' });
    gsap.to(h.rotation, { z: h.rotation.z - Math.PI * 2 * 0.5, duration: seconds, ease: 'power2.inOut', onComplete: () => { clock.userData.spin = false; } });
  }

  // ── the concert ──────────────────────────────────────
  _songActions() {
    const c = this.content, playing = this.o.ensemble.playing;
    return [
      ...(c.song.voice ? [{ label: this._songKind === 'voice' && playing ? 'Pause' : 'Play the voice', icon: '🎙', primary: true, id: 'btn-voice', onClick: () => this.toggleSong('voice') }] : []),
      { label: this._songKind === 'music' && playing ? 'Pause' : 'Play the music', icon: '♪', primary: !c.song.voice, id: 'btn-song', onClick: () => this.toggleSong('music') },
    ];
  }

  /**
   * Play / stop: 'voice' plays the recorded message, 'music' the YouTube song (heard only) or else the
   * fortepiano concert. Either way the instruments wake up and play. Playback starts in the tap (phones).
   */
  toggleSong(kind = this.content.song.voice ? 'voice' : 'music') {
    const ens = this.o.ensemble, song = this.content.song;
    if (ens.playing) { const same = this._songKind === kind; this.stopSong(); if (same) return; }
    this.bgTube?.stop();   // one song at a time: the background waits for the concert
    this._songKind = kind;
    const token = (this._songToken = (this._songToken || 0) + 1);
    const still = () => token === this._songToken && ens.playing;
    ens.play();
    this.ui.holdCard();
    // the camera steps back to take in the whole little orchestra
    const wide = innerWidth / innerHeight < 1.1 ? { pos: V(-0.85, 2.2, -0.55), target: V(-2.4, 1.5, -2.9), fov: 52, portraitFov: 80, mobileOffset: V(0, 0.6, 0) } : { pos: V(-0.55, 2.25, -0.25), target: V(-2.5, 1.25, -2.75), fov: 52 };
    this.director.moveTo(wide, 2.4).then(() => { if (still() && this.current?.id === 'music') this.ui.revealCard(); });
    const voice = song.voice && this.mediaURL(song.voice);
    if (kind === 'voice' && voice) { ens.autoplay(true); this.audio.playVoice(voice).then(() => { if (still()) this.stopSong(); }); }
    else if (this.tube.play()) ens.autoplay(true);
    else this.audio.playConcert((m, d) => { if (still()) ens.press(m, d); });
    this._songLabel();
  }

  stopSong() {
    const ens = this.o.ensemble;
    this._songToken = (this._songToken || 0) + 1;
    if (!ens.playing) return;
    ens.stop(); ens.autoplay(false);
    this.audio.stopConcert();
    this.audio.stopVoice();
    this.tube.stop();
    if (this.bgOn) this.bgTube.play();   // and comes back after it
    this._songLabel();
    if (this.current?.id === 'music') this.director.moveTo(this._shot(this.current), 2.0);
  }

  _songLabel() {
    const on = this.o.ensemble.playing, v = document.getElementById('btn-voice'), m = document.getElementById('btn-song');
    if (v) v.lastChild.textContent = on && this._songKind === 'voice' ? 'Pause' : 'Play the voice';
    if (m) m.lastChild.textContent = on && this._songKind === 'music' ? 'Pause' : 'Play the music';
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

  /** Candles out: the camera backs away so the celebration — sparkles and rose petals — fits the view. */
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
    setTimeout(() => { if (this.current?.id === 'candles') this.director.moveTo({ pos: V(0.45, 1.75, 2.55), target: cake.clone().add(V(0, 0.4, 0)), fov: 46 }, 1.6); }, 600);
    setTimeout(() => {
      if (this.current?.id !== 'candles') return;
      o.sparkles.burst(cake.clone().add(V(0, 0.12, 0)));
      o.confetti.burst(cake.clone().add(V(0, 0.3, 0)), 1.2);
      this.audio.chime(); this.audio.sparkle();
    }, 1500);
    setTimeout(() => { if (this.current?.id === 'candles') this.next(); }, 5800);
  }

  /** Called each frame from the main loop. */
  update(dt) {
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

  // ── fireworks over Vienna, the finale and the painted portrait ──
  startSky() {
    this._ensureStars();
    this.o.fireworks.startShow(V(WINDOWS[1].x, 0, -115), 40);
    this.audio.startCrackle();
    const token = this._token;
    setTimeout(() => { if (token === this._token && this.current?.id === 'sky') this.next(); }, 14000);
  }

  stopShow() { this.o.fireworks.stopShow(); this.audio.stopCrackle(); }

  startFinale() {
    const o = this.o;
    this.ui.hideCard();
    this._ensureStars();
    this.ui.showFinale({ onAgain: () => this.restart(), onCapture: () => this.captureMoment() });
    o.fireworks.startShow(V(0, 0, -115), 36);
    this.audio.startCrackle();
    o.confetti.burst(V(TABLE.x, 1.6, TABLE.z), 1.3);
  }

  endFinale() {
    this.ui.hideFinale();
    this.stopShow();
    this._cancelCapture();
  }

  /**
   * The evening, painted: from the painter's place beside the easel you see the moment; tap "Paint" and a
   * paintbrush paints it onto the canvas stroke by stroke; the gilded frame grows round it and it floats to you.
   */
  async captureMoment() {
    if (this._capturing || this.current?.id !== 'finale') return;
    const o = this.o, d = this.director, ui = this.ui;
    const token = (this._capToken = (this._capToken || 0) + 1);
    const alive = () => token === this._capToken && this.current?.id === 'finale';
    this._capturing = true;
    ui.hideFinale();
    this._ensureStars();
    ui.hideCard();
    // 1 — to the painter's place: this view is what will be painted
    const { pos, look } = this.painterPose;
    await d.moveTo({ pos, target: look, fov: PAINT_FOV }, 2.4);
    if (!alive()) return;
    this._capLabel = () => ({ at: o.easel.focusPoint, r: CANVAS * 0.7, place: 'side', placePortrait: 'below' });
    await new Promise((resolve) => {
      this._paintGo = resolve;
      ui.showCard({ eyebrow: '', title: '', body: '', actions: [{ label: 'Paint', icon: '🖌', primary: true, onClick: () => resolve() }] }, { reveal: true });
    });
    this._paintGo = null;
    if (!alive()) return;
    ui.hideCard();
    // the scene as the painter sees it (rendered square, HD, behind the scenes)
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, V(0, 1, 0)));
    const shot = await this.capture({ pos: pos.clone(), quat }, PAINT_FOV, matchMedia('(pointer: coarse)').matches ? 1280 : 1600);
    if (!alive()) return;
    this._photo = { shot };
    this._storyFile = null;
    drawStoryImage({ photo: shot, content: this.content, base: import.meta.env.BASE_URL })
      .then((cv) => canvasToFile(cv, `happy-birthday-${Date.now()}.png`))
      .then((file) => { if (token === this._capToken) this._storyFile = file; })
      .catch((e) => console.warn('story image failed', e));
    // 2 — to the easel: the brush paints the canvas, stroke by stroke
    const cp = o.easel.focusPoint, normal = V(0, 0, 1).applyQuaternion(o.easel.canvas.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
    await d.moveTo({ pos: cp.clone().addScaledVector(normal, 1.25).add(V(0, 0.08, 0)), target: cp, fov: 38 }, 1.8);
    if (!alive()) return;
    this.audio.brush(6.6);
    await o.easel.paint(shot, 6);
    if (!alive()) return;
    // 3 — framed in gold, it floats to you
    await o.easel.frameIt();
    if (!alive()) return;
    let root = o.easel.painting; while (root.parent) root = root.parent;
    root.attach(o.easel.painting);
    this.audio.paper();
    // step back from the easel so the painting can float out in front of it
    d.moveTo({ pos: cp.clone().addScaledVector(normal, 2.5).add(V(0, 0.1, 0)), target: cp, fov: 40 }, 1.4);
    this.presenter.present(o.easel.painting, { width: 0.8, height: 0.8, fillH: 0.7, fillHPortrait: 0.42, x: -0.13, y: 0.0, yPortrait: 0.13 }, { duration: 1.4 });
    this._capLabel = () => ({ at: o.easel.painting.getWorldPosition(V(0, 0, 0)), r: 0.42, place: 'side', placePortrait: 'below' });
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

  /** 1080×1920 story picture: share sheet on phones, PNG download elsewhere. */
  async savePhoto() {
    if (!this._photo) return;
    let file = this._storyFile;
    if (!file) {
      this.ui.toast('Preparing the picture…');
      const cv = await drawStoryImage({ photo: this._photo.shot, content: this.content, base: import.meta.env.BASE_URL });
      file = await canvasToFile(cv, `happy-birthday-${Date.now()}.png`);
      this._storyFile = file;
    }
    const r = await shareOrDownload(file, { title: `${this.content.finale.title}, ${this.content.name}!` });
    if (r === 'downloaded') this.ui.toast('Saved — a little piece of tonight 🖼');
  }

  _cancelCapture() {
    this._capToken = (this._capToken || 0) + 1;
    this._capturing = false;
    this._capLabel = null;
    this._paintGo = null;
    this.director.focusOverride = null;
    this.presenter.release(this.o.easel.painting);
    this.o.easel.reset();
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
    o.letter.reset(); o.quill.reset(); o.stars.reset(); o.casket.reset(); o.calendar.reset(); o.ensemble.reset();
    o.cake.setLit(true, true);
    this.blown = false;
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
    const move = this.director.moveTo(this._shot(ch), ch.duration || 3.0);
    // the words appear once the camera has settled — or after the arrival animation (e.g. the calendar)
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
