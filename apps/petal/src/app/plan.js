import { longDate } from "../core/dates.js";

// The finished plan, and the three ways to take it along: a picture to share,
// a text message and a calendar file. Plain data goes in and text or files
// come out (the picture is drawn on whatever canvas the caller hands over),
// so nothing here depends on how the site looks, and all of it is tested
// (tests/plan.test.js).

export const IMAGE_SIZE = { width: 1080, height: 1920 };
export const IMAGE_NAME = "bidnii-bolzoo.png";
export const CALENDAR_NAME = "bidnii-bolzoo.ics";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// The plan exactly as the keepsake book shows it: the three choices (the
// left page) and the love letter (the right page).
export function currentPlan(content, selections = {}) {
  const date = DATE.test(selections.date || "") ? selections.date : "";
  const plan = {
    title: (content.book?.title || "").trim(),
    activity: (selections.activity || "").trim(),
    place: (selections.place || "").trim(),
    date,
    dateText: date ? longDate(date, { weekday: true }) : "",
    message: (content.book?.note || "").trim(),
    signature: (content.book?.signature || "").trim(),
  };
  plan.complete = Boolean(plan.activity && plan.place && plan.date);
  return plan;
}

// ------------------------------------------------------------- message --
export function planText(plan) {
  return [
    `${plan.title} ♡`,
    `Adventure: ${plan.activity}`,
    `Date: ${plan.dateText}`,
    `Place: ${plan.place}`,
    ...(plan.message || plan.signature ? ["", plan.message, plan.signature].filter((line, i) => i === 0 || line) : []),
  ].join("\n");
}

export function isIOS(nav = globalThis.navigator) {
  const agent = nav?.userAgent || "";
  return /iPad|iPhone|iPod/.test(agent) || (nav?.platform === "MacIntel" && (nav?.maxTouchPoints || 0) > 1);
}

// An sms: link that opens the phone's message composer with the plan filled
// in (nothing is sent). iPhones read the body after "&", Android after "?".
export function smsLink(text, { ios = isIOS() } = {}) {
  return `sms:${ios ? "&" : "?"}body=${encodeURIComponent(text)}`;
}

// ------------------------------------------------------------ calendar --
// A real day, today or later (the plan has no time, so it is an all-day event).
export function isFutureDate(date, today = new Date()) {
  if (!DATE.test(date || "")) return false;
  const [year, month, day] = date.split("-").map(Number);
  const when = new Date(year, month - 1, day);
  if (when.getFullYear() !== year || when.getMonth() !== month - 1 || when.getDate() !== day) return false;
  return when >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

export function canSaveToCalendar(plan, today = new Date()) {
  return plan.complete && isFutureDate(plan.date, today);
}

const pad = (n) => String(n).padStart(2, "0");
const icsText = (text) => String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lines over 75 bytes are folded (RFC 5545), never inside a letter: Mongolian
// letters take two bytes each.
function fold(line) {
  const encoder = new TextEncoder();
  const parts = [];
  let part = "";
  let bytes = 0;
  for (const letter of line) {
    const size = encoder.encode(letter).length;
    if (bytes + size > (parts.length ? 74 : 75)) {
      parts.push(part);
      part = "";
      bytes = 0;
    }
    part += letter;
    bytes += size;
  }
  parts.push(part);
  return parts.join("\r\n ");
}

function hash(text) {
  let h = 2166136261;
  for (const letter of text) h = Math.imul(h ^ letter.codePointAt(0), 16777619) >>> 0;
  return h.toString(36);
}

export function calendarFile(plan, { now = new Date() } = {}) {
  const [year, month, day] = plan.date.split("-").map(Number);
  const next = new Date(year, month - 1, day + 1);
  const start = plan.date.replace(/-/g, "");
  const end = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const description = [`Adventure: ${plan.activity}`, `Place: ${plan.place}`, ...(plan.message ? ["", plan.message] : []), ...(plan.signature ? [plan.signature] : [])].join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Petal Isle//Bidnii bolzoo//MN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${start}-${hash(`${plan.activity}|${plan.place}|${plan.message}`)}@petal-isle`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${icsText(`${plan.title}: ${plan.activity}`)}`,
    `LOCATION:${icsText(plan.place)}`,
    `DESCRIPTION:${icsText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function calendarBlob(plan, options) {
  return new Blob([calendarFile(plan, options)], { type: "text/calendar;charset=utf-8" });
}

// --------------------------------------------------------------- image --
const SERIF = '"Cormorant Garamond", Georgia, serif';
const SANS = '"Nunito", system-ui, sans-serif';
const INK = "#6f4859";
const ROSE = "#c2527f";

function seeded(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

function fit(g, text, maxWidth, size, style, family, least = 26) {
  let s = size;
  g.font = `${style} ${s}px ${family}`;
  while (s > least && g.measureText(text).width > maxWidth) {
    s -= 2;
    g.font = `${style} ${s}px ${family}`;
  }
  return s;
}

function wrap(g, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split(/\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (line && g.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

function heart(g, x, y, s, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.4, y - s, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
  g.fill();
}

function sparkle(g, x, y, s, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - s);
  g.quadraticCurveTo(x, y, x + s, y);
  g.quadraticCurveTo(x, y, x, y + s);
  g.quadraticCurveTo(x, y, x - s, y);
  g.quadraticCurveTo(x, y, x, y - s);
  g.fill();
}

function cloud(g, x, y, s, color) {
  g.fillStyle = color;
  for (const [dx, dy, r] of [[0, 0, 1], [0.95, 0.18, 0.78], [-0.9, 0.22, 0.72], [0.38, -0.48, 0.8], [-0.38, -0.34, 0.64], [1.7, 0.42, 0.5], [-1.6, 0.46, 0.48]]) {
    g.beginPath();
    g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    g.fill();
  }
}

function petal(g, x, y, s, angle, color) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, -s);
  g.bezierCurveTo(s * 0.9, -s * 0.6, s * 0.7, s * 0.7, 0, s);
  g.bezierCurveTo(-s * 0.7, s * 0.7, -s * 0.9, -s * 0.6, 0, -s);
  g.fill();
  g.restore();
}

// Small line icons for the card's rows: a flower, a calendar, a map pin.
function icon(g, kind, x, y) {
  g.save();
  g.fillStyle = "#ffe3ee";
  g.beginPath();
  g.arc(x, y, 46, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = ROSE;
  g.fillStyle = ROSE;
  g.lineWidth = 5;
  g.lineCap = "round";
  g.lineJoin = "round";
  if (kind === "flower") {
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.arc(x + Math.cos(a) * 13, y + Math.sin(a) * 13, 9.5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#ffd86b";
    g.beginPath();
    g.arc(x, y, 7, 0, Math.PI * 2);
    g.fill();
  } else if (kind === "calendar") {
    g.beginPath();
    g.roundRect(x - 22, y - 18, 44, 40, 7);
    g.stroke();
    g.beginPath();
    g.moveTo(x - 22, y - 5);
    g.lineTo(x + 22, y - 5);
    g.moveTo(x - 10, y - 25);
    g.lineTo(x - 10, y - 13);
    g.moveTo(x + 10, y - 25);
    g.lineTo(x + 10, y - 13);
    g.stroke();
    heart(g, x, y + 10, 9, ROSE);
  } else {
    g.beginPath();
    g.moveTo(x, y + 26);
    g.bezierCurveTo(x - 30, y - 6, x - 18, y - 28, x, y - 28);
    g.bezierCurveTo(x + 18, y - 28, x + 30, y - 6, x, y + 26);
    g.fill();
    g.fillStyle = "#ffe3ee";
    g.beginPath();
    g.arc(x, y - 8, 8, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// The background: a dawn sky in pink and lilac, glowing, with drifting petals,
// sparkles and banks of cloud. Always the same (seeded), whatever the plan.
function background(g, w, h) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#ffd3e6");
  sky.addColorStop(0.42, "#f4dcff");
  sky.addColorStop(0.78, "#dce8ff");
  sky.addColorStop(1, "#ffe9f3");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  for (const [x, y, r, color] of [[w * 0.2, h * 0.12, 520, "rgba(255,255,255,0.55)"], [w * 0.88, h * 0.4, 460, "rgba(255,226,240,0.6)"], [w * 0.3, h * 0.78, 560, "rgba(236,226,255,0.55)"]]) {
    const glow = g.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
  }
  const random = seeded(1114);
  for (let i = 0; i < 70; i += 1) sparkle(g, random() * w, random() * h, 4 + random() * 9, `rgba(255,255,255,${0.45 + random() * 0.45})`);
  for (let i = 0; i < 34; i += 1) {
    petal(g, random() * w, random() * h, 9 + random() * 13, random() * Math.PI * 2, ["#ffb7cf", "#ff9fc3", "#ffd0e0", "#e7c9ff"][i % 4]);
  }
  cloud(g, w * 0.08, h * 0.06, 92, "rgba(255,255,255,0.85)");
  cloud(g, w * 0.95, h * 0.1, 78, "rgba(255,255,255,0.75)");
  for (const [x, s, color] of [[0.06, 150, "#fff4fa"], [0.36, 175, "#ffffff"], [0.68, 160, "#fff6fb"], [0.97, 150, "#ffffff"]]) cloud(g, w * x, h * 0.99, s, color);
  for (const [x, s] of [[0.2, 120], [0.55, 135], [0.85, 115]]) cloud(g, w * x, h * 1.02, s, "#ffe7f1");
}

// The ribbon: "It’s a date!" on a stitched pink band with swallow tails.
function ribbon(g, w, y) {
  for (const dir of [-1, 1]) {
    const inner = w / 2 + dir * 330;
    const outer = w / 2 + dir * 470;
    g.fillStyle = "#e9739f";
    g.beginPath();
    g.moveTo(inner, y + 40);
    g.lineTo(outer, y + 40);
    g.lineTo(outer - dir * 56, y + 120);
    g.lineTo(outer, y + 200);
    g.lineTo(inner, y + 200);
    g.closePath();
    g.fill();
  }
  g.save();
  g.shadowColor = "rgba(150, 40, 80, 0.3)";
  g.shadowBlur = 24;
  g.shadowOffsetY = 8;
  const band = g.createLinearGradient(0, y, 0, y + 180);
  band.addColorStop(0, "#ffb3cf");
  band.addColorStop(1, "#ff83ad");
  g.fillStyle = band;
  g.beginPath();
  g.roundRect(w / 2 - 390, y, 780, 180, 46);
  g.fill();
  g.restore();
  g.setLineDash([16, 12]);
  g.strokeStyle = "rgba(255, 255, 255, 0.8)";
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(w / 2 - 372, y + 18, 744, 144, 34);
  g.stroke();
  g.setLineDash([]);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#ffffff";
  g.save();
  g.shadowColor = "rgba(160, 40, 90, 0.45)";
  g.shadowBlur = 8;
  g.shadowOffsetY = 3;
  const title = "It’s a date!";
  fit(g, title, 560, 92, "italic 600", SERIF);
  g.fillText(title, w / 2, y + 92);
  const half = g.measureText(title).width / 2;
  g.restore();
  heart(g, w / 2 - half - 46, y + 96, 24, "#ffffff");
  heart(g, w / 2 + half + 46, y + 96, 24, "#ffffff");
}

// Draws the plan on a 2D context: the fixed background, the book's title, the
// ribbon, a card with the activity, the day and the place, then the letter
// and its signature. Nothing of the site's own interface is drawn.
export function drawPlanImage(g, plan, { width = IMAGE_SIZE.width, height = IMAGE_SIZE.height } = {}) {
  const w = width;
  const h = height;
  background(g, w, h);
  g.textAlign = "center";
  g.textBaseline = "middle";

  // The title.
  g.fillStyle = "#b0527a";
  fit(g, plan.title, w - 240, 118, "italic 600", SERIF);
  g.fillText(plan.title, w / 2, 214);
  heart(g, w / 2, 298, 20, "#f08db0");

  ribbon(g, w, 352);

  // The card.
  const card = { x: 96, y: 610, w: w - 192, h: 600 };
  g.save();
  g.shadowColor = "rgba(122, 61, 90, 0.22)";
  g.shadowBlur = 50;
  g.shadowOffsetY = 18;
  const paper = g.createLinearGradient(0, card.y, 0, card.y + card.h);
  paper.addColorStop(0, "#fffdf9");
  paper.addColorStop(1, "#fff4ec");
  g.fillStyle = paper;
  g.beginPath();
  g.roundRect(card.x, card.y, card.w, card.h, 56);
  g.fill();
  g.restore();
  g.setLineDash([14, 12]);
  g.strokeStyle = "#f4c3d5";
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(card.x + 22, card.y + 22, card.w - 44, card.h - 44, 40);
  g.stroke();
  g.setLineDash([]);
  const rows = [["flower", "ADVENTURE", plan.activity], ["calendar", "DATE", plan.dateText], ["pin", "PLACE", plan.place]];
  rows.forEach(([kind, label, value], i) => {
    const y = card.y + 112 + i * 188;
    icon(g, kind, card.x + 116, y + 6);
    g.textAlign = "left";
    g.fillStyle = "#b08a9a";
    g.font = `800 30px ${SANS}`;
    g.fillText(label, card.x + 190, y - 30);
    g.fillStyle = INK;
    const lines = (() => {
      const size = fit(g, value, card.w - 250, 64, "italic 600", SERIF, 44);
      if (g.measureText(value).width <= card.w - 250) return [[value, size]];
      g.font = `italic 600 46px ${SERIF}`;
      return wrap(g, value, card.w - 250).slice(0, 2).map((line) => [line, 46]);
    })();
    lines.forEach(([line, size], k) => {
      g.font = `italic 600 ${size}px ${SERIF}`;
      g.fillText(line, card.x + 190, y + 28 + k * 50 - (lines.length - 1) * 22);
    });
    if (i < rows.length - 1) {
      g.strokeStyle = "#f3d6e2";
      g.lineWidth = 3;
      g.setLineDash([3, 12]);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(card.x + 70, y + 96);
      g.lineTo(card.x + card.w - 70, y + 96);
      g.stroke();
      g.setLineDash([]);
    }
  });

  // The letter (smaller if it is long), then the signature.
  g.textAlign = "center";
  let size = 54;
  let lines;
  for (;;) {
    g.font = `italic 500 ${size}px ${SERIF}`;
    lines = wrap(g, plan.message, w - 230);
    if (lines.length * size * 1.32 <= 430 || size <= 34) break;
    size -= 2;
  }
  const top = 1300;
  g.fillStyle = INK;
  lines.slice(0, Math.floor(430 / (size * 1.32))).forEach((line, i) => g.fillText(line, w / 2, top + i * size * 1.32));
  if (plan.signature) {
    g.fillStyle = ROSE;
    fit(g, plan.signature, w - 300, 64, "italic 600", SERIF);
    g.fillText(plan.signature, w / 2, 1772);
  }
  heart(g, w / 2 - 70, 1846, 16, "#f29bbb");
  heart(g, w / 2, 1856, 22, "#ff83ad");
  heart(g, w / 2 + 70, 1846, 16, "#f29bbb");
}

// The fonts the picture uses, with Mongolian letters, before drawing it.
async function fontsReady(doc = globalThis.document) {
  if (!doc?.fonts?.load) return;
  const sample = "Our date";
  await Promise.race([
    Promise.all([
      doc.fonts.load(`italic 600 64px ${SERIF}`, sample),
      doc.fonts.load(`italic 500 54px ${SERIF}`, sample),
      doc.fonts.load(`800 30px ${SANS}`, sample),
    ]).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// The picture as a real PNG File, made in the browser (no upload, no link).
export async function createPlanImage(plan, { createCanvas = makeCanvas, ready = fontsReady } = {}) {
  await ready();
  const canvas = createCanvas(IMAGE_SIZE.width, IMAGE_SIZE.height);
  drawPlanImage(canvas.getContext("2d"), plan, IMAGE_SIZE);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((made) => (made ? resolve(made) : reject(new Error("The picture could not be made."))), "image/png");
  });
  return new File([blob], IMAGE_NAME, { type: "image/png" });
}

// Saves a file to the device. (The browser needs a link to its own memory for
// a moment to do it; nothing leaves the device, and it is let go at once.)
export function saveFile(file, doc = globalThis.document) {
  const href = URL.createObjectURL(file);
  const link = doc.createElement("a");
  link.href = href;
  link.download = file.name;
  link.rel = "noopener";
  link.style.display = "none";
  doc.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1500);
}

// Opens the phone's share sheet with the file attached; where files can't be
// shared, saves it instead. "shared", "saved" or "cancelled".
export async function shareFile(file, { nav = globalThis.navigator, save = saveFile, title = "" } = {}) {
  if (nav?.share && nav?.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
      if (error?.name !== "NotAllowedError") throw error; // refused (no tap left to use): save instead
    }
  }
  save(file);
  return "saved";
}

// The picture's life: made ahead ("creating", then "ready"), so the share
// sheet can open straight from the tap, then shared ("ready" with how it
// went, "cancelled") or not ("failed").
export function createImageShare({ makeFile, share = shareFile, onState = () => {} }) {
  let file = null;
  let making = null;
  function prepare() {
    making ??= (async () => {
      onState("creating");
      try {
        file = await makeFile();
        onState("ready");
      } catch (error) {
        file = null;
        making = null;
        onState("failed", error);
      }
      return file;
    })();
    return making;
  }
  return {
    prepare,
    get file() { return file; },
    async share() {
      if (!file) await prepare();
      if (!file) return "failed";
      try {
        const how = await share(file);
        onState(how === "cancelled" ? "cancelled" : "ready", how);
        return how;
      } catch (error) {
        onState("failed", error);
        return "failed";
      }
    },
  };
}
