import { CATEGORIES, HAIRS, OUTFITS, BOTTOMS, HATS, GLASSES, BEARDS, allowed, fitLook } from './looks.js';
import { LOOK } from '../share/guests-core.js';

// The dress-up dock along the bottom of the screen: tabs (hair, hair colour, skin, top, its colour,
// bottoms, their colour, hat, glasses, beard) and their choices — every tap changes the character at once.
// Each person only sees what's for them (the host said man or woman). "Surprise me" rolls a random outfit;
// Done saves.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class DressUp {
  constructor(el) {
    this.el = el;
    this.tab = 'hair';
    el.addEventListener('click', (e) => this._click(e));
  }

  get isOpen() { return !this.el.hidden; }

  open({ look, sex = 'f', onChange = () => {}, onDone = () => {}, onCancel = null, doneLabel = 'Looking good — done' }) {
    this.sex = sex;
    this.look = fitLook(look, sex); this.start = { ...this.look };
    Object.assign(this, { onChange, onDone, onCancel, doneLabel });
    if (!this._cats().some((c) => c.key === this.tab)) this.tab = 'hair';
    this.el.hidden = false;
    document.body.classList.add('dressing');
    this._render();
  }

  close() { this.el.hidden = true; document.body.classList.remove('dressing'); }

  _cats() { return CATEGORIES.filter((c) => !c.sex || c.sex === this.sex); }

  _render() {
    const cats = this._cats();
    const cat = cats.find((c) => c.key === this.tab) || cats[0];
    const tabs = cats.map((c) => `<button type="button" class="dock-tab${c.key === cat.key ? ' on' : ''}" data-tab="${c.key}">${esc(c.label)}</button>`).join('');
    let opts;
    if (cat.swatches) opts = cat.swatches.map((hex, i) => `<button type="button" class="swatch${this.look[cat.key] === i ? ' on' : ''}" data-set="${cat.key}" data-i="${i}" style="background:${hex}" aria-label="${esc(cat.label)} ${i + 1}"></button>`).join('');
    else opts = cat.options.map((o, i) => (allowed(cat.options, i, this.sex) ? `<button type="button" class="opt${this.look[cat.key] === i ? ' on' : ''}" data-set="${cat.key}" data-i="${i}"><span class="em" aria-hidden="true">${o.icon}</span>${esc(o.label)}</button>` : '')).join('');
    this.el.innerHTML = `<div class="dock-tabs" role="tablist">${tabs}</div><div class="dock-opts">${opts}</div>
      <div class="dock-row"><button type="button" class="btn-float small" data-act="random"><span class="spark" aria-hidden="true">🎲</span> Surprise me</button>${this.onCancel ? '<button type="button" class="btn-float small" data-act="cancel">Cancel</button>' : ''}<button type="button" class="btn-float primary small" data-act="done"><span class="spark" aria-hidden="true">✓</span> ${esc(this.doneLabel)}</button></div>`;
    const on = this.el.querySelector('.dock-opts .on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  /** A random pick from the choices that are this person's. */
  _rand(list) { const ok = list.map((_, i) => i).filter((i) => allowed(list, i, this.sex)); return ok[Math.floor(Math.random() * ok.length)]; }

  _click(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tab) { this.tab = b.dataset.tab; this._render(); return; }
    if (b.dataset.set) {
      this.look[b.dataset.set] = +b.dataset.i;
      this.onChange({ ...this.look }, b.dataset.set);
      for (const x of this.el.querySelectorAll(`[data-set="${b.dataset.set}"]`)) x.classList.toggle('on', x === b);
      return;
    }
    if (b.dataset.act === 'random') {
      const r = (n) => Math.floor(Math.random() * n), m = this.sex === 'm';
      this.look = {
        ...this.look, hair: this._rand(HAIRS), hairColor: r(LOOK.hairColor), outfit: this._rand(OUTFITS), outfitColor: r(LOOK.outfitColor),
        pants: this._rand(BOTTOMS), pantsColor: r(LOOK.pantsColor), hat: Math.random() < 0.5 ? this._rand(HATS) : 0,
        glasses: Math.random() < 0.35 ? this._rand(GLASSES) : 0, beard: m && Math.random() < 0.6 ? this._rand(BEARDS) : 0,
      };
      this.onChange({ ...this.look }, 'random');
      this._render();
      return;
    }
    if (b.dataset.act === 'cancel') { this.onChange({ ...this.start }, 'cancel'); this.close(); this.onCancel?.(); return; }
    if (b.dataset.act === 'done') { this.close(); this.onDone({ ...this.look }); }
  }
}
