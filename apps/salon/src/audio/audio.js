// Audio: recorded CC0 fireworks; everything else synthesised live with the Web Audio API — the salon's
// crackling hearth and ticking clock, the fortepiano playing Mozart (K. 265, the "Ah vous dirai-je, Maman"
// variations) and Beethoven's "Ode to Joy" theme with a bowed cello line, paper, brushes and sparkles.

const BASE = import.meta.env.BASE_URL;

const AMBIENCE = 0.12;   // hearth / clock level

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
    comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.master.connect(comp).connect(ctx.destination);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, ctx.currentTime, 0.8);

    // the hearth and the clock sit well under everything else (30%); fireworks, music and the voice play at full
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = AMBIENCE; this.ambBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.0; this.musicBus.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.6, 2.2);
    this.reverbSend = ctx.createGain(); this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.master);

    this.noiseBuf = this._noise(2);
    await this._loadAll();
    this._startHearth();
    this._startClock();
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
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  /** Seamless crossfaded loop of a long recording. */
  _crossLoop(buffer, out, xfade = 5) {
    if (!buffer) return;
    const ctx = this.ctx;
    const D = buffer.duration;
    const seg = D - xfade;
    let next = ctx.currentTime + 0.05;
    const schedule = () => {
      while (next < ctx.currentTime + 10) {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, next);
        g.gain.linearRampToValueAtTime(1, next + xfade);
        g.gain.setValueAtTime(1, next + seg);
        g.gain.linearRampToValueAtTime(0, next + D - 0.05);
        src.connect(g).connect(out);
        src.start(next, 0.05);
        src.stop(next + D);
        next += seg;
      }
    };
    schedule();
    setInterval(schedule, 3000);
  }

  /** The hearth: a low rumble of flame and wood that crackles and pops now and then. */
  _startHearth() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    this.hearthGain = ctx.createGain(); this.hearthGain.gain.value = 0.32;
    src.connect(lp).connect(this.hearthGain).connect(this.ambBus);
    src.start();
    const pop = () => {
      if (this.ctx.state === 'running') {
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this._noiseBurst({ dur: 0.015 + Math.random() * 0.04, type: 'highpass', f0: 1800 + Math.random() * 2500, f1: 1200, q: 0.7, gain: 0.25 + Math.random() * 0.4, when: i * (0.02 + Math.random() * 0.05), pan: 0.55, reverb: 0.05, out: this.ambBus });
      }
      this._popT = setTimeout(pop, 90 + Math.random() * 520);
    };
    pop();
  }

  /** The mantel clock: a soft tick-tock. */
  _startClock() {
    let tock = false;
    setInterval(() => {
      if (this.ctx.state !== 'running') return;
      this._noiseBurst({ dur: 0.012, type: 'bandpass', f0: tock ? 2600 : 3400, f1: 2000, q: 6, gain: 0.35, pan: 0.45, reverb: 0.15, out: this.ambBus });
      tock = !tock;
    }, 1000);
  }

  /** Called every frame. */
  update() {}

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.15);
  }

  /** Play a recorded voice message at full volume (through the mute switch). Resolves when it ends. */
  playVoice(url) {
    this.stopVoice();
    const el = new Audio();
    el.preload = 'auto'; el.playsInline = true; el.src = url;
    this.voiceEl = el;
    try { if (this.ctx) this.ctx.createMediaElementSource(el).connect(this.master); } catch { /* plays directly */ }
    this.duckAmbience(0.6, 0.8);
    const ended = new Promise((resolve) => { el.onended = resolve; el.onerror = resolve; el._stop = resolve; });
    el.play().catch(() => el._stop());
    return ended.then(() => { if (this.voiceEl === el) { this.voiceEl = null; this.duckAmbience(0, 2); } });
  }
  stopVoice() {
    const el = this.voiceEl; if (!el) return;
    this.voiceEl = null; el.pause(); el._stop?.(); this.duckAmbience(0, 2);
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
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(f).connect(g).connect(p);
    p.connect(out || this.sfxBus);
    if (reverb) { const s = ctx.createGain(); s.gain.value = reverb; p.connect(s).connect(this.reverbSend); }
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  _tone(freq, { dur = 1.2, gain = 0.15, when = 0, type = 'sine', partials = null, out = null, pan = 0, attack = 0.003 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p).connect(out || this.sfxBus);
    const send = ctx.createGain(); send.gain.value = 0.5; p.connect(send).connect(this.reverbSend);
    for (const [mul, amp, decay] of (partials || [[1, 1, 1]])) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq * mul;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(amp, t); pg.gain.exponentialRampToValueAtTime(0.0001, t + dur * decay);
      o.connect(pg).connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }

  paper() {
    for (let i = 0; i < 7; i++) this._noiseBurst({ dur: 0.06 + Math.random() * 0.08, f0: 2500 + Math.random() * 2500, f1: 1800, q: 0.9, gain: 0.12 + Math.random() * 0.12, when: i * 0.07 + Math.random() * 0.04, pan: (Math.random() - 0.5) * 0.4 });
    this._noiseBurst({ dur: 0.7, f0: 1200, f1: 3500, q: 0.6, gain: 0.08, when: 0.35 });
  }
  pageTurn() { this._noiseBurst({ dur: 0.55, f0: 900, f1: 4200, q: 0.7, gain: 0.14 }); this._noiseBurst({ dur: 0.12, f0: 3000, f1: 2000, gain: 0.08, when: 0.45 }); }
  release() { this._noiseBurst({ dur: 0.9, type: 'bandpass', f0: 400, f1: 1600, q: 2, gain: 0.08 }); this._tone(660, { dur: 0.6, gain: 0.05, partials: [[1, 1, 1], [2, 0.3, 0.5]] }); this._tone(990, { dur: 0.7, gain: 0.04, when: 0.12 }); }
  shutter() {
    this._noiseBurst({ dur: 0.04, type: 'highpass', f0: 3000, f1: 3000, gain: 0.5, reverb: 0 });
    this._noiseBurst({ dur: 0.05, type: 'highpass', f0: 2000, f1: 2000, gain: 0.35, when: 0.09, reverb: 0 });
    this._tone(120, { dur: 0.08, gain: 0.25, type: 'triangle' });
  }
  click() { this._noiseBurst({ dur: 0.03, type: 'highpass', f0: 2500, f1: 2500, gain: 0.25, reverb: 0 }); this._tone(180, { dur: 0.05, gain: 0.12, type: 'triangle' }); }
  sparkle() {
    const notes = [1046.5, 1318.5, 1568, 2093, 1760, 2637];
    notes.forEach((f, i) => this._tone(f, { dur: 1.6, gain: 0.05, when: i * 0.09, partials: [[1, 1, 1], [2.01, 0.25, 0.4], [3.98, 0.08, 0.25]], pan: (i % 2 ? 0.3 : -0.3) }));
  }
  chime() { this._tone(784, { dur: 1.1, gain: 0.05, partials: [[1, 1, 1], [2, 0.2, 0.5]] }); this._tone(1175, { dur: 1.2, gain: 0.04, when: 0.08 }); }
  blow(strength = 1) { this._noiseBurst({ dur: 0.9, type: 'lowpass', f0: 1800, f1: 400, q: 0.5, gain: 0.25 * strength, attack: 0.05 }); }
  pop() { this._noiseBurst({ dur: 0.18, type: 'bandpass', f0: 1200, f1: 300, q: 1.5, gain: 0.3 }); }
  /** Rising glass-harp arpeggio with a shimmer: the crystal ball wakes up. */
  magic() {
    const notes = [523.3, 659.3, 784, 1046.5, 1318.5, 1568, 2093, 2637];
    notes.forEach((f, i) => this._tone(f, { dur: 2.4, gain: 0.045, when: i * 0.13, attack: 0.04, partials: [[1, 1, 1], [2.0, 0.35, 0.6], [3.01, 0.12, 0.35]], pan: Math.sin(i * 1.3) * 0.5 }));
    this._noiseBurst({ dur: 2.2, type: 'highpass', f0: 5000, f1: 9000, q: 0.4, gain: 0.05, attack: 0.6, reverb: 0.6 });
  }
  /** Instant-camera motor pushing the photo out. */
  whir(dur = 1.4) {
    if (!this.ctx) return;
    this._noiseBurst({ dur, type: 'bandpass', f0: 700, f1: 1100, q: 6, gain: 0.07, attack: 0.05, reverb: 0 });
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(150, t); o.frequency.linearRampToValueAtTime(170, t + dur);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.06);
    g.gain.setValueAtTime(0.03, t + dur - 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /** Music box "Happy Birthday" (public-domain melody), looping softly until stopped. */
  /**
   * The concert: Mozart's theme from the K. 265 variations ("Ah vous dirai-je, Maman") on the fortepiano with
   * an Alberti bass, a variation in running sixteenths, then Beethoven's "Ode to Joy" theme with the cello
   * holding the bass — and round again. onNote(midi, seconds) fires as each piano key is struck.
   */
  playConcert(onNote = () => {}) {
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;
    const ctx = this.ctx;
    this.musicBus.gain.cancelScheduledValues(ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(0.85, ctx.currentTime, 0.3);
    this.duckAmbience(0.5, 1.5);
    this._noteTimers = [];
    const f = (m) => 440 * 2 ** ((m - 69) / 12);
    const piano = [[1, 1, 1], [2, 0.42, 0.55], [3, 0.2, 0.32], [4, 0.1, 0.22], [5.02, 0.05, 0.15]];
    const strike = (m, at, dur, gain = 0.11, pan = 0) => {
      this._tone(f(m), { dur: Math.max(0.6, dur * 1.8), gain, when: at, partials: piano, out: this.musicBus, pan, attack: 0.004 });
      this._noteTimers.push(setTimeout(() => onNote(m, dur), Math.max(0, at * 1000)));
    };
    const bow = (m, at, dur, gain = 0.05) => {     // the cello: a soft bowed saw through a warm filter
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f(m);
      const vib = ctx.createOscillator(); vib.frequency.value = 5.2; const vg = ctx.createGain(); vg.gain.value = f(m) * 0.006; vib.connect(vg).connect(o.frequency);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.18); g.gain.setValueAtTime(gain, t + dur - 0.15); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      const send = ctx.createGain(); send.gain.value = 0.4;
      o.connect(lp).connect(g).connect(this.musicBus); g.connect(send).connect(this.reverbSend);
      o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
    };
    // C major. Theme in quarter notes; each bar has one chord (an Alberti bass under it).
    const C = 60, mel = [0, 0, 7, 7, 9, 9, 7, null, 5, 5, 4, 4, 2, 2, 0, null, 7, 7, 5, 5, 4, 4, 2, null, 7, 7, 5, 5, 4, 4, 2, null, 0, 0, 7, 7, 9, 9, 7, null, 5, 5, 4, 4, 2, 2, 0, null];
    const chords = [[0, 4, 7], [5, 9, 12], [2, 5, 7, 11], [0, 4, 7], [0, 4, 7], [7, 11, 14], [0, 4, 7], [7, 11, 14], [0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]];
    const q = 0.46;   // a quarter note
    let t = 0.35;
    const theme = (variation) => {
      for (let bar = 0; bar < 12; bar++) {
        const ch = chords[bar], root = C - 12;
        // Alberti bass: low – high – middle – high, in eighths
        const alb = [ch[0], ch[ch.length - 1], ch[1], ch[ch.length - 1]];
        for (let k = 0; k < 8; k++) strike(root + alb[k % 4], t + bar * 4 * q + k * q / 2, q / 2, 0.055, -0.3);
        for (let b = 0; b < 4; b++) {
          const m = mel[bar * 4 + b];
          const at = t + (bar * 4 + b) * q;
          if (m === null) continue;
          const held = mel[bar * 4 + b + 1] === null;
          if (!variation) strike(C + m, at, held ? q * 2 : q, 0.12, 0.2);
          else {
            // running sixteenths around the melody note (Mozart's first variation, in spirit)
            const run = [m + 12, m + 11, m + 12, m + 14].map((x, i) => (i === 0 ? m : x - 12));
            run.forEach((x, i) => strike(C + 12 + x, at + i * q / 4, q / 4, 0.085, 0.25));
          }
        }
      }
      t += 12 * 4 * q + q;
    };
    const ode = () => {
      // Beethoven's "Ode to Joy" theme (D major moved to C): E E F G | G F E D | C C D E | E. D D
      const tune = [4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 4, 2, 2, null, 4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 2, 0, 0, null];
      const bass = [0, 7, 0, 7, 5, 0, 7, 7];
      for (let i = 0; i < tune.length; i++) {
        const m = tune[i]; if (m === null) continue;
        const held = tune[i + 1] === null;
        strike(C + 12 + m, t + i * q, held ? q * 2 : q, 0.11, 0.2);
        strike(C + m, t + i * q, held ? q * 2 : q, 0.05, 0.05);
      }
      for (let b = 0; b < 8; b++) bow(C - 24 + bass[b], t + b * 4 * q, 4 * q, 0.045);
      t += tune.length * q + q;
    };
    theme(false); theme(true); ode();
    this._musicTimer = setTimeout(() => { this.musicPlaying = false; if (this._again !== false) this.playConcert(onNote); }, t * 1000);
  }

  stopConcert() {
    if (!this.ctx) return;
    clearTimeout(this._musicTimer);
    for (const id of this._noteTimers || []) clearTimeout(id);
    this._noteTimers = [];
    this.musicPlaying = false;
    this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    this.duckAmbience(0, 2);
    // re-create the bus so already-scheduled notes stay silent
    const old = this.musicBus;
    setTimeout(() => old.disconnect(), 1500);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0; this.musicBus.connect(this.master);
  }

  /** A painter's brush: soft swishes while the portrait is painted. */
  brush(seconds = 4) {
    for (let i = 0; i < seconds * 3; i++) this._noiseBurst({ dur: 0.18 + Math.random() * 0.2, type: 'bandpass', f0: 1800 + Math.random() * 1500, f1: 900, q: 0.8, gain: 0.05 + Math.random() * 0.05, when: i * 0.33 + Math.random() * 0.1, pan: (Math.random() - 0.5) * 0.4 });
  }

  /** The quill scratching across the parchment. */
  quill(seconds = 2.8) {
    for (let i = 0; i < seconds * 9; i++) this._noiseBurst({ dur: 0.04 + Math.random() * 0.06, type: 'highpass', f0: 4200 + Math.random() * 2000, f1: 3000, q: 0.6, gain: 0.04 + Math.random() * 0.05, when: i * 0.11 + Math.random() * 0.04, pan: 0.2 });
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

  launchWhistle(pan = 0) {
    if (!this.ctx) return;
    this._noiseBurst({ dur: 1.4, type: 'bandpass', f0: 600, f1: 2600, q: 6, gain: 0.03, pan, reverb: 0.3 });
  }

  startCrackle() {
    if (!this.ctx || !this.buffers.fw_loop || this._crackle) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.buffers.fw_loop; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.18, this.ctx.currentTime, 2);
    src.connect(g).connect(this.sfxBus); src.start();
    this._crackle = { src, g };
  }
  stopCrackle() {
    if (!this._crackle) return;
    this._crackle.g.gain.setTargetAtTime(0, this.ctx.currentTime, 1);
    const c = this._crackle; setTimeout(() => c.src.stop(), 4000);
    this._crackle = null;
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

  /** Returns 0..1 breath level; blow detected when sustained. */
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
