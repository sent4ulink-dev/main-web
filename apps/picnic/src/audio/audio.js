// Audio: CC0 field recordings for the meadow, recorded CC0 fireworks, and everything else
// (music box, crickets, paper, shutter, sparkles) synthesised live with the Web Audio API.

const BASE = import.meta.env.BASE_URL;

const AMBIENCE = 0.12;   // birds / wind / crickets level

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

    // birds, wind and crickets sit well under everything else (30%); fireworks, music and the voice play at full
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = AMBIENCE; this.ambBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.0; this.musicBus.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.6, 2.2);
    this.reverbSend = ctx.createGain(); this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.master);

    this.noiseBuf = this._noise(2);
    await this._loadAll();
    this._startAmbience();
    this._startCrickets();
    this.ready = true;
  }

  async _loadAll() {
    const files = ['ambience_birds', 'ambience_wind', 'fw_01', 'fw_02', 'fw_03', 'fw_04', 'fw_05', 'fw_06', 'bang_02', 'bang_05', 'fw_loop'];
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

  _startAmbience() {
    const ctx = this.ctx;
    this.birdsGain = ctx.createGain(); this.birdsGain.gain.value = 0.55;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.35;
    const birdsPan = ctx.createStereoPanner(); birdsPan.pan.value = -0.1;
    this.birdsGain.connect(birdsPan).connect(this.ambBus);
    // leaves rustle: a high-passed copy of the wind that swells with gusts
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 2200;
    this.windGain.connect(this.windFilter).connect(this.ambBus);
    this._crossLoop(this.buffers.ambience_birds, this.birdsGain, 6);
    this._crossLoop(this.buffers.ambience_wind, this.windGain, 6);
  }

  _startCrickets() {
    const ctx = this.ctx;
    this.cricketGain = ctx.createGain();
    this.cricketGain.gain.value = 0;
    this.cricketGain.connect(this.ambBus);
    // carrier × pulse-train gate × chirp-rhythm gate (each gate is a square wave mapped to 0..1)
    const half = ctx.createConstantSource(); half.offset.value = 0.5; half.start();
    const gateNode = (rate) => {
      const g = ctx.createGain(); g.gain.value = 0;
      const sq = ctx.createOscillator(); sq.type = 'square'; sq.frequency.value = rate;
      const s = ctx.createGain(); s.gain.value = 0.5;
      sq.connect(s).connect(g.gain);
      half.connect(g.gain);
      sq.start();
      return g;
    };
    const voice = (freq, rate, pan, pulse) => {
      const osc = ctx.createOscillator(); osc.frequency.value = freq;
      const panner = ctx.createStereoPanner(); panner.pan.value = pan;
      const lvl = ctx.createGain(); lvl.gain.value = 0.02;
      osc.connect(gateNode(pulse)).connect(gateNode(rate)).connect(lvl).connect(panner).connect(this.cricketGain);
      osc.start();
    };
    voice(4350, 1.35, -0.6, 29);
    voice(4620, 1.7, 0.5, 33);
    voice(4100, 1.1, 0.1, 26);
  }

  /** Called every frame. gust: 0..1, dusk: 0..1 */
  update(gust, dusk) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0.16 + gust * 0.5, t, 0.6);
    this.windFilter.frequency.setTargetAtTime(900 + gust * 3200, t, 0.6);
    this.birdsGain.gain.setTargetAtTime(0.55 * (1 - dusk * 0.85), t, 1.5);
    this.cricketGain.gain.setTargetAtTime(Math.max(0, dusk - 0.35) * 1.4, t, 2);
  }

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
    this.duckAmbience(1, 0.3);   // the room goes quiet under a voice message, so the voice stays clear
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

  _noiseBurst({ dur = 0.3, type = 'bandpass', f0 = 2000, f1 = 2000, q = 1, gain = 0.3, attack = 0.005, when = 0, pan = 0, reverb = 0.1 }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(f).connect(g).connect(p);
    p.connect(this.sfxBus);
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
  playMusicBox() {
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;
    const ctx = this.ctx;
    this.musicBus.gain.cancelScheduledValues(ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(0.9, ctx.currentTime, 0.3);
    this.duckAmbience(0.45, 1.5);
    const N = { G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, C4: 261.63, F3: 174.61, G3: 196, C3: 130.81, E4: 329.63 };
    const mel = [['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2], ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
      ['G4', .75], ['G4', .25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2], ['F5', .75], ['F5', .25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 3]];
    const bass = [[1, 'C4'], [4, 'G3'], [7, 'G3'], [10, 'C4'], [13, 'C4'], [16, 'F3'], [19, 'C4'], [20.5, 'G3'], [22, 'C3']];
    const beat = 0.62;
    const box = [[1, 1, 1], [2.0, 0.28, 0.55], [3.01, 0.14, 0.35], [5.43, 0.07, 0.12]];
    const playOnce = (start, oct = 1) => {
      let t = 0;
      for (const [n, d] of mel) {
        this._tone(N[n] * oct, { dur: 1.9, gain: 0.11, when: start + t * beat + (Math.random() - 0.5) * 0.015, partials: box, out: this.musicBus, pan: (N[n] - 520) / 900 });
        t += d;
      }
      for (const [b, n] of bass) this._tone(N[n] * oct, { dur: 2.4, gain: 0.05, when: start + (b - 1 + 1) * beat, partials: box, out: this.musicBus, pan: -0.25 });
      return t * beat;
    };
    const lead = 0.4;
    let len = playOnce(lead, 1);
    len += playOnce(lead + len + beat, 2) + beat;
    this._musicTimer = setTimeout(() => { this.musicPlaying = false; this.playMusicBox(); }, (lead + len + beat * 2) * 1000);
  }

  stopMusicBox() {
    if (!this.ctx) return;
    clearTimeout(this._musicTimer);
    this.musicPlaying = false;
    this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    this.duckAmbience(0, 2);
    // re-create the bus so already-scheduled notes stay silent
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
