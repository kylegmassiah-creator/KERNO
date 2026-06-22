// Helpers for deciding whether an event is upcoming or has moved to results.
//
// Rules agreed with the committee:
//   1. If the event has a startTime, the event moves to "Results" once that
//      start time has passed on the event date.
//   2. If the event has no startTime, it moves to "Results" at 8:00pm on the
//      event date.
//
// This keeps the listing accurate the moment an event has actually started,
// rather than waiting for the calendar day to flip over.

/** Parses a free-form startTime string like "7:00pm", "10:30am", "18:30",
 *  "18:30pm", "7pm", "10.30am" into { hours, minutes }. Returns null if
 *  the string is empty or unparseable. */
export function parseStartTime(raw: unknown): { hours: number; minutes: number } | null {
  if (typeof raw !== 'string') return null;
  const s = raw.toLowerCase().trim();
  if (!s) return null;
  const ampm = s.includes('am') ? 'am' : s.includes('pm') ? 'pm' : null;
  const stripped = s.replace(/(am|pm)/g, '').replace(/\./g, ':').trim();
  const [hStr, mStr] = stripped.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return null;
  const m = mStr ? parseInt(mStr, 10) : 0;
  let hours = h;
  // Only adjust for am/pm if the hour is in the 12-hour range. If someone
  // writes "18:30pm" we treat the 18 as already 24-hour and ignore the pm.
  if (h < 13) {
    if (ampm === 'pm' && h < 12) hours = h + 12;
    if (ampm === 'am' && h === 12) hours = 0;
  }
  return { hours, minutes: isNaN(m) ? 0 : m };
}

/** UK timezone offset in minutes from UTC at a given moment. Positive when
 *  UK is ahead of UTC (BST = +60). Returns 0 for GMT. */
function ukOffsetMinutes(date: Date): number {
  const utc = date.getTime();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const o: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') o[p.type] = p.value;
  const ukAsIfUTC = Date.UTC(+o.year, +o.month - 1, +o.day,
                             +o.hour === 24 ? 0 : +o.hour,
                             +o.minute, +o.second);
  return Math.round((ukAsIfUTC - utc) / 60000);
}

/** Returns the precise moment an event moves from "upcoming" to "results".
 *  Interprets startTime (or the 8pm fallback) as UK local time so the
 *  transition fires at the right wall-clock moment in the UK regardless of
 *  the build server's timezone. */
export function eventTransitionTime(event: { date: Date; startTime?: string }): Date {
  const d = new Date(event.date);
  const t = parseStartTime(event.startTime);
  const hours = t ? t.hours : 20; // 8pm fallback
  const minutes = t ? t.minutes : 0;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  // Build the UK wall-clock time as if it were UTC, then subtract the
  // UK offset to find the real UTC instant.
  const guess = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
  const offsetMin = ukOffsetMinutes(guess);
  return new Date(guess.getTime() - offsetMin * 60000);
}

/** True if the event's transition time is in the past relative to `now`. */
export function isEventPast(event: { date: Date; startTime?: string }, now: Date = new Date()): boolean {
  return now >= eventTransitionTime(event);
}

/** True if the event hasn't yet reached its transition time. */
export function isEventUpcoming(event: { date: Date; startTime?: string }, now: Date = new Date()): boolean {
  return !isEventPast(event, now);
}
