// ─────────────────────────────────────────────────────────────
//  Change the salon's text here.
//  Edit this file to personalise the birthday salon (Mozart's & Beethoven's Vienna).
// ─────────────────────────────────────────────────────────────
export const content = {
  name: 'Charlie',        // who is celebrating
  from: 'Bobby',          // who made the gift
  age: null,               // e.g. 25 — shown in the finale when set

  intro: {
    eyebrow: 'Vienna, a candle-lit salon',
    title: 'Happy birthday',
    prefix: 'You are truly',
    words: ['noble', 'radiant', 'brave', 'playful', 'generous', 'wonderful', 'beloved'],
    subtitle: 'In the Vienna of Mozart and Beethoven, the candles are lit and the music is ready.',
  },

  letter: {
    greeting: 'Dearest {name},',
    paragraphs: [
      'Happy birthday! This year I am inviting you to a salon in eighteenth-century Vienna — candlelight, tea with milk, music, and a few little surprises made just for you.',
      'Thank you for every laugh, for every conversation that runs late into the night, for turning ordinary days into celebrations. Like a melody of Mozart’s, you make this world a little brighter.',
      'Take your time. Read your letter, listen to the music, whisper a wish. Tonight this whole salon is yours.',
    ],
    signoff: 'With respect and love,',
  },

  // the quill writes the name, and it flies up in golden stars
  magic: {
    hint: 'Ink, quill, magic. The quill begins to write by itself.',
    reveal: 'Written in golden ink',
    note: 'Some names, like music, outlast time.',
  },

  wishes: [
    'Happy mornings, and a year full of good news.',
  ],

  // the five portraits on the gallery wall (uploaded photos are stored as 'media/<name>.webp')
  photos: [
    { src: '', caption: 'Our first trip' },
    { src: '', caption: 'That sunset' },
    { src: '', caption: 'The best day' },
    { src: '', caption: 'Us, laughing' },
    { src: '', caption: 'The first party' },
  ],

  date: {
    iso: '2026-10-14',     // the special date shown on the calendar (YYYY-MM-DD)
    label: 'The day the world got brighter',
    note: 'Some days deserve to be circled on every calendar, every year.',
  },

  song: {
    title: 'Mozart & Beethoven — a birthday concert',
    note: 'The instruments play by themselves, just for you.',
    youtube: '',            // a YouTube link played as background music (empty: the fortepiano concert)
    voice: '',              // an uploaded voice message (max 30 s)
    bg: '',                 // a YouTube song played softly (40%) in the background from the start (empty: none)
  },

  finale: {
    title: 'Happy birthday',
    subtitle: 'With respect and love',
  },

  // the "Save image" story picture (1080×1920) made from the painted portrait
  share: {
    logo: '',                                  // a logo image for the top of the story image (empty: the brand text is drawn)
    brand: 'sent4u',               // text logo used when no logo image is set
    title: 'Happy birthday,',                  // the headline above the name
    line: 'This evening will last forever, like music ✨',      // short line at the bottom
  },
};
