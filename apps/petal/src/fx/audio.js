// One audio graph for the whole island: the sound effects, the music and the
// nature sounds share one context (phones allow only a few), a soft limiter
// and a small garden reverb, so everything sits in the same air.
//
// Every sound is synthesised here, no audio files: bells, glockenspiel bars
// and music-box tines from their real overtone ratios, plucked strings by
// Karplus-Strong, water from the ring of bursting bubbles, birdsong from swept
// whistles, footsteps from bursts of tiny grains.

let engine = null;
const waiting = new Set();

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const midiHz = (midi) => 440 * 2 ** ((midi - 69) / 12);
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

// The engine, or null until the first user gesture has started it.
export function audioEngine() {
  return engine;
}

// Lower the music for a moment (a jingle or a fanfare plays over it).
export function duckMusic(level, seconds) {
  if (!engine) return;
  const now = engine.context.currentTime;
  const gain = engine.music.gain;
  gain.cancelScheduledValues(now);
  gain.setTargetAtTime(level, now, 0.08);
  gain.setTargetAtTime(1, now + seconds, 0.5);
}

// fn(engine) as soon as the engine exists (now, if it already does).
export function onAudio(fn) {
  if (engine) fn(engine);
  else waiting.add(fn);
}

// Create (or wake) the audio. The first call must come from a user gesture.
export function startAudio() {
  if (engine) {
    if (engine.context.state === "suspended" && !document.hidden) engine.context.resume();
    return engine;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  const context = new AudioContext({ latencyHint: "interactive" });
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 8;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  limiter.connect(context.destination);
  const master = context.createGain();
  master.gain.value = 0.9;
  master.connect(limiter);
  const reverb = context.createConvolver();
  reverb.buffer = gardenImpulse(context);
  const wet = context.createGain();
  wet.gain.value = 0.75;
  reverb.connect(wet).connect(master);
  // A bus per kind of sound, each with its own send to the reverb.
  const bus = (send) => {
    const gain = context.createGain();
    gain.connect(master);
    const toReverb = context.createGain();
    toReverb.gain.value = send;
    gain.connect(toReverb).connect(reverb);
    return gain;
  };
  engine = {
    context,
    master,
    sfx: bus(0.16),
    music: bus(0.3),
    nature: bus(0.1),
    white: noiseBuffer(context, "white"),
    pink: noiseBuffer(context, "pink"),
    brown: noiseBuffer(context, "brown"),
  };
  // Quiet while the page is hidden.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) context.suspend();
    else context.resume();
  });
  if (context.state === "suspended") context.resume();
  waiting.forEach((fn) => fn(engine));
  waiting.clear();
  return engine;
}

// ------------------------------------------------------------- buffers --
function noiseBuffer(context, color, seconds = 3) {
  const rate = context.sampleRate;
  const length = Math.floor(rate * seconds);
  const data = new Float32Array(length + Math.floor(rate * 0.05));
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, brown = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (color === "white") data[i] = white * 0.5;
    else if (color === "pink") {
      // Paul Kellet's pink filter.
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    } else {
      brown = (brown + 0.02 * white) / 1.02;
      data[i] = brown * 3.5;
    }
  }
  return loopBuffer(context, [data], length);
}

// A looping buffer `length` samples long from channels rendered a little
// longer: the extra tail is faded into the start, so the loop has no seam.
export function loopBuffer(context, channels, length) {
  const buffer = context.createBuffer(channels.length, length, context.sampleRate);
  channels.forEach((data, channel) => {
    const fade = data.length - length;
    for (let i = 0; i < fade; i += 1) {
      const k = i / fade;
      data[i] = data[i] * k + data[length + i] * (1 - k);
    }
    buffer.getChannelData(channel).set(data.subarray(0, length));
  });
  return buffer;
}

// A soft outdoor reverb: a short pre-delay, a few early reflections off the
// trees and stones, then a tail that loses its highs as it fades.
function gardenImpulse(context, seconds = 2.4) {
  const rate = context.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let low = 0;
    for (let i = 0; i < length; i += 1) {
      const t = i / rate;
      const envelope = t < 0.012 ? 0 : Math.exp(-(t - 0.012) / 0.36);
      const bright = 0.85 - 0.72 * Math.min(1, t / seconds);
      low += bright * (Math.random() * 2 - 1 - low);
      data[i] = low * envelope;
    }
    for (const [time, gain] of [[0.019, 0.55], [0.029, 0.4], [0.043, 0.3], [0.061, 0.22]]) {
      data[Math.floor((time + channel * 0.0031) * rate)] += gain * (channel ? -1 : 1);
    }
  }
  return buffer;
}

// A simple biquad (RBJ) for rendering sounds sample by sample.
export function biquad(type, freq, q, rate) {
  const w = (2 * Math.PI * Math.min(freq, rate * 0.45)) / rate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === "lowpass") [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  else if (type === "highpass") [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  else [b0, b1, b2] = [alpha, 0, -alpha]; // bandpass (0 dB peak)
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

// A mono buffer from a Float32Array, its peak set to `peak`.
export function toBuffer(context, data, peak = 0.9) {
  let max = 0;
  for (let i = 0; i < data.length; i += 1) max = Math.max(max, Math.abs(data[i]));
  const buffer = context.createBuffer(1, data.length, context.sampleRate);
  const out = buffer.getChannelData(0);
  const k = max > 0 ? peak / max : 0;
  for (let i = 0; i < data.length; i += 1) out[i] = data[i] * k;
  return buffer;
}

// ------------------------------------------------------------- voices --
// Where a voice plays: straight into `out`, or panned left or right.
export function outlet(e, out, pan = 0) {
  if (!pan || !e.context.createStereoPanner) return out;
  const panner = e.context.createStereoPanner();
  panner.pan.value = clamp(pan, -1, 1);
  panner.connect(out);
  return panner;
}

// A buffer played once (rate: pitch; gain; an optional filter).
export function play(e, out, time, buffer, { gain = 1, rate = 1, pan = 0, filter = null, offset = 0, duration } = {}) {
  const source = e.context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  const amp = e.context.createGain();
  amp.gain.value = gain;
  let node = source;
  if (filter) {
    const f = e.context.createBiquadFilter();
    f.type = filter.type;
    f.frequency.value = filter.freq;
    f.Q.value = filter.q ?? 0.7;
    node.connect(f);
    node = f;
  }
  node.connect(amp).connect(outlet(e, out, pan));
  source.start(time, offset, duration);
  return { source, amp };
}

// A burst of noise through a filter whose centre glides from `from` to `to`.
export function hiss(e, out, time, { color = "white", type = "bandpass", from = 2000, to = from, q = 0.8, attack = 0.005, length = 0.2, gain = 0.2, pan = 0 } = {}) {
  const { context } = e;
  const source = context.createBufferSource();
  source.buffer = e[color];
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(30, to), time + length);
  const amp = context.createGain();
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.linearRampToValueAtTime(gain, time + attack);
  amp.gain.setTargetAtTime(0, time + attack, Math.max(0.005, (length - attack) / 4));
  source.connect(filter).connect(amp).connect(outlet(e, out, pan));
  source.start(time, Math.random() * (source.buffer.duration - length - 0.1));
  source.stop(time + length + 0.05);
}

// A struck bar, tine or bell: decaying sines at its overtones, each
// [ratio, level, seconds for it to fade to a third].
export function strike(e, out, time, freq, partials, { gain = 0.2, pan = 0, attack = 0.002 } = {}) {
  const { context } = e;
  const dest = outlet(e, out, pan);
  for (const [ratio, level, tau] of partials) {
    const f = freq * ratio;
    if (f > context.sampleRate * 0.42) continue;
    const osc = context.createOscillator();
    osc.frequency.value = f;
    const amp = context.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(level * gain, time + attack);
    amp.gain.setTargetAtTime(0, time + attack, tau);
    osc.connect(amp).connect(dest);
    osc.start(time);
    osc.stop(time + attack + tau * 7);
  }
}

// Overtones of real things.
export const TIMBRE = {
  // A music-box tine (a steel tongue clamped at one end): a pure fundamental
  // with a slightly detuned twin for shimmer, a bright overtone at 6.27x that
  // dies at once, a trace at 17.5x.
  musicBox: (f) => {
    const ring = clamp(1.25 - (f - 500) / 2200, 0.35, 1.3);
    return [[1, 1, ring], [1.0025, 0.3, ring * 0.8], [6.267, 0.2, 0.045], [17.55, 0.05, 0.015]];
  },
  // A glockenspiel bar (free at both ends).
  glock: () => [[1, 1, 0.9], [2.756, 0.3, 0.22], [5.404, 0.1, 0.08], [8.933, 0.035, 0.035]],
  // A small brass handbell.
  bell: () => [[1, 1, 1.3], [2, 0.22, 0.55], [2.42, 0.3, 0.45], [3, 0.12, 0.28], [4.18, 0.07, 0.16], [5.43, 0.04, 0.09]],
  // A celesta: hammered plates over wooden resonators, nearly pure.
  celesta: () => [[1, 1, 0.75], [2, 0.16, 0.28], [3, 0.05, 0.1], [4.07, 0.04, 0.05]],
  // A wooden knock (a hollow block).
  wood: () => [[1, 1, 0.05], [2.57, 0.45, 0.03], [4.1, 0.2, 0.018]],
};

// The tick of a hammer or a pin at the start of a struck note.
export function tick(e, out, time, { freq = 5000, gain = 0.04, pan = 0 } = {}) {
  hiss(e, out, time, { type: "bandpass", from: freq, q: 1.2, attack: 0.0008, length: 0.012, gain, pan });
}

// Plucked strings (harp, guitar) by Karplus-Strong, rendered once per note.
const plucks = new Map();
function pluckBuffer(e, midi, bright, sustain) {
  const key = `${midi}|${bright}|${sustain}`;
  if (plucks.has(key)) return plucks.get(key);
  const rate = e.context.sampleRate;
  const freq = midiHz(midi);
  const period = Math.max(4, Math.round(rate / freq - 0.5));
  const t60 = clamp(2.6 - (midi - 45) * 0.045, 0.7, 3) * sustain;
  const length = Math.floor(rate * Math.min(3.2, t60 * 1.1));
  const data = new Float32Array(length);
  // A finger, not a pick: the burst of noise is softened first.
  let soft = 0;
  const a = 0.15 + bright * 0.7;
  for (let i = 0; i < period; i += 1) {
    soft += a * (Math.random() * 2 - 1 - soft);
    data[i] = soft;
  }
  const loss = 10 ** (-3 / (t60 * freq));
  for (let i = period; i < length; i += 1) data[i] = loss * 0.5 * (data[i - period] + (data[i - period - 1] ?? 0));
  const fade = Math.floor(rate * 0.02);
  for (let i = 0; i < fade; i += 1) data[length - 1 - i] *= i / fade;
  const entry = { buffer: toBuffer(e.context, data, 0.8), rate: freq / (rate / (period + 0.5)) };
  plucks.set(key, entry);
  return entry;
}
export function pluck(e, out, time, midi, { gain = 0.3, pan = 0, bright = 0.5, sustain = 1, lowpass = 0 } = {}) {
  const { buffer, rate } = pluckBuffer(e, midi, bright, sustain);
  play(e, out, time, buffer, { gain, rate, pan, filter: lowpass ? { type: "lowpass", freq: lowpass, q: 0.5 } : null });
}

// A soft chord pad: detuned triangles under a gentle low-pass.
export function pad(e, out, time, midis, duration, { gain = 0.04, attack = 0.9, release = 1.6, cutoff = 1300 } = {}) {
  const { context } = e;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  filter.Q.value = 0.3;
  const amp = context.createGain();
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(gain, time + attack);
  amp.gain.setValueAtTime(gain, time + Math.max(attack, duration));
  amp.gain.setTargetAtTime(0, time + Math.max(attack, duration), release / 4);
  filter.connect(amp).connect(out);
  const stop = time + duration + release * 1.6;
  for (const midi of midis) {
    for (const cents of [-6, 6]) {
      const osc = context.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = midiHz(midi);
      osc.detune.value = cents;
      osc.connect(filter);
      osc.start(time);
      osc.stop(stop);
    }
  }
}

// A bubble's ring: a sine that rises in pitch as it dies away (the sound of
// water, drop by drop). rise: how far it sweeps up (1: like real water).
export function bubble(e, out, time, freq, { gain = 0.1, pan = 0, rise = 1 } = {}) {
  const { context } = e;
  const damping = 0.043 * freq + 0.0014 * freq ** 1.5;
  const tau = 1 / damping;
  const osc = context.createOscillator();
  osc.frequency.setValueAtTime(freq, time);
  osc.frequency.linearRampToValueAtTime(freq * (1 + 0.45 * rise), time + tau * 4);
  const amp = context.createGain();
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(gain, time + 0.0015);
  amp.gain.setTargetAtTime(0, time + 0.0015, tau);
  osc.connect(amp).connect(outlet(e, out, pan));
  osc.start(time);
  osc.stop(time + tau * 7 + 0.01);
}

// One whistled note of birdsong: a sine (and a whisper of its octave) swept
// from f0 through f1 (to f2), with a soft start and end.
function whistle(e, out, time, { f0, f1, f2 = null, length, gain }) {
  const { context } = e;
  const amp = context.createGain();
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(gain, time + Math.min(0.012, length * 0.25));
  amp.gain.setValueAtTime(gain, time + length * 0.7);
  amp.gain.linearRampToValueAtTime(0, time + length);
  amp.connect(out);
  [[1, 1], [2, 0.07]].forEach(([harmonic, level]) => {
    const osc = context.createOscillator();
    const f = osc.frequency;
    f.setValueAtTime(f0 * harmonic, time);
    if (f2) {
      f.exponentialRampToValueAtTime(f1 * harmonic, time + length * 0.5);
      f.exponentialRampToValueAtTime(f2 * harmonic, time + length);
    } else f.exponentialRampToValueAtTime(f1 * harmonic, time + length);
    const g = context.createGain();
    g.gain.value = level;
    osc.connect(g).connect(amp);
    osc.start(time);
    osc.stop(time + length + 0.01);
  });
}

// A songbird's phrase. kind: warbler, chickadee, trill, robin, dove, or
// left out for any of the first four. Returns its length in seconds.
export function birdsong(e, out, time, { kind = pick(["warbler", "chickadee", "trill", "robin"]), gain = 0.05, pan = 0, far = 0 } = {}) {
  const filter = e.context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 9000 - far * 5000; // far birds lose their sparkle
  filter.connect(outlet(e, out, pan));
  let t = time;
  const note = (spec, gap) => {
    whistle(e, filter, t, { gain, ...spec });
    t += spec.length + gap;
  };
  if (kind === "chickadee") {
    // "Fee-bee": two clear falling whistles.
    const top = rand(3700, 4100);
    note({ f0: top, f1: top * 0.97, length: 0.3 }, 0.04);
    note({ f0: top * 0.86, f1: top * 0.83, length: 0.27 }, 0);
  } else if (kind === "trill") {
    note({ f0: rand(2600, 3000), f1: rand(3200, 3600), length: 0.11 }, 0.07);
    const top = rand(4800, 5600);
    const count = 9 + Math.floor(Math.random() * 7);
    for (let i = 0; i < count; i += 1) note({ f0: top, f1: top * 0.74, length: 0.034, gain: gain * (0.7 + 0.3 * Math.sin((i / count) * Math.PI)) }, 0.022);
  } else if (kind === "robin") {
    // Caroling: rising-and-falling notes in little groups.
    const notes = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i += 1) {
      const base = rand(2100, 3100);
      note({ f0: base, f1: base * rand(1.15, 1.3), f2: base * rand(0.85, 1), length: rand(0.13, 0.19) }, rand(0.07, 0.13));
    }
  } else if (kind === "dove") {
    // A soft "coo-COO-coo" far off.
    const base = rand(470, 540);
    [[0.32, 0.9], [0.5, 1.05], [0.28, 0.85], [0.26, 0.8]].forEach(([length, level], i) => {
      note({ f0: base * (i === 1 ? 1.08 : 1), f1: base * (i === 1 ? 0.97 : 0.93), length, gain: gain * level * 1.6 }, i === 0 ? 0.18 : 0.12);
    });
  } else {
    // A warbler: a quick jumble of sweeps.
    const count = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i += 1) {
      const a = rand(3000, 5200);
      const b = a * rand(0.7, 1.35);
      note({ f0: a, f1: b, length: rand(0.05, 0.11) }, rand(0.03, 0.07));
    }
  }
  return t - time;
}
