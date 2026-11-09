// The editor's steps for Mission: the card's own words, and where the live preview looks for each step.
// `crop` is the part of a phone screen (in %) the preview zooms to when its dock is small.
import { familySteps } from './family-steps.js';

const crop = (y, h) => ({ x: 0, y, w: 100, h });

export const title = 'Mission';

/** `picture()` draws the saved picture from the card as it is now (embed.js). */
export function makeSteps({ picture }) {
  return familySteps({
    intro: { scene: 'intro', crop: crop(6, 56) },
    letterTitle: 'Write the mission letter',
    letterIdeas: [
      'Happy birthday, agent! Your mission today: laugh, have fun and open every gift.',
      'Thank you for always having my back, in every match and every day.',
    ],
    letter: { scene: 'letter', sub: 'read', crop: crop(8, 66) },
    photo: { scene: 'moments', slots: true, crop: crop(8, 68) },
    wishHint: 'This wish is the legendary prize when they open the loot case.',
    wishIdeas: ['May every win come easy this year, and may your friends always be by your side!', 'May every one of your dreams come true.', 'Good health, lots of laughter and many happy years.'],
    wish: { scene: 'wishes', sub: 'open', crop: crop(8, 62) },
    dateHint: 'This day’s month and day is the secret code that stops the party timer, so their birthday works best.',
    date: { scene: 'date', crop: crop(10, 60) },
    instrument: { title: 'The radio’s song', hint: 'Plays in full when they turn on the radio. Left empty, the radio plays its own birthday tune.' },
    song: { scene: 'music', crop: crop(8, 70) },
    more: [
      { type: 'text', path: 'magic.reveal', label: 'Title on the wall', max: 80 },
      { type: 'textarea', path: 'magic.note', label: 'Words under it', max: 200, rows: 2 },
    ],
    magic: { scene: 'spray', sub: 'stars', crop: crop(24, 50) },
    finale: { scene: 'finale', crop: crop(4, 60) },
    storyTitlePlaceholder: 'HAPPY BIRTHDAY',
    picture,
  });
}
