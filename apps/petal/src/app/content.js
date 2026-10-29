// Everything a visitor reads on Petal Isle lives here. A share link
// (?share=id) carries its own words, edited in place right where they show;
// /content.json and old links (#c=...) can supply them too. Missing fields
// always fall back to these defaults.
export const DEFAULT_CONTENT = {
  // Who the visitor plays, chosen in edit mode (the other bunny is the host).
  character: "girl",
  // Old links (#c=...) finished for good are view-only.
  locked: false,
  intro: {
    eyebrow: "A LITTLE WORLD ABOVE THE CLOUDS",
    headline: "Shall we begin",
    headlineAccent: "our little journey?",
    copy: "Beyond these clouds, a question is waiting for you.",
    button: "Let’s go ♡",
  },
  question: {
    text: "Will you be\nmy special\nsomeone?",
    yes: "Yes",
    no: "No",
    sign: "A small question\nA big adventure\nTogether ♡",
    yesMessage: "It’s a date! The rest of Petal Isle is open now.",
    noMessage: "The “No” heart wobbled shyly.",
  },
  activities: [
    { title: "A picnic", body: "A blanket, fruit and soft music — nowhere else to be.", image: "" },
    { title: "Picking flowers", body: "Let’s find the prettiest flowers and make a little bouquet.", image: "" },
    { title: "Cloud-watching", body: "Let’s lie on the grass and give every drifting cloud a name.", image: "" },
  ],
  calendar: {
    title: "Our special day",
    month: "2026-10",
    day: 14,
    body: "Choose a day for our next little adventure.",
  },
  map: {
    heading: "Where shall we go?",
    places: [
      { title: "Secret Lake", body: "A quiet shore kept just for two.", image: "" },
      { title: "Flower Hill", body: "A path that winds up the blooming hillside.", image: "" },
      { title: "Sky Terrace", body: "A high garden where the clouds feel close enough to touch.", image: "" },
    ],
  },
  book: {
    title: "Our date",
    note: "Whatever you choose, the best part is spending the day with you.",
    signature: "With love ♡",
    // A photo of your own, as a polaroid above the letter (optional).
    photo: "",
  },
  // The Music Isle's song: a YouTube link (empty: the gramophone's own waltz).
  // A song saved in ⚙ Settings plays instead, in that browser.
  music: {
    song: "",
  },
  // The names on the signposts and the island map.
  isles: {
    name: "Petal Isle",
    question: "Question Garden",
    activity: "Adventure Garden",
    calendar: "Calendar Tree",
    map: "Map",
    keepsake: "Keepsake Arch",
    meadow: "Bunny Meadow",
    pond: "Lily Pond",
    grove: "Lantern Grove",
    perch: "Starry Peak",
    music: "Music Isle",
    gate: "Heart Gate",
    crossroads: "Crossroads of the Isles",
  },
  play: {
    secret: "You found every hidden heart. They are all yours. ♡",
    wishes: [
      "The well whispered: “Yes, it will come true.”",
      "Ping! Your wish sank all the way to the stars.",
      "The well giggled. It already knows what you wished for. ♡",
      "Wish received. Delivery: very soon.",
    ],
    photoCaption: "Our little world ♡",
    // What the paw-print trail says as it leads to each stop.
    guide: {
      activity: "Follow the paw prints. Our first adventure is waiting ♡",
      calendar: "Now let’s find our day. The prints know the way ♡",
      place: "Where shall we go? Follow the prints to the map ♡",
      book: "Everything is chosen! Follow the prints to the keepsake book ♡",
      // (From here on the other bunny walks with you, hand in hand.)
      gate: "Now, hand in hand, let’s walk through the big gate. Little islands are waiting beyond ♡",
    },
    // The big gate at the path's end opens as you walk up to it; the first
    // time, this says what lies beyond.
    gate: {
      opened: "The big gate is open! Little islands are waiting beyond ♡",
    },
    // The Music Isle's dance floor.
    dance: {
      button: "💃 Dance",
      start: "Let’s dance! ♡",
      end: "What a lovely dance! ♡",
    },
  },
};

// A value deep in the content, by a dotted path ("activities.0.title").
export function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}
export function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((node, key) => node?.[key], object);
  if (parent && typeof parent === "object" && typeof parent[last] === "string") parent[last] = value;
}

// The path of the words a message shows, if they are the content's own (so a
// message can be edited where it appears). The signposts' names are not.
export function findTextPath(content, text, prefix = "") {
  const wanted = String(text).trim();
  if (!wanted) return null;
  for (const [key, value] of Object.entries(content)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (["isles", "music", "character"].includes(path) || key === "image" || key === "photo") continue;
    if (typeof value === "string" && value.trim() === wanted) return path;
    if (value && typeof value === "object") {
      const found = findTextPath(value, wanted, path);
      if (found) return found;
    }
  }
  return null;
}

// The photos an invitation can have, by name (the server keeps them, one
// per place, and replaces them whole): each board picture and the book's
// polaroid. Empty means the island's own drawing (or no polaroid).
export const IMAGE_SLOTS = {
  activity0: "activities.0.image",
  activity1: "activities.1.image",
  activity2: "activities.2.image",
  place0: "map.places.0.image",
  place1: "map.places.1.image",
  place2: "map.places.2.image",
  book: "book.photo",
};

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

// Deep merge that only accepts values whose type matches the defaults, so a
// hand-edited or old content file can never break the page.
export function mergeContent(base, patch) {
  if (Array.isArray(base)) {
    if (!Array.isArray(patch)) return structuredClone(base);
    return base.map((item, index) => mergeContent(item, patch[index]));
  }
  if (isObject(base)) {
    const out = {};
    for (const key of Object.keys(base)) out[key] = mergeContent(base[key], isObject(patch) ? patch[key] : undefined);
    return out;
  }
  if (patch === undefined || patch === null) return base;
  if (typeof base === "number") {
    const number = Number(patch);
    return Number.isFinite(number) ? number : base;
  }
  return typeof patch === typeof base ? patch : base;
}

// Old links carried their words in the address (#c=...); they still open.
function decode(text) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function loadContent() {
  let content = structuredClone(DEFAULT_CONTENT);
  try {
    const response = await fetch("/content.json", { cache: "no-cache" });
    if (response.ok && (response.headers.get("content-type") || "").includes("json")) {
      content = mergeContent(content, await response.json());
    }
  } catch {
    // No custom file: defaults are used.
  }
  const hash = new URLSearchParams(location.hash.slice(1)).get("c");
  if (hash) {
    try {
      content = mergeContent(content, decode(hash));
    } catch {
      console.warn("The share link content could not be read.");
    }
  }
  return content;
}
