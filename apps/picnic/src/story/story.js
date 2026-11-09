import * as THREE from 'three';
import gsap from 'gsap';
import { esc } from '../ui/ui.js';
import { polaroidTexture } from '../util/textures.js';
import { FILM_W, FILM_H } from '../objects/instantCamera.js';
import { drawStoryImage, canvasToFile, shareOrDownload } from '../share/storyImage.js';
import { getPath } from '../share/content-core.js';
import { monthDay } from '../util/textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const PHOTO_FOV = 60;   // the instant camera's lens (square photo)

export class Story {
  constructor(ctx) {
    Object.assign(this, ctx); // director, ui, audio, sky, wind, o (objects), content, presenter, capture()
    this.index = -1;
    this.timeOfDay = { v: 0 };
    this.blowMode = null;
    this.holdProgress = 0;
    this.blown = false;
    this.viewfinder = null;    // while set, main.js looks through the instant camera's lens
    this._build();
  }

  _build() {
    const c = this.content, o = this.o, audio = this.audio;
    // the storybook establishing shot: table front-on, tree and string lights behind, twilight sky above
    this.intro = { shot: { pos: V(4.7, 1.45, 0.45), target: V(-1.6, 2.05, 0.1), fov: 48 }, time: 0 };
    this.introLabel = { at: V(-2.6, 3.35, -2.4), r: 0, place: 'center', placePortrait: 'center' };
    this.photoIndex = -1;
    this.readShot = { pos: V(0.98, 1.02, 0.84), target: V(0.2, 1.02, 0.84), fov: 34 };

    this.chapters = [
      {
        id: 'letter', navTitle: 'Letter', time: 0.03,
        shot: { pos: V(0.88, 0.86, 0.84), target: V(0.33, 0.815, 0.84), fov: 34, frameX: -0.11 },
        hits: () => o.letter.hitTargets,
        enter: () => this._letterCard(),
        label: () => (o.letter.reading
          ? { at: o.letter.letterCenter, r: 0.08, place: 'side', placePortrait: 'below' }
          : { at: o.letter.focusPoint, r: 0.09 }),
        onHit: () => (o.letter.reading ? this.closeLetter() : this.openLetter()),
        leave: () => { if (o.letter.reading) this.closeLetter(true); },
      },
      {
        id: 'magic', navTitle: 'A little magic', time: 0.1,
        shot: { pos: V(0.95, 0.92, -0.42), target: V(0.3, 0.86, -0.42), fov: 32, frameX: -0.1 },
        hits: () => o.crystal.hitTargets,
        enter: () => this._magicCard(),
        label: () => (this._magicSky ? { at: o.stars.center, r: 12.5, place: 'side', placePortrait: 'below' } : { at: o.crystal.focusPoint, r: 0.075 }),
        onHit: () => (o.crystal.cast ? this.lookAtStars() : this.castMagic()),
        leave: () => { this._magicSky = false; },
      },
      {
        id: 'wishes', navTitle: 'Wishes', time: 0.14,
        shot: { pos: V(0.92, 0.86, 0.47), target: V(0.33, 0.83, 0.47), fov: 34, frameX: -0.1 },
        hits: () => o.jar.hitTargets,
        enter: () => ({
          eyebrow: '', title: '',
          body: o.jar.opened || document.body.classList.contains('editing') ? this._wishesBody() : '',
          actions: o.jar.opened ? [] : [{ label: 'Open the jar', icon: '✨', primary: true, onClick: () => this.openJar() }],
        }),
        label: () => ({ at: o.jar.focusPoint, r: 0.07 }),
        onHit: () => this.openJar(),
      },
      {
        id: 'moments', navTitle: 'Memories', time: 0.2,
        shot: { pos: V(0.95, 1.55, 0.0), target: V(-1.5, 1.27, 0.0), fov: 44 },
        hits: () => o.photos.cards.map((p) => p.card),
        enter: () => {
          this.photoIndex = -1;
          return {
            eyebrow: 'Our memories', title: 'Our little moments',
            body: '',
            actions: this._photoActions(),
          };
        },
        label: () => {
          const p = o.photos;
          if (this.photoIndex >= 0) return { at: p.ordered[this.photoIndex].card.getWorldPosition(V(0, 0, 0)), r: 0.12 };
          return { at: p.focusPoint.add(V(0, -0.1, 0)), r: 0.17, place: 'below', placePortrait: 'below' };
        },
        onHit: (mesh) => {
          const i = o.photos.ordered.findIndex((p) => p.card === mesh);
          if (i >= 0) this.showPhoto(i);
        },
      },
      {
        id: 'date', navTitle: 'Our day', time: 0.26,
        shot: { pos: V(0.93, 0.95, -0.8), target: V(0.33, 0.885, -0.8), fov: 32, frameX: -0.12 },
        hits: () => o.calendar.hitTargets,
        enter: () => {
          const d = new Date(`${c.date.iso}T12:00:00`);
          return { eyebrow: '', title: '', body: `<div class="big-date"><span data-k="date.iso" data-kind="date">${monthDay(d)}</span></div>` };
        },
        label: () => ({ at: o.calendar.focusPoint, r: 0.1 }),
        textAfterArrive: true,
        arrive: () => o.calendar.reveal().then(() => audio.chime()),
        onHit: () => o.calendar.reveal(),
      },
      {
        id: 'song', navTitle: 'Our song', time: 0.34,
        shot: { pos: V(0.98, 0.9, -1.31), target: V(0.34, 0.86, -1.31), fov: 32, frameX: -0.1 },
        hits: () => o.cassette.hitTargets,
        enter: () => {
          this.tube.prepare(c.song.youtube);
          this.tube.show(true);
          return {
          eyebrow: 'Press play', title: 'Our song',
          body: `<p>${this.k('song.note')}</p>`,
          actions: [
            ...(c.song.voice ? [{ label: this._songKind === 'voice' && o.cassette.playing ? 'Pause' : 'Play the voice', icon: '🎙', primary: true, id: 'btn-voice', onClick: () => this.toggleSong('voice') }] : []),
            { label: this._songKind === 'music' && o.cassette.playing ? 'Pause' : 'Play the music', icon: '♪', primary: !c.song.voice, id: 'btn-song', onClick: () => this.toggleSong('music') },
          ],
          };
        },
        label: () => ({ at: o.cassette.focusPoint, r: 0.085 }),
        onHit: () => this.toggleSong(),
        leave: () => { this.stopSong(); this.tube.show(false); this.tube.destroy(); },
      },
      {
        id: 'candles', navTitle: 'Candles', time: 0.55,
        shot: { pos: V(1.08, 1.02, 0.05), target: V(0.04, 0.95, 0.05), fov: 32, frameX: -0.12 },
        hits: () => o.cake.hitTargets,
        enter: () => ({
          eyebrow: 'Whisper a wish', title: 'Blow out your candles',
          body: this.blown ? '<p class="hand">Your wish is on its way. ✨</p>' : '',
          actions: this.blown ? [] : [
            { label: 'Use the microphone', icon: '🎤', primary: true, onClick: () => this.useMic() },
            { label: 'Press and blow', icon: '🌬️', hold: (down) => this.hold(down) },
          ],
        }),
        label: () => ({ at: o.cake.focusPoint, r: 0.17 }),
        leave: () => this.stopBlow(),
      },
      {
        // the camera lifts off the table and tilts up into the sky: fireworks, just for you
        id: 'sky', navTitle: 'Fireworks', time: 0.85, duration: 4.4,
        shot: null,   // set below, once the stars are placed
        hits: () => [],
        enter: () => null,
        label: () => null,
        arrive: () => this.startSky(),
        leave: () => queueMicrotask(() => { if (!['sky', 'finale'].includes(this.current?.id)) this.stopShow(); }),
      },
      {
        id: 'finale', navTitle: 'The wish', time: 1.0,
        shot: { pos: V(5.0, 1.4, 0.45), target: V(-1.6, 2.6, 0.1), fov: 52 },
        hits: () => (this._awaitEye || !this._capturing ? o.instant.hitTargets : []),
        enter: () => null,
        shotPortrait: null,   // set below: on phones, the spot where the whole heart of stars fits above the table
        label: () => this._capLabel?.() || null,
        arrive: () => this.startFinale(),
        onHit: () => (this._awaitEye ? this._eyeResolve?.() : this.captureMoment()),
        leave: () => this.endFinale(),
      },
    ];

    // where the stars write the name: up in the open sky to the right of the tree, as seen in the finale
    const f = this.chapters.find((ch) => ch.id === 'finale').shot;
    const fwd = f.target.clone().sub(f.pos).setY(0).normalize();
    const right = fwd.clone().cross(V(0, 1, 0)).normalize();
    const dir = fwd.clone().multiplyScalar(Math.cos(0.42)).addScaledVector(right, Math.sin(0.42)).normalize()
      .multiplyScalar(Math.cos(0.4)).add(V(0, Math.sin(0.4), 0)).normalize();
    o.stars.place(f.pos.clone().addScaledVector(dir, 62), f.pos);
    // a wide shot: the picnic table low in the frame, the heart of stars with the name up in the sky
    const skyPos = V(4.5, 1.55, -1.25);
    const toTable = V(-0.15, 0.95, 0.15).sub(skyPos).normalize();
    const toStars = o.stars.center.clone().sub(skyPos).normalize();
    this.skyShot = { pos: skyPos, target: skyPos.clone().addScaledVector(toTable.add(toStars).normalize(), 6), fov: 56 };
    // phones (portrait): a spot in front of the table where the heart rises above it, clear of the tree
    // (found by ray-testing the stars against the tree canopy from points around the table)
    const table = V(-0.15, 0.95, 0.15);
    const pPos = table.clone().add(V(Math.cos(0.17) * 4.5, 0, Math.sin(0.17) * 4.5)).setY(1.3);
    const pAim = table.clone().sub(pPos).normalize().add(o.stars.center.clone().sub(pPos).normalize()).normalize();
    this.skyShotPortrait = { pos: pPos, target: pPos.clone().addScaledVector(pAim, 6), fov: 56, mobileOffset: V(0, 1.05, 0) };
    // the last photo is taken from the same spot: the whole table below, the name in the stars above
    this.photoSpot = { pos: pPos.clone(), look: pPos.clone().addScaledVector(pAim, 8) };
    // phones held upright: the whole heart of stars centred (it is ~32° wide), the table below it
    const toC = o.stars.center.clone().sub(pPos), yawC = Math.atan2(toC.x, toC.z);
    const upright = (pos, pitch) => ({ pos, target: pos.clone().add(V(Math.sin(yawC) * Math.cos(pitch), Math.sin(pitch), Math.cos(yawC) * Math.cos(pitch)).multiplyScalar(6)), fov: 56, portraitFov: 80, mobileOffset: V(0, 0.96, 0) });
    const aside = V(-Math.cos(yawC), 0, Math.sin(yawC));   // to the right of that view: further from the tree
    this.chapters.find((ch) => ch.id === 'finale').shotPortrait = upright(pPos.clone().addScaledVector(aside, 0.6), 0.38);
    // the fireworks scene: from the wide sky spots, lifted higher and tilted up at the heart of stars,
    // with the show bursting all around it (the open sky, clear of the tree)
    const sky = this.chapters.find((ch) => ch.id === 'sky');
    const liftedPos = skyPos.clone().add(V(0, 1.5, 0));
    sky.shot = { pos: liftedPos, target: liftedPos.clone().addScaledVector(o.stars.center.clone().sub(liftedPos).normalize(), 12), fov: 56 };
    sky.shotPortrait = upright(pPos.clone().addScaledVector(aside, 1.3).add(V(0, 0.4, 0)), 0.46);
    this.skyShowCentre = (sh) => sh.pos.clone().addScaledVector(o.stars.center.clone().sub(sh.pos).setY(0).normalize(), 105).setY(0);
  }

  /** A content field, rendered so the owner can edit it in place (inline editing). */
  k(path) { return `<span data-k="${path}">${esc(getPath(this.content, path) ?? '')}</span>`; }

  _sky() { return innerWidth / innerHeight < 1.1 ? this.skyShotPortrait : this.skyShot; }
  /** A chapter's shot for this screen (some have their own for phones held upright). */
  _shot(ch) { return innerWidth / innerHeight < 1.1 && ch.shotPortrait ? ch.shotPortrait : ch.shot; }

  /** The anchor the floating chapter text should sit beside, this frame. */
  labelAnchor() { return this.current?.label?.() || null; }

  // ── chapter text ─────────────────────────────────────

  /**
   * Hide the words while an animation plays, then bring them back (with fresh content) once it's done,
   * so nothing ever covers the moment itself. A newer call (or leaving the chapter) cancels the reveal.
   */
  _quiet(seconds, update) {
    this.ui.holdCard();
    clearTimeout(this._quietT);
    const ch = this.index;
    this._quietT = setTimeout(() => { if (this.index !== ch) return; update?.(); this.ui.revealCard(); }, seconds * 1000);
  }

  _letterCard() {
    const o = this.o;
    return {
      eyebrow: '', title: '', body: '',
      actions: [{ label: o.letter.opened ? 'Read again' : 'Open the letter', icon: '💌', primary: true, onClick: () => this.openLetter() }],
    };
  }

  _magicCard() {
    const o = this.o, m = this.content.magic;
    if (o.crystal.cast) {
      return {
        eyebrow: '', title: this.k('magic.reveal'), body: `<p class="hand">${this.k('magic.note')}</p>`,
        actions: [{ label: 'Look at the stars', icon: '✨', primary: true, onClick: () => this.lookAtStars() }],
      };
    }
    return {
      eyebrow: '', title: 'Wave your magic wand', body: '',
      actions: [{ label: 'Wave the wand', icon: '🪄', primary: true, onClick: () => this.castMagic() }],
    };
  }

  /** The one wish from the jar. */
  _wishesBody() { return `<p class="hand reveal-in">✦ ${this.k('wishes.0')}</p>`; }

  _photoActions() {
    const n = this.o.photos.cards.length;
    const i = this.photoIndex;
    if (i < 0) return [{ label: 'Look closer', icon: '🔍', primary: true, onClick: () => this.showPhoto(0) }];
    return [
      { label: '‹ Previous', disabled: i <= 0, onClick: () => this.showPhoto(i - 1) },
      { label: 'Next ›', primary: true, disabled: i >= n - 1, onClick: () => this.showPhoto(i + 1) },
      { label: 'All pictures', onClick: () => this.allPhotos() },
    ];
  }

  // ── the letter ───────────────────────────────────────

  async openLetter() {
    const o = this.o;
    if (o.letter.reading || this._letterBusy) return;
    this._letterBusy = true;
    this.audio.paper();
    this.ui.holdCard();
    // watch it slide out of the envelope, then rise a little so the page floats above the table, never into it
    const first = !o.letter.opened;
    const opening = o.letter.open(() => { this.director.moveTo(this.readShot, 1.6); this.director.focusOverride = 0.5; });
    await wait(first ? 3.4 : 2.4);
    if (this.current?.id === 'letter') {
      // the letter speaks for itself: only a quiet way to put it back
      this.ui.showCard({ eyebrow: '', title: '', body: '', actions: [{ label: 'Put the letter back', icon: '✉️', primary: true, onClick: () => this.closeLetter() }] });
      this.ui.revealCard();
    }
    await opening;
    this._letterBusy = false;
  }

  async closeLetter(leaving = false) {
    const o = this.o;
    if (!o.letter.reading || this._letterBusy) return;
    this._letterBusy = true;
    this.audio.paper();
    this.director.focusOverride = null;
    if (!leaving) { this.ui.holdCard(); this.director.moveTo(this.current.shot, 1.6); }
    await o.letter.close();
    this._letterBusy = false;
    if (!leaving && this.current?.id === 'letter') { this.ui.showCard(this._letterCard()); this.ui.revealCard(); }
  }

  // ── jar, photos ──────────────────────────────────────

  openJar() {
    const o = this.o;
    if (o.jar.opened) return;
    o.jar.open();
    this.audio.pop();
    setTimeout(() => this.audio.sparkle(), 350);
    this._quiet(3.6, () => {
      this.ui.setActions([]);
      this.ui.setBody(this._wishesBody());
    });
  }

  /** Glide the camera to photo i, straight on. */
  showPhoto(i) {
    const p = this.o.photos;
    const n = p.cards.length;
    if (i < 0 || i >= n) return;
    this.photoIndex = i;
    this.ui.holdCard();
    clearTimeout(this._quietT);
    const card = p.ordered[i];
    const info = p.images[p.cards.indexOf(card)] || {};
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
    this.director.moveTo(this.current.shot, 2.0).then(() => { if (this.current?.id === 'moments' && this.photoIndex < 0) this.ui.revealCard(); });
  }

  // ── a little magic ───────────────────────────────────

  async castMagic() {
    const o = this.o, m = this.content.magic;
    if (o.crystal.cast) return;
    this.audio.magic();
    this.ui.holdCard();
    await o.crystal.spell();
    if (this.current?.id !== 'magic') return;
    o.stars.launch(o.crystal.ballCenter);
    this.audio.sparkle();
    this._magicSky = true;
    await this.director.moveTo(this._sky(), 2.8);
    await wait(Math.max(0, o.stars.duration - 2.8) + 0.8);
    if (this.current?.id !== 'magic') return;
    this.audio.chime();
    this.ui.showCard({ eyebrow: '', title: this.k('magic.reveal'), body: `<p class="hand">${this.k('magic.note')}</p>`, actions: [{ label: 'Back to the desk', onClick: () => this.backFromStars() }] });
    this.ui.revealCard();
  }

  async lookAtStars() {
    this.ui.holdCard();
    this._magicSky = true;
    await this.director.moveTo(this._sky(), 2.2);
    if (this.current?.id !== 'magic') return;
    this.ui.showCard({ eyebrow: '', title: this.k('magic.reveal'), body: `<p class="hand">${this.k('magic.note')}</p>`, actions: [{ label: 'Back to the desk', onClick: () => this.backFromStars() }] });
    this.ui.revealCard();
  }

  async backFromStars() {
    this.ui.holdCard();
    await this.director.moveTo(this.current.shot, 2.0);
    this._magicSky = false;
    this.ui.showCard(this._magicCard(), { reveal: true });
  }

  /** The finale always has the name in the stars — if the spell wasn't cast, the ball sends them now. */
  _ensureStars() {
    const o = this.o;
    if (o.crystal.cast) return;
    o.crystal.cast = true;
    o.crystal.uniforms.uGlow.value = 0.6;
    o.stars.launch(o.crystal.ballCenter);
  }

  // ── song, candles ────────────────────────────────────

  /**
   * Play / stop the walkman: 'voice' plays the recorded message, 'music' the YouTube song (heard only,
   * as background music) or else the music box. Playback starts right in the tap (phones need that);
   * the tape slides in meanwhile.
   */
  toggleSong(kind = this.content.song.voice ? 'voice' : 'music') {
    const cas = this.o.cassette, song = this.content.song;
    if (cas.playing) { const same = this._songKind === kind; this.stopSong(); if (same) { this.audio.click(); return; } }
    this.bgTube?.stop();   // one song at a time: the background waits for the instrument
    cas.playing = true;
    this._songKind = kind;
    this.o.notes.active = true;
    const token = (this._songToken = (this._songToken || 0) + 1);
    const still = () => token === this._songToken && cas.playing;
    let loading = Promise.resolve();
    if (!cas.loaded) {
      this.ui.holdCard();
      this.audio.click();
      loading = cas.load().then(() => { this.audio.click(); if (this.current?.id === 'song') setTimeout(() => this.ui.revealCard(), 600); });
    }
    const voice = song.voice && this.mediaURL(song.voice);
    if (kind === 'voice' && voice) this.audio.playVoice(voice).then(() => { if (still()) this.stopSong(); });
    else if (!this.tube.play()) loading.then(() => { if (still()) this.audio.playMusicBox(); });
    this._songLabel();
  }

  /** Show the current chapter's text again (after an edit changed what it holds). */
  refreshCard() { const card = this.current?.enter(); if (card) this.ui.showCard(card, { reveal: true }); }

  /** The song in the background (quiet, set on the link): starts with the first tap, waits while the walkman or the voice plays. */
  startBackground() {
    this.bgOn = !!this.bgTube?.available;
    if (this.bgOn) this.bgTube.play();
  }

  /** The walkman's YouTube song can't play on this device: the music box plays instead. */
  songFailed() {
    if (this.o.cassette.playing && this._songKind === 'music') this.audio.playMusicBox();
  }

  stopSong() {
    const cas = this.o.cassette;
    this._songToken = (this._songToken || 0) + 1;
    if (!cas.playing) return;
    cas.playing = false;
    this.audio.stopMusicBox();
    this.audio.stopVoice();
    this.tube.stop();
    if (this.bgOn) this.bgTube.play();   // and comes back after it
    this.o.notes.active = false;
    this._songLabel();
  }

  _songLabel() {
    const on = this.o.cassette.playing, v = document.getElementById('btn-voice'), m = document.getElementById('btn-song');
    if (v) v.lastChild.textContent = on && this._songKind === 'voice' ? 'Pause' : 'Play the voice';
    if (m) m.lastChild.textContent = on && this._songKind === 'music' ? 'Pause' : 'Play the music';
  }

  async useMic() {
    try {
      await this.audio.startMic();
      this.blowMode = 'mic';
      this.ui.toast('Listening… blow gently into the microphone 🌬️');
      this.ui.setBlowMeter(0);
    } catch (e) {
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

  /** Candles out: the camera backs away so the whole celebration — sparkles and confetti — fits the view. */
  blowOut() {
    if (this.blown) return;
    this.blown = true;
    this.stopBlow();
    const o = this.o;
    this.audio.blow(1.2);
    this.wind.boost = 0.5;
    o.cake.setLit(false);
    this.ui.holdCard();
    this.ui.setActions([]);
    const cake = o.cake.focusPoint;
    setTimeout(() => {
      if (this.current?.id !== 'candles') return;
      this.director.moveTo({ pos: V(2.6, 1.55, 0.4), target: cake.clone().add(V(0, 0.32, 0)), fov: 44 }, 1.6);
    }, 600);
    setTimeout(() => {
      if (this.current?.id !== 'candles') return;
      o.sparkles.burst(cake.clone().add(V(0, 0.12, 0)));
      o.confetti.burst(cake.clone().add(V(0, 0.1, 0)), 1);
      this.audio.chime();
      this.audio.sparkle();
    }, 1500);
    setTimeout(() => { if (this.current?.id === 'candles') this.next(); }, 5600);
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

  // ── finale + the last-moment photo ───────────────────

  startFinale() {
    const o = this.o;
    this.ui.hideCard();
    this._ensureStars();
    this.ui.showFinale({ onAgain: () => this.restart(), onCapture: () => this.captureMoment() });
    const sh = this._shot(this.current);
    const dir = sh.target.clone().sub(sh.pos).setY(0).normalize();
    o.fireworks.startShow(sh.pos.clone().addScaledVector(dir, 115).setY(0), 32);
    this.audio.startCrackle();
    o.confetti.burst(V(0.2, 0.8, 0.3), 1.4);
  }

  endFinale() {
    this.ui.hideFinale();
    this.stopShow();
    this._cancelCapture();
  }

  /** The fireworks scene: a show over the open sky; on to the finale after a while. */
  startSky() {
    this._ensureStars();
    this.o.fireworks.startShow(this.skyShowCentre(this._shot(this.current)), 40);
    this.audio.startCrackle();
    const token = this._token;
    setTimeout(() => { if (token === this._token && this.current?.id === 'sky') this.next(); }, 14000);
  }

  stopShow() {
    this.o.fireworks.stopShow();
    this.audio.stopCrackle();
  }

  /**
   * The instant camera lifts off the table and flies out to the spot where the whole table and the name
   * in the stars fit one frame. You look through its viewfinder and press the shutter yourself; then it
   * turns to you and prints the photo, which develops as it floats over — ready to save as a story.
   */
  async captureMoment() {
    if (this._capturing || this.current?.id !== 'finale') return;
    const o = this.o, d = this.director, cam = o.instant, ui = this.ui;
    const token = (this._capToken = (this._capToken || 0) + 1);
    const alive = () => token === this._capToken && this.current?.id === 'finale';
    this._capturing = true;
    ui.hideFinale();
    this._ensureStars();
    const base = cam.focusPoint;
    this._capLabel = () => ({ at: cam.focusPoint, r: 0.09, place: 'side', placePortrait: 'below' });
    ui.hideCard();

    // 1 — the camera on the table, front-on
    await d.moveTo({ pos: base.clone().add(V(0.62, 0.1, 0.02)), target: base.clone().add(V(0, 0.03, 0)), fov: 36, frameX: -0.1 }, 2.0);
    if (!alive()) return;
    await wait(0.6);
    if (!alive()) return;

    // 2 — it flies out to the photo spot; we follow just behind it
    const { pos: spot, look } = this.photoSpot;
    const fwd = look.clone().sub(spot).normalize();
    const flat = fwd.clone().setY(0).normalize();
    const right = flat.clone().cross(V(0, 1, 0)).normalize();
    this.audio.whir(0.6);
    const flight = cam.flyTo(spot, look, 2.8);
    // ride right behind it the whole way, ending close and centred on its back (eyepiece and shutter in view)
    const rig = V(0, 0, 0);
    d.follow(() => { cam.rig.getWorldPosition(rig); return { pos: rig.clone().addScaledVector(flat, -0.42).add(V(0, 0.04, 0)), target: rig.clone().add(V(0, 0.01, 0)), fov: 40 }; }, 0.9);
    await flight;
    await wait(0.15);
    d.follow(null);
    if (!alive()) return;
    // wait for a tap: the eyepiece, the shutter button (anywhere on the camera) or the floating button
    ui.showCard({ eyebrow: '', title: '', body: '', actions: [{ label: 'Look through the viewfinder', icon: '👁', primary: true, onClick: () => this._eyeResolve?.() }] }, { reveal: true });
    await new Promise((resolve) => { this._eyeResolve = resolve; this._awaitEye = true; });
    this._awaitEye = false; this._eyeResolve = null;
    if (!alive()) return;
    ui.hideCard();

    // 3 — into the viewfinder: the view becomes exactly what the photo will be; you press the shutter
    const lens = cam.lensPose();
    await d.moveTo({ pos: lens.pos.clone(), target: lens.pos.clone().addScaledVector(fwd, 8), fov: 46 }, 1.0);
    if (!alive()) return;
    cam.model.visible = false;
    this.viewfinder = { pose: () => cam.lensPose(), fov: PHOTO_FOV };
    this._heartTimer = setInterval(() => {
      const side = Math.random() < 0.5 ? -1 : 1;
      const at = spot.clone().addScaledVector(flat, 95).addScaledVector(right, side * (18 + Math.random() * 10));
      at.y = 26 + Math.random() * 10;
      o.fireworks.launch(at, Math.random() < 0.6 ? 'heart' : 'peony');
    }, 2600);
    await new Promise((resolve) => ui.showViewfinder(resolve));
    if (!alive()) return;

    // click — flash — the shot, rendered big
    ui.viewfinderShot();
    cam.fire();
    this.audio.shutter();
    ui.flash();
    this.flashLight?.(spot, 2);
    const shot = await this.capture(cam.lensPose(), PHOTO_FOV, matchMedia('(pointer: coarse)').matches ? 1280 : 1600);
    clearInterval(this._heartTimer);
    this.viewfinder = null;
    ui.hideViewfinder();
    cam.model.visible = true;
    if (!alive()) return;
    const caption = 'Happy birthday ♥';
    this._photo = { shot, caption };
    this._storyFile = null;
    // prepare the story picture now, so "Save image" can open the share sheet straight from the tap
    drawStoryImage({ photo: shot, content: this.content, base: import.meta.env.BASE_URL })
      .then((cv) => canvasToFile(cv, `torson-odor-${Date.now()}.png`))
      .then((file) => { if (token === this._capToken) this._storyFile = file; })
      .catch((e) => console.warn('story image failed', e));
    const tex = polaroidTexture(shot, caption, 1024);

    // 4 — it turns to face you and prints the photo out of the top
    const viewer = spot.clone().addScaledVector(flat, -0.62).add(V(0, 0.04, 0));
    cam.turnTo(viewer, 1.2);
    await d.moveTo({ pos: viewer, target: spot.clone().add(V(0, 0.07, 0)), fov: 38 }, 1.4);
    if (!alive()) return;
    this.audio.whir(1.8);
    await cam.eject(tex, 1.8);
    if (!alive()) return;
    cam.develop(4.2);

    // 5 — the photo floats to you while it develops; the camera flies back to the table
    let root = cam.group;
    while (root.parent) root = root.parent;
    root.attach(cam.photo);
    this.audio.paper();
    this.presenter.present(cam.photo, { width: FILM_W, height: FILM_H, fillH: 0.66, fillHPortrait: 0.46, x: -0.13, y: 0.01, yPortrait: 0.13 }, { duration: 1.3 });
    this.director.focusOverride = 0.3;
    setTimeout(() => { if (alive()) cam.flyHome(2.6); }, 600);
    this._capLabel = () => ({ at: cam.photo.getWorldPosition(V(0, 0, 0)), r: FILM_W * 0.55, place: 'side', placePortrait: 'below' });
    await wait(1.3);
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
      file = await canvasToFile(cv, `torson-odor-${Date.now()}.png`);
      this._storyFile = file;
    }
    const r = await shareOrDownload(file, { title: `${this.content.finale.title}, ${this.content.name}!` });
    if (r === 'downloaded') this.ui.toast('Saved — a little piece of tonight 📷');
  }

  _cancelCapture() {
    this._capToken = (this._capToken || 0) + 1;
    this.director.follow(null);
    this._capturing = false;
    this._capLabel = null;
    this._awaitEye = false; this._eyeResolve = null;
    clearInterval(this._heartTimer);
    if (this.viewfinder) { this.viewfinder = null; this.ui.hideViewfinder(); }
    this.director.focusOverride = null;
    const cam = this.o.instant;
    this.presenter.release(cam.photo);
    cam.reset();
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
    o.letter.reset(); o.balloons.reset(); o.crystal.reset(); o.stars.reset(); o.jar.reset(); o.calendar.reset(); o.cassette.reset();
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
    gsap.to(this.timeOfDay, { v: ch.time, duration: ch.id === 'finale' ? 6 : 3.2, ease: 'sine.inOut' });
    clearTimeout(this._quietT);
    document.body.classList.add('moving');
    const move = this.director.moveTo(this._shot(ch), ch.duration || (ch.id === 'finale' ? 4.2 : 3.0));
    // the words appear once the camera has settled — or after the arrival animation (e.g. the calendar)
    move.then(async () => {
      if (token !== this._token) return;
      document.body.classList.remove('moving');
      const playing = ch.arrive?.();
      if (ch.textAfterArrive && playing?.then) await playing;
      if (token === this._token && card) setTimeout(() => { if (token === this._token) this.ui.revealCard(); }, 250);
    });
  }

  startIntro() {
    this.director.cut(this.intro.shot);
  }
}
