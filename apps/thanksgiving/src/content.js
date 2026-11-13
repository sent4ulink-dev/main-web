// ─────────────────────────────────────────────────────────────
//  Edit this file to change the card's default wording.
//  (Each card's own words are edited in place on the card itself; the guest list and the potluck
//  are kept separately, see src/share/guests-core.js.)
// ─────────────────────────────────────────────────────────────
export const content = {
  family: 'The Millers',            // whose table it is
  host: 'Linda & Tom',              // who is hosting

  intro: {
    eyebrow: 'You are invited',
    title: 'Thanksgiving with',
    words: ['the whole family', 'a long table', 'too much pie', 'the parade', 'football after dinner', 'grateful hearts'],
  },

  letter: {
    greeting: 'Dear family,',
    paragraphs: [
      'The leaves are turning, the oven is warming up, and we would love to have every one of you around our table this year.',
      'Come early for the parade and coffee, stay late for pie and football. Bring your appetite, your stories, and whoever you love.',
    ],
    signoff: 'With love and gratitude,',
  },

  date: {
    iso: '2026-11-26',              // the day (YYYY-MM-DD)
    time: '2:00 PM',                // doors open
    dinner: '4:30 PM',              // dinner is served
    label: 'Thanksgiving Day',
  },

  place: {
    name: 'The farmhouse',
    address: '128 Maple Hollow Road, Springfield',
    note: 'Park by the red barn and come in through the porch.',
  },

  // the TV in the living room: the parade in the morning, football in the afternoon
  parade: {
    title: 'The 100th Parade',
    when: 'Thursday 8:30 a.m. – noon ET · NBC & Peacock',
    note: 'A record 100 giant balloons for the parade’s 100th year. Coffee and cinnamon rolls on the couch!',
  },
  football: {
    title: 'Game day',
    games: 'Bears at Lions 1:00 p.m. ET · Eagles at Cowboys 4:30 p.m. ET · Chiefs at Bills 8:20 p.m. ET',
    note: 'Kickoff after the first plate. Loudest fan gets the last slice of pie.',
  },

  finale: {
    title: 'Happy Thanksgiving',
    subtitle: 'Grateful for every one of you',
  },

  // the "Save image" story picture (1080×1920): the family photo on a warm autumn poster
  share: {
    logo: 'brand/logo-white.png',
    line: 'Grateful for this table and everyone around it',
  },
};
