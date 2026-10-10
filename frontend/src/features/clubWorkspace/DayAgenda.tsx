import type { ReactNode } from 'react';
import { FixtureRow, List, type FixtureTone } from '../../design/primitives';
import type { ScheduleEventType } from '../schedule/api';
import { formatDate } from '../../utils/formatting';
import { dayLabel, timeLabel } from './fixtures';
import './day-agenda.css';

export interface DayAgendaItem {
    key: string; startsAt: string; title: string; meta?: string; tone: FixtureTone; trail?: ReactNode; onClick?: () => void; label?: string;
    /** Entries of the same kind at the same minute merge into one row that names their squads. */
    kind?: ScheduleEventType; squad?: string;
}

const plural: Record<ScheduleEventType, string> = { TRAINING: 'training sessions', MATCH: 'matches', FRIENDLY: 'friendlies', TRYOUT: 'trials', ACTIVITY: 'club events' };

/**
 * Upcoming entries read like a calendar: a date block for each day, then that day's entries,
 * each led by what it is. Four friendlies at 11:00 are one line naming their squads.
 */
export function DayAgenda({ items, label, limit = 5 }: { items: DayAgendaItem[]; label: string; limit?: number }) {
    const rows: (DayAgendaItem & { count: number; squads: string[] })[] = [];
    for (const item of items) {
        const same = item.kind && rows.find(row => row.kind === item.kind && row.startsAt.slice(0, 16) === item.startsAt.slice(0, 16));
        if (same) { same.count += 1; if (item.squad) same.squads.push(item.squad); continue; }
        rows.push({ ...item, count: 1, squads: item.squad ? [item.squad] : [] });
    }
    const days: { day: string; date: Date; rows: typeof rows }[] = [];
    for (const row of rows.slice(0, limit)) {
        const day = dayLabel(row.startsAt);
        const last = days[days.length - 1];
        if (last?.day === day) last.rows.push(row); else days.push({ day, date: new Date(row.startsAt), rows: [row] });
    }
    return <div className="cw-day-agenda">{days.map(({ day, date, rows: dayRows }) => <div key={day} className="cw-day-agenda__day">
        {/* "Today" and "Tomorrow" sit above the date; other days show only the date. */}
        <div className="cw-day-agenda__date" aria-hidden="true">
            {!/\d/.test(day) && <span className="cw-day-agenda__near">{day}</span>}
            <span className="cw-day-agenda__num">{date.getDate()}</span>
            <span className="cw-day-agenda__weekday">{formatDate(date, { weekday: 'short' })}</span>
        </div>
        <List label={`${label}, ${day}`}>{dayRows.map(row => row.count > 1
            ? <FixtureRow key={row.key} tone={row.tone} time={timeLabel(row.startsAt)} title={`${row.count} ${plural[row.kind!]}`} meta={row.squads.join(', ')} trail={row.trail}
                onClick={row.onClick} label={`${row.count} ${plural[row.kind!]} at ${timeLabel(row.startsAt)}`} />
            : <FixtureRow key={row.key} tone={row.tone} time={timeLabel(row.startsAt)} title={row.title} meta={row.meta} trail={row.trail} onClick={row.onClick} label={row.label} />)}</List>
    </div>)}</div>;
}
