// The editor's steps for the birthday cards (Picnic, Heritage, Mission, Halloween Night). Each card gives its own words
// and, for every step, which part of the card the live preview shows (see easy-steps.js).

export const whoStep = (card) => ({
  id: 'who', pill: 'Names', title: 'Who is it for, and from whom?', hint: 'A name or a nickname is fine. It shows in the card as you type.',
  cards: [{
    fields: [
      { type: 'text', path: 'name', label: 'Their name', max: 40, placeholder: 'For example: Anna' },
      { type: 'text', path: 'from', label: 'Your name', max: 40, placeholder: 'For example: Sam' },
    ],
    more: [
      { type: 'text', path: 'intro.title', label: 'Title', max: 60 },
      { type: 'text', path: 'intro.prefix', label: 'Words before the changing word', max: 40 },
      { type: 'text', label: 'Changing words (separated by commas)', max: 160, get: (c) => (c.intro.words || []).join(', '), set: (c, v) => { const list = v.split(',').map((w) => w.trim()).filter(Boolean).slice(0, 12); if (list.length) c.intro.words = list; } },
    ],
  }],
  preview: card.intro,
});

export const letterStep = (card) => ({
  id: 'letter', pill: 'Letter', title: card.letterTitle || 'Write your letter', hint: 'Write the words only they should hear. Stuck? Tap one of the ideas to start from it.',
  cards: [{
    fields: [
      { type: 'template', path: 'letter.greeting', label: 'Greeting', max: 80, tokens: { name: { label: 'Their name', get: (c) => c.name } }, hint: 'Their name fills itself in. You can change the words around it.' },
      { type: 'textarea', path: 'letter.paragraphs.0', label: 'First paragraph', max: 700, rows: 4, suggest: card.letterIdeas },
      { type: 'textarea', path: 'letter.paragraphs.1', label: 'Second paragraph', max: 700, rows: 3 },
      { type: 'textarea', path: 'letter.paragraphs.2', label: 'Third paragraph', max: 700, rows: 3 },
      { type: 'text', path: 'letter.signoff', label: 'Sign-off', max: 60, placeholder: 'With all my love,' },
    ],
  }],
  preview: card.letter,
});

export const photosStep = (card) => ({
  id: 'photos', pill: 'Photos', title: 'Add your memories', hint: 'Tap a box to choose a photo. You can add a few words under each one.',
  cards: [0, 1, 2, 3, 4].map((i) => ({ title: `Photo ${i + 1}`, fields: [{ type: 'photo', path: `photos.${i}.src`, captionPath: `photos.${i}.caption`, slot: i, captionMax: 60 }] })),
  preview: card.photo,
});

export const wishStep = (card) => ({
  id: 'wish', pill: 'Wish', title: 'Write a wish', hint: card.wishHint,
  cards: [{ fields: [{ type: 'textarea', path: 'wishes.0', label: 'Wish', max: 300, rows: 4, placeholder: 'May this year bring you the very best.', suggest: card.wishIdeas }] }],
  preview: card.wish,
});

export const dateStep = (card) => ({
  id: 'date', pill: 'Date', title: 'Pick your special day', hint: card.dateHint,
  cards: [{
    fields: [
      { type: 'date', label: 'Date', get: (c) => c.date.iso, set: (c, v) => { if (v) c.date.iso = v; } },
      { type: 'text', path: 'date.label', label: 'Name of the day', max: 80 },
      { type: 'textarea', path: 'date.note', label: 'A few more words', max: 200, rows: 2 },
    ],
  }],
  preview: card.date,
});

export const songStep = (card) => ({
  id: 'song', pill: 'Song', title: 'Add a song and your voice', hint: 'The songs never play over each other: when one plays, the other pauses and picks up again after.',
  cards: [
    { title: 'Background song', hint: 'Plays softly (40%) from the moment the card opens. Optional.', fields: [{ type: 'youtube', path: 'song.bg' }] },
    { title: card.instrument.title, hint: card.instrument.hint, fields: [{ type: 'youtube', path: 'song.youtube' }] },
    { title: 'Your voice', hint: 'Record a greeting of up to 30 seconds in your own voice. A quiet room sounds clearest.', fields: [{ type: 'voice', path: 'song.voice' }] },
  ],
  preview: card.song,
});

export const endStep = (card) => ({
  id: 'end', pill: 'Finish', title: 'Almost done!', hint: 'Write your closing words. “Save and see it” opens the card exactly as they will see it.',
  cards: [{
    fields: [
      { type: 'text', path: 'finale.title', label: 'Closing title', max: 60, pv: 0 },
      { type: 'text', path: 'finale.subtitle', label: 'Closing words', max: 80, pv: 0 },
    ],
    more: (card.more || []).map((f) => ({ ...f, pv: f.path?.startsWith('magic.') ? 1 : f.path?.startsWith('intro.') ? 2 : 0 })),
    moreLabel: 'More words',
  }, {
    title: 'The saved picture',
    hint: 'At the end, “Save image” makes this picture. Their name and the date fill themselves in.',
    fields: [
      { type: 'text', path: 'share.title', label: 'Headline', max: 40, pv: 3, placeholder: card.storyTitlePlaceholder || '' },
      { type: 'text', path: 'share.line', label: 'Bottom line', max: 60, pv: 3 },
    ],
  }],
  // the closing scene, the words in the stars, the first screen, and the saved picture drawn from the words
  previews: [card.finale, card.magic || card.finale, card.intro, { picture: card.picture }],
});

export const familySteps = (card) => [whoStep(card), letterStep(card), photosStep(card), wishStep(card), dateStep(card), songStep(card), endStep(card)];
