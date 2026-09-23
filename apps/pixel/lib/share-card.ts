import { planConfig, type DatePlan } from './date-config.ts';

const LCD = '#9bb477';
const INK = '#20351b';
const WIDTH = 1080;
const HEIGHT = 1920;

export function sharePlanText(plan: DatePlan): string {
  const config = planConfig(plan);
  return `OUR DATE ♥\n\nWHAT: ${plan.activity}\nDAY, TIME: ${config.date}, ${config.time}\nPLACE: ${config.location}\n\nCan't wait for our time together ♥`;
}

export function storyFileName(plan: DatePlan): string {
  return `our-date-${plan.day || 'story'}-final.png`;
}

async function drawBackground(ctx: CanvasRenderingContext2D) {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Couldn't load the background image."));
    image.src = '/assets/story-background-final.png';
  });
  ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initialSize: number,
  minimumSize: number,
) {
  let size = initialSize;
  while (size > minimumSize) {
    ctx.font = `${size}px LCD, monospace`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  return minimumSize;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function drawPlan(ctx: CanvasRenderingContext2D, plan: DatePlan) {
  const config = planConfig(plan);
  const outlinedText = (text: string, x: number, y: number) => {
    ctx.save();
    ctx.lineWidth = 6;
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = LCD;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = INK;
    ctx.fillText(text, x, y);
    ctx.restore();
  };
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '32px LCD, monospace';
  outlinedText('OUR CUTE LITTLE PLAN', WIDTH / 2, 380);
  ctx.font = '68px LCD, monospace';
  outlinedText('OUR DATE ♥', WIDTH / 2, 475);

  const rows = [
    ['WHAT', plan.activity],
    ['DAY', config.date],
    ['TIME', config.time],
    ['PLACE', config.location],
    ['STATUS', 'CONFIRMED ♥'],
  ];
  let y = 600;
  for (const [label, value] of rows) {
    ctx.textAlign = 'left';
    ctx.font = '31px LCD, monospace';
    outlinedText(label, 155, y);
    const size = fitText(ctx, value, 585, 43, 28);
    ctx.font = `${size}px LCD, monospace`;
    const lines = wrapText(ctx, value, 585).slice(0, 2);
    lines.forEach((line, index) =>
      outlinedText(line, 345, y + index * (size + 8)),
    );
    y += lines.length > 1 ? 115 : 90;
  }

  ctx.textAlign = 'center';
  ctx.font = '31px LCD, monospace';
  const message = wrapText(
    ctx,
    "Can't wait for our time together.",
    730,
  );
  message.forEach((line, index) =>
    outlinedText(line, WIDTH / 2, 1060 + index * 42),
  );
}

export async function createStoryCard(plan: DatePlan): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Couldn't create the image canvas.");
  ctx.imageSmoothingEnabled = false;
  await drawBackground(ctx);
  drawPlan(ctx, plan);

  const dataUrl = canvas.toDataURL('image/png');
  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index);
  return new File([bytes], storyFileName(plan), { type: 'image/png' });
}
