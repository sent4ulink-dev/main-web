import { TIMBRE, midiHz, pad, pick, pluck, rand, strike, tick } from "../fx/audio.js";

// The island's lullaby: an original little waltz in F major for music box,
// harp, a soft pad and a few glockenspiel sparkles. It goes round two
// sixteen-bar halves and is never quite the same twice: the melody moves
// between music box and celesta, picks up little grace notes and octaves,
// and the sparkles fall where they like. At night it plays softer and
// simpler; in the rain it sounds muffled, as if from indoors.

const TEMPO = 76; // beats a minute, three to the bar
const BEAT = 60 / TEMPO;
const BARS = 32;

const CHORDS = {
  F: [53, 57, 60], Dm: [50, 53, 57], Bb: [46, 50, 53], C: [48, 52, 55], Am: [45, 48, 52], Gm: [43, 46, 50], C7: [48, 52, 55, 58],
};
const PROGRESSION = [
  "F", "Dm", "Bb", "C", "F", "Am", "Bb", "C", "Dm", "Am", "Bb", "F", "Gm", "C", "F", "F",
  "Bb", "C", "Am", "Dm", "Gm", "C", "F", "F", "Bb", "C", "Am", "Dm", "Gm", "C7", "F", "F",
];
// The tune, bar by bar: [beat, note, beats long].
const TUNE = [
  [[0, 81, 2], [2, 84, 1]],
  [[0, 81, 1], [1, 77, 1], [2, 74, 1]],
  [[0, 77, 2], [2, 79, 1]],
  [[0, 76, 2], [2, 72, 1]],
  [[0, 81, 2], [2, 84, 1]],
  [[0, 88, 1], [1, 86, 1], [2, 84, 1]],
  [[0, 86, 1.5], [1.5, 84, 0.5], [2, 82, 1]],
  [[0, 79, 3]],
  [[0, 77, 1], [1, 81, 1], [2, 86, 1]],
  [[0, 84, 2], [2, 81, 1]],
  [[0, 82, 1], [1, 86, 1], [2, 89, 1]],
  [[0, 88, 1], [1, 84, 2]],
  [[0, 86, 1], [1, 82, 1], [2, 79, 1]],
  [[0, 81, 1], [1, 79, 1], [2, 76, 1]],
  [[0, 77, 3]],
  [[2, 72, 1]],
  [[0, 74, 1], [1, 77, 1], [2, 82, 1]],
  [[0, 81, 2], [2, 79, 1]],
  [[0, 76, 1], [1, 81, 1], [2, 84, 1]],
  [[0, 81, 3]],
  [[0, 82, 1], [1, 81, 1], [2, 79, 1]],
  [[0, 76, 1], [1, 79, 1], [2, 84, 1]],
  [[0, 81, 1.5], [1.5, 79, 0.5], [2, 77, 1]],
  [[0, 77, 2], [2, 81, 1]],
  [[0, 86, 2], [2, 84, 1]],
  [[0, 82, 1], [1, 81, 1], [2, 79, 1]],
  [[0, 84, 1], [1, 76, 1], [2, 81, 1]],
  [[0, 77, 2], [2, 74, 1]],
  [[0, 79, 1], [1, 82, 1], [2, 86, 1]],
  [[0, 84, 1], [1, 82, 1], [2, 76, 1]],
  [[0, 77, 3]],
  [[0, 84, 0.5], [0.5, 89, 0.5], [1, 93, 2]],
];
const SCALE = [0, 2, 4, 5, 7, 9, 10]; // F major's pitch classes, for grace notes
const SPARKLES = [89, 91, 93, 96, 98];
// The harp's pattern through each bar, eighth by eighth after the bass:
// [chord tone, octave up].
const HARP = [[2, 0], [0, 12], [1, 12], [2, 12], [1, 12]];

const stepAbove = (midi) => {
  const pitch = ((midi % 12) + 12) % 12;
  const next = SCALE.find((n) => n > pitch);
  return next === undefined ? midi - pitch + 12 : midi - pitch + next;
};

export function createMusic(e) {
  const out = e.context.createGain();
  out.gain.value = 0;
  const muffle = e.context.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 14000;
  muffle.Q.value = 0.4;
  muffle.connect(out).connect(e.music);
  let level = 0.6;
  let playing = false;
  let timer = null;
  let next = 0; // audio time of the next beat
  let beat = 0; // beat in the 32-bar round
  let round = 0;
  const mood = { night: 0, rain: 0 };

  function melodyNote(time, midi, beats, accent) {
    const night = mood.night > 0.5;
    const celesta = night || round % 3 === 1;
    const note = celesta ? midi - 12 : midi;
    const f = midiHz(note);
    const gain = (celesta ? 0.15 : 0.11) * (accent ? 1.1 : 0.92) * (night ? 0.75 : 1);
    strike(e, muffle, time, f, celesta ? TIMBRE.celesta(f) : TIMBRE.musicBox(f), { gain, pan: rand(-0.08, 0.08) });
    tick(e, muffle, time, { freq: Math.min(8000, f * 3), gain: gain * 0.1 });
    // Now and then a grace note from the step above, or an octave on top.
    if (beats >= 1 && Math.random() < 0.18 && round > 0) {
      const grace = stepAbove(note);
      strike(e, muffle, time - 0.07, midiHz(grace), TIMBRE.musicBox(midiHz(grace)), { gain: gain * 0.45 });
    }
    if (beats >= 2 && round % 3 === 2 && !night) strike(e, muffle, time + 0.012, f * 2, TIMBRE.glock(f * 2), { gain: gain * 0.3 });
  }

  function playBeat(index, time) {
    const bar = Math.floor(index / 3);
    const inBar = index % 3;
    const chord = CHORDS[PROGRESSION[bar]];
    const night = mood.night > 0.5;
    if (inBar === 0) {
      pad(e, muffle, time, chord.map((n) => n + 12), BEAT * 3, { gain: night ? 0.045 : 0.03, cutoff: night ? 900 : 1300 });
      const bass = chord[0] >= 50 ? chord[0] - 12 : chord[0];
      pluck(e, muffle, time, bass, { gain: 0.2, bright: 0.3, lowpass: 900 });
    }
    // The harp's two eighths in this beat (the bass takes the first).
    for (let half = 0; half < 2; half += 1) {
      const eighth = inBar * 2 + half;
      if (eighth === 0) continue;
      if (night && eighth % 2) continue;
      const [toneIndex, up] = HARP[eighth - 1];
      const midi = chord[Math.min(toneIndex, chord.length - 1)] + up;
      pluck(e, muffle, time + half * BEAT * 0.5 + rand(0, 0.012), midi, { gain: (eighth === 2 ? 0.12 : 0.09) * (night ? 0.8 : 1), bright: 0.45, pan: (eighth - 3) * 0.08 });
    }
    for (const [at, midi, beats] of TUNE[bar]) {
      if (Math.floor(at) === inBar) melodyNote(time + (at - inBar) * BEAT + rand(0, 0.01), midi, beats, at === 0);
    }
    // A sparkle here and there by day.
    if (!night && mood.rain < 0.5 && Math.random() < 0.1) {
      const midi = pick(SPARKLES);
      strike(e, muffle, time + rand(0.15, 0.6) * BEAT, midiHz(midi), TIMBRE.glock(), { gain: 0.025, pan: rand(-0.5, 0.5) });
    }
  }

  function schedule() {
    const now = e.context.currentTime;
    if (next < now) next = now + 0.05;
    while (next < now + 0.4) {
      playBeat(beat, next);
      next += BEAT;
      beat = (beat + 1) % (BARS * 3);
      if (beat === 0) round += 1;
    }
  }

  return {
    get playing() { return playing; },
    start() {
      if (playing) return;
      playing = true;
      beat = 0;
      next = e.context.currentTime + 0.15;
      const now = e.context.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setTargetAtTime(level, now, 0.6);
      clearInterval(timer);
      timer = setInterval(schedule, 100);
      schedule();
    },
    stop() {
      if (!playing) return;
      playing = false;
      const now = e.context.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setTargetAtTime(0, now, 0.35);
      clearInterval(timer);
      timer = null;
    },
    setLevel(value) {
      level = value;
      if (playing) out.gain.setTargetAtTime(level, e.context.currentTime, 0.3);
    },
    setMood({ night = 0, rain = 0 }) {
      mood.night = night;
      mood.rain = rain;
      muffle.frequency.setTargetAtTime(rain > 0.4 ? 2200 : night > 0.5 ? 6000 : 14000, e.context.currentTime, 1.5);
    },
    dispose() {
      clearInterval(timer);
    },
  };
}
