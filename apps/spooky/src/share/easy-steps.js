// The editor's steps for Halloween Night: the card's own words, and where the live preview looks for each step.
// `crop` is the part of a phone screen (in %) the preview zooms to when its dock is small.
import { familySteps } from './family-steps.js';

const crop = (y, h) => ({ x: 0, y, w: 100, h });

export const title = 'Halloween Night';

// the night itself (on the crypt's plaque) and the plan for it (on four gravestones that rise out of the ground)
const dateStep = {
  id: 'date', pill: 'Night', title: 'Pick the night and plan it', hint: 'The night shows on the crypt’s plaque, and your plan rises on four gravestones.',
  cards: [{
    fields: [
      { type: 'date', label: 'Date', get: (c) => c.date.iso, set: (c, v) => { if (v) c.date.iso = v; }, pv: 0 },
      { type: 'text', path: 'date.label', label: 'Name of the night', max: 80, pv: 0 },
      { type: 'textarea', path: 'date.note', label: 'A few more words', max: 200, rows: 2, pv: 0, placeholder: 'Get your costume ready: 7 pm at the gate.' },
    ],
  }, {
    title: 'The plan for the night',
    hint: 'Four things you will do, each with a time.',
    fields: [0, 1, 2, 3].flatMap((i) => [
      { type: 'time', path: `plan.${i}.time`, label: `Time ${i + 1}`, pv: 1 },
      { type: 'text', path: `plan.${i}.title`, label: `Plan ${i + 1}`, max: 60, pv: 1 },
    ]),
  }],
  previews: [{ scene: 'date', sub: 'crypt', crop: crop(10, 62) }, { scene: 'date', sub: 'plan', crop: crop(10, 62) }],
};

/** `picture()` draws the saved photo from the card as it is now (embed.js). */
export function makeSteps({ picture }) {
  return familySteps({
    intro: { scene: 'intro', crop: crop(6, 56) },
    letterTitle: 'Write your invitation',
    letterIdeas: [
      'The moon is full and the pumpkins are glowing. This Halloween, I want to spend it with you.',
      'Follow the path up the hill: our scariest and funniest memories are waiting for you.',
    ],
    letter: { scene: 'letter', sub: 'read', crop: crop(8, 66) },
    photo: { scene: 'moments', slots: true, crop: crop(8, 68) },
    wishHint: 'This wish rises out of the cauldron on a scroll when the potion is ready.',
    wishIdeas: ['May this Halloween be our scariest, funniest, most unforgettable night yet!', 'More treats than tricks, and lots of laughs together.', 'May every ghost tonight be a friendly one.'],
    wish: { scene: 'potion', sub: 'open', crop: crop(8, 62) },
    dateStep,
    instrument: { title: 'The gramophone’s song', hint: 'Plays in full when they spin the record. Left empty, the haunted organ plays.' },
    songNote: false,
    song: { scene: 'music', crop: crop(8, 70) },
    more: [
      { type: 'text', path: 'magic.reveal', label: 'Title by the carved pumpkin', max: 80 },
      { type: 'textarea', path: 'magic.note', label: 'Words by the carved pumpkin', max: 200, rows: 2 },
    ],
    magic: { scene: 'pumpkin', sub: 'carve', crop: crop(14, 60) },
    finale: { scene: 'finale', crop: crop(4, 60) },
    storyTitle: false,
    pictureHint: 'At the end, “Save the photo” makes this picture, with your closing title on top. Their name and the date fill themselves in.',
    picture,
  });
}
