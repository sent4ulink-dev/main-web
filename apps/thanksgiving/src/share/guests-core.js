// The guest list (shared by the page and the server).
// The host enters the people invited (a name, man/woman, adult/child); everyone opens the same guest link,
// taps their own name ("This is me" — it is then kept to that phone), dresses up their character, answers
// yes or no once, says what they are thankful for and, if the host wants a potluck, picks a dish to bring.

export const MOST_GUESTS = 50;
export const NAME_MAX = 40;
export const THANKS_MAX = 160;
export const DISH_MAX = 40;
export const MOST_DISHES = 30;

// a character: each field is a choice index (see src/party/looks.js for what they are)
export const LOOK = { skin: 6, hair: 25, hairColor: 9, outfit: 14, outfitColor: 12, pants: 2, pantsColor: 8, hat: 10, glasses: 10, beard: 10 };
export const SEXES = ['m', 'f'];
export const AGES = ['adult', 'child'];

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const text = (v, max, what) => {
  if (typeof v !== 'string') fail(`Invalid ${what}.`);
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length > max) fail(`Keep the ${what} under ${max} characters.`);
  return s;
};
export const GUEST_ID = /^[A-Za-z0-9_-]{8}$/;

export function cleanLook(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail('Invalid character.');
  if (Object.keys(v).some((k) => !(k in LOOK))) fail('Invalid character.');
  const out = {};
  for (const [k, n] of Object.entries(LOOK)) {
    const x = v[k] ?? 0;
    if (!Number.isInteger(x) || x < 0 || x >= n) fail('Invalid character.');
    out[k] = x;
  }
  return out;
}

export const cleanName = (v) => { const s = text(v, NAME_MAX, 'name'); if (!s) fail('Every guest needs a name.'); return s; };
export const cleanThanks = (v) => text(v, THANKS_MAX, 'thankful line');

/** The potluck settings: { showAnswers, potluck, dishes: [text] } */
export function cleanParty(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail('Invalid settings.');
  if (Object.keys(v).some((k) => !['showAnswers', 'potluck', 'dishes'].includes(k))) fail('Invalid settings.');
  const dishes = Array.isArray(v.dishes) ? v.dishes : fail('Invalid dish list.');
  if (dishes.length > MOST_DISHES) fail(`At most ${MOST_DISHES} dishes.`);
  const seen = new Set(), list = [];
  for (const d of dishes) { const s = text(d, DISH_MAX, 'dish'); if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); list.push(s); } }
  return { showAnswers: v.showAnswers !== false, potluck: v.potluck === true, dishes: list };
}

export const defaultParty = () => ({
  showAnswers: true,
  potluck: true,
  dishes: ['Green bean casserole', 'Mashed potatoes', 'Sweet potato casserole', 'Mac & cheese', 'Stuffing', 'Dinner rolls', 'Cranberry sauce', 'Fall salad', 'Apple pie', 'Pecan pie', 'Pumpkin pie', 'Apple cider'],
});

/** What the host sends for each person: { id? , name, sex, age }. */
export function cleanRoster(list) {
  if (!Array.isArray(list)) fail('Invalid guest list.');
  if (list.length > MOST_GUESTS) fail(`A table seats at most ${MOST_GUESTS} people.`);
  const ids = new Set();
  return list.map((g) => {
    if (!g || typeof g !== 'object' || Array.isArray(g)) fail('Invalid guest.');
    if (Object.keys(g).some((k) => !['id', 'name', 'sex', 'age'].includes(k))) fail('Invalid guest.');
    const id = g.id == null ? null : (GUEST_ID.test(g.id) && !ids.has(g.id) ? g.id : fail('Invalid guest.'));
    if (id) ids.add(id);
    return { id, name: cleanName(g.name), sex: SEXES.includes(g.sex) ? g.sex : fail('Invalid guest.'), age: AGES.includes(g.age) ? g.age : fail('Invalid guest.') };
  });
}

/** A stable little number from a text (so a new guest's first character is always the same one). */
export function seedOf(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** A pleasant first character for someone, from who they are (they can change all of it). Hair indices:
 *  men 0–11, women 12–24 (src/party/looks.js). */
export function defaultLook({ id = '', name = '', sex = 'f', age = 'adult' }) {
  let s = seedOf(`${id}:${name}`);
  const pick = (list) => { s = Math.imul(s ^ (s >>> 15), 2246822519) >>> 0; return list[s % list.length]; };
  const child = age === 'child', man = sex === 'm';
  const hair = man ? (child ? pick([3, 4, 7, 9, 10]) : pick([2, 3, 4, 5, 6, 7, 8, 10, 1, 0])) : (child ? pick([22, 21, 23, 14, 18, 24]) : pick([12, 13, 14, 15, 16, 17, 18, 19, 20, 21]));
  return {
    skin: pick([0, 1, 1, 2, 2, 3, 4, 5]),
    hair,
    hairColor: pick(child ? [0, 1, 2, 4, 5] : [0, 1, 1, 2, 3, 4, 5, 7]),
    outfit: child ? pick([0, 3, 5, 6, 8]) : man ? pick([0, 1, 2, 3, 9, 10, 11, 12]) : pick([0, 1, 2, 4, 12, 13, 8]),
    outfitColor: pick([0, 1, 2, 3, 4, 5, 6, 7, 9, 10]),
    pants: !man && !child && pick([0, 0, 1]) === 1 ? 1 : 0,
    pantsColor: pick([0, 1, 2, 3, 4, 5]),
    hat: 0,
    glasses: child ? 0 : pick([0, 0, 0, 1, 2, 3, 5]),
    beard: man && !child ? pick([0, 0, 1, 2, 3, 7, 5]) : 0,
  };
}
