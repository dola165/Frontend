export function localStamp(iso: string, zone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const p = (type: string) => parts.find(x => x.type === type)?.value;
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`;
}

export function reservationIssue(booking: { status: string; format: string; startsAt: string; endsAt: string; allocations?: { startsAt: string; endsAt: string }[] }, match: { startsAt: string; endsAt: string; timezone: string; format: string }) {
  if (booking.status !== 'CONFIRMED') return booking.status.toLowerCase().replaceAll('_', ' ');
  if (booking.format !== 'OTHER' && match.format !== 'OTHER' && booking.format !== match.format) return 'different playing format';
  try {
    const start = match.startsAt || localStamp(booking.startsAt, match.timezone);
    const end = match.endsAt || localStamp(booking.endsAt, match.timezone);
    if (start < localStamp(booking.startsAt, match.timezone) || end > localStamp(booking.endsAt, match.timezone)) return 'does not cover the full match';
    if (booking.allocations?.some(a => localStamp(a.startsAt, match.timezone) < end && localStamp(a.endsAt, match.timezone) > start)) return 'already assigned to an overlapping match';
    return '';
  } catch { return 'choose a valid timezone first'; }
}

/** Preserve entered wall-clock times and their zone; use the rental zone for a blank draft. */
export function reservationTiming(booking: { startsAt: string; endsAt: string; timezone: string }, match: { startsAt: string; endsAt: string; timezone: string }) {
  const timezone = match.startsAt || match.endsAt ? match.timezone : booking.timezone;
  return { timezone, startsAt: match.startsAt || localStamp(booking.startsAt, timezone), endsAt: match.endsAt || localStamp(booking.endsAt, timezone) };
}
