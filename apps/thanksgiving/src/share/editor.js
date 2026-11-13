// Editing the card's words. The host's link (and the demo) opens the step-by-step editor, with the card itself
// running live beside the form (openEasy). The private studio edits in place: every word exactly where it is
// shown, in its own font and size, with a compact toolbar — Save · Previous · Next · Finish permanently —
// in its own strip at the top that pushes the scene down, so it never covers anything.
//   [data-k="path"]   a content field (src/content.js shape), e.g. family, letter.paragraphs.1
//   [data-tk="text"]  a built-in label; its edited wording is kept in content.texts under its original text
// The guest list is not edited here: it has its own panel (src/party/hostpanel.js).
import { setPath, replaceContent } from './content-core.js';
import { validShareID } from './repository.js';
import { openEasyEditor, saveKeepingLatest, shrinkImage } from './easy-editor.js';
import { makeSteps, title as easyTitle } from './easy-steps.js';
import { LivePreview } from './live-preview.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s) => document.querySelector(s);
const ROOTS = ['#intro-float', '#chapter-card', '.finale-card'];
// headings, instructions and the guests' own words are fixed: only the card's content ([data-k]) is edited
const SKIP = 'button,[data-k],.spark,[aria-hidden="true"],.names,.dishes,.rsvp,.answer,.who-switch,.headcount,textarea,script,style,.nav-dots,.eyebrow,#ch-title,.no-edit,.finale-title,.intro-float h1,.hint,.hand-prefix,.rotating,.intro-who,.letter .greet';

export class CardEditor {
  constructor({ repo, content }) {
    Object.assign(this, { repo, content });
    this.revision = 0; this.editing = false; this.dirty = false; this.canEdit = false; this.finished = false;
    this.changed = new Set(); this.busy = false;
    this.bar = $('#owner-bar'); this.label = $('#mode-label'); this.toggle = $('#edit-toggle');
    this.generate = $('#generate-link'); this.resetBtn = $('#reset-demo'); this.toolbar = $('#editor-toolbar');
    this.guestsBtn = $('#guests-toggle'); this.guestLinkBtn = $('#guest-link'); this.viewAs = $('#view-as');
    this.gate = $('#mode-gate');
    this.toggle.onclick = () => this.enable();
    this.generate.onclick = () => this.generateLink();
    this.resetBtn.onclick = () => this.resetDemo();
    this.toolbar.addEventListener('click', (e) => this.command(e.target.closest('[data-cmd]')?.dataset.cmd));
    document.addEventListener('input', (e) => this.input(e));
    document.addEventListener('paste', (e) => this.paste(e));
    document.addEventListener('click', (e) => { const d = e.target.closest('[data-kind="date"]'); if (d && this.editing) this.pickDate(d); });
    addEventListener('beforeunload', (e) => { if (this.dirty) { e.preventDefault(); e.returnValue = ''; } });
    setInterval(() => this.checkDeadline(), 1000);
    this.observer = new MutationObserver(() => this.refreshBindings());
    for (const s of ROOTS) { const el = $(s); if (el) this.observer.observe(el, { childList: true, subtree: true, characterData: false }); }
  }

  // ── start: studio password / test / host link / guest link ─────────────
  async boot() {
    const kind = this.repo.mode.kind, host = this.repo.role === 'host';
    this.resetBtn.hidden = kind !== 'test';
    if (kind === 'test') {
      this.viewAs.hidden = false;
      this.viewAs.textContent = this.repo.mode.asGuest ? '👀 View as host' : '👀 View as a guest';
      this.viewAs.onclick = () => { location.search = this.repo.mode.asGuest ? '?share=test' : '?share=test&as=guest'; };
    }
    if (kind === 'unavailable') return this.state('Link not found', 'This link isn’t right. Please check the whole link.');
    if (kind === 'studio') await this.passwordGate();
    for (;;) {
      try {
        if (kind !== 'studio') this.state(kind === 'test' ? 'Setting up the demo…' : 'Opening the invitation…', '', false, true);
        const d = await this.repo.load();
        this.loaded(d);
        this.gate.hidden = true;
        if (kind === 'studio') this.generate.hidden = false;
        if (host) { this.guestsBtn.hidden = false; this.guestLinkBtn.hidden = kind === 'studio'; }
        return d;
      } catch (error) {
        if (error.status === 401 && kind === 'studio') { await this.passwordGate('Please enter your password again.'); continue; }
        if (error.status === 404) return this.state('Link not found', 'There’s no invitation at this link. Please ask whoever sent it.');
        await this.state('Connection problem', error.message, true);
      }
    }
  }

  loaded(d) {
    replaceContent(this.content, d.content);
    Object.assign(this, { revision: d.revision, canEdit: d.canEdit, finished: d.finished, editingDeadline: d.editingDeadline, dirty: false });
    const host = this.repo.role === 'host';
    this.bar.hidden = !(host || this.repo.mode.kind === 'test');
    this.toggle.hidden = !this.canEdit || !host;
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
      <p class="lede">Enter your password to edit the card and make links.</p>
      <input id="studio-password" type="password" autocomplete="current-password" maxlength="512" required placeholder="Password" aria-label="Password">
      <button type="submit" class="btn-float primary">Open the studio</button><p class="gate-status" role="status">${esc(note)}</p></form>`;
    const form = this.gate.querySelector('form'), input = form.querySelector('input'), status = form.querySelector('.gate-status');
    input.focus();
    return new Promise((resolve) => {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const pw = input.value; input.value = '';
        form.querySelector('button').disabled = true; status.textContent = 'Checking…';
        try { await this.repo.login(pw); status.textContent = 'Opening…'; resolve(); }
        catch (error) { status.textContent = error.message; form.querySelector('button').disabled = false; input.focus(); }
      };
    });
  }

  modeStatus() {
    const kind = this.repo.mode.kind;
    this.label.textContent = kind === 'studio' ? 'Private studio' : kind === 'test' ? (this.repo.mode.asGuest ? 'Demo · as a guest' : 'Demo · as the host')
      : this.repo.role === 'guest' ? '' : this.finished ? 'Wording finished' : this.canEdit ? `Wording editable until ${new Date(this.editingDeadline).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Wording is final';
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
    // the host's link and the demo get the step-by-step editor; the private studio keeps editing in place
    if (this.repo.mode.kind !== 'studio') { this.openEasy(); return; }
    this.editing = true;
    for (const b of [this.toggle, this.generate, this.guestsBtn, this.guestLinkBtn]) b.dataset.was = b.hidden ? '1' : '';
    this.toggle.hidden = true; this.generate.hidden = true;
    document.body.classList.add('editing');
    this.toolbar.hidden = false;
    this.commands();
    this.layout();
    this.story?.refreshCard?.();
    this.refreshBindings();
  }
  /**
   * The step-by-step editor, with the card itself running live beside the form. Only one 3D card at a time:
   * this page's own scene is let go while it is open (closing reloads the page with the new words).
   */
  openEasy() {
    const repo = this.repo, test = repo.mode.kind === 'test';
    let revision = this.revision, deadline = this.editingDeadline, list = [];
    const urls = [];
    const embed = new URL(location.href); embed.searchParams.set('embed', '1'); embed.hash = '';
    const live = new LivePreview({ src: embed.href });
    const keep = (n, blob) => { if (urls[n]) URL.revokeObjectURL(urls[n]); urls[n] = blob ? URL.createObjectURL(blob) : null; };
    const photos = {
      url: (n) => urls[n] || '',
      store: async (n, file) => {
        const blob = await shrinkImage(file, { max: test ? 900 : 1280 });
        const d = await repo.uploadPhoto(n, blob);
        list = d.photos || list; keep(n, blob); live.photos(list);
      },
      drop: async (n) => { const d = await repo.deletePhoto(n); list = d.photos || list; keep(n, null); live.photos(list); },
    };
    openEasyEditor({
      title: easyTitle, live,
      steps: makeSteps({ photos, picture: () => live.picture(), roster: this.roster, live }),
      load: async () => {
        const d = await repo.load();
        revision = d.revision; deadline = d.editingDeadline ?? deadline; list = d.photos || [];
        this.roster.load(d);   // (the family step works on the newest guest list)
        await Promise.all(list.map(async (v, n) => { if (v) keep(n, await repo.photoBlob(n, v)); }));
        return d;
      },
      save: saveKeepingLatest({
        save: (c, rev, { finish }) => repo.save(c, rev, finish),
        latest: () => repo.load(),
        getRevision: () => revision,
        setRevision: (r) => { revision = r; },
      }),
      canFinish: repo.mode.kind === 'invitation',
      deadlineText: () => (repo.mode.kind === 'invitation' && deadline ? `You can edit the wording until ${new Date(deadline).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.` : test ? 'This is a demo: what you write is kept on this device only.' : ''),
      end: this.guestLink ? { title: 'Send it to the family', text: 'One link for the whole family (a group chat is perfect): each person taps their own name, dresses up their character and answers.', button: 'Get the guest link', run: () => this.guestLink() } : null,
      onOpen: () => this.release3d?.(),
      done: () => location.reload(),
    });
  }

  stop() {
    this.editing = false;
    document.body.classList.remove('editing');
    this.toolbar.hidden = true;
    this.layout();
    this.story?.refreshCard?.();
    this.refreshBindings();
    this.flush();
  }
  layout() {
    const h = this.editing ? this.toolbar.offsetHeight : 0;
    document.documentElement.style.setProperty('--tb', `${h}px`);
    dispatchEvent(new Event('resize'));
  }
  commands() {
    const fin = this.repo.mode.kind !== 'studio' ? '<button type="button" data-cmd="finish" class="tb-quiet">Finish permanently</button>' : '';
    this.toolbar.innerHTML = `<div class="tb-row"><button type="button" data-cmd="save" class="tb-main">Save</button><button type="button" data-cmd="previous">‹ Previous</button><button type="button" data-cmd="next">Next ›</button>${fin}</div>`;
  }

  /** Messages that matter (saved, errors) come as a short toast. */
  status(text) { if (/^(Error|Saved|Keep)/.test(text)) this.toast?.(text); }

  command(cmd) {
    if (!cmd || this.busy) return;
    if (cmd === 'save') return this.save(false);
    if (cmd === 'previous') return this.story?.prev();
    if (cmd === 'next') return this.story?.next();
    if (cmd === 'finish') {
      this.toolbar.innerHTML = '<p class="tb-question">Finish the wording permanently? What you have now is saved, and it can’t be edited again. (The guest list stays yours to run.)</p><div class="tb-row"><button type="button" data-cmd="confirm" class="tb-main">Yes, finish permanently</button><button type="button" data-cmd="cancel">No, keep editing</button></div><span class="tb-status" role="status"></span>';
      return this.layout();
    }
    if (cmd === 'cancel') { this.commands(); return this.layout(); }
    if (cmd === 'confirm') return this.save(true);
  }

  input(e) {
    if (!this.editing || this.finishing) return;
    const el = e.target.closest?.('[data-k],[data-tk]'); if (!el) return;
    const max = el.dataset.k?.startsWith('letter.paragraphs') ? 1200 : 300;
    if (el.textContent.length > max) { el.textContent = el.textContent.slice(0, max); this.status(`Keep each text under ${max} characters.`); }
    if (el.dataset.k) { setPath(this.content, el.dataset.k, el.textContent.trim()); this.changed.add(el.dataset.k); }
    else { (this.content.texts ||= {})[el.dataset.tk] = el.textContent; }
    if (el.dataset.k) for (const twin of document.querySelectorAll(`[data-k="${el.dataset.k}"]`)) if (twin !== el && twin.dataset.kind !== 'date') twin.textContent = el.textContent;
    this.dirty = true;
    clearTimeout(this._applyT); this._applyT = setTimeout(() => this.flush(), 450);
  }
  paste(e) {
    if (!this.editing || !e.target.closest?.('[data-k],[data-tk]')) return;
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain').slice(0, 1200));
  }
  /** Re-paint the 3D things that show edited fields (the sign, the TV, the polaroid). */
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
        el.textContent = new Date(`${input.value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        this.flush();
      }
      done();
    };
    input.onblur = () => setTimeout(done, 200);
    input.focus();
    try { input.showPicker(); } catch { /* the field itself is still usable */ }
  }

  async save(finish) {
    this.checkDeadline();
    if (this.busy || !this.canEdit) return false;
    this.busy = true; this.finishing = finish;
    this.toolbar.querySelectorAll('button').forEach((b) => (b.disabled = true));
    try {
      const d = await this.repo.save(this.content, this.revision, finish);
      Object.assign(this, { revision: d.revision, finished: d.finished, canEdit: d.canEdit, editingDeadline: d.editingDeadline ?? this.editingDeadline, dirty: false });
      this.stop();
      this.toggle.hidden = !this.canEdit;
      this.generate.hidden = this.repo.mode.kind !== 'studio';
      this.modeStatus();
      this.toast?.(finish ? 'The wording is final ✨' : 'Saved ✓');
      return true;
    } catch (error) {
      if (error.status === 423) { this.finished = !!error.data.finished; this.canEdit = false; this.stop(); this.toggle.hidden = true; this.modeStatus(); }
      if (error.status === 401) this.toast?.('The studio session ended. Please reload the page.');
      this.toast?.(`Error — ${error.message}`);
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
      if (!validShareID(d.id)) throw new Error('The server sent back a broken link.');
      this.showLink?.(d.url);
    } catch (error) { this.toast?.(`Error — ${error.message}`); }
    finally { this.generating = false; this.generate.disabled = false; }
  }

  async resetDemo() {
    if (this.repo.mode.kind !== 'test') return;
    this.repo.reset();
    this.dirty = false;
    location.reload();
  }
}
