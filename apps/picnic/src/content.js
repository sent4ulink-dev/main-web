// ─────────────────────────────────────────────────────────────
//  Change the picnic text here.
//  Edit this file to personalise the birthday picnic.
//  Photos: drop image files into public/photos/ and list them below.
// ─────────────────────────────────────────────────────────────
export const content = {
  name: 'Charlie',        // who is celebrating
  from: 'Bobby',          // who made the gift
  age: null,               // e.g. 25 — shown in the finale when set

  intro: {
    eyebrow: 'A little picnic, just for you',
    title: 'Happy birthday',
    prefix: 'You are truly',
    words: ['kind', 'radiant', 'brave', 'playful', 'generous', 'wonderful', 'beloved'],
    subtitle: 'Someone has set a table on the quiet grass. Everything here was chosen for you.',
  },

  letter: {
    greeting: 'Dear {name},',
    paragraphs: [
      'Happy birthday! This year I wanted to give you something a little different — a picnic under a starry sky, a table full of your favourite things, and a few little surprises waiting on it.',
      'Thank you for every laugh, for every conversation that runs late into the night, for making ordinary days feel special. Because you are here, this world feels a little softer.',
      'Take your time here. Read, listen, whisper a wish. Today this whole lawn is yours.',
    ],
    signoff: 'With all my love,',
  },

  // the crystal ball writes the name in the stars
  magic: {
    hint: 'A crystal ball and a little magic wand. Wave it and see what the stars say.',
    reveal: 'Written in the stars',
    note: 'Some things are simply meant to be — you, and this day.',
  },

  wishes: [
    'Happy mornings, and a year full of good news.',
  ],

  // Leave `src` empty to use painted placeholders; uploaded photos are stored as 'media/<name>.webp'
  photos: [
    { src: '', caption: 'Our first trip' },
    { src: '', caption: 'That sunset' },
    { src: '', caption: 'The best day' },
    { src: '', caption: 'Us, laughing' },
    { src: '', caption: 'Our first picnic' },
  ],

  date: {
    iso: '2026-10-14',     // the special date shown on the calendar (YYYY-MM-DD)
    label: 'The day the world got brighter',
    note: 'Some days deserve to be circled on every calendar, every year.',
  },

  song: {
    title: 'Happy birthday — a music box',
    note: 'A little tune, wound up just for you.',
    cover: 0,               // which photo goes on the cassette label (index into photos), or an uploaded image
    bg: '',                 // a YouTube link played quietly (40%) in the background through the card
    youtube: '',            // a YouTube link the walkman plays (empty: the music box)
    voice: '',              // an uploaded voice message (max 30 s), played instead of the music box
  },

  finale: {
    title: 'Happy birthday',
    subtitle: 'With all my love',
  },

  // the "Save image" story picture (1080×1920) made from the last-moment photo
  share: {
    logo: '',                                  // a logo image for the top of the story image (empty: the brand text is drawn)
    brand: 'sent4u',              // text logo used when no logo image is set
    title: 'Happy birthday,',                  // the headline above the name (empty: none)
    line: 'This night will stay a memory forever ✨', // short line at the bottom
  },
};
