import { describe, it, expect, afterEach } from 'vitest';
import { buildDatePlanIcs, downloadDatePlanIcs, isPlanDateTimeValid, parsePlanStart } from '../planCalendar';
import type { DatePlan } from '../../types';

const futurePlan: DatePlan = {
  activity: 'Sunset Picnic in the Park',
  date: '2099-06-14',
  time: '7:00 PM',
  restaurant: "L'Amore Sky Rooftop"
};

describe('parsePlanStart', () => {
  it('parses a 12h preset time ("7:00 PM")', () => {
    const start = parsePlanStart({ date: '2099-06-14', time: '7:00 PM' });
    expect(start).not.toBeNull();
    expect(start!.getHours()).toBe(19);
    expect(start!.getMinutes()).toBe(0);
  });

  it('parses a 24h custom time ("19:30") from the <input type="time"> picker', () => {
    const start = parsePlanStart({ date: '2099-06-14', time: '19:30' });
    expect(start).not.toBeNull();
    expect(start!.getHours()).toBe(19);
    expect(start!.getMinutes()).toBe(30);
  });

  it('handles 12 AM / 12 PM correctly', () => {
    expect(parsePlanStart({ date: '2099-06-14', time: '12:00 AM' })!.getHours()).toBe(0);
    expect(parsePlanStart({ date: '2099-06-14', time: '12:00 PM' })!.getHours()).toBe(12);
  });

  it('returns null when date or time is missing/unparseable', () => {
    expect(parsePlanStart({ date: '', time: '7:00 PM' })).toBeNull();
    expect(parsePlanStart({ date: '2099-06-14', time: '' })).toBeNull();
    expect(parsePlanStart({ date: '2099-06-14', time: 'whenever' })).toBeNull();
  });
});

describe('isPlanDateTimeValid', () => {
  it('is true for a real future date/time', () => {
    expect(isPlanDateTimeValid(futurePlan)).toBe(true);
  });

  it('is false for a past date/time', () => {
    expect(isPlanDateTimeValid({ ...futurePlan, date: '2000-01-01' })).toBe(false);
  });

  it('is false when the date or time was never set', () => {
    expect(isPlanDateTimeValid({ ...futurePlan, date: '', time: '' })).toBe(false);
  });
});

describe('buildDatePlanIcs', () => {
  it('contains the same confirmed activity, date/time and restaurant as the plan', () => {
    const ics = buildDatePlanIcs(futurePlan, { message: 'Cannot wait! 🥰' });
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Date: Sunset Picnic in the Park');
    expect(ics).toContain('LOCATION:L\'Amore Sky Rooftop');
    expect(ics).toContain('DESCRIPTION:');
    expect(ics).toContain('Cannot wait');
    // DTSTART encodes 2099-06-14 19:00 local, as a UTC-stamped ICS date-time.
    const start = parsePlanStart(futurePlan)!;
    const expectedStamp = start
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
    expect(ics).toContain(`DTSTART:${expectedStamp}`);
  });

  it('ends 2 hours after the confirmed start by default', () => {
    const ics = buildDatePlanIcs(futurePlan);
    const dtstart = ics.match(/DTSTART:(\S+)/)![1];
    const dtend = ics.match(/DTEND:(\S+)/)![1];
    const parse = (s: string) =>
      Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`);
    expect(parse(dtend) - parse(dtstart)).toBe(2 * 60 * 60 * 1000);
  });

  it('throws rather than generating a bogus event when the plan has no valid date/time', () => {
    expect(() => buildDatePlanIcs({ ...futurePlan, date: '', time: '' })).toThrow();
  });

  it('reflects the CURRENT plan, not a stale one, on every call', () => {
    const icsA = buildDatePlanIcs(futurePlan);
    const icsB = buildDatePlanIcs({ ...futurePlan, activity: 'Rooftop Cinema Night' });
    expect(icsA).toContain('Sunset Picnic in the Park');
    expect(icsB).toContain('Rooftop Cinema Night');
    expect(icsB).not.toContain('Sunset Picnic in the Park');
  });
});

describe('downloadDatePlanIcs', () => {
  afterEach(() => {
    // no-op; each test restores what it patches itself
  });

  it('triggers a client-side file download and nothing else (no network call)', () => {
    let clicked = false;
    let downloadedName = '';
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicked = true;
      downloadedName = this.download;
    };

    downloadDatePlanIcs(futurePlan, { message: 'Cannot wait!' });

    expect(clicked).toBe(true);
    expect(downloadedName).toBe('our-date-plan.ics');

    HTMLAnchorElement.prototype.click = originalClick;
  });
});
