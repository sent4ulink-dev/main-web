// Life at the table: while the family sits, nobody is a mannequin — people turn to the ones beside or
// across from them and chat (the other nods, or laughs), reach for their plate and eat, look round the
// table. The story picks the mood: 'table' (dinner as usual), 'listen' (everyone attends to one person —
// the thankful round, the wishbone — with the odd nod or bite), or 'off'.
// People the story is busy with (standing, walking, speaking, waving hello) are left alone: `a.scripted`.

const pickOf = (list) => list[Math.floor(Math.random() * list.length)];

export class TableLife {
  constructor(world) {
    this.world = world;
    this.mode = 'off';
    this.state = new Map();     // actor → { until, kind, partner }
  }

  /** Who is free to live their life: seated, visible, not in the story's hands. */
  _free() { return [...this.world.actors.values()].filter((a) => a.visible && !a.away && !a.scripted && a.pose === 'sit' && !a.path); }

  setMode(mode) {
    if (mode === this.mode) return;
    const was = this.mode;
    this.mode = mode;
    // leaving dinner: everyone settles (the story sets what comes next)
    for (const [a, st] of this.state) {
      if (a.scripted || a.away) continue;
      if (was === 'table' || mode === 'off') { if (st.kind === 'talk' || st.kind === 'listen') a.lookAt = null; a.play('idle'); }
    }
    this.state.clear();
  }

  _end(a) {
    const st = this.state.get(a);
    if (st && this.mode === 'table' && (st.kind === 'talk' || st.kind === 'listen' || st.kind === 'look')) a.lookAt = null;
    if (!a.scripted && !a.away && a.anim !== 'walk') a.play('idle');
    this.state.delete(a);
  }

  /** Two people chat: one talks, the other listens (nods, laughs), then maybe they swap. */
  _chat(a, b, now) {
    const len = 2.4 + Math.random() * 3.2;
    a.lookAt = b.headPoint(); b.lookAt = a.headPoint();
    a.play('talk'); b.play(Math.random() < 0.55 ? 'nod' : 'idle');
    this.state.set(a, { until: now + len, kind: 'talk', partner: b });
    this.state.set(b, { until: now + len + 0.3, kind: 'listen', partner: a, laughAt: now + len * (0.5 + Math.random() * 0.4) });
  }

  _neighbours(a, free) {
    const z = a.home?.z ?? a.pos.z;
    return free.filter((b) => b !== a && !this.state.has(b) && Math.abs((b.home?.z ?? b.pos.z) - z) < 0.75);
  }

  update(t) {
    if (this.mode === 'off') return;
    const free = this._free();
    for (const [a] of this.state) if (!free.includes(a)) this.state.delete(a);
    for (const a of free) {
      const st = this.state.get(a);
      if (st) {
        if (st.laughAt && t > st.laughAt && this.mode === 'table') { st.laughAt = 0; if (Math.random() < 0.6) a.play('laugh'); }
        if (t < st.until) continue;
        if (st.kind === 'rest') this.state.delete(a);   // (rested: on to something new, below)
        else {
          const swap = st.kind === 'talk' && st.partner && this.state.get(st.partner)?.partner === a && Math.random() < 0.45;
          this._end(a);
          if (swap) { this._end(st.partner); this._chat(st.partner, a, t); continue; }
          this.state.set(a, { until: t + 0.4 + Math.random() * 1.6, kind: 'rest' });
          continue;
        }
      }
      if (this.mode === 'listen') {
        // attending to someone: now and then a nod, or a quiet bite
        const r = Math.random();
        if (r < 0.25) { a.play('nod'); this.state.set(a, { until: t + 1.2 + Math.random(), kind: 'nod' }); }
        else if (r < 0.4) { a.play('eat'); this.state.set(a, { until: t + 3.4, kind: 'eat' }); }
        else this.state.set(a, { until: t + 1.5 + Math.random() * 3, kind: 'rest' });
        continue;
      }
      const r = Math.random();
      if (r < 0.34) {
        const b = pickOf(this._neighbours(a, free));
        if (b) { this._chat(a, b, t); continue; }
      }
      if (r < 0.7) { a.play('eat'); this.state.set(a, { until: t + 3.4 * (1 + Math.floor(Math.random() * 2)), kind: 'eat' }); continue; }
      if (r < 0.82) {
        // a look round the table (at someone further along, or across)
        const b = pickOf(free.filter((x) => x !== a));
        if (b) { a.lookAt = b.headPoint(); this.state.set(a, { until: t + 1.5 + Math.random() * 2, kind: 'look' }); continue; }
      }
      this.state.set(a, { until: t + 1 + Math.random() * 2.5, kind: 'rest' });
    }
  }
}
