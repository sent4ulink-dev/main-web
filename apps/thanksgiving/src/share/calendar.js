// "Add to calendar" (an .ics file for the day, starting when the doors open) and "Directions" (a maps search).

function parseTime(t) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?$/i.exec(String(t).trim());
  if (!m) return [14, 0];
  let h = +m[1] % 12; if (m[3].toLowerCase() === 'p') h += 12;
  return [h, +(m[2] || 0)];
}
const pad = (n) => String(n).padStart(2, '0');
const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

export function downloadICS(content) {
  const [y, mo, d] = content.date.iso.split('-').map(Number);
  const [h, mi] = parseTime(content.date.time);
  const start = `${y}${pad(mo)}${pad(d)}T${pad(h)}${pad(mi)}00`;
  const endH = Math.min(23, h + 6);
  const end = `${y}${pad(mo)}${pad(d)}T${pad(endH)}${pad(mi)}00`;
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//sent4u//Thanksgiving//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:thanksgiving-${start}@sent4u.link`, `DTSTAMP:${now}`, `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${icsText(`Thanksgiving with ${content.family}`)}`,
    `LOCATION:${icsText(`${content.place.name}, ${content.place.address}`)}`,
    `DESCRIPTION:${icsText(`Doors open ${content.date.time}, dinner at ${content.date.dinner}. ${content.place.note}`)}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Thanksgiving tomorrow!', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'thanksgiving.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export const mapsURL = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
