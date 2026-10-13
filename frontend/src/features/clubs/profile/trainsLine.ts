import { formatDate } from '../../../utils/formatting';
import { timeLabel } from '../../clubWorkspace/fixtures';
import type { TrainingSession } from '../trainingCalendar';

/** "Wed & Fri 10:00–11:30", or "Wed 10:00 · Fri 18:00" when the days differ, from the next weeks' sessions. */
export function trainsLine(sessions: TrainingSession[]) {
    const slots = new Map<string, { day: string; time: string; order: number }>();
    for (const s of sessions) {
        const day = formatDate(s.startsAt, { weekday: 'short' }), time = `${timeLabel(s.startsAt, s.timezone)}–${timeLabel(s.endsAt, s.timezone)}`;
        slots.set(`${day} ${time}`, { day, time, order: (new Date(s.startsAt).getDay() + 6) % 7 });
    }
    const list = [...slots.values()].sort((a, b) => a.order - b.order || a.time.localeCompare(b.time));
    if (!list.length) return null;
    const oneTime = list.every(s => s.time === list[0].time);
    const days = [...new Set(list.map(s => s.day))];
    return oneTime ? `${days.length > 1 ? `${days.slice(0, -1).join(', ')} & ${days.at(-1)}` : days[0]} ${list[0].time}` : list.map(s => `${s.day} ${s.time}`).join(' · ');
}
