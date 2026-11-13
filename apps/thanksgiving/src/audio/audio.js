// Audio. Recorded, all CC0 (Kenney "Interface Sounds", "Music Jingles" and "RPG Audio"): the door, chimes,
// pops, plucks, the glass clink, jingles. Everything else is made live with the Web Audio API: the
// background music (an original fireside waltz on a plucked guitar and a music box, rendered once into a
// loop), the fire's crackle, applause, the wishbone's creak and SNAP, chalk on the board, the TV (a marching
// band for the parade, a stadium crowd for the game), the camera's beeps and shutter.

const BASE = import.meta.env.BASE_URL;
const BGM = 0.16;           // the music, softly under everything
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor() { this.ctx = null; this.buffers = {}; this.muted = false; this.ready = false; }

  async init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3.5;
    this.master.connect(comp).connect(ctx.destination);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, ctx.currentTime, 0.8);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.85; this.sfxBus.connect(this.master);
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this._impulse(1.6, 3);
    this.reverbSend = ctx.createGain(); this.reverbSend.gain.value = 0.35; this.reverbSend.connect(this.reverb).connect(this.master);
    this.noiseBuf = this._noise(2); this.brownBuf = this._brown(4);
    await this._loadAll();
    this._startMusic();
    this._startFire();
    this.ready = true;
  }

  setMuted(m) { this.muted = m; if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.2); }
  update() {}

  async _loadAll() {
    const files = ['pizzi_a', 'pizzi_b', 'pizzi_c', 'glass', 'pop', 'pluck', 'whoosh_up', 'chime', 'creak', 'door_open', 'page'].map((n) => `sfx_${n}`);
    await Promise.all(files.map(async (f) => {
      try { const r = await fetch(`${BASE}audio/${f}.mp3`); this.buffers[f] = await this.ctx.decodeAudioData(await r.arrayBuffer()); }
      catch (e) { console.warn('audio failed', f, e); }
    }));
  }

  sfx(name, { gain = 0.5, rate = 1, pan = 0, when = 0, verb = 0.2 } = {}) {
    const buf = this.buffers[`sfx_${name}`];
    if (!this.ctx || !buf) return null;
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(g).connect(p).connect(this.sfxBus);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; p.connect(s).connect(this.reverbSend); }
    src.start(ctx.currentTime + when);
    return src;
  }

  // ── the music: an original fireside waltz, rendered once into a seamless loop ──
  _startMusic() {
    const ctx = this.ctx;
    this.bgmBus = ctx.createGain(); this.bgmBus.gain.value = 0; this.bgmBus.connect(this.master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; lp.connect(this.bgmBus);
    this._bgmIn = lp;
    this._duck = 0;
    // render after the first frames have settled (it takes a moment of CPU)
    setTimeout(() => {
      this.loop = this._renderWaltz();
      const src = ctx.createBufferSource(); src.buffer = this.loop; src.loop = true;
      const send = ctx.createGain(); send.gain.value = 0.25;
      src.connect(lp); src.connect(send).connect(this.reverbSend);
      src.start();
      this._bgmLevel();
    }, 300);
  }
  music(mood) { this._mood = mood; this._bgmLevel(); }
  musicDuck(a) { this._duck = a; this._bgmLevel(); }
  _bgmLevel() { if (this.bgmBus) this.bgmBus.gain.setTargetAtTime(BGM * (this._mood === 'finale' ? 1.25 : 1) * (1 - this._duck), this.ctx.currentTime, 0.8); }

  /** A plucked string (Karplus–Strong): returns samples for one note. */
  _pluck(freq, sec, sr, bright = 0.5) {
    const n = Math.floor(sr * sec), out = new Float32Array(n);
    const N = Math.max(2, Math.round(sr / freq)), buf = new Float32Array(N);
    for (let i = 0; i < N; i++) buf[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * bright);
    let idx = 0;
    const damp = 0.996 - (1 - bright) * 0.004;
    for (let i = 0; i < n; i++) {
      const a = buf[idx], b = buf[(idx + 1) % N];
      out[i] = a;
      buf[idx] = (a + b) * 0.5 * damp;
      idx = (idx + 1) % N;
    }
    return out;
  }

  _renderWaltz() {
    const sr = this.ctx.sampleRate, bpm = 92, beat = 60 / bpm, bar = beat * 3;
    // G | Em | C | D | G | B7 | Em | C | G | Em | Am | D7 | G | C | D7 | G
    const chords = [[43, 55, 59, 62], [40, 52, 55, 59], [36, 52, 55, 60], [38, 50, 54, 57], [43, 55, 59, 62], [35, 51, 54, 57], [40, 52, 55, 59], [36, 52, 55, 60],
      [43, 55, 59, 62], [40, 52, 55, 59], [45, 52, 57, 60], [38, 50, 54, 60], [43, 55, 59, 62], [36, 52, 55, 60], [38, 50, 54, 60], [43, 55, 59, 62]];
    // the melody: [midi, start beat within the bar, length in beats] per bar (an original tune)
    const mel = [
      [[74, 0, 2], [71, 2, 1]], [[76, 0, 1], [74, 1, 1], [71, 2, 1]], [[72, 0, 2], [76, 2, 1]], [[74, 0, 3]],
      [[71, 0, 1], [74, 1, 1], [79, 2, 1]], [[78, 0, 2], [75, 2, 1]], [[76, 0, 1], [79, 1, 1], [76, 2, 1]], [[72, 0, 3]],
      [[67, 0, 1], [71, 1, 1], [74, 2, 1]], [[76, 0, 2], [79, 2, 1]], [[76, 0, 1], [74, 1, 1], [72, 2, 1]], [[74, 0, 3]],
      [[79, 0, 2], [78, 2, 1]], [[76, 0, 1], [74, 1, 1], [72, 2, 1]], [[71, 0, 1], [72, 1, 1], [69, 2, 1]], [[67, 0, 3]],
    ];
    const total = bar * chords.length, len = Math.ceil(total * sr);
    const L = new Float32Array(len), R = new Float32Array(len);
    const add = (samples, t, gain, pan = 0) => {
      const s0 = Math.floor(t * sr), gl = gain * (1 - pan) * 0.5 + gain * 0.5 * (pan < 0 ? 1 : 1 - pan), gr = gain * (1 + pan) * 0.5 + gain * 0.5 * (pan > 0 ? 1 : 1 + pan);
      for (let i = 0; i < samples.length; i++) { const k = (s0 + i) % len; L[k] += samples[i] * gl * 0.5; R[k] += samples[i] * gr * 0.5; }
    };
    chords.forEach((c, b) => {
      const t0 = b * bar;
      add(this._pluck(midi(c[0]), 2.2, sr, 0.35), t0, 0.5, -0.1);   // bass on the downbeat
      // the guitar: "oom-pah-pah" — the chord picked in eighths on beats two and three
      [c[1], c[2], c[3], c[2]].forEach((m, k) => add(this._pluck(midi(m), 1.4, sr, 0.55), t0 + beat * (1 + k * 0.5), 0.22, 0.25));
    });
    // the music box melody (sine with a bell-like overtone)
    mel.forEach((notes, b) => notes.forEach(([m, st, ln]) => {
      const t = b * bar + st * beat, dur = Math.min(2.2, ln * beat + 0.9), n = Math.floor(dur * sr), f = midi(m), s = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i / sr, env = Math.exp(-x * 3.2) * Math.min(1, x * 200); s[i] = (Math.sin(2 * Math.PI * f * x) + 0.28 * Math.sin(2 * Math.PI * f * 2.756 * x) * Math.exp(-x * 6)) * env; }
      add(s, t, 0.3, -0.2);
    }));
    let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const buf = this.ctx.createBuffer(2, len, sr), k = 0.85 / (peak || 1);
    const l = buf.getChannelData(0), r = buf.getChannelData(1);
    for (let i = 0; i < len; i++) { l[i] = L[i] * k; r[i] = R[i] * k; }
    return buf;
  }

  // ── the fire, crackling softly in the background ──
  _startFire() {
    const ctx = this.ctx;
    this.fireBus = ctx.createGain(); this.fireBus.gain.value = 0.05; this.fireBus.connect(this.master);
    const rumble = ctx.createBufferSource(); rumble.buffer = this.brownBuf; rumble.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const rg = ctx.createGain(); rg.gain.value = 0.5;
    rumble.connect(lp).connect(rg).connect(this.fireBus); rumble.start();
    const pop = () => {
      if (!this.ctx) return;
      this._noiseBurst({ dur: 0.02 + Math.random() * 0.03, f: 1800 + Math.random() * 3000, q: 1.5, gain: 0.25 + Math.random() * 0.6, out: this.fireBus });
      this._fireT = setTimeout(pop, 60 + Math.random() * 420);
    };
    pop();
  }
  fireLevel(v) { if (this.fireBus) this.fireBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.8); }

  // ── building blocks ──
  _noise(sec) { const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  _brown(sec) { const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } return b; }
  _impulse(sec, decay) {
    const ctx = this.ctx, len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  _noiseBurst({ dur = 0.1, f = 2000, q = 1, gain = 0.3, when = 0, type = 'bandpass', out = null, attack = 0.002 }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(out || this.sfxBus);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  _tone({ f = 440, f1 = null, dur = 0.2, type = 'sine', gain = 0.2, when = 0, out = null }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out || this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }

  // ── the evening's sounds ──
  door() { this.sfx('door_open', { gain: 0.55, verb: 0.3 }); this.sfx('creak', { gain: 0.25, rate: 0.85, when: 0.2 }); this.sfx('chime', { gain: 0.3, when: 0.5, rate: 1.2 }); }
  chalk() { for (let i = 0; i < 9; i++) this._noiseBurst({ dur: 0.06 + Math.random() * 0.08, f: 3200 + Math.random() * 2500, q: 2, gain: 0.08, when: 0.15 + i * 0.12 + Math.random() * 0.05, attack: 0.01 }); }
  erase() { for (let i = 0; i < 8; i++) this._noiseBurst({ dur: 0.14 + Math.random() * 0.06, f: 800 + Math.random() * 600, q: 0.7, gain: 0.07, when: i * 0.18, attack: 0.03 }); }
  tada() { this.sfx(['pizzi_a', 'pizzi_b', 'pizzi_c'][Math.floor(Math.random() * 3)], { gain: 0.45, verb: 0.25 }); }
  aww() { [67, 64, 60].forEach((m, i) => this._tone({ f: midi(m), dur: 0.5, type: 'triangle', gain: 0.12, when: i * 0.22 })); }
  pop(rate = 1) { this.sfx('pop', { gain: 0.35, rate }); }
  chime() { this.sfx('chime', { gain: 0.4, verb: 0.3 }); }
  click() { this.sfx('pluck', { gain: 0.3, rate: 1.4 }); }
  whoosh() { this.sfx('whoosh_up', { gain: 0.4 }); }
  clink() { this.sfx('glass', { gain: 0.45, rate: 0.95 + Math.random() * 0.15, verb: 0.3 }); }
  thump(k = 0) { this._tone({ f: 140 - k * 6, f1: 60, dur: 0.18, type: 'sine', gain: 0.35 }); this._noiseBurst({ dur: 0.05, f: 900, q: 0.8, gain: 0.08 }); }
  kick() { this._tone({ f: 120, f1: 45, dur: 0.25, gain: 0.55 }); this._noiseBurst({ dur: 0.08, f: 700, q: 0.6, gain: 0.25 }); }
  beep(n) { this._tone({ f: n === 1 ? 1320 : 880, dur: 0.16, type: 'sine', gain: 0.25 }); }
  shutter() { this._noiseBurst({ dur: 0.035, f: 3000, q: 0.7, gain: 0.5 }); this._noiseBurst({ dur: 0.05, f: 1800, q: 0.7, gain: 0.35, when: 0.07 }); this._tone({ f: 2400, f1: 1200, dur: 0.4, type: 'sine', gain: 0.05, when: 0.12 }); }
  /** The wishbone strains as they pull: little creaks. */
  creakBone(on) {
    clearInterval(this._creakT);
    if (!on || !this.ctx) return;
    this._creakT = setInterval(() => this._noiseBurst({ dur: 0.05 + Math.random() * 0.05, f: 900 + Math.random() * 900, q: 9, gain: 0.12 }), 110);
  }
  snap() {
    this._noiseBurst({ dur: 0.05, f: 2600, q: 0.8, gain: 0.9 });
    this._noiseBurst({ dur: 0.12, f: 700, q: 1.2, gain: 0.4, when: 0.01 });
    this._tone({ f: 300, f1: 90, dur: 0.15, gain: 0.3 });
  }
  /** Applause and a happy whoop. */
  cheer() {
    if (!this.ctx) return;
    for (let i = 0; i < 70; i++) {
      const w = Math.random() * 2.4, edge = Math.min(1, w / 0.4, (2.4 - w) / 0.9);
      this._noiseBurst({ dur: 0.03 + Math.random() * 0.03, f: 1200 + Math.random() * 1600, q: 1.1, gain: 0.08 + 0.18 * edge, when: w });
    }
    this.tada();
  }

  // ── the TV: a marching band for the parade, the stadium for the game ──
  tv(channel) {
    const ctx = this.ctx; if (!ctx) return;
    if (this._tv) { const old = this._tv; old.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2); setTimeout(() => old.stop(), 900); this._tv = null; }
    this.musicDuck(channel ? 0.75 : 0);
    if (!channel) return;
    const g = ctx.createGain(); g.gain.value = 0;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;   // a little TV speaker
    g.connect(bp).connect(this.master);
    const srcs = [];
    if (channel === 'parade') {
      const s = ctx.createBufferSource(); s.buffer = this._march || (this._march = this._renderMarch()); s.loop = true; s.connect(g); s.start(); srcs.push(s);
    } else {
      const s = ctx.createBufferSource(); s.buffer = this.brownBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.5;
      const sg = ctx.createGain(); sg.gain.value = 1.4;
      s.connect(f).connect(sg).connect(g); s.start(); srcs.push(s);
    }
    g.gain.setTargetAtTime(channel === 'parade' ? 0.35 : 0.25, ctx.currentTime, 0.3);
    this._tv = { g, stop: () => srcs.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } }) };
  }
  /** Eight bars of a little march (snare, bass drum, a brassy tune), rendered once. */
  _renderMarch() {
    const sr = this.ctx.sampleRate, beat = 60 / 116, len = Math.ceil(beat * 32 * sr);
    const out = new Float32Array(len);
    const hit = (t, dur, fn) => { const s0 = Math.floor(t * sr), n = Math.floor(dur * sr); for (let i = 0; i < n && s0 + i < len; i++) out[s0 + i] += fn(i / sr); };
    for (let b = 0; b < 32; b++) {
      const t = b * beat;
      if (b % 2 === 0) hit(t, 0.25, (x) => Math.sin(2 * Math.PI * (70 - x * 80) * x) * Math.exp(-x * 14) * 0.9);
      hit(t + beat * (b % 2 ? 0 : 0.5), 0.12, (x) => (Math.random() * 2 - 1) * Math.exp(-x * 28) * 0.35);
      if (b % 4 === 3) for (let r = 0; r < 4; r++) hit(t + beat * (0.25 + r * 0.18), 0.06, (x) => (Math.random() * 2 - 1) * Math.exp(-x * 40) * 0.25);
    }
    const tune = [67, 72, 76, 79, 76, 72, 74, 71, 67, 71, 74, 79, 77, 74, 72, 72];
    tune.forEach((m, k) => {
      const f = midi(m - 12), t = k * beat * 2;
      hit(t, beat * 1.8, (x) => { const env = Math.min(1, x * 30) * Math.exp(-x * 1.4); let s = 0; for (let h = 1; h <= 6; h++) s += Math.sin(2 * Math.PI * f * h * x) / h; return s * env * 0.28; });
    });
    let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
    const buf = this.ctx.createBuffer(1, len, sr); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = out[i] / (peak || 1) * 0.8;
    return buf;
  }
}
