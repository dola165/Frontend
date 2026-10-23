import type { ReactNode } from 'react';
import { List, Panel } from '../../../design/primitives';
import './schedule-board.css';

/** One day of an agenda: its key (yyyy-mm-dd), heading and rows. */
export interface AgendaDay { key: string; title: ReactNode; label: string; today?: boolean; rows: ReactNode }

/**
 * The agenda look, day by day: a heading per day, then that day's rows in one quiet panel. Days with nothing
 * are simply not passed in. The schedule and Team work both use it.
 */
export function AgendaDays({ days, className }: { days: AgendaDay[]; className?: string }) {
    return <div className={`gk-board__agenda${className ? ` ${className}` : ''}`}>{days.map(day =>
        <section key={day.key} className="gk-board__day" aria-label={day.label} data-day={day.key}>
            <h4 className="gk-board__day-title" data-today={day.today || undefined}>{day.title}</h4>
            <Panel flush><List label={day.label}>{day.rows}</List></Panel>
        </section>)}</div>;
}
