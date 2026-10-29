import * as THREE from "three";
import { clamp, damp, lerp, smoothstep } from "../core/math.js";
import { environment as uniforms } from "../core/uniforms.js";
import { createSky } from "./sky.js";
import { createPrecipitation } from "./precipitation.js";

// Time of day and weather for Petal Isle. One director owns the clock and the
// sky state and pushes it everywhere once per frame: sky dome and clouds,
// sun / moon / sky lights, fog, tone-mapping exposure, the shared shader
// uniforms (wind, wetness, snow, night) and the precipitation particles.
// Weathers cross-fade; rain leaves wet ground and, when the sun is low
// enough, a rainbow; clear nights bring shooting stars.

export const TIME_PRESETS = { dawn: 6.1, morning: 8.6, noon: 13, golden: 17.5, sunset: 18.6, night: 22.4 };
export const TIME_MODES = ["cycle", "live", ...Object.keys(TIME_PRESETS)];
export const WEATHERS = ["clear", "cloudy", "petals", "rain", "snow", "mist"];
export const WEATHER_MODES = ["auto", ...WEATHERS];
export const WEATHER_LABELS = {
  auto: "Surprise", clear: "Sunny", cloudy: "Cloudy", petals: "Petal wind", rain: "Soft rain", snow: "First snow", mist: "Misty",
};
export const TIME_LABELS = {
  cycle: "Day and night", live: "Your time", dawn: "Dawn", morning: "Morning", noon: "Noon", golden: "Golden hour", sunset: "Sunset", night: "Starry night",
};

const WEATHER = {
  clear: { overcast: 0, wind: 1.0, fog: [60, 200], coverage: 1, precip: null },
  cloudy: { overcast: 0.55, wind: 1.35, fog: [42, 165], coverage: 1, precip: null },
  petals: { overcast: 0.04, wind: 2.2, fog: [58, 190], coverage: 0.9, precip: "petals" },
  rain: { overcast: 1, wind: 1.6, fog: [20, 115], coverage: 1, precip: "rain" },
  snow: { overcast: 0.8, wind: 0.7, fog: [18, 105], coverage: 1, precip: "snow" },
  mist: { overcast: 0.3, wind: 0.45, fog: [7, 62], coverage: 0.7, precip: null },
};
const AUTO_WEIGHTS = { clear: 34, petals: 22, cloudy: 14, rain: 16, mist: 7, snow: 7 };

// Sky palette keyed by sun elevation (degrees).
const KEYS = [
  { at: -18, zenith: "#070b24", mid: "#121a44", horizon: "#27295c", below: "#0b1234", sun: "#ff9a6a", cloudLit: "#48548c", cloudShade: "#2a3060", fog: "#1a2150", hemiSky: "#8193dc", hemiGround: "#2d2b58", hemi: 1.0, sunI: 0, exposure: 1.12, rim: "#8fa8ff" },
  { at: -7, zenith: "#1b2258", mid: "#3d4088", horizon: "#9a70a8", below: "#272c62", sun: "#ff9a6a", cloudLit: "#a383bb", cloudShade: "#4d4b84", fog: "#4c4882", hemiSky: "#b9a2da", hemiGround: "#4b3b69", hemi: 1.1, sunI: 0.15, exposure: 1.08, rim: "#b7a2ff" },
  { at: 0, zenith: "#3c5aa8", mid: "#c78cb8", horizon: "#ffb48a", below: "#8d7ac0", sun: "#ff8a50", cloudLit: "#ffc6a2", cloudShade: "#a88ac2", fog: "#e2aab8", hemiSky: "#ffcac2", hemiGround: "#8a78b8", hemi: 1.25, sunI: 1.05, exposure: 1.05, rim: "#ffc0a0" },
  { at: 8, zenith: "#4a7ad0", mid: "#e6b1c8", horizon: "#ffd1a8", below: "#9fb0e0", sun: "#ffb070", cloudLit: "#ffe2cf", cloudShade: "#c1a9d8", fog: "#f1c9d2", hemiSky: "#ffe5e0", hemiGround: "#a998d8", hemi: 1.4, sunI: 1.45, exposure: 1.03, rim: "#ffd4c0" },
  { at: 22, zenith: "#3f8ae6", mid: "#8fc2f7", horizon: "#f2e6f6", below: "#7fb6f0", sun: "#fff0e2", cloudLit: "#ffffff", cloudShade: "#ffffff", fog: "#e6eefb", hemiSky: "#fff7fb", hemiGround: "#b9a9e6", hemi: 1.55, sunI: 1.75, exposure: 1.02, rim: "#ffe0ee" },
  { at: 90, zenith: "#3f8ae6", mid: "#8fc2f7", horizon: "#f2e6f6", below: "#7fb6f0", sun: "#fff0e2", cloudLit: "#ffffff", cloudShade: "#ffffff", fog: "#e6eefb", hemiSky: "#fff7fb", hemiGround: "#b9a9e6", hemi: 1.55, sunI: 1.75, exposure: 1.02, rim: "#ffe0ee" },
].map((key) => {
  const out = { ...key };
  for (const [name, value] of Object.entries(key)) if (typeof value === "string") out[name] = new THREE.Color(value);
  return out;
});
// Overcast palettes (blended in by the weather), for day; night darkens them.
const OVERCAST = {
  rain: { zenith: "#7d88aa", mid: "#a4abc8", horizon: "#d0d2e2", below: "#8f98b8", cloudLit: "#d9dbe7", cloudShade: "#9fa5bd", fog: "#b9bed3" },
  snow: { zenith: "#aab7d7", mid: "#ced7eb", horizon: "#eff1f8", below: "#b8c3dd", cloudLit: "#f4f6fb", cloudShade: "#c6cde0", fog: "#e7eaf4" },
  mist: { zenith: "#9cb6e6", mid: "#d8d4ec", horizon: "#f3ecf5", below: "#c9d2ee", cloudLit: "#ffffff", cloudShade: "#eae4f2", fog: "#f1e9f4" },
};
for (const palette of Object.values(OVERCAST)) for (const [k, v] of Object.entries(palette)) palette[k] = new THREE.Color(v);
const COLOR_FIELDS = ["zenith", "mid", "horizon", "below", "sun", "cloudLit", "cloudShade", "fog", "hemiSky", "hemiGround", "rim"];
const NUMBER_FIELDS = ["hemi", "sunI", "exposure"];

// Sun path: rises at 6:30 in the east, highest (58°) at 12:30, sets at 18:30
// in the west, moving 15° of azimuth an hour like the real sun.
const NOON_AZIMUTH = Math.atan2(-8, 10);
export function sunDirection(hours, target = new THREE.Vector3()) {
  const elevation = THREE.MathUtils.degToRad(58) * Math.sin(((hours - 6.5) / 24) * Math.PI * 2);
  const azimuth = NOON_AZIMUTH + THREE.MathUtils.degToRad((hours - 12.5) * 15);
  return target.set(Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.cos(azimuth));
}

export function paletteAt(elevation, out) {
  let i = 0;
  while (i < KEYS.length - 2 && elevation > KEYS[i + 1].at) i += 1;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smoothstep(a.at, b.at, clamp(elevation, a.at, b.at));
  for (const name of COLOR_FIELDS) (out[name] ||= new THREE.Color()).copy(a[name]).lerp(b[name], t);
  for (const name of NUMBER_FIELDS) out[name] = lerp(a[name], b[name], t);
  return out;
}

function pickWeather(current) {
  const entries = Object.entries(AUTO_WEIGHTS).filter(([name]) => name !== current);
  let roll = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [name, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return name;
  }
  return "clear";
}

export function createEnvironment({ scene, renderer, hemi, sun, fill, quality = "high", fx = null, map = null, waterLevel = null, time = "cycle", weather = "auto", onEvent = () => {} }) {
  const sky = createSky(scene, { quality });
  const precipitation = createPrecipitation(scene, { quality });
  const fog = scene.fog || (scene.fog = new THREE.Fog("#e6eefb", 60, 200));
  sun.target.position.set(0, 0, 0);
  scene.add(sun.target);

  let timeMode = TIME_MODES.includes(time) ? time : "cycle";
  let weatherMode = WEATHER_MODES.includes(weather) ? weather : "auto";
  let hours = timeMode === "live" ? clockHours() : TIME_PRESETS[timeMode] ?? 9.5;
  let current = weatherMode === "auto" ? pickWeather(null) : weatherMode; // a surprise from the first moment
  let weatherClock = 160 + Math.random() * 120;
  const weights = Object.fromEntries(WEATHERS.map((name) => [name, name === current ? 1 : 0]));
  let wet = 0;
  let snow = 0;
  let rainPeak = 0;
  let rainbow = 0;
  let rainbowTimer = 0;
  let meteorClock = 18;
  let rippleClock = 0;
  let lastLabel = "";
  const dayMinutes = 20;

  const palette = {};
  const state = {
    zenith: new THREE.Color(), mid: new THREE.Color(), horizon: new THREE.Color(), below: new THREE.Color(),
    sunDir: new THREE.Vector3(), sunColor: new THREE.Color(), sunAmount: 1, moonDir: new THREE.Vector3(), moonAmount: 0,
    stars: 0, rainbow: 0, overcast: 0, cloudLit: new THREE.Color(), cloudShade: new THREE.Color(), cloudCoverage: 1,
  };
  const overcastColor = {};
  const tmpColor = new THREE.Color();

  function clockHours() {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  }

  function label(h) {
    if (h < 5 || h >= 20.5) return "night";
    if (h < 7) return "dawn";
    if (h < 11) return "morning";
    if (h < 16) return "day";
    if (h < 17.9) return "golden";
    if (h < 19.2) return "sunset";
    return "dusk";
  }

  function advanceClock(dt) {
    if (timeMode === "cycle") hours = (hours + (dt * 24) / (dayMinutes * 60)) % 24;
    else if (timeMode === "live") hours = clockHours();
    else {
      const target = TIME_PRESETS[timeMode];
      const ahead = (target - hours + 24) % 24; // always move forward through the day
      hours = ahead < 0.02 ? target : (hours + Math.min(ahead, dt * 4)) % 24;
    }
  }

  function advanceWeather(dt) {
    if (weatherMode === "auto") {
      weatherClock -= dt;
      if (weatherClock <= 0) {
        current = pickWeather(current);
        weatherClock = 150 + Math.random() * 170;
        onEvent("weather", { weather: current });
      }
    } else if (current !== weatherMode) {
      current = weatherMode;
      onEvent("weather", { weather: current });
    }
    for (const name of WEATHERS) weights[name] = damp(weights[name], name === current ? 1 : 0, 0.35, dt);
    const total = WEATHERS.reduce((sum, name) => sum + weights[name], 0) || 1;
    for (const name of WEATHERS) weights[name] /= total;
  }

  const api = {
    sky,
    precipitation,
    get hours() { return hours; },
    get timeMode() { return timeMode; },
    get weatherMode() { return weatherMode; },
    get weather() { return current; },
    get weights() { return weights; },
    get night() { return uniforms.uNight.value; },
    get wind() { return uniforms.uWind.value; },
    get rainbow() { return rainbow; },
    get label() { return label(hours); },
    setTime(mode) {
      if (!TIME_MODES.includes(mode)) return;
      timeMode = mode;
      if (mode === "live") hours = clockHours();
    },
    setWeather(mode) {
      if (!WEATHER_MODES.includes(mode)) return;
      weatherMode = mode;
      if (mode === "auto") weatherClock = 60;
      else if (current !== mode) {
        current = mode;
        onEvent("weather", { weather: current });
      }
    },
    // Jump straight to a state (no cross-fade), e.g. for screenshots.
    snap() {
      for (const name of WEATHERS) weights[name] = name === current ? 1 : 0;
      if (TIME_PRESETS[timeMode] !== undefined) hours = TIME_PRESETS[timeMode];
    },
    update(camera, time, dt, player = null) {
      advanceClock(dt);
      advanceWeather(dt);
      const now = label(hours);
      if (now !== lastLabel) {
        if (lastLabel) onEvent("time", { label: now, hours });
        lastLabel = now;
      }

      // Sun, moon and the palette of the hour.
      sunDirection(hours, state.sunDir);
      const elevation = THREE.MathUtils.radToDeg(Math.asin(state.sunDir.y));
      paletteAt(elevation, palette);
      state.moonDir.set(-state.sunDir.x * 0.8 + 0.25, Math.max(0.18, -state.sunDir.y * 0.9 + 0.2), -state.sunDir.z * 0.8 - 0.2).normalize();
      const night = smoothstep(4, -10, elevation);

      // Weather mix.
      const w = weights;
      let overcast = 0;
      let wind = 0;
      let fogNear = 0;
      let fogFar = 0;
      let coverage = 0;
      for (const name of WEATHERS) {
        const spec = WEATHER[name];
        overcast += spec.overcast * w[name];
        wind += spec.wind * w[name];
        fogNear += spec.fog[0] * w[name];
        fogFar += spec.fog[1] * w[name];
        coverage += spec.coverage * w[name];
      }
      const overcastSum = w.rain + w.snow + w.mist + w.cloudy * 0.8 + 1e-4;
      for (const name of ["zenith", "mid", "horizon", "below", "cloudLit", "cloudShade", "fog"]) {
        const c = (overcastColor[name] ||= new THREE.Color());
        c.setRGB(0, 0, 0);
        c.add(tmpColor.copy(OVERCAST.rain[name]).multiplyScalar((w.rain + w.cloudy * 0.8) / overcastSum));
        c.add(tmpColor.copy(OVERCAST.snow[name]).multiplyScalar(w.snow / overcastSum));
        c.add(tmpColor.copy(OVERCAST.mist[name]).multiplyScalar(w.mist / overcastSum));
        c.multiplyScalar(lerp(1, 0.28, night));
        palette[name].lerp(c, clamp(overcast * 0.92 + w.mist * 0.4, 0, 0.95));
      }

      state.zenith.copy(palette.zenith);
      state.mid.copy(palette.mid);
      state.horizon.copy(palette.horizon);
      state.below.copy(palette.below);
      state.sunColor.copy(palette.sun);
      state.sunAmount = smoothstep(-4, 2, elevation);
      state.moonAmount = night;
      state.stars = night * (1 - overcast * 0.9);
      state.overcast = overcast;
      state.cloudLit.copy(palette.cloudLit);
      state.cloudShade.copy(palette.cloudShade);
      state.cloudCoverage = coverage;

      // Rain leaves the ground wet and, with the sun low enough, a rainbow.
      wet = clamp(wet + dt * (w.rain > 0.5 ? 1 / 25 : -1 / 90), 0, 1);
      snow = clamp(snow + dt * (w.snow > 0.5 ? 1 / 40 : -1 / 80), 0, 1);
      rainPeak = Math.max(rainPeak * Math.exp(-dt / 240), w.rain);
      if (rainPeak > 0.7 && w.rain < 0.35 && (w.clear + w.petals) > 0.5 && elevation > 2 && elevation < 42 && rainbowTimer <= 0) {
        rainbowTimer = 100;
        rainPeak = 0;
        onEvent("rainbow", {});
      }
      rainbowTimer = Math.max(0, rainbowTimer - dt);
      rainbow = damp(rainbow, rainbowTimer > 8 && elevation > 1 ? 1 : 0, 0.5, dt);
      state.rainbow = rainbow * (1 - overcast);
      sky.apply(state);

      // Lights, fog and exposure.
      const daylight = 1 - overcast * 0.45;
      hemi.color.copy(palette.hemiSky);
      hemi.groundColor.copy(palette.hemiGround);
      hemi.intensity = palette.hemi * lerp(1, 1.08, overcast);
      sun.color.copy(palette.sun);
      sun.intensity = palette.sunI * daylight * state.sunAmount;
      sun.position.copy(state.sunDir).multiplyScalar(30);
      if (state.sunDir.y < 0.05) sun.position.y = Math.max(sun.position.y, 1.5);
      // The fill light is a pink rim by day and moonlight by night.
      fill.color.set("#ffd6ec").lerp(tmpColor.set("#9fb2ff"), night);
      fill.intensity = lerp(0.6, 0.55, night) * (1 - overcast * 0.4);
      if (night > 0.5) fill.position.copy(state.moonDir).multiplyScalar(30);
      else fill.position.set(6, 8, -12);
      fog.color.copy(palette.fog);
      fog.near = fogNear;
      fog.far = fogFar;
      renderer.setClearColor(palette.horizon, 1);
      renderer.toneMappingExposure = palette.exposure;

      // Shared shader state.
      const gust = 0.22 * Math.sin(time * 0.71) * Math.sin(time * 0.23 + 1.3);
      uniforms.uWind.value = Math.max(0.2, wind + gust * wind);
      const heading = time * 0.013 + 0.6;
      uniforms.uWindDir.value.set(Math.cos(heading), Math.sin(heading));
      uniforms.uWet.value = wet;
      uniforms.uSnow.value = snow;
      uniforms.uNight.value = night;
      uniforms.uRim.value.copy(palette.rim);
      uniforms.uHorizon.value.copy(palette.horizon);
      uniforms.uSunDir.value.copy(state.sunDir);

      // Precipitation follows the strongest wet weather.
      const kinds = [["rain", w.rain], ["snow", w.snow], ["petals", w.petals]].sort((a, b) => b[1] - a[1]);
      const [kind, amount] = kinds[0];
      precipitation.set(kind, amount < 0.04 ? 0 : amount);
      tmpColor.copy(palette.hemiSky).lerp(palette.cloudLit, 0.5).multiplyScalar(lerp(1, 0.55, night));
      precipitation.update(camera, time, tmpColor);

      // Rain rings on the pond near the player.
      if (fx && map && player && w.rain > 0.3) {
        rippleClock -= dt;
        while (rippleClock <= 0) {
          rippleClock += 0.07 / w.rain;
          const a = Math.random() * Math.PI * 2;
          const r = 0.5 + Math.random() * 6;
          const x = player.x + Math.cos(a) * r;
          const z = player.z + Math.sin(a) * r;
          const s = map.sample(x, z);
          if (s.water) fx.ripple(new THREE.Vector3(x, (waterLevel ?? s.height + 0.24) + 0.02, z), 0.35 + Math.random() * 0.2);
        }
      }

      // Shooting stars on clear nights.
      if (state.stars > 0.6) {
        meteorClock -= dt;
        if (meteorClock <= 0) {
          meteorClock = 20 + Math.random() * 30;
          const from = sky.shootingStar(camera);
          if (from) onEvent("shooting-star", { direction: from });
        }
      }
      sky.update(camera, time, dt);
    },
    dispose() {
      sky.dispose();
      precipitation.dispose();
      scene.remove(sun.target);
    },
  };
  return api;
}
