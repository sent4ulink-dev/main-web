// Player settings, kept in this browser. Reads never throw (private windows,
// blocked storage) and unknown or outdated values fall back to defaults, so a
// stored file from an older version can never break the page.

import { parseYouTube } from "./youtube.js";

const KEY = "petal-isle-settings";
const VERSION = 1;

export const DEFAULT_SETTINGS = Object.freeze({
  version: VERSION,
  quality: "auto", // auto | low | medium | high
  time: "cycle", // cycle | live | dawn | morning | noon | golden | sunset | night
  weather: "auto", // auto | clear | cloudy | petals | rain | snow | mist
  sound: true, // the lullaby and the island's sounds
  music: 0.6, // lullaby volume 0..1
  effects: 0.8, // sound-effect (and nature) volume 0..1
  sensitivity: 1, // camera drag speed multiplier
  invertY: false,
  song: "", // a YouTube link the Music Isle plays instead of its gramophone waltz
});

const CHOICES = {
  quality: ["auto", "low", "medium", "high"],
  time: ["cycle", "live", "dawn", "morning", "noon", "golden", "sunset", "night"],
  weather: ["auto", "clear", "cloudy", "petals", "rain", "snow", "mist"],
};

export function sanitizeSettings(input) {
  const out = { ...DEFAULT_SETTINGS };
  if (!input || typeof input !== "object") return out;
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    if (key === "version") continue;
    const value = input[key];
    if (CHOICES[key]) out[key] = CHOICES[key].includes(value) ? value : fallback;
    else if (typeof fallback === "boolean") out[key] = typeof value === "boolean" ? value : fallback;
    else if (typeof fallback === "number") out[key] = Number.isFinite(value) ? Math.min(2, Math.max(0, value)) : fallback;
    else if (key === "song") out[key] = typeof value === "string" && value.length < 400 && parseYouTube(value) ? value.trim() : fallback;
  }
  return out;
}

export function loadSettings(storage = globalThis.localStorage) {
  try {
    return sanitizeSettings(JSON.parse(storage?.getItem(KEY) || "null"));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings, storage = globalThis.localStorage) {
  const clean = sanitizeSettings(settings);
  try {
    storage?.setItem(KEY, JSON.stringify(clean));
  } catch {
    // Settings still apply for this visit.
  }
  return clean;
}

// A tiny observable store so the UI and the world stay in sync.
export function createSettingsStore(storage = globalThis.localStorage) {
  let current = loadSettings(storage);
  const listeners = new Set();
  return {
    get: () => current,
    set(patch) {
      current = saveSettings({ ...current, ...patch }, storage);
      listeners.forEach((fn) => fn(current, patch));
      return current;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
