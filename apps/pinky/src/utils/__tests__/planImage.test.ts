import { describe, it, expect, afterEach } from 'vitest';
import { createPlanImageFile, shareOrDownloadPlanImage } from '../planImage';
import { installFakeCanvas } from '../../test/fakeCanvas';
import type { DatePlan } from '../../types';

const plan: DatePlan = {
  activity: 'Sunset Picnic in the Park',
  date: '2099-06-14',
  time: '7:00 PM',
  restaurant: "L'Amore Sky Rooftop",
  mapsLink: 'https://maps.google.com/?q=lamore',
  restaurantImageUrl: 'https://images.unsplash.com/photo-1'
};

describe('createPlanImageFile', () => {
  let canvas: ReturnType<typeof installFakeCanvas>;
  afterEach(() => canvas?.restore());

  it('produces a real PNG File named for the plan, not a temporary/hosted URL', async () => {
    canvas = installFakeCanvas();
    const file = await createPlanImageFile(plan, { celebrationWord: 'Monica' });
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('image/png');
    expect(file.name).toMatch(/\.png$/);
  });

  it('draws the confirmed activity, date, time and place onto the image', async () => {
    canvas = installFakeCanvas();
    await createPlanImageFile(plan, { formattedDate: 'Sat, Jun 14, 2099' });
    const drawn = canvas.fillTextCalls.join(' | ');
    expect(drawn).toContain('Sunset Picnic in the Park');
    expect(drawn).toContain('Sat, Jun 14, 2099');
    expect(drawn).toContain('7:00 PM');
    expect(drawn).toContain("L'Amore Sky Rooftop");
  });

  it('never draws the 3 action-button labels — the image is the card, not its controls', async () => {
    canvas = installFakeCanvas();
    await createPlanImageFile(plan, {});
    const drawn = canvas.fillTextCalls.join(' | ').toLowerCase();
    for (const forbidden of [
      'share image',
      'send by message',
      'save to calendar',
      'creating',
      'start over',
      'google maps location'
    ]) {
      expect(drawn).not.toContain(forbidden);
    }
  });

  it('draws the restaurant photo as a 1:1 square (equal width and height)', async () => {
    canvas = installFakeCanvas();
    await createPlanImageFile(plan, {});
    // The only drawImage call for the restaurant photo passes a square dest box.
    const photoCall = canvas.ctx.drawImage.mock.calls.find((c) => c.length === 9);
    expect(photoCall).toBeDefined();
    const [, , , , , , , destW, destH] = photoCall as unknown as number[];
    expect(destW).toBe(destH);
  });

  it('reflects the current plan, not a stale one', async () => {
    canvas = installFakeCanvas();
    await createPlanImageFile({ ...plan, activity: 'Rooftop Cinema Night' }, {});
    const drawn = canvas.fillTextCalls.join(' | ');
    expect(drawn).toContain('Rooftop Cinema Night');
    expect(drawn).not.toContain('Sunset Picnic in the Park');
  });

  it('uses the celebration word as the repeating marquee background', async () => {
    canvas = installFakeCanvas();
    await createPlanImageFile(plan, { celebrationWord: 'Monica' });
    const drawn = [...canvas.fillTextCalls, ...canvas.strokeTextCalls];
    expect(drawn.filter((t) => t === 'MONICA').length).toBeGreaterThan(5);
  });
});

describe('shareOrDownloadPlanImage', () => {
  it('hands the file to navigator.share when the platform can share files', async () => {
    const file = new File(['x'], 'our-date-plan.png', { type: 'image/png' });
    let sharedFiles: File[] | undefined;
    navigator.canShare = () => true;
    navigator.share = async (data?: ShareData) => {
      sharedFiles = data?.files as File[];
    };

    const result = await shareOrDownloadPlanImage(file);
    expect(result).toBe('shared');
    expect(sharedFiles?.[0]).toBe(file);

    delete navigator.canShare;
    delete navigator.share;
  });

  it('reports "cancelled" when the user dismisses the native share sheet', async () => {
    const file = new File(['x'], 'our-date-plan.png', { type: 'image/png' });
    navigator.canShare = () => true;
    navigator.share = async () => {
      throw new DOMException('closed', 'AbortError');
    };

    const result = await shareOrDownloadPlanImage(file);
    expect(result).toBe('cancelled');

    delete navigator.canShare;
    delete navigator.share;
  });

  it('falls back to a plain download when file sharing is unsupported — never uploads anywhere', async () => {
    const file = new File(['x'], 'our-date-plan.png', { type: 'image/png' });
    let clicked = false;
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      clicked = true;
    };

    const result = await shareOrDownloadPlanImage(file);
    expect(result).toBe('downloaded');
    expect(clicked).toBe(true);

    HTMLAnchorElement.prototype.click = originalClick;
  });
});
