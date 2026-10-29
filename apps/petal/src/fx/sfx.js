import {
  TIMBRE, audioEngine, biquad, birdsong, bubble, duckMusic, hiss, midiHz, onAudio, outlet, pick, play, pluck, rand, startAudio, strike, tick, toBuffer,
} from "./audio.js";

// The island's sound effects, all synthesised (see fx/audio.js): soft paws
// that crunch on grass, tap on stone and knock on wood; water that really
// bubbles; bells and music-box sparkles; the animals' own voices, panned to
// where they are. Effects start the audio on first use (always after a tap
// or a key press).

let muted = false;
let volume = 0.8;
let listener = null; // the camera, to place animal voices left or right
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

onAudio((e) => {
  e.sfx.gain.value = volume;
});

function ready() {
  if (muted || volume <= 0) return null;
  return startAudio();
}

// Pan and level for a sound at `at`, heard from the camera.
function placeOf(at) {
  if (!at || !listener) return { pan: 0, level: 1 };
  const m = listener.matrixWorld.elements;
  const dx = at.x - m[12];
  const dy = at.y - m[13];
  const dz = at.z - m[14];
  const distance = Math.hypot(dx, dy, dz) || 1;
  const right = (dx * m[0] + dy * m[1] + dz * m[2]) / distance;
  return { pan: clamp(right * 0.8, -0.85, 0.85), level: clamp(2.2 / (1 + distance * 0.35), 0.05, 1) };
}

// A sine (or other wave) gliding from one pitch to another.
function tone(e, time, { from, to = from, length, gain, type = "sine", pan = 0, attack = 0.005, out = e.sfx }) {
  const osc = e.context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), time + length);
  const amp = e.context.createGain();
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(gain, time + attack);
  amp.gain.setTargetAtTime(0, time + attack, Math.max(0.005, (length - attack) / 3));
  osc.connect(amp).connect(outlet(e, out, pan));
  osc.start(time);
  osc.stop(time + length + 0.1);
}

// A glockenspiel or music-box note.
function chimeNote(e, time, midi, gain, { pan = 0, timbre = "glock" } = {}) {
  const f = midiHz(midi);
  strike(e, e.sfx, time, f, TIMBRE[timbre](f), { gain, pan });
  tick(e, e.sfx, time, { freq: Math.min(9000, f * 3), gain: gain * 0.25, pan });
}
const SPARKLE = [84, 86, 89, 91, 93, 96, 98, 101]; // F major pentatonic, high up

// ----------------------------------------------------------- footsteps --
// Each step is a burst of tiny grains (blades, sand, snow crystals) over a
// soft paw thump, and on hard things the knock of what she stands on. A few
// takes of each are rendered once and picked at random.
const STEPS = {
  grass: { length: 0.17, grains: 60, spread: 0.035, grain: [0.0008, 0.003], low: 700, high: 6500, thump: 80, thumpLevel: 0.5, level: 0.32 },
  leaf: { length: 0.2, grains: 95, spread: 0.045, grain: [0.0006, 0.004], low: 1200, high: 9000, thump: 85, thumpLevel: 0.35, level: 0.32 },
  sand: { length: 0.15, grains: 140, spread: 0.03, grain: [0.0003, 0.0012], low: 1400, high: 6000, thump: 75, thumpLevel: 0.45, level: 0.28 },
  snow: { length: 0.2, grains: 80, spread: 0.04, grain: [0.0008, 0.0035], low: 600, high: 5000, ring: 1300, thump: 70, thumpLevel: 0.35, level: 0.34 },
  stone: { length: 0.1, grains: 8, spread: 0.008, grain: [0.0004, 0.0015], low: 1800, high: 7000, thump: 120, thumpLevel: 0.55, level: 0.24 },
  wood: {
    length: 0.16, grains: 6, spread: 0.006, grain: [0.0004, 0.001], low: 900, high: 5000, thump: 95, thumpLevel: 0.3, level: 0.3,
    modes: [[190, 0.55, 0.05], [420, 0.35, 0.035], [760, 0.18, 0.022], [1180, 0.08, 0.014]],
  },
  metal: {
    length: 0.3, grains: 4, spread: 0.004, grain: [0.0003, 0.0008], low: 2000, high: 9000, thump: 110, thumpLevel: 0.2, level: 0.18,
    modes: [[620, 0.18, 0.12], [1410, 0.12, 0.08], [2500, 0.07, 0.05], [3890, 0.04, 0.03]],
  },
  cloth: { length: 0.12, grains: 30, spread: 0.03, grain: [0.002, 0.006], low: 300, high: 2500, thump: 70, thumpLevel: 0.3, level: 0.16 },
  water: { length: 0.24, grains: 50, spread: 0.05, grain: [0.002, 0.008], low: 500, high: 3500, thump: 90, thumpLevel: 0.25, bubbles: 3, level: 0.3 },
};
const takes = new Map();

function renderStep(rate, recipe) {
  const length = Math.floor(rate * recipe.length);
  const data = new Float32Array(length);
  for (let g = 0; g < recipe.grains; g += 1) {
    const at = Math.min(length - 1, Math.floor(rate * (0.003 - recipe.spread * Math.log(1 - Math.random() * 0.98))));
    const size = Math.floor(rate * rand(recipe.grain[0], recipe.grain[1]));
    const level = Math.random() ** 2 * (1 - at / length);
    for (let i = 0; i < size && at + i < length; i += 1) data[at + i] += (Math.random() * 2 - 1) * level * Math.exp((-3 * i) / size);
  }
  const high = biquad("highpass", recipe.low, 0.7, rate);
  const low = biquad("lowpass", recipe.high, 0.7, rate);
  const ring = recipe.ring ? biquad("bandpass", recipe.ring, 4, rate) : null;
  for (let i = 0; i < length; i += 1) {
    const x = low(high(data[i]));
    data[i] = ring ? x * 0.6 + ring(x) * 1.8 : x;
  }
  // Normalise the grains, then add the paw's thump and any knock.
  let peak = 0;
  for (let i = 0; i < length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > 0) for (let i = 0; i < length; i += 1) data[i] /= peak;
  const thump = recipe.thump * rand(0.9, 1.1);
  const knock = rand(0.94, 1.06);
  for (let i = 0; i < length; i += 1) {
    const t = i / rate;
    const attack = Math.min(1, t / 0.0015);
    data[i] += Math.sin(2 * Math.PI * thump * t) * attack * Math.exp(-t / 0.022) * recipe.thumpLevel;
    for (const [f, level, tau] of recipe.modes || []) data[i] += Math.sin(2 * Math.PI * f * knock * t) * attack * level * Math.exp(-t / tau);
  }
  for (let b = 0; b < (recipe.bubbles || 0); b += 1) {
    const f0 = rand(500, 1200);
    const damping = 0.043 * f0 + 0.0014 * f0 ** 1.5;
    const start = Math.floor(rate * rand(0.01, 0.1));
    let phase = 0;
    for (let i = start; i < length; i += 1) {
      const t = (i - start) / rate;
      phase += (2 * Math.PI * f0 * (1 + 0.1 * damping * t)) / rate;
      data[i] += Math.sin(phase) * Math.exp(-t * damping) * 0.5;
    }
  }
  const fade = Math.floor(rate * 0.01);
  for (let i = 0; i < fade; i += 1) data[length - 1 - i] *= i / fade;
  return data;
}
function stepTake(e, material) {
  if (!takes.has(material)) {
    const recipe = STEPS[material];
    takes.set(material, Array.from({ length: 6 }, () => toBuffer(e.context, renderStep(e.context.sampleRate, recipe), 0.9)));
  }
  return pick(takes.get(material));
}
const lastStep = new Map();

// ------------------------------------------------------- rendered calls --
let purrTake = null;
function renderPurr(rate) {
  // A cat's purr: soft pulses of breathy noise, ~25 a second, out then in.
  const length = Math.floor(rate * 2.3);
  const data = new Float32Array(length);
  let smooth = 0;
  let phase = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / rate;
    const out = t < 1.05;
    const breath = out ? Math.sin((Math.PI * t) / 1.05) : t > 1.2 ? Math.sin((Math.PI * (t - 1.2)) / 1.05) * 0.7 : 0;
    phase += (out ? 26 : 23) / rate;
    const pulse = Math.exp(-(phase % 1) * 9);
    smooth += 0.05 * (Math.random() * 2 - 1 - smooth);
    data[i] = smooth * pulse * Math.max(0, breath);
  }
  return data;
}
let creakTake = null;
function renderCreak(rate) {
  // A rope creaking on its branch: stick-slip ticks, quick then slow, ringing
  // the rope and the wood at their own pitches.
  const length = Math.floor(rate * 0.45);
  const data = new Float32Array(length);
  let phase = 0;
  for (let i = 0; i < length; i += 1) {
    const k = i / length;
    phase += (38 + 36 * Math.sin(Math.PI * k) + 8 * Math.sin(k * 13)) / rate;
    if (phase >= 1) {
      phase -= 1;
      data[i] = (0.6 + Math.random() * 0.4) * Math.sin(Math.PI * k);
    }
  }
  const bands = [[650, 9, 1], [1350, 12, 0.6], [2450, 14, 0.35]].map(([f, q, g]) => [biquad("bandpass", f, q, rate), g]);
  for (let i = 0; i < length; i += 1) {
    const x = data[i];
    let y = 0;
    for (const [band, g] of bands) y += band(x) * g;
    data[i] = y;
  }
  return data;
}

// A duck's quack: a reedy buzz through the formants of its bill.
function quackVoice(e, time, { pitch = 1, gain = 0.5, pan = 0 }) {
  const { context } = e;
  const length = 0.15;
  const source = context.createOscillator();
  source.type = "sawtooth";
  const f0 = 300 * pitch;
  source.frequency.setValueAtTime(f0 * 1.06, time);
  source.frequency.linearRampToValueAtTime(f0, time + 0.03);
  source.frequency.linearRampToValueAtTime(f0 * 0.82, time + length);
  const rasp = context.createGain();
  rasp.gain.value = 0.7;
  const flutter = context.createOscillator();
  flutter.frequency.value = 38;
  const depth = context.createGain();
  depth.gain.value = 0.3;
  flutter.connect(depth).connect(rasp.gain);
  source.connect(rasp);
  const amp = context.createGain();
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(gain, time + 0.012);
  amp.gain.setValueAtTime(gain, time + 0.07);
  amp.gain.linearRampToValueAtTime(0, time + length);
  amp.connect(outlet(e, e.sfx, pan));
  for (const [f, q, level] of [[620, 3, 0.6], [1150, 5, 1], [2600, 7, 0.45]]) {
    const band = context.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = f;
    band.Q.value = q;
    const g = context.createGain();
    g.gain.value = level;
    rasp.connect(band).connect(g).connect(amp);
  }
  for (const node of [source, flutter]) {
    node.start(time);
    node.stop(time + length + 0.02);
  }
}

// A frog's croak: a low buzz chopped into pulses, through its throat's resonances.
function croak(e, time, { pitch = 1, length = 0.1, gain = 0.5, pan = 0 }) {
  const { context } = e;
  const source = context.createOscillator();
  source.type = "sawtooth";
  source.frequency.value = 100 * pitch;
  const chop = context.createGain();
  chop.gain.value = 0.5;
  const pulses = context.createOscillator();
  pulses.type = "square";
  pulses.frequency.value = 30 * pitch;
  const depth = context.createGain();
  depth.gain.value = 0.5;
  pulses.connect(depth).connect(chop.gain);
  source.connect(chop);
  const amp = context.createGain();
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(gain, time + 0.01);
  amp.gain.setValueAtTime(gain, time + length * 0.6);
  amp.gain.linearRampToValueAtTime(0, time + length);
  amp.connect(outlet(e, e.sfx, pan));
  for (const [f, q, level] of [[480, 4, 1], [1350, 6, 0.5]]) {
    const band = context.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = f * pitch;
    band.Q.value = q;
    const g = context.createGain();
    g.gain.value = level;
    chop.connect(band).connect(g).connect(amp);
  }
  for (const node of [source, pulses]) {
    node.start(time);
    node.stop(time + length + 0.02);
  }
}

// ------------------------------------------------------------------ api --
export const sfx = {
  setMuted(value) { muted = value; },
  setVolume(value) {
    volume = clamp(value, 0, 1);
    const e = audioEngine();
    if (e) e.sfx.gain.value = volume;
  },
  // The camera the animals' voices are placed around.
  listen(camera) { listener = camera; },

  // A footstep on this material. who: whose feet (each walks at its own
  // pace); snow: a snowy day turns grass and leaves to crunchy snow.
  step(material = "grass", run = false, { who = "you", volume: level = 1, snow = false } = {}) {
    const e = ready();
    if (!e) return;
    const now = performance.now();
    if (now - (lastStep.get(who) || 0) < 90) return;
    lastStep.set(who, now);
    let kind = STEPS[material] ? material : "grass";
    if (snow && (kind === "grass" || kind === "leaf" || kind === "sand")) kind = "snow";
    play(e, e.sfx, e.context.currentTime, stepTake(e, kind), {
      gain: STEPS[kind].level * level * (run ? 1.25 : 1) * rand(0.85, 1.1),
      rate: rand(0.94, 1.06) * (run ? 1.04 : 1),
    });
  },
  // Up she goes: a soft whoosh of fur and ears, and a tiny happy "hup".
  jump() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    hiss(e, e.sfx, t, { color: "pink", from: 500, to: 1800, q: 1.1, attack: 0.03, length: 0.17, gain: 0.55 });
    tone(e, t, { from: 420, to: 700, length: 0.09, gain: 0.06 });
  },
  // Back down: a soft thud and whatever is underfoot.
  land(material = "grass") {
    const e = ready();
    if (!e) return;
    tone(e, e.context.currentTime, { from: 90, to: 55, length: 0.1, gain: 0.22, attack: 0.002 });
    lastStep.delete("you");
    sfx.step(material, true, { volume: 1.3 });
  },
  // The host's little hops.
  hop() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    tone(e, t, { from: 330, to: 560, length: 0.08, gain: 0.05 });
    hiss(e, e.sfx, t, { color: "pink", from: 700, to: 1500, q: 1, attack: 0.02, length: 0.12, gain: 0.22 });
  },
  // The clouds parting: a long, soft rush of air and a sprinkle of bells.
  whoosh() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    hiss(e, e.sfx, t, { color: "pink", from: 300, to: 1400, q: 0.6, attack: 0.9, length: 2.6, gain: 0.35, pan: -0.3 });
    hiss(e, e.sfx, t + 0.35, { color: "pink", from: 1800, to: 500, q: 0.7, attack: 0.8, length: 2.2, gain: 0.2, pan: 0.4 });
    SPARKLE.forEach((midi, i) => chimeNote(e, t + 0.5 + i * 0.11, midi, 0.035, { pan: rand(-0.6, 0.6) }));
  },
  // Catching its breath: quick breathy huffs, one every 0.3 s at first,
  // slowing and softening as it recovers (in time with the rig's heaves).
  pant(seconds = 2.4) {
    const e = ready();
    if (!e) return;
    const start = e.context.currentTime;
    for (let at = 0.05; at < seconds - 0.25; at += 0.3 + Math.min(1, at / seconds) * 0.12) {
      const k = Math.min(1, at / seconds);
      hiss(e, e.sfx, start + at, { color: "pink", from: 1300, to: 800, q: 1.2, attack: 0.025, length: 0.17, gain: 0.18 * (1 - k * 0.55) });
      tone(e, start + at, { from: 600, to: 500, length: 0.08, gain: 0.01 * (1 - k * 0.5) });
    }
  },
  // Ear flaps while gliding.
  flutter() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    for (let i = 0; i < 5; i += 1) {
      hiss(e, e.sfx, t + i * 0.075, { color: "pink", from: 900, to: 600, q: 0.9, attack: 0.01, length: 0.05, gain: 0.32 * (1 - i * 0.12) });
    }
  },
  // Something appears: a bubbly pop and a glint.
  pop() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    bubble(e, e.sfx, t, rand(650, 850), { gain: 0.3, rise: 2.4 });
    tick(e, e.sfx, t, { freq: 3500, gain: 0.05 });
    chimeNote(e, t + 0.03, pick([96, 98, 101]), 0.05);
  },
  // Something vanishes: a soft puff and three falling glints.
  poof() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    hiss(e, e.sfx, t, { color: "pink", type: "lowpass", from: 2600, to: 300, q: 0.5, attack: 0.01, length: 0.32, gain: 0.16 });
    [96, 93, 89].forEach((midi, i) => chimeNote(e, t + 0.04 + i * 0.05, midi, 0.035));
  },
  ding() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    strike(e, e.sfx, t, midiHz(84), TIMBRE.bell(), { gain: 0.15 });
    strike(e, e.sfx, t + 0.07, midiHz(91), TIMBRE.bell(), { gain: 0.09 });
  },
  // One clear note of a music box (the path's chiming heart stones).
  note(midi) {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    strike(e, e.sfx, t, midiHz(midi), TIMBRE.bell(), { gain: 0.17 });
    chimeNote(e, t + 0.012, midi + 12, 0.035);
  },
  // Wind chimes: a few bright notes, each from a different side.
  chime() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    const notes = [88, 91, 93, 96, 98].sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 2)).sort((a, b) => a - b);
    let at = t;
    for (const midi of notes) {
      chimeNote(e, at, midi, 0.08, { pan: rand(-0.4, 0.4) });
      at += rand(0.07, 0.12);
    }
  },
  // A quick sparkle of tiny bells.
  twinkle() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    for (let i = 0; i < 5; i += 1) chimeNote(e, t + i * 0.045, pick(SPARKLE.slice(3)), rand(0.05, 0.08), { pan: rand(-0.5, 0.5) });
  },
  // Ta-da! A harp strum, a bell chord and a shimmer.
  fanfare() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    duckMusic(0.55, 1.4);
    [65, 69, 72, 77].forEach((midi, i) => pluck(e, e.sfx, t + i * 0.04, midi, { gain: 0.22, bright: 0.6 }));
    [81, 84, 89].forEach((midi) => chimeNote(e, t + 0.2, midi, 0.08, { timbre: "musicBox" }));
    for (let i = 0; i < 8; i += 1) chimeNote(e, t + 0.28 + i * 0.1 + rand(0, 0.04), pick(SPARKLE), 0.03, { pan: rand(-0.6, 0.6) });
  },
  // A heart found: two bright notes and a shimmer.
  coin() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    chimeNote(e, t, 95, 0.1);
    chimeNote(e, t + 0.08, 100, 0.1);
    for (let i = 0; i < 4; i += 1) chimeNote(e, t + 0.2 + i * 0.06, pick(SPARKLE.slice(4)), 0.03, { pan: rand(-0.5, 0.5) });
  },
  // A twirl: a glissando of bells rising, and a swirl of air.
  twirl() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    [77, 79, 81, 84, 86, 89, 91, 93, 96].forEach((midi, i) => chimeNote(e, t + i * 0.055, midi, 0.035 + i * 0.003, { pan: Math.sin(i * 0.9) * 0.5 }));
    hiss(e, e.sfx, t, { color: "pink", from: 600, to: 2400, q: 1.2, attack: 0.2, length: 0.6, gain: 0.06 });
  },
  // The bunnies' dance tune: a music-box waltz over a plucked bass.
  jingle() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime + 0.05;
    const eighth = 0.16;
    duckMusic(0.3, 3.4);
    const tune = [84, 89, 93, 89, 84, 89, 82, 86, 89, 86, 82, 86, 84, 88, 91, 88];
    tune.forEach((midi, i) => chimeNote(e, t + i * eighth, midi, i % 3 === 0 ? 0.1 : 0.075, { timbre: "musicBox" }));
    chimeNote(e, t + 16 * eighth, 89, 0.12, { timbre: "musicBox" });
    chimeNote(e, t + 16 * eighth, 93, 0.06);
    [[0, 53], [3, 60], [6, 46], [9, 53], [12, 48], [15, 55], [16, 41]].forEach(([at, midi]) => pluck(e, e.sfx, t + at * eighth, midi, { gain: 0.2, bright: 0.35, lowpass: 1600 }));
  },
  // A soft paw clap.
  clap() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    const pan = rand(-0.15, 0.15);
    hiss(e, e.sfx, t, { from: 1100, q: 1.4, attack: 0.001, length: 0.05, gain: 0.2, pan });
    hiss(e, e.sfx, t + 0.008, { from: 1500, q: 1.4, attack: 0.001, length: 0.04, gain: 0.12, pan });
    hiss(e, e.sfx, t, { color: "pink", from: 900, q: 0.8, attack: 0.002, length: 0.12, gain: 0.05, pan });
  },
  // A big heart: a sweet bell chord and a bubble floating up.
  kiss() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    [89, 93, 96].forEach((midi, i) => chimeNote(e, t + i * 0.02, midi, 0.07, { timbre: "celesta" }));
    bubble(e, e.sfx, t + 0.05, 900, { gain: 0.14, rise: 3 });
  },
  // Into the pond: a splash, a plunk, and a cloud of bubbles.
  splash() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    hiss(e, e.sfx, t, { color: "pink", from: 2500, to: 900, q: 0.6, attack: 0.004, length: 0.55, gain: 0.5 });
    hiss(e, e.sfx, t, { type: "highpass", from: 3000, to: 2000, q: 0.5, attack: 0.004, length: 0.3, gain: 0.1 });
    tone(e, t, { from: 170, to: 85, length: 0.12, gain: 0.2, attack: 0.002 });
    for (let i = 0; i < 16; i += 1) {
      bubble(e, e.sfx, t + rand(0.03, 0.6), 320 * (1300 / 320) ** Math.random(), { gain: rand(0.04, 0.12), pan: rand(-0.3, 0.3) });
    }
  },
  // Wading: water sloshing round her legs.
  wade() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    hiss(e, e.sfx, t, { color: "pink", from: 1100, to: 700, q: 0.8, attack: 0.06, length: 0.3, gain: 0.2 });
    for (let i = 0; i < 4; i += 1) bubble(e, e.sfx, t + rand(0.02, 0.25), rand(400, 1100), { gain: rand(0.05, 0.1) });
  },
  quack(at) {
    const e = ready();
    if (!e) return;
    const { pan, level } = placeOf(at);
    const t = e.context.currentTime;
    const count = 2 + Math.floor(Math.random() * 2);
    const pitch = rand(0.9, 1.1);
    for (let i = 0; i < count; i += 1) quackVoice(e, t + i * rand(0.17, 0.22), { pitch: pitch * (1 - i * 0.04), gain: 0.55 * level * (1 - i * 0.15), pan });
  },
  ribbit(at) {
    const e = ready();
    if (!e) return;
    const { pan, level } = placeOf(at);
    const t = e.context.currentTime;
    const pitch = rand(0.9, 1.15);
    croak(e, t, { pitch, length: 0.11, gain: 0.5 * level, pan });
    croak(e, t + 0.17, { pitch: pitch * 1.12, length: 0.09, gain: 0.42 * level, pan });
  },
  chirp(at) {
    const e = ready();
    if (!e) return;
    const { pan, level } = placeOf(at);
    birdsong(e, e.sfx, e.context.currentTime, { kind: pick(["warbler", "robin"]), gain: 0.09 * level, pan });
  },
  purr() {
    const e = ready();
    if (!e) return;
    purrTake ||= toBuffer(e.context, renderPurr(e.context.sampleRate), 0.9);
    play(e, e.sfx, e.context.currentTime, purrTake, { gain: 0.35, filter: { type: "lowpass", freq: 700, q: 0.5 } });
  },
  // An owl far off: "hoo… hoo-hoo".
  hoot(at) {
    const e = ready();
    if (!e) return;
    const { pan, level } = placeOf(at);
    const t = e.context.currentTime;
    const f = rand(360, 420);
    [[0, 0.42], [0.62, 0.22], [0.9, 0.5]].forEach(([dt, length]) => {
      tone(e, t + dt, { from: f, to: f * 0.94, length, gain: 0.12 * level, attack: 0.06, pan });
      hiss(e, e.sfx, t + dt, { color: "pink", from: f, q: 9, attack: 0.06, length, gain: 0.08 * level, pan });
    });
  },
  // Carving: a knife's scritch on bark.
  carve() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    for (let i = 0; i < 3; i += 1) hiss(e, e.sfx, t + i * 0.03, { from: rand(2500, 4500), q: 3, attack: 0.002, length: rand(0.02, 0.04), gain: 0.35 });
  },
  // The swing's rope creaks on its branch as it passes.
  swing() {
    const e = ready();
    if (!e) return;
    const t = e.context.currentTime;
    creakTake ||= toBuffer(e.context, renderCreak(e.context.sampleRate), 0.9);
    play(e, e.sfx, t, creakTake, { gain: 0.16, rate: rand(0.9, 1.1) });
    hiss(e, e.sfx, t, { color: "pink", from: 400, to: 700, q: 0.7, attack: 0.15, length: 0.5, gain: 0.04 });
  },
};
