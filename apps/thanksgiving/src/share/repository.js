// URL modes and where a card lives (the sent4u cards' design, plus a guest link):
//   /                        → the private studio: password, the draft's wording and guest list, Make link
//   /?share=test             → a local demonstration as the host (this browser only), with Reset (also
//                              /?share=test-thanksgiving, the demo link on sent4u.link)
//   /?share=test&as=guest    → the same demonstration as a guest
//   /?share=<id>             → a host link: its holder edits the wording for five days, and runs the guest list
//   /?guest=<gid>            → the guest link the whole family shares
// The demonstration runs the card's real server code (server/api.js) right here, on a bucket kept in
// localStorage, so it behaves exactly like a real link.
import { createApi } from '../../server/api.js';
import { cleanContent } from './content-core.js';
import { defaultParty, defaultLook } from './guests-core.js';
import { demoRoster } from './demo.js';

export const DEMO_PREFIX = 'thanksgiving:demo:v1:';
export const DEMO_ID = 'THANKSGIVINGtestcardTHANKSGIVING';
// The demo's own address: sent4u.link knows the demo by this id (a plain ?share=test there opens the homepage), and so does this card.
export const DEMO_SHARE = 'test-thanksgiving';
export const validShareID = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(id);   // (sent4u's link ids)
export function selectMode(search) {
  const p = new URLSearchParams(search);
  if (p.has('guest')) { const g = p.getAll('guest'); return g.length === 1 && validShareID(g[0]) ? { kind: 'guest', gid: g[0] } : { kind: 'unavailable' }; }
  if (!p.has('share')) return { kind: 'studio' };
  const all = p.getAll('share');
  if (all.length !== 1) return { kind: 'unavailable' };
  const id = all[0];
  if (id === 'test' || id === 'test-thanksgiving') return { kind: 'test', asGuest: p.get('as') === 'guest' };
  return validShareID(id) ? { kind: 'invitation', id } : { kind: 'unavailable' };
}
export class RequestError extends Error { constructor(message, status = 0, data = {}) { super(message); this.status = status; this.data = data; } }

/** Just enough of an R2 bucket on localStorage (the demonstration's own little server). Pictures are kept
 *  as base64 text ("b64:<type>|<data>"). */
const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
function browserBucket(storage, prefix) {
  const enc = new TextEncoder();
  const obj = (key, raw) => {
    if (raw.startsWith('b64:')) {
      const bar = raw.indexOf('|'), bytes = fromB64(raw.slice(bar + 1));
      return { key, httpMetadata: { contentType: raw.slice(4, bar) }, arrayBuffer: async () => bytes.buffer, body: bytes };
    }
    return { key, etag: String(raw.length) + ':' + raw.slice(-12), text: async () => raw, json: async () => JSON.parse(raw), arrayBuffer: async () => enc.encode(raw).buffer, body: raw };
  };
  return {
    async get(key) { const raw = storage().getItem(prefix + key); return raw == null ? null : obj(key, raw); },
    async head(key) { const raw = storage().getItem(prefix + key); return raw == null ? null : { key }; },
    async put(key, value, opts = {}) {
      const bin = value instanceof ArrayBuffer ? new Uint8Array(value) : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : null;
      storage().setItem(prefix + key, bin ? `b64:${opts.httpMetadata?.contentType || 'image/jpeg'}|${toB64(bin)}` : typeof value === 'string' ? value : JSON.stringify(value));
      return { etag: String(Date.now()) };
    },
    async delete(keys) { for (const k of [].concat(keys)) storage().removeItem(prefix + k); },
    async list({ prefix: p = '' } = {}) {
      const s = storage(), keys = [];
      for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k?.startsWith(prefix + p)) keys.push(k.slice(prefix.length)); }
      return { objects: keys.sort().map((key) => ({ key })), truncated: false };
    },
  };
}

export class ModeRepository {
  constructor(mode, { fetcher = (...a) => fetch(...a), storage = () => localStorage } = {}) {
    Object.assign(this, { mode, fetcher, storage });
    this.token = null;
    this.role = mode.kind === 'guest' || (mode.kind === 'test' && mode.asGuest) ? 'guest' : 'host';
    if (mode.kind === 'test') {
      this._api = createApi();
      this._env = { SHARES: browserBucket(storage, DEMO_PREFIX), CORS_ORIGIN: '*', PUBLIC_ORIGIN: location.origin };
    }
  }
  clearAccess() { this.token = null; }

  async request(path, { method = 'GET', body, patient = false, headers = {} } = {}) {
    const started = Date.now(), PATIENCE = 60000;
    const init = { method, cache: 'no-store', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) };
    for (let attempt = 0; ; attempt++) {
      // each try has a time limit that covers the whole answer, not just its first bytes: an answer that stops halfway (it happens
      // on phone networks) counts as failed and is asked for again, quickly
      const stop = new AbortController(), timer = patient ? setTimeout(() => stop.abort(), 8000 + attempt * 4000) : 0;
      let response, text;
      try {
        const req = { ...init, signal: stop.signal };
        response = this._api ? await this._api.fetch(new Request(new URL(path, location.origin), req), this._env) : await this.fetcher(path, req);
        text = await response.text();
      } catch {
        clearTimeout(timer);
        if (!patient || Date.now() - started > PATIENCE) throw new RequestError('Connection problem. Check your internet and try again.');
        this.onRetry?.(attempt + 1);
        await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** attempt, 4000)));
        continue;
      }
      clearTimeout(timer);
      if (patient && (response.status >= 500 || response.status === 408 || response.status === 429) && Date.now() - started <= PATIENCE) {
        this.onRetry?.(attempt + 1);
        await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** attempt, 4000)));
        continue;
      }
      let data; try { data = JSON.parse(text); } catch { throw new RequestError('Could not read the server’s answer.', response.status); }
      if (!response.ok) throw new RequestError(data.error || 'Could not load.', response.status, data);
      // the demo runs this card's own server code in the browser, so its guest link would be a real ?guest= address that only this
      // browser knows (anyone else: "link not found"): in the demo it is the demo's own guest view instead
      if (this.mode.kind === 'test' && typeof data?.guestLink === 'string') return { ...data, guestLink: this.demoGuestURL };
      return data;
    }
  }
  get demoGuestURL() { return `${location.origin}${location.pathname}?share=${DEMO_SHARE}&as=guest`; }
  async login(password) { const d = await this.request('/api/studio/login', { method: 'POST', body: { password } }); this.token = d.token; }

  // where the host's things live, per mode
  get _hostBase() { const k = this.mode.kind; return k === 'studio' ? null : `/api/invitations/${k === 'test' ? DEMO_ID : this.mode.id}`; }
  get guestLinkID() { return this.mode.kind === 'guest' ? this.mode.gid : this._demoGid; }

  async load() {
    const kind = this.mode.kind;
    if (kind === 'test') {
      await this._ensureDemo();
      if (this.role === 'guest') return this._loadGuest();
      return this.request(this._hostBase);
    }
    if (kind === 'studio') return this.request('/api/studio/draft', { patient: true });
    if (kind === 'invitation') return this.request(this._hostBase, { patient: true });
    if (kind === 'guest') return this._loadGuest(true);
    throw new RequestError('This link was not found.', 404);
  }
  async _loadGuest(patient = false) {
    const claims = this.claims();
    const d = await this.request(`/api/guests/${this.guestLinkID}`, { patient, headers: claims.length ? { 'X-Guest-Claims': claims.map((c) => `${c.id}.${c.key}`).join(',') } : {} });
    // forget names this phone no longer holds (the host freed them)
    const mine = new Set(d.mine);
    if (claims.some((c) => !mine.has(c.id))) this._setClaims(claims.filter((c) => mine.has(c.id)));
    return { ...d, canEdit: false, finished: false, revision: 0 };
  }

  async save(content, revision, finish = false) {
    content = cleanContent(content);
    const kind = this.mode.kind;
    if (kind === 'studio') return this.request('/api/studio/draft', { method: 'PUT', body: { content, revision } });
    if (this.role === 'host' && this._hostBase) return this.request(`${this._hostBase}${finish ? '/finish' : ''}`, { method: finish ? 'POST' : 'PUT', body: { content, revision } });
    throw new RequestError('Not allowed here.', 403);
  }

  // ── the host: the guest list ──
  saveGuests(roster, party) { return this.request(this.mode.kind === 'studio' ? '/api/studio/guests' : `${this._hostBase}/guests`, { method: 'PUT', body: { roster, party } }); }
  hostGuest(id, changes) { return this.request(this.mode.kind === 'studio' ? `/api/studio/guest/${id}` : `${this._hostBase}/guest/${id}`, { method: 'PUT', body: changes }); }
  async createGuestLink() {
    const d = await this.request(`${this._hostBase}/guestlink`, { method: 'POST' });
    if (this.mode.kind === 'test') return { guestLink: this.demoGuestURL };
    return d;
  }

  // ── a guest: names this phone holds ──
  _claimKey() { return `thanksgiving:claims:${this.guestLinkID}`; }
  claims() { try { const v = JSON.parse(this.storage().getItem(this._claimKey()) || '[]'); return Array.isArray(v) ? v.filter((c) => c && typeof c.id === 'string' && typeof c.key === 'string') : []; } catch { return this._mem || []; } }
  _setClaims(list) { try { this.storage().setItem(this._claimKey(), JSON.stringify(list)); } catch { /* private mode: kept for this visit only */ this._mem = list; } }
  async claim(id) {
    const d = await this.request(`/api/guests/${this.guestLinkID}/claim`, { method: 'POST', body: { id } });
    this._setClaims([...this.claims().filter((c) => c.id !== id), { id: d.id, key: d.key }]);
    return d;
  }
  saveMe(id, changes) {
    const c = this.claims().find((x) => x.id === id);
    if (!c) return Promise.reject(new RequestError('This phone hasn’t picked that name.', 403));
    return this.request(`/api/guests/${this.guestLinkID}/me`, { method: 'PUT', body: { id, key: c.key, ...changes } });
  }

  createLink(revision) { return this.request('/api/studio/links', { method: 'POST', body: { revision } }); }

  // ── the family photos on the wall ──
  get canPhotos() { return this.mode.kind !== 'studio'; }
  _photoPath(n) { return this.role === 'guest' ? `/api/guests/${this.guestLinkID}/photo/${n}` : `${this._hostBase}/photo/${n}`; }
  /** One photo's picture (a Blob), or null. */
  async photoBlob(n, v = '') {
    const init = { method: 'GET', cache: 'force-cache' };
    const url = `${this._photoPath(n)}?v=${v}`;
    try {
      const r = this._api ? await this._api.fetch(new Request(new URL(url, location.origin), init), this._env) : await this.fetcher(url, init);
      return r.ok ? await r.blob() : null;
    } catch { return null; }
  }
  async uploadPhoto(n, blob) {
    const init = { method: 'PUT', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob };
    const r = this._api ? await this._api.fetch(new Request(new URL(this._photoPath(n), location.origin), init), this._env) : await this.fetcher(this._photoPath(n), init);
    let data; try { data = await r.json(); } catch { throw new RequestError('Could not read the server’s answer.', r.status); }
    if (!r.ok) throw new RequestError(data.error || 'Could not upload.', r.status, data);
    return data;
  }
  deletePhoto(n) { return this.request(this._photoPath(n), { method: 'DELETE' }); }

  // ── the demonstration ──
  async _ensureDemo() {
    const B = this._env.SHARES;
    let rec = await (await B.get(`shares/${DEMO_ID}.json`))?.json();
    if (!rec) {
      const { content } = await import('../content.js');
      const now = Date.now();
      rec = { content: cleanContent({ ...content, texts: {} }), createdAt: now, editingDeadline: null, finalized: false, revision: 0, guests: demoRoster(now), party: defaultParty(), guestLink: null };
      await B.put(`shares/${DEMO_ID}.json`, JSON.stringify(rec));
    }
    if (!rec.guestLink) await this.request(`/api/invitations/${DEMO_ID}/guestlink`, { method: 'POST' });
    rec = await (await B.get(`shares/${DEMO_ID}.json`)).json();
    this._demoGid = rec.guestLink;
  }
  reset() {
    const s = this.storage();
    for (let i = s.length - 1; i >= 0; i--) { const k = s.key(i); if (k?.startsWith(DEMO_PREFIX) || k?.startsWith('thanksgiving:claims:')) s.removeItem(k); }
  }
}

export { defaultLook };
