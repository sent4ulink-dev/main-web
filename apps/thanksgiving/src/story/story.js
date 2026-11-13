import * as THREE from 'three';
import gsap from 'gsap';
import { esc } from '../ui/ui.js';
import { getPath } from '../share/content-core.js';
import { longDate } from '../world/textures.js';
import { FLOOR, SPOTS, HALF_W } from '../world/layout.js';
import { THANKS_MAX } from '../share/guests-core.js';
import { HATS } from '../party/looks.js';
import { downloadICS, mapsURL } from '../share/calendar.js';
import { drawStoryImage, canvasToFile, shareOrDownload } from '../share/storyImage.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const portraitScreen = () => innerWidth / innerHeight < 1.1;
const DRESS_FACING = new THREE.Vector3(1, 0, 0.18).normalize();   // the dressing corner looks across the hall (the camera stays indoors)
/** Hats that stand up high over the head (they'd hide a chin behind them in the family photo). */
const TALL_HATS = new Set(['hat_pilgrim', 'hat_chef', 'hat_turkey']);
const tallHat = (a) => (TALL_HATS.has(HATS[a.look?.hat]?.part) ? 1 : 0);
/** `who` into the places `xs`: tall hats take the outermost places (nobody stands behind the row's ends). */
const byHats = (who, xs) => { const o = [...who].sort((p, q) => tallHat(q) - tallHat(p)); return [...xs].sort((u, v) => Math.abs(v) - Math.abs(u)).map((x, j) => ({ a: o[j], x })); };
const shuffle = (list) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** A shot that looks at `at` from `dist` metres along the horizontal direction `n`, raised by `up`. */
function front(at, n, dist, up, fov, extra = {}) { return { pos: at.clone().addScaledVector(n, dist).add(V(0, up, 0)), target: at.clone(), fov, ...extra }; }

/**
 * Thanksgiving at the farmhouse, chapter by chapter: the welcome chalked on the easel (and, wiped and
 * chalked again, when and where); finding your own name and dressing up your character (answering yes or
 * no, saying what you're thankful for, picking a potluck dish) — or, for the host, running the guest list;
 * the family's photos on the wall; the long table, alive with talk and food; going round the table saying
 * thanks; pulling the wishbone; everyone crowding round the old TV for the parade and the game; and the
 * family photo out on the porch steps.
 */
export class Story {
  constructor(ctx) {
    Object.assign(this, ctx);   // director, ui, audio, world, o (objects), content, roster, presenter, capture(), dress, hostPanel, repo, photos, preview
    this.index = -1;
    this.viewfinder = null;
    this.shake = 0;
    this.focusActor = null;     // whose speech bubble is showing
    this._build();
  }

  get crowd() { return this.world.crowd; }
  get lay() { return this.world.lay; }
  // (as the editor's live preview, the card is shown the way the family sees it)
  get isHost() { return !this.preview && this.roster.isHost; }
  get editing() { return document.body.classList.contains('editing'); }

  _build() {
    const o = this.o;
    this.intro = { shot: { pos: V(0, 1.55, 11.2), target: V(0, 3.0, 0), fov: 48, portraitFov: portraitScreen() ? 64 : undefined } };
    this.introLabel = { at: V(0, 5.35, -0.5), r: 0, place: 'center', placePortrait: 'center' };
    const signAt = () => o.sign.focusPoint, nSign = () => o.sign.normal;
    const nSignPhone = () => nSign().applyAxisAngle(V(0, 1, 0), -0.12);   // phones stand further back: a touch round, clear of the open front door
    this.chapters = [
      {
        id: 'welcome', navTitle: 'Welcome', life: 'table',
        shot: () => front(signAt(), nSign(), 1.75, 0.05, 40),
        shotPortrait: () => front(signAt().add(V(0, 0.05, 0)), nSignPhone(), 2.5, 0.1, 40, { portraitFov: 56, mobileOffset: V(0, 0.05, 0) }),   // (no words under it: the board fills the screen)
        enter: () => this._welcomeCard(), card: () => this._welcomeCard(),
        arrive: () => this._board('welcome'),
        label: () => this._signLabel(),
      },
      {
        id: 'details', navTitle: 'When & where', life: 'table',
        shot: () => front(signAt(), nSign(), 1.75, 0.0, 40, { frameX: -0.06 }),
        shotPortrait: () => front(signAt().add(V(0, 0.15, 0)), nSignPhone(), 2.7, 0.12, 38, { portraitFov: 56, mobileOffset: V(0, -0.2, 0) }),
        enter: () => this._detailsCard(), card: () => this._detailsCard(),
        arrive: () => this._board('details'),
        label: () => this._signLabel(),
      },
      {
        id: 'you', navTitle: this.isHost ? 'Guest list' : 'You', life: 'table',
        shot: () => this._youShot(false), shotPortrait: () => this._youShot(true),
        enter: () => this._youEnter(),
        label: () => this._youLabel(),
        hitPeople: () => this.isHost && this._pickToDress,
        onPerson: (a) => this._dressFromTable(a),
        leave: () => this._youLeave(),
      },
      {
        id: 'family', navTitle: 'Family photos', life: 'table',
        shot: () => this._wallShot(false), shotPortrait: () => this._wallShot(true),
        enter: () => this._wallCard(), card: () => this._wallCard(),
        label: () => (portraitScreen() ? { at: o.wall.bottomPoint, r: 0.05, placePortrait: 'below', stay: true } : { at: o.wall.centre, r: o.wall.halfWidth, place: 'side' }),
        hits: () => o.wall.hitTargets,
        onHit: (m) => this._wallTap(m),
      },
      {
        id: 'table', navTitle: 'The table', life: 'table',
        shot: () => this._tableShot(false), shotPortrait: () => this._tableShot(true),
        enter: () => { this.roster.refresh().then((ok) => ok && this.reseat()); return this._tableCard(); },
        card: () => this._tableCard(),
        label: () => this._tableLabel(),
        hitPeople: () => true,
        onPerson: (a) => this.sayHi(a),
        arrive: () => this._wave(),
        leave: () => this._clearBubble(),
      },
      {
        id: 'thanks', navTitle: 'Thankful', life: 'listen',
        shot: () => this._tableShot(false), shotPortrait: () => this._tableShot(true),
        enter: () => this._thanksEnter(),
        // the words beside the one speaking; on phones down at the tabletop in front of them, clear of their face
        label: () => (!this._thanksAt ? this._tableLabel() : portraitScreen() ? { at: this._thanksAt().add(V(0, -0.5, 0)), r: 0.05, placePortrait: 'below', stay: true } : { at: this._thanksAt(), r: 0.3, place: 'side' }),
        arrive: () => this._thanksArrive(),
        leave: () => this._thanksLeave(),
      },
      {
        id: 'wishbone', navTitle: 'Wishbone', life: 'listen',
        shot: () => this._wishShot(false), shotPortrait: () => this._wishShot(true),
        enter: () => this._wishEnter(),
        label: () => (portraitScreen() ? { at: V(SPOTS.wishbone.x, FLOOR, SPOTS.wishbone.z + 0.1), r: 0.05, placePortrait: 'below', stay: true } : { at: V(SPOTS.wishbone.x, FLOOR + 1.3, SPOTS.wishbone.z), r: 0.6, place: 'side' }),
        leave: () => this._wishLeave(),
      },
      {
        id: 'gameday', navTitle: 'Game day', life: 'off',
        shot: () => this._tvClose(false), shotPortrait: () => this._tvClose(true),
        enter: () => this._tvEnter(), card: () => this._tvCard(),
        // phones: up on the plain wall over the banner (the plaid sofa is too busy to read on)
        label: () => (!this._tvWideNow ? null : portraitScreen() ? { at: this.world.house.o.banner.position.clone().add(V(0, 0.33, 0)), r: 0.05, placePortrait: 'above', stay: true } : { at: o.tv.focusPoint.add(V(0, 0.25, 0)), r: 0.55, place: 'side' }),
        arrive: () => this._tvArrive(),
        leave: (next) => this._tvLeave(next),
      },
      {
        id: 'photo', navTitle: 'Family photo', duration: 3.6, life: 'off',
        shot: () => this._photoShot(false), shotPortrait: () => this._photoShot(true),
        enter: () => { this._goOutside(); return null; },
        label: () => this._capLabel?.() || null,
        arrive: () => this.startFinale(),
        hits: () => (this._capturing ? [] : o.tripod.hitTargets),
        onHit: () => this.takePhoto(),
        leave: () => { this.endFinale(); this._comeInside(); },
      },
    ];
  }

  /** Beside the welcome easel (wide screens), or under its feet (phones). */
  _signLabel() {
    const o = this.o;
    return portraitScreen() ? { at: o.sign.root.position.clone().add(V(0, 0.05, 0)), r: 0.05, placePortrait: 'below', stay: true } : { at: o.sign.focusPoint.add(V(0, -0.62, 0)), r: 0.42, place: 'side' };
  }

  /** A content field, rendered so the host can edit it in place. */
  k(path) { return `<span data-k="${path}">${esc(getPath(this.content, path) ?? '')}</span>`; }
  _shot(ch) { const s = portraitScreen() && ch.shotPortrait ? ch.shotPortrait : ch.shot; return typeof s === 'function' ? s() : s; }
  labelAnchor() { return this.current?.label?.() || null; }
  refreshCard() {
    const ch = this.current; if (!ch) return;
    const card = ch.card ? ch.card() : ch.enter();
    if (card) this.ui.showCard(card, { reveal: true }); else this.ui.hideCard();
  }
  /** Re-seat the family after the guest list changed. */
  reseat() { this.world.setGuests(this.roster.guests, { party: this.roster.party, hideNo: this.roster.answersShown }); }

  // ── the door ───────────────────────────────────────
  openDoor() {
    if (this._doorOpen) return;
    this._doorOpen = true;
    this.audio.door();
    if (this.o.door) gsap.to(this.o.door.rotation, { y: 2.75, duration: 2.6, ease: 'power2.inOut' });   // swinging in, back against the wall
  }

  // ── the chalkboard: welcome, then when & where ─────
  _greeting() { const me = this.roster.me; return me && !this.editing ? `Dear ${me.name},` : null; }
  /** Chalk `mode` on the board (wiping what's there first) — unless it's already up. */
  async _board(mode) {
    const s = this.o.sign;
    if (this.editing) { s.paint(this.content, mode, { greeting: null }); return; }
    if (s.shown === mode && !s.busy) return;
    const token = (this._boardT = (this._boardT || 0) + 1);
    if (s.shown || s.busy) { this.audio.erase(); await s.erase(); }   // (half-written words get wiped too)
    if (token !== this._boardT) return;
    await s.write(this.content, mode, { greeting: mode === 'welcome' ? this._greeting() : null, onStroke: () => this.audio.chalk() });
  }
  /** While the host edits the wording, the letter is there to edit; otherwise the board says it all. */
  _welcomeCard() {
    if (!this.editing) return null;
    const L = this.content.letter;
    const paras = L.paragraphs.map((p, i) => `<p>${this.k(`letter.paragraphs.${i}`)}</p>`).join('');
    return { eyebrow: 'A note from the host', title: '', body: `<div class="letter"><p class="greet">${this.k('letter.greeting')}</p>${paras}<p class="sign">${this.k('letter.signoff')}</p><p class="from">${this.k('host')}</p></div><p><small>The first paragraph is chalked on the welcome board.</small></p>`, actions: [] };
  }
  _detailsCard() {
    const actions = [
      { label: 'Add to calendar', icon: '📅', primary: true, onClick: () => { downloadICS(this.content); this.ui.toast('Calendar file ready — open it to save the date 📅', 3200); } },
      { label: 'Directions', icon: '🗺', onClick: () => window.open(mapsURL(this.content.place.address), '_blank', 'noopener') },
    ];
    if (!this.editing) return { eyebrow: '', title: '', body: '', actions };
    const d = this.content.date;
    const rows = `<div class="details">
      <div class="big-day"><span data-k="date.iso" data-kind="date">${esc(longDate(d.iso))}</span></div>
      <div class="row"><span class="ico">🕑</span><span>Doors open <b>${this.k('date.time')}</b> · dinner at <b>${this.k('date.dinner')}</b></span></div>
      <div class="row"><span class="ico">🏡</span><span><b>${this.k('place.name')}</b><br>${this.k('place.address')}</span></div>
      <div class="row"><span class="ico">🍂</span><span>${this.k('place.note')}</span></div>
    </div>`;
    return { eyebrow: this.k('date.label'), title: '', body: rows, actions };
  }

  // ── you (a guest) / the guest list (the host) ──────
  _youShot(portrait) {
    if (this._youStep === 'dress' || this._youStep === 'answer') {
      const at = V(SPOTS.dress.x, FLOOR + 0.62, SPOTS.dress.z), n = DRESS_FACING;
      if (!portrait) return front(at, n, 3.3, 0.38, 38, { frameX: -0.2 });
      // phones: dressing, the character big between the top buttons and the dock; answering, small up top over the text
      return this._youStep === 'dress'
        ? front(at.clone().add(V(0, 0.05, 0)), n, 2.2, 0.4, 40, { portraitFov: 54, mobileOffset: V(0, 0.1, 0) })
        : front(at.clone().add(V(0, 0.05, 0)), n, 4.4, 0.55, 40, { portraitFov: 54, mobileOffset: V(0, -0.8, 0) });
    }
    return this._tableShot(portrait);
  }
  _youLabel() {
    document.body.classList.toggle('in-corner', this._youStep === 'dress' || this._youStep === 'answer');
    if (this._youStep === 'dress' || this._youStep === 'answer') return portraitScreen() ? { at: V(SPOTS.dress.x, FLOOR + 0.02, SPOTS.dress.z), r: 0.2, placePortrait: 'below', stay: true } : { at: V(SPOTS.dress.x, FLOOR + 0.85, SPOTS.dress.z), r: 0.42, place: 'side' };
    return this._tableLabel();
  }

  _youEnter() {
    // (the editor's live preview: whoever the host is dressing stands in the dressing corner)
    const dressed = this.preview && this._previewDress && this.roster.byId(this._previewDress);
    if (dressed) { this._youStep = 'dress'; this._standUp(dressed); return null; }
    if (this.isHost) { this._youStep = 'host'; return this._hostCard(); }
    const me = this.roster.me;
    if (!me) { this._youStep = 'pick'; return this._pickCard(); }
    this._youStep = 'answer';
    this._standUp(me);
    return this._answerCard();
  }

  _youLeave() {
    document.body.classList.remove('in-corner');
    this.dress.close();
    this._endPickToDress(false);
    if (this._dressed) { this._sitDown(this._dressed); this._dressed = null; }
    this._youStep = null;
    this._clearBubble();
  }

  /** The names to pick from (the ones on another phone are greyed out). */
  _pickCard() {
    const names = this.roster.guests.map((g) => {
      const taken = g.claimed && !this.roster.mine.includes(g.id);
      return `<button type="button" class="name-chip${taken ? ' taken' : ''}" data-claim="${g.id}"${taken ? ' disabled aria-disabled="true"' : ''}>${g.age === 'child' ? '🧒' : g.sex === 'm' ? '👨' : '👩'} ${esc(g.name)}${taken ? ' <small>joined</small>' : ''}</button>`;
    }).join('');
    const body = this.roster.guests.length
      ? `<p>Find your name on the guest list and tap it — then dress up your character and let ${this.k('host')} know if you’re coming.</p><div class="names">${names}</div>`
      : '<p>The guest list is still being made — check back soon!</p>';
    return { eyebrow: 'Who are you?', title: 'Find your seat', body, actions: [] };
  }

  async claim(id) {
    const g = this.roster.byId(id);
    if (!g) return;
    if (!confirm(`Are you ${g.name}?\n\nThis name will be kept on this phone, so only you can dress up ${g.name} and answer for them.`)) return;
    try {
      await this.roster.claim(id);
      this.audio.tada();
      this.ui.toast(`Hi ${g.name}! 🍂`);
      this.reseat();
      this._youStep = 'answer';
      this._standUp(this.roster.me);
      this.ui.holdCard();
      await this.director.moveTo(this._shot(this.current), 2.0);
      if (this.current?.id !== 'you') return;
      this.startDressing();
    } catch (err) {
      this.ui.toast(err.message, 4200);
      if (err.status === 409) { await this.roster.refresh(); this.reseat(); this.refreshCard(); }
    }
  }

  /** Bring someone out from the table to the dressing corner (or make them a stand-in if they're not seated). */
  _standUp(g) {
    let a = this.world.actors.get(g.id);
    if (!a) { a = this._standIn || (this._standIn = this.crowd.add({ look: this.roster.lookOf(g), kid: g.age === 'child', sex: g.sex, name: g.name, id: g.id })); a.set(this.roster.lookOf(g)); a.kid = g.age === 'child'; a.sex = g.sex; }
    if (this._dressed && this._dressed !== a) this._sitDown(this._dressed);
    this._dressed = a;
    a.scripted = true; a.lookAt = null;
    this.world.standAt(a, SPOTS.dress.x, SPOTS.dress.z, Math.atan2(DRESS_FACING.x, DRESS_FACING.z));
    a.pop = 1; a.play('wave');
    setTimeout(() => { if (this._dressed === a) a.play('idle'); }, 1600);
    return a;
  }
  _sitDown(a) {
    a.scripted = false;
    if (a === this._standIn) { a.show(false); return; }
    if (a.home) this.world.sit(a);
  }

  startDressing() {
    const g = this.roster.me; if (!g) return;
    const a = this._dressed || this._standUp(g);
    this._youStep = 'dress';
    this.ui.hideCard();
    this.dress.open({
      look: this.roster.lookOf(g), sex: g.sex,
      onChange: (look, what) => { a.set(look); if (what === 'random') { a.play('cheer'); setTimeout(() => a.play('idle'), 900); } this.audio.pop(0.9 + Math.random() * 0.3); },
      onDone: async (look) => {
        this._youStep = 'answer';
        try { await this.roster.update(g.id, { look }); this.audio.chime(); } catch (err) { this.ui.toast(`Couldn’t save — ${err.message}`); }
        a.play('wave'); setTimeout(() => a.play('idle'), 1500);
        if (this.current?.id === 'you') { this.ui.showCard(this._answerCard(), { reveal: true }); this.reseat(); }
      },
    });
  }

  /** After dressing: yes / no (once), the thankful line, the potluck dish. */
  _answerCard() {
    const g = this.roster.me, R = this.roster;
    const others = R.mine.length > 1 ? `<div class="who-switch">This phone holds: ${R.mine.map((id) => `<button type="button" data-who="${id}" class="${id === R.active ? 'on' : ''}">${esc(R.byId(id)?.name || '')}</button>`).join('')}</div>` : '';
    const answer = g.rsvp === 'yes' ? '<div class="answer yes">✓ You’re coming — see you there!</div>' : g.rsvp === 'no' ? '<div class="answer no">✗ You can’t make it this year — you’ll be missed!</div>'
      : `<p>Will you join us on <b>${esc(longDate(this.content.date.iso))}</b>? <small>(You can answer once.)</small></p><div class="rsvp"><button type="button" class="btn-float primary" data-rsvp="yes"><span class="spark" aria-hidden="true">🦃</span> Yes, I’ll be there</button><button type="button" class="btn-float" data-rsvp="no">Sorry, can’t make it</button></div>`;
    const thanks = `<p style="margin-top:14px">This year I’m thankful for…</p><textarea class="thanks-field" maxlength="${THANKS_MAX}" rows="2" placeholder="My family, second helpings…" data-thanks>${esc(g.thanks || '')}</textarea><span class="field-count">${(g.thanks || '').length}/${THANKS_MAX}</span>`;
    let dishes = '';
    if (R.party.potluck && R.party.dishes.length && g.rsvp !== 'no') {
      const takers = R.dishTakers;
      dishes = `<p style="margin-top:14px">Bring something for the table?</p><div class="dishes">${R.party.dishes.map((d) => {
        const t = takers.get(d.toLowerCase()), mine = t?.id === g.id, taken = t && !mine;
        return `<button type="button" class="dish-chip${mine ? ' mine' : ''}${taken ? ' taken' : ''}" data-dish="${esc(d)}"${taken ? ' disabled' : ''}>${mine ? '✓ ' : ''}${esc(d)}${taken ? ` <small>· ${R.answersShown ? esc(t.name) : 'taken'}</small>` : ''}</button>`;
      }).join('')}</div>`;
    }
    const add = R.guests.some((x) => !x.claimed && !R.mine.includes(x.id)) ? { label: 'Add someone else', icon: '＋', onClick: () => { this._youStep = 'pick'; this.ui.showCard(this._pickCard(), { reveal: true }); } } : null;
    return { eyebrow: `Hello, ${esc(g.name)}`, title: '', body: `${others}${answer}${thanks}${dishes}`, actions: [
      { label: 'Dress up', icon: '👕', onClick: () => this.startDressing() },
      { label: 'Save', icon: '✓', primary: true, id: 'btn-save-me', onClick: () => this.saveThanks(true) },
      ...(add ? [add] : []),
    ] };
  }

  async answer(v) {
    const g = this.roster.me; if (!g) return;
    const q = v === 'yes' ? `Wonderful! Confirm that ${g.name} is coming? (You can only answer once.)` : `Confirm that ${g.name} can’t make it? (You can only answer once.)`;
    if (!confirm(q)) return;
    try {
      await this.roster.update(g.id, { rsvp: v });
      const a = this._dressed;
      if (v === 'yes') { this.audio.tada(); this.o.confetti.burst(V(SPOTS.dress.x, FLOOR + 1.2, SPOTS.dress.z), { palette: 'leaves', floor: FLOOR, spread: 0.6, up: 2.4 }); a?.play('cheer'); }
      else { this.audio.aww(); a?.play('sad'); }
      setTimeout(() => a?.play('idle'), 2200);
      this.refreshCard();
    } catch (err) { this.ui.toast(err.message, 4200); }
  }

  async saveThanks(andGo = false) {
    const g = this.roster.me; if (!g) return;
    const el = document.querySelector('[data-thanks]');
    const text = el ? el.value.trim().slice(0, THANKS_MAX) : g.thanks;
    try {
      if (text !== (g.thanks || '')) await this.roster.update(g.id, { thanks: text });
      this.ui.toast('Saved ✓');
      this.audio.chime();
      if (andGo) this.next();
    } catch (err) { this.ui.toast(`Couldn’t save — ${err.message}`); }
  }

  async pickDish(d) {
    const g = this.roster.me; if (!g) return;
    const mine = g.dish && g.dish.toLowerCase() === d.toLowerCase();
    try {
      await this.roster.update(g.id, { dish: mine ? null : d });
      this.audio.pop(1.1);
      this.reseat();
      const el = document.querySelector('[data-thanks]'); const keep = el?.value;
      this.refreshCard();
      const el2 = document.querySelector('[data-thanks]'); if (el2 && keep != null) el2.value = keep;
    } catch (err) { this.ui.toast(err.message, 4200); if (err.status === 409) { await this.roster.refresh(); this.refreshCard(); } }
  }

  switchWho(id) {
    if (!this.roster.mine.includes(id)) return;
    this.roster.active = id;
    this._standUp(this.roster.me);
    this.refreshCard();
  }

  /** The host's view of the guest list. */
  _hostCard() {
    const R = this.roster, c = R.counts;
    const studio = this.repo.mode.kind === 'studio';
    const list = R.guests.slice(0, 8).map((g) => `${esc(g.name)}${R.answersShown && g.rsvp ? (g.rsvp === 'yes' ? ' ✓' : ' ✗') : ''}`).join(' · ') + (R.guests.length > 8 ? ` · +${R.guests.length - 8} more` : '');
    const body = R.guests.length
      ? `<p>${c.invited} invited · <b>${c.yes}</b> coming · ${c.no} can’t · ${c.waiting} still deciding · ${c.joined} joined from their phone</p><p><small>${list}</small></p>`
      : '<p>Add everyone you’re inviting — each person gets a seat (and a character) at the table.</p>';
    return { eyebrow: 'For the host', title: 'Your guest list', body, actions: [
      { label: 'Edit guest list', icon: '👥', primary: true, onClick: () => this.hostPanel.open() },
      ...(studio ? [] : [{ label: R.guestLink ? 'Guest link' : 'Make the guest link', icon: '🔗', onClick: () => this.shareGuestLink() }]),
      ...(R.guests.length ? [{ label: 'Dress someone up', icon: '👕', onClick: () => this._startPickToDress() }] : []),
    ] };
  }

  /** Tap-someone-to-dress: the card steps out of the way (so the table can be tapped), a small hint stays. */
  _startPickToDress() {
    this._pickToDress = true;
    this.ui.hideCard();
    this.ui.hint('Tap anyone at the table to dress them up', { label: 'Cancel', onClick: () => this._endPickToDress(true) });
  }
  _endPickToDress(showCard) {
    if (!this._pickToDress) return;
    this._pickToDress = false;
    this.ui.hint(null);
    if (showCard && this.current?.id === 'you' && this._youStep === 'host') this.ui.showCard(this._hostCard(), { reveal: true });
  }

  async shareGuestLink() {
    try {
      const url = this.roster.guestLink || await this.roster.makeGuestLink();
      const demo = this.repo?.mode.kind === 'test';
      this.ui.showLink(url, demo
        ? { title: 'The guest link', note: 'Send this one link to the whole family (a group chat is perfect). In this demo it opens right here, so you can try it: tap a name, dress up your character and answer yes or no.', open: 'Open it as a guest' }
        : { title: 'The guest link', note: 'Send this one link to the whole family (a group chat is perfect). Each person taps their own name, dresses up their character and answers yes or no.' });
      if (this.current?.id === 'you') this.refreshCard();
    } catch (err) { this.ui.toast(`Couldn’t make the link — ${err.message}`); }
  }

  _dressFromTable(a) { this._endPickToDress(false); this.hostDress(a.id); }

  /** The host dresses anyone up (from the list or by tapping them at the table). */
  async hostDress(id) {
    const g = this.roster.byId(id); if (!g) return;
    if (this.current?.id !== 'you') { this.goTo(this.chapters.findIndex((c) => c.id === 'you')); await wait(0.1); }
    this._hostDressing = id;
    const a = this._standUp(g);
    this._youStep = 'dress';
    this.ui.hideCard();
    await this.director.moveTo(this._shot(this.current), 1.8);
    this.dress.open({
      look: this.roster.lookOf(g), sex: g.sex, doneLabel: `Save ${g.name}`,
      onChange: (look) => { a.set(look); this.audio.pop(0.9 + Math.random() * 0.3); },
      onCancel: () => this._afterHostDress(),
      onDone: async (look) => {
        try { await this.roster.update(id, { look }); this.audio.chime(); this.ui.toast(`${g.name} looks great ✓`); } catch (err) { this.ui.toast(`Couldn’t save — ${err.message}`); }
        this._afterHostDress();
      },
    });
  }
  async _afterHostDress() {
    this._youStep = 'host';
    if (this._dressed) { this._sitDown(this._dressed); this._dressed = null; }
    this.reseat();
    await this.director.moveTo(this._shot(this.current), 1.8);
    if (this.current?.id === 'you') this.ui.showCard(this._hostCard(), { reveal: true });
  }

  // ── the family photos on the wall ──────────────────
  _wallShot(portrait) {
    const w = this.o.wall, n = V(1, 0, 0);
    return portrait
      ? front(w.centre.add(V(0, -0.1, 0)), n, 3.9, 0.1, 40, { portraitFov: 56, mobileOffset: V(0, -0.02, 0) })   // (the plaque clear below the logo)
      : front(w.centre.add(V(0, -0.05, 0)), n.clone().add(V(0, 0, 0.1)).normalize(), 3.35, -0.05, 40, { frameX: -0.14 });
  }
  _wallCard() {
    const host = this.isHost && this.repo.canPhotos, has = this.o.wall.count > 0;
    const body = host
      ? `<p>Hang your own family photos here — tap a frame to pick a picture (or to take one down). Everyone who opens the card will see them.</p>`
      : has ? '<p>Tap a photo to look closer.</p>' : `<p>A few old snapshots for now — ${this.k('host')} will hang more family photos here soon. Tap one to look closer.</p>`;
    return { eyebrow: `The ${esc(this.content.family.replace(/^the\s+/i, ''))}`, title: 'Through the years', body, actions: host ? [{ label: 'Add photos', icon: '🖼', primary: true, onClick: () => this.photos.pick() }] : [] };
  }
  _wallTap(mesh) {
    const n = this.o.wall.slotOf(mesh); if (n == null) return;
    if (this.isHost && this.repo.canPhotos) { this.photos.tapSlot(n); return; }
    const url = this.photos.urlOf(n) || this.o.wall.paintedURL(n);
    if (url) this.ui.lightbox(url);
  }

  // ── the table ──────────────────────────────────────
  _tableShot(portrait) {
    const L = this.lay;
    const far = Math.min(L.L, 9);
    return portrait
      ? { pos: V(0, FLOOR + 3.3, L.zHead + 2.6), target: V(0, FLOOR + 0.3, L.zHead - far * 0.45), fov: 50, portraitFov: 64, mobileOffset: V(0, -1.6, 0) }   // high, looking down its length: the table in the top half, the text below
      : { pos: V(0, FLOOR + 2.55, L.zHead + 2.4), target: V(0, FLOOR + 0.75, L.zHead - far * 0.42), fov: 50, frameX: 0.17 };
  }

  /** The table's text: on wide screens to the left of the table (which sits right of centre), on phones below its near end. */
  _tableLabel() { return portraitScreen() ? { at: V(0, FLOOR, this.lay.zHead - 0.3), r: 0.05, placePortrait: 'below', stay: true } : { at: V(0, FLOOR + 1.0, this.lay.zHead - 1.2), r: 0, place: 'left' }; }

  _tableCard() {
    const R = this.roster, n = this.world.seated.length;
    const dishes = R.party.potluck ? R.guests.filter((g) => g.dish) : [];
    const list = dishes.length ? `<p><small>On the table: ${dishes.slice(0, 8).map((g) => `${esc(g.dish)} (${esc(g.name)})`).join(' · ')}${dishes.length > 8 ? '…' : ''}</small></p>` : '';
    const body = `<p>${n ? `${n} seats are set${R.answersShown ? `, ${R.counts.yes} confirmed` : ''}.` : 'The table is set.'} Tap anyone to hear what they’re thankful for.</p>${list}`;
    return { eyebrow: this.k('date.label'), title: 'Everyone at the table', body, actions: [{ label: 'Go around the table', icon: '🍂', primary: true, onClick: () => this.next() }] };
  }

  _wave() { for (const a of this.crowd.actors) if (a.visible && !a.away && !a.scripted && Math.random() < 0.25) { a.play('wave'); setTimeout(() => { if (a.anim === 'wave') a.play('idle'); }, 1200 + Math.random() * 1500); } }

  /** Tap someone: a little bubble with their name, their thankful line and their dish. */
  sayHi(a) {
    const g = a.guest; if (!g) return;
    this._clearBubble();
    this.focusActor = a; a.scripted = true; a.lookAt = this.director.camera.position.clone();
    a.play('wave'); setTimeout(() => { if (this.focusActor === a) a.play('talk'); }, 900);
    this.audio.pop(1 + Math.random() * 0.3);
    const meta = [g.dish && this.roster.party.potluck ? `🥧 Bringing ${g.dish}` : '', this.roster.answersShown && !g.rsvp ? '… hasn’t answered yet' : ''].filter(Boolean).join(' · ');
    this.ui.bubble({ name: g.name, text: g.thanks ? `“${g.thanks}”` : (g.claimed ? 'Happy Thanksgiving!' : 'Hasn’t joined yet'), meta });
    clearTimeout(this._hiT); this._hiT = setTimeout(() => this._clearBubble(), 6500);
  }
  bubbleAnchor() { const a = this.focusActor; return a && a.visible ? a.headPoint().add(V(0, 0.32 * a.scale, 0)) : null; }
  _clearBubble() { const a = this.focusActor; if (a) { a.play('idle'); a.scripted = false; a.lookAt = null; } this.focusActor = null; this.ui.hideBubble(); }

  // ── going round the table ──────────────────────────
  _thanksList() {
    const seated = this.world.seated.filter((g) => g.thanks && g.thanks.trim());
    if (seated.length) return seated;
    return this.world.seated.slice(0, 1).map((g) => ({ ...g, thanks: 'Grateful for every one of you.' }));
  }
  _thanksEnter() {
    this._round = { list: this._thanksList(), i: -1, playing: false };
    this._thanksAt = null;
    return { eyebrow: 'A Thanksgiving tradition', title: 'Going around the table', body: '<p>Before we eat, everyone says one thing they’re thankful for this year.</p>', actions: [{ label: 'Start', icon: '▶', primary: true, onClick: () => this._thanksPlay() }] };
  }
  _thanksArrive() { if (!this._round.started) setTimeout(() => { if (this.current?.id === 'thanks' && !this._round.started) this._thanksPlay(); }, 1800); }
  _thanksPlay() { const r = this._round; r.started = true; r.playing = true; this._thanksGo(r.i + 1); }
  /** Looking at the one speaking from right across the table (over the cloth, so nobody's hat or hair gets in the way). */
  _speakerShot(a) {
    const head = a.headPoint(), side = a.home?.side ?? 1, n = V(-side, 0, 0);
    return portraitScreen()
      ? front(head.clone().add(V(0, -0.1, 0)), n.clone().add(V(0, 0, 0.1)).normalize(), 1.2, 0.26, 40, { portraitFov: 60, mobileOffset: V(0, -0.12, 0) })
      : front(head.clone().add(V(0, -0.06, 0)), n.clone().add(V(0, 0, 0.14)).normalize(), 1.42, 0.27, 36, { frameX: -0.15 });
  }
  async _thanksGo(i) {
    const r = this._round, list = r.list;
    clearTimeout(this._thT);
    if (i >= list.length) return this._thanksFinish();
    r.i = Math.max(0, i);
    const g = list[r.i], a = this.world.actors.get(g.id);
    if (!a) return this._thanksGo(r.i + 1);
    const token = (this._thToken = (this._thToken || 0) + 1);
    this._clearBubble();
    this.ui.holdCard();
    if (this._speaker && this._speaker !== a) { this._speaker.scripted = false; this._speaker.play('idle'); }
    this._speaker = a; a.scripted = true; a.lookAt = null;
    for (const x of this.crowd.actors) if (x !== a && !x.away) { x.lookAt = a.headPoint(); if (!x.scripted) x.play('idle'); }
    await this.director.moveTo(this._speakerShot(a), r.i === 0 ? 2.0 : 1.4);
    if (token !== this._thToken || this.current?.id !== 'thanks') return;
    a.lookAt = this.director.camera.position.clone().lerp(a.headPoint(), 0.4);
    a.play('speech');
    this.audio.clink();
    this._thanksAt = () => a.headPoint().add(V(0, 0.1, 0));
    this.ui.showCard({ eyebrow: `${r.i + 1} of ${list.length}`, title: esc(g.name), body: `<p class="hand">“${esc(g.thanks)}”</p>`, actions: this._thanksActions() }, { reveal: true });
    const talk = 2.2 + Math.min(4, g.thanks.length * 0.045);
    setTimeout(() => { if (token === this._thToken && this._speaker === a) a.play('toast'); }, talk * 1000);
    if (r.playing) this._thT = setTimeout(() => { if (token === this._thToken && r.playing) this._thanksGo(r.i + 1); }, (talk + 1.8) * 1000);
  }
  _thanksActions() {
    const r = this._round;
    return [
      { label: '‹', disabled: r.i <= 0, onClick: () => { r.playing = false; this._thanksGo(r.i - 1); } },
      { label: r.playing ? 'Pause' : 'Play', icon: r.playing ? '⏸' : '▶', onClick: () => {
        r.playing = !r.playing;
        if (r.playing) this._thanksGo(r.i + 1); else { clearTimeout(this._thT); this.ui.setActions(this._thanksActions()); }
      } },
      { label: '›', primary: true, onClick: () => this._thanksGo(r.i + 1) },
    ];
  }
  _releaseSpeaker() { if (this._speaker) { this._speaker.scripted = false; this._speaker.play('idle'); this._speaker = null; } }
  async _thanksFinish() {
    const token = (this._thToken = (this._thToken || 0) + 1);
    this._thanksAt = null;
    this._releaseSpeaker();
    this.ui.holdCard();
    for (const x of this.crowd.actors) { if (x.away) continue; x.lookAt = null; x.scripted = true; x.play('toast'); }
    this.audio.cheer();
    await this.director.moveTo(this._shot(this.current), 2.0);
    if (token !== this._thToken || this.current?.id !== 'thanks') return;
    this.ui.showCard({ eyebrow: '', title: 'Cheers to all of us!', body: '<p class="hand">Let’s eat 🦃</p>', actions: [{ label: 'Pull the wishbone', icon: '🦴', primary: true, onClick: () => this.next() }, { label: 'Again', onClick: () => { this._round.i = -1; this._thanksPlay(); } }] }, { reveal: true });
    setTimeout(() => { for (const x of this.crowd.actors) if (!x.away) { x.scripted = false; x.play('idle'); } }, 2600);
  }
  _thanksLeave() {
    this._thToken = (this._thToken || 0) + 1;
    clearTimeout(this._thT);
    this._thanksAt = null;
    this._releaseSpeaker();
    for (const x of this.crowd.actors) if (!x.away) { x.lookAt = null; x.scripted = false; x.play('idle'); }
  }

  // ── the wishbone ───────────────────────────────────
  _wishShot(portrait) {
    const at = V(SPOTS.wishbone.x, FLOOR + 0.72, SPOTS.wishbone.z);
    return portrait ? { pos: at.clone().add(V(0.05, 0.9, 2.8)), target: at.clone().add(V(0, -0.05, 0)), fov: 46, portraitFov: 62, mobileOffset: V(0, -0.45, 0) } : { pos: at.clone().add(V(0.15, 0.5, 2.6)), target: at, fov: 40, frameX: -0.16 };
  }
  /** Who pulls next: you (if you're here) against the next in a shuffled line, so everyone gets a turn. */
  _wishPair() {
    const all = [...this.world.actors.values()].filter((a) => a.visible);
    const me = this.roster.me ? this.world.actors.get(this.roster.me.id) : null;
    const others = all.filter((x) => x !== me);
    this._wishLine = (this._wishLine || []).filter((x) => others.includes(x));
    const next = () => { if (!this._wishLine.length) this._wishLine = shuffle(others.filter((x) => x !== this._wishLast)); return this._wishLine.shift(); };
    const A = me || next(), B = next();
    if (B) this._wishLast = B;
    return [A, B && B !== A ? B : null];
  }
  _wishEnter() {
    const [A, B] = this._wishPair();
    if (!A || !B) return { eyebrow: '', title: 'The wishbone', body: '<p>Invite someone to pull it with you!</p>', actions: [] };
    const me = this.roster.me ? this.world.actors.get(this.roster.me.id) : null;
    this._wish = { A, B, done: false };
    // where the two stand: close enough for both pairs of hands to meet the bone, at a height both can reach
    const c = V(SPOTS.wishbone.x, 0, SPOTS.wishbone.z);
    const natural = (x) => FLOOR + 0.37 * x.scale + (0.31 - 0.232 * 0.22) * x.scale;
    const hy = (natural(A) + natural(B)) / 2;
    const reach = (x) => { const s = x.scale, dy = THREE.MathUtils.clamp((hy - (FLOOR + 0.37 * s + 0.31 * s)) / (0.232 * s), -0.98, 0.98); return 0.232 * s * Math.sin(Math.acos(-dy)); };
    for (const x of [A, B]) { x.scripted = true; x.lookAt = null; }
    this.world.standAt(A, c.x - reach(A) - 0.115, c.z, Math.PI / 2);
    this.world.standAt(B, c.x + reach(B) + 0.115, c.z, -Math.PI / 2);
    const at = V(c.x, hy, c.z);
    A.hold = { at }; B.hold = { at };
    A.play('hold'); B.play('hold');
    A.lookAt = B.headPoint(); B.lookAt = A.headPoint();
    const bigTo = Math.random() < 0.5 ? A : B;
    this.o.wishbone.hold(A, B, bigTo);
    this._wish.winner = bigTo;
    for (const x of this.crowd.actors) if (x !== A && x !== B && !x.away) x.lookAt = at;
    return { eyebrow: 'A Thanksgiving tradition', title: 'Pull the wishbone', body: `<p>${me ? 'You' : esc(A.name)} and <b>${esc(B.name)}</b> each hold an end. Whoever gets the bigger piece gets their wish! <small>Press and hold to pull.</small></p>`, actions: [
      { label: 'Hold to pull', icon: '🦴', primary: true, id: 'btn-pull', hold: (down) => this._pull(down) },
    ] };
  }
  _pull(down) {
    const w = this._wish; if (!w || w.done) return;
    w.down = down;
    if (down) { w.A.play('pull'); w.B.play('pull'); this.audio.creakBone(true); this.ui.pullMeter(this.o.wishbone.tension); }
    else { this.audio.creakBone(false); w.A.play('hold'); w.B.play('hold'); }
  }
  /** While it's held, the tension builds (about a second and a half of pulling). */
  _pullTick(dt) {
    const w = this._wish; if (!w || w.done || !w.down) return;
    const wb = this.o.wishbone;
    wb.tension = Math.min(1, wb.tension + dt * (0.6 + Math.random() * 0.25));
    this.ui.pullMeter(wb.tension);
    if (wb.tension >= 1) this._snap();
  }
  _snap() {
    const w = this._wish; w.done = true;
    this.ui.pullMeter(null);
    this.audio.creakBone(false);
    this.audio.snap();
    this.o.wishbone.snap();
    this.shake = 0.03;
    const me = this.roster.me ? this.world.actors.get(this.roster.me.id) : null;
    const youWon = w.winner === w.A;
    const pos = this.o.wishbone.centre;
    for (const x of [w.A, w.B]) x.hold = null;
    w.winner.play('cheer'); (w.winner === w.A ? w.B : w.A).play('shrug');
    for (const x of this.crowd.actors) if (x !== w.A && x !== w.B && !x.away && Math.random() < 0.5) { x.scripted = true; x.play(Math.random() < 0.5 ? 'clap' : 'cheer'); setTimeout(() => { x.scripted = false; x.play('idle'); }, 1600 + Math.random() * 800); }
    setTimeout(() => {
      if (this.current?.id !== 'wishbone') return;
      this.o.confetti.burst(pos.clone().add(V(0, 0.2, 0)), { palette: 'gold', floor: FLOOR, spread: 0.9 });
      this.audio.tada();
      if (youWon) this.ui.banner(me ? 'Your wish is granted!' : `${w.A.name} gets the wish!`, me ? 'Make it a good one ✨' : '✨');
      else this.ui.banner(`${w.B.name} gets the wish!`, me ? 'You got the little piece — next year! 🦴' : '');
    }, 250);
    setTimeout(() => {
      if (this.current?.id !== 'wishbone') return;
      this.ui.showCard({ eyebrow: '', title: youWon ? (me ? 'You won the wish!' : `${esc(w.A.name)} won the wish!`) : `${esc(w.B.name)} won the wish!`, body: '', actions: [
        { label: 'Another pair', icon: '🦴', onClick: () => { this._wishLeave(); this.refreshCard(); } },
        { label: 'On to the game', icon: '🏈', primary: true, onClick: () => this.next() },
      ] }, { reveal: true });
    }, 1800);
  }
  _wishLeave() {
    const w = this._wish;
    if (w) { w.down = false; for (const x of [w.A, w.B]) { x.hold = null; x.scripted = false; x.lookAt = null; x.play('idle'); this.world.sit(x); } }
    for (const x of this.crowd.actors) if (!x.away) x.lookAt = null;
    this._wish = null;
    this.o.wishbone.hide();
    this.ui.pullMeter(null);
    this.audio.creakBone(false);
  }

  // ── game day: everyone round the TV ────────────────
  /** Straight at the screen, close enough to watch. */
  _tvClose(portrait) {
    const tv = this.o.tv, at = tv.focusPoint;
    return portrait ? front(at, V(0, 0, 1), 1.55, 0.02, 40, { portraitFov: 42 }) : front(at, V(0, 0, 1), 1.12, 0.03, 38);
  }
  /** Pulled back: the set, and the family crowded round it. */
  _tvWide(portrait) {
    const L = this.lay.living;
    // up behind everyone, looking over their heads at the set (the screen clear above them)
    return portrait
      ? { pos: V(0.55, FLOOR + 3.0, L.sofa + 2.7), target: V(0, FLOOR + 0.65, L.tv + 0.5), fov: 50, portraitFov: 70, mobileOffset: V(0, 0.55, 0) }
      : { pos: V(1.25, FLOOR + 2.7, L.sofa + 2.5), target: V(-0.1, FLOOR + 0.75, L.tv + 0.45), fov: 50, frameX: -0.1 };
  }
  _tvEnter() {
    const tv = this.o.tv; tv.active = true;
    if (!this._tvChannel) this._tvChannel = 'parade';
    tv.setChannel(this._tvChannel);
    this.audio.tv(this._tvChannel);
    this._gather();
    this._tvWideNow = false;
    return this._tvCard();
  }
  _tvArrive() {
    // a few seconds on the screen itself, then back to see everyone watching
    clearTimeout(this._tvT);
    this.ui.holdCard();
    this._tvT = setTimeout(() => this._toWide(), 3600);
  }
  async _toWide() {
    if (this.current?.id !== 'gameday') return;
    this._arriveNow();
    this._tvWideNow = true;
    const token = (this._tvMove = (this._tvMove || 0) + 1);
    await this.director.moveTo(this._tvWide(portraitScreen()), 2.4);
    if (this.current?.id !== 'gameday' || token !== this._tvMove) return;   // (the channel changed on the way: back to the screen instead)
    this.ui.showCard(this._tvCard(), { reveal: true });
  }
  /** Everyone gets up from the table and walks over to watch (the first few get the sofa). */
  _gather() {
    const L = this.lay, liv = L.living, w = this.world;
    const people = shuffle([...w.actors.values()].filter((a) => a.visible && a.home));
    const kids = people.filter((a) => a.kid), adults = people.filter((a) => !a.kid);
    const spots = [];
    const sofa = this.o.sofaSeats;
    for (let i = 0; i < Math.min(3, adults.length); i++) spots.push({ a: adults[i], sofa: sofa[i] });
    const kidSpots = [[-0.95, liv.coffee - 0.1], [0.95, liv.coffee - 0.1], [-1.5, liv.coffee + 0.3], [1.5, liv.coffee + 0.3], [-1.95, liv.coffee + 0.7], [1.95, liv.coffee + 0.7]];
    const sideSpots = [[-1.55, liv.sofa - 0.05], [1.55, liv.sofa - 0.05], [-2.05, liv.sofa - 0.25], [2.05, liv.sofa - 0.25], [-2.55, liv.sofa - 0.45], [2.55, liv.sofa - 0.45]];
    const rows = [];
    for (let r = 0; r < 8; r++) { const z = liv.sofa + 0.62 + r * 0.55; if (z > L.zEnd - 0.25) break; for (const x of [0, -0.52, 0.52, -1.04, 1.04, -1.56, 1.56, -2.08, 2.08, -2.6, 2.6]) rows.push([x + (r % 2 ? 0.26 : 0), z]); }
    const free = [...kidSpots.map((p) => ({ p, kid: true })), ...sideSpots.map((p) => ({ p })), ...rows.map((p) => ({ p }))];
    const take = (kid) => { const i = free.findIndex((f) => (kid ? true : !f.kid)); return i >= 0 ? free.splice(i, 1)[0].p : null; };
    for (const a of kids) { const p = take(true); if (p) spots.push({ a, p }); }
    for (const a of adults.slice(3)) { const p = take(false); if (p) spots.push({ a, p }); }
    const tvAt = this.o.tv.focusPoint;
    this._watchers = [];
    for (const s of spots) {
      const a = s.a; a.scripted = true; a.lookAt = null; a.hold = null;
      const startDelay = Math.random() * 0.9;
      const go = () => {
        if (this.current?.id !== 'gameday') return;
        const y = FLOOR + 0.37 * a.scale;
        const stand = w.besideChair(a);
        a.away = true; a.pos.copy(stand);
        const aisle = V(stand.x, y, L.zEnd - 0.35);
        const dest = s.sofa ? s.sofa.clone().add(V(0, 0, 0.55)).setY(y) : V(s.p[0], y, s.p[1]);
        const yaw = Math.atan2(tvAt.x - dest.x, tvAt.z - dest.z);
        a.walk([aisle, dest], { speed: 1.35, yaw, done: () => {
          if (s.sofa) { a.setPose('sit'); a.pos.copy(s.sofa).add(V(0, a.kid ? 0 : 0.04, 0)); a.yaw = Math.PI; }
          a.lookAt = tvAt; a.play('idle');
        } });
      };
      setTimeout(go, startDelay * 1000);
      this._watchers.push({ a, ...s });
    }
  }
  /** Anyone still on the way when the camera turns round is (almost) there. */
  _arriveNow() {
    for (const s of this._watchers || []) {
      const a = s.a;
      if (!a.path?.length) continue;
      const dest = a.path.at(-1);
      a.path = [dest];
      const back = V(a.pos.x - dest.x, 0, a.pos.z - dest.z);
      if (back.length() > 1.0) a.pos.set(dest.x, dest.y, dest.z).addScaledVector(back.normalize(), 1.0);
    }
  }
  _tvCard() {
    const p = this._tvChannel === 'parade';
    const body = p
      ? `<p><b>${this.k('parade.when')}</b></p><p>${this.k('parade.note')}</p>`
      : `<p><b>${this.k('football.games')}</b></p><p>${this.k('football.note')}</p>`;
    return { eyebrow: p ? 'Thanksgiving morning' : 'Thanksgiving afternoon', title: p ? this.k('parade.title') : this.k('football.title'), body, actions: [
      p ? { label: 'Switch to football', icon: '🏈', primary: true, onClick: () => this.channel('football') } : { label: 'Back to the parade', icon: '🎈', onClick: () => this.channel('parade') },
      ...(p ? [] : [{ label: 'Kick a field goal', icon: '🏈', primary: true, onClick: () => this.fieldGoal() }]),
    ] };
  }
  async channel(ch) {
    this._tvChannel = ch;
    this.o.tv.setChannel(ch);
    this.audio.click(); this.audio.tv(ch);
    // in close for a look at the new channel, then back
    this.ui.holdCard();
    clearTimeout(this._tvT);
    this._tvWideNow = false;
    const token = (this._tvMove = (this._tvMove || 0) + 1);
    await this.director.moveTo(this._tvClose(portraitScreen()), 1.4);
    if (this.current?.id !== 'gameday' || token !== this._tvMove) return;
    this._tvT = setTimeout(() => this._toWide(), 3000);
  }
  fieldGoal() {
    const tv = this.o.tv;
    this.audio.kick();
    tv.flash("IT'S GOOD!", 2.2);
    setTimeout(() => { this.audio.cheer(); for (const s of this._watchers || []) { const a = s.a; a.play('cheer'); setTimeout(() => a.play('idle'), 1800 + Math.random() * 900); } }, 500);
  }
  _tvLeave(next) {
    clearTimeout(this._tvT);
    this.o.tv.active = false;
    this.audio.tv(null);
    this._watchers = null;
    if (next?.id !== 'photo') this.world.sitAll();
  }

  // ── the family photo, out front on the porch steps ──
  /** Where everyone stands: grown-ups up the steps and along the porch rail, children in front on the lawn. */
  /**
   * Like a real family photo, where every face shows (measured: a face is hidden unless the row behind stands a
   * whole head higher): a few grown-ups up on the top step (45 cm up — clear over the heads in front), the rest
   * in one wide row on the lawn just below the steps, the children in front of them. Nobody stands on the porch
   * behind the rail (it comes up to their chins). Each row is centred, and each stands in the gaps of the row
   * behind it, so even a tall hat in front never hides a face. Tall hats (a pilgrim's, a chef's, the turkey) go
   * up on the step first, and in a row they take the ends.
   */
  _photoSpots() {
    const people = [...this.world.actors.values()].filter((a) => a.home);
    const kids = shuffle(people.filter((a) => a.kid)), adults = shuffle(people.filter((a) => !a.kid)).sort((p, q) => tallHat(q) - tallHat(p));
    const centred = (n, step) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * step);
    const A = adults.length;
    const top = A >= 5 ? Math.min(4, Math.max(2, Math.round(A / 3))) : 0;   // (the top step is 2 m wide: four at most)
    const spots = [];
    let i = 0;
    for (const x of centred(top, 0.5)) spots.push({ a: adults[i++], x, y: FLOOR, z: 2.8 });   // (the tall hats first)
    // the lawn: one row (up to 17); a bigger family in rows a little apart, each face in the gap between two in front
    const R = A - top, m = R > 17 ? Math.ceil(R / 19) : 1, gap = m > 1 ? 0.82 : 0.5;
    // (a row's places sit at whole gaps, or half gaps; each row is half a gap off the one behind, as the camera
    // sees it: rows nearer the camera draw in toward the middle, so the gaps stay lined up out to the ends)
    const camZ = 3.8 + Math.max(4.6, (Math.ceil(R / m) * gap / 2 + 0.4) / 0.62);
    let z = 3.8, phase = top && m === 1 ? (top % 2 ? 0 : 0.5) : null;   // (the step's places are 0.5 apart too)
    const row = (who, z) => {
      const n = who.length, natural = n % 2 ? 0 : 0.5, want = phase == null ? natural : (phase + 0.5) % 1, k = (camZ - z) / (camZ - 3.8);
      phase = want;
      for (const p of byHats(who, centred(n, gap))) spots.push({ a: p.a, x: (p.x + (want - natural) * gap) * k, y: 0, z });
    };
    for (let j = 0, left = R; j < m; j++, z += 0.65) { const n = Math.ceil(left / (m - j)); left -= n; row(adults.slice(i, i += n), z); }
    // the children in front, row by row toward the camera
    for (const rest = [...kids]; rest.length; z += 0.55) row(rest.splice(0, 11), z - 0.05);
    return spots;
  }
  /** Everyone steps outside and finds their place (while the camera goes out through the front door). */
  _goOutside() {
    this.world.life.setMode('off');
    const spots = this._photoSpots();
    this._photoGroup = spots;
    const box = new THREE.Box3();
    for (const s of spots) {
      const a = s.a;
      a.scripted = true; a.hold = null; a.path = null;
      this.world.standAt(a, s.x + (Math.random() - 0.5) * 0.06, s.z + (Math.random() - 0.5) * 0.08, 0, s.y);
      a.yaw = (Math.random() - 0.5) * 0.25 - s.x * 0.03;
      a.lookAt = null; a.play('idle');
      box.expandByPoint(V(s.x, s.y, s.z)); box.expandByPoint(V(s.x, s.y + 1.25 * a.scale + 0.2, s.z));
    }
    if (!spots.length) box.set(V(-1, 0, 2.5), V(1, 1.8, 4));
    // the pumpkins and mums on the lawn make room where people stand (back when everyone goes in)
    for (const p of this.world.house.o.lawnDecor || []) p.visible = !spots.some((s) => Math.hypot(s.x - p.position.x, s.z - p.position.z) < 0.75);
    // the camera (on its tripod, out on the lawn) frames the whole group
    const c = box.getCenter(V(0, 0, 0)), size = box.getSize(V(0, 0, 0));
    const portrait = portraitScreen(), fov = portrait ? 57 : 50, aspect = portrait ? 3 / 4 : 4 / 3;
    const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2)), tanH = tanV * aspect;
    // (snug round the group, as a photographer would frame it: the faces big, everybody in)
    const d = Math.max(3.6, (size.x / 2 + 0.4) / tanH + size.z / 2, (size.y / 2 + 0.22) / tanV + size.z / 2);
    const z = box.max.z + d - size.z / 2, look = V(0, c.y + 0.05, c.z);
    this.o.tripod.place(0, 0, z, Math.atan2(look.x, look.z - z));
    this.o.tripod.root.scale.set(1, 1.18, 1); this.o.tripod.root.updateMatrixWorld(true);   // (legs out tall: the back rows show over the front ones)
    const eye = this.o.tripod.lensPoint;   // (the photo is taken from the lens itself)
    this._photoAim = { eye, look, fov };
  }
  _comeInside() {
    this._photoGroup = null;
    for (const p of this.world.house.o.lawnDecor || []) p.visible = true;
    this.world.sitAll();
  }
  _photoShot(portrait) {
    const A = this._photoAim; if (!A) return { pos: V(0, 2.2, 12), target: V(0, 1.2, 3), fov: 50 };
    const back = A.eye.clone().sub(A.look).setY(0).normalize();
    return portrait
      ? { pos: A.eye.clone().addScaledVector(back, 2.4).add(V(0.25, 0.75, 0)), target: A.look.clone().add(V(0, 0.4, 0)), fov: 50, portraitFov: 66, mobileOffset: V(0, -0.2, 0) }
      : { pos: A.eye.clone().addScaledVector(back, 2.2).add(V(0.6, 0.65, 0)), target: A.look.clone().add(V(0, 0.25, 0)), fov: 50 };
  }
  /** Where the family photo is taken from: the tripod's lens. */
  _photoEye() { return this._photoAim || { eye: V(0, 1.45, 9), look: V(0, 1.0, 3.3), fov: 50 }; }

  startFinale() {
    const o = this.o;
    o.tripod.show(true);
    const { eye } = this._photoEye();
    for (const s of this._photoGroup || []) { s.a.lookAt = eye.clone().add(V((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3, 0)); s.a.play(Math.random() < 0.3 ? 'wave' : 'idle'); }
    this.audio.music('finale');
    this.ui.showFinale({ onAgain: () => this.restart(), onCapture: () => this.takePhoto() });
  }
  endFinale() {
    this.ui.hideFinale();
    this._cancelCapture();
    this.o.tripod.show(false);
  }

  /** Everyone faces the camera; you frame it; 3, 2, 1 — flash — and the picture develops. */
  async takePhoto() {
    if (this._capturing || this.current?.id !== 'photo') return;
    const o = this.o, d = this.director, ui = this.ui;
    const token = (this._capToken = (this._capToken || 0) + 1);
    const alive = () => token === this._capToken && this.current?.id === 'photo';
    this._capturing = true;
    ui.hideFinale(); ui.hideCard();
    const { eye, look, fov } = this._photoEye(), lens = o.tripod.lensPoint;
    this.audio.click();
    await d.moveTo({ pos: eye, target: look, fov }, 1.6);
    if (!alive()) return;
    o.tripod.show(false);   // (we're looking through it)
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, look, V(0, 1, 0)));
    const pose = { pos: eye, quat };
    this.viewfinder = { fov: d.camera.fov, pose: () => pose };
    // a real family photo: everyone looks at the camera, each in their own way
    const poses = ['idle', 'pose', 'hug', 'hips', 'idle', 'cheer', 'idle'];
    for (const s of this._photoGroup || []) {
      const a = s.a;
      a.lookAt = eye.clone().add(V((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.15, 0));
      a.play(a.kid ? (Math.random() < 0.5 ? 'cheer' : 'pose') : poses[Math.floor(Math.random() * poses.length)]);
      a.cur.hr = (Math.random() - 0.5) * 0.25;
    }
    await new Promise((resolve) => {
      ui.showViewfinder(resolve);
      // the screen sees wider than the photo, so that the frame (the photo's shape) holds exactly what the photo will
      const wide = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) / ui.viewfinderFill()));
      gsap.to(this.viewfinder, { fov: wide, duration: 0.7, ease: 'power2.out' });
    });
    if (!alive()) return;
    for (const n of [3, 2, 1]) { ui.countdown(n); this.audio.beep(n); await wait(0.85); if (!alive()) return; }
    this.audio.shutter(); ui.flash(); ui.viewfinderShot();
    const coarse = matchMedia('(pointer: coarse)').matches;
    const size = portraitScreen() ? { w: coarse ? 960 : 1080, h: coarse ? 1280 : 1440 } : { w: coarse ? 1280 : 1600, h: coarse ? 960 : 1200 };
    const shot = await this.capture(pose, fov, size);
    this.viewfinder = null; ui.hideViewfinder();
    o.tripod.show(true);
    for (const s of this._photoGroup || []) { s.a.play('cheer'); setTimeout(() => s.a.play('idle'), 1500 + Math.random() * 1000); }
    if (!alive()) return;
    this._photo = shot;
    this._storyFile = null;
    drawStoryImage({ photo: shot, content: this.content, people: this.world.seated.length, base: import.meta.env.BASE_URL })
      .then((cv) => canvasToFile(cv, `thanksgiving-${Date.now()}.png`))
      .then((file) => { if (token === this._capToken) this._storyFile = file; })
      .catch((err) => console.warn('story image failed', err));
    await d.moveTo(this._shot(this.current), 1.4);
    if (!alive()) return;
    o.confetti.burst(look.clone().add(V(0, 1.2, 1.0)), { palette: 'gold', floor: 0, spread: 1.6 });
    this.audio.tada();
    o.polaroid.group.position.copy(lens); o.polaroid.group.quaternion.copy(this.director.camera.quaternion);   // it comes out of the camera
    o.polaroid.show(shot, this.content);
    document.body.classList.add('reading');   // the brand mark steps aside for the picture
    this.presenter.present(o.polaroid.group, { width: o.polaroid.size.w, height: o.polaroid.size.h, fillH: 0.74, fillHPortrait: 0.42, x: -0.14, y: 0.02, yPortrait: 0.16 }, { duration: 1.3 });
    this._capLabel = () => ({ at: o.polaroid.group.getWorldPosition(V(0, 0, 0)), r: o.polaroid.size.h * 0.56, place: 'side', placePortrait: 'below' });
    await wait(1.5);
    if (!alive()) return;
    ui.showCard({ eyebrow: '', title: 'The whole family', body: '<p class="hand">Happy Thanksgiving, everyone 🧡</p>', actions: [
      { label: 'Save the picture', icon: '⬇', primary: true, onClick: () => this.savePhoto() },
      { label: 'Retake', onClick: () => this.retake() },
      { label: '↻ Start over', onClick: () => this.restart() },
    ] }, { reveal: true });
  }
  async savePhoto() {
    if (!this._photo) return;
    let file = this._storyFile;
    if (!file) {
      this.ui.toast('Getting the picture ready…');
      const cv = await drawStoryImage({ photo: this._photo, content: this.content, people: this.world.seated.length, base: import.meta.env.BASE_URL });
      file = await canvasToFile(cv, `thanksgiving-${Date.now()}.png`);
      this._storyFile = file;
    }
    const r = await shareOrDownload(file, { title: `Happy Thanksgiving from ${this.content.family}` });
    if (r === 'downloaded') this.ui.toast('Saved 🧡');
  }
  async retake() { this._cancelCapture(); await this.director.moveTo(this._shot(this.current), 1.2); if (this.current?.id === 'photo') this.takePhoto(); }
  _cancelCapture() {
    this._capToken = (this._capToken || 0) + 1;
    this._capturing = false;
    this._capLabel = null;
    if (this.viewfinder) { this.viewfinder = null; this.ui.hideViewfinder(); if (this.current?.id === 'photo') this.o.tripod.show(true); }
    this.presenter.release(this.o.polaroid.group);
    this.o.polaroid.hide();
    document.body.classList.remove('reading');
  }
  restart() {
    this.endFinale();
    this.ui.hideCard();
    this._tvChannel = 'parade';
    this.goTo(0);
  }

  update(dt) { this.shake *= Math.exp(-dt * 10); this._pullTick(dt); }

  // ── navigation ─────────────────────────────────────
  get current() { return this.chapters[this.index]; }
  next() { if (this.index < this.chapters.length - 1) this.goTo(this.index + 1); }
  prev() { if (this.index > 0) this.goTo(this.index - 1); }

  goTo(i) {
    if (i === this.index) return;
    const prev = this.current;
    prev?.leave?.(this.chapters[i]);
    this.ui.closeSheets();
    this.ui.hint(null);
    this.dress.close();
    this._clearBubble();
    this.index = i;
    const ch = this.current;
    this.ui.updateNav(i);
    this.openDoor();
    this.world.life.setMode(ch.life || 'off');
    const card = ch.enter();
    if (card) this.ui.showCard(card); else this.ui.hideCard();
    const token = (this._token = (this._token || 0) + 1);
    document.body.classList.add('moving');
    // the very first step: the front door swings open and you walk in
    const firstIn = prev === undefined && this._walkIn !== false;
    this._walkIn = false;
    const shot = this._shot(ch);
    const inside = (p) => p.z < 0;
    // moving between the yard and the house always goes through the front door
    const via = shot.via || (prev && inside(this.director.camera.position) !== inside(shot.pos) ? V(0, 1.95, -0.4) : null);
    const reveal = (after) => { if (card && ch.id !== 'gameday') setTimeout(() => { if (token === this._token) this.ui.revealCard(); }, after * 1000); };
    let move;
    if (firstIn) {
      move = this.director.moveTo({ pos: V(0, 1.85, 4.2), target: V(0, 1.7, -2), fov: 50, portraitFov: portraitScreen() ? 66 : undefined }, 2.4).then(() => {
        if (token !== this._token) return;
        const m2 = this.director.moveTo({ ...shot, via: V(0, 1.95, -0.6) }, 2.6);   // in through the doorway
        reveal(m2.duration * 0.7);
        return m2;
      });
    } else {
      move = this.director.moveTo(via ? { ...shot, via } : shot, ch.duration || 2.6);
      reveal(move.duration * 0.62);   // the words come up as the camera settles, not after
    }
    move.then(() => {
      if (token !== this._token) return;
      document.body.classList.remove('moving');
      ch.arrive?.();
      if (card && ch.id !== 'gameday') this.ui.revealCard();
      if (ch.id === 'you' && this._youStep === 'answer' && !this.roster.me?.look && !this._autoDressed) { this._autoDressed = true; this.startDressing(); }
    });
  }

  startIntro() { this.director.cut(this.intro.shot); }

  /** Clicks inside the chapter text (names, answers, dishes, the person switcher). */
  onCardClick(e) {
    const b = e.target.closest('button'); if (!b) return false;
    if (b.dataset.claim) { this.claim(b.dataset.claim); return true; }
    if (b.dataset.rsvp) { this.answer(b.dataset.rsvp); return true; }
    if (b.dataset.dish) { this.pickDish(b.dataset.dish); return true; }
    if (b.dataset.who) { this.switchWho(b.dataset.who); return true; }
    return false;
  }
}

export { HALF_W };
