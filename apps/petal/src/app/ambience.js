import { biquad, birdsong, hiss, outlet, pick, rand, startAudio } from "../fx/audio.js";
import { createGramophone } from "./gramophone.js";
import { createMusic } from "./music.js";

// The island's background sound: the lullaby (app/music.js) and a living
// soundscape that follows the weather, the time of day and where you are —
// gusty wind with leaves rustling in it, songbirds and a far-off dove by day,
// crickets and an owl at night, rain hissing and pattering, and a babbling
// brook that swells as you near the pond or a waterfall. All synthesised (see
// fx/audio.js); nothing plays until the first tap or key press.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Water babbling: bubbles of every size ringing and rising in pitch, placed
// round a loop so it repeats without a seam.
function renderBrook(rate, seconds = 6) {
  const length = Math.floor(rate * seconds);
  const channels = [new Float32Array(length), new Float32Array(length)];
  for (let b = 0; b < seconds * 34; b += 1) {
    const f0 = 260 * (1400 / 260) ** Math.random();
    const damping = 0.043 * f0 + 0.0014 * f0 ** 1.5;
    const level = rand(0.25, 1) * Math.sqrt(260 / f0);
    const start = Math.floor(Math.random() * length);
    const side = Math.random();
    const count = Math.floor((6 / damping) * rate);
    let phase = 0;
    for (let i = 0; i < count; i += 1) {
      const t = i / rate;
      phase += (2 * Math.PI * f0 * (1 + 0.1 * damping * t)) / rate;
      const s = Math.sin(phase) * level * Math.exp(-damping * t);
      const j = (start + i) % length;
      channels[0][j] += s * (1 - side * 0.7);
      channels[1][j] += s * (0.3 + side * 0.7);
    }
  }
  return channels;
}

// Rain on leaves and stones: countless tiny ticks, and now and then a drop
// landing in a puddle.
function renderRain(rate, seconds = 5) {
  const length = Math.floor(rate * seconds);
  const channels = [new Float32Array(length), new Float32Array(length)];
  for (let d = 0; d < seconds * 150; d += 1) {
    const start = Math.floor(Math.random() * length);
    const size = Math.floor(rate * rand(0.0005, 0.003));
    const level = Math.random() ** 2;
    const side = Math.random();
    for (let i = 0; i < size; i += 1) {
      const s = (Math.random() * 2 - 1) * level * Math.exp((-4 * i) / size);
      const j = (start + i) % length;
      channels[0][j] += s * (1 - side);
      channels[1][j] += s * side;
    }
  }
  for (let p = 0; p < seconds * 6; p += 1) {
    const f0 = rand(1800, 4000);
    const damping = 0.043 * f0 + 0.0014 * f0 ** 1.5;
    const start = Math.floor(Math.random() * length);
    const level = rand(0.15, 0.35);
    const side = Math.random();
    let phase = 0;
    for (let i = 0; i < (6 / damping) * rate; i += 1) {
      const t = i / rate;
      phase += (2 * Math.PI * f0 * (1 + 0.1 * damping * t)) / rate;
      const s = Math.sin(phase) * level * Math.exp(-damping * t);
      const j = (start + i) % length;
      channels[0][j] += s * (1 - side);
      channels[1][j] += s * side;
    }
  }
  // Brighten (no seam: the filter is warmed on the loop's end first).
  for (const data of channels) {
    const high = biquad("highpass", 1200, 0.6, rate);
    for (let i = length - 4000; i < length; i += 1) high(data[i]);
    for (let i = 0; i < length; i += 1) data[i] = high(data[i]);
  }
  return channels;
}

// Crickets: three of them, each chirping (three quick pulses of a high,
// slightly warbling tone) at its own steady pace.
function renderCrickets(rate, seconds = 4) {
  const length = Math.floor(rate * seconds);
  const channels = [new Float32Array(length), new Float32Array(length)];
  const crickets = [
    { f: 4400, period: 0.5, level: 0.5, side: 0.2 },
    { f: 4750, period: 0.8, level: 0.35, side: 0.78 },
    { f: 5100, period: 4 / 6, level: 0.3, side: 0.55 },
  ];
  for (const c of crickets) {
    const offset = Math.random() * c.period;
    for (let k = 0; k < Math.round(seconds / c.period); k += 1) {
      for (let p = 0; p < 3; p += 1) {
        const start = Math.floor((offset + k * c.period + p * 0.036) * rate);
        const size = Math.floor(0.022 * rate);
        for (let i = 0; i < size; i += 1) {
          const t = (start + i) / rate;
          const envelope = Math.sin((Math.PI * i) / size) ** 2;
          const s = Math.sin(2 * Math.PI * c.f * t + 0.3 * Math.sin(2 * Math.PI * 30 * t)) * envelope * c.level;
          const j = (start + i) % length;
          channels[0][j] += s * (1 - c.side);
          channels[1][j] += s * c.side;
        }
      }
    }
  }
  return channels;
}

function stereoBuffer(context, channels, peak = 0.8) {
  let max = 0;
  for (const data of channels) for (let i = 0; i < data.length; i += 1) max = Math.max(max, Math.abs(data[i]));
  const buffer = context.createBuffer(2, channels[0].length, context.sampleRate);
  channels.forEach((data, c) => {
    const out = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += 1) out[i] = max > 0 ? (data[i] * peak) / max : 0;
  });
  return buffer;
}

export function createAmbience({ music: musicLevel = 0.6, nature: natureLevel = 0.8 } = {}) {
  let e = null;
  let enabled = false;
  let music = null;
  let gramophone = null; // made the first time you come near the Music Isle
  let layers = null;
  let timer = null;
  const scape = { rain: 0, wind: 1, night: 0, water: 0, waterPan: 0, gramophone: 0, gramophonePan: 0, dancing: false, tune: "waltz" };
  const gust = { now: 0.5, target: 0.5, next: 0 };
  let nextBird = 0;
  let nextOwl = 0;

  // A sound bed: a looping buffer through a filter into its own gain.
  function bed(buffer, { type = null, freq = 1000, q = 0.7, pan = 0, into } = {}) {
    const { context } = e;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = 0;
    let node = source;
    let filter = null;
    if (type) {
      filter = context.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      node.connect(filter);
      node = filter;
    }
    node.connect(gain).connect(into || outlet(e, layers.out, pan));
    source.start(0, Math.random() * buffer.duration);
    return { gain, filter };
  }
  // Loops that take a moment to render are made the first time they are needed.
  function lazyBed(name, render, options) {
    if (!layers[name]) layers[name] = bed(stereoBuffer(e.context, render(e.context.sampleRate)), options);
    return layers[name];
  }

  function build() {
    const { context } = e;
    layers = { out: context.createGain() };
    layers.out.gain.value = 0;
    layers.out.connect(e.nature);
    layers.wind = [-0.6, 0.6].map((pan) => bed(e.pink, { type: "lowpass", freq: 400, q: 0.6, pan }));
    layers.leaves = bed(e.white, { type: "bandpass", freq: 5200, q: 0.6 });
    layers.hiss = bed(e.pink, { type: "highpass", freq: 700, q: 0.5 });
    layers.waterPan = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
    layers.waterPan.connect(layers.out);
    layers.waterBed = bed(e.pink, { type: "lowpass", freq: 600, q: 0.5, into: layers.waterPan });
  }

  const set = (param, value, time = 0.8) => param.setTargetAtTime(value, e.context.currentTime, time);

  function tick() {
    if (!e || !layers) return;
    const now = e.context.currentTime;
    const { rain, wind, night, water } = scape;
    const day = 1 - night;
    // Gusts: the wind keeps changing its mind.
    if (now > gust.next) {
      gust.target = Math.random() ** 0.7;
      gust.next = now + rand(1.5, 4);
    }
    gust.now += (gust.target - gust.now) * 0.08;
    const blow = clamp(wind, 0, 2.5);
    for (const w of layers.wind) {
      set(w.gain.gain, (0.05 + Math.min(0.22, blow * 0.06)) * (0.55 + 0.45 * gust.now), 0.6);
      set(w.filter.frequency, 220 + blow * 140 + gust.now * 260, 0.6);
    }
    set(layers.leaves.gain.gain, blow * gust.now ** 2 * 0.018 * (1 - night * 0.5), 0.5);
    set(layers.hiss.gain.gain, rain * 0.16, 1.2);
    if (rain > 0.03) set(lazyBed("drops", renderRain).gain.gain, rain * 0.5, 1.2);
    else if (layers.drops) set(layers.drops.gain.gain, 0, 1.2);
    if (water > 0.01) set(lazyBed("brook", renderBrook, { into: layers.waterPan }).gain.gain, water * 0.45, 0.8);
    else if (layers.brook) set(layers.brook.gain.gain, 0, 0.8);
    set(layers.waterBed.gain.gain, water * 0.05, 0.8);
    if (layers.waterPan.pan) set(layers.waterPan.pan, clamp(scape.waterPan, -0.8, 0.8), 0.5);
    const crickets = clamp((night - 0.35) / 0.4, 0, 1) * (1 - rain);
    if (crickets > 0.01) set(lazyBed("crickets", renderCrickets).gain.gain, crickets * 0.3, 2);
    else if (layers.crickets) set(layers.crickets.gain.gain, 0, 2);
    // Birds sing by day when it is dry; a dove now and then, far off.
    if (day > 0.5 && rain < 0.35 && now > nextBird) {
      const dove = Math.random() < 0.12;
      const length = birdsong(e, layers.out, now + 0.05, {
        kind: dove ? "dove" : undefined, gain: dove ? 0.03 : rand(0.02, 0.05), pan: rand(-0.85, 0.85), far: rand(0.2, 1),
      });
      nextBird = now + length + rand(1.5, 6) / Math.max(0.5, day);
    }
    // An owl, rarely, deep in the night.
    if (night > 0.7 && rain < 0.3 && now > nextOwl) {
      if (nextOwl > 0) owl(now + 0.05);
      nextOwl = now + rand(28, 70);
    }
  }

  function owl(time) {
    const f = rand(350, 410);
    const pan = pick([-0.7, -0.4, 0.4, 0.7]);
    [[0, 0.42], [0.62, 0.22], [0.9, 0.5]].forEach(([dt, length]) => {
      hiss(e, layers.out, time + dt, { color: "pink", from: f, q: 12, attack: 0.06, length, gain: 0.05, pan });
      const osc = e.context.createOscillator();
      osc.frequency.setValueAtTime(f, time + dt);
      osc.frequency.exponentialRampToValueAtTime(f * 0.94, time + dt + length);
      const amp = e.context.createGain();
      amp.gain.setValueAtTime(0, time + dt);
      amp.gain.linearRampToValueAtTime(0.035, time + dt + 0.06);
      amp.gain.setTargetAtTime(0, time + dt + 0.06, length / 3);
      osc.connect(amp).connect(outlet(e, layers.out, pan));
      osc.start(time + dt);
      osc.stop(time + dt + length + 0.3);
    });
  }

  // Near the Music Isle the gramophone takes over from the lullaby, and plays
  // up while the two of you dance; with a YouTube song (tune "song", played by
  // app/jukebox.js) the gramophone's own waltz stays quiet.
  function applyGramophone() {
    if (!e || !music || !enabled) return;
    const near = clamp(scape.gramophone || 0, 0, 1);
    const song = scape.tune === "song";
    if (near > 0.005 && !song && !gramophone) gramophone = createGramophone(e);
    gramophone?.setPresence(song ? 0 : Math.min(1, near * musicLevel * (scape.dancing ? 1.3 : 1)), scape.gramophonePan || 0);
    music.setLevel(musicLevel * (1 - (song ? 1 : 0.9) * near));
  }

  function apply() {
    if (!e || !layers) return;
    set(layers.out.gain, enabled ? natureLevel : 0, enabled ? 1 : 0.4);
    if (enabled) {
      music.setLevel(musicLevel);
      music.start();
      applyGramophone();
      clearInterval(timer);
      timer = setInterval(tick, 100);
      tick();
    } else {
      music.stop();
      gramophone?.stop();
      clearInterval(timer);
      timer = null;
    }
  }

  const api = {
    // Wake the audio (call it from a tap or a key press).
    start() {
      if (e) {
        startAudio();
        return true;
      }
      e = startAudio();
      if (!e) return false;
      build();
      music = createMusic(e);
      music.setMood(scape);
      apply();
      return true;
    },
    get playing() { return enabled; },
    // The lullaby and the island's sounds, on or off.
    setEnabled(on) {
      enabled = on;
      apply();
    },
    async toggle() {
      if (!api.start()) throw new Error("This browser does not support sound.");
      api.setEnabled(!enabled);
      return enabled;
    },
    // rain 0..1, wind 0..2.5, night 0..1, water 0..1 (how near), waterPan -1..1.
    // gramophone 0..1 (how near the Music Isle), gramophonePan -1..1, dancing.
    setScape(next = {}) {
      Object.assign(scape, next);
      music?.setMood(scape);
      applyGramophone();
    },
    setLevels({ music: m, nature: n } = {}) {
      if (Number.isFinite(m)) musicLevel = m;
      if (Number.isFinite(n)) natureLevel = n;
      if (e && enabled) apply();
    },
    dispose() {
      clearInterval(timer);
      music?.dispose();
      gramophone?.dispose();
      if (e && e.context.state !== "closed") void e.context.close();
    },
  };
  return api;
}
