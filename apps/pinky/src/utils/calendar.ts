import { Invitation } from '../types';

/**
 * Converts a date string to Google Calendar format (YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS)
 */
export function formatToGoogleCalendarDate(isoDateStr: string): string {
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    return fallback.toISOString().replace(/-|:|\.\d+/g, '');
  }
  return d.toISOString().replace(/-|:|\.\d+/g, '');
}

/**
 * Generates the official Google Calendar 1-click Web Sync URL
 */
export function generateGoogleCalendarUrl(invitation: Invitation): string {
  const startDate = new Date(invitation.date);
  let endDate = invitation.endDate ? new Date(invitation.endDate) : new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // default 3 hours

  const startFormatted = formatToGoogleCalendarDate(startDate.toISOString());
  const endFormatted = formatToGoogleCalendarDate(endDate.toISOString());

  const title = encodeURIComponent(`Date with ${invitation.hostName}: ${invitation.title}`);
  
  let detailsText = `${invitation.description}\n\n`;
  detailsText += `✨ Host: ${invitation.hostName}\n`;
  if (invitation.dressCode) {
    detailsText += `👗 Attire: ${invitation.dressCode}\n`;
  }
  if (invitation.itinerary && invitation.itinerary.length > 0) {
    detailsText += `\n📅 Itinerary:\n`;
    invitation.itinerary.forEach((item) => {
      detailsText += `• ${item.time} - ${item.activity}${item.detail ? ` (${item.detail})` : ''}\n`;
    });
  }
  detailsText += `\n💌 Created via Date Invitation RSVP`;

  const details = encodeURIComponent(detailsText);
  const location = encodeURIComponent(invitation.location || '');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startFormatted}/${endFormatted}&details=${details}&location=${location}`;
}

/**
 * Generates and downloads a universal .ics iCalendar file for Apple Calendar / Outlook / native devices
 */
export function downloadICalendarFile(invitation: Invitation): void {
  const startDate = new Date(invitation.date);
  const endDate = invitation.endDate ? new Date(invitation.endDate) : new Date(startDate.getTime() + 3 * 60 * 60 * 1000);

  const startFormatted = formatToGoogleCalendarDate(startDate.toISOString());
  const endFormatted = formatToGoogleCalendarDate(endDate.toISOString());
  const nowFormatted = formatToGoogleCalendarDate(new Date().toISOString());

  const summary = `Date with ${invitation.hostName}: ${invitation.title}`;
  const description = `${invitation.description}\\nLocation: ${invitation.location}${invitation.dressCode ? `\\nAttire: ${invitation.dressCode}` : ''}`;
  const uid = `${invitation.id}-${Date.now()}@dateinvitation.app`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Date Invitation App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowFormatted}`,
    `DTSTART:${startFormatted}`,
    `DTEND:${endFormatted}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${invitation.location}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${invitation.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
