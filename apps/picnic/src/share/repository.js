// URL modes and where a card's content lives (same design as the other sent4u cards):
//   /                → the private studio: password, inline draft editing, Save, Generate link
//   /?share=test     → a local demonstration (this browser only), with Reset (also /?share=test-picnic, the demo link on sent4u.link)
//   /?share=<id>     → a saved card; its holder may edit it for five days unless finished, then view
import { freshContent, cleanContent, mediaOf } from './content-core.js';

export const DEMO_KEY = 'sent4u-picnic:demo:v1';
const DEMO_MEDIA = `${DEMO_KEY}:media:`;   // the demo's uploads stay in this browser (data URLs), never on the server
const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a' };
export const validShareID = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(id);
export function selectMode(search) {
  const p = new URLSearchParams(search);
  if (!p.has('share')) return { kind: 'studio' };
  const all = p.getAll('share');
  if (all.length !== 1) return { kind: 'unavailable' };
  const id = all[0];
  return id === 'test' || id === 'test-picnic' ? { kind: 'test' } : validShareID(id) ? { kind: 'invitation', id } : { kind: 'unavailable' };
}
export class RequestError extends Error { constructor(message, status = 0, data = {}) { super(message); this.status = status; this.data = data; } }

export class ModeRepository {
  constructor(mode, { fetcher = (...a) => fetch(...a), storage = () => localStorage } = {}) { Object.assign(this, { mode, fetcher, storage }); this.token = null; }
  clearAccess() { this.token = null; }
  async request(path, { method = 'GET', body, patient = false } = {}) {
    let response; const started = Date.now();
    for (let attempt = 0; ; attempt++) {
      try {
        response = await this.fetcher(path, { method, cache: 'no-store', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        if (!patient || !(response.status >= 500 || response.status === 408 || response.status === 429) || Date.now() - started > 30000) break;
      } catch { if (!patient || Date.now() - started > 30000) throw new RequestError('Connection error. Check your internet and try again.'); }
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 6000)));
    }
    let data; try { data = await response.json(); } catch { throw new RequestError('Could not read the reply from the server.', response.status); }
    if (!response.ok) throw new RequestError(data.error || 'Could not load.', response.status, data);
    return data;
  }
  async login(password) { const d = await this.request('/api/studio/login', { method: 'POST', body: { password } }); this.token = d.token; }
  async load() {
    const kind = this.mode.kind;
    if (kind === 'test') {
      const raw = this.storage().getItem(DEMO_KEY);
      if (raw) { try { const d = JSON.parse(raw); return { content: cleanContent(d.content), revision: d.revision | 0, finished: !!d.finished, canEdit: !d.finished }; } catch { this.storage().removeItem(DEMO_KEY); } }
      return { content: freshContent(), revision: 0, finished: false, canEdit: true };
    }
    if (kind === 'studio') return this.request('/api/studio/draft', { patient: true });
    if (kind === 'invitation') return this.request(`/api/invitations/${this.mode.id}`, { patient: true });
    throw new RequestError('This link was not found.', 404);
  }
  async save(content, revision, finish = false) {
    content = cleanContent(content);
    const kind = this.mode.kind;
    if (kind === 'test') {
      const cur = await this.load();
      if (cur.finished) throw new RequestError('The demo editing is finished. Press "Reset" to start over.', 423);
      if (cur.revision !== revision) throw new RequestError('Changed in another window. Please reload.', 409);
      const d = { content, revision: revision + 1, finished: finish, canEdit: !finish };
      this.storage().setItem(DEMO_KEY, JSON.stringify(d));
      this._pruneDemo(content);
      return d;
    }
    if (kind === 'studio') return this.request('/api/studio/draft', { method: 'PUT', body: { content, revision } });
    if (kind === 'invitation') return this.request(`/api/invitations/${this.mode.id}${finish ? '/finish' : ''}`, { method: finish ? 'POST' : 'PUT', body: { content, revision } });
    throw new RequestError('This link was not found.', 404);
  }
  /** Where an uploaded file ('media/<name>') or a bundled one ('photos/…') is fetched from. */
  mediaURL(name) {
    if (!name || typeof name !== 'string') return '';
    if (!name.startsWith('media/')) return `${import.meta.env.BASE_URL}${name}`;
    const file = name.slice(6), kind = this.mode.kind;
    if (kind === 'test') { try { return this.storage().getItem(DEMO_MEDIA + file) || ''; } catch { return ''; } }
    return `/api/media/${kind === 'studio' ? 'studio' : this.mode.id}/${file}`;
  }
  /** Store a photo or the voice message; resolves with its name for the content ('media/<name>'). */
  async upload(blob) {
    const type = (blob.type || '').split(';')[0], ext = EXT[type];
    if (!ext) throw new RequestError('This type of file cannot be saved.', 415);
    const kind = this.mode.kind;
    if (kind === 'test') {
      const file = `${Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[b & 63]).join('')}.${ext}`;
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
      try { this.storage().setItem(DEMO_MEDIA + file, data); } catch { throw new RequestError('The demo storage is full. Press "Reset".', 507); }
      return `media/${file}`;
    }
    const path = kind === 'studio' ? '/api/studio/media' : kind === 'invitation' ? `/api/invitations/${this.mode.id}/media` : null;
    if (!path) throw new RequestError('This link was not found.', 404);
    let response;
    try { response = await this.fetcher(path, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': type, ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: blob }); }
    catch { throw new RequestError('Connection error. Check your internet and try again.'); }
    let data; try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) throw new RequestError(data.error || 'Could not save.', response.status, data);
    return data.name;
  }
  /** The demo's own files that its saved content no longer names: removed (like the server does). */
  _pruneDemo(content) {
    const keep = new Set(mediaOf(content).map((m) => DEMO_MEDIA + m.slice(6)));
    const s = this.storage();
    for (let i = s.length - 1; i >= 0; i--) { const k = s.key(i); if (k?.startsWith(DEMO_MEDIA) && !keep.has(k)) s.removeItem(k); }
  }
  createLink(revision) { return this.request('/api/studio/links', { method: 'POST', body: { revision } }); }
  reset() { this.storage().removeItem(DEMO_KEY); this._pruneDemo(null); return this.load(); }
}
