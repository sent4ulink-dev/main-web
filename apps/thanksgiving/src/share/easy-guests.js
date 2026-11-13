// The editor's family step: everyone invited (name, man or woman, adult or child), how each one is doing,
// the two settings (can guests see who's coming; the potluck and its dishes) — and dressing anyone up. The live
// preview shows the family at the table as the list changes, then whoever is being dressed, standing in the
// dressing corner, changing with every tap. The list saves itself a moment after each change; a look, too.
import { CATEGORIES, HAIRS, OUTFITS, BOTTOMS, HATS, GLASSES, BEARDS, allowed, fitLook } from '../party/looks.js';
import { LOOK, MOST_GUESTS, NAME_MAX, DISH_MAX, MOST_DISHES } from './guests-core.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STYLE = `
.ez-gl-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-family:var(--ez-mono);font-size:11.5px;color:var(--ez-soft);margin-bottom:8px}
.ez-gr{display:grid;grid-template-columns:1fr auto;gap:7px;padding:10px 0;border-top:1px solid var(--ez-line)}
.ez-gr:first-of-type{border-top:0;padding-top:2px}
.ez .ez-gr input[type=text]{padding:9px 11px}
.ez .ez-gx{width:40px;border:1px solid var(--ez-line)!important;border-radius:3px;color:var(--ez-soft)!important}
.ez-gline{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ez-seg{display:inline-flex;border:1px solid var(--ez-line);border-radius:3px;overflow:hidden}
.ez .ez-seg button{padding:7px 10px;font-size:12.5px;color:var(--ez-soft)!important}.ez-seg button.on{background:var(--ez-acc-soft)!important;color:var(--ez-ink)!important;font-weight:600}
.ez .ez-dress{padding:7px 11px;border:1px solid var(--ez-acc)!important;border-radius:3px;color:var(--ez-ink)!important;font-size:12.5px;font-weight:600;margin-left:auto}
.ez-tag{font-family:var(--ez-mono);font-size:10.5px;color:var(--ez-soft);padding:2px 6px;border:1px solid var(--ez-line);border-radius:3px}
.ez-tag.yes{color:var(--ez-ok);border-color:rgba(95,201,152,.4)}.ez-tag.no{color:var(--ez-warn);border-color:rgba(255,146,112,.4)}
.ez .ez-mini{font-size:11.5px;color:var(--ez-soft)!important;text-decoration:underline;text-underline-offset:2px}
.ez-gadd{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ez-gadd .ez-btn{min-height:38px;padding:7px 13px;font-size:13.5px}
.ez-gpaste{margin-top:8px}
.ez-toggle{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 0}
.ez-toggle span{font-size:14px}.ez-toggle small{display:block;color:var(--ez-soft);font-size:12px}
.ez .ez-sw{flex:none;width:44px;height:26px;border-radius:13px;background:var(--ez-line)!important;position:relative}
.ez-sw::after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:var(--ez-ink);transition:transform .2s}
.ez-sw[aria-checked=true]{background:var(--ez-acc)!important}.ez-sw[aria-checked=true]::after{transform:translateX(18px)}
.ez-dishes{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 8px}
.ez-dishes span{display:inline-flex;align-items:center;gap:4px;padding:4px 4px 4px 9px;border:1px solid var(--ez-line);border-radius:3px;font-size:12.5px}
.ez .ez-dishes button{width:22px;height:22px;color:var(--ez-soft)!important}
.ez-dadd{display:flex;gap:7px}.ez-dadd input{flex:1;min-width:0}.ez-dadd .ez-btn{min-height:0}
.ez-dr-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.ez-dr-top b{flex:1;font-family:var(--ez-serif);font-style:italic;font-size:24px;line-height:1.1;font-weight:600}
.ez-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px}.ez-tabs::-webkit-scrollbar{display:none}
.ez .ez-tab{flex:none;padding:6px 10px;border:1px solid var(--ez-line)!important;border-radius:3px;font-family:var(--ez-mono);font-size:11.5px;color:var(--ez-soft)!important}
.ez .ez-tab.on{border-color:var(--ez-acc)!important;color:var(--ez-ink)!important;background:var(--ez-acc-soft)!important}
.ez-opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:7px;margin-top:10px}
.ez .ez-opt{display:grid;justify-items:center;gap:3px;padding:9px 4px 7px;border:1px solid var(--ez-line)!important;border-radius:3px;font-size:11.5px;line-height:1.2;color:var(--ez-soft)!important}
.ez .ez-opt .em{font-size:24px;line-height:1}
.ez .ez-opt.on{border-color:var(--ez-acc)!important;background:var(--ez-acc-soft)!important;color:var(--ez-ink)!important;font-weight:600}
.ez-sws{display:flex;flex-wrap:wrap;gap:9px;margin-top:12px}
.ez .ez-swatch{width:40px;height:40px;border-radius:50%;border:2px solid rgba(243,239,231,.25)!important}
.ez .ez-swatch.on{border-color:var(--ez-ink)!important;box-shadow:0 0 0 2px var(--ez-acc)}
.ez-dr-foot{display:flex;gap:8px;margin-top:14px}.ez-dr-foot .ez-btn{flex:1}
`;

/** The editor field (type 'custom') for the guest list and dressing up. `live`: the live preview; `roster`: the card's guest list. */
export function guestsField({ roster, live, crops = {} }) {
  if (!document.getElementById('ez-guests-style')) { const s = document.createElement('style'); s.id = 'ez-guests-style'; s.textContent = STYLE; document.head.append(s); }
  return { type: 'custom', mount: (el, ctx) => new GuestList(el, ctx, { roster, live, crops }) };
}

class GuestList {
  constructor(el, ctx, { roster, live, crops }) {
    Object.assign(this, { el, ctx, roster, live, crops });
    this.rows = roster.guests.map((g) => ({ id: g.id, name: g.name, sex: g.sex, age: g.age }));
    this.party = JSON.parse(JSON.stringify(roster.party));
    this.dressing = null; this.tab = 'hair';
    this.listDue = false; this.saving = null;
    el.addEventListener('click', (e) => this._click(e));
    el.addEventListener('input', (e) => this._input(e));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.field === 'newdish') { e.preventDefault(); this._addDish(); } });
    this._render();
  }

  // ── saving ──
  /** The list goes to the server a moment after the last change (new people get their ids back). */
  _later(ms = 1100) { this.listDue = true; this.ctx.status('Not saved yet…'); clearTimeout(this._t); this._t = setTimeout(() => this._saveList(), ms); }
  async _saveList() {
    clearTimeout(this._t);
    if (this.saving) { await this.saving; if (!this.listDue) return true; }
    if (!this.listDue) return true;
    this.listDue = false;
    // (a name being retyped is never a removal: someone already on the list keeps their last name meanwhile)
    const sent = this.rows.filter((r) => r.name.trim() || r.id);
    this.ctx.status('Saving…');
    this.saving = (async () => {
      try {
        await this.roster.saveList(sent.map((r) => ({ ...(r.id ? { id: r.id } : {}), name: (r.name.trim() || this.roster.byId(r.id)?.name || 'Guest').slice(0, NAME_MAX), sex: r.sex, age: r.age })), this.party);
        this.roster.guests.forEach((g, i) => { if (sent[i]) sent[i].id = g.id; });   // (same order as sent)
        this.live.guests(this.roster.guests, this.roster.party);
        this.ctx.status('Saved ✓', 'ok');
        if (!this.dressing) this._renderStatus();
        return true;
      } catch (e) { this.listDue = true; this.ctx.status(`Couldn’t save the list: ${e.message}`, 'bad'); return false; }
      finally { this.saving = null; }
    })();
    return this.saving;
  }
  /** A look, saved a moment after the last tap. */
  _lookLater() { this.ctx.status('Not saved yet…'); clearTimeout(this._lt); this._lt = setTimeout(() => this._saveLook(), 700); }
  async _saveLook() {
    clearTimeout(this._lt);
    const d = this.dressing; if (!d?.due) return true;
    d.due = false;
    try { await this.roster.update(d.id, { look: d.look }); this.ctx.status('Saved ✓', 'ok'); return true; }
    catch (e) { d.due = true; this.ctx.status(`Couldn’t save the look: ${e.message}`, 'bad'); return false; }
  }
  /** Everything waiting goes now (the step changes, or the editor closes). */
  async flush() {
    const look = await this._saveLook(), list = await this._saveList();
    return look && list;
  }

  // ── the list ──
  _status(r) {
    const g = r.id ? this.roster.byId(r.id) : null;
    if (!g) return r.name.trim() ? '<span class="ez-tag">New</span>' : '';
    const ans = g.rsvp === 'yes' ? '<span class="ez-tag yes">✓ Coming</span>' : g.rsvp === 'no' ? '<span class="ez-tag no">✗ Can’t come</span>' : '<span class="ez-tag">No answer yet</span>';
    const phone = g.claimed ? '<span class="ez-tag">📱 Joined</span>' : '';
    const dish = g.dish && this.party.potluck ? `<span class="ez-tag">🥧 ${esc(g.dish)}</span>` : '';
    const free = g.claimed ? `<button type="button" class="ez-mini" data-act="free">Free the name</button>` : '';
    const clear = g.rsvp ? `<button type="button" class="ez-mini" data-act="clear">Clear the answer</button>` : '';
    return ans + phone + dish + free + clear;
  }
  _renderStatus() { this.el.querySelectorAll('.ez-gr').forEach((row) => { const s = row.querySelector('[data-st]'); if (s) s.innerHTML = this._status(this.rows[+row.dataset.i]); }); this._renderCount(); }
  _renderCount() { const c = this.roster.counts, n = this.el.querySelector('[data-count]'); if (n) n.textContent = `${this.rows.length} / ${MOST_GUESTS} · ${c.yes} coming · ${c.no} can’t · ${c.waiting} waiting`; }

  _render() {
    if (this.dressing) return this._renderDresser();
    const rows = this.rows.map((r, i) => `
      <div class="ez-gr" data-i="${i}">
        <input type="text" maxlength="${NAME_MAX}" value="${esc(r.name)}" placeholder="Name, e.g. Aunt Carol" aria-label="Name" data-field="name" autocomplete="off">
        <button type="button" class="ez-gx" data-act="remove" aria-label="Remove ${esc(r.name)}">✕</button>
        <div class="ez-gline">
          <span class="ez-seg" role="group" aria-label="Man or woman"><button type="button" class="${r.sex === 'f' ? 'on' : ''}" data-set="sex" data-v="f">Woman</button><button type="button" class="${r.sex === 'm' ? 'on' : ''}" data-set="sex" data-v="m">Man</button></span>
          <span class="ez-seg" role="group" aria-label="Adult or child"><button type="button" class="${r.age === 'adult' ? 'on' : ''}" data-set="age" data-v="adult">Adult</button><button type="button" class="${r.age === 'child' ? 'on' : ''}" data-set="age" data-v="child">Child</button></span>
          <button type="button" class="ez-dress" data-act="dress">👕 Dress up</button>
        </div>
        <div class="ez-gline" data-st>${this._status(r)}</div>
      </div>`).join('');
    const dishes = this.party.dishes.map((d, i) => `<span>${esc(d)}<button type="button" data-act="undish" data-d="${i}" aria-label="Remove ${esc(d)}">✕</button></span>`).join('');
    this.el.innerHTML = `
      <div class="ez-gl-top"><span data-count></span></div>
      <div class="ez-grs">${rows || '<p class="ez-help">No one yet. Add the first person.</p>'}</div>
      <div class="ez-gadd"><button type="button" class="ez-btn dark" data-act="add"${this.rows.length >= MOST_GUESTS ? ' disabled' : ''}>＋ Add a person</button><button type="button" class="ez-btn" data-act="paste-open">Paste a list…</button></div>
      <div class="ez-gpaste" hidden><textarea rows="4" placeholder="One name per line, e.g. “Aunt Carol” or “Max, child”"></textarea><div class="ez-gadd"><button type="button" class="ez-btn dark" data-act="paste">Add these names</button></div></div>
      <section class="ez-card"><h4>Settings</h4>
        <div class="ez-toggle"><span>Guests can see who’s coming<small>Everyone’s yes or no, and the headcount. Off: only you see the answers.</small></span><button type="button" class="ez-sw" role="switch" aria-checked="${this.party.showAnswers}" data-act="toggle" data-key="showAnswers" aria-label="Guests can see who's coming"></button></div>
        <div class="ez-toggle"><span>Potluck sign-up<small>Each guest picks one dish to bring (no five pies!).</small></span><button type="button" class="ez-sw" role="switch" aria-checked="${this.party.potluck}" data-act="toggle" data-key="potluck" aria-label="Potluck sign-up"></button></div>
        ${this.party.potluck ? `<div class="ez-dishes">${dishes}</div><div class="ez-dadd"><input type="text" maxlength="${DISH_MAX}" placeholder="Add a dish, e.g. Deviled eggs" aria-label="Add a dish" data-field="newdish"><button type="button" class="ez-btn" data-act="dish"${this.party.dishes.length >= MOST_DISHES ? ' disabled' : ''}>Add</button></div>` : ''}
      </section>`;
    this._renderCount();
  }

  _input(e) {
    const row = e.target.closest('.ez-gr');
    if (row && e.target.dataset.field === 'name') { this.rows[+row.dataset.i].name = e.target.value; this._later(1400); }
  }
  _addDish() {
    const inp = this.el.querySelector('[data-field="newdish"]'), v = inp?.value.trim();
    if (v && !this.party.dishes.some((d) => d.toLowerCase() === v.toLowerCase()) && this.party.dishes.length < MOST_DISHES) { this.party.dishes.push(v.slice(0, DISH_MAX)); this._later(); }
    this._render(); this.el.querySelector('[data-field="newdish"]')?.focus();
  }

  async _click(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (this.dressing) return this._dressClick(b);
    const row = b.closest('.ez-gr'), i = row ? +row.dataset.i : -1, r = this.rows[i], act = b.dataset.act;
    if (b.dataset.set && r) { r[b.dataset.set] = b.dataset.v; this._later(500); this._render(); return; }
    if (act === 'add') {
      if (this.rows.length >= MOST_GUESTS) return;
      this.rows.push({ id: null, name: '', sex: 'f', age: 'adult' }); this._render();
      const inputs = this.el.querySelectorAll('.ez-gr input'); inputs[inputs.length - 1]?.focus();
      return;
    }
    if (act === 'remove' && r) {
      const g = r.id && this.roster.byId(r.id);
      if (g && (g.claimed || g.rsvp) && !confirm(`Remove ${g.name}? Their character and answer will be gone.`)) return;
      this.rows.splice(i, 1); this._later(500); this._render(); return;
    }
    if (act === 'paste-open') { const w = this.el.querySelector('.ez-gpaste'); w.hidden = !w.hidden; w.querySelector('textarea').focus(); return; }
    if (act === 'paste') {
      const lines = this.el.querySelector('.ez-gpaste textarea').value.split(/\n|;/).map((l) => l.trim()).filter(Boolean);
      for (const l of lines) {
        if (this.rows.length >= MOST_GUESTS) break;
        const child = /,\s*(child|kid|boy|girl)\b/i.test(l), boy = /\b(boy|uncle|grandpa|mr\.?|son|brother|dad)\b/i.test(l);
        this.rows.push({ id: null, name: l.replace(/,\s*(child|kid|boy|girl|adult)\b/i, '').slice(0, NAME_MAX).trim(), sex: boy ? 'm' : 'f', age: child ? 'child' : 'adult' });
      }
      this._later(400); this._render(); return;
    }
    if (act === 'toggle') { const k = b.dataset.key; this.party[k] = !this.party[k]; this._later(400); this._render(); return; }
    if (act === 'dish') return this._addDish();
    if (act === 'undish') { this.party.dishes.splice(+b.dataset.d, 1); this._later(500); this._render(); return; }
    if ((act === 'free' || act === 'clear') && r?.id) {
      const g = this.roster.byId(r.id); if (!g) return;
      if (!confirm(act === 'free' ? `Free ${g.name}’s name? Then it can be picked again (from a new phone).` : `Clear ${g.name}’s answer? They’ll be able to answer again.`)) return;
      try { await this.roster.update(g.id, act === 'free' ? { unlock: true } : { rsvp: null }); this.live.guests(this.roster.guests, this.roster.party); this.ctx.status(act === 'free' ? 'The name is free again ✓' : 'Answer cleared ✓', 'ok'); this._renderStatus(); }
      catch (err) { this.ctx.status(`Couldn’t do that: ${err.message}`, 'bad'); }
      return;
    }
    if (act === 'dress' && r) {
      if (!r.name.trim()) { this.ctx.status('Write their name first', 'bad'); row.querySelector('input').focus(); return; }
      // a new person is saved first (they need their place on the list to be dressed)
      if (!r.id || this.listDue) { this.listDue = true; if (!await this._saveList() || !r.id) return; }
      const g = this.roster.byId(r.id); if (!g) return;
      this.dressing = { id: g.id, name: g.name, sex: g.sex, look: fitLook(this.roster.lookOf(g), g.sex), due: false };
      this.ctx.preview({ scene: 'dress', sub: g.id, crop: this.crops.dress });
      this._render();
      this.el.scrollIntoView({ block: 'start' });
    }
  }

  // ── dressing someone up ──
  _cats() { return CATEGORIES.filter((c) => !c.sex || c.sex === this.dressing.sex); }
  _renderDresser() {
    const d = this.dressing, cats = this._cats(), cat = cats.find((c) => c.key === this.tab) || cats[0];
    this.tab = cat.key;
    const tabs = cats.map((c) => `<button type="button" class="ez-tab${c.key === cat.key ? ' on' : ''}" data-tab="${c.key}">${esc(c.label)}</button>`).join('');
    const opts = cat.swatches
      ? `<div class="ez-sws">${cat.swatches.map((hex, i) => `<button type="button" class="ez-swatch${d.look[cat.key] === i ? ' on' : ''}" data-pick="${i}" style="background:${hex}" aria-label="${esc(cat.label)} ${i + 1}"></button>`).join('')}</div>`
      : `<div class="ez-opts">${cat.options.map((o, i) => (allowed(cat.options, i, d.sex) ? `<button type="button" class="ez-opt${d.look[cat.key] === i ? ' on' : ''}" data-pick="${i}"><span class="em" aria-hidden="true">${o.icon}</span>${esc(o.label)}</button>` : '')).join('')}</div>`;
    this.el.innerHTML = `<div class="ez-dr-top"><b>Dressing ${esc(d.name)}</b><button type="button" class="ez-mini" data-act="back">‹ The list</button></div>
      <div class="ez-tabs" role="tablist">${tabs}</div>${opts}
      <div class="ez-dr-foot"><button type="button" class="ez-btn" data-act="random">🎲 Surprise me</button><button type="button" class="ez-btn main" data-act="done">✓ Done</button></div>`;
    this.el.querySelector('.ez-tab.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  _rand(list) { const ok = list.map((_, i) => i).filter((i) => allowed(list, i, this.dressing.sex)); return ok[Math.floor(Math.random() * ok.length)]; }
  _show() { this.live.look(this.dressing.id, this.dressing.look); this.dressing.due = true; this._lookLater(); }
  async _dressClick(b) {
    const d = this.dressing;
    if (b.dataset.tab) { this.tab = b.dataset.tab; this._renderDresser(); return; }
    if (b.dataset.pick != null) {
      d.look[this.tab] = +b.dataset.pick; this._show();
      this.el.querySelectorAll('[data-pick]').forEach((x) => x.classList.toggle('on', x === b));
      return;
    }
    if (b.dataset.act === 'random') {
      const r = (n) => Math.floor(Math.random() * n), m = d.sex === 'm';
      d.look = {
        ...d.look, hair: this._rand(HAIRS), hairColor: r(LOOK.hairColor), outfit: this._rand(OUTFITS), outfitColor: r(LOOK.outfitColor),
        pants: this._rand(BOTTOMS), pantsColor: r(LOOK.pantsColor), hat: Math.random() < 0.5 ? this._rand(HATS) : 0,
        glasses: Math.random() < 0.35 ? this._rand(GLASSES) : 0, beard: m && Math.random() < 0.6 ? this._rand(BEARDS) : 0,
      };
      this._show(); this._renderDresser(); return;
    }
    if (b.dataset.act === 'done' || b.dataset.act === 'back') {
      await this._saveLook();
      this.dressing = null;
      this.ctx.preview(null);
      this._render();
    }
  }
}
