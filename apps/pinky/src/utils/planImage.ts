/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatePlan } from '../types';

const IMAGE_WIDTH = 1080;
const IMAGE_HEIGHT = 1920;

const PINK = '#FF2E7E';
const PINK_SOFT = '#FF80BF';

export interface PlanImageOptions {
  /** The falling-screen word — the image background is that word repeated in a marquee
   * grid, the same look as the celebration screen behind the plan on the page. */
  celebrationWord?: string;
  /** Pre-formatted date string, so the image matches exactly what the card shows. */
  formattedDate?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Tiles the celebration word across every row (alternating solid-white and
 * outlined-white, low opacity) over the neon-pink fill — same treatment as
 * YesCelebrationOverlay's marquee. Exported for the test that checks the word is used. */
export function drawMarqueeBackground(ctx: CanvasRenderingContext2D, celebrationWord?: string): void {
  ctx.fillStyle = PINK;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  const word = (celebrationWord?.trim() || 'YES').toUpperCase();
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '900 132px system-ui, -apple-system, sans-serif';
  ctx.lineWidth = 2;
  const rowHeight = 168;
  const gap = ctx.measureText('  ').width + 64;
  const wordWidth = ctx.measureText(word).width + gap;
  for (let row = 0; row * rowHeight < IMAGE_HEIGHT + rowHeight; row++) {
    const y = row * rowHeight + rowHeight / 2;
    const outlined = row % 2 === 1;
    const startX = -((row % 3) * wordWidth) / 3 - 120;
    for (let x = startX; x < IMAGE_WIDTH + wordWidth; x += wordWidth) {
      if (outlined) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.strokeText(word, x, y);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText(word, x, y);
      }
    }
  }
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

/** One "icon chip + label + value" line, matching the modal's summary rows. Returns the
 * y just past the row. */
function drawInfoRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  innerW: number,
  emoji: string,
  label: string,
  valueLines: string[]
): number {
  const chip = 52;
  ctx.fillStyle = 'rgba(255, 46, 126, 0.20)';
  roundRect(ctx, x, y, chip, chip, 14);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '26px system-ui, -apple-system, sans-serif';
  ctx.fillText(emoji, x + chip / 2, y + chip / 2 + 10);

  const textX = x + chip + 26;
  ctx.textAlign = 'left';
  ctx.font = '700 20px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(label.toUpperCase(), textX, y + 22);

  ctx.font = '700 36px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  let vy = y + 62;
  for (const line of valueLines.slice(0, 2)) {
    ctx.fillText(line, textX, vy);
    vy += 42;
  }
  void innerW;
  return Math.max(y + chip, vy - 42) + 20;
}

/**
 * Draws the confirmed plan as a card that mirrors the on-screen "Our Date is Set!"
 * modal (minus its 3 action buttons), composited onto the 1080×1920 celebration-marquee
 * background with the sent4u wordmark on top. Canvas-drawn rather than a DOM screenshot —
 * html2canvas can't read Tailwind v4's oklch colors and html-to-image's foreignObject
 * capture is unreliable — so this always produces the same result, fast, offline. No
 * server round-trip and no temporary hosted URL.
 */
export async function createPlanImageFile(plan: DatePlan, options: PlanImageOptions = {}): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  drawMarqueeBackground(ctx, options.celebrationWord);

  // Wordmark, top and centered.
  const logoTop = 78;
  ctx.font = '700 56px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('sent4u', IMAGE_WIDTH / 2, logoTop);
  ctx.textAlign = 'left';
  const cursorY = logoTop + 82;

  const restaurantImg = plan.restaurantImageUrl
    ? await loadImage(plan.restaurantImageUrl).catch(() => null)
    : null;

  // ---- the card ----
  const cardX = 70;
  const cardW = IMAGE_WIDTH - cardX * 2;
  const cardY = cursorY + 60;
  const pad = 44;
  const innerX = cardX + pad;
  const innerW = cardW - pad * 2;
  const photoH = restaurantImg ? innerW : 0; // 1:1 photo, so height == innerW

  // header(104) + divider gap(40) + activity row(88) + datetime row(88) + restaurant
  // label+name(120) + photo + bottom pad — matches what the drawing below advances by.
  const cardH = pad + 104 + 40 + 88 + 88 + 120 + (photoH ? photoH + 12 : 0) + pad;

  ctx.fillStyle = 'rgba(10, 10, 12, 0.96)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 46, 126, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();

  let y = cardY + pad;

  // Header: heart glyph + title + subtitle
  ctx.save();
  ctx.fillStyle = PINK;
  const hx = innerX + 24;
  const hy = y + 22;
  ctx.beginPath();
  ctx.moveTo(hx, hy + 16);
  ctx.bezierCurveTo(hx - 26, hy - 6, hx - 16, hy - 24, hx, hy - 8);
  ctx.bezierCurveTo(hx + 16, hy - 24, hx + 26, hy - 6, hx, hy + 16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 44px system-ui, -apple-system, sans-serif';
  ctx.fillText('OUR DATE IS SET!', innerX + 72, y + 32);
  ctx.fillStyle = PINK_SOFT;
  ctx.font = '500 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('All 3 pieces united into our perfect date plan ✨', innerX + 72, y + 66);

  y += 104;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(innerX, y);
  ctx.lineTo(innerX + innerW, y);
  ctx.stroke();
  y += 40;

  y = drawInfoRow(ctx, innerX, y, innerW, '🎬', 'Activity', wrap(ctx, plan.activity || 'TBA', innerW - 90));
  const when = `${options.formattedDate || plan.date || 'TBA'}   •   ${plan.time || 'TBA'}`;
  y = drawInfoRow(ctx, innerX, y, innerW, '📅', 'When We Meet', wrap(ctx, when, innerW - 90));

  // Restaurant row: label + name, then the 1:1 photo. (The web card's "Google Maps
  // Location" link is intentionally left off the image — it's not tappable in a picture.)
  const chip = 52;
  ctx.fillStyle = 'rgba(255, 46, 126, 0.20)';
  roundRect(ctx, innerX, y, chip, chip, 14);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '26px system-ui, -apple-system, sans-serif';
  ctx.fillText('📍', innerX + chip / 2, y + chip / 2 + 10);
  ctx.textAlign = 'left';
  ctx.font = '700 20px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('ROMANTIC DINNER', innerX + chip + 26, y + 22);
  ctx.font = '700 36px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  let ny = y + 62;
  for (const line of wrap(ctx, plan.restaurant || 'TBA', innerW - 90).slice(0, 2)) {
    ctx.fillText(line, innerX + chip + 26, ny);
    ny += 42;
  }
  y = ny + 8;

  if (restaurantImg) {
    ctx.save();
    roundRect(ctx, innerX, y, innerW, innerW, 24);
    ctx.clip();
    const s = Math.min(restaurantImg.width, restaurantImg.height);
    ctx.drawImage(
      restaurantImg,
      (restaurantImg.width - s) / 2,
      (restaurantImg.height - s) / 2,
      s,
      s,
      innerX,
      y,
      innerW,
      innerW
    );
    ctx.restore();
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to encode PNG');
  return new File([blob], 'our-date-plan.png', { type: 'image/png' });
}

export type ShareImageResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/**
 * Hands the file straight to the native share sheet when the platform supports sharing
 * files (iOS Safari, most modern Android browsers); otherwise downloads it. Never
 * uploads anywhere and never creates a temporary hosted URL — the file only ever exists
 * client-side, either in the OS share sheet's hands or the browser's downloads.
 */
export async function shareOrDownloadPlanImage(
  file: File,
  shareText?: { title?: string; text?: string }
): Promise<ShareImageResult> {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };

  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: shareText?.title, text: shareText?.text });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      return 'failed';
    }
  }

  try {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
