// The step editor's steps for Halloween, and which screen the live preview shows for each. The card keeps its words
// in plan.* (the date's details) and texts["scene:n"] (every other line, numbered as the inline editor numbers them).
import { WORDS } from './words.js';

export const title = 'Halloween';
export const SONG_KEY = 'song:0';
const crop = (y, h) => ({ x: 0, y, w: 100, h });
const word = (key, label, max = 60, extra = {}) => ({ type: 'text', path: `texts.${key}`, label, max, ...extra });

const pad2 = (n) => String(n).padStart(2, '0');
// The card shows "October 31, 2026" and "8:00 PM"; the date and time boxes work in 2026-10-31 and 20:00.
const isoDate = (text) => {
  const t = String(text || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const clock = (text) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(text || '').trim());
  if (!m) return '';
  let h = +m[1];
  if (m[3]) h = (h % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  return `${pad2(h)}:${m[2]}`;
};
const twelve = (v) => { const [h, m] = v.split(':').map(Number); return `${h % 12 || 12}:${pad2(m)} ${h < 12 ? 'AM' : 'PM'}`; };
const planClock = (key) => ({ get: (c) => clock(c.plan[key]), set: (c, v) => { if (v) c.plan[key] = twelve(v); } });

export const steps = [
  {
    id: 'quest', pill: 'Start', title: 'The first screen', hint: 'When the link opens, these words show first.',
    preview: { scene: 'quest', crop: crop(14, 66) },
    cards: [{ fields: [
      word('quest:1', 'Title, first line', 40), word('quest:2', 'Title, second line', 40),
      word('quest:3', 'Words under it, first line'), word('quest:4', 'Words under it, second line'),
      word('quest:5', 'Button', 24),
    ] }],
  },
  {
    id: 'game', pill: 'Game', title: 'The heart hunt', hint: 'The little game’s title, and what shows when all five hearts are found.',
    previews: [{ scene: 'game', crop: crop(10, 70) }, { scene: 'heartFound', crop: crop(14, 66) }],
    cards: [{ fields: [
      word('game:1', 'Game title, first part', 30, { pv: 0 }), word('game:2', 'Game title, second part', 30, { pv: 0 }),
      word('heartFound:1', 'When the hearts are found, first part', 30, { pv: 1 }), word('heartFound:2', 'When the hearts are found, second part', 30, { pv: 1 }),
      word('heartFound:3', 'A sweet line, first part', 60, { pv: 1 }), word('heartFound:4', 'A sweet line, second part', 60, { pv: 1 }),
    ] }],
  },
  {
    id: 'q', pill: 'Question', title: 'Write your question', hint: 'The big question after the game, in three lines.',
    preview: { scene: 'invitation', crop: crop(14, 70) },
    cards: [{ fields: [
      word('invitation:1', 'Question, first line'), word('invitation:2', 'Question, second line', 40), word('invitation:3', 'Question, third line'),
      word('invitation:4', 'The “Yes” button', 20), word('invitation:5', 'The “No” button', 20),
    ] }],
  },
  {
    id: 'no', pill: '“No”', title: 'If they press “No”', hint: 'What they see when they press “No”.',
    previews: [{ scene: 'decline', crop: crop(12, 72) }, { scene: 'declined', crop: crop(14, 66) }],
    cards: [{ fields: [
      word('decline:3', 'Title', 40, { pv: 0 }), word('decline:5', 'Words', 60, { pv: 0 }),
      word('decline:6', 'The “I’m sure” button', 30, { pv: 0 }), word('decline:7', 'The “Go back” button', 30, { pv: 0 }),
      word('declined:0', 'Title after “I’m sure”', 40, { pv: 1 }), word('declined:2', 'Words after “I’m sure”', 60, { pv: 1 }), word('declined:3', 'Its back button', 30, { pv: 1 }),
    ] }],
  },
  {
    id: 'joy', pill: 'Yes!', title: 'When they press “Yes”', hint: 'The happy words when they say yes.',
    preview: { scene: 'confirmed', crop: crop(12, 72) },
    cards: [{ fields: [
      word('confirmed:1', 'Title, first word', 30), word('confirmed:2', 'Title, second word', 30),
      word('confirmed:3', 'Under it, first line', 40), word('confirmed:4', 'Under it, second line', 40),
    ] }],
  },
  {
    id: 'plan', pill: 'Plan', title: 'Plan the date', hint: 'The day, time and place show on the card, and they can save it to their calendar.',
    preview: { scene: 'details', crop: crop(12, 74) },
    cards: [{ fields: [
      { type: 'text', path: 'plan.activity', label: 'What will you do?', max: 60 },
      { type: 'date', get: (c) => isoDate(c.plan.date), set: (c, v) => { if (v) c.plan.date = longDate(v); }, label: 'Date' },
      { type: 'time', ...planClock('startTime'), label: 'Starts at' },
      { type: 'time', ...planClock('endTime'), label: 'Ends at' },
      { type: 'text', path: 'plan.location', label: 'Place', max: 60 },
      { type: 'text', path: 'plan.dressCode', label: 'Dress code', max: 60 },
      { type: 'textarea', path: 'plan.message', label: 'A few more words', max: 160, rows: 2 },
    ] }],
  },
  {
    id: 'song', pill: 'Song', title: 'Add your song', hint: 'It starts with their first tap and plays in the background. Copy the song’s link from YouTube and paste it here. Optional.',
    preview: { scene: 'quest', crop: crop(14, 66) },
    cards: [{ fields: [{ type: 'youtube', path: `texts.${SONG_KEY}` }] }],
  },
  {
    id: 'end', pill: 'Finish', title: 'Almost done!', hint: 'Write the last words. “Save and see it” opens the card exactly as they will see it.',
    preview: { scene: 'finale', crop: crop(12, 70) },
    cards: [{ fields: [
      word('finale:0', 'Last title, first line', 40), word('finale:1', 'Last title, second line', 40),
      word('finale:2', 'Last words, first line'), word('finale:3', 'Last words, second line'),
    ] }],
  },
];

const copy = (v) => JSON.parse(JSON.stringify(v));
/** What the boxes need: every box shows the words the card shows. */
export function forEditing(c) {
  const out = copy(c);
  out.texts = { ...WORDS, [SONG_KEY]: '', ...out.texts };
  return out;
}
/** A box left empty goes back to the card's own words; only changed words are kept. */
export function forSaving(c, fallback) {
  const out = copy(c);
  for (const key of Object.keys(out.plan)) if (typeof out.plan[key] === 'string' && !out.plan[key].trim()) out.plan[key] = fallback.plan[key];
  const texts = {};
  for (const [key, value] of Object.entries(out.texts)) {
    const t = String(value).trim();
    if (key === SONG_KEY ? t : (t && t !== String(WORDS[key] ?? '').trim())) texts[key] = key === SONG_KEY ? t : value;
  }
  out.texts = texts;
  return out;
}
/** As the card shows it while it is being written: an emptied box shows the card's own words. */
export function forShowing(c) {
  const out = copy(c);
  for (const [key, value] of Object.entries(out.texts)) if (!String(value).trim() && WORDS[key]) out.texts[key] = WORDS[key];
  return out;
}
