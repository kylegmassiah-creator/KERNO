// iCalendar feed of all KERNO events (upcoming + past).
// Built once per deploy; users can subscribe to it in Google Calendar, Apple
// Calendar, Outlook etc. The file rebuilds automatically every time Netlify
// rebuilds (cron, CMS publish, git push).
//
// URL when deployed:  https://cornwallorienteering.org.uk/events.ics

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Format a Date for iCalendar - YYYYMMDDTHHMMSSZ in UTC. */
function fmtIcsDate(d: Date): string {
  return d.getUTCFullYear().toString()
    + pad(d.getUTCMonth() + 1)
    + pad(d.getUTCDate())
    + 'T'
    + pad(d.getUTCHours())
    + pad(d.getUTCMinutes())
    + pad(d.getUTCSeconds())
    + 'Z';
}

/** Parse a "7:00pm" / "10:30am" string and apply it to the given date. */
function withDisplayTime(date: Date, displayTime?: string): Date {
  if (!displayTime) return date;
  const m = displayTime.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return date;
  let hours = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3] === 'pm' && hours < 12) hours += 12;
  if (m[3] === 'am' && hours === 12) hours = 0;
  const d = new Date(date);
  d.setHours(hours, mins, 0, 0);
  return d;
}

/** Escape iCal text per RFC 5545 - comma, semicolon, backslash, newline. */
function ics(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export const GET: APIRoute = async ({ site }) => {
  // Hidden events are excluded from the calendar feed entirely; cancelled
  // ones stay (with a [CANCELLED] prefix) so subscribed calendars can mark
  // them as cancelled rather than silently disappearing the entry.
  const events = (await getCollection('events')).filter(e => !e.data.hidden);
  const baseUrl = site?.toString().replace(/\/$/, '') ?? 'https://cornwallorienteering.org.uk';
  const generated = fmtIcsDate(new Date());

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cornwall Orienteering Club//KERNO Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Cornwall Orienteering Club',
    'X-WR-CALDESC:Upcoming and past Cornwall Orienteering Club events',
    'X-WR-TIMEZONE:Europe/London',
  ];

  for (const event of events) {
    const start = withDisplayTime(event.data.date, event.data.startTime);
    // Default duration: 90 min for Street-O, 3 hours for everything else
    const durationMinutes = event.data.duration
      ?? (event.data.format?.toLowerCase().includes('street') ? 90 : 180);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const eventUrl = `${baseUrl}/events/${event.id}`;
    const description = [
      event.data.summary,
      event.data.description ?? '',
      event.data.entryFee ? `Entry: ${event.data.entryFee}` : '',
      event.data.siEntriesUrl ? `Entries: ${event.data.siEntriesUrl}` : '',
      `Full details: ${eventUrl}`,
    ].filter(Boolean).join('\n');

    const summary = event.data.cancelled
      ? `[CANCELLED] ${event.data.title}`
      : event.data.title;

    const location = [event.data.venue, event.data.location, event.data.postcode]
      .filter(Boolean).join(', ');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@cornwallorienteering.org.uk`,
      `DTSTAMP:${generated}`,
      `DTSTART:${fmtIcsDate(start)}`,
      `DTEND:${fmtIcsDate(end)}`,
      `SUMMARY:${ics(summary)}`,
      `DESCRIPTION:${ics(description)}`,
      `LOCATION:${ics(location)}`,
      `URL:${eventUrl}`,
    );
    if (event.data.coords) {
      lines.push(`GEO:${event.data.coords.lat};${event.data.coords.lng}`);
    }
    if (event.data.cancelled) {
      lines.push('STATUS:CANCELLED');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="kerno-events.ics"',
    },
  });
};
