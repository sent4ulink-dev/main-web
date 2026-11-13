import { defaultLook, defaultParty } from '../share/guests-core.js';

// The guest list as this page sees it, and every change to it (through the server): the host's list and
// settings; on a guest's phone, the names this phone holds ("mine"), their characters, answers, thankful
// lines and potluck dishes. Listeners hear 'change' whenever something moved.

export class Roster extends EventTarget {
  constructor(repo) {
    super();
    this.repo = repo;
    this.role = repo.role;              // 'host' | 'guest'
    this.guests = [];
    this.party = defaultParty();
    this.mine = [];                     // guest ids this phone holds
    this.active = null;                 // the one being dressed / answered for
    this.open = true;
    this.guestLink = null;
  }

  load(d) {
    this.guests = (d.guests || []).map((g) => ({ ...g, look: g.look || null }));
    this.party = d.party || defaultParty();
    this.open = d.guestsOpen ?? d.open ?? true;
    this.guestLink = d.guestLink || null;
    this.photos = d.photos || [];       // the family photos on the wall: a version per slot (or null)
    this.mine = (d.mine || []).filter((id) => this.byId(id));
    if (!this.active || !this.mine.includes(this.active)) this.active = this.mine[0] || null;
    this._emit();
  }

  byId(id) { return this.guests.find((g) => g.id === id) || null; }
  lookOf(g) { return g.look || defaultLook(g); }
  get me() { return this.active ? this.byId(this.active) : null; }
  get isHost() { return this.role === 'host'; }
  /** The answers others may see (the host always sees them). */
  get answersShown() { return this.isHost || this.party.showAnswers !== false; }
  get counts() {
    const c = { invited: this.guests.length, yes: 0, no: 0, waiting: 0, joined: 0 };
    for (const g of this.guests) { if (g.rsvp === 'yes') c.yes++; else if (g.rsvp === 'no') c.no++; else c.waiting++; if (g.claimed) c.joined++; }
    return c;
  }
  /** Who is bringing a dish (by dish name, lower case). */
  get dishTakers() { const m = new Map(); for (const g of this.guests) if (g.dish) m.set(g.dish.toLowerCase(), g); return m; }

  _emit(detail = {}) { this.dispatchEvent(new CustomEvent('change', { detail })); }
  _merge(g) {
    const i = this.guests.findIndex((x) => x.id === g.id);
    if (i >= 0) this.guests[i] = { ...this.guests[i], ...g };
    return this.guests[i];
  }

  // ── a guest's phone ──
  async claim(id) {
    const d = await this.repo.claim(id);
    this._merge({ ...d.guest, claimed: true });
    if (!this.mine.includes(id)) this.mine.push(id);
    this.active = id;
    this._emit({ claimed: id });
    return d;
  }
  /** Save changes to someone this page may change (a guest: their own people; the host: anyone). */
  async update(id, changes) {
    const d = this.isHost ? await this.repo.hostGuest(id, changes) : await this.repo.saveMe(id, changes);
    const g = this._merge(d.guest);
    this._emit({ updated: id, changes });
    return g;
  }

  // ── the host ──
  async saveList(roster, party) {
    const d = await this.repo.saveGuests(roster, party);
    this.guests = d.guests; this.party = d.party;
    this._emit({ list: true });
    return d;
  }
  async makeGuestLink() {
    const d = await this.repo.createGuestLink();
    this.guestLink = d.guestLink;
    this._emit({ link: true });
    return d.guestLink;
  }

  /** Fetch the list again (to see who else has joined since). */
  async refresh() {
    try { const d = await this.repo.load(); this.load(d); return true; } catch { return false; }
  }
}
