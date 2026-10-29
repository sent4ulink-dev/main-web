// Dates in English: "October 23, 2026", or with the weekday "Friday, October 23, 2026".
// The calendar's week starts on Monday.

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
// By Date.getDay() (Sunday first).
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// The calendar's columns, Monday first.
export const WEEK_HEADINGS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// The column a date falls in, Monday first (0..6).
export const weekColumn = (date) => (date.getDay() + 6) % 7;

const parts = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return { y, m, d, date: new Date(y, m - 1, d, 12) };
};

// "October 23, 2026" (and "Friday, October 23, 2026" with the weekday).
export function longDate(iso, { weekday = false } = {}) {
  const { y, m, d, date } = parts(iso);
  if (!y || !m || !d) return "";
  return `${weekday ? `${WEEKDAYS[date.getDay()]}, ` : ""}${MONTHS[m - 1]} ${d}, ${y}`;
}

// "Oct 23, 2026".
export function mediumDate(iso) {
  const { y, m, d } = parts(iso);
  if (!y || !m || !d) return "";
  return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
}

// "a", "a and b", "a, b and c".
export function listing(items) {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
