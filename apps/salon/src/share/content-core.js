// The card's content, as stored for each link (shared by the page and the server).
// It has the shape of src/content.js plus `texts`: edited wording of the built-in labels,
// keyed by their original text. cleanContent() accepts only that shape, so a link's
// stored JSON can never carry anything else.
import { content } from '../content.js';
import { parseYouTube } from '../core/youtube.js';

export const defaultContent = Object.freeze(JSON.parse(JSON.stringify({ ...content, texts: {} })));
export const freshContent = () => JSON.parse(JSON.stringify(defaultContent));

const LONG = new Set(['letter.paragraphs']);   // the letter's paragraphs may be long
const MOST = { wishes: 1, photos: 5 };          // lists cut to this many items (older drafts had more)
const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
// Uploaded files: 'media/<random name>.<ext>' (stored per card, see server/api.js)
export const MEDIA_IMAGE = /^media\/[A-Za-z0-9_-]{16,40}\.(webp|jpg)$/;
export const MEDIA_AUDIO = /^media\/[A-Za-z0-9_-]{16,40}\.(webm|ogg|m4a|mp4)$/;
const bundled = (v) => /^photos\/[A-Za-z0-9_\-./]+$/.test(v) && !v.includes('..');
const image = (v) => v === '' || bundled(v) || MEDIA_IMAGE.test(v);
/** Every uploaded file a card's content points at. */
export function mediaOf(c) {
  return [...(c?.photos || []).map((p) => p?.src), c?.song?.cover, c?.song?.voice].filter((v) => typeof v === 'string' && (MEDIA_IMAGE.test(v) || MEDIA_AUDIO.test(v)));
}

function clean(def, val, path) {
  if (typeof def === 'string') {
    if (typeof val !== 'string') fail(`Invalid text: ${path}`);
    const max = LONG.has(path.replace(/\.\d+$/, '')) ? 2400 : 600;
    if (val.length > max) fail(`Keep each text under ${max} characters.`);
    if (path === 'date.iso' && !/^\d{4}-\d{2}-\d{2}$/.test(val)) fail('Use a date like 2026-10-14.');
    if (/^photos\.\d+\.src$/.test(path) && !image(val)) fail('Invalid photo.');
    if (path === 'song.voice' && val && !MEDIA_AUDIO.test(val)) fail('Invalid voice message.');
    if (path === 'song.youtube' && val && (val.length > 300 || !parseYouTube(val))) fail('YouTube link is not valid.');
    return val;
  }
  if (typeof def === 'number' || def === null) {
    if (val === null || (typeof val === 'number' && Number.isFinite(val))) return val;
    if (typeof val === 'string' && val.length <= 200 && image(val)) return val;
    fail(`Invalid value: ${path}`);
  }
  if (Array.isArray(def)) {
    if (!Array.isArray(val) || val.length < 1 || val.length > 12) fail(`Invalid list: ${path}`);
    return val.slice(0, MOST[path] || 12).map((v, i) => clean(def[Math.min(i, def.length - 1)], v, `${path}.${i}`));
  }
  if (def && typeof def === 'object') {
    if (!val || typeof val !== 'object' || Array.isArray(val)) fail(`Invalid section: ${path}`);
    if (Object.keys(val).some((k) => !(k in def))) fail(`Unknown field in ${path || 'content'}`);
    const out = {};
    for (const k of Object.keys(def)) out[k] = k in val ? clean(def[k], val[k], path ? `${path}.${k}` : k) : JSON.parse(JSON.stringify(def[k]));
    return out;
  }
  fail(`Invalid value: ${path}`);
}

export function cleanContent(value) {
  const { texts = {}, ...rest } = value && typeof value === 'object' ? value : fail('Invalid card content.');
  const { texts: _t, ...schema } = defaultContent;
  const out = clean(schema, rest, '');
  if (!texts || typeof texts !== 'object' || Array.isArray(texts)) fail('Invalid edited text.');
  const entries = Object.entries(texts);
  if (entries.length > 300) fail('Too much edited text.');
  out.texts = {};
  for (const [k, v] of entries) {
    if (typeof k !== 'string' || k.length > 400 || typeof v !== 'string' || v.length > 600) fail('Invalid edited text.');
    out.texts[k] = v;
  }
  return out;
}

/** Read / write a dotted path ("photos.2.caption") inside the content. */
export function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
export function setPath(obj, path, value) {
  const keys = path.split('.'), last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}
/** Replace the live content object's fields in place (every module holds a reference to it). */
export function replaceContent(target, source) {
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, JSON.parse(JSON.stringify(source)));
}
