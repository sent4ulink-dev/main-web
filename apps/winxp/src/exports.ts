import { displayDate, validDateTime, type Plan } from "../shared/flow";
import { emoticonUrl } from "../shared/emoticons";
export function planText(p: Plan) {
  return `${p.heading}\n\nActivity: ${p.activity}\nDate: ${displayDate(p.date)}\nTime: ${p.time}\nPlace: ${p.place}\n\n${p.greeting}\n${p.message}\n\n${p.closing}\n${p.finalClosing}`;
}
export function smsUrl(p: Plan, userAgent = navigator.userAgent) {
  return `sms:${/iPad|iPhone|iPod/.test(userAgent) ? "&" : "?"}body=${encodeURIComponent(planText(p))}`;
}
const escapeIcs = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
export function foldLine(line: string) {
  const parts: string[] = [];
  let current = "",
    bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 75) {
      parts.push(current);
      current = " ";
      bytes = 1;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n");
}
export function calendar(p: Plan, now = new Date()) {
  if (!p.activity || !p.date || !p.time || !p.place)
    throw new Error("Plan is incomplete");
  const start = new Date(`${p.date}T${p.time}:00`);
  if (!Number.isFinite(+start)) throw new Error("Invalid event date");
  if (!validDateTime(p.date, p.time, now))
    throw new Error("Event date and time must be in the future");
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const localStamp = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Heart Desktop//Romantic Invitation//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${p.date.replaceAll("-", "")}-${p.time.replace(":", "")}-${hash(planText(p))}@heart-desktop`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${localStamp(start)}`,
      `DTEND:${localStamp(new Date(+start + 7200000))}`,
      `SUMMARY:${escapeIcs(p.eventTitle)}`,
      `LOCATION:${escapeIcs(p.place)}`,
      `DESCRIPTION:${escapeIcs(planText(p))}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(foldLine)
      .join("\r\n") + "\r\n"
  );
}
function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16);
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function renderStory(
  p: Plan,
  background = "/wallpaper-photo.png",
): Promise<File> {
  await document.fonts.ready;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(
      () => reject(new Error("Wallpaper took too long to load")),
      10000,
    );
    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Wallpaper could not be loaded. Please try again."));
    };
    img.src = background;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image creation is unavailable");
  const ratio = Math.max(1080 / image.width, 1920 / image.height);
  ctx.drawImage(
    image,
    (1080 - image.width * ratio) / 2,
    0,
    image.width * ratio,
    image.height * ratio,
  );
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = "#20212b",
    bold = false,
  ) => {
    ctx.fillStyle = color;
    ctx.font = `${bold ? "bold " : ""}${size}px Tahoma, Arial, sans-serif`;
    ctx.fillText(value, x, y);
  };
  const linesFor = (
    value: string,
    width: number,
    size: number,
    bold = false,
  ) => {
    ctx.font = `${bold ? "bold " : ""}${size}px Tahoma, Arial, sans-serif`;
    const lines: string[] = [];
    for (const para of value.split("\n")) {
      let line = "";
      for (const char of para) {
        if (ctx.measureText(line + char).width > width) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
      lines.push(line);
    }
    return lines;
  };
  const wrap = (
    value: string,
    x: number,
    y: number,
    width: number,
    size: number,
    color = "#20212b",
    bold = false,
  ) => {
    for (const line of linesFor(value, width, size, bold)) {
      text(line, x, y, size, color, bold);
      y += size * 1.4;
    }
    return y;
  };
  // This export is a fixed portrait design, independent from the live UI.
  // It intentionally contains no editor chrome, buttons, loading text or clock.
  ctx.fillStyle = "#073d78aa";
  ctx.fillRect(0, 0, 1080, 1920);
  rect(68, 108, 944, 1704, "#0b4db8");
  rect(76, 116, 928, 1688, "#fffdf5");
  rect(76, 116, 928, 20, "#1769d3");
  const face = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Emoticon could not be loaded."));
    img.src = emoticonUrl(p.finalEmoticon ?? "love");
  });
  ctx.drawImage(face, 478, 163, 124, 124);
  let titleSize = 42;
  while (
    titleSize > 24 &&
    linesFor(p.eventTitle, 780, titleSize, true).length > 2
  )
    titleSize--;
  wrap(p.eventTitle, 142, 352, 780, titleSize, "#163f78", true);
  text("✓  CONFIRMED", 142, 425, 23, "#39703b", true);
  const rows: [string, string][] = [
    ["ACTIVITY", p.activity],
    ["DATE & TIME", `${displayDate(p.date)} · ${p.time}`],
    ["PLACE", p.place],
  ];
  const imageMessage =
    p.greeting +
    "\n\n" +
    p.message +
    "\n\n" +
    p.closing +
    "\n" +
    p.finalClosing;
  let scale = 1;
  const required = (s: number) =>
    linesFor(p.heading, 768, 49 * s, true).length * 49 * s * 1.4 +
    28 * s +
    rows.reduce(
      (sum, [, v]) =>
        sum + 44 * s + linesFor(v, 755, 32 * s).length * 32 * s * 1.4 + 30 * s,
      0,
    ) +
    65 * s +
    linesFor(imageMessage, 755, 28 * s).length * 28 * s * 1.4;
  while (scale > 0.25 && required(scale) > 1240) scale -= 0.025;
  if (required(scale) > 1240)
    throw new Error(
      "The story text has too many lines for an image. Shorten the heading or closing and try again.",
    );
  let y =
    wrap(p.heading, 142, 515, 796, 49 * scale, "#234478", true) + 28 * scale;
  for (const [label, value] of rows) {
    text(label, 142, y, 19 * scale, "#687891", true);
    y = wrap(value, 142, y + 44 * scale, 796, 32 * scale) + 30 * scale;
  }
  rect(142, y, 796, 2, "#d7d8cf");
  wrap(imageMessage, 142, y + 52 * scale, 796, 28 * scale, "#566175");
  text("♡  Our next good memory", 142, 1740, 22, "#7b6576");
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG could not be created"))),
      "image/png",
    ),
  );
  return new File([blob], "our-date.png", { type: "image/png" });
}
