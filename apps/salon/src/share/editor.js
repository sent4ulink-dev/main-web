// Inline editing, in place: every word of the card is edited exactly where it is shown, in its own
// font and size (no editor page, panel or form). A compact toolbar — Save · Previous · Next · Finish
// permanently — takes its own strip at the top and pushes the scene down, so it never covers anything.
//   [data-k="path"]   a content field (src/content.js shape), e.g. name, photos.2.caption
//   [data-tk="text"]  a built-in label; its edited wording is kept in content.texts under its original text
// The letter (a 3D page) and the calendar's note are edited through text layers laid exactly over them.
// The portraits' photos, the YouTube song and the voice message are changed from buttons in the scene
// that sit on the objects themselves; each change is saved at once, so the server can
// delete the file it replaced straight away.
import { setPath, getPath, replaceContent, MEDIA_IMAGE } from './content-core.js';
import { validShareID } from './repository.js';
import { pickImage, shrinkImage } from './media.js';
import { openYouTube, openVoice } from './sheets.js';
import { parseYouTube } from '../core/youtube.js';
import { monthDay } from '../util/textures.js';
import { openEasyEditor, saveKeepingLatest } from './easy-editor.js';
import { LivePreview } from './live-preview.js';
import { makeSteps, title as easyTitle } from './easy-steps.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s) => document.querySelector(s);
const ROOTS = ['#intro-float', '#chapter-card', '.finale-card', '.vf-hint'];
const SKIP = 'button,[data-k],.spark,[aria-hidden="true"],.chip-row,.finale-icons,script,style,.nav-dots';

export class CardEditor {
  constructor({ repo, content }) {
    Object.assign(this, { repo, content });
    this.revision = 0; this.editing = false; this.dirty = false; this.canEdit = false; this.finished = false;
    this.changed = new Set(); this.busy = false;
    this.bar = $('#owner-bar'); this.label = $('#mode-label'); this.toggle = $('#edit-toggle');
    this.generate = $('#generate-link'); this.resetBtn = $('#reset-demo'); this.toolbar = $('#editor-toolbar');
    this.dialog = $('#share-link-dialog'); this.gate = $('#mode-gate'); this.letterLayer = $('#letter-edit');
    this.calLayer = Object.assign(document.createElement('div'), { id: 'cal-edit', className: 'cal-edit', hidden: true });
    this.letterLayer.after(this.calLayer);
    this.spotLayer = Object.assign(document.createElement('div'), { id: 'media-spots', hidden: true });
    this.calLayer.after(this.spotLayer);
    this.spotLayer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-key]'); if (!b || this.busy) return;
      const act = b.dataset.act, st = this.story, n = this.content.photos.length, i = st?.photoIndex ?? -1;
      if (act === 'prev' || act === 'next') return st.showPhoto(act === 'next' ? (i < 0 ? 0 : (i + 1) % n) : (i <= 0 ? n - 1 : i - 1));
      if (act === 'youtube') return this.youtube();
      if (act === 'voice') return this.voice();
      if (e.target.closest('.ms-x')) this.setMedia(b.dataset.path, async () => '');
      else this.photo(+b.dataset.slot, b.dataset.path);
    });
    this.toggle.onclick = () => this.enable();
    this.generate.onclick = () => this.generateLink();
    this.resetBtn.onclick = () => this.resetDemo();
    this.toolbar.addEventListener('click', (e) => this.command(e.target.closest('[data-cmd]')?.dataset.cmd));
    this.dialog.querySelector('[data-close-link]').onclick = () => this.dialog.close();
    this.dialog.querySelector('[data-copy-link]').onclick = () => this.copyLink();
    document.addEventListener('input', (e) => this.input(e));
    document.addEventListener('paste', (e) => this.paste(e));
    document.addEventListener('click', (e) => { const d = e.target.closest('[data-kind="date"]'); if (d && this.editing) this.pickDate(d); });
    addEventListener('beforeunload', (e) => { if (this.dirty) { e.preventDefault(); e.returnValue = ''; } });
    setInterval(() => this.checkDeadline(), 1000);
    // keep built-in labels bound (and editable while editing) however often the story re-renders them
    this.observer = new MutationObserver(() => this.refreshBindings());
    for (const s of ROOTS) { const el = $(s); if (el) this.observer.observe(el, { childList: true, subtree: true, characterData: false }); }
  }

  // ── start: studio password / test / saved link ─────────────────────────
  async boot() {
    const kind = this.repo.mode.kind;
    this.resetBtn.hidden = kind !== 'test';
    if (kind === 'unavailable') return this.state('Link not found', 'This link is not valid. Please check the full link.');
    if (kind === 'studio') await this.passwordGate();
    for (;;) {
      try {
        if (kind !== 'studio') this.state(kind === 'test' ? 'Getting the demo ready…' : 'Opening your gift…', '', false, true);
        const d = await this.repo.load();
        this.loaded(d);
        this.gate.hidden = true;
        if (kind === 'studio') this.generate.hidden = false;
        return d;
      } catch (error) {
        if (error.status === 401 && kind === 'studio') { await this.passwordGate('Please enter your password again.'); continue; }
        if (error.status === 404) return this.state('Link not found', 'There is no gift saved at this link. Please ask the sender.');
        await this.state('Connection error', error.message, true);
      }
    }
  }

  loaded(d) {
    replaceContent(this.content, d.content);
    Object.assign(this, { revision: d.revision, canEdit: d.canEdit, finished: d.finished, editingDeadline: d.editingDeadline, dirty: false });
    this.bar.hidden = false;
    this.toggle.hidden = !this.canEdit;
    this.modeStatus();
  }

  state(title, message, retry = false, quiet = false) {
    this.gate.hidden = false;
    this.gate.innerHTML = `<div class="gate-card float-type"><h1 class="display">${esc(title)}</h1><p class="lede" role="status">${esc(message)}</p>${retry ? '<button class="btn-float primary" data-retry>Try again</button>' : ''}</div>`;
    this.gate.classList.toggle('quiet', quiet);
    if (!retry) return null;
    return new Promise((resolve) => { this.gate.querySelector('[data-retry]').onclick = resolve; });
  }

  passwordGate(note = '') {
    this.repo.clearAccess();
    this.gate.hidden = false; this.gate.classList.remove('quiet');
    this.gate.innerHTML = `<form class="gate-card float-type" id="studio-form">
      <p class="eyebrow brand-eyebrow"><img src="/brand/wordmark.webp" width="582" height="128" alt="sent4u"></p><h1 class="display">Private studio</h1>
      <p class="lede">Enter your password to edit the gift and generate links.</p>
      <input id="studio-password" type="password" autocomplete="current-password" maxlength="512" required placeholder="Password" aria-label="Password">
      <button type="submit" class="btn-float primary">Open studio</button><p class="gate-status" role="status">${esc(note)}</p></form>`;
    const form = this.gate.querySelector('form'), input = form.querySelector('input'), status = form.querySelector('.gate-status');
    input.focus();
    return new Promise((resolve) => {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const pw = input.value; input.value = '';
        form.querySelector('button').disabled = true; status.textContent = 'Checking…';
        try { await this.repo.login(pw); status.textContent = 'Opening the studio…'; resolve(); }
        catch (error) { status.textContent = error.message; form.querySelector('button').disabled = false; input.focus(); }
      };
    });
  }

  modeStatus() {
    const kind = this.repo.mode.kind;
    this.label.textContent = kind === 'studio' ? 'Private studio' : kind === 'test' ? 'Demo mode · this device only'
      : this.finished ? 'Editing finished for good' : this.canEdit ? `Editing until: ${new Date(this.editingDeadline).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Editing time is over';
    this.bar.classList.toggle('view-only', !this.canEdit && kind === 'invitation');
  }

  checkDeadline() {
    if (this.repo.mode.kind !== 'invitation' || !this.editingDeadline || Date.now() < this.editingDeadline || !this.canEdit) return;
    this.canEdit = false; this.stop(); this.toggle.hidden = true; this.modeStatus();
  }

  // ── binding: content fields and built-in labels ────────────────────────
  refreshBindings() {
    if (this._binding) return;
    this._binding = true;
    this.observer.disconnect();
    for (const s of ROOTS) { const root = $(s); if (root) this.bind(root); }
    this.decorate();
    for (const s of ROOTS) { const el = $(s); if (el) this.observer.observe(el, { childList: true, subtree: true }); }
    this._binding = false;
  }

  bind(root) {
    const texts = this.content.texts || {};
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n; (n = walker.nextNode());) {
      const p = n.parentElement;
      if (!n.textContent.trim() || !p || p.closest(SKIP) || p.closest('[data-tk]')) continue;
      nodes.push(n);
    }
    for (const n of nodes) {
      const original = n.textContent.trim();
      const span = document.createElement('span');
      span.dataset.tk = original;
      span.textContent = texts[original] ?? n.textContent;
      n.replaceWith(span);
    }
  }

  decorate() {
    const on = this.editing;
    for (const s of ROOTS) {
      const root = $(s); if (!root) continue;
      for (const el of root.querySelectorAll('[data-k],[data-tk]')) {
        const date = el.dataset.kind === 'date';
        el.contentEditable = on && !date ? 'plaintext-only' : 'false';
        el.classList.toggle('inline-editable', on);
        if (on && !date) el.setAttribute('role', 'textbox'); else el.removeAttribute('role');
      }
    }
  }

  // ── editing ────────────────────────────────────────────────────────────
  enable() {
    this.checkDeadline();
    if (!this.canEdit || this.finished) return;
    // a saved link and the demo get the step-by-step editor; the private studio keeps editing in place
    if (this.repo.mode.kind !== 'studio') { this.openEasy(); return; }
    this.editing = true;
    this.toggle.hidden = true; this.generate.hidden = true;
    document.body.classList.add('editing');
    this.toolbar.hidden = false;
    this.commands();
    this.layout();
    this.refreshBindings();
    this.story?.refreshCard?.();
  }

  /**
   * The step-by-step editor, with the card itself running live beside the form. Only one 3D salon at a time: this
   * page's own is let go while it is open (closing reloads the page with the new words).
   */
  openEasy() {
    const repo = this.repo, kind = repo.mode.kind;
    let revision = this.revision, deadline = this.editingDeadline;
    const embed = new URL(location.href); embed.searchParams.set('embed', '1'); embed.hash = '';
    const live = new LivePreview({ src: embed.href });
    const link = new URL(location.href); link.searchParams.delete('embed'); link.hash = '';
    openEasyEditor({
      title: easyTitle, live,
      steps: makeSteps({ picture: () => live.picture() }),
      load: async () => { const d = await repo.load(); revision = d.revision; deadline = d.editingDeadline ?? deadline; return d; },
      save: saveKeepingLatest({
        save: (c, rev, { finish }) => repo.save(c, rev, finish),
        latest: () => repo.load(),
        getRevision: () => revision,
        setRevision: (r) => { revision = r; },
      }),
      upload: (blob) => repo.upload(blob),
      mediaURL: (name) => repo.mediaURL(name),
      canFinish: kind === 'invitation',
      shareUrl: kind === 'invitation' ? link.href : '',
      deadlineText: () => (kind === 'invitation' && deadline ? `You can edit this link until ${new Date(deadline).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.` : kind === 'test' ? 'This is a demo: what you write is kept on this device only.' : ''),
      onOpen: () => this.release3d?.(),
      done: () => location.reload(),
    });
  }

  stop() {
    this.editing = false;
    document.body.classList.remove('editing');
    this.toolbar.hidden = true;
    if (!this.letterLayer.hidden) { this.letterLayer.hidden = true; this.letterBlank?.(false); }
    if (!this.calLayer.hidden) { this.calLayer.hidden = true; this.calendarBlank?.(false); }
    this.spotLayer.hidden = true;
    this.layout();
    this.refreshBindings();
    this.story?.refreshCard?.();
    this.flush();
  }

  /** The toolbar's own strip: the scene moves down by its height (never covered). */
  layout() {
    const h = this.editing ? this.toolbar.offsetHeight : 0;
    document.documentElement.style.setProperty('--tb', `${h}px`);
    dispatchEvent(new Event('resize'));
  }

  commands(message = this.dirty ? 'Unsaved changes' : 'Tap any text or picture with a dashed outline to edit it') {
    const fin = this.repo.mode.kind !== 'studio' ? '<button type="button" data-cmd="finish" class="tb-quiet">Finish for good</button>' : '';
    this.toolbar.innerHTML = `<div class="tb-row"><button type="button" data-cmd="save" class="tb-main">Save</button><button type="button" data-cmd="previous">‹ Previous</button><button type="button" data-cmd="next">Next ›</button>${fin}</div>`;
  }

  // ── portraits' photos, YouTube song, voice message ─────────────
  /** Which photo (index into content.photos) is shown close up, or -1. */
  photoSlot() {
    const st = this.story, p = st?.o?.photos;
    if (st?.current?.id !== 'moments' || !p || st.photoIndex < 0) return -1;
    return p.cards.indexOf(p.ordered[st.photoIndex]);
  }

  /** Swap one file of the card (or remove it with ''), then save at once. */
  async setMedia(path, make) {
    if (this.busy) return;
    this.busy = true;
    this.status('Saving…');
    try {
      const blob = await make();
      const value = blob ? await this.repo.upload(blob) : (path === 'song.cover' ? 0 : '');
      setPath(this.content, path, value); this.changed.add(path); this.dirty = true;
      this.flush();
    } catch (error) {
      this.status(`Error — ${error.message}`);
      return;
    } finally { this.busy = false; }
    await this.save(false, true);
  }

  /** A portrait takes the photo as it is (its frame takes the photo's shape). */
  async photo(slot, path) {
    const f = await pickImage();
    if (f) this.setMedia(path, () => shrinkImage(f));
  }

  /** The concert's two windows: the YouTube background music and the voice message. */
  async youtube() {
    const v = await openYouTube(this.content.song.youtube);
    if (v != null) this.setYouTube(v);
  }
  async voice() {
    this.story?.stopSong();
    const r = await openVoice(this.content.song.voice ? this.repo.mediaURL(this.content.song.voice) : '');
    if (r?.remove) this.setMedia('song.voice', async () => '');
    else if (r?.blob) this.setMedia('song.voice', async () => r.blob);
  }

  setYouTube(value) {
    const v = value.trim();
    if (v === this.content.song.youtube) return;
    if (v && !parseYouTube(v)) { this.status('YouTube link is not valid.'); return; }
    setPath(this.content, 'song.youtube', v); this.changed.add('song.youtube'); this.dirty = true;
    this.flush();
    this.save(false, true);
  }

  /** Messages that matter (saved, errors) come as a short toast; the toolbar keeps to its buttons. */
  status(text) { if (/^(Error|Saved|Microphone|YouTube|One text)/.test(text)) this.toast?.(text); }

  command(cmd) {
    if (!cmd || this.busy) return;
    if (cmd === 'save') return this.save(false);
    if (cmd === 'previous') return this.story?.prev();
    if (cmd === 'next') return this.story?.next();
    if (cmd === 'finish') {
      this.toolbar.innerHTML = '<p class="tb-question">Finish editing for good? Your current changes will be saved. You will not be able to edit again.</p><div class="tb-row"><button type="button" data-cmd="confirm" class="tb-main">Yes, finish for good</button><button type="button" data-cmd="cancel">No, keep editing</button></div><span class="tb-status" role="status"></span>';
      return this.layout();
    }
    if (cmd === 'cancel') { this.commands(); return this.layout(); }
    if (cmd === 'confirm') return this.save(true);
  }

  input(e) {
    if (!this.editing || this.finishing) return;
    const el = e.target.closest?.('[data-k],[data-tk]'); if (!el) return;
    const max = el.dataset.k?.startsWith('letter.paragraphs') ? 2400 : 600;
    if (el.textContent.length > max) { el.textContent = el.textContent.slice(0, max); this.status(`One text cannot exceed ${max} characters.`); }
    if (el.dataset.k) { setPath(this.content, el.dataset.k, el.textContent.trim()); this.changed.add(el.dataset.k); }
    else { (this.content.texts ||= {})[el.dataset.tk] = el.textContent; }
    // the same field shown twice (e.g. the name) stays in step
    if (el.dataset.k) for (const twin of document.querySelectorAll(`[data-k="${el.dataset.k}"]`)) if (twin !== el && twin.dataset.kind !== 'date') twin.textContent = el.textContent;
    this.dirty = true; this.status('Unsaved changes');
    clearTimeout(this._applyT); this._applyT = setTimeout(() => this.flush(), 450);
  }

  paste(e) {
    if (!this.editing || !e.target.closest?.('[data-k],[data-tk]')) return;
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain').slice(0, 2400));
  }

  /** Re-paint the 3D things that show edited fields (envelope, letter, stars, captions, calendar). */
  flush() {
    clearTimeout(this._applyT);
    if (!this.changed.size) return;
    const paths = [...this.changed]; this.changed.clear();
    this.apply?.(paths);
  }

  pickDate(el) {
    const input = document.createElement('input');
    input.type = 'date'; input.value = this.content.date.iso; input.className = 'date-picker';
    const r = el.getBoundingClientRect();
    Object.assign(input.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    document.body.appendChild(input);
    const done = () => input.remove();
    input.onchange = () => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(input.value)) {
        this.content.date.iso = input.value; this.changed.add('date.iso'); this.dirty = true;
        const d = new Date(`${input.value}T12:00:00`);
        el.textContent = monthDay(d);
        this.status('Unsaved changes'); this.flush();
      }
      done();
    };
    input.onblur = () => setTimeout(done, 200);
    input.focus();
    try { input.showPicker(); } catch { /* the field itself is still usable */ }
  }

  /** Save; `stay` keeps editing (after a photo / voice change) instead of going back to the card. */
  async save(finish, stay = false) {
    this.checkDeadline();
    if (this.busy || !this.canEdit) return false;
    this.busy = true; this.finishing = finish;
    this.status(finish ? 'Finishing for good…' : 'Saving…');
    this.toolbar.querySelectorAll('button').forEach((b) => (b.disabled = true));
    try {
      const d = await this.repo.save(this.content, this.revision, finish);
      Object.assign(this, { revision: d.revision, finished: d.finished, canEdit: d.canEdit, editingDeadline: d.editingDeadline ?? this.editingDeadline, dirty: false });
      if (stay && this.canEdit) { this.status('Saved ✓'); return true; }
      this.stop();                                   // back to the card, right where it was
      this.toggle.hidden = !this.canEdit;
      this.generate.hidden = this.repo.mode.kind !== 'studio';
      this.modeStatus();
      this.toast?.(finish ? 'Editing finished for good ✨' : 'Saved ✓');
      return true;
    } catch (error) {
      if (error.status === 423) { this.finished = !!error.data.finished; this.canEdit = false; this.stop(); this.toggle.hidden = true; this.modeStatus(); }
      if (error.status === 401) this.toast?.('Your studio session has expired. Please reload the page.');
      this.status(`Error — ${error.message}`);
      return false;
    } finally {
      this.busy = false; this.finishing = false;
      this.toolbar.querySelectorAll('button').forEach((b) => (b.disabled = false));
    }
  }

  async generateLink() {
    if (this.repo.mode.kind !== 'studio' || this.generating) return;
    this.generating = true; this.generate.disabled = true;
    try {
      if (this.dirty && !await this.save(false)) return;
      const d = await this.repo.createLink(this.revision);
      if (!validShareID(d.id)) throw new Error('The server returned an invalid link.');
      this.dialog.querySelector('#share-url').textContent = d.url;
      this.dialog.querySelector('.link-status').textContent = '';
      this.dialog.showModal();
    } catch (error) { this.toast?.(`Error — ${error.message}`); }
    finally { this.generating = false; this.generate.disabled = false; }
  }

  async copyLink() {
    const out = this.dialog.querySelector('#share-url'), status = this.dialog.querySelector('.link-status');
    try { await navigator.clipboard.writeText(out.textContent); status.textContent = 'Link copied.'; }
    catch { status.textContent = 'Could not copy. Select the link above and copy it.'; }
  }

  async resetDemo() {
    if (this.repo.mode.kind !== 'test') return;
    this.repo.reset();
    this.dirty = false;
    location.reload();
  }

  // ── the letter and the calendar's note: text layers laid exactly over them while editing ───
  frame(rect, calRect = null, spots = []) {
    this.spotFrame(this.editing ? spots : []);
    this.calendarFrame(calRect);
    const show = this.editing && !!rect;
    if (show && this.letterLayer.hidden) {
      const L = this.content.letter;
      this.letterLayer.innerHTML = `<p class="le-greeting"><span data-k="letter.greeting">${esc(L.greeting.replace('{name}', this.content.name))}</span></p>${L.paragraphs.map((p, i) => `<p><span data-k="letter.paragraphs.${i}">${esc(p)}</span></p>`).join('')}<p class="le-sign"><span data-k="letter.signoff">${esc(L.signoff)}</span></p><p class="le-from"><span data-k="from">${esc(this.content.from)}</span></p>`;
      for (const el of this.letterLayer.querySelectorAll('[data-k]')) { el.contentEditable = 'plaintext-only'; el.classList.add('inline-editable'); }
      this.letterLayer.hidden = false;
      this.letterBlank?.(true);
    } else if (!show && !this.letterLayer.hidden) {
      this.letterLayer.hidden = true;
      this.letterBlank?.(false);
    }
    if (show) {
      const s = this.letterLayer.style;
      s.left = `${rect.x}px`; s.top = `${rect.y}px`; s.width = `${rect.w}px`; s.height = `${rect.h}px`;
      s.setProperty('--u', `${rect.w / 512}px`);
    }
  }

  /** Dashed "add a photo" spots laid over each picture that can be changed. */
  spotFrame(spots) {
    const layer = this.spotLayer, ch = this.story?.current?.id;
    if (spots.length && ch === 'moments') {
      // big ‹ › beside the polaroid in view (or the whole line): go through the five, edit each caption
      const i = this.story.photoIndex, slot = this.photoSlot(), r = (i >= 0 && spots.find((s) => s.slot === slot)?.rect)
        || spots.reduce((a, s) => ({ x: Math.min(a.x, s.rect.x), y: Math.min(a.y, s.rect.y), r: Math.max(a.r, s.rect.x + s.rect.w), b: Math.max(a.b, s.rect.y + s.rect.h) }), { x: 1e9, y: 1e9, r: -1e9, b: -1e9 });
      const right = r.r ?? r.x + r.w, bottom = r.b ?? r.y + r.h, cy = (r.y + bottom) / 2, W = innerWidth;
      spots = [...spots,
        { key: 'prev', act: 'prev', rect: { x: Math.max(6, r.x - 66), y: cy - 30, w: 56, h: 60 } },
        { key: 'next', act: 'next', rect: { x: Math.min(W - 62, right + 10), y: cy - 30, w: 56, h: 60 } }];
    } else if (spots.length && ch === 'music') {
      // two round buttons in front of the fortepiano: background music (YouTube) and the voice message
      const r = spots[0].rect, cx = r.x + r.w / 2, y = r.y + r.h + 10, c = this.content.song;
      spots = [
        { key: 'youtube', act: 'youtube', rect: { x: cx - 74, y, w: 68, h: 68 }, filled: !!c.youtube },
        { key: 'voice', act: 'voice', rect: { x: cx + 6, y, w: 68, h: 68 }, filled: !!c.voice }];
    }
    layer.hidden = !spots.length;
    const seen = new Set();
    for (const s of spots) {
      seen.add(s.key);
      let el = layer.querySelector(`[data-key="${s.key}"]`);
      if (!el) { el = Object.assign(document.createElement('button'), { type: 'button', className: 'media-spot' }); el.dataset.key = s.key; layer.append(el); }
      el.dataset.act = s.act || 'image';
      if (s.path) { el.dataset.path = s.path; el.dataset.slot = s.slot; }
      const look = { prev: ['‹', ''], next: ['›', ''], youtube: ['🎵', s.filled ? 'Music ✓' : 'Music'], voice: ['🎙', s.filled ? 'Voice ✓' : 'Voice'] }[s.act]
        || ['🖼', s.filled ? 'Replace' : 'Add photo'];
      const label = look.join('|') + (s.filled ? '|x' : '');
      if (el.dataset.label !== label) {
        el.dataset.label = label;
        el.className = `media-spot${s.act ? ` ms-${s.act === 'prev' || s.act === 'next' ? 'arrow' : 'round'}` : ''}`;
        el.innerHTML = `<span class="ms-icon" aria-hidden="true">${look[0]}</span>${look[1] ? `<span class="ms-text">${look[1]}</span>` : ''}${s.filled && !s.act ? '<span class="ms-x" role="button" aria-label="Remove photo">✕</span>' : ''}`;
        el.setAttribute('aria-label', look[1] || (s.act === 'prev' ? 'Previous photo' : 'Next photo'));
      }
      el.classList.toggle('filled', s.filled);
      el.classList.toggle('tiny', s.rect.w < 70);
      const st = el.style;
      st.left = `${s.rect.x}px`; st.top = `${s.rect.y}px`; st.width = `${s.rect.w}px`; st.height = `${s.rect.h}px`;
    }
    for (const el of [...layer.children]) if (!seen.has(el.dataset.key)) el.remove();
  }

  calendarFrame(rect) {
    const show = this.editing && !!rect;
    if (show && this.calLayer.hidden) {
      this.calLayer.innerHTML = `<span data-k="date.label">${esc(this.content.date.label)}</span>`;
      const el = this.calLayer.firstChild; el.contentEditable = 'plaintext-only'; el.classList.add('inline-editable');
      this.calLayer.hidden = false;
      this.calendarBlank?.(true);
    } else if (!show && !this.calLayer.hidden) {
      this.calLayer.hidden = true;
      this.calendarBlank?.(false);
    }
    if (show) {
      // never smaller than a comfortable line to type in (the calendar is small on phones)
      const w = Math.max(rect.w, 200), h = Math.max(rect.h, 28), s = this.calLayer.style;
      s.left = `${rect.x + (rect.w - w) / 2}px`; s.top = `${rect.y + (rect.h - h) / 2}px`; s.width = `${w}px`; s.height = `${h}px`;
      s.setProperty('--h', `${h}px`);
    }
  }
}

export { getPath };
