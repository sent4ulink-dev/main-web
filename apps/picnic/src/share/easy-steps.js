// The editor's steps for Birthday Picnic: the card's own words, and where the live preview looks for each step.
// `crop` is the part of a phone screen (in %) the preview zooms to when its dock is small.
import { familySteps } from './family-steps.js';

const crop = (y, h) => ({ x: 0, y, w: 100, h });

export const title = 'Birthday Picnic';

/** `picture()` draws the "Save image" picture from the card as it is now (embed.js). */
export function makeSteps({ picture }) {
  const steps = familySteps({
    intro: { scene: 'intro', crop: crop(6, 56) },
    letterIdeas: [
      'Happy birthday! You are the best gift life has ever given me.',
      'Thank you for every laugh, and for making ordinary days feel special.',
    ],
    letter: { scene: 'letter', sub: 'read', crop: crop(8, 66) },
    photo: { scene: 'moments', slots: true, crop: crop(8, 68) },
    wishHint: 'This wish appears when they open the jar.',
    wishIdeas: ['Happy mornings, and a year full of good news.', 'May every one of your dreams come true.', 'Good health, lots of laughter and many happy years.'],
    wish: { scene: 'wishes', sub: 'open', crop: crop(8, 62) },
    dateHint: 'The day circled on the calendar: their birthday, or a day that is special to you both.',
    date: { scene: 'date', crop: crop(10, 60) },
    instrument: { title: 'The cassette’s song', hint: 'Plays in full when they press play on the walkman. Left empty, a music box plays.' },
    song: { scene: 'song', crop: crop(8, 70) },
    more: [
      { type: 'text', path: 'magic.reveal', label: 'Title in the stars', max: 80 },
      { type: 'textarea', path: 'magic.note', label: 'Words in the stars', max: 200, rows: 2 },
      { type: 'textarea', path: 'intro.subtitle', label: 'Opening words', max: 300, rows: 2 },
    ],
    magic: { scene: 'magic', sub: 'stars', crop: crop(24, 50) },
    finale: { scene: 'finale', crop: crop(4, 60) },
    storyTitlePlaceholder: 'Happy birthday,',
    picture,
  });
  // only the picnic has a cassette with a picture on its label (song.cover: an uploaded picture, or 0 for the first memory photo)
  steps.find((s) => s.id === 'song').cards.push({
    title: 'The cassette’s picture',
    hint: 'Shows on the cassette’s label. Choose a picture, then drag and zoom to place it. Without one, your first memory photo is used.',
    fields: [{
      type: 'photo', path: 'song.cover', empty: 0, shrink: { max: 900 },
      // the card's own picture window, in the cassette label's shape
      crop: async ({ file = null, url = '' }) => {
        const [{ openCropper }, { COVER_ASPECT }] = await Promise.all([import('./cropper.js'), import('../objects/cassette.js')]);
        return openCropper({ file, url, aspect: COVER_ASPECT, maxSide: 900, title: 'The cassette’s picture' });
      },
    }],
  });
  return steps;
}
