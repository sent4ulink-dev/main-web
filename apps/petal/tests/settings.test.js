import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, createSettingsStore, loadSettings, sanitizeSettings } from "../src/core/settings.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

describe("settings", () => {
  it("falls back to defaults for missing or broken data", () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStorage({ "petal-isle-settings": "{not json" }))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps a YouTube song link and drops anything else", () => {
    expect(sanitizeSettings({ song: " https://youtu.be/dQw4w9WgXcQ " }).song).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(sanitizeSettings({ song: "https://evil.com/x" }).song).toBe("");
    expect(sanitizeSettings({ song: 42 }).song).toBe("");
  });

  it("rejects unknown choices and clamps numbers", () => {
    const clean = sanitizeSettings({ weather: "tornado", time: "night", effects: 9, invertY: "yes" });
    expect(clean.weather).toBe("auto");
    expect(clean.time).toBe("night");
    expect(clean.effects).toBe(2);
    expect(clean.invertY).toBe(false);
  });

  it("persists changes and notifies subscribers", () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    const seen = [];
    store.subscribe((next, patch) => seen.push(patch));
    store.set({ weather: "snow" });
    expect(store.get().weather).toBe("snow");
    expect(seen).toEqual([{ weather: "snow" }]);
    expect(loadSettings(storage).weather).toBe("snow");
  });

  it("survives storage that throws", () => {
    const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
    const store = createSettingsStore(broken);
    expect(store.set({ invertY: true }).invertY).toBe(true);
  });
});
