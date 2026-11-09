// The step editor's steps for Petal Isle, and where the live preview looks for each: the island's own stops (the first
// screen, the question garden, the adventure board, the calendar tree, the map, the keepsake book) and the Music Isle.
// `crop` is the part of a phone screen (in %) the preview zooms to when its dock is small.

export const title = "Petal Isle";
const crop = (y, h) => ({ x: 0, y, w: 100, h });

const dateOf = {
  get: (c) => `${c.calendar.month}-${String(c.calendar.day).padStart(2, "0")}`,
  set: (c, v) => {
    const m = /^(\d{4}-\d{2})-(\d{2})$/.exec(v);
    if (m) {
      c.calendar.month = m[1];
      c.calendar.day = +m[2];
    }
  },
};

/** `store(path)(file)` keeps a photo and answers its address; `drop(path)()` takes it away again (open-editor.js). */
export function stepsFor({ store, drop }) {
  const photo = (path, extra = {}) => ({ type: "photo", path, store: store(path), drop: drop(path), ...extra });
  const picture = (path, label, n) => ({
    title: `${label} ${n + 1}`,
    fields: [
      photo(`${path}.image`, { slot: n, captionPath: `${path}.title`, captionMax: 30, captionLabel: "Words under the picture", captionPlaceholder: "For example: A picnic" }),
      { type: "textarea", path: `${path}.body`, label: "What it says when chosen", max: 160, rows: 2, slot: n },
    ],
  });
  return [
    {
      id: "intro", pill: "Start", title: "The first screen", hint: "When the link opens, these words show first, among the clouds.",
      preview: { scene: "intro", crop: crop(20, 60) },
      cards: [{
        title: "Is it for a girl or a boy?",
        hint: "They play this bunny. The other bunny is you.",
        fields: [{ type: "choice", path: "character", options: [{ value: "girl", label: "🎀 Girl" }, { value: "boy", label: "🎩 Boy" }] }],
      }, {
        fields: [
          { type: "text", path: "intro.headline", label: "Title", max: 40 },
          { type: "text", path: "intro.headlineAccent", label: "Title’s second line", max: 30 },
          { type: "textarea", path: "intro.copy", label: "Words under it", max: 160, rows: 2 },
          { type: "text", path: "intro.button", label: "Button", max: 24 },
        ],
        moreLabel: "More words",
        more: [{ type: "text", path: "intro.eyebrow", label: "Words above the title", max: 50 }],
      }],
    },
    {
      id: "q", pill: "Question", title: "Write your question", hint: "In the first garden, your question is written on the stone above the two hearts.",
      // (from near the top: the Yes / No message shows up there)
      preview: { scene: "question", slots: true, crop: crop(9, 72) },
      cards: [{
        fields: [
          { type: "textarea", path: "question.text", label: "Question", max: 70, rows: 3, slot: 0 },
          { type: "text", path: "question.yes", label: "Word on the “Yes” heart", max: 12, slot: 0 },
          { type: "text", path: "question.no", label: "Word on the “No” heart", max: 12, slot: 0 },
          { type: "text", path: "question.yesMessage", label: "What “Yes” says", max: 120, slot: 1 },
          { type: "text", path: "question.noMessage", label: "What “No” says", max: 120, slot: 2 },
        ],
        moreLabel: "More words",
        more: [{ type: "textarea", path: "question.sign", label: "Words on the signpost", max: 80, rows: 3, slot: 0 }],
      }],
    },
    {
      id: "act", pill: "Adventures", title: "What will you do together?", hint: "Put your own photo on each picture of the board, with a few words under it. Without a photo, the island’s drawing stays.",
      preview: { scene: "activities", slots: true, crop: crop(22, 50) },
      cards: [0, 1, 2].map((n) => picture(`activities.${n}`, "Adventure", n)),
    },
    {
      id: "date", pill: "Day", title: "Pick your special day", hint: "The calendar tree opens on this month, with the day marked.",
      preview: { scene: "calendar", crop: crop(18, 62) },
      cards: [{ fields: [
        { type: "date", ...dateOf, label: "Date" },
        { type: "text", path: "calendar.title", label: "Calendar title", max: 40 },
        { type: "textarea", path: "calendar.body", label: "Words on the calendar", max: 140, rows: 2 },
      ] }],
    },
    {
      id: "map", pill: "Places", title: "Where will you go?", hint: "Change the three places on the map to your own photos and words.",
      preview: { scene: "map", slots: true, crop: crop(22, 50) },
      cards: [
        { fields: [{ type: "text", path: "map.heading", label: "Map title", max: 40 }] },
        ...[0, 1, 2].map((n) => picture(`map.places.${n}`, "Place", n)),
      ],
    },
    {
      id: "song", pill: "Song", title: "Add your song", hint: "It plays when they come near the Music Isle. Copy the song’s link from YouTube and paste it here. Left empty, the gramophone plays its own waltz.",
      preview: { scene: "music", crop: crop(16, 62) },
      cards: [{ fields: [{ type: "youtube", path: "music.song" }] }],
    },
    {
      id: "end", pill: "Finish", title: "Almost done!", hint: "Write the words for the keepsake book. “Save and see it” opens the island exactly as they will see it.",
      preview: { scene: "keepsake", crop: crop(20, 56) },
      cards: [{ fields: [
        photo("book.photo", { label: "Photo in the book" }),
        { type: "text", path: "book.title", label: "Book title", max: 40 },
        { type: "textarea", path: "book.note", label: "Words in the book", max: 240, rows: 3 },
        { type: "text", path: "book.signature", label: "Signed", max: 40 },
      ] }],
    },
  ];
}
