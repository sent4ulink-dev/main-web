// The step editor's steps for Pinky, and which screen the live preview shows for each (App.tsx: q = the question,
// plea = the question after a few taps on No, word = the marquee after Yes, act / rest = the visitor's choices).
export const title = 'Pinky';

const pleaField = (i) => ({ type: 'text', path: `noPleaTexts.${i}`, slot: i, label: `After No, time ${i + 1}`, max: 44 });
const activity = (i) => ({
  title: `Choice ${i + 1}`,
  fields: [
    { type: 'text', path: `activities.${i}.text`, label: 'What will you do?', max: 60 },
    { type: 'text', path: `activities.${i}.emoji`, label: 'Emoji', max: 8 },
  ],
});
const place = (i) => ({
  title: `Place ${i + 1}`,
  fields: [
    { type: 'text', path: `restaurants.${i}.name`, label: 'Name of the place', max: 70 },
    { type: 'text', path: `restaurants.${i}.mapsLink`, label: 'Google Maps link (optional)', max: 2000, placeholder: 'https://maps.app.goo.gl/…', hint: 'Copy the place’s link from Google Maps. Without one, the map opens a search for its name.' },
  ],
  moreLabel: 'Photo and details',
  more: [
    { type: 'text', path: `restaurants.${i}.imageUrl`, label: 'Photo link', max: 500, placeholder: 'https://…' },
    { type: 'text', path: `restaurants.${i}.rating`, label: 'Rating', max: 6, placeholder: '4.9' },
    { type: 'text', path: `restaurants.${i}.hours`, label: 'Opening hours', max: 50 },
  ],
});

export const steps = [
  {
    id: 'q', pill: 'Question', title: 'Write your question', hint: 'This is the first thing they see.',
    preview: { scene: 'q' },
    cards: [{ fields: [
      { type: 'text', path: 'question', label: 'Question', max: 90, suggest: ['Will you go on a date with me?', 'Will you see me this weekend?'] },
      { type: 'text', path: 'yesLabel', label: 'The “Yes” answer', max: 16 },
      { type: 'text', path: 'noLabel', label: 'The “No” answer', max: 16 },
    ] }],
  },
  {
    id: 'plea', pill: '“No”', title: 'If they press “No”', hint: 'Each time they press “No”, the next of these shows.',
    preview: { scene: 'plea', slots: true },
    cards: [{ fields: [0, 1, 2].map(pleaField), moreLabel: 'More of them', more: [3, 4, 5, 6, 7, 8, 9].map(pleaField) }],
  },
  {
    id: 'word', pill: 'Name', title: 'The word that fills the screen', hint: 'When they press “Yes”, this word fills the whole screen. Most people write the name of the one they love.',
    preview: { scene: 'word' },
    cards: [{ fields: [{ type: 'text', path: 'celebrationWord', label: 'Name or word', max: 20 }] }],
  },
  {
    id: 'act', pill: 'Plan', title: 'What will you do together?', hint: 'They choose one of these. A choice left empty doesn’t show.',
    preview: { scene: 'act' },
    cards: [0, 1, 2, 3].map(activity),
  },
  {
    id: 'rest', pill: 'Place', title: 'Where will you meet?', hint: 'The places they can choose from. A place left empty doesn’t show.',
    preview: { scene: 'rest' },
    cards: [0, 1, 2].map(place),
  },
  {
    id: 'song', pill: 'Song', title: 'Add your song', hint: 'It plays when the card opens. Copy the song’s link from YouTube and paste it here. Optional.',
    preview: { scene: 'q' },
    cards: [{ fields: [{ type: 'youtube', path: 'musicUrl' }] }],
  },
  {
    id: 'end', pill: 'Finish', title: 'Almost done!', hint: '“Save and see it” opens the card exactly as they will see it.',
    preview: { scene: 'q' },
    cards: [],
  },
];

const blankPlace = (i) => ({ id: `new-r${i}`, name: '', mapsLink: '', imageUrl: '', rating: '', reviewCount: '', hours: '' });
const copy = (v) => JSON.parse(JSON.stringify(v));

/** What the boxes need: every one has something to write into. */
export function forEditing(c) {
  const out = copy(c);
  out.noPleaTexts = Array.from({ length: 10 }, (_, i) => out.noPleaTexts?.[i] ?? '');
  while (out.activities.length < 4) out.activities.push({ id: `new-a${out.activities.length}`, emoji: '💗', text: '' });
  while (out.restaurants.length < 3) out.restaurants.push(blankPlace(out.restaurants.length));
  out.restaurants = out.restaurants.map((r) => ({ imageUrl: '', rating: '', reviewCount: '', hours: '', ...r }));
  return out;
}
/** What is kept: empty choices don't show; a place with no map link is searched by its name; emptied words go back
 *  to the card's own. */
export function forSaving(c, fallback) {
  const out = copy(c);
  const activities = out.activities.filter((a) => a.text.trim());
  const restaurants = out.restaurants.filter((r) => r.name.trim()).map((r) => ({
    ...r,
    mapsLink: r.mapsLink.trim() || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name.trim())}`,
  }));
  out.activities = activities.length ? activities : fallback.activities;
  out.restaurants = restaurants.length ? restaurants : fallback.restaurants;
  out.noPleaTexts = out.noPleaTexts.map((t, i) => t.trim() || fallback.noPleaTexts[i] || '');
  for (const key of ['question', 'yesLabel', 'noLabel', 'celebrationWord']) out[key] = out[key].trim() || fallback[key];
  out.musicUrl = (out.musicUrl || '').trim();
  return out;
}
