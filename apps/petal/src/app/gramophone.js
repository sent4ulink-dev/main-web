import { midiHz, pluck, rand, strike } from "../fx/audio.js";

// The Music Isle's gramophone: an original little musette waltz in G major,
// the kind an old dance hall played. A double-reed accordion sings the tune
// (two reeds tuned a hair apart, the musette's warble), a plucked bass gives
// the "oom" and short piano chords the "pah-pah". All of it comes out through
// a gramophone: a narrow, honky band, a little warmth, a slow wobble in the
// pitch and the crackle of the record. It plays as loud as you are near it
// (setPresence), and fully while the two of you dance.

const TEMPO = 132; // beats a minute, three to the bar
const BEAT = 60 / TEMPO;

const CHORDS = {
  G: [55, 59, 62], D7: [54, 57, 60, 62], C: [55, 60, 64], Em: [55, 59, 64], Am: [57, 60, 64], B7: [54, 57, 59, 63],
  G7: [53, 59, 62], GD: [55, 59, 62],
};
// Bass: the root, and the fifth on a chord's second bar (the old waltz way).
const BASS = { G: [43, 38], D7: [38, 45], C: [36, 43], Em: [40, 47], Am: [45, 40], B7: [35, 42], G7: [43, 38], GD: [38, 43] };
const PROGRESSION = [
  "G", "G", "D7", "D7", "D7", "D7", "G", "G", "G", "G7", "C", "C", "GD", "D7", "G", "G",
  "Em", "Em", "B7", "B7", "B7", "B7", "Em", "Em", "Am", "D7", "G", "Em", "Am", "D7", "G", "G",
];
// The tune, bar by bar: [beat, note, beats long].
const TUNE = [
  [[0, 71, 1], [1, 74, 1], [2, 79, 1]],
  [[0, 78, 2], [2, 79, 1]],
  [[0, 81, 1], [1, 78, 1], [2, 74, 1]],
  [[0, 72, 3]],
  [[0, 72, 1], [1, 74, 1], [2, 78, 1]],
  [[0, 81, 2], [2, 79, 1]],
  [[0, 78, 1], [1, 76, 1], [2, 74, 1]],
  [[0, 71, 3]],
  [[0, 71, 1], [1, 74, 1], [2, 79, 1]],
  [[0, 83, 2], [2, 81, 1]],
  [[0, 79, 1], [1, 76, 1], [2, 72, 1]],
  [[0, 76, 3]],
  [[0, 74, 1], [1, 79, 1], [2, 83, 1]],
  [[0, 81, 1.5], [1.5, 78, 0.5], [2, 74, 1]],
  [[0, 79, 2], [2, 74, 1]],
  [[0, 79, 3]],
  [[0, 71, 1], [1, 76, 1], [2, 79, 1]],
  [[0, 83, 2], [2, 79, 1]],
  [[0, 78, 1], [1, 75, 1], [2, 71, 1]],
  [[0, 81, 3]],
  [[0, 81, 1], [1, 78, 1], [2, 75, 1]],
  [[0, 72, 2], [2, 71, 1]],
  [[0, 71, 1], [1, 76, 1], [2, 79, 1]],
  [[0, 76, 3]],
  [[0, 72, 1], [1, 76, 1], [2, 81, 1]],
  [[0, 78, 1], [1, 81, 1], [2, 84, 1]],
  [[0, 83, 2], [2, 79, 1]],
  [[0, 76, 1], [1, 79, 1], [2, 83, 1]],
  [[0, 84, 2], [2, 81, 1]],
  [[0, 78, 1], [1, 81, 1], [2, 74, 1]],
  [[0, 79, 1], [1, 74, 1], [2, 71, 1]],
  [[0, 67, 3]],
];
// An upright piano's short chord: a hammered string's first few overtones.
const PIANO = [[1, 1, 0.22], [2, 0.45, 0.16], [3, 0.22, 0.1], [4, 0.1, 0.07]];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// The record's crackle and hiss, rendered once: sparse ticks and pops with
// short tails over a whisper of surface noise.
function crackleBuffer(context) {
  const rate = context.sampleRate;
  const length = Math.floor(rate * 4);
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  let hiss = 0;
  for (let i = 0; i < length; i += 1) {
    hiss += 0.35 * (Math.random() * 2 - 1 - hiss);
    data[i] = hiss * 0.025;
  }
  const pops = Math.floor(4 * 28);
  for (let k = 0; k < pops; k += 1) {
    const at = Math.floor(Math.random() * (length - 400));
    const size = Math.random() ** 3 * 0.9 + 0.05;
    const tail = 20 + Math.floor(Math.random() * 220);
    for (let j = 0; j < tail; j += 1) data[at + j] += size * (Math.random() * 2 - 1) * Math.exp(-j / (tail * 0.25));
  }
  return buffer;
}

export function createGramophone(e) {
  const { context } = e;
  // The gramophone itself: band-limited, a little honk from the horn, warm,
  // wobbling slowly, then panned to where it stands.
  const input = context.createGain();
  const low = context.createBiquadFilter();
  low.type = "highpass";
  low.frequency.value = 300;
  const high = context.createBiquadFilter();
  high.type = "lowpass";
  high.frequency.value = 3600;
  high.Q.value = 0.9;
  const horn = context.createBiquadFilter();
  horn.type = "peaking";
  horn.frequency.value = 1500;
  horn.gain.value = 4;
  horn.Q.value = 0.9;
  const warm = context.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 1.6) / Math.tanh(1.6);
  warm.curve = curve;
  const wobble = context.createDelay(0.05);
  wobble.delayTime.value = 0.012;
  const wow = context.createOscillator();
  wow.frequency.value = 0.55;
  const wowDepth = context.createGain();
  wowDepth.gain.value = 0.0011;
  wow.connect(wowDepth).connect(wobble.delayTime);
  wow.start();
  const out = context.createGain();
  out.gain.value = 0;
  const panner = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
  input.connect(low).connect(high).connect(horn).connect(warm).connect(wobble).connect(out).connect(panner).connect(e.music);
  const crackle = context.createGain();
  crackle.gain.value = 0.7;
  crackle.connect(out);
  let crackleSource = null;
  let surface = null; // the crackle loop, rendered the first time it plays

  let timer = null;
  let next = 0;
  let beat = 0;
  let presence = 0;
  let quietSince = 0;

  function reedNote(time, midi, beats) {
    const length = beats * BEAT * 0.92;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2600;
    filter.Q.value = 1;
    const amp = context.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(0.06, time + 0.03);
    amp.gain.setValueAtTime(0.055, time + Math.max(0.04, length - 0.06));
    amp.gain.linearRampToValueAtTime(0, time + length + 0.08);
    filter.connect(amp).connect(input);
    // A gentle vibrato on long notes, as the bellows breathe.
    const vibrato = context.createOscillator();
    vibrato.frequency.value = 5.2;
    const depth = context.createGain();
    depth.gain.setValueAtTime(0, time);
    depth.gain.linearRampToValueAtTime(beats >= 2 ? 7 : 2, time + Math.min(0.5, length));
    vibrato.connect(depth);
    const stop = time + length + 0.12;
    for (const [cents, level] of [[-11, 1], [11, 1], [-1200, 0.35]]) {
      const reed = context.createOscillator();
      reed.type = "sawtooth";
      reed.frequency.value = midiHz(midi);
      reed.detune.value = cents;
      depth.connect(reed.detune);
      const mix = context.createGain();
      mix.gain.value = level * 0.33;
      reed.connect(mix).connect(filter);
      reed.start(time);
      reed.stop(stop);
    }
    vibrato.start(time);
    vibrato.stop(stop);
  }

  function playBeat(index, time) {
    const bar = Math.floor(index / 3) % PROGRESSION.length;
    const inBar = index % 3;
    const name = PROGRESSION[bar];
    const second = bar > 0 && PROGRESSION[bar - 1] === name;
    if (inBar === 0) pluck(e, input, time, BASS[name][second ? 1 : 0], { gain: 0.28, bright: 0.25, sustain: 0.6 });
    else {
      for (const midi of CHORDS[name]) {
        strike(e, input, time + rand(0, 0.008), midiHz(midi), PIANO, { gain: inBar === 1 ? 0.05 : 0.04, pan: rand(-0.1, 0.1) });
      }
    }
    for (const [at, midi, beats] of TUNE[bar]) {
      if (Math.floor(at) === inBar) reedNote(time + (at - inBar) * BEAT + rand(0, 0.008), midi, beats);
    }
  }

  function schedule() {
    const now = context.currentTime;
    if (next < now) next = now + 0.05;
    while (next < now + 0.4) {
      playBeat(beat, next);
      next += BEAT;
      beat = (beat + 1) % (PROGRESSION.length * 3);
    }
    // Far away for a while: the record stops turning (it starts again from
    // the top when you come back).
    if (presence < 0.005) {
      if (!quietSince) quietSince = now;
      else if (now - quietSince > 2.5) stopPlaying();
    } else quietSince = 0;
  }

  function startPlaying() {
    if (timer) return;
    beat = 0;
    next = context.currentTime + 0.1;
    crackleSource = context.createBufferSource();
    surface ??= crackleBuffer(context);
    crackleSource.buffer = surface;
    crackleSource.loop = true;
    crackleSource.connect(crackle);
    crackleSource.start();
    timer = setInterval(schedule, 100);
    schedule();
  }

  function stopPlaying() {
    clearInterval(timer);
    timer = null;
    crackleSource?.stop();
    crackleSource = null;
  }

  return {
    get playing() { return Boolean(timer); },
    // level 0..1 (how near, already scaled by the music volume), pan -1..1.
    setPresence(level, pan = 0) {
      presence = clamp(level, 0, 1);
      const now = context.currentTime;
      out.gain.setTargetAtTime(presence, now, 0.4);
      if (panner.pan) panner.pan.setTargetAtTime(clamp(pan, -0.85, 0.85), now, 0.3);
      if (presence > 0.005) startPlaying();
    },
    stop() {
      presence = 0;
      out.gain.setTargetAtTime(0, context.currentTime, 0.2);
      setTimeout(() => presence < 0.005 && stopPlaying(), 600);
    },
    dispose() {
      stopPlaying();
      wow.stop();
    },
  };
}
