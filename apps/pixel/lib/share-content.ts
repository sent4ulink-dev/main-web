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
  networkLabel: 'ХАЙРЫН СҮЛЖЭЭ',
  invitationEyebrow: '1 ШИНЭ ЗУРВАС',
  invitationQuestion: `Надтай\nболзоонд\nявах уу?`,
  yesLabel: 'Тэгье',
  noLabel: 'Үгүй',
  noMessages: [
    'Итгэлтэй байна уу?',
    'Нээрээ юу?',
    'Хмм, сонин л юм...',
    'Дохио алдагдсан бололтой :)',
    'Нөгөө товчийг дарах уу?',
    'Зүрх минь дахиад асуу гэнэ.',
  ],
  successTitle: 'БОЛЗОХООР БОЛЛОО!',
  successAchievement: 'Шинэ амжилт:',
  successPair: 'ЧИ + БИ',
  successMessage: 'Хамгийн хөөрхөн шийдвэр :)',
  continueLabel: 'ҮРГЭЛЖЛҮҮЛЭХ',
  gamePromptEyebrow: 'ЧАМД ЗОРИУЛСАН БЯЦХАН БЭЛЭГ',
  gamePromptTitle: 'НЭМЭЛТ ҮЕ\nНЭЭГДЛЭЭ',
  gamePromptMessage:
    'Болзооныхоо өмнө жаахан тоглоё.\nДолоон зүрх. Нэг хөөрхөн хос.',
  gameStartLabel: 'ТОГЛОХ',
  gameTitle: 'ХАЙРЫН МОГОЙ',
  gameEyebrow: 'НЭМЭЛТ ҮЕ / 01',
  gameMeterLabel: 'ХАЙРЫН ТҮВШИН',
  gameReadyTitle: '7 ЗҮРХ. НЭГ БОЛЗОО.',
  gameReadyMessage: 'Зүрх цуглуул. Ирмэгээр нэвт гарна.',
  gameCompleteTitle: 'ҮЕЭ ДУУСГАЛАА!',
  gameCompleteMessage: 'БОЛЗОО НЭЭГДЛЭЭ',
  gameGoal: 'БОЛЗООГОО ТОВЛОХЫН ТУЛД 7 ЗҮРХ ЦУГЛУУЛ ♥',
  snakeMessages: [
    'ХАЙР +1',
    'ЯНЗТАЙ!',
    'БИ АЗТАЙ ЮМ АА',
    'ЯМАР ХӨӨРХӨН ЮМ БЭ',
    'ТЭГЬЕЭЭ',
    'ЖААХАН Л ҮЛДЛЭЭ',
    'ТӨГС ХОС',
  ],
  endingEyebrow: 'ДЭЭД АМЖИЛТ: БИД',
  endingTitle: 'ТӨГС ХОС',
  endingMessage: 'Чамдаа хүрэх замаа оллоо.',
  sender: 'Чиний хүн',
  notificationText: '1 зурвас\nирлээ',
  letterBody:
    'Сайн уу :)\n\nБолзоогоо товлочихлоо!\n\n{activity}\n{date}, {time} цагт\n{place}\n\nДолоон зүрх цуглуулсан ч би чамайг л сонгоно.\n\n{closing}',
  dateDetailsEyebrow: 'БИДНИЙ ХӨӨРХӨН ТӨЛӨВЛӨГӨӨ',
  dateStatus: 'ТОВЛОГДЛОО ♥',
  dateSignoff: 'ТЭСЭН ЯДАН ХҮЛЭЭЖ БАЙНА ♥',
  shareImageLabel: 'ЗУРАГ ХАДГАЛАХ',
  dateTitle: 'Бидний болзоо',
  dateMessage: 'Хамтдаа өнгөрүүлэх мөчөө тэсэн ядан хүлээж байна.',
  smsClosing: 'Уулзахыг тэсэн ядан хүлээж байна. <3',
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
        places: places.length ? places : ['Шинэ газар'],
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
