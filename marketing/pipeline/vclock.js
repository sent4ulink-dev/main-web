// Virtual clock for frame-by-frame capture: page time only moves when window.__step(ms) is called, so a heavy 3D
// card renders every frame perfectly no matter how slowly the machine draws it.
(() => {
  let vt = 0; const base = Date.UTC(2026, 9, 31, 18, 0, 0);
  const rafs = new Map(); let rafId = 1; const timers = new Map(); let tId = 1; const RealDate = Date;
  performance.now = () => vt;
  window.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(base + vt); } static now() { return base + vt; } };
  window.requestAnimationFrame = (cb) => { const id = rafId++; rafs.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => rafs.delete(id);
  window.setTimeout = (cb, ms = 0, ...args) => { const id = tId++; timers.set(id, { at: vt + Math.max(0, +ms || 0), cb, args }); return id; };
  window.clearTimeout = (id) => timers.delete(id);
  window.setInterval = (cb, ms = 0, ...args) => { const id = tId++; const e = Math.max(1, +ms || 1); timers.set(id, { at: vt + e, cb, args, every: e }); return id; };
  window.clearInterval = (id) => timers.delete(id);
  window.__now = () => vt;
  window.__step = (ms) => {
    const end = vt + ms;
    for (let guard = 0; guard < 500; guard++) {
      let next = null, nid = null;
      for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next.at)) { next = t; nid = id; }
      if (!next) break;
      vt = Math.max(vt, next.at);
      if (next.every) next.at += next.every; else timers.delete(nid);
      try { typeof next.cb === 'function' ? next.cb(...next.args) : (0, eval)(next.cb); } catch (e) { console.error(e); }
    }
    vt = end;
    const cbs = [...rafs.values()]; rafs.clear();
    for (const cb of cbs) { try { cb(vt); } catch (e) { console.error(e); } }
  };
})();
