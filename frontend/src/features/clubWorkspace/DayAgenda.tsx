import type { CSSProperties, ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import type { ScheduleEventType } from '../schedule/api';
import { activityColors, activityIcons, activityLegend } from '../schedule/activityIcons';

const tint = (color?: string) => (color ? { '--activity': color } : undefined) as CSSProperties | undefined;
import { formatDate } from '../../utils/formatting';
import { dayLabel, timeLabel } from './fixtures';
import './day-agenda.css';

export interface DayAgendaItem {
    key: string; startsAt: string; title: string; meta?: string; onClick?: () => void; label?: string;
    /** What the entry is: picks its symbol and the line under the title. */
    kind?: ScheduleEventType; kindLabel?: string;
    /** Something to notice (in progress, a clash). An entry with a status never merges with others. */
    status?: ReactNode;
    squad?: string;
    /** Small actions beside the entry (cancel, add the result). Shown only while the entry stands alone, never on a merged one. */
    actions?: ReactNode;
}

const plural: Record<ScheduleEventType, string> = { TRAINING: 'training sessions', MATCH: 'matches', FRIENDLY: 'friendlies', TRYOUT: 'trials', ACTIVITY: 'club events' };

/** Entries of one kind at the same minute become one entry naming their squads. */
function merged(items: DayAgendaItem[]) {
    const rows: (DayAgendaItem & { count: number; squads: string[] })[] = [];
    for (const item of items) {
        const same = item.kind && !item.status && rows.find(row => row.kind === item.kind && !row.status && row.startsAt.slice(0, 16) === item.startsAt.slice(0, 16));
        if (same) { same.count += 1; if (item.squad) same.squads.push(item.squad); continue; }
        rows.push({ ...item, count: 1, squads: item.squad ? [item.squad] : [] });
    }
    return rows;
}

/**
 * Upcoming entries by day: a day heading, then each entry as its time, its symbol and three short lines
 * (what, which kind, who). Four friendlies at 11:00 are one entry naming their squads.
 */
export function DayAgenda({ items, label, limit = 5 }: { items: DayAgendaItem[]; label: string; limit?: number }) {
    const rows = merged(items);
    const days: { day: string; date: Date; rows: typeof rows }[] = [];
    for (const row of rows.slice(0, limit)) {
        const day = dayLabel(row.startsAt);
        const last = days[days.length - 1];
        if (last?.day === day) last.rows.push(row); else days.push({ day, date: new Date(row.startsAt), rows: [row] });
    }
    return <div className="cw-agenda">{days.map(({ day, date, rows: dayRows }) => <section key={day} className="cw-agenda__day" aria-label={`${label}, ${day}`}>
        <h3 className="cw-agenda__dayhead">
            <span className="cw-agenda__num">{date.getDate()}</span>
            <span className="cw-agenda__weekday">{formatDate(date, { weekday: 'short' })}</span>
            {/* "Today" and "Tomorrow" are named; other days show only the date. */}
            {!/\d/.test(day) && <span className="cw-agenda__near">{day}</span>}
        </h3>
        <ul className="cw-agenda__list">{dayRows.map(row => {
            const Icon = row.kind ? activityIcons[row.kind] : CalendarDays;
            const merged = row.count > 1;
            const title = merged ? `${row.count} ${plural[row.kind!]}` : row.title;
            const meta = merged ? row.squads.join(', ') : row.meta;
            const body = <>
                <span className="cw-agenda__time">{timeLabel(row.startsAt)}</span>
                <span className="cw-agenda__icon" style={tint(row.kind && activityColors[row.kind])} aria-hidden="true"><Icon /></span>
                <span className="cw-agenda__text">
                    <span className="cw-agenda__title">{title}</span>
                    {row.kindLabel && <span className="cw-agenda__kind">{row.kindLabel}</span>}
                    {meta && <span className="cw-agenda__meta">{meta}</span>}
                </span>
                {row.status && <span className="cw-agenda__status">{row.status}</span>}
            </>;
            return <li key={row.key} className="cw-agenda__item">{row.onClick
                ? <button type="button" className="cw-agenda__row" onClick={row.onClick} aria-label={merged ? `${title} at ${timeLabel(row.startsAt)}` : row.label}>{body}</button>
                : <div className="cw-agenda__row">{body}</div>}
                {!merged && row.actions && <span className="cw-agenda__actions">{row.actions}</span>}</li>;
        })}</ul>
    </section>)}</div>;
}

/** The activity symbols with their meaning, so people learn them once. */
export function ActivityLegend() {
    return <section className="cw-legend" aria-label="Activity symbols">
        <p className="cw-legend__head"><strong>Activity symbols</strong><span>What the icons in schedules mean</span></p>
        <ul className="cw-legend__items">{activityLegend.map(({ icon: Icon, name, meaning, color }) => <li key={name}>
            <span className="cw-legend__icon" style={tint(color)} aria-hidden="true"><Icon /></span><span><strong>{name}</strong><span>{meaning}</span></span>
        </li>)}</ul>
    </section>;
}
