// The only place to personalize the invitation. Leave startsAt/endsAt null
// until the plan is real; the save action downloads a note in the meantime.
export const dateConfig = {
  date: "A day we'll pick",
  time: 'Around sunset',
  location: 'Anywhere with you',
  message: "Can't wait for our time together.",
  startsAt: null as string | null, // ISO 8601 with offset, e.g. 2026-10-10T18:00:00+08:00
  endsAt: null as string | null,
  title: 'Our date',
  sender: 'Your person',
  defaultTime: '18:00',
  durationMinutes: 120,
};

export type DatePlan = {
  activity: string;
  day: string;
  time: string;
  place: string;
};
export const emptyPlan: DatePlan = {
  activity: '',
  day: '',
  time: dateConfig.defaultTime,
  place: '',
};
export const activities = [
  'Coffee and a chat',
  'Dinner together',
  'Watch a movie together',
  'Walk and watch the sunset',
  'Get dessert',
];
export const placesByActivity: Record<string, string[]> = {
  'Coffee and a chat': ['A cozy café', 'Your favorite coffee shop', 'Somewhere new'],
  'Dinner together': [
    'Our favorite restaurant',
    'A cozy spot downtown',
    'Dinner at home',
  ],
  'Watch a movie together': [
    'The movie theater',
    'A movie night at home',
    'Your favorite theater',
  ],
  'Walk and watch the sunset': [
    'By the river',
    'A quiet park',
    'Our favorite walking spot',
  ],
  'Get dessert': [
    'The ice cream place',
    'A little bakery',
    'Your favorite dessert spot',
  ],
};
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function plannedStart(day: string, time: string): Date | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    return null;
  const date = new Date(`${day}T${time}:00`);
  return Number.isFinite(date.getTime()) && localDay(date) === day
    ? date
    : null;
}
export function isFuturePlan(
  day: string,
  time: string,
  now = new Date(),
): boolean {
  const date = plannedStart(day, time);
  return date !== null && date > now;
}
export function futureTimes(day: string, now = new Date()): string[] {
  return Array.from(
    { length: 96 },
    (_, i) =>
      `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`,
  ).filter((time) => isFuturePlan(day, time, now));
}
export function planConfig(
  plan: DatePlan,
  overrides: Partial<
    Pick<typeof dateConfig, 'message' | 'sender' | 'title'>
  > = {},
) {
  const start = plannedStart(plan.day, plan.time);
  return {
    ...dateConfig,
    ...overrides,
    date: start ? localDay(start).replaceAll('-', '.') : dateConfig.date,
    time: start
      ? start.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : dateConfig.time,
    location: plan.place || dateConfig.location,
    title: plan.activity
      ? `${overrides.title ?? dateConfig.title}: ${plan.activity}`
      : (overrides.title ?? dateConfig.title),
    startsAt: start?.toISOString() ?? null,
    endsAt: start
      ? new Date(
          start.getTime() + dateConfig.durationMinutes * 60000,
        ).toISOString()
      : null,
  };
}
export function dateMessage(plan: DatePlan, closing?: string): string {
  const config = planConfig(plan);
  return `Hi :)\n\nThe date is set!\n\n${plan.activity}\n${config.date} at ${config.time}\n${config.location}\n\nSeven hearts collected, and I'd still pick you.\n\n${closing ?? "Can't wait to see you. <3"}`;
}

export function calendarEvent(config = dateConfig): string | null {
  if (!config.startsAt || !config.endsAt) return null;
  const start = new Date(config.startsAt),
    end = new Date(config.endsAt);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end <= start
  )
    return null;
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const escape = (text: string) =>
    text
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  // RFC 5545 lines are folded at 75 UTF-8 octets, including continuation space.
  const fold = (line: string) => {
    let result = '',
      count = 0;
    for (const char of line) {
      const bytes = new TextEncoder().encode(char).length;
      if (count + bytes > 75) {
        result += '\r\n ';
        count = 1;
      }
      result += char;
      count += bytes;
    }
    return result;
  };
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Little Signal//Our Date//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:our-date-${start.getTime()}@little-signal`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(config.title)}`,
      `LOCATION:${escape(config.location)}`,
      `DESCRIPTION:${escape(config.message)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .map(fold)
      .join('\r\n') + '\r\n'
  );
}
