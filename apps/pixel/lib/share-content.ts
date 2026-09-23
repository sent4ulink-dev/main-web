import { activities, placesByActivity } from './date-config.ts';

export type EditableActivity = { id: string; label: string; places: string[] };

export type ShareContent = {
  networkLabel: string;
  invitationEyebrow: string;
  invitationQuestion: string;
  yesLabel: string;
  noLabel: string;
  noMessages: string[];
  successTitle: string;
  successAchievement: string;
  successPair: string;
  successMessage: string;
  continueLabel: string;
  gamePromptEyebrow: string;
  gamePromptTitle: string;
  gamePromptMessage: string;
  gameStartLabel: string;
  gameTitle: string;
  gameEyebrow: string;
  gameMeterLabel: string;
  gameReadyTitle: string;
  gameReadyMessage: string;
  gameCompleteTitle: string;
  gameCompleteMessage: string;
  gameGoal: string;
  snakeMessages: string[];
  endingEyebrow: string;
  endingTitle: string;
  endingMessage: string;
  sender: string;
  notificationText: string;
  letterBody: string;
  dateDetailsEyebrow: string;
  dateStatus: string;
  dateSignoff: string;
  shareImageLabel: string;
  dateTitle: string;
  dateMessage: string;
  smsClosing: string;
  activities: EditableActivity[];
};

const defaultActivities = activities.map((label, index) => ({
  id: `activity-${index + 1}`,
  label,
  places: [...(placesByActivity[label] ?? [])],
}));

export const defaultShareContent: ShareContent = {
  networkLabel: 'LOVE NETWORK',
  invitationEyebrow: '1 NEW MESSAGE',
  invitationQuestion: `Will you\ngo on a\ndate with me?`,
  yesLabel: 'Yes',
  noLabel: 'No',
  noMessages: [
    'Are you sure?',
    'Really?',
    'Hmm, interesting...',
    'Signal must be lost :)',
    'Try the other button?',
    'My heart says ask again.',
  ],
  successTitle: "IT'S A DATE!",
  successAchievement: 'New achievement:',
  successPair: 'YOU + ME',
  successMessage: 'Best decision ever :)',
  continueLabel: 'CONTINUE',
  gamePromptEyebrow: 'A LITTLE GIFT FOR YOU',
  gamePromptTitle: 'BONUS LEVEL\nUNLOCKED',
  gamePromptMessage:
    'One quick game before the date.\nSeven hearts. One cute pair.',
  gameStartLabel: 'PLAY',
  gameTitle: 'LOVE SNAKE',
  gameEyebrow: 'BONUS LEVEL / 01',
  gameMeterLabel: 'LOVE METER',
  gameReadyTitle: '7 HEARTS. ONE DATE.',
  gameReadyMessage: 'Collect hearts. Edges wrap around.',
  gameCompleteTitle: 'LEVEL CLEARED!',
  gameCompleteMessage: 'DATE UNLOCKED',
  gameGoal: 'COLLECT 7 HEARTS TO SET THE DATE ♥',
  snakeMessages: [
    'LOVE +1',
    'NICE!',
    "I'M SO LUCKY",
    'SO CUTE',
    'YESSS',
    'ALMOST THERE',
    'PERFECT PAIR',
  ],
  endingEyebrow: 'TOP ACHIEVEMENT: US',
  endingTitle: 'PERFECT PAIR',
  endingMessage: 'Found my way to you.',
  sender: 'Your person',
  notificationText: '1 message\nreceived',
  letterBody:
    "Hi :)\n\nThe date is set!\n\n{activity}\n{date} at {time}\n{place}\n\nSeven hearts collected, and I'd still pick you.\n\n{closing}",
  dateDetailsEyebrow: 'OUR CUTE LITTLE PLAN',
  dateStatus: 'CONFIRMED ♥',
  dateSignoff: "CAN'T WAIT ♥",
  shareImageLabel: 'SAVE IMAGE',
  dateTitle: 'Our date',
  dateMessage: "Can't wait for our time together.",
  smsClosing: "Can't wait to see you. <3",
  activities: defaultActivities,
};

const limits: Partial<Record<keyof ShareContent, number>> = {
  networkLabel: 30,
  invitationEyebrow: 40,
  invitationQuestion: 90,
  yesLabel: 24,
  noLabel: 24,
  successTitle: 50,
  successAchievement: 50,
  successPair: 40,
  successMessage: 90,
  continueLabel: 30,
  gamePromptEyebrow: 70,
  gamePromptTitle: 70,
  gamePromptMessage: 180,
  gameStartLabel: 30,
  gameTitle: 50,
  gameEyebrow: 50,
  gameMeterLabel: 40,
  gameReadyTitle: 60,
  gameReadyMessage: 100,
  gameCompleteTitle: 60,
  gameCompleteMessage: 70,
  gameGoal: 100,
  endingEyebrow: 60,
  endingTitle: 50,
  endingMessage: 100,
  sender: 40,
  notificationText: 50,
  letterBody: 800,
  dateDetailsEyebrow: 70,
  dateStatus: 50,
  dateSignoff: 70,
  shareImageLabel: 40,
  dateTitle: 60,
  dateMessage: 180,
  smsClosing: 120,
};

function cleanActivities(value: unknown): EditableActivity[] {
  if (!Array.isArray(value)) return defaultActivities;
  const clean = value.slice(0, 10).flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    const source = entry as Record<string, unknown>;
    const label =
      typeof source.label === 'string' ? source.label.trim().slice(0, 70) : '';
    if (!label) return [];
    const places = Array.isArray(source.places)
      ? source.places
          .filter((place): place is string => typeof place === 'string')
          .map((place) => place.trim().slice(0, 70))
          .filter(Boolean)
          .slice(0, 10)
      : [];
    return [
      {
        id:
          typeof source.id === 'string' &&
          /^[a-zA-Z0-9_-]{1,40}$/.test(source.id)
            ? source.id
            : `activity-${index + 1}`,
        label,
        places: places.length ? places : ['New place'],
      },
    ];
  });
  return clean.length ? clean : defaultActivities;
}

export function sanitizeShareContent(value: unknown): ShareContent {
  const source =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const result = { ...defaultShareContent };
  for (const [key, fallback] of Object.entries(defaultShareContent)) {
    if (key === 'activities' || key === 'noMessages' || key === 'snakeMessages')
      continue;
    const candidate = source[key];
    const text = typeof candidate === 'string' ? candidate.trim() : '';
    (result as unknown as Record<string, unknown>)[key] = (
      text || (fallback as string)
    ).slice(0, limits[key as keyof ShareContent] ?? 120);
  }
  result.activities = cleanActivities(source.activities);
  result.noMessages = cleanFixedMessages(
    source.noMessages,
    defaultShareContent.noMessages,
  );
  result.snakeMessages = cleanFixedMessages(
    source.snakeMessages,
    defaultShareContent.snakeMessages,
  );
  return result;
}

function cleanFixedMessages(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return fallback.map((defaultValue, index) => {
    const candidate = value[index];
    return typeof candidate === 'string' && candidate.trim()
      ? candidate.trim().slice(0, 90)
      : defaultValue;
  });
}

export function renderLetter(
  content: ShareContent,
  values: { activity: string; date: string; time: string; place: string },
): string {
  return content.letterBody.replace(
    /\{(activity|date|time|place|closing)\}/g,
    (_match, key: string) =>
      key === 'closing'
        ? content.smsClosing
        : values[key as keyof typeof values],
  );
}
