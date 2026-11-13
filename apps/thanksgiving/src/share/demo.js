// The demonstration's family (test mode and fresh studio drafts): a full, lively table to try things on.
// look: { skin, hair, hairColor, outfit, outfitColor, pants, pantsColor, hat, glasses, beard } — see src/party/looks.js

const P = (id, name, sex, age, look, rsvp, thanks, dish) => ({ id, name, sex, age, look, rsvp, thanks, dish, claim: null });

export function demoRoster(now = Date.now()) {
  return [
    P('rose0001', 'Grandma Rose', 'f', 'adult', { skin: 1, hair: 20, hairColor: 8, outfit: 1, outfitColor: 2, pants: 1, pantsColor: 3, hat: 0, glasses: 5, beard: 0 }, 'yes', 'Every one of you, back around this table.', 'Pumpkin pie'),
    P('walt0002', 'Grandpa Walt', 'm', 'adult', { skin: 1, hair: 1, hairColor: 7, outfit: 11, outfitColor: 3, pants: 0, pantsColor: 2, hat: 0, glasses: 2, beard: 7 }, 'yes', 'Rose’s pie and a good nap after.', null),
    P('lind0003', 'Linda', 'f', 'adult', { skin: 2, hair: 17, hairColor: 3, outfit: 7, outfitColor: 0, pants: 0, pantsColor: 1, hat: 0, glasses: 0, beard: 0 }, 'yes', 'A full house and a full oven.', 'Stuffing'),
    P('toms0004', 'Tom', 'm', 'adult', { skin: 2, hair: 4, hairColor: 1, outfit: 2, outfitColor: 2, pants: 0, pantsColor: 0, hat: 0, glasses: 0, beard: 2 }, 'yes', 'Our kids, and the Lions finally winning.', null),
    P('caro0005', 'Aunt Carol', 'f', 'adult', { skin: 4, hair: 24, hairColor: 0, outfit: 4, outfitColor: 7, pants: 0, pantsColor: 0, hat: 0, glasses: 3, beard: 0 }, 'yes', 'New beginnings and old friends.', 'Sweet potato casserole'),
    P('joe00006', 'Uncle Joe', 'm', 'adult', { skin: 4, hair: 2, hairColor: 0, outfit: 5, outfitColor: 5, pants: 0, pantsColor: 2, hat: 9, glasses: 0, beard: 5 }, 'yes', 'Football, family and second helpings.', 'Apple cider'),
    P('miaa0007', 'Mia', 'f', 'adult', { skin: 3, hair: 12, hairColor: 2, outfit: 12, outfitColor: 9, pants: 0, pantsColor: 4, hat: 2, glasses: 0, beard: 0 }, 'yes', 'Getting home for the holidays.', 'Fall salad'),
    P('benn0008', 'Ben', 'm', 'adult', { skin: 0, hair: 10, hairColor: 4, outfit: 3, outfitColor: 2, pants: 0, pantsColor: 1, hat: 0, glasses: 0, beard: 1 }, null, '', null),
    P('lily0009', 'Lily', 'f', 'child', { skin: 3, hair: 22, hairColor: 2, outfit: 6, outfitColor: 10, pants: 0, pantsColor: 0, hat: 6, glasses: 0, beard: 0 }, 'yes', 'My puppy and pie!', null),
    P('maxx0010', 'Max', 'm', 'child', { skin: 2, hair: 9, hairColor: 1, outfit: 8, outfitColor: 0, pants: 0, pantsColor: 0, hat: 0, glasses: 0, beard: 0 }, 'yes', 'Mashed potatoes. Lots.', null),
    P('june0011', 'Aunt June', 'f', 'adult', { skin: 5, hair: 18, hairColor: 0, outfit: 13, outfitColor: 6, pants: 1, pantsColor: 3, hat: 0, glasses: 2, beard: 0 }, 'yes', 'Health, laughter and this crazy family.', 'Mac & cheese'),
    P('rayy0012', 'Uncle Ray', 'm', 'adult', { skin: 5, hair: 8, hairColor: 7, outfit: 10, outfitColor: 3, pants: 0, pantsColor: 4, hat: 4, glasses: 0, beard: 3 }, 'no', '', null),
    P('nora0013', 'Nora', 'f', 'child', { skin: 0, hair: 23, hairColor: 5, outfit: 4, outfitColor: 1, pants: 0, pantsColor: 0, hat: 5, glasses: 0, beard: 0 }, null, '', null),
    P('sam00014', 'Sam', 'm', 'adult', { skin: 3, hair: 5, hairColor: 0, outfit: 9, outfitColor: 3, pants: 0, pantsColor: 2, hat: 0, glasses: 6, beard: 1 }, 'yes', 'A warm kitchen and good company.', 'Dinner rolls'),
  ].map((g) => ({ ...g, at: now }));
}
