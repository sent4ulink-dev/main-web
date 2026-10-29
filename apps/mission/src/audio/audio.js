// Audio: recorded CC0 fireworks; everything else synthesised live with the Web Audio API (nothing sampled from
// any game) — desert wind and birds, rifle shots with a courtyard slap-back, brass casings, case latches and the
// reel's ticks, the party timer's beeps, pins, smoke hiss, the flash's pop and ring, the radio's squelch and
// crackle, and an upbeat chiptune "Happy Birthday" (public-domain melody).

const BASE = import.meta.env.BASE_URL;

/** RBJ biquad over a Float32Array (offline use). */
function biquad(x, type, f, q, sr) {
  const w = 2 * Math.PI * f / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lowpass') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === 'highpass') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let k = 0; k < x.length; k++) {
    const x0 = x[k], y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0; x[k] = y0;
  }
  return x;
}
const AMBIENCE = 0.12;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.muted = false;
    this.ready = false;
  }

  async init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, ctx.currentTime, 0.8);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = AMBIENCE; this.ambBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.0; this.musicBus.connect(this.master);
    // the courtyard: short, bright stone reflections
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(1.6, 3.2);
    this.reverbSend = ctx.createGain(); this.reverbSend.gain.value = 0.4;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.noiseBuf = this._noise(2);
    await this._loadAll();
    this._startWind();
    this._startBirds();
    this._guns();   // render the gunshots now, not on the first trigger pull
    this.ready = true;
  }

  async _loadAll() {
    const files = ['fw_01', 'fw_02', 'fw_03', 'fw_04', 'fw_05', 'fw_06', 'bang_02', 'bang_05', 'fw_loop'];
    await Promise.all(files.map(async (f) => {
      try {
        const r = await fetch(`${BASE}audio/${f}.mp3`);
        this.buffers[f] = await this.ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) { console.warn('audio failed', f, e); }
    }));
  }

  _noise(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  _impulse(sec, decay) {
    const ctx = this.ctx, len = ctx.sampleRate * sec;
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < ctx.sampleRate * 0.03 ? 0.3 : 1);
    }
    return b;
  }

  /** Desert wind: filtered noise breathing slowly in and out. */
  _startWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.22;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.12;
    lfo.connect(lg).connect(g.gain);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.11;
    const lg2 = ctx.createGain(); lg2.gain.value = 180;
    lfo2.connect(lg2).connect(lp.frequency);
    src.connect(lp).connect(g).connect(this.ambBus);
    src.start(); lfo.start(); lfo2.start();
  }

  /** A few birds now and then (quick falling chirps). */
  _startBirds() {
    const chirp = () => {
      if (this.ctx.state === 'running' && !this.night) {
        const n = 2 + Math.floor(Math.random() * 4), f = 2600 + Math.random() * 1600, pan = (Math.random() - 0.5) * 1.4;
        for (let i = 0; i < n; i++) this._sweep(f, f * 0.7, { dur: 0.07, gain: 0.025, when: i * 0.11, pan, out: this.ambBus });
      }
      this._birdT = setTimeout(chirp, 2500 + Math.random() * 6000);
    };
    chirp();
  }

  update() {}

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.15);
  }

  /** Dusk falls: the birds go quiet. */
  setNight(on) { this.night = on; }

  /**
   * Play a recorded voice message. radio: through a walkie-talkie filter with a crackle bed and squelch.
   * Resolves when it ends.
   */
  playVoice(url, { radio = false } = {}) {
    this.stopVoice();
    const el = new Audio();
    el.preload = 'auto'; el.playsInline = true; el.src = url;
    this.voiceEl = el;
    let bed = null;
    try {
      if (this.ctx) {
        const src = this.ctx.createMediaElementSource(el);
        if (radio) {
          const ctx = this.ctx;
          const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380;
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
          const ws = ctx.createWaveShaper(); ws.curve = this._drive(2.2);
          const g = ctx.createGain(); g.gain.value = 1.3;
          src.connect(hp).connect(lp).connect(ws).connect(g).connect(this.master);
          bed = this._crackle(0.03);
          this.squelch();
        } else src.connect(this.master);
      }
    } catch { /* plays directly */ }
    this.duckAmbience(0.6, 0.8);
    const ended = new Promise((resolve) => { el.onended = resolve; el.onerror = resolve; el._stop = resolve; });
    el.play().catch(() => el._stop());
    return ended.then(() => {
      if (bed) { bed.stop(); if (this.voiceEl === el) this.squelch(); }
      if (this.voiceEl === el) { this.voiceEl = null; this.duckAmbience(0, 2); }
    });
  }
  stopVoice() {
    const el = this.voiceEl; if (!el) return;
    this.voiceEl = null; el.pause(); el._stop?.(); this.duckAmbience(0, 2);
  }

  _drive(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
    return c;
  }

  /** A crackling static bed (for the radio); returns { stop }. */
  _crackle(gain = 0.03) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start();
    const pops = setInterval(() => { if (Math.random() < 0.5) this._noiseBurst({ dur: 0.01 + Math.random() * 0.02, type: 'highpass', f0: 3000, f1: 2000, gain: 0.05 + Math.random() * 0.08, reverb: 0 }); }, 90);
    return { stop: () => { clearInterval(pops); g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); setTimeout(() => src.stop(), 600); } };
  }

  duckAmbience(amount, time = 1) {
    if (!this.ctx) return;
    this.ambBus.gain.setTargetAtTime(AMBIENCE * (1 - amount), this.ctx.currentTime, time / 3);
  }

  // ── synthesised one-shots ─────────────────────────────

  _noiseBurst({ dur = 0.3, type = 'bandpass', f0 = 2000, f1 = 2000, q = 1, gain = 0.3, attack = 0.005, when = 0, pan = 0, reverb = 0.1, out = null }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(f).connect(g).connect(p);
    p.connect(out || this.sfxBus);
    if (reverb) { const s = ctx.createGain(); s.gain.value = reverb; p.connect(s).connect(this.reverbSend); }
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  _tone(freq, { dur = 1.2, gain = 0.15, when = 0, type = 'sine', partials = null, out = null, pan = 0, attack = 0.003, reverb = 0.5 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p).connect(out || this.sfxBus);
    if (reverb) { const send = ctx.createGain(); send.gain.value = reverb; p.connect(send).connect(this.reverbSend); }
    for (const [mul, amp, decay] of (partials || [[1, 1, 1]])) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq * mul;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(amp, t); pg.gain.exponentialRampToValueAtTime(0.0001, t + dur * decay);
      o.connect(pg).connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }

  _sweep(f0, f1, { dur = 0.2, gain = 0.1, when = 0, type = 'sine', pan = 0, out = null, reverb = 0.2 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(g).connect(p).connect(out || this.sfxBus);
    if (reverb) { const s = ctx.createGain(); s.gain.value = reverb; p.connect(s).connect(this.reverbSend); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ── the courtyard ────────────────────────────────────
  paper() {
    for (let i = 0; i < 6; i++) this._noiseBurst({ dur: 0.06 + Math.random() * 0.08, f0: 2500 + Math.random() * 2500, f1: 1800, q: 0.9, gain: 0.12 + Math.random() * 0.1, when: i * 0.07 + Math.random() * 0.04, pan: (Math.random() - 0.5) * 0.4 });
    this._noiseBurst({ dur: 0.6, f0: 1200, f1: 3500, q: 0.6, gain: 0.07, when: 0.3 });
  }
  click() { this._noiseBurst({ dur: 0.025, type: 'highpass', f0: 2500, f1: 2500, gain: 0.25, reverb: 0 }); this._tone(180, { dur: 0.05, gain: 0.1, type: 'triangle', reverb: 0 }); }
  sparkle() {
    const notes = [1046.5, 1318.5, 1568, 2093, 1760, 2637];
    notes.forEach((f, i) => this._tone(f, { dur: 1.4, gain: 0.045, when: i * 0.08, partials: [[1, 1, 1], [2.01, 0.25, 0.4]], pan: (i % 2 ? 0.3 : -0.3) }));
  }
  chime() { this._tone(784, { dur: 1.1, gain: 0.05, partials: [[1, 1, 1], [2, 0.2, 0.5]] }); this._tone(1175, { dur: 1.2, gain: 0.04, when: 0.08 }); }
  blow(strength = 1) { this._noiseBurst({ dur: 0.9, type: 'lowpass', f0: 1800, f1: 400, q: 0.5, gain: 0.25 * strength, attack: 0.05 }); }
  pop() { this._noiseBurst({ dur: 0.18, type: 'bandpass', f0: 1200, f1: 300, q: 1.5, gain: 0.3 }); }
  magic() {
    const notes = [523.3, 659.3, 784, 1046.5, 1318.5, 1568, 2093];
    notes.forEach((f, i) => this._tone(f, { dur: 2, gain: 0.04, when: i * 0.1, attack: 0.03, partials: [[1, 1, 1], [2.0, 0.35, 0.6]], pan: Math.sin(i * 1.3) * 0.5 }));
  }

  // ── gunfire: rendered once into buffers from layered DSP (blast, crack, chest boom, mechanism, close-wall
  //    reflections, soft clipping), then played through a stone-courtyard reverb. Synthesised from scratch. ──

  /** Render one shot into a mono AudioBuffer. */
  _renderShot({ len = 0.45, blastTau = 0.012, crackTau = 0.004, crack = 0.9, boomF0 = 200, boomF1 = 55, boomTau = 0.06, boom = 0.8, bodyF = 650, bodyTau = 0.05, mech = 0.018, mechGain = 0.12, drive = 2.2, refl = [[0.009, 0.32], [0.017, 0.22], [0.027, 0.16], [0.041, 0.1]], seed = 1 }) {
    const sr = this.ctx.sampleRate, N = Math.ceil(len * sr);
    let st = seed * 9973 + 7; const rnd = () => { st = (st * 16807) % 2147483647; return st / 1073741823.5 - 1; };
    const white = () => { const a = new Float32Array(N); for (let k = 0; k < N; k++) a[k] = rnd(); return a; };
    const env = (k, tau, att = 0.0004) => { const t = k / sr; return t < att ? t / att : Math.exp(-(t - att) / tau); };
    const blast = biquad(biquad(white(), 'lowpass', 7000, 0.7, sr), 'highpass', 180, 0.7, sr);
    const crackN = biquad(white(), 'highpass', 2600, 0.8, sr);
    const bodyN = biquad(white(), 'bandpass', bodyF, 0.9, sr);
    const out = new Float32Array(N);
    let ph = 0;
    for (let k = 0; k < N; k++) {
      const t = k / sr;
      const f = boomF1 + (boomF0 - boomF1) * Math.exp(-t / 0.025);
      ph += 2 * Math.PI * f / sr;
      out[k] = blast[k] * env(k, blastTau) * 1.0
        + crackN[k] * env(k, crackTau, 0.0002) * crack
        + Math.sin(ph) * env(k, boomTau, 0.001) * boom
        + bodyN[k] * env(k, bodyTau) * 0.9;
    }
    if (mech) {   // the action cycling: a metallic clack a moment after the blast
      const m0 = Math.floor(mech * sr);
      for (let k = m0; k < N; k++) {
        const t = (k - m0) / sr, e = Math.exp(-t / 0.009);
        out[k] += (Math.sin(2 * Math.PI * 2750 * t) * 0.5 + Math.sin(2 * Math.PI * 4150 * t) * 0.35 + Math.sin(2 * Math.PI * 6020 * t) * 0.2 + rnd() * 0.6 * Math.exp(-t / 0.002)) * e * mechGain;
      }
    }
    // the courtyard's nearest walls answer within a few milliseconds (darker each time)
    const dry = Float32Array.from(out), dark = biquad(Float32Array.from(dry), 'lowpass', 2500, 0.7, sr);
    for (const [d, g] of refl) { const o = Math.floor(d * sr); for (let k = o; k < N; k++) out[k] += dark[k - o] * g * (rnd() > 0 ? 1 : -0.6); }
    // soft clipping (a real shot overloads everything), then normalise
    let peak = 0;
    const td = Math.tanh(drive);
    for (let k = 0; k < N; k++) { out[k] = Math.tanh(out[k] * drive) / td; peak = Math.max(peak, Math.abs(out[k])); }
    const b = this.ctx.createBuffer(1, N, sr), d = b.getChannelData(0);
    for (let k = 0; k < N; k++) d[k] = out[k] / (peak || 1) * 0.95 * Math.min(1, (N - k) / (sr * 0.02));
    return b;
  }

  /** A stone courtyard: dense early reflections, then a bright tail that darkens as it dies. */
  _yardIR(sec = 1.8) {
    const sr = this.ctx.sampleRate, N = Math.floor(sr * sec), b = this.ctx.createBuffer(2, N, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let k = 0; k < N; k++) {
        const t = k / sr, a = 0.85 - 0.75 * Math.min(1, t / sec);   // high frequencies fade first
        lp += a * ((Math.random() * 2 - 1) - lp);
        d[k] = lp * Math.exp(-t / 0.42) * (t < 0.006 ? 0 : 0.6);
      }
      for (const [tt, g] of [[0.011, 0.9], [0.019, 0.7], [0.026, 0.75], [0.034, 0.55], [0.047, 0.5], [0.061, 0.4], [0.083, 0.32], [0.11, 0.25], [0.15, 0.18]]) {
        const o = Math.floor((tt + (c ? 0.0017 : 0)) * sr);
        for (let q = 0; q < 24; q++) d[o + q] += g * (q % 2 ? -0.5 : 1) * Math.exp(-q / 6);
      }
    }
    return b;
  }

  _guns() {
    if (this._gunBufs) return this._gunBufs;
    const ctx = this.ctx;
    this.gunVerb = ctx.createConvolver(); this.gunVerb.buffer = this._yardIR();
    this.gunVerbSend = ctx.createGain(); this.gunVerbSend.gain.value = 0.55;
    this.gunVerbSend.connect(this.gunVerb).connect(this.master);
    this._gunBufs = {
      ak: [0, 1, 2, 3].map((k) => this._renderShot({ seed: k + 1, boomF0: 190 + k * 12, boomF1: 52 + k * 3, blastTau: 0.011 + k * 0.001, bodyF: 600 + k * 60 })),
      sniper: this._renderShot({ len: 1.1, blastTau: 0.032, crackTau: 0.007, crack: 1.2, boomF0: 170, boomF1: 33, boomTau: 0.2, boom: 1.1, bodyF: 420, bodyTau: 0.11, mech: 0, drive: 3.0, refl: [[0.012, 0.35], [0.024, 0.25], [0.04, 0.18], [0.07, 0.12]], seed: 9 }),
    };
    return this._gunBufs;
  }

  _playBuf(buf, { gain = 1, pan = 0, rate = 1, verb = 0.5, when = 0, lowpass = 0 } = {}) {
    if (!this.ctx || !buf) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    let node = src;
    if (lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; node.connect(f); node = f; }
    const g = ctx.createGain(); g.gain.value = gain;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    node.connect(g).connect(p).connect(this.sfxBus);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; p.connect(s).connect(this.gunVerbSend); }
    src.start(t);
  }

  /** One rifle round (an AK-style rifle firing full auto): blast, crack, boom, the bolt carrier, the walls. */
  gunshot({ pan = 0.25, gain = 1 } = {}) {
    if (!this.ctx) return;
    const g = this._guns();
    this._playBuf(g.ak[Math.floor(Math.random() * g.ak.length)], { gain: 0.62 * gain, pan, rate: 0.96 + Math.random() * 0.08, verb: 0.55 });
  }
  /** (kept for compatibility) */
  sniper() { this.sniperShot(); }
  /** Shouldering the rifle and leaning into the scope: cloth, a soft click of the eyepiece. */
  scopeIn() {
    this._noiseBurst({ dur: 0.35, type: 'bandpass', f0: 800, f1: 1600, q: 1.2, gain: 0.08, attack: 0.08 });
    this._noiseBurst({ dur: 0.03, type: 'highpass', f0: 3500, f1: 3000, gain: 0.12, when: 0.9, reverb: 0 });
    this._tone(1200, { dur: 0.05, gain: 0.03, type: 'triangle', when: 0.9, reverb: 0 });
  }
  /**
   * The big bolt-action rifle: a hard supersonic crack and a deep, long boom, the courtyard ringing, then the
   * report coming back off the far walls and the desert (darker, later). (Synthesised from scratch.)
   */
  sniperShot() {
    if (!this.ctx) return;
    const g = this._guns();
    this.duckAmbience(0.95, 0.05); setTimeout(() => this.duckAmbience(0, 2.5), 900);
    this._playBuf(g.sniper, { gain: 1.0, verb: 0.9 });
    this._playBuf(g.sniper, { gain: 0.22, when: 0.31, lowpass: 900, pan: -0.45, verb: 0.6, rate: 0.97 });
    this._playBuf(g.sniper, { gain: 0.1, when: 0.78, lowpass: 600, pan: 0.5, verb: 0.5, rate: 0.95 });
    this._playBuf(g.sniper, { gain: 0.05, when: 1.5, lowpass: 400, pan: -0.2, verb: 0.4, rate: 0.93 });
  }
  /** Working the bolt: lift, pull back (the case pings off the deck), push forward, lock down. */
  bolt() {
    const metal = (w, f, g, decay = 0.05) => {
      this._noiseBurst({ dur: 0.02, type: 'highpass', f0: 3500, f1: 2500, gain: g * 1.2, when: w, reverb: 0.1 });
      this._tone(f, { dur: decay, gain: g * 0.35, type: 'triangle', when: w, partials: [[1, 1, 1], [1.47, 0.6, 0.7], [2.23, 0.35, 0.5]], reverb: 0.15, attack: 0.0008 });
    };
    metal(0, 1900, 0.3);                                                                   // lift
    this._noiseBurst({ dur: 0.13, type: 'bandpass', f0: 2600, f1: 1400, q: 2.5, gain: 0.16, when: 0.08, reverb: 0.1 });   // slide back
    metal(0.22, 1500, 0.34, 0.07);                                                         // hits the stop
    this._tone(4200, { dur: 0.18, gain: 0.05, type: 'triangle', when: 0.5, partials: [[1, 1, 1], [1.52, 0.5, 0.6]], reverb: 0.25 });   // the case on the planks
    this._tone(3600, { dur: 0.12, gain: 0.03, type: 'triangle', when: 0.66, reverb: 0.25 });
    this._noiseBurst({ dur: 0.11, type: 'bandpass', f0: 1400, f1: 2700, q: 2.5, gain: 0.16, when: 0.42, reverb: 0.1 });   // forward
    metal(0.55, 1800, 0.36); metal(0.66, 2400, 0.32);                                    // chamber, lock down
  }
  /** A brass casing on stone. */
  tink(n = 1) {
    const f = 3800 + Math.random() * 1600;
    this._tone(f, { dur: 0.12 / n, gain: 0.04 / n, type: 'triangle', partials: [[1, 1, 1], [1.52, 0.5, 0.7]], pan: 0.4 + Math.random() * 0.3, reverb: 0.15 });
  }
  /** Two heavy latches. */
  latch() {
    for (const w of [0, 0.16]) { this._noiseBurst({ dur: 0.04, type: 'bandpass', f0: 1800, f1: 900, q: 2, gain: 0.35, when: w, reverb: 0.2 }); this._tone(240, { dur: 0.07, gain: 0.12, type: 'triangle', when: w, reverb: 0 }); }
    this._noiseBurst({ dur: 0.7, type: 'bandpass', f0: 300, f1: 900, q: 3, gain: 0.06, when: 0.35 });
  }
  /** Something inside the case wants out: a metallic rattle over a rising hum. */
  rattle() {
    for (let i = 0; i < 14; i++) this._noiseBurst({ dur: 0.03, type: 'bandpass', f0: 900 + Math.random() * 600, f1: 600, q: 3, gain: 0.08 + i * 0.012, when: i * 0.07 + Math.random() * 0.02, reverb: 0.1 });
    this._sweep(70, 160, { dur: 1.2, gain: 0.12, type: 'sawtooth', reverb: 0.2 });
  }
  /** The lid blasts open: a deep whump, a bright whoosh, a shimmer. */
  blast() {
    this._sweep(120, 35, { dur: 0.5, gain: 0.55, reverb: 0.4 });
    this._noiseBurst({ dur: 0.6, type: 'lowpass', f0: 2500, f1: 200, q: 0.5, gain: 0.45, attack: 0.002, reverb: 0.6 });
    this._noiseBurst({ dur: 0.9, type: 'highpass', f0: 3000, f1: 8000, q: 0.4, gain: 0.08, attack: 0.05, reverb: 0.7, when: 0.05 });
    [784, 988, 1175, 1568].forEach((f, i) => this._tone(f, { dur: 1.4, gain: 0.04, when: 0.1 + i * 0.05, type: 'triangle' }));
  }
  /** The reel passing a card. */
  tick() { this._noiseBurst({ dur: 0.018, type: 'highpass', f0: 3500, f1: 3000, gain: 0.22, reverb: 0 }); this._tone(1900, { dur: 0.03, gain: 0.03, type: 'square', reverb: 0 }); }
  /** The gold card lands. */
  legendary() {
    [523.3, 659.3, 784, 1046.5, 1318.5, 1568, 2093].forEach((f, i) => this._tone(f, { dur: 1.8, gain: 0.05, when: i * 0.06, type: 'triangle', partials: [[1, 1, 1], [2, 0.3, 0.5]] }));
    this._noiseBurst({ dur: 1.6, type: 'highpass', f0: 5000, f1: 9000, q: 0.4, gain: 0.05, attack: 0.3, reverb: 0.6 });
    this._sweep(110, 55, { dur: 0.6, gain: 0.3, reverb: 0.2 });
  }
  /** The charge's piezo: a hard, bright chirp with a click, hurrying as time runs out. */
  beep(urgency = 0) {
    this._noiseBurst({ dur: 0.008, type: 'highpass', f0: 5000, f1: 5000, gain: 0.12, reverb: 0 });
    this._tone(3150, { dur: 0.085 - urgency * 0.03, gain: 0.07, type: 'square', reverb: 0.08, attack: 0.001 });
    this._tone(6300, { dur: 0.05, gain: 0.012, type: 'sine', reverb: 0, attack: 0.001 });
  }
  /** A rubber key: a dull click and a short confirmation tone. */
  keyBeep(low = false) {
    this._noiseBurst({ dur: 0.02, type: 'bandpass', f0: 1800, f1: 1200, q: 2, gain: 0.25, reverb: 0 });
    this._tone(low ? 900 : 2400, { dur: 0.06, gain: 0.05, type: 'square', reverb: 0, attack: 0.001 });
  }
  /** Wrong code: a harsh double buzz. */
  buzzer() {
    for (const w of [0, 0.22]) {
      this._tone(170, { dur: 0.18, gain: 0.12, type: 'sawtooth', when: w, reverb: 0.05 });
      this._tone(340, { dur: 0.18, gain: 0.05, type: 'square', when: w, reverb: 0 });
    }
  }
  /** Defused: a relay clunks, three rising beeps, the electronics power down. */
  defused() {
    this._noiseBurst({ dur: 0.05, type: 'bandpass', f0: 700, f1: 400, q: 2, gain: 0.35, reverb: 0.1 });
    this._tone(110, { dur: 0.08, gain: 0.15, type: 'triangle', reverb: 0 });
    [1600, 2100, 2800].forEach((f, i) => this._tone(f, { dur: 0.09, gain: 0.07, type: 'square', when: 0.15 + i * 0.12, reverb: 0.05, attack: 0.001 }));
    this._sweep(1400, 120, { dur: 0.9, gain: 0.05, type: 'sine', reverb: 0.1 });
  }
  /** The confetti canisters fire: three compressed-air thumps and the paper rush. */
  cannons() {
    for (let i = 0; i < 3; i++) {
      this._sweep(150, 45, { dur: 0.22, gain: 0.45, when: i * 0.11, reverb: 0.3 });
      this._noiseBurst({ dur: 0.35, type: 'lowpass', f0: 3000, f1: 400, q: 0.6, gain: 0.4, attack: 0.002, when: i * 0.11, pan: (i - 1) * 0.3, reverb: 0.4 });
    }
    this._noiseBurst({ dur: 1.6, type: 'highpass', f0: 2500, f1: 5000, q: 0.4, gain: 0.06, attack: 0.1, when: 0.3, reverb: 0.5 });
  }
  whoosh() { this._noiseBurst({ dur: 0.45, type: 'bandpass', f0: 300, f1: 1400, q: 2.5, gain: 0.12, attack: 0.15 }); }
  pin() { this._tone(2600, { dur: 0.25, gain: 0.05, partials: [[1, 1, 1], [2.7, 0.4, 0.5]], reverb: 0.2 }); this._noiseBurst({ dur: 0.03, type: 'highpass', f0: 4000, f1: 3000, gain: 0.15, when: 0.12, reverb: 0 }); }
  clink() { this._tone(1700 + Math.random() * 300, { dur: 0.15, gain: 0.06, type: 'triangle', partials: [[1, 1, 1], [2.4, 0.6, 0.5]], reverb: 0.3 }); }
  hiss(sec = 4) { this._noiseBurst({ dur: sec, type: 'highpass', f0: 2600, f1: 1800, q: 0.5, gain: 0.07, attack: 0.25, reverb: 0.3 }); }
  /** The flash: a pop, then a soft high ring that fades (kept gentle on the ears). */
  flashbang() {
    this._noiseBurst({ dur: 0.5, type: 'lowpass', f0: 3000, f1: 200, q: 0.5, gain: 0.6, attack: 0.002, reverb: 0.9 });
    this._sweep(160, 40, { dur: 0.3, gain: 0.5, reverb: 0.3 });
    this._tone(3520, { dur: 3.2, gain: 0.035, attack: 0.08, reverb: 0 });
    this._tone(3530, { dur: 3.0, gain: 0.02, attack: 0.08, pan: 0.3, reverb: 0 });
    this.duckAmbience(0.9, 0.2); setTimeout(() => this.duckAmbience(0, 3), 1500);
  }
  squelch() { this._noiseBurst({ dur: 0.22, type: 'bandpass', f0: 1800, f1: 1400, q: 1, gain: 0.12, reverb: 0 }); this._tone(1050, { dur: 0.08, gain: 0.05, type: 'square', when: 0.18, reverb: 0 }); }

  /**
   * The radio's song: "Happy Birthday" (public domain) as a bright chiptune — square lead, bass, chord stabs and a
   * kick/hat groove — looping until stopped. onNote(midi, seconds) fires with every melody note.
   */
  playConcert(onNote = () => {}) {
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;
    const ctx = this.ctx;
    this.musicBus.gain.cancelScheduledValues(ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(0.8, ctx.currentTime, 0.2);
    this.duckAmbience(0.5, 1.5);
    this.squelch();
    const B = 0.4;                      // seconds per beat
    const t0 = ctx.currentTime + 0.35;
    const mel = [[-1, 72, 0.75], [-0.25, 72, 0.25], [0, 74, 1], [1, 72, 1], [2, 77, 1], [3, 76, 2], [5, 72, 0.75], [5.75, 72, 0.25],
      [6, 74, 1], [7, 72, 1], [8, 79, 1], [9, 77, 2], [11, 72, 0.75], [11.75, 72, 0.25], [12, 84, 1], [13, 81, 1], [14, 77, 1],
      [15, 76, 1], [16, 74, 1], [17, 82, 0.75], [17.75, 82, 0.25], [18, 81, 1], [19, 77, 1], [20, 79, 1], [21, 77, 3]];
    const chords = [[0, [65, 69, 72], 41], [3, [64, 67, 72], 48], [6, [64, 67, 70], 48], [9, [65, 69, 72], 41], [12, [65, 69, 75], 41], [15, [65, 70, 74], 46], [18, [65, 69, 72], 41], [20, [64, 67, 70], 48], [21, [65, 69, 72], 41]];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const out = this.musicBus;
    const voice = (m, at, dur, { type = 'square', gain = 0.05, cutoff = 2600 } = {}) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz(m);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff, at); lp.frequency.exponentialRampToValueAtTime(cutoff * 0.4, at + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + 0.008); g.gain.setValueAtTime(gain * 0.8, at + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(lp).connect(g).connect(out);
      o.start(at); o.stop(at + dur + 0.05);
    };
    const drum = (at, kind) => {
      if (kind === 'k') {
        const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, at); o.frequency.exponentialRampToValueAtTime(40, at + 0.12);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.5, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
        o.connect(g).connect(out); o.start(at); o.stop(at + 0.2);
      } else {
        const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
        const f = ctx.createBiquadFilter(); f.type = kind === 's' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 's' ? 1800 : 7000;
        const g = ctx.createGain(); const d = kind === 's' ? 0.14 : 0.04;
        g.gain.setValueAtTime(kind === 's' ? 0.28 : 0.08, at); g.gain.exponentialRampToValueAtTime(0.0001, at + d);
        s.connect(f).connect(g).connect(out); s.start(at, Math.random()); s.stop(at + d + 0.02);
      }
    };
    this._noteTimers = [];
    const loopLen = 25 * B;   // pickup + 8 bars of 3
    const lead = (start, octave) => {
      for (const [b, m, d] of mel) {
        const at = start + (b + 1) * B;
        voice(m + octave, at, d * B * 0.92, { gain: 0.055 });
        voice(m + octave + 12, at, d * B * 0.6, { type: 'triangle', gain: 0.018, cutoff: 5000 });
        const id = setTimeout(() => onNote(m, d * B), Math.max(0, (at - ctx.currentTime) * 1000));
        this._noteTimers.push(id);
      }
      for (const [b, notes, bass] of chords) {
        const at = start + (b + 1) * B;
        const len = b === 21 ? 3 : (chords.find((c) => c[0] > b)?.[0] ?? 24) - b;
        for (let k = 0; k < len; k++) {
          voice(bass - 12 + (k % 2 ? 7 : 0), at + k * B, B * 0.8, { type: 'triangle', gain: 0.12, cutoff: 900 });
          if (k > 0 || len === 1) for (const n of notes) voice(n - 12, at + k * B + B * 0.02, B * 0.35, { gain: 0.016, cutoff: 1800 });
        }
      }
      for (let k = 0; k < 25; k++) {
        const at = start + k * B;
        drum(at, k % 3 === 1 ? 'k' : (k % 3 === 0 ? 's' : 'h'));
        drum(at + B / 2, 'h');
      }
    };
    lead(t0, 0); lead(t0 + loopLen, 12);
    this._musicTimer = setTimeout(() => { this.musicPlaying = false; this.playConcert(onNote); }, (t0 + loopLen * 2 - ctx.currentTime) * 1000);
  }

  stopConcert() {
    if (!this.ctx) return;
    clearTimeout(this._musicTimer);
    for (const id of this._noteTimers || []) clearTimeout(id);
    this._noteTimers = [];
    if (this.musicPlaying) this.squelch();
    this.musicPlaying = false;
    this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    this.duckAmbience(0, 2);
    const old = this.musicBus;
    setTimeout(() => old.disconnect(), 1500);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0; this.musicBus.connect(this.master);
  }

  /** Recorded CC0 firework, delayed by the speed of sound and panned by direction. */
  firework({ distance = 120, pan = 0, big = false }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const keys = big ? ['bang_02', 'bang_05', 'fw_04'] : ['fw_01', 'fw_02', 'fw_03', 'fw_05', 'fw_06'];
    const buf = this.buffers[keys[Math.floor(Math.random() * keys.length)]];
    if (!buf) return;
    const delay = distance / 343;
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = 0.85 + Math.random() * 0.25;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(1800, 9000 - distance * 40);
    const g = ctx.createGain(); g.gain.value = Math.min(1.1, 90 / distance) * (big ? 1 : 0.8);
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-0.9, Math.min(0.9, pan));
    src.connect(lp).connect(g).connect(p).connect(this.sfxBus);
    const s = ctx.createGain(); s.gain.value = 0.6; p.connect(s).connect(this.reverbSend);
    src.start(ctx.currentTime + delay);
  }

  startCrackle() {
    if (!this.ctx || !this.buffers.fw_loop || this._crackleLoop) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.buffers.fw_loop; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.18, this.ctx.currentTime, 2);
    src.connect(g).connect(this.sfxBus); src.start();
    this._crackleLoop = { src, g };
  }
  stopCrackle() {
    if (!this._crackleLoop) return;
    this._crackleLoop.g.gain.setTargetAtTime(0, this.ctx.currentTime, 1);
    const c = this._crackleLoop; setTimeout(() => c.src.stop(), 4000);
    this._crackleLoop = null;
  }

  // ── microphone: blow out the candles ─────────────────
  async startMic() {
    if (!this.ctx) await this.init();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    this.micStream = stream;
    const src = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    src.connect(this.analyser); // not connected to speakers: nothing is played back or recorded
    this.micData = new Float32Array(this.analyser.fftSize);
    this.blowTime = 0;
  }

  micLevel(dt) {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.micData);
    let sum = 0;
    for (let i = 0; i < this.micData.length; i++) sum += this.micData[i] * this.micData[i];
    const rms = Math.sqrt(sum / this.micData.length);
    const level = Math.min(1, Math.max(0, (rms - 0.02) / 0.16));
    this.blowTime = level > 0.45 ? this.blowTime + dt : Math.max(0, this.blowTime - dt * 2);
    return level;
  }

  stopMic() {
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    this.analyser = null;
  }
}
