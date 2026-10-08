export interface TrainingSession {
  id: string; title: string; startsAt: string; endsAt: string; status: string;
  timesOnly?: boolean; location?: string | null; timezone?: string | null;
}

export const validTimezone = (zone?: string | null) => {
  try { if (zone) { new Intl.DateTimeFormat('en', { timeZone: zone }); return zone; } } catch { /* Use the viewer's zone when absent or invalid. */ }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};
export const dayDate = (day: string) => new Date(`${day}T12:00:00Z`);
export const addDays = (day: string, amount: number) => {
  const date = dayDate(day); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10);
};
export const weekStart = (day: string) => addDays(day, -((dayDate(day).getUTCDay() + 6) % 7));

/** Offset timestamps are instants. Legacy club events without offsets are already local wall times. */
export function calendarTime(value: string, zone: string) {
  if (!/Z$|[+-]\d{2}:\d{2}$/i.test(value)) {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);
    if (match) return { day: match[1], minute: Number(match[2]) * 60 + Number(match[3]) };
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}
export const clockTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export interface TrainingBlock { session: TrainingSession; day: string; start: number; end: number; lane: number; lanes: number }

export function trainingBlocks(sessions: TrainingSession[], zone: string): TrainingBlock[] {
  const blocks: TrainingBlock[] = [];
  for (const session of sessions) {
    const start = calendarTime(session.startsAt, zone), end = calendarTime(session.endsAt, zone);
    if (!start || !end || end.day < start.day || end.day === start.day && end.minute <= start.minute) continue;
    // Split midnight crossings without letting malformed multi-day data create an unbounded grid.
    for (let day = start.day, count = 0; day <= end.day && count < 8; day = addDays(day, 1), count++) {
      const from = day === start.day ? start.minute : 0, to = day === end.day ? end.minute : 1440;
      if (to > from) blocks.push({ session, day, start: from, end: to, lane: 0, lanes: 1 });
    }
  }
  for (const day of new Set(blocks.map(b => b.day))) {
    const ordered = blocks.filter(b => b.day === day).sort((a, b) => a.start - b.start || a.end - b.end);
    let group: TrainingBlock[] = [], groupEnd = -1, laneEnds: number[] = [];
    const finish = () => group.forEach(block => { block.lanes = laneEnds.length; });
    for (const block of ordered) {
      if (block.start >= groupEnd) { finish(); group = []; laneEnds = []; }
      let lane = laneEnds.findIndex(end => end <= block.start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = block.end; block.lane = lane; group.push(block); groupEnd = Math.max(...laneEnds);
    }
    finish();
  }
  return blocks;
}
