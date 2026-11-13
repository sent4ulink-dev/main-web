// What each character choice is (indices match LOOK in src/share/guests-core.js and the parts in avatar.glb).
// Hairstyles (and beards, dresses, blouses and skirts) belong to men or to women: the host sets who is
// who, and each person only sees the styles for them.

export const SKINS = ['#FBE0CC', '#F2C7A5', '#E2A97F', '#C68A5B', '#9C6743', '#6B4630'];
export const HAIR_COLORS = ['#1E1714', '#3B2A20', '#6B4A2F', '#8A3B22', '#C4652D', '#D9B26A', '#EDE3C8', '#9A9A9A', '#F4F1EA'];
export const OUTFIT_COLORS = ['#CC5500', '#E3A857', '#990000', '#6E473B', '#3F6B4A', '#2F4A6B', '#C9A227', '#6B3F6B', '#F2E6D0', '#8FA58A', '#4E6E9A', '#B5523A'];
export const PANTS_COLORS = ['#3E5C86', '#2C3E5C', '#C8B48A', '#6E473B', '#2B2B2E', '#6B6B70', '#4E5B3A', '#7A2232'];

export const HAIRS = [
  { part: null, label: 'Bald', icon: '🥚', sex: 'm' },
  { part: 'hair_m_balding', label: 'Thinning', icon: '👴', sex: 'm' },
  { part: 'hair_m_buzz', label: 'Buzz', icon: '💈', sex: 'm' },
  { part: 'hair_m_crew', label: 'Crew cut', icon: '💇‍♂️', sex: 'm' },
  { part: 'hair_m_part', label: 'Side part', icon: '💁‍♂️', sex: 'm' },
  { part: 'hair_m_quiff', label: 'Quiff', icon: '🕺', sex: 'm' },
  { part: 'hair_m_slick', label: 'Slicked back', icon: '🧴', sex: 'm' },
  { part: 'hair_m_curly', label: 'Curly', icon: '🌀', sex: 'm' },
  { part: 'hair_m_afro', label: 'Afro', icon: '☁️', sex: 'm' },
  { part: 'hair_m_spiky', label: 'Spiky', icon: '⚡', sex: 'm' },
  { part: 'hair_m_shaggy', label: 'Shaggy', icon: '🎸', sex: 'm' },
  { part: 'hair_m_bun', label: 'Man bun', icon: '🧘‍♂️', sex: 'm' },
  { part: 'hair_f_long', label: 'Long', icon: '👩', sex: 'f' },
  { part: 'hair_f_wavy', label: 'Wavy', icon: '🌊', sex: 'f' },
  { part: 'hair_f_bob', label: 'Bob', icon: '💇‍♀️', sex: 'f' },
  { part: 'hair_f_pixie', label: 'Pixie', icon: '✂️', sex: 'f' },
  { part: 'hair_f_bangs', label: 'Bangs', icon: '🎀', sex: 'f' },
  { part: 'hair_f_sideswept', label: 'Side-swept', icon: '💁‍♀️', sex: 'f' },
  { part: 'hair_f_curly', label: 'Curls', icon: '🌀', sex: 'f' },
  { part: 'hair_f_topbun', label: 'Top bun', icon: '🍩', sex: 'f' },
  { part: 'hair_f_lowbun', label: 'Low bun', icon: '👵', sex: 'f' },
  { part: 'hair_f_pony', label: 'Ponytail', icon: '🐴', sex: 'f' },
  { part: 'hair_f_pigtails', label: 'Pigtails', icon: '👧', sex: 'f' },
  { part: 'hair_f_braids', label: 'Braids', icon: '🥨', sex: 'f' },
  { part: 'hair_f_puff', label: 'Puff', icon: '☁️', sex: 'f' },
];
/** Outfits, each with its own sleeves (short ones show the forearm); some are for women only. */
export const OUTFITS = [
  { part: 'body_sweater', label: 'Sweater', icon: '🧶', arm: ['sleeve_stripe'] },
  { part: 'body_cardigan', label: 'Cardigan', icon: '🧥', arm: ['sleeve_cuff'] },
  { part: 'body_flannel', label: 'Flannel', icon: '🪵', arm: ['sleeve_check'] },
  { part: 'body_hoodie', label: 'Hoodie', icon: '👕', arm: ['sleeve_cuff'] },
  { part: 'body_dress', label: 'Dress', icon: '👗', arm: ['sleeve_puff', 'forearm'], skirt: true, sex: 'f' },
  { part: 'body_jersey', label: 'Jersey', icon: '🏈', arm: ['sleeve_jersey', 'forearm'] },
  { part: 'body_overalls', label: 'Overalls', icon: '👖', arm: ['sleeve'], legs: '#3E5C86' },
  { part: 'body_apron', label: 'Apron', icon: '🥧', arm: ['sleeve'] },
  { part: 'body_tee', label: 'T-shirt', icon: '🎃', arm: ['sleeve_short', 'forearm'] },
  { part: 'body_polo', label: 'Polo', icon: '⛳', arm: ['sleeve_short', 'forearm'] },
  { part: 'body_blazer', label: 'Blazer & tie', icon: '👔', arm: ['sleeve_blazer'] },
  { part: 'body_vest', label: 'Sweater vest', icon: '🦺', arm: ['sleeve_white'] },
  { part: 'body_turtleneck', label: 'Turtleneck', icon: '🧣', arm: ['sleeve_cuff'] },
  { part: 'body_blouse', label: 'Blouse', icon: '🎀', arm: ['sleeve_cuff'], sex: 'f' },
];
export const BOTTOMS = [
  { part: null, label: 'Pants', icon: '👖' },
  { part: 'skirt', label: 'Skirt', icon: '🩱', sex: 'f' },
];
/** Hats: `cover` ones sit over the hair (which is then trimmed to what shows under them). */
export const HATS = [
  { part: null, label: 'No hat', icon: '🚫' },
  { part: 'hat_pilgrim', label: 'Pilgrim', icon: '🎩', cover: true },
  { part: 'hat_beanie', label: 'Beanie', icon: '🧢', cover: true, tint: true },
  { part: 'hat_cowboy', label: 'Cowboy', icon: '🤠', cover: true },
  { part: 'hat_fedora', label: 'Fedora', icon: '🕵️', cover: true },
  { part: 'hat_leaves', label: 'Leaf crown', icon: '🍁' },
  { part: 'hat_bow', label: 'Bow', icon: '🎀', tint: true },
  { part: 'hat_chef', label: 'Chef', icon: '👨‍🍳', cover: true },
  { part: 'hat_turkey', label: 'Turkey!', icon: '🦃', cover: true },
  { part: 'hat_cap', label: 'Cap', icon: '⚾', cover: true, tint: true },
];
export const GLASSES = [
  { part: null, label: 'None', icon: '🚫' },
  { part: 'glasses_round', label: 'Round', icon: '👓' },
  { part: 'glasses_square', label: 'Square', icon: '🤓' },
  { part: 'glasses_cateye', label: 'Cat-eye', icon: '🐱' },
  { part: 'glasses_big', label: 'Big round', icon: '🔍' },
  { part: 'glasses_half', label: 'Readers', icon: '📖' },
  { part: 'glasses_aviator', label: 'Aviators', icon: '✈️' },
  { part: 'glasses_shades', label: 'Shades', icon: '😎' },
  { part: 'glasses_roundshades', label: 'Round shades', icon: '🕶️' },
  { part: 'glasses_heart', label: 'Hearts', icon: '💖' },
];
export const BEARDS = [
  { part: null, label: 'None', icon: '🚫' },
  { part: 'beard_stubble', label: 'Stubble', icon: '🧔' },
  { part: 'beard_boxed', label: 'Short beard', icon: '🧔‍♂️' },
  { part: 'beard_full', label: 'Full beard', icon: '🪓' },
  { part: 'beard_long', label: 'Long beard', icon: '🧙' },
  { part: 'beard_goatee', label: 'Goatee', icon: '🐐' },
  { part: 'beard_chinstrap', label: 'Chin strap', icon: '〰️' },
  { part: 'beard_mustache', label: 'Mustache', icon: '🥸' },
  { part: 'beard_handlebar', label: 'Handlebar', icon: '🎩' },
  { part: 'beard_chops', label: 'Mutton chops', icon: '🍖' },
];

/** The builder's tabs: which field each changes and its choices (`sex`: only for men or only for women). */
export const CATEGORIES = [
  { key: 'hair', label: 'Hair', options: HAIRS },
  { key: 'hairColor', label: 'Hair color', swatches: HAIR_COLORS },
  { key: 'skin', label: 'Skin', swatches: SKINS },
  { key: 'outfit', label: 'Top', options: OUTFITS },
  { key: 'outfitColor', label: 'Top color', swatches: OUTFIT_COLORS },
  { key: 'pants', label: 'Bottoms', options: BOTTOMS },
  { key: 'pantsColor', label: 'Bottoms color', swatches: PANTS_COLORS },
  { key: 'hat', label: 'Hat', options: HATS },
  { key: 'glasses', label: 'Glasses', options: GLASSES },
  { key: 'beard', label: 'Beard', options: BEARDS, sex: 'm' },
];

/** Is choice `i` of a list there for this person? */
export const allowed = (list, i, sex) => !!list[i] && (!list[i].sex || list[i].sex === sex);
const firstFor = (list, sex) => list.findIndex((o) => !o.sex || o.sex === sex);
/** The look made right for who this person is (e.g. after the host changed them from man to woman). */
export function fitLook(look, sex) {
  const out = { ...look };
  if (!allowed(HAIRS, out.hair, sex)) out.hair = sex === 'm' ? 3 : 12;
  if (!allowed(OUTFITS, out.outfit, sex)) out.outfit = firstFor(OUTFITS, sex);
  if (!allowed(BOTTOMS, out.pants ?? 0, sex)) out.pants = 0;
  if (sex !== 'm') out.beard = 0;
  return out;
}

/** The parts one character is drawn with, the colour each takes and what it moves with. */
export function partsOf(raw, { pose = 'sit', sex = 'f' } = {}) {
  const look = fitLook(raw, sex);
  const skin = SKINS[look.skin] || SKINS[1], hair = HAIR_COLORS[look.hairColor] || HAIR_COLORS[1];
  const cloth = OUTFIT_COLORS[look.outfitColor] || OUTFIT_COLORS[0], pants = PANTS_COLORS[look.pantsColor] || PANTS_COLORS[0];
  const outfit = OUTFITS[look.outfit] || OUTFITS[0];
  const skirt = BOTTOMS[look.pants]?.part === 'skirt' && !outfit.skirt;
  const bare = outfit.skirt || skirt;
  const legs = bare ? 'skin' : 'pants', legColor = bare ? skin : outfit.legs || pants;
  const out = [
    { part: 'head', color: skin, group: 'head' },
    { part: 'mouth', color: '#ffffff', group: 'mouth' },
    { part: outfit.part, color: cloth, group: 'body' },
  ];
  if (skirt) out.push({ part: 'skirt', color: pants, group: 'body' });
  if (pose === 'stand') out.push({ part: `leg_${legs}`, color: legColor, group: 'legL' }, { part: `leg_${legs}`, color: legColor, group: 'legR' });
  else out.push({ part: `legs_sit_${legs}`, color: legColor, group: 'legs' }, { part: 'fork', color: '#ffffff', group: 'fork' });
  for (const g of ['armL', 'armR']) {
    for (const a of outfit.arm) out.push({ part: a, color: a === 'forearm' ? skin : cloth, group: g });
    out.push({ part: 'hand', color: skin, group: g });
  }
  const hat = HATS[look.hat];
  const h = HAIRS[look.hair]?.part;
  if (h) out.push({ part: hat?.part && hat.cover ? `${h}_hat` : h, color: hair, group: 'head' });
  // a covering hat is sized to sit on this hair (`fit`: see hatfit.json); the leaf crown and the bow's headband
  // come made for each hair (they rest on it), e.g. hat_bow__m_buzz (and plain hat_bow on a bald head)
  if (hat?.part) out.push(hat.cover ? { part: hat.part, color: cloth, group: 'head', fit: `${h || 'bald'}|cover` }
    : { part: h ? `${hat.part}__${h.slice(5)}` : hat.part, color: cloth, group: 'head' });
  const g = GLASSES[look.glasses]?.part; if (g) out.push({ part: g, color: '#ffffff', group: 'head' });
  const b = sex === 'm' && BEARDS[look.beard]?.part; if (b) out.push({ part: b, color: hair, group: 'head' });
  return out;
}

export const ALL_PARTS = ['head', 'mouth', 'fork', 'hand', 'forearm', 'skirt', 'legs_sit_pants', 'legs_sit_skin', 'leg_pants', 'leg_skin',
  ...new Set(OUTFITS.flatMap((o) => o.arm)),
  ...HAIRS.flatMap((h) => (h.part ? [h.part, `${h.part}_hat`] : [])),
  ...[...OUTFITS, ...HATS, ...GLASSES, ...BEARDS].map((p) => p.part),
  ...HATS.filter((x) => x.part && !x.cover).flatMap((x) => HAIRS.filter((hh) => hh.part).map((hh) => `${x.part}__${hh.part.slice(5)}`))].filter(Boolean);
