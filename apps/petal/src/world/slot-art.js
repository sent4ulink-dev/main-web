import * as THREE from "three";
import { MONTHS, WEEK_HEADINGS, longDate, mediumDate, weekColumn } from "../core/dates.js";
import { photoSize } from "../app/photo.js";

export const TOUR_STOPS = [
  { view: "question", label: "QUESTION", message: "A question is waiting in the first garden." },
  { view: "activities", label: "CHOOSE YOUR ADVENTURE", message: "Choose one of the three hanging memories." },
  { view: "calendar", label: "CHOOSE YOUR DAY", message: "The calendar is waiting for the date." },
  { view: "map", label: "CHOOSE YOUR PLACE", message: "Which way will our little adventure go?" },
  { view: "keepsake", label: "OUR KEEPSAKE", message: "The last pages remember everything you chose." },
  { view: "finale", label: "PETAL ISLE", message: "Your little world is ready." },
];

export const SLOT_NAMES = [
  "SLOT_01_Calendar", "SLOT_02_Activity_1", "SLOT_03_Activity_2", "SLOT_04_Activity_3",
  "SLOT_05_Map_1", "SLOT_06_Map_2", "SLOT_07_Map_3", "SLOT_08_Book_Left", "SLOT_09_Book_Right",
];

const SERIF = '"Cormorant Garamond", Georgia, serif';
const SANS = '"Nunito", system-ui, sans-serif';

// What the dialog shows for each surface, derived from the editable content.
export function slotContent(content) {
  const out = {
    SLOT_01_Calendar: { type: "calendar", title: content.calendar.title, kicker: "MARK YOUR DAY", body: content.calendar.body },
    SLOT_08_Book_Left: { type: "keepsake", title: content.book.title, kicker: "KEEPSAKE", body: content.book.note },
    SLOT_09_Book_Right: { type: "keepsake", title: content.book.title, kicker: "WRITTEN TOGETHER", body: content.book.note },
  };
  content.activities.forEach((item, index) => {
    out[SLOT_NAMES[1 + index]] = { type: "activity", value: item.title, title: item.title, kicker: `ADVENTURE ${index + 1}`, body: item.body };
  });
  content.map.places.forEach((item, index) => {
    out[SLOT_NAMES[4 + index]] = { type: "place", value: item.title, title: item.title, kicker: `ROUTE ${index + 1}`, body: item.body };
  });
  return out;
}

// ---------------------------------------------------------------------------
// Tiny painter for the default illustrations (used until a photo is chosen).
// ---------------------------------------------------------------------------
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}
function sky(g, w, h, top, bottom) {
  const gradient = g.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  g.fillStyle = gradient;
  g.fillRect(0, 0, w, h);
}
function cloud(g, x, y, s, color = "rgba(255,255,255,0.95)") {
  g.fillStyle = color;
  for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.15, 0.75], [-0.85, 0.2, 0.7], [0.35, -0.45, 0.75], [-0.35, -0.3, 0.6]]) {
    g.beginPath();
    g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    g.fill();
  }
}
function hill(g, w, h, y, amp, color, phase = 0) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / w * Math.PI * 1.6 + phase) * amp);
  g.lineTo(w, h);
  g.fill();
}
function blossom(g, x, y, r, petal, center = "#ffd86b") {
  g.fillStyle = petal;
  for (let k = 0; k < 5; k += 1) {
    const a = (k / 5) * Math.PI * 2;
    g.beginPath();
    g.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.5, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = center;
  g.beginPath();
  g.arc(x, y, r * 0.28, 0, Math.PI * 2);
  g.fill();
}
function meadow(g, w, h, top, count, seed) {
  const random = rng(seed);
  const colors = ["#ffffff", "#ffc3d9", "#ff9fc3", "#d7c4ff", "#fff0a8"];
  for (let i = 0; i < count; i += 1) {
    const y = top + random() * (h - top);
    const depth = (y - top) / (h - top);
    blossom(g, random() * w, y, 3 + depth * 9, colors[Math.floor(random() * colors.length)]);
  }
}
function tree(g, x, y, s, crown = "#ffc0d6") {
  g.fillStyle = "#b07a58";
  g.fillRect(x - s * 0.08, y - s * 0.6, s * 0.16, s * 0.6);
  cloud(g, x, y - s * 0.8, s * 0.42, crown);
}

const ILLUSTRATIONS = {
  activity0(g, w, h) { // picnic
    sky(g, w, h, "#9fd4ff", "#fde7f2");
    cloud(g, w * 0.25, h * 0.2, w * 0.07);
    cloud(g, w * 0.75, h * 0.14, w * 0.05);
    hill(g, w, h, h * 0.52, h * 0.04, "#b9e08c", 0.3);
    hill(g, w, h, h * 0.62, h * 0.03, "#9fd27a", 1.8);
    // checkered blanket in perspective
    const x0 = w * 0.18, x1 = w * 0.82, y0 = h * 0.64, y1 = h * 0.9;
    for (let i = 0; i < 6; i += 1) for (let j = 0; j < 4; j += 1) {
      const t0 = j / 4, t1 = (j + 1) / 4;
      const lerp = (t, a, b) => a + (b - a) * t;
      const left0 = lerp(t0, x0 + w * 0.08, x0), right0 = lerp(t0, x1 - w * 0.08, x1);
      const left1 = lerp(t1, x0 + w * 0.08, x0), right1 = lerp(t1, x1 - w * 0.08, x1);
      g.fillStyle = (i + j) % 2 ? "#ffffff" : "#f58fb4";
      g.beginPath();
      g.moveTo(lerp(i / 6, left0, right0), lerp(t0, y0, y1));
      g.lineTo(lerp((i + 1) / 6, left0, right0), lerp(t0, y0, y1));
      g.lineTo(lerp((i + 1) / 6, left1, right1), lerp(t1, y0, y1));
      g.lineTo(lerp(i / 6, left1, right1), lerp(t1, y0, y1));
      g.fill();
    }
    // basket
    g.fillStyle = "#c98f5a";
    g.beginPath();
    g.roundRect(w * 0.42, h * 0.62, w * 0.2, h * 0.12, 10);
    g.fill();
    g.strokeStyle = "#a8703f";
    g.lineWidth = w * 0.015;
    g.beginPath();
    g.arc(w * 0.52, h * 0.62, w * 0.08, Math.PI, 0);
    g.stroke();
    blossom(g, w * 0.3, h * 0.7, w * 0.03, "#ffffff");
    blossom(g, w * 0.7, h * 0.76, w * 0.03, "#ff9fc3");
    tree(g, w * 0.86, h * 0.56, w * 0.35);
  },
  activity1(g, w, h) { // flower picking
    sky(g, w, h, "#bfe3ff", "#fff0f6");
    cloud(g, w * 0.7, h * 0.18, w * 0.06);
    hill(g, w, h, h * 0.45, h * 0.05, "#bfe39a", 0.8);
    meadow(g, w, h, h * 0.45, 260, 7);
    // bouquet
    const cx = w * 0.5, cy = h * 0.52;
    g.fillStyle = "#6fb47d";
    for (let i = -3; i <= 3; i += 1) {
      g.save();
      g.translate(cx, cy + h * 0.28);
      g.rotate(i * 0.08);
      g.fillRect(-w * 0.006, -h * 0.28, w * 0.012, h * 0.28);
      g.restore();
    }
    const colors = ["#ff8fb8", "#ffffff", "#c9b2ff", "#ffc3d9", "#ff6f9f"];
    for (let i = 0; i < 13; i += 1) {
      const a = (i / 13) * Math.PI * 2;
      const r = i === 0 ? 0 : w * (0.05 + (i % 3) * 0.03);
      blossom(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, w * 0.05, colors[i % colors.length]);
    }
    g.fillStyle = "#f7b6cd";
    g.beginPath();
    g.moveTo(cx - w * 0.08, cy + h * 0.14);
    g.lineTo(cx + w * 0.08, cy + h * 0.14);
    g.lineTo(cx + w * 0.03, cy + h * 0.3);
    g.lineTo(cx - w * 0.03, cy + h * 0.3);
    g.fill();
  },
  activity2(g, w, h) { // cloud watching
    sky(g, w, h, "#7fc3ff", "#ffe3f0");
    cloud(g, w * 0.3, h * 0.22, w * 0.1);
    cloud(g, w * 0.72, h * 0.32, w * 0.08, "rgba(255,245,250,0.95)");
    cloud(g, w * 0.55, h * 0.12, w * 0.05);
    hill(g, w, h, h * 0.72, h * 0.06, "#a9d985", 0.2);
    meadow(g, w, h, h * 0.74, 90, 21);
  },
  place0(g, w, h) { // secret lake
    sky(g, w, h, "#a8d8ff", "#fdeef5");
    hill(g, w, h, h * 0.42, h * 0.08, "#c7b8ec", 1.2);
    hill(g, w, h, h * 0.5, h * 0.04, "#a8d98a", 2.4);
    g.fillStyle = "#7fcfe8";
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.7, w * 0.42, h * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.6)";
    g.fillRect(w * 0.3, h * 0.68, w * 0.14, h * 0.01);
    g.fillRect(w * 0.55, h * 0.73, w * 0.1, h * 0.01);
    tree(g, w * 0.16, h * 0.62, w * 0.3);
    tree(g, w * 0.84, h * 0.6, w * 0.26, "#d7c4ff");
    meadow(g, w, h, h * 0.84, 40, 4);
  },
  place1(g, w, h) { // flower hill
    sky(g, w, h, "#b6ddff", "#fff1f6");
    cloud(g, w * 0.25, h * 0.2, w * 0.06);
    g.fillStyle = "#b5de8e";
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.95, w * 0.7, h * 0.5, 0, Math.PI, 0);
    g.fill();
    meadow(g, w, h, h * 0.5, 220, 13);
    tree(g, w * 0.5, h * 0.5, w * 0.3);
  },
  place2(g, w, h) { // sky terrace
    sky(g, w, h, "#8fcbff", "#ffe6f1");
    cloud(g, w * 0.2, h * 0.75, w * 0.12);
    cloud(g, w * 0.8, h * 0.8, w * 0.12);
    cloud(g, w * 0.5, h * 0.9, w * 0.14);
    g.fillStyle = "#bdb1e3";
    g.beginPath();
    g.moveTo(w * 0.22, h * 0.52);
    g.lineTo(w * 0.78, h * 0.52);
    g.lineTo(w * 0.5, h * 0.8);
    g.fill();
    g.fillStyle = "#a9d985";
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.52, w * 0.28, h * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    tree(g, w * 0.5, h * 0.5, w * 0.26);
    meadow(g, w * 0.5, h * 0.56, h * 0.5, 16, 3);
  },
};

// ---------------------------------------------------------------------------
// Photos: loaded once, then the texture is redrawn.
// ---------------------------------------------------------------------------
const imageCache = new Map();
function loadImage(src, onReady) {
  if (!src) return null;
  const cached = imageCache.get(src);
  if (cached?.complete && cached.naturalWidth) return cached;
  if (!cached) {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => onReady();
    image.onerror = () => console.warn("A card picture could not be loaded:", src.slice(0, 80));
    image.src = src;
    imageCache.set(src, image);
  } else cached.addEventListener("load", onReady, { once: true });
  return null;
}
function coverImage(g, image, x, y, w, h) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale, sh = h / scale;
  g.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}
function picture(g, x, y, w, h, src, fallback, redraw) {
  g.save();
  g.translate(x, y);
  g.beginPath();
  g.rect(0, 0, w, h);
  g.clip();
  const image = loadImage(src, redraw);
  if (image) coverImage(g, image, 0, 0, w, h);
  else ILLUSTRATIONS[fallback](g, w, h);
  g.restore();
}

function fitText(g, text, maxWidth, size, weight, family) {
  let s = size;
  g.font = `${weight} ${s}px ${family}`;
  while (s > 12 && g.measureText(text).width > maxWidth) {
    s -= 2;
    g.font = `${weight} ${s}px ${family}`;
  }
  return s;
}
function paper(g, w, h, a = "#fff8ec", b = "#f6e6cf") {
  const gradient = g.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, a);
  gradient.addColorStop(1, b);
  g.fillStyle = gradient;
  g.fillRect(0, 0, w, h);
  const random = rng(5);
  g.fillStyle = "rgba(160,110,70,0.05)";
  for (let i = 0; i < 400; i += 1) g.fillRect(random() * w, random() * h, 2, 2);
}
function heart(g, x, y, s, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.4, y - s, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
  g.fill();
}

// ---------------------------------------------------------------------------
// Card painters.
// ---------------------------------------------------------------------------
// A heart badge on the chosen picture.
function chosenBadge(g, x, y) {
  g.save();
  g.shadowColor = "rgba(120, 30, 70, 0.35)";
  g.shadowBlur = 10;
  heart(g, x, y, 46, "#ffffff");
  g.restore();
  heart(g, x, y + 1, 38, "#ff6f9f");
}
function drawActivity(g, w, h, index, content, redraw, selections = {}) {
  const item = content.activities[index];
  g.fillStyle = "#fffdf8";
  g.fillRect(0, 0, w, h);
  const m = w * 0.07;
  picture(g, m, m, w - m * 2, h * 0.7, item.image, `activity${index}`, redraw);
  g.strokeStyle = "rgba(120,90,70,0.15)";
  g.lineWidth = 3;
  g.strokeRect(m, m, w - m * 2, h * 0.7);
  g.fillStyle = "#6f4859";
  g.textAlign = "center";
  g.textBaseline = "middle";
  fitText(g, item.title, w - m * 2, 92, "italic 600", SERIF);
  g.fillText(item.title, w / 2, h * 0.86);
  if (selections.activity === item.title) chosenBadge(g, w - m - 34, m + 36);
}

function drawPlace(g, w, h, index, content, redraw, selections = {}) {
  const item = content.map.places[index];
  g.fillStyle = "#f3e2c4";
  g.fillRect(0, 0, w, h);
  g.save();
  g.beginPath();
  g.arc(w / 2, h / 2, w * 0.44, 0, Math.PI * 2);
  g.clip();
  picture(g, w * 0.06, h * 0.06, w * 0.88, h * 0.88, item.image, `place${index}`, redraw);
  g.restore();
  g.strokeStyle = "#d8b06a";
  g.lineWidth = w * 0.04;
  g.beginPath();
  g.arc(w / 2, h / 2, w * 0.44, 0, Math.PI * 2);
  g.stroke();
  if (selections.place === item.title) chosenBadge(g, w * 0.8, h * 0.18);
}

// The calendar is carved into the big sakura's trunk: no paper, just cuts in
// the wood. Every mark is a dark groove with a pale lip below it, where the
// light catches the far edge of the cut; the chosen day is a carved heart
// stained pink.
const GROOVE = "rgba(58, 26, 12, 0.96)";
const LIP = "rgba(255, 238, 210, 0.7)";
function carve(g, mark, depth = 3) {
  g.save();
  g.translate(depth * 0.35, depth);
  mark(LIP);
  g.restore();
  mark(GROOVE);
}
function carvedText(g, text, x, y, depth) {
  carve(g, (color) => {
    // Filled and outlined, so the cut is wide enough to read from afar.
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineWidth = 2.5;
    g.lineJoin = "round";
    g.strokeText(text, x, y);
    g.fillText(text, x, y);
  }, depth);
}
function carvedLine(g, points, width, depth = 2) {
  carve(g, (color) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  }, depth);
}
function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.4, y - s, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
  g.closePath();
}
function carvedHeart(g, x, y, s, stain = null) {
  if (stain) {
    heartPath(g, x, y, s);
    g.fillStyle = stain;
    g.fill();
  }
  carve(g, (color) => {
    heartPath(g, x, y, s);
    g.strokeStyle = color;
    g.lineWidth = Math.max(3, s * 0.12);
    g.stroke();
  }, 2.5);
}
// The calendar's layout on its 768 x 1024 canvas, shared by the painter and
// by tapping (calendarTap).
const CAL = { side: 70, monthY: 322, arrowX: 150, cellTop: 466, cellH: 92 };
const pad2 = (n) => String(n).padStart(2, "0");
// The month on show: the one being browsed, else the chosen date's, else the default.
function calendarMonth(content, selections) {
  const [yearText, monthText] = (selections.viewMonth || selections.date || `${content.calendar.month}-01`).split("-");
  const year = Number(yearText) || new Date().getFullYear();
  const month = Math.min(12, Math.max(1, Number(monthText) || 1)) - 1;
  return { year, month };
}
function dayCell(w, year, month, day) {
  const cellW = (w - 2 * CAL.side) / 7;
  const index = weekColumn(new Date(year, month, 1)) + day - 1; // the week starts on Monday
  return { x: CAL.side + cellW / 2 + (index % 7) * cellW, y: CAL.cellTop + Math.floor(index / 7) * CAL.cellH, cellW };
}
// What a tap at canvas point (x, y) of the calendar means: a day
// ({ date: "YYYY-MM-DD" }), a month step ({ step: -1 | 1 }) or nothing.
export function calendarTap(content, selections, x, y, w = 768) {
  const { year, month } = calendarMonth(content, selections);
  if (Math.abs(y - CAL.monthY) < 42) {
    if (Math.abs(x - CAL.arrowX) < 60) return { step: -1 };
    if (Math.abs(x - (w - CAL.arrowX)) < 60) return { step: 1 };
  }
  const days = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= days; day += 1) {
    const cell = dayCell(w, year, month, day);
    if (Math.abs(x - cell.x) <= cell.cellW / 2 && Math.abs(y - cell.y) <= CAL.cellH / 2) {
      return { date: `${year}-${pad2(month + 1)}-${pad2(day)}` };
    }
  }
  return null;
}
// The month after (step 1) or before (step -1) the one on show, "YYYY-MM".
export function shiftMonth(content, selections, step) {
  const { year, month } = calendarMonth(content, selections);
  const next = new Date(year, month + step, 1);
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}`;
}
function drawCalendar(g, w, h, content, selections) {
  const { year, month } = calendarMonth(content, selections);
  const shown = `${year}-${pad2(month + 1)}`;
  const chosen = selections.date || `${content.calendar.month}-${pad2(content.calendar.day || 1)}`;
  const chosenDay = chosen.startsWith(shown) ? Number(chosen.split("-")[2]) : 0;
  const candidateDay = selections.candidate?.startsWith(shown) ? Number(selections.candidate.split("-")[2]) : 0;
  // A double carved border with rounded corners.
  const r = 46;
  carve(g, (color) => {
    g.strokeStyle = color;
    g.lineWidth = 7;
    g.beginPath();
    g.roundRect(34, 34, w - 68, h - 68, r);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(52, 52, w - 104, h - 104, r - 14);
    g.stroke();
  }, 3);
  g.textAlign = "center";
  g.textBaseline = "middle";
  fitText(g, content.calendar.title, w - 160, 80, "italic 700", SERIF);
  carvedText(g, content.calendar.title, w / 2, 128, 3.5);
  carvedHeart(g, w / 2, 190, 18);
  g.font = `700 66px ${SERIF}`;
  carvedText(g, String(year), w / 2, 254, 3.5);
  // The month between the arrows (fitted to the space it has).
  const monthName = MONTHS[month].toUpperCase();
  fitText(g, monthName, w - 2 * CAL.arrowX - 80, 36, "700", SANS);
  carvedText(g, monthName, w / 2, CAL.monthY, 2.5);
  // Carved arrows either side of the month, to browse the months.
  g.font = `700 64px ${SERIF}`;
  carvedText(g, "‹", CAL.arrowX, CAL.monthY - 4, 3);
  carvedText(g, "›", w - CAL.arrowX, CAL.monthY - 4, 3);
  g.font = `700 36px ${SANS}`;
  const cellW = (w - 2 * CAL.side) / 7;
  const left = CAL.side + cellW / 2;
  g.font = `700 27px ${SANS}`;
  WEEK_HEADINGS.forEach((day, i) => carvedText(g, day, left + i * cellW, 386, 2));
  carvedLine(g, [[74, 418], [w - 74, 418]], 3);
  const days = new Date(year, month + 1, 0).getDate();
  g.font = `700 36px ${SANS}`;
  for (let day = 1; day <= days; day += 1) {
    const { x, y } = dayCell(w, year, month, day);
    if (day === chosenDay) carvedHeart(g, x, y + 6, 44, "rgba(240, 112, 158, 0.82)");
    else if (day === candidateDay) {
      // The day being considered: a carved ring with a blush of pink.
      g.beginPath();
      g.arc(x, y + 2, 38, 0, Math.PI * 2);
      g.fillStyle = "rgba(255, 170, 200, 0.38)";
      g.fill();
      carve(g, (color) => {
        g.beginPath();
        g.arc(x, y + 2, 38, 0, Math.PI * 2);
        g.strokeStyle = color;
        g.lineWidth = 5;
        g.stroke();
      }, 2.5);
    }
    carvedText(g, String(day), x, y, 2.5);
  }
}

// The letter on the book's right page: the box it fills (it ends above the
// signature), and how it wraps at the size that fits.
const LETTER = { top: 225, bottom: 748, side: 80, size: 52, least: 34 };
function letterLayout(g, note, w, room = LETTER.bottom - LETTER.top) {
  let size = LETTER.size;
  let lines = [];
  for (;;) {
    g.font = `italic 500 ${size}px ${SERIF}`;
    lines = [];
    for (const paragraph of String(note).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const test = line ? `${line} ${word}` : word;
        if (line && g.measureText(test).width > w - 2 * LETTER.side) {
          lines.push(line);
          line = word;
        } else line = test;
      }
      lines.push(line);
    }
    while (lines.length > 1 && !lines[lines.length - 1]) lines.pop();
    if (lines.length * size * (70 / 52) <= room || size <= LETTER.least) break;
    size -= 2;
  }
  const step = size * (70 / 52);
  return { size, step, lines: lines.slice(0, Math.max(1, Math.floor(room / step))) };
}

// Your photo on the right page, as a polaroid at the top: its frame takes the
// photo's own shape (from the size its name carries), slightly tilted, with a
// bit of tape; the letter then starts below it.
const POLAROID = { top: 58, maxW: 360, maxH: 250, side: 18, bottom: 58, tilt: -0.045 };
function bookLayout(g, content, w) {
  let photo = null;
  let top = LETTER.top;
  if (content.book.photo) {
    const size = photoSize(content.book.photo) || { width: 4, height: 3 };
    const aspect = size.width / size.height;
    const innerW = Math.min(POLAROID.maxW, POLAROID.maxH * aspect);
    const inner = { w: innerW, h: innerW / aspect };
    const frameW = inner.w + POLAROID.side * 2;
    const frameH = inner.h + POLAROID.side + POLAROID.bottom;
    photo = { x: (w - frameW) / 2, y: POLAROID.top, w: frameW, h: frameH, inner };
    top = POLAROID.top + frameH + 34;
  }
  return { photo, top, letter: letterLayout(g, content.book.note, w, LETTER.bottom - top) };
}
function polaroid(g, frame, src, redraw) {
  const { x, y, w, h, inner } = frame;
  g.save();
  g.translate(x + w / 2, y + h / 2);
  g.rotate(POLAROID.tilt);
  g.translate(-w / 2, -h / 2);
  g.shadowColor = "rgba(90, 60, 50, 0.28)";
  g.shadowBlur = 18;
  g.shadowOffsetY = 8;
  g.fillStyle = "#fffefb";
  g.fillRect(0, 0, w, h);
  g.shadowColor = "transparent";
  g.save();
  g.beginPath();
  g.rect(POLAROID.side, POLAROID.side, inner.w, inner.h);
  g.clip();
  const image = loadImage(src, redraw);
  g.fillStyle = "#efe3d8"; // while it loads
  g.fillRect(POLAROID.side, POLAROID.side, inner.w, inner.h);
  if (image) coverImage(g, image, POLAROID.side, POLAROID.side, inner.w, inner.h);
  g.restore();
  g.strokeStyle = "rgba(120, 90, 70, 0.14)";
  g.lineWidth = 2;
  g.strokeRect(POLAROID.side, POLAROID.side, inner.w, inner.h);
  g.translate(w / 2, 0);
  g.rotate(0.07);
  g.fillStyle = "rgba(242, 155, 187, 0.6)";
  g.fillRect(-52, -17, 104, 34);
  g.restore();
}

function drawBook(g, w, h, side, content, selections, redraw) {
  paper(g, w, h, "#fffaf1", "#f8ecdb");
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (side === "left") {
    g.fillStyle = "#7a4a5c";
    fitText(g, content.book.title, w - 120, 96, "italic 600", SERIF);
    g.fillText(content.book.title, w / 2, 150);
    heart(g, w / 2, 222, 18, "#e889a8");
    const date = selections.date ? mediumDate(selections.date) : "";
    const rows = [["Adventure", selections.activity || ""], ["Date", date], ["Place", selections.place || ""]];
    rows.forEach(([label, value], i) => {
      const y = 360 + i * 170;
      g.textAlign = "left";
      g.fillStyle = "#8b6a58";
      g.font = `600 44px ${SERIF}`;
      g.fillText(label, 80, y);
      g.strokeStyle = "#caa98a";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(80, y + 70);
      g.lineTo(w - 80, y + 70);
      g.stroke();
      if (value) {
        g.fillStyle = "#c2527f";
        fitText(g, value, w - 180, 54, "italic 600", SERIF);
        g.fillText(value, 110, y + 42);
      }
    });
    g.textAlign = "center";
  } else {
    // Your photo (if any), then the love letter (its own line breaks kept),
    // smaller if it is long.
    const { photo, top, letter } = bookLayout(g, content, w);
    if (photo) polaroid(g, photo, content.book.photo, redraw);
    g.fillStyle = "#6f4859";
    g.font = `italic 500 ${letter.size}px ${SERIF}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    letter.lines.forEach((text, i) => g.fillText(text, w / 2, top + (i + 0.5) * letter.step));
    g.fillStyle = "#c2527f";
    g.font = `italic 600 56px ${SERIF}`;
    g.fillText(content.book.signature, w / 2, h - 230);
    [[0.3, 0.83, 22], [0.5, 0.88, 30], [0.7, 0.83, 22]].forEach(([x, y, s]) => heart(g, w * x, h * y, s, "#f29bbb"));
  }
}

// The ribbon over the bunnies' dance at the keepsake book: "It’s a date!",
// the place and the adventure, and the day (canvas 1024 x 384).
export function drawDateBanner(canvas, { activity = "", place = "", date = "" } = {}) {
  const g = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  g.clearRect(0, 0, w, h);
  // Swallow-tailed ends, tucked behind the band.
  for (const dir of [-1, 1]) {
    const inner = w / 2 + dir * (w / 2 - 170);
    const outer = w / 2 + dir * (w / 2 - 16);
    g.beginPath();
    g.moveTo(inner, 112);
    g.lineTo(outer, 112);
    g.lineTo(outer - dir * 62, 222);
    g.lineTo(outer, 332);
    g.lineTo(inner, 332);
    g.closePath();
    g.fillStyle = "#e9739f";
    g.fill();
    // The fold where the tail meets the band.
    g.beginPath();
    g.moveTo(w / 2 + dir * (w / 2 - 112), 300);
    g.lineTo(inner, 332);
    g.lineTo(inner, 300);
    g.closePath();
    g.fillStyle = "#c9527d";
    g.fill();
  }
  // The band.
  g.save();
  g.shadowColor = "rgba(150, 40, 80, 0.35)";
  g.shadowBlur = 18;
  g.shadowOffsetY = 6;
  const band = g.createLinearGradient(0, 56, 0, 304);
  band.addColorStop(0, "#ffb3cf");
  band.addColorStop(1, "#ff83ad");
  g.fillStyle = band;
  g.beginPath();
  g.roundRect(112, 56, w - 224, 248, 44);
  g.fill();
  g.restore();
  // Stitching just inside the edge.
  g.setLineDash([14, 10]);
  g.strokeStyle = "rgba(255, 255, 255, 0.75)";
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(128, 72, w - 256, 216, 34);
  g.stroke();
  g.setLineDash([]);
  // The words, with a soft pink shadow so they read on the ribbon.
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "rgba(160, 40, 90, 0.45)";
  g.shadowBlur = 6;
  g.shadowOffsetY = 2;
  g.fillStyle = "#ffffff";
  const title = "It’s a date!";
  fitText(g, title, w - 360, 84, "italic 600", SERIF);
  g.fillText(title, w / 2, 126);
  const span = g.measureText(title).width / 2;
  heart(g, w / 2 - span - 42, 130, 22, "#ffffff");
  heart(g, w / 2 + span + 42, 130, 22, "#ffffff");
  const plan = [place, activity].filter(Boolean).join(" · ");
  if (plan) {
    g.fillStyle = "#fff7fb";
    fitText(g, plan, w - 320, 52, "italic 600", SERIF);
    g.fillText(plan, w / 2, 198);
  }
  if (date) {
    const day = longDate(date, { weekday: true });
    g.fillStyle = "#fff0f6";
    fitText(g, day, w - 340, 38, "600", SANS);
    g.fillText(day, w / 2, 256);
  }
  g.shadowColor = "transparent";
}

// Where the editable words sit on a surface, in canvas pixels, worked out just
// as the painters above draw them, so they can be edited right where they
// show: what they say (a content path), the box, the font, the line height.
// (The book's left page shows the choices, so only its right page edits.)
export function slotTextRegions(slotName, content, g) {
  const index = SLOT_NAMES.indexOf(slotName);
  const w = 768;
  const h = slotName === "SLOT_01_Calendar" || slotName.startsWith("SLOT_08") || slotName.startsWith("SLOT_09") ? 1024 : 768;
  const line = (path, text, cx, cy, maxWidth, size, style, color) => {
    const fitted = fitText(g, text, maxWidth, size, style, SERIF);
    return { path, x: cx - maxWidth / 2, y: cy - fitted * 0.7, w: maxWidth, h: fitted * 1.4, font: `${style} ${fitted}px ${SERIF}`, lineHeight: fitted * 1.4, color };
  };
  if (index >= 1 && index <= 3) {
    const m = w * 0.07;
    return [line(`activities.${index - 1}.title`, content.activities[index - 1].title, w / 2, h * 0.86, w - m * 2, 92, "italic 600", "#6f4859")];
  }
  if (slotName === "SLOT_01_Calendar") return [line("calendar.title", content.calendar.title, w / 2, 128, w - 160, 80, "italic 700", "#3a1a0c")];
  if (slotName === "SLOT_09_Book_Right") {
    const { top, letter } = bookLayout(g, content, w);
    return [
      {
        path: "book.note", multiline: true, wrap: true, x: LETTER.side, y: top, w: w - 2 * LETTER.side,
        h: Math.max(letter.lines.length, 1) * letter.step, font: `italic 500 ${letter.size}px ${SERIF}`, lineHeight: letter.step, color: "#6f4859",
      },
      line("book.signature", content.book.signature, w / 2, h - 230, w - 160, 56, "italic 600", "#c2527f"),
    ];
  }
  return [];
}

// Edit mode: where each picture is (canvas pixels), to put a photo of your
// own there: the boards' pictures, and the book's polaroid (or, without one,
// the space above the letter where it would go).
export function slotPhotoRegions(slotName, content, g) {
  const index = SLOT_NAMES.indexOf(slotName);
  const w = 768;
  if (index >= 1 && index <= 3) {
    const m = w * 0.07;
    return [{ path: `activities.${index - 1}.image`, x: m, y: m, w: w - m * 2, h: 768 * 0.7, has: Boolean(content.activities[index - 1].image) }];
  }
  if (index >= 4 && index <= 6) {
    return [{ path: `map.places.${index - 4}.image`, x: w * 0.06, y: 768 * 0.06, w: w * 0.88, h: 768 * 0.88, has: Boolean(content.map.places[index - 4].image) }];
  }
  if (slotName === "SLOT_09_Book_Right") {
    const { photo } = bookLayout(g, content, w);
    return [photo ? { path: "book.photo", x: photo.x, y: photo.y, w: photo.w, h: photo.h, has: true } : { path: "book.photo", x: w / 2 - 190, y: 52, w: 380, h: 150, has: false }];
  }
  return [];
}

// A texture per surface that can be redrawn when content or choices change.
export function createSlotTexture(slotName) {
  const portrait = slotName === "SLOT_01_Calendar" || slotName.startsWith("SLOT_08") || slotName.startsWith("SLOT_09");
  const canvas = document.createElement("canvas");
  canvas.width = portrait ? 768 : 768;
  canvas.height = portrait ? 1024 : 768;
  const g = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.flipY = false;
  let last = null;
  function draw(content = last?.content, selections = last?.selections || {}) {
    if (!content) return;
    last = { content, selections };
    const w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    const redraw = () => draw();
    const index = SLOT_NAMES.indexOf(slotName);
    if (slotName === "SLOT_01_Calendar") drawCalendar(g, w, h, content, selections);
    else if (index >= 1 && index <= 3) drawActivity(g, w, h, index - 1, content, redraw, selections);
    else if (index >= 4 && index <= 6) drawPlace(g, w, h, index - 4, content, redraw, selections);
    else drawBook(g, w, h, slotName.startsWith("SLOT_08") ? "left" : "right", content, selections, redraw);
    texture.needsUpdate = true;
  }
  return { texture, draw };
}
