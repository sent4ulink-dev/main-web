// ─────────────────────────────────────────────────────────────
//  Change the Halloween night text here.
//  Edit this file to personalise the Halloween night (a haunted-graveyard date invitation and memory book).
// ─────────────────────────────────────────────────────────────
export const content = {
  name: 'Charlie',        // who the night is for
  from: 'Bobby',          // who made it

  intro: {
    eyebrow: 'The Haunted Hill',
    title: 'Happy Halloween',
    prefix: 'Tonight',
    words: ['the ghosts wake up', 'the pumpkins glow', 'we get scared together', 'secrets come out', 'it rains candy'],
    subtitle: 'The gate is open. Follow the path in… if you dare.',
  },

  letter: {
    greeting: 'Dear {name},',
    paragraphs: [
      'The moon is full, the fog is rolling in and the pumpkins are starting to glow. This Halloween, I want to spend it with you.',
      'Our scariest and funniest memories are hidden on this hill. Follow the path and find them one by one.',
      'The gravestones will tell you what is waiting for us. Don\'t be scared — I\'ll be right beside you.',
    ],
    signoff: 'Waiting for you in the dark,',
  },

  // the giant pumpkin: the name is carved into it as the jack-o'-lantern's grin
  magic: {
    hint: 'Pick up the knife and carve the pumpkin.',
    reveal: 'A name carved in the pumpkin',
    note: 'The brightest lantern tonight — you.',
  },

  // the scroll the ghost brings up out of the cauldron
  wishes: [
    'May this Halloween be our scariest, funniest, most unforgettable night yet!',
  ],

  // five old polaroids hanging from the dead tree (uploaded photos are stored as 'media/<name>.webp')
  photos: [
    { src: '', caption: 'Our first Halloween' },
    { src: '', caption: 'Pumpkin carving night' },
    { src: '', caption: 'Horror movie night' },
    { src: '', caption: 'Our costumes' },
    { src: '', caption: 'The candy hunt' },
  ],

  date: {
    iso: '2026-10-31',     // the night of the date (YYYY-MM-DD), on the crypt's plaque
    label: 'Halloween date',
    note: 'Get your costume ready — 7 pm at the gate.',
  },

  // the plan, engraved on the four tombstones that rise out of the ground
  plan: [
    { time: '19:00', title: 'Pumpkin carving' },
    { time: '20:30', title: 'Horror movie' },
    { time: '22:00', title: 'Haunted walk' },
    { time: '23:30', title: 'Hot chocolate' },
  ],

  song: {
    title: 'Spooky Tunes',
    note: 'Spin the record and make the ghosts dance.',
    youtube: '',            // a YouTube link played on the gramophone (empty: the haunted organ)
    voice: '',              // an uploaded voice message (max 30 s), played as a ghostly whisper
    bg: '',                 // a YouTube song played softly (40%) in the background from the start (empty: none)
  },

  finale: {
    title: 'Happy Halloween',
    subtitle: 'Let\'s make tonight last forever',
  },

  // the "Save image" story picture (1080×1920): an old spirit photograph on a haunted poster
  share: {
    logo: '',                                  // a logo image for the top (empty: the brand text is drawn)
    brand: 'Halloween Night',
    line: 'The night we got scared — together 🎃',
  },
};
