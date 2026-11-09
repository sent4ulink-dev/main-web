// The editor's steps for Heritage: the card's own words, and where the live preview looks for each step.
// `crop` is the part of a phone screen (in %) the preview zooms to when its dock is small.
import { familySteps } from './family-steps.js';

const crop = (y, h) => ({ x: 0, y, w: 100, h });

export const title = 'Heritage';

/** `picture()` draws the "Save the picture" picture from the card as it is now (embed.js). */
export function makeSteps({ picture }) {
  return familySteps({
    intro: { scene: 'intro', crop: crop(6, 56) },
    letterIdeas: [
      'Happy birthday! Tonight the candles are lit and the music is ready, all for you.',
      'Thank you for every laugh, and for turning ordinary days into celebrations.',
    ],
    letter: { scene: 'letter', sub: 'read', crop: crop(8, 66) },
    photo: { scene: 'moments', slots: true, crop: crop(8, 68) },
    wishHint: 'This wish appears on the scroll when they open the casket.',
    wishIdeas: ['Happy mornings, and a year full of good news.', 'May every one of your dreams come true.', 'Good health, lots of laughter and many happy years.'],
    wish: { scene: 'wishes', sub: 'open', crop: crop(8, 62) },
    dateHint: 'The day on the calendar over the fireplace: their birthday, or a day that is special to you both.',
    date: { scene: 'date', crop: crop(10, 60) },
    instrument: { title: 'The concert’s song', hint: 'Plays in full when they press play at the concert, and the instruments play along. Left empty, the fortepiano plays Mozart and Beethoven.' },
    song: { scene: 'music', crop: crop(8, 70) },
    more: [
      { type: 'text', path: 'magic.reveal', label: 'Title in golden ink', max: 80 },
      { type: 'textarea', path: 'magic.note', label: 'Words under it', max: 200, rows: 2 },
    ],
    magic: { scene: 'quill', sub: 'stars', crop: crop(24, 50) },
    finale: { scene: 'finale', crop: crop(4, 60) },
    storyTitlePlaceholder: 'Happy birthday,',
    picture,
  });
}
