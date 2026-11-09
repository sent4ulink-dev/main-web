// The step editor's steps for WinXP, and which screen of the desktop the live preview shows for each
// (easy/preview.ts: invitation, plea + which one, celebration, game, gamedone, activity, place + which one, music,
// notification, message, final).
export const title = 'WinXP';
// (on a phone the windows sit in the middle of the desktop: a small preview zooms to them)
const crop = { x: 0, y: 8, w: 100, h: 76 };
const NL = String.fromCharCode(10);

const plea = (i) => ({ type: 'text', path: `noResponses.${i}`, slot: i, label: `After No, time ${i + 1}`, max: 120 });
const lines = (i) => ({
  get: (c) => (c.activities[i]?.places || []).join(NL),
  set: (c, v) => { c.activities[i].places = v.split(NL); },
});
const activity = (i) => ({
  title: `Choice ${i + 1}`,
  fields: [
    { type: 'text', path: `activities.${i}.name`, label: 'What will you do?', max: 100, pv: 0 },
    { type: 'textarea', ...lines(i), label: 'Where? (one place on each line)', max: 500, rows: 2, pv: 1, slot: i },
  ],
});

export const steps = [
  {
    id: 'q', pill: 'Invitation', title: 'Write your invitation', hint: 'When the window opens, this question shows first.',
    preview: { scene: 'invitation', crop },
    cards: [{
      fields: [
        { type: 'textarea', path: 'invitation', label: 'Question', max: 300, rows: 2 },
        { type: 'text', path: 'yesLabel', label: 'The “Yes” button', max: 40 },
        { type: 'text', path: 'noLabel', label: 'The “No” button', max: 40 },
      ],
      moreLabel: 'More words',
      more: [
        { type: 'text', path: 'invitationTitle', label: 'Window title', max: 60 },
        { type: 'textarea', path: 'invitationBody', label: 'Words under the question', max: 600, rows: 2 },
        { type: 'textarea', path: 'desktopNote', label: 'The note on the desktop', max: 300, rows: 3 },
      ],
    }],
  },
  {
    id: 'plea', pill: '“No”', title: 'If they press “No”', hint: 'Each time they press “No”, the next of these shows. A line left empty doesn’t show.',
    preview: { scene: 'plea', slots: true, crop },
    cards: [{ fields: [0, 1, 2, 3, 4, 5].map(plea) }],
  },
  {
    id: 'joy', pill: 'Yes!', title: 'When they press “Yes”', hint: 'The happy words when they say yes.',
    preview: { scene: 'celebration', crop },
    cards: [{ fields: [
      { type: 'text', path: 'celebrationTitle', label: 'Title', max: 60 },
      { type: 'textarea', path: 'celebration', label: 'Words', max: 300, rows: 3 },
    ] }],
  },
  {
    id: 'game', pill: 'Game', title: 'The heart hunt', hint: 'What the little game says before it starts, and once all five hearts are found.',
    previews: [{ scene: 'game', crop }, { scene: 'gamedone', crop }],
    cards: [{
      fields: [
        { type: 'textarea', path: 'gameInstructions', label: 'How to play', max: 300, rows: 3, pv: 0 },
        { type: 'textarea', path: 'gameComplete', label: 'When all hearts are found', max: 300, rows: 2, pv: 1 },
      ],
      moreLabel: 'Words while playing',
      more: [
        ...[0, 1, 2].map((i) => ({ type: 'text', path: `heartMessages.${i}`, label: `A heart is found ${i + 1}`, max: 80, pv: 0 })),
        ...[0, 1].map((i) => ({ type: 'text', path: `wrongMessages.${i}`, label: `A miss ${i + 1}`, max: 80, pv: 0 })),
      ],
    }],
  },
  {
    id: 'plan', pill: 'Plan', title: 'What will you do together?', hint: 'They choose from these. A choice left empty doesn’t show.',
    previews: [{ scene: 'activity', crop }, { scene: 'place', slots: true, crop }],
    cards: [{ fields: [{ type: 'text', path: 'activityPrompt', label: 'Question', max: 120, pv: 0 }] }, ...[0, 1, 2, 3, 4].map(activity)],
  },
  {
    id: 'song', pill: 'Song', title: 'Add your song', hint: 'It plays in the music player on the desktop. Copy the song’s link from YouTube and paste it here.',
    preview: { scene: 'music', crop },
    cards: [{ fields: [{ type: 'youtube', path: 'youtubeUrl' }, { type: 'text', path: 'soundtrackTitle', label: 'Song title', max: 60 }] }],
  },
  {
    id: 'mail', pill: 'Mail', title: 'The last mail', hint: 'What they chose fills itself in where it’s locked. Change all the other words as you like.',
    previews: [{ scene: 'notification', crop }, { scene: 'message', crop }],
    cards: [{ fields: [
      { type: 'text', path: 'sender', label: 'Your name', max: 60, pv: 0 },
      { type: 'template', path: 'notification', label: 'The notification', max: 120, pv: 0, tokens: { sender: { label: 'Your name', get: (c) => c.sender } }, hint: 'Your name fills itself in.' },
      { type: 'text', path: 'greeting', label: 'Greeting', max: 120, pv: 1 },
      { type: 'text', path: 'messageTitle', label: 'Subject', max: 120, pv: 1 },
      { type: 'template', path: 'messageTemplate', label: 'The mail', max: 900, rows: 6, pv: 1, tokens: { activity: { label: 'What you’ll do' }, date: { label: 'The day' }, time: { label: 'The time' }, place: { label: 'The place' }, customClosing: { label: 'Last words', end: true }, sender: { label: 'Your name', get: (c) => c.sender, optional: true } } },
      { type: 'textarea', path: 'customClosing', label: 'Last words', max: 240, rows: 2, pv: 1 },
    ] }],
  },
  {
    id: 'end', pill: 'Finish', title: 'Almost done!', hint: '“Save and see it” opens the card exactly as they will see it.',
    preview: { scene: 'final', crop },
    cards: [{ fields: [
      { type: 'textarea', path: 'finalHeading', label: 'Last title', max: 120, rows: 2 },
      { type: 'textarea', path: 'finalClosing', label: 'Last words', max: 240, rows: 2 },
    ] }],
  },
];

const pad = (list, n, make) => { const out = [...list]; while (out.length < n) out.push(make(out.length)); return out; };
const copy = (v) => JSON.parse(JSON.stringify(v));

/** What the boxes need: every one has something to write into. */
export function forEditing(c) {
  const out = copy(c);
  out.noResponses = pad(out.noResponses, 6, () => '');
  out.heartMessages = pad(out.heartMessages, 3, () => '');
  out.wrongMessages = pad(out.wrongMessages, 2, () => '');
  out.activities = pad(out.activities, 5, (i) => ({ id: `new-${i}`, name: '', places: [] }));
  return out;
}
/** What the server takes: nothing may be empty, so an emptied box keeps the last saved words; empty lines and
 *  choices are left out, and a choice with no place is met at its own name. */
export function forSaving(c, fallback, isYouTube) {
  const out = copy(c);
  for (const [k, v] of Object.entries(out)) if (typeof v === 'string' && k !== 'youtubeUrl' && !v.trim()) out[k] = fallback[k];
  for (const k of ['noResponses', 'heartMessages', 'wrongMessages']) {
    const kept = out[k].map((t) => t.trim()).filter(Boolean);
    out[k] = kept.length ? kept : fallback[k];
  }
  const activities = out.activities.filter((a) => a.name.trim()).map((a) => {
    const places = a.places.map((p) => p.trim()).filter(Boolean);
    return { ...a, places: places.length ? places : [a.name.trim()] };
  });
  out.activities = activities.length ? activities : fallback.activities;
  out.youtubeUrl = isYouTube(out.youtubeUrl || '') ? out.youtubeUrl.trim() : '';
  return out;
}
