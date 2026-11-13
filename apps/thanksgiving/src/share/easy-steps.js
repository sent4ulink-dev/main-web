// The easy editor's steps for Thanksgiving Together. Each step's preview is a part of the live card (embed.js):
// `scene` is where the card goes, `crop` the part of a phone screen shown when the dock is small (% of the screen).
import { guestsField } from './easy-guests.js';

export const title = 'Thanksgiving Together';

const CROP = {
  porch: { x: 0, y: 8, w: 100, h: 50 },
  table: { x: 0, y: 3, w: 100, h: 52 },
  dress: { x: 14, y: 14, w: 72, h: 60 },
  board: { x: 9, y: 16, w: 82, h: 47 },
  wall: { x: 0, y: 17, w: 100, h: 41 },
  tv: { x: 0, y: 10, w: 100, h: 48 },
  finale: { x: 0, y: 12, w: 100, h: 50 },
};

/**
 * `photos`: the card's six frames on the wall ({ url(n), store(n, file), drop(n) }); `picture()`: the saved picture
 * as it would come out now; `roster` and `live`: the guest list and the live preview (for the family step).
 */
export function makeSteps({ photos, picture, roster, live }) {
  return [
    {
      id: 'names', pill: 'Names', title: 'Whose table is it?',
      hint: 'Your family’s name is on the porch, the welcome board and the photo wall. Watch it appear as you type.',
      cards: [{
        fields: [
          { type: 'text', path: 'family', label: 'Family name', max: 40, placeholder: 'The Millers', pv: 0 },
          { type: 'text', path: 'host', label: 'Hosted by', max: 60, placeholder: 'Linda & Tom', pv: 1, hint: 'Signed at the bottom of the welcome board.' },
        ],
        more: [
          { type: 'text', path: 'intro.eyebrow', label: 'The small line on top', max: 40, pv: 0 },
          { type: 'text', path: 'intro.title', label: 'The words before the name', max: 40, pv: 0 },
          {
            type: 'text', label: 'The words that keep changing (separated by commas)', max: 200, pv: 0,
            get: (c) => (c.intro.words || []).join(', '),
            set: (c, v) => { const list = v.split(',').map((w) => w.trim()).filter(Boolean).slice(0, 8); if (list.length) c.intro.words = list; },
          },
        ],
        moreLabel: 'The porch words',
      }],
      previews: [{ scene: 'intro', crop: CROP.porch }, { scene: 'welcome', crop: CROP.board }],
    },
    {
      id: 'family', pill: 'Family', title: 'Who’s coming?',
      hint: 'Add everyone you’re inviting and dress them up: they take their seats at the table as you go. On the guest link, each person taps their own name, can change their character and answers yes or no.',
      cards: [{ fields: [guestsField({ roster, live, crops: { dress: CROP.dress } })] }],
      preview: { scene: 'table', crop: CROP.table },
    },
    {
      id: 'welcome', pill: 'Welcome', title: 'The welcome board',
      hint: 'Chalked on the board by the front door as the family walks in.',
      cards: [{
        fields: [
          {
            type: 'textarea', path: 'letter.paragraphs.0', label: 'A few words from you', max: 150, rows: 3,
            hint: 'Up to four lines of chalk.',
            suggest: [
              'The leaves are turning, the oven is warming up, and we would love to have every one of you around our table this year.',
              'Come hungry, stay late. There is always room for one more chair at our table.',
              'This year we are grateful for every one of you. Come share a meal, a story and a slice of pie.',
            ],
          },
          { type: 'text', path: 'letter.signoff', label: 'Signed', max: 40, placeholder: 'With love and gratitude,', hint: 'Your names (from the first step) follow.' },
        ],
      }],
      preview: { scene: 'welcome', crop: CROP.board },
    },
    {
      id: 'when', pill: 'When & where', title: 'When and where',
      hint: 'The board is wiped and chalked again with these. Guests can add the day to their calendar and get directions.',
      cards: [{
        fields: [
          { type: 'date', label: 'The day', get: (c) => c.date.iso, set: (c, v) => { if (/^\d{4}-\d{2}-\d{2}$/.test(v)) c.date.iso = v; } },
          { type: 'text', path: 'date.time', label: 'Doors open', max: 20, placeholder: '2:00 PM' },
          { type: 'text', path: 'date.dinner', label: 'Dinner at', max: 20, placeholder: '4:30 PM' },
          { type: 'text', path: 'place.name', label: 'The place', max: 40, placeholder: 'The farmhouse' },
          { type: 'textarea', path: 'place.address', label: 'Address', max: 120, rows: 2, hint: 'The Directions button opens this in maps.' },
          { type: 'text', path: 'place.note', label: 'A note for arriving', max: 90, placeholder: 'Park by the red barn' },
        ],
      }],
      preview: { scene: 'details', crop: CROP.board },
    },
    {
      id: 'photos', pill: 'Photos', title: 'Family photos on the wall',
      hint: 'Up to six pictures hang over the sideboard, under a plaque with your family’s name. Until you add some, old painted snapshots hang there.',
      cards: [{ fields: [{ type: 'photos', slots: 6, ...photos }] }],
      preview: { scene: 'family', crop: CROP.wall },
    },
    {
      id: 'tv', pill: 'Parade & game', title: 'On the TV',
      hint: 'After dinner everybody gathers round the TV. Write what’s on.',
      cards: [
        {
          title: 'In the morning: the parade',
          fields: [
            { type: 'text', path: 'parade.title', label: 'Show', max: 40, pv: 0 },
            { type: 'text', path: 'parade.when', label: 'When and where to watch', max: 90, pv: 0 },
            { type: 'textarea', path: 'parade.note', label: 'A note', max: 160, rows: 2, pv: 0 },
          ],
        },
        {
          title: 'In the afternoon: football',
          fields: [
            { type: 'text', path: 'football.title', label: 'Show', max: 40, pv: 1 },
            { type: 'textarea', path: 'football.games', label: 'The games', max: 160, rows: 2, pv: 1 },
            { type: 'textarea', path: 'football.note', label: 'A note', max: 160, rows: 2, pv: 1 },
          ],
        },
      ],
      previews: [{ scene: 'gameday', sub: 'parade', crop: CROP.tv }, { scene: 'gameday', sub: 'football', crop: CROP.tv }],
    },
    {
      id: 'end', pill: 'Finish', title: 'Almost done!',
      hint: 'The closing words after the family photo, and the picture everyone can save. Then send the family their link.',
      cards: [
        {
          fields: [
            { type: 'text', path: 'finale.title', label: 'Closing title', max: 40, placeholder: 'Happy Thanksgiving', pv: 0 },
            { type: 'text', path: 'finale.subtitle', label: 'Closing words', max: 80, placeholder: 'Grateful for every one of you', pv: 0 },
          ],
        },
        {
          title: 'The saved picture',
          hint: 'After the family photo, everyone can save it as a picture with your family’s name and this line at the bottom.',
          fields: [{ type: 'text', path: 'share.line', label: 'The line at the bottom', max: 70, pv: 1 }],
        },
      ],
      previews: [{ scene: 'photo', crop: CROP.finale }, { scene: 'photo', picture }],
    },
  ];
}
