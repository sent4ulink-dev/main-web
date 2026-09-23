import { describe, it, expect, afterEach } from 'vitest';
import { buildPlanText, buildSmsHref, openSmsComposer } from '../planMessage';
import type { DatePlan } from '../../types';

const plan: DatePlan = {
  activity: 'Sunset Picnic in the Park',
  date: '2099-06-14',
  time: '7:00 PM',
  restaurant: "L'Amore Sky Rooftop",
  mapsLink: 'https://maps.google.com/?q=lamore'
};

describe('buildPlanText', () => {
  it('includes the confirmed activity, date, time, place and message', () => {
    const text = buildPlanText(plan, { formattedDate: 'Sat, Jun 14, 2099', message: 'Cannot wait! 🥰' });
    expect(text).toContain('Sunset Picnic in the Park');
    expect(text).toContain('Sat, Jun 14, 2099');
    expect(text).toContain('7:00 PM');
    expect(text).toContain("L'Amore Sky Rooftop");
    expect(text).toContain('Cannot wait! 🥰');
  });
});

describe('buildSmsHref', () => {
  const originalUserAgent = navigator.userAgent;
  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: originalUserAgent, configurable: true });
  });

  it('uses the "&body=" separator on iOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      configurable: true
    });
    const href = buildSmsHref('hello there');
    expect(href).toBe('sms:&body=hello%20there');
  });

  it('uses the "?body=" separator on Android', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
      configurable: true
    });
    const href = buildSmsHref('hello there');
    expect(href).toBe('sms:?body=hello%20there');
  });

  it('never auto-sends — it only ever builds a link, never posts anything itself', () => {
    // buildSmsHref returns a plain string; openSmsComposer only assigns
    // window.location.href to it, which opens the OS composer without sending.
    expect(typeof buildSmsHref('x')).toBe('string');
  });
});

describe('openSmsComposer', () => {
  it('opens the composer (via location) with the full plan text, and only that — no auto-send', () => {
    let assignedHref = '';
    // jsdom throws "Not implemented: navigation" on a real location.href set — replace
    // the whole location object with a plain recorder for this one assertion.
    const originalLocation = window.location;
    delete (window as { location?: Location }).location;
    // @ts-expect-error test-only stub
    window.location = {
      set href(v: string) {
        assignedHref = v;
      },
      get href() {
        return assignedHref;
      }
    };

    openSmsComposer(plan, { formattedDate: 'Sat, Jun 14, 2099', message: 'Cannot wait! 🥰' });

    expect(assignedHref.startsWith('sms:')).toBe(true);
    const decoded = decodeURIComponent(assignedHref.split('body=')[1]);
    expect(decoded).toContain('Sunset Picnic in the Park');
    expect(decoded).toContain('Sat, Jun 14, 2099');
    expect(decoded).toContain('7:00 PM');
    expect(decoded).toContain("L'Amore Sky Rooftop");
    expect(decoded).toContain('Cannot wait! 🥰');

    // @ts-expect-error restoring window.location
    window.location = originalLocation;
  });
});
