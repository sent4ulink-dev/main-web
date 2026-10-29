// Audio. Recorded, all CC0: fireworks; cute monster voices (a witch's cackle, zombie laughs and grunts, bats,
// Dracula — "Goofy Sounds for Scary Monsters", Christopher Hahn et al.); pizzicato jingles, pops, creaks, a knife
// and pages (Kenney); and soft music-box background music (Aureolus_Omicron's spooky waltz and cute tune).
// Synthesised live with the Web Audio API: the night wind, crickets, an owl, rolling thunder, the bubbling
// cauldron, a theremin ghost, a heartbeat, the BOO, the flash powder — and a haunted pipe organ playing the
// opening of Bach's Toccata and Fugue in D minor (public domain).

const BASE = import.meta.env.BASE_URL;
const AMBIENCE = 0.12;
const BGM = 0.11;   // the music box, quietly under everything
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PHONE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
// ranks of organ pipes: 16' (sub), 8', a slightly detuned 8' for the chorus, 4', 2 2/3', 2' (phones: the main four)
const RANKS = PHONE
  ? [[0.5, 0.35, 'sine'], [1, 1.1, 'sine'], [1.003, 0.55, 'triangle'], [2, 0.5, 'sine']]
  : [[0.5, 0.35, 'sine'], [1, 1, 'sine'], [1.003, 0.5, 'triangle'], [2, 0.45, 'sine'], [3, 0.22, 'sine'], [4, 0.18, 'sine']];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.muted = false;
    this.ready = false;
    this.boil = 0;
    this.quiet = 1;   // the sky show plays everything softer (fireworks, thunder, crackle)
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
    // a big, dark stone space for everything (and a longer cathedral tail for the organ)
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.6, 2.6);
    this.reverbSend = ctx.createGain(); this.reverbSend.gain.value = 0.45;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.hall = ctx.createConvolver();
    this.hall.buffer = this._impulse(PHONE ? 3.0 : 4.2, 2.2);
    this.hallSend = ctx.createGain(); this.hallSend.gain.value = 0.6;
    this.hallSend.connect(this.hall).connect(this.master);
    this.noiseBuf = this._noise(2);
    this.brownBuf = this._brown(4);
    await this._loadAll();
    this._startWind();
    this._startCrickets();
    this._startOwl();
    this._startMusic();
    this.ready = true;
  }

  /** A recorded one-shot through the effects bus. */
  sfx(name, { gain = 0.5, rate = 1, pan = 0, when = 0, verb = 0.2 } = {}) {
    const buf = this.buffers[`sfx_${name}`];
    if (!this.ctx || !buf) return;
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(g).connect(p).connect(this.sfxBus);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; p.connect(s).connect(this.reverbSend); }
    src.start(ctx.currentTime + when);
  }

  // ── background music: a music box, soft, under everything ──
  _startMusic() {
    const ctx = this.ctx;
    this.bgmBus = ctx.createGain(); this.bgmBus.gain.value = 0; this.bgmBus.connect(this.master);
    this.tracks = {};
    for (const [k, f] of [['waltz', 'bgm_waltz'], ['cute', 'bgm_cute']]) {
      const el = new Audio(); el.crossOrigin = 'anonymous'; el.src = `${BASE}audio/${f}.mp3`; el.loop = true; el.preload = k === 'waltz' ? 'auto' : 'none';
      const g = ctx.createGain(); g.gain.value = 0;
      try { ctx.createMediaElementSource(el).connect(g).connect(this.bgmBus); } catch { /* plays directly */ }
      this.tracks[k] = { el, g };
    }
    this.track = null;
    this._bgmDuck = 0;
    this.music('waltz');
    this._bgmLevel();
  }

  /** Switch the background tune ('waltz' | 'cute'), cross-fading. */
  music(name) {
    if (!this.tracks || this.track === name) return;
    const now = this.ctx.currentTime, old = this.tracks[this.track], nu = this.tracks[name];
    this.track = name;
    if (old) { old.g.gain.setTargetAtTime(0, now, 0.8); setTimeout(() => { if (this.tracks[this.track] !== old) old.el.pause(); }, 4000); }
    if (nu) { nu.el.play().catch(() => {}); nu.g.gain.setTargetAtTime(1, now, 1.2); }
  }

  /** Hush the background music (amount 0..1), e.g. while the organ or a song plays, or for a scare. */
  musicDuck(amount) { this._bgmDuck = amount; this._bgmLevel(); }
  _bgmLevel() { if (this.bgmBus) this.bgmBus.gain.setTargetAtTime(BGM * (1 - this._bgmDuck), this.ctx.currentTime, 0.6); }

  async _loadAll() {
    const files = ['fw_01', 'fw_02', 'fw_03', 'fw_04', 'fw_05', 'fw_06', 'bang_02', 'bang_05', 'fw_loop',
      ...['witch_laugh', 'witch_yay', 'zombie_laugh', 'zombie_grunt', 'zombie_yay', 'zombie_oh', 'bat_laugh', 'bat_yay', 'dracula_laugh', 'scared',
        'pizzi_a', 'pizzi_b', 'pizzi_c', 'glass', 'pop', 'pluck', 'whoosh_up', 'chime', 'creak', 'door_open', 'door_slam', 'knife', 'page', 'pot'].map((n) => `sfx_${n}`)];
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

  _brown(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return b;
  }

  _impulse(sec, decay) {
    const ctx = this.ctx, len = ctx.sampleRate * sec;
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < ctx.sampleRate * 0.04 ? 0.25 : 1);
    }
    return b;
  }

  // ── the night ────────────────────────────────────────
  /** The wind howling round the gravestones: resonant noise whose pitch rises and falls. */
  _startWind() {
    const ctx = this.ctx;
    for (const [f0, depth, rate, gain, q] of [[420, 220, 0.05, 0.16, 7], [760, 300, 0.083, 0.07, 9], [240, 80, 0.031, 0.18, 1.2]]) {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f0; bp.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain;
      const lfo = ctx.createOscillator(); lfo.frequency.value = rate;
      const lg = ctx.createGain(); lg.gain.value = depth;
      lfo.connect(lg).connect(bp.frequency);
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = rate * 1.7;
      const lg2 = ctx.createGain(); lg2.gain.value = gain * 0.6;
      lfo2.connect(lg2).connect(g.gain);
      src.connect(bp).connect(g).connect(this.ambBus);
      src.start(0, Math.random() * 1.5); lfo.start(); lfo2.start();
    }
  }

  _startCrickets() {
    const chirp = () => {
      if (this.ctx.state === 'running') {
        const f = 4300 + Math.random() * 500, pan = (Math.random() - 0.5) * 1.6;
        for (let i = 0; i < 3; i++) this._tone(f, { dur: 0.035, gain: 0.05, when: i * 0.055, pan, out: this.ambBus, reverb: 0.1, attack: 0.004 });
      }
      this._crT = setTimeout(chirp, 600 + Math.random() * 1400);
    };
    chirp();
  }

  _startOwl() {
    const hoot = () => {
      if (this.ctx.state === 'running') {
        const pan = (Math.random() - 0.5) * 1.4, f = 360 + Math.random() * 40;
        const at = [0, 0.75, 1.05];
        at.forEach((w, i) => this._sweep(f * (i ? 1.04 : 1), f * 0.9, { dur: i ? 0.28 : 0.5, gain: 0.5, when: w, pan, out: this.ambBus, reverb: 0.8, attack: 0.06 }));
      }
      this._owlT = setTimeout(hoot, 14000 + Math.random() * 16000);
    };
    this._owlT = setTimeout(hoot, 5000);
  }

  update() {}

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.15);
  }

  /** Turn the loud things (fireworks, thunder, crackle) down to k (1 = normal). */
  setQuiet(k) {
    this.quiet = k;
    if (this._crackleLoop) this._crackleLoop.g.gain.setTargetAtTime(0.18 * k, this.ctx.currentTime, 1);
  }

  duckAmbience(amount, time = 1) {
    if (!this.ctx) return;
    this.ambBus.gain.setTargetAtTime(AMBIENCE * (1 - amount), this.ctx.currentTime, time / 3);
  }

  /** A recorded voice message; ghost: a breathy whisper in a long echo. Resolves when it ends. */
  playVoice(url, { ghost = false } = {}) {
    this.stopVoice();
    const el = new Audio();
    el.preload = 'auto'; el.playsInline = true; el.src = url;
    this.voiceEl = el;
    try {
      if (this.ctx) {
        const ctx = this.ctx, src = ctx.createMediaElementSource(el);
        if (ghost) {
          const g = ctx.createGain(); g.gain.value = 1.15;
          const send = ctx.createGain(); send.gain.value = 0.7;
          src.connect(g).connect(this.master);
          g.connect(send).connect(this.hallSend);
          this.ghostOoo(0.25);
        } else src.connect(this.master);
      }
    } catch { /* plays directly */ }
    this.duckAmbience(0.6, 0.8);
    this.musicDuck(1);
    const ended = new Promise((resolve) => { el.onended = resolve; el.onerror = resolve; el._stop = resolve; });
    el.play().catch(() => el._stop());
    return ended.then(() => { if (this.voiceEl === el) { this.voiceEl = null; this.duckAmbience(0, 2); this.musicDuck(0); } });
  }
  stopVoice() {
    const el = this.voiceEl; if (!el) return;
    this.voiceEl = null; el.pause(); el._stop?.(); this.duckAmbience(0, 2); this.musicDuck(0);
  }

  // ── building blocks ──────────────────────────────────
  _noiseBurst({ dur = 0.3, type = 'bandpass', f0 = 2000, f1 = 2000, q = 1, gain = 0.3, attack = 0.005, when = 0, pan = 0, reverb = 0.1, out = null, buf = null }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = buf || this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(f).connect(g).connect(p);
    p.connect(out || this.sfxBus);
    if (reverb) { const s = ctx.createGain(); s.gain.value = reverb; p.connect(s).connect(this.reverbSend); }
    src.start(t, Math.random() * Math.max(0.01, src.buffer.duration - dur - 0.1)); src.stop(t + dur + 0.05);
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

  _sweep(f0, f1, { dur = 0.2, gain = 0.1, when = 0, type = 'sine', pan = 0, out = null, reverb = 0.2, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(g).connect(p).connect(out || this.sfxBus);
    if (reverb) { const s = ctx.createGain(); s.gain.value = reverb; p.connect(s).connect(this.reverbSend); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  /** A voiced sound through vowel formants (for BOO and the cackle). pitch: [[time, Hz], …] */
  _voice({ pitch, formants, dur, gain = 0.3, when = 0, vibrato = 0, drive = 0, reverb = 0.5, attack = 0.02 }) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    pitch.forEach(([tt, f], i) => (i ? o.frequency.exponentialRampToValueAtTime(f, t + tt) : o.frequency.setValueAtTime(f, t + tt)));
    if (vibrato) { const l = ctx.createOscillator(); l.frequency.value = 6.5; const lg = ctx.createGain(); lg.gain.value = vibrato; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.1); }
    const mix = ctx.createGain(); mix.gain.value = 1;
    for (const [f, q, a] of formants) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const g = ctx.createGain(); g.gain.value = a; o.connect(bp).connect(g).connect(mix); }
    let node = mix;
    if (drive) { const ws = ctx.createWaveShaper(); ws.curve = this._drive(drive); node.connect(ws); node = ws; }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(gain, t + attack); env.gain.setValueAtTime(gain, t + dur * 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(env).connect(this.sfxBus);
    if (reverb) { const s = ctx.createGain(); s.gain.value = reverb; env.connect(s).connect(this.reverbSend); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  _drive(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
    return c;
  }

  // ── one-shots ────────────────────────────────────────
  paper() {
    this.sfx('page', { gain: 0.5, rate: 0.95 + Math.random() * 0.1 });
    for (let i = 0; i < 3; i++) this._noiseBurst({ dur: 0.06 + Math.random() * 0.08, f0: 2500 + Math.random() * 2500, f1: 1800, q: 0.9, gain: 0.12 + Math.random() * 0.1, when: i * 0.07 + Math.random() * 0.04, pan: (Math.random() - 0.5) * 0.4 });
    this._noiseBurst({ dur: 0.6, f0: 1200, f1: 3500, q: 0.6, gain: 0.07, when: 0.3 });
  }
  click() { this.sfx('pluck', { gain: 0.35, verb: 0 }); }
  pop(rate = 1) { this.sfx('pop', { gain: 0.45, rate, verb: 0.05 }); }
  /** A cute pizzicato flourish (a little "ta-da"). */
  tada(which = 'a', gain = 0.4) { this.sfx(`pizzi_${which}`, { gain, verb: 0.3 }); }
  whoosh() { this._noiseBurst({ dur: 0.5, type: 'bandpass', f0: 300, f1: 1300, q: 2.2, gain: 0.1, attack: 0.18 }); }
  /** A music-box twinkle in a minor key. */
  sparkle() {
    [1174.7, 1396.9, 1760, 2349.3, 2093, 1760].forEach((f, i) => this._tone(f, { dur: 1.5, gain: 0.04, when: i * 0.09, partials: [[1, 1, 1], [3.01, 0.18, 0.3]], pan: (i % 2 ? 0.3 : -0.3), reverb: 0.7 }));
  }
  chime() { this._tone(587.3, { dur: 2.2, gain: 0.06, partials: [[1, 1, 1], [2.76, 0.3, 0.4], [5.4, 0.1, 0.2]], reverb: 0.9 }); this._tone(698.5, { dur: 2.2, gain: 0.045, when: 0.12, partials: [[1, 1, 1], [2.76, 0.3, 0.4]], reverb: 0.9 }); }

  /** A slow hinge: stick-slip pulses through the wood's resonances. */
  creak(dur = 1.4, pitch = 1) {
    if (!this.ctx) return;
    // a recorded hinge for the real thing, the synthesised stick-slip underneath for length
    this.sfx(dur > 1.5 ? 'door_open' : 'creak', { gain: 0.55, rate: 0.75 * pitch, verb: 0.4 });
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(38 * pitch, t);
    for (let k = 1; k <= 8; k++) o.frequency.linearRampToValueAtTime((38 + Math.random() * 70 + k * 6) * pitch, t + (dur * k) / 8);
    const mix = ctx.createGain();
    for (const [f, q, a] of [[720, 9, 1], [1450, 11, 0.7], [2300, 12, 0.4]]) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * (0.9 + Math.random() * 0.2) * pitch; bp.Q.value = q; const g = ctx.createGain(); g.gain.value = a; o.connect(bp).connect(g).connect(mix); }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.5, t + 0.12); env.gain.setValueAtTime(0.5, t + dur * 0.8); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    mix.connect(env).connect(this.sfxBus);
    const s = ctx.createGain(); s.gain.value = 0.5; env.connect(s).connect(this.reverbSend);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /** One stroke of the carving knife through pumpkin. */
  knife(c = 0) {
    const up = c % 2 === 0;
    if (c % 3 === 0) this.sfx('knife', { gain: 0.22, rate: 0.85 + Math.random() * 0.35, verb: 0.05 });
    this._noiseBurst({ dur: 0.14, type: 'bandpass', f0: up ? 1600 : 3000, f1: up ? 3200 : 1500, q: 2.5, gain: 0.08, reverb: 0.05 });
    this._noiseBurst({ dur: 0.09, type: 'lowpass', f0: 600, f1: 250, q: 1, gain: 0.06, when: 0.04, reverb: 0 });
  }

  /** The candle inside catches: a soft whoomp and a glow of notes. */
  ignite() {
    this._noiseBurst({ dur: 0.9, type: 'lowpass', f0: 180, f1: 1400, q: 0.8, gain: 0.25, attack: 0.12 });
    this._sweep(70, 140, { dur: 0.7, gain: 0.25, attack: 0.08 });
    this.sparkle();
    this.sfx('glass', { gain: 0.4, when: 0.15 });
    this.tada('a', 0.45);
  }

  /** Rolling thunder (after `delay` s — the flash comes first). */
  thunder(delay = 0.8, strength = 0.8) {
    if (!this.ctx) return;
    strength *= this.quiet;
    const ctx = this.ctx, t = ctx.currentTime + delay, len = 3.5 + Math.random() * 1.5;
    const src = ctx.createBufferSource(); src.buffer = this.brownBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(110, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9 * strength, t + 0.06);
    let at = t + 0.3;
    while (at < t + len - 0.4) { g.gain.exponentialRampToValueAtTime((0.25 + Math.random() * 0.6) * strength, at); at += 0.2 + Math.random() * 0.5; }
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(lp).connect(g).connect(this.sfxBus);
    const s = ctx.createGain(); s.gain.value = 0.6; g.connect(s).connect(this.reverbSend);
    src.start(t); src.stop(t + len + 0.1);
    this._noiseBurst({ dur: 0.35, type: 'highpass', f0: 1800, f1: 600, gain: 0.25 * strength, when: delay, reverb: 0.5 });
  }

  rumble() {
    this._noiseBurst({ dur: 1.1, type: 'lowpass', f0: 160, f1: 70, q: 0.7, gain: 0.5, attack: 0.25, buf: this.brownBuf, reverb: 0.2 });
    this._sweep(46, 34, { dur: 1.0, gain: 0.3, attack: 0.25 });
  }
  thud() {
    this._sweep(90, 38, { dur: 0.45, gain: 0.55, attack: 0.004, reverb: 0.3 });
    this._noiseBurst({ dur: 0.35, type: 'lowpass', f0: 900, f1: 120, q: 0.7, gain: 0.45, reverb: 0.2 });
    for (let i = 0; i < 6; i++) this._noiseBurst({ dur: 0.05, type: 'bandpass', f0: 900 + Math.random() * 900, f1: 500, q: 1.5, gain: 0.08, when: 0.25 + i * 0.07 + Math.random() * 0.05, pan: (Math.random() - 0.5) * 0.8, reverb: 0.1 });
  }

  // the cauldron
  _bloop(gain = 0.08, when = 0) { const f = 140 + Math.random() * 220; this._sweep(f, f * (2 + Math.random()), { dur: 0.06 + Math.random() * 0.06, gain, when, reverb: 0.25, pan: (Math.random() - 0.5) * 0.4 }); }
  startBubbling() {
    if (!this.ctx || this._bubT) return;
    const go = () => { this._bloop(0.04 + this.boil * 0.02); this._bubT = setTimeout(go, Math.max(40, 260 - this.boil * 50) * (0.5 + Math.random())); };
    go();
  }
  stopBubbling() { clearTimeout(this._bubT); this._bubT = null; }
  bubbleBurst(n = 1) { this.boil = n; for (let i = 0; i < 10; i++) this._bloop(0.09, i * 0.06 + Math.random() * 0.04); }
  splash() {
    this.sfx('pot', { gain: 0.18, rate: 1.3, verb: 0.3 });
    this._noiseBurst({ dur: 0.5, type: 'bandpass', f0: 1400, f1: 300, q: 0.8, gain: 0.35, reverb: 0.3 });
    for (let i = 0; i < 6; i++) this._noiseBurst({ dur: 0.04, type: 'highpass', f0: 3000, f1: 2000, gain: 0.08, when: 0.1 + Math.random() * 0.4, pan: (Math.random() - 0.5), reverb: 0.1 });
  }
  magicPoof() {
    this.sfx('whoosh_up', { gain: 0.5, rate: 0.8 });
    this.sfx('glass', { gain: 0.4, when: 0.5 });
    this._noiseBurst({ dur: 1.2, type: 'bandpass', f0: 200, f1: 2400, q: 1.2, gain: 0.3, attack: 0.04, reverb: 0.6 });
    [1760, 1396.9, 1174.7, 880, 698.5, 587.3].forEach((f, i) => this._tone(f, { dur: 1.6, gain: 0.035, when: 0.2 + i * 0.07, partials: [[1, 1, 1], [2.01, 0.3, 0.4]], reverb: 0.8 }));
  }

  /** A theremin "oooOOOooo". */
  ghostOoo(gain = 0.6) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(560, t + 0.9); o.frequency.exponentialRampToValueAtTime(400, t + 1.8); o.frequency.exponentialRampToValueAtTime(470, t + 2.6);
    const l = ctx.createOscillator(); l.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = 9; l.connect(lg).connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 * gain, t + 0.4); g.gain.setValueAtTime(0.12 * gain, t + 2.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.9);
    o.connect(g).connect(this.sfxBus);
    const s = ctx.createGain(); s.gain.value = 0.9; g.connect(s).connect(this.hallSend);
    o.start(t); l.start(t); o.stop(t + 3); l.stop(t + 3);
  }

  needle() {
    this._noiseBurst({ dur: 0.05, type: 'highpass', f0: 2000, f1: 2000, gain: 0.2, reverb: 0 });
    for (let i = 0; i < 12; i++) this._noiseBurst({ dur: 0.012, type: 'highpass', f0: 2600, f1: 2000, gain: 0.05 + Math.random() * 0.08, when: 0.05 + i * 0.06 + Math.random() * 0.04, reverb: 0 });
  }

  /** Treats! Wrappers crinkling, bright plinks raining down. */
  candy() {
    this.tada('c', 0.45);
    this.pop(1.1); this.pop(1.35);
    const scale = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2349.3];
    for (let i = 0; i < 14; i++) this._tone(scale[Math.floor(Math.random() * scale.length)], { dur: 0.5, gain: 0.04, when: 0.25 + i * 0.08 + Math.random() * 0.05, partials: [[1, 1, 1], [3, 0.2, 0.3]], pan: (Math.random() - 0.5) * 1.2, reverb: 0.4 });
    for (let i = 0; i < 8; i++) this._noiseBurst({ dur: 0.08, type: 'highpass', f0: 4000, f1: 3000, gain: 0.07, when: 0.3 + i * 0.12, pan: (Math.random() - 0.5), reverb: 0.1 });
    this._sweep(300, 900, { dur: 0.3, gain: 0.12 });
  }

  /** A heartbeat, n beats, speeding up. Returns how long it lasts. */
  heartbeat(n = 5) {
    let at = 0;
    for (let i = 0; i < n; i++) {
      this._sweep(80, 42, { dur: 0.16, gain: 0.55, when: at, attack: 0.008, reverb: 0.1 });
      this._sweep(70, 38, { dur: 0.14, gain: 0.4, when: at + 0.2, attack: 0.008, reverb: 0.1 });
      at += Math.max(0.42, 0.85 - i * 0.1);
    }
    return at;
  }

  /** The power dies: a falling hum, a click, silence. */
  lightsOut() {
    this._sweep(120, 28, { dur: 0.9, gain: 0.2, type: 'sawtooth', reverb: 0.2 });
    this._noiseBurst({ dur: 0.04, type: 'highpass', f0: 1500, f1: 1500, gain: 0.3, reverb: 0.3, when: 0.05 });
    this.duckAmbience(0.9, 0.3);
    setTimeout(() => this.duckAmbience(0, 3), 3500);
  }

  /** BOO! — a big cartoon voice, a scream of strings, a stab. */
  boo() {
    if (!this.ctx) return;
    this.sfx('scared', { gain: 0.55, when: 0.25, verb: 0.3 });
    this._voice({ pitch: [[0, 210], [0.12, 165], [0.75, 110]], formants: [[320, 6, 1.2], [800, 7, 0.6], [2500, 8, 0.15]], dur: 0.85, gain: 0.95, vibrato: 4, drive: 2.5, reverb: 0.6, attack: 0.012 });
    this._noiseBurst({ dur: 0.25, type: 'lowpass', f0: 2500, f1: 300, q: 0.7, gain: 0.5, reverb: 0.3 });
    // a dissonant stab (shrieking cluster)
    for (const m of [86, 87, 92, 93]) this._sweep(hz(m), hz(m) * 0.97, { dur: 0.7, gain: 0.05, type: 'sawtooth', reverb: 0.7 });
    this._sweep(55, 40, { dur: 0.8, gain: 0.5, attack: 0.005 });
  }

  /** A witch's cackle: "heh-heh-heh-HAAA-ha-ha-ha…" */
  cackle(gain = 1, who = 'witch') {
    if (!this.ctx) return;
    if (this.buffers[`sfx_${who}_laugh`]) { this.sfx(`${who}_laugh`, { gain: 0.6 * gain, verb: 0.5 }); return; }
    const n = 9;
    for (let i = 0; i < n; i++) {
      const f = 720 - i * 22 + (i === 3 ? 140 : 0);
      this._voice({ pitch: [[0, f * 1.06], [0.09, f * 0.92]], formants: [[850, 5, 1.2], [1300, 6, 0.8], [2600, 8, 0.25]], dur: i === 3 ? 0.32 : 0.11, gain: (0.32 - i * 0.02) * gain, when: i * 0.135 + (i > 3 ? 0.2 : 0), vibrato: 12, drive: 1.4, reverb: 0.7, attack: 0.008 });
    }
  }

  /** A potion flung up into the sky (soft). */
  fling() { this._noiseBurst({ dur: 0.5, type: 'bandpass', f0: 500, f1: 2200, q: 2, gain: 0.05, attack: 0.1, reverb: 0.3 }); this._sweep(300, 900, { dur: 0.4, gain: 0.025, reverb: 0.3 }); }

  batFlutter() {
    this.sfx('bat_laugh', { gain: 0.35, verb: 0.4, when: 0.3 });
    for (let i = 0; i < 30; i++) this._noiseBurst({ dur: 0.04, type: 'lowpass', f0: 700, f1: 300, q: 1, gain: 0.07 * (1 - i / 30), when: i * 0.055, pan: Math.sin(i * 0.4) * 0.6, reverb: 0.2 });
  }

  /** The flash powder: a hiss, a white POOF, the shutter. */
  flashPowder() {
    this._noiseBurst({ dur: 0.12, type: 'highpass', f0: 5000, f1: 3000, gain: 0.12, reverb: 0 });
    this._noiseBurst({ dur: 0.9, type: 'bandpass', f0: 2600, f1: 300, q: 0.6, gain: 0.5, when: 0.06, reverb: 0.5 });
    this._sweep(160, 45, { dur: 0.5, gain: 0.45, when: 0.06 });
    this._noiseBurst({ dur: 0.02, type: 'highpass', f0: 3000, f1: 3000, gain: 0.3, when: 0.02, reverb: 0 });
    this._noiseBurst({ dur: 0.02, type: 'highpass', f0: 2500, f1: 2500, gain: 0.25, when: 0.24, reverb: 0 });
  }

  /** The photograph develops: a slow shimmer that turns uneasy. */
  develop() {
    this.sfx('chime', { gain: 0.35, when: 0.4 });
    this.tada('b', 0.4);
    [587.3, 698.5, 880, 1046.5, 830.6].forEach((f, i) => this._tone(f, { dur: 2.6, gain: 0.035, when: 0.6 + i * 0.45, attack: 0.3, partials: [[1, 1, 1], [2.0, 0.3, 0.5]], reverb: 0.9 }));
  }

  // ── the haunted organ ────────────────────────────────
  _pipe(m, at, dur, gain = 0.03) {
    const ctx = this.ctx, f = hz(m), out = this._organBus;
    if (!out) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + 0.02); g.gain.setValueAtTime(gain, at + Math.max(0.02, dur - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.12);
    g.connect(out);
    for (const [mul, amp, type] of RANKS) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mul;
      const pg = ctx.createGain(); pg.gain.value = amp;
      o.connect(pg).connect(g);
      o.start(at); o.stop(at + dur + 0.2);
    }
  }

  /**
   * The opening of the Toccata in D minor (J. S. Bach, public domain) on a ghostly pipe organ, then a running
   * figure over the same chords; it loops until stopped. onNote(midi, seconds) fires with each melody note.
   */
  playOrgan(onNote = () => {}) {
    if (!this.ctx || this.organPlaying) return;
    this.organPlaying = true;
    this.musicDuck(1);
    const ctx = this.ctx;
    this._organBus = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
    this._organBus.connect(lp).connect(this.musicBus);
    const send = ctx.createGain(); send.gain.value = 0.8; lp.connect(send).connect(this.hallSend);
    this.musicBus.gain.cancelScheduledValues(ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(0.9, ctx.currentTime, 0.2);
    this.duckAmbience(0.6, 1.5);
    // the score, as a list of notes [midi, start s, length s, gain, melody?] …
    const score = [];
    const note = (m, s, d, { oct = true, gain = 0.03, mel = true } = {}) => {
      score.push([m, s, d, gain, mel]);
      if (oct) score.push([m - 12, s, d, gain * 0.8, false]);
    };
    // three falling phrases, each an octave lower
    const phrase = (o, s) => {
      note(81 + o, s, 0.11); note(79 + o, s + 0.11, 0.11); note(81 + o, s + 0.22, 1.25);
      if (o === -12) { note(76 + o, s + 1.6, 0.14); note(77 + o, s + 1.74, 0.14); note(73 + o, s + 1.88, 0.4); note(74 + o, s + 2.28, 1.3); }
      else { note(79 + o, s + 1.65, 0.12); note(77 + o, s + 1.77, 0.12); note(76 + o, s + 1.89, 0.12); note(74 + o, s + 2.01, 0.12); note(73 + o, s + 2.13, 0.5); note(74 + o, s + 2.63, 1.4); }
    };
    phrase(0, 0); phrase(-12, 4.4); phrase(-24, 8.4);
    // the low pedal, the diminished chord built note by note, the D minor resolution
    note(38, 12.2, 5.6, { oct: true, gain: 0.04, mel: false });
    [49, 52, 55, 58, 61, 64].forEach((m, k) => note(m, 12.4 + k * 0.15, 3.3 - k * 0.15, { oct: false, gain: 0.026 }));
    [50, 53, 57, 62, 65, 69].forEach((m) => note(m, 15.9, 2.4, { oct: false, gain: 0.026, mel: false }));
    // the running figure
    const chords = [[74, 69, 65, 62], [73, 67, 64, 61], [74, 70, 67, 62], [73, 69, 64, 61], [74, 69, 65, 62], [72, 69, 65, 60], [70, 67, 62, 58], [69, 64, 61, 57]];
    let s = 18.6;
    for (const c of chords) {
      note(c[3] - 24, s, 0.95, { oct: false, gain: 0.035, mel: false });
      const fig = [c[0], c[1], c[2], c[3], c[2], c[1]];
      for (let r = 0; r < 2; r++) fig.forEach((m, k) => note(m, s + (r * 6 + k) * 0.083, 0.08, { oct: false, gain: 0.024, mel: k === 0 }));
      s += 1.0;
    }
    // and the dark final chord
    note(38, s + 0.1, 2.8, { gain: 0.04, mel: false });
    [50, 57, 62, 65, 69, 74].forEach((m) => note(m, s + 0.1, 2.6, { oct: false, gain: 0.026, mel: false }));
    const loopLen = s + 3.4;
    score.sort((a, b) => a[1] - b[1]);
    // … played with a short look-ahead, so the pipes are built a few at a time rather than a thousand at once
    // (which stalled the frame — and on phones the audio — each time the piece started), looping seamlessly
    let t0 = ctx.currentTime + 0.3, i = 0;
    this._noteTimers = [];
    const tick = () => {
      if (!this.organPlaying) return;
      const until = ctx.currentTime + 0.9;
      while (t0 + score[i][1] < until) {
        const [m, st, d, gain, mel] = score[i], at = t0 + st;
        this._pipe(m, at, d, gain);
        if (mel) this._noteTimers.push(setTimeout(() => onNote(m, d), Math.max(0, (at - ctx.currentTime) * 1000)));
        if (++i >= score.length) { i = 0; t0 += loopLen; this._noteTimers = this._noteTimers.slice(-40); }
      }
      this._organTimer = setTimeout(tick, 250);
    };
    tick();
  }

  stopOrgan() {
    if (!this.ctx) return;
    this.musicDuck(0);
    clearTimeout(this._organTimer);
    for (const id of this._noteTimers || []) clearTimeout(id);
    this._noteTimers = [];
    this.organPlaying = false;
    // the organ's own bus too: it also feeds the hall reverb directly, which otherwise kept on playing
    const ob = this._organBus;
    if (ob) { ob.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); setTimeout(() => ob.disconnect(), 1500); this._organBus = null; }
    this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
    this.duckAmbience(0, 2);
    const old = this.musicBus;
    setTimeout(() => old.disconnect(), 1500);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0; this.musicBus.connect(this.master);
  }

  // ── fireworks (recorded CC0) ─────────────────────────
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
    const g = ctx.createGain(); g.gain.value = Math.min(1.1, 90 / distance) * (big ? 1 : 0.8) * this.quiet;
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-0.9, Math.min(0.9, pan));
    src.connect(lp).connect(g).connect(p).connect(this.sfxBus);
    const s = ctx.createGain(); s.gain.value = 0.6; p.connect(s).connect(this.reverbSend);
    src.start(ctx.currentTime + delay);
  }

  startCrackle() {
    if (!this.ctx || !this.buffers.fw_loop || this._crackleLoop) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.buffers.fw_loop; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.18 * this.quiet, this.ctx.currentTime, 2);
    src.connect(g).connect(this.sfxBus); src.start();
    this._crackleLoop = { src, g };
  }
  stopCrackle() {
    if (!this._crackleLoop) return;
    this._crackleLoop.g.gain.setTargetAtTime(0, this.ctx.currentTime, 1);
    const c = this._crackleLoop; setTimeout(() => c.src.stop(), 4000);
    this._crackleLoop = null;
  }
}
