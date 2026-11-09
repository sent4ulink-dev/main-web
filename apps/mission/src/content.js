// ─────────────────────────────────────────────────────────────
//  Change the mission text here.
//  Edit this file to personalise the birthday (a desert-base "operation birthday").
// ─────────────────────────────────────────────────────────────
export const content = {
  name: 'Charlie',        // who is celebrating
  from: 'Bobby',          // who made the gift
  age: null,               // e.g. 25 — shown in the finale when set

  intro: {
    eyebrow: 'Mission: Birthday',
    title: 'Happy birthday',
    prefix: 'Today’s MVP is',
    words: ['you', 'brave', 'fun', 'reliable', 'amazing', 'simply the best'],
    subtitle: 'The base is ready. Balloons, cake, surprises — everything is in position.',
  },

  letter: {
    greeting: 'Agent {name},',
    paragraphs: [
      'Happy birthday! Your mission today: laugh, have fun, open every gift. You are not allowed to decline.',
      'Thank you for having my back through so many matches, for clutching it when things got hard, and for celebrating every win together. You are a true team player.',
      'I built this base just for you. Take your time — there are plenty of surprises.',
    ],
    signoff: 'From the team, with love,',
  },

  // the rifle writes the name on the wall in bullet holes, inside a heart
  magic: {
    hint: 'The rifle is ready. Open fire and watch what the wall writes.',
    reveal: 'Written on the wall forever',
    note: 'Some names are written not on walls, but on hearts.',
  },

  wishes: [
    'May every win come easy in your new year, and may your friends always be by your side!',
  ],

  // the five polaroids pinned on the pallet board (uploaded photos are stored as 'media/<name>.webp')
  photos: [
    { src: '', caption: 'Our first win' },
    { src: '', caption: 'Playing all night' },
    { src: '', caption: 'The best day' },
    { src: '', caption: 'The team, laughing' },
    { src: '', caption: 'That time you aced it' },
  ],

  date: {
    iso: '2026-10-14',     // the special date shown on the party timer (YYYY-MM-DD)
    label: 'The day a new MVP was born',
    note: 'We celebrate this day every year.',
  },

  song: {
    title: 'On the radio: the birthday song',
    note: 'Turn on the radio and listen.',
    youtube: '',            // a YouTube link played as background music (empty: the radio's own birthday song)
    voice: '',              // an uploaded voice message (max 30 s), played as a radio call
    bg: '',                 // a YouTube song played softly (40%) in the background from the start (empty: none)
  },

  finale: {
    title: 'Happy birthday',
    subtitle: 'From the team, with love',
  },

  // the "Save image" story picture (1080×1920): an MVP card made from the last shot
  share: {
    logo: '',                                  // a logo image for the top of the story image (empty: the brand text is drawn)
    brand: 'sent4u',           // text logo used when no logo image is set
    title: 'HAPPY BIRTHDAY',                   // the headline at the top
    line: 'GG WP — stay an MVP in your new year too 🏆',   // short line at the bottom
  },
};
