/**
 * Public demo sandbox (?share=test). Zero network calls, on purpose — this file
 * must never import fetch/XHR so "does the demo ever hit the server" stays obvious.
 *
 * getDemoContent() also doubles as the bare studio's starting content (no ?share param) —
 * both just need the same friendly starter template to edit from.
 */
import { ShareContent } from '../types';

// Bump the version suffix whenever ShareContent's shape changes, so a stale entry from
// an older schema is ignored instead of crashing the app that reads it.
const DEMO_STORAGE_KEY = 'urilga_demo_share_v4';
const DEMO_STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
export const EDIT_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;

export function getDemoContent(): ShareContent {
  return {
    question: 'Will you go on a date with me?',
    yesLabel: 'Yes',
    noLabel: 'No',
    noPleaTexts: [
      'Are you sure? 🥺',
      'Really sure? 💔',
      'Think again! 🧸',
      'Look how big YES is! 👉',
      "Don't break my heart! 🌹",
      'What if I bring chocolates? 🍫',
      'Pwetty please? ✨',
      'Last chance to reconsider! 💌',
      "You don't mean no... right? 🥹",
      'YES is the only answer! 💖'
    ],
    celebrationWord: 'Monica',
    activities: [
      { id: 'a1', emoji: '🌅', text: 'Sunset Picnic in the Park' },
      { id: 'a2', emoji: '🎬', text: 'VIP Cinema & Cozy Lounge' },
      { id: 'a3', emoji: '🍷', text: 'Wine Tasting & Candlelit Jazz' }
    ],
    restaurants: [
      {
        id: 'r1',
        name: "L'Amore Sky Rooftop & Italian Bistro",
        mapsLink: 'https://www.google.com/maps/search/?api=1&query=L+Amore+Sky+Rooftop+Italian+Bistro',
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
        rating: '4.9',
        reviewCount: '1,840+ reviews',
        hours: '5:00 PM – 11:30 PM (Daily)'
      },
      {
        id: 'r2',
        name: 'Sakura Garden Omakase & Cocktail Lounge',
        mapsLink: 'https://www.google.com/maps/search/?api=1&query=Sakura+Garden+Omakase+Cocktail+Lounge',
        imageUrl: 'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?auto=format&fit=crop&w=800&q=80',
        rating: '4.9',
        reviewCount: '2,120+ reviews',
        hours: '5:30 PM – 12:00 AM (Daily)'
      }
    ],
    musicUrl: ''
  };
}

/** Computed fresh on every visit — the demo never remembers when a browser first opened it. */
export function getDemoEditUntil(): number {
  return Date.now() + EDIT_WINDOW_MS;
}

interface StoredDemo {
  content: ShareContent;
  savedAt: number;
}

function looksLikeShareContent(value: unknown): value is ShareContent {
  const v = value as Partial<ShareContent> | null | undefined;
  return (
    !!v &&
    typeof v.question === 'string' &&
    typeof v.yesLabel === 'string' &&
    typeof v.noLabel === 'string' &&
    Array.isArray(v.noPleaTexts) &&
    Array.isArray(v.activities) &&
    Array.isArray(v.restaurants)
  );
}

export function loadDemoContent(): ShareContent {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed: StoredDemo = JSON.parse(raw);
      if (
        parsed.savedAt &&
        Date.now() - parsed.savedAt < DEMO_STORAGE_TTL_MS &&
        looksLikeShareContent(parsed.content)
      ) {
        return parsed.content;
      }
      localStorage.removeItem(DEMO_STORAGE_KEY);
    }
  } catch {
    // corrupted/unavailable storage — fall through to defaults
  }
  return getDemoContent();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function writeDemoContent(content: ShareContent): void {
  try {
    const payload: StoredDemo = { content, savedAt: Date.now() };
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // storage unavailable/full — edits simply won't survive a refresh
  }
}

export function saveDemoContent(content: ShareContent): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeDemoContent(content), 500);
}

/** Immediate, non-debounced write — see realShare.ts's flushShare for why the editor
 * toolbar's Save button needs this instead of the debounced version. */
export function flushDemoContent(content: ShareContent): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  writeDemoContent(content);
}
