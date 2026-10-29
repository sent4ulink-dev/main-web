// Walkthrough progress kept in this browser: the hidden hearts found. Saves
// from earlier versions still load (what else they counted is dropped).

const KEY = "petal-isle-play";

export function createProgress({ storage = globalThis.localStorage } = {}) {
  let saved = {};
  try {
    saved = JSON.parse(storage?.getItem(KEY) || "{}") || {};
  } catch {
    saved = {};
  }
  const hearts = new Set(Array.isArray(saved.hearts) ? saved.hearts.filter((v) => Number.isInteger(v)) : []);
  return {
    hearts,
    save() {
      try {
        storage?.setItem(KEY, JSON.stringify({ hearts: [...hearts] }));
      } catch {
        // Progress stays for this visit only.
      }
    },
  };
}
