import { MOST_GUESTS, NAME_MAX, DISH_MAX, MOST_DISHES } from '../share/guests-core.js';

// The host's guest list: everyone invited (name, man or woman, adult or child), how each one is doing
// (joined from their phone? coming? bringing what?), freeing a name or clearing an answer when needed, and
// the two settings — can guests see who's coming, and is there a potluck (with its list of dishes).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class HostPanel {
  constructor(sheet, roster, { toast = () => {}, onDress = () => {}, onSaved = () => {} } = {}) {
    Object.assign(this, { sheet, roster, toast, onDress, onSaved });
    this.panel = sheet.querySelector('.guests-panel');
    this.panel.addEventListener('click', (e) => this._click(e));
    this.panel.addEventListener('input', (e) => this._input(e));
    sheet.addEventListener('click', (e) => { if (e.target === sheet) this.close(); });
  }

  open() {
    // a working copy: saved people keep their id; new ones have none yet
    this.rows = this.roster.guests.map((g) => ({ id: g.id, name: g.name, sex: g.sex, age: g.age }));
    this.party = JSON.parse(JSON.stringify(this.roster.party));
    this.dirty = false;
    this.sheet.hidden = false;
    this._render();
    if (!this.rows.length) this.panel.querySelector('[data-act="add"]')?.focus();
  }
  close(force = false) {
    if (!force && this.dirty && !confirm('Close without saving the guest list?')) return;
    this.sheet.hidden = true;
  }

  _status(row) {
    const g = row.id ? this.roster.byId(row.id) : null;
    if (!g) return '<span class="tag">New — save to invite</span>';
    const ans = g.rsvp === 'yes' ? '<span class="tag yes">✓ Coming</span>' : g.rsvp === 'no' ? '<span class="tag no">✗ Can’t come</span>' : '<span class="tag">… No answer yet</span>';
    const phone = g.claimed ? '<span class="tag">📱 Joined</span>' : '<span class="tag">Not joined yet</span>';
    const dish = g.dish && this.party.potluck ? `<span class="tag">🥧 ${esc(g.dish)}</span>` : '';
    const btns = [
      `<button type="button" data-act="dress" data-id="${g.id}">👕 Dress up</button>`,
      g.claimed ? `<button type="button" data-act="free" data-id="${g.id}">Free the name</button>` : '',
      g.rsvp ? `<button type="button" data-act="clear" data-id="${g.id}">Clear answer</button>` : '',
    ].join('');
    return ans + phone + dish + btns;
  }

  _render() {
    const c = this.roster.counts;
    const rows = this.rows.map((r, i) => `
      <div class="gp-row" data-i="${i}">
        <input type="text" maxlength="${NAME_MAX}" value="${esc(r.name)}" placeholder="Name" aria-label="Name" data-field="name">
        <span class="seg" role="group" aria-label="Man or woman"><button type="button" class="${r.sex === 'm' ? 'on' : ''}" data-set="sex" data-v="m" aria-label="Man">♂</button><button type="button" class="${r.sex === 'f' ? 'on' : ''}" data-set="sex" data-v="f" aria-label="Woman">♀</button></span>
        <span class="seg" role="group" aria-label="Adult or child"><button type="button" class="${r.age === 'adult' ? 'on' : ''}" data-set="age" data-v="adult">Adult</button><button type="button" class="${r.age === 'child' ? 'on' : ''}" data-set="age" data-v="child">Child</button></span>
        <button type="button" class="gp-x" data-act="remove" aria-label="Remove ${esc(r.name)}">✕</button>
        <div class="gp-status">${this._status(r)}</div>
      </div>`).join('');
    const dishes = this.party.dishes.map((d, i) => `<span>${esc(d)}<button type="button" data-act="undish" data-i="${i}" aria-label="Remove ${esc(d)}">✕</button></span>`).join('');
    this.panel.innerHTML = `
      <button class="icon-btn close" data-act="close" aria-label="Close">✕</button>
      <h2 class="display">Guest list</h2>
      <p class="lede">Add everyone you’re inviting (up to ${MOST_GUESTS}). On the guest link each person taps their own name — “This is me” — then dresses up their character and answers yes or no.</p>
      <div class="gp-section"><h3>${c.invited} invited · ${c.yes} coming · ${c.no} can’t · ${c.waiting} waiting</h3>
        <div class="gp-rows">${rows || '<p class="lede">No one yet — add your first guest.</p>'}</div>
        <div class="gp-add"><button type="button" class="btn-float small" data-act="add"${this.rows.length >= MOST_GUESTS ? ' disabled' : ''}>＋ Add a person</button><button type="button" class="btn-float small" data-act="paste-open">Paste a list…</button></div>
        <div class="gp-paste-wrap" hidden><textarea class="gp-paste" placeholder="One name per line (e.g. “Aunt Carol” or “Max, child”)"></textarea><div class="gp-add"><button type="button" class="btn-float small primary" data-act="paste">Add these names</button></div></div>
      </div>
      <div class="gp-section"><h3>Settings</h3>
        <div class="toggle"><span>Guests can see who’s coming<small>Everyone’s yes / no and the headcount. Off: only you see the answers.</small></span><button type="button" class="switch" role="switch" aria-checked="${this.party.showAnswers}" data-act="toggle" data-key="showAnswers" aria-label="Guests can see who's coming"></button></div>
        <div class="toggle"><span>Potluck sign-up<small>Each guest picks one dish to bring — no five pies!</small></span><button type="button" class="switch" role="switch" aria-checked="${this.party.potluck}" data-act="toggle" data-key="potluck" aria-label="Potluck sign-up"></button></div>
        ${this.party.potluck ? `<div class="dish-edit">${dishes}</div><div class="dish-add"><input type="text" maxlength="${DISH_MAX}" placeholder="Add a dish (e.g. Deviled eggs)" aria-label="Add a dish" data-field="newdish"><button type="button" class="btn-float small" data-act="dish"${this.party.dishes.length >= MOST_DISHES ? ' disabled' : ''}>Add</button></div>` : ''}
      </div>
      <div class="gp-foot"><span class="gp-count">${this.rows.length} / ${MOST_GUESTS}</span><button type="button" class="btn-float small" data-act="close">Close</button><button type="button" class="btn-float small primary" data-act="save">Save guest list</button></div>`;
  }

  _input(e) {
    const row = e.target.closest('.gp-row');
    if (row && e.target.dataset.field === 'name') { this.rows[+row.dataset.i].name = e.target.value; this.dirty = true; }
  }

  async _click(e) {
    const b = e.target.closest('button'); if (!b) return;
    const row = b.closest('.gp-row'), i = row ? +row.dataset.i : -1, act = b.dataset.act;
    if (b.dataset.set && i >= 0) { this.rows[i][b.dataset.set] = b.dataset.v; this.dirty = true; this._render(); return; }
    if (act === 'close') return this.close();
    if (act === 'add') {
      if (this.rows.length >= MOST_GUESTS) return;
      this.rows.push({ id: null, name: '', sex: 'f', age: 'adult' }); this.dirty = true; this._render();
      const inputs = this.panel.querySelectorAll('.gp-row input'); inputs[inputs.length - 1]?.focus();
      return;
    }
    if (act === 'remove' && i >= 0) {
      const g = this.rows[i].id && this.roster.byId(this.rows[i].id);
      if (g && (g.claimed || g.rsvp) && !confirm(`Remove ${g.name}? Their character and answer will be gone.`)) return;
      this.rows.splice(i, 1); this.dirty = true; this._render(); return;
    }
    if (act === 'paste-open') { const w = this.panel.querySelector('.gp-paste-wrap'); w.hidden = !w.hidden; w.querySelector('textarea').focus(); return; }
    if (act === 'paste') {
      const lines = this.panel.querySelector('.gp-paste').value.split(/\n|;/).map((l) => l.trim()).filter(Boolean);
      for (const l of lines) {
        if (this.rows.length >= MOST_GUESTS) break;
        const child = /,\s*(child|kid|boy|girl)\b/i.test(l), boy = /\b(boy|uncle|grandpa|mr\.?|son|brother|dad)\b/i.test(l);
        this.rows.push({ id: null, name: l.replace(/,\s*(child|kid|boy|girl|adult)\b/i, '').slice(0, NAME_MAX).trim(), sex: boy ? 'm' : 'f', age: child ? 'child' : 'adult' });
      }
      this.dirty = true; this._render(); return;
    }
    if (act === 'toggle') { const k = b.dataset.key; this.party[k] = !this.party[k]; this.dirty = true; this._render(); return; }
    if (act === 'dish') {
      const inp = this.panel.querySelector('[data-field="newdish"]'), v = inp.value.trim();
      if (v && !this.party.dishes.some((d) => d.toLowerCase() === v.toLowerCase()) && this.party.dishes.length < MOST_DISHES) { this.party.dishes.push(v.slice(0, DISH_MAX)); this.dirty = true; }
      this._render(); this.panel.querySelector('[data-field="newdish"]')?.focus(); return;
    }
    if (act === 'undish') { this.party.dishes.splice(+b.dataset.i, 1); this.dirty = true; this._render(); return; }
    if (act === 'free' || act === 'clear') {
      const g = this.roster.byId(b.dataset.id); if (!g) return;
      const msg = act === 'free' ? `Free ${g.name}’s name? Then it can be picked again (from a new phone).` : `Clear ${g.name}’s answer? They’ll be able to answer again.`;
      if (!confirm(msg)) return;
      try { await this.roster.update(g.id, act === 'free' ? { unlock: true } : { rsvp: null }); this.toast(act === 'free' ? 'The name is free again' : 'Answer cleared'); this._render(); }
      catch (err) { this.toast(`Couldn’t do that — ${err.message}`); }
      return;
    }
    if (act === 'dress') { if (this.dirty && !confirm('Leave without saving the list?')) return; this.close(true); this.onDress(b.dataset.id); return; }
    if (act === 'save') {
      const roster = this.rows.map((r) => ({ ...(r.id ? { id: r.id } : {}), name: r.name.trim(), sex: r.sex, age: r.age })).filter((r) => r.name);
      b.disabled = true; b.textContent = 'Saving…';
      try {
        await this.roster.saveList(roster, this.party);
        this.dirty = false; this.close(true); this.toast('Guest list saved ✓'); this.onSaved();
      } catch (err) { this.toast(`Couldn’t save — ${err.message}`); b.disabled = false; b.textContent = 'Save guest list'; }
    }
  }
}
