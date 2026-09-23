/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatePlan } from '../types';

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

/** plan.time comes from one of two pickers (see DateTimeSection.tsx): the preset slots
 * are "H:MM AM/PM" (e.g. "7:00 PM"), the custom <input type="time"> is 24h "HH:MM". */
function parseTimeToMinutes(time: string): number | null {
  const trimmed = time.trim();

  let m = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h >= 0 && h < 24 && min >= 0 && min < 60) return h * 60 + min;
    return null;
  }

  m = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    const meridiem = m[3].toUpperCase();
    if (h < 1 || h > 12 || min < 0 || min >= 60) return null;
    if (h === 12) h = 0;
    if (meridiem === 'PM') h += 12;
    return h * 60 + min;
  }

  return null;
}

/** Combines plan.date ("YYYY-MM-DD") + plan.time into a real local Date, or null if
 * either is missing/unparseable. Used both to build the ICS event and to gate the
 * "Save to calendar" action on there being an actual future date/time to save. */
export function parsePlanStart(plan: Pick<DatePlan, 'date' | 'time'>): Date | null {
  const dateParts = (plan.date || '').split('-').map(Number);
  if (dateParts.length !== 3 || dateParts.some((n) => Number.isNaN(n))) return null;
  const minutes = parseTimeToMinutes(plan.time || '');
  if (minutes === null) return null;
  const [y, mo, d] = dateParts;
  return new Date(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
}

/** "Save to calendar" is disabled until this is true — a real, parseable date/time that
 * hasn't already passed. */
export function isPlanDateTimeValid(plan: Pick<DatePlan, 'date' | 'time'>): boolean {
  const start = parsePlanStart(plan);
  return start !== null && start.getTime() > Date.now();
}

function toIcsUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export interface PlanIcsOptions {
  title?: string;
  message?: string;
  durationMs?: number;
}

/** Builds a standard VCALENDAR/VEVENT string from the exact same confirmed plan shown
 * on the card — activity, date, local start time, a default 2-hour end time, the
 * restaurant as location, and the couple's own note as the description. */
export function buildDatePlanIcs(plan: DatePlan, options: PlanIcsOptions = {}): string {
  const start = parsePlanStart(plan);
  if (!start) throw new Error('Plan has no valid date/time yet');
  const end = new Date(start.getTime() + (options.durationMs ?? DEFAULT_DURATION_MS));

  const title = options.title?.trim() || (plan.activity ? `Date: ${plan.activity}` : 'Our Date');
  const descriptionParts = [plan.activity ? `Activity: ${plan.activity}` : null, options.message?.trim() || null].filter(
    (v): v is string => Boolean(v)
  );

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Urilga//Date Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@urilga`,
    `DTSTAMP:${toIcsUtcStamp(new Date())}`,
    `DTSTART:${toIcsUtcStamp(start)}`,
    `DTEND:${toIcsUtcStamp(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    ...(descriptionParts.length ? [`DESCRIPTION:${escapeIcsText(descriptionParts.join(' — '))}`] : []),
    ...(plan.restaurant ? [`LOCATION:${escapeIcsText(plan.restaurant)}`] : []),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.join('\r\n');
}

/** Generates the .ics file and downloads it — no server involved. */
export function downloadDatePlanIcs(plan: DatePlan, options: PlanIcsOptions = {}): void {
  const ics = buildDatePlanIcs(plan, options);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'our-date-plan.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
