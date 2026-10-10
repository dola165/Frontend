import './calendar.css';
import type { CSSProperties, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { Button } from '../primitives';
import { Segmented } from '../Tabs';
import { formatDate } from '../../utils/formatting';
import { addDays, monthGrid, sameDay, weekDays } from './calendarDates';

/** Something on the calendar: when, what, its colour (an activity colour token) and symbol. */
export interface CalendarEvent { key: string; start: Date; end: Date; title: string; color: string; icon?: LucideIcon; cancelled?: boolean; note?: ReactNode }
export type CalendarView = 'month' | 'week';

const HOUR = 44;
const time = (date: Date) => formatDate(date, { hour: '2-digit', minute: '2-digit' });
const tint = (color: string) => ({ '--event': color }) as CSSProperties;

/**
 * A real calendar: a month of days or a week of hours, with today marked and each event in its activity
 * colour. Picking an event selects it (the page shows its details beside the calendar); picking a day in the
 * month opens that week. The page keeps view, date and selection in the URL.
 */
export function EventCalendar({ events, view, date, selected, onSelect, onNavigate, onView, label, now = new Date() }: {
    events: CalendarEvent[]; view: CalendarView; date: Date; selected?: string | null; onSelect: (event: CalendarEvent) => void;
    onNavigate: (date: Date) => void; onView: (view: CalendarView) => void; label: string; now?: Date;
}) {
    const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
    const on = (day: Date) => sorted.filter(event => sameDay(event.start, day));
    const shift = (direction: number) => onNavigate(view === 'month' ? new Date(date.getFullYear(), date.getMonth() + direction, 1) : addDays(date, 7 * direction));
    const week = weekDays(date);
    const title = view === 'month' ? formatDate(date, { month: 'long', year: 'numeric' })
        : `${formatDate(week[0], { day: 'numeric', month: 'short' })} – ${formatDate(week[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const chip = (event: CalendarEvent, compact = false) => {
        const Icon = event.icon;
        return <button key={event.key} type="button" className="gk-cal__event" data-compact={compact || undefined} aria-pressed={selected === event.key} data-cancelled={event.cancelled || undefined}
            style={tint(event.color)} onClick={() => onSelect(event)} title={`${time(event.start)} ${event.title}`}>
            {Icon && <Icon aria-hidden="true" />}<span className="gk-cal__event-time">{time(event.start)}</span><span className="gk-cal__event-title">{event.title}</span>{!compact && event.note}
        </button>;
    };

    return <section className="gk-cal" aria-label={label}>
        <div className="gk-cal__bar">
            <div className="gk-cal__nav">
                <Button iconOnly variant="ghost" aria-label={view === 'month' ? 'Previous month' : 'Previous week'} onClick={() => shift(-1)}><ChevronLeft aria-hidden="true" /></Button>
                <Button size="sm" onClick={() => onNavigate(now)}>Today</Button>
                <Button iconOnly variant="ghost" aria-label={view === 'month' ? 'Next month' : 'Next week'} onClick={() => shift(1)}><ChevronRight aria-hidden="true" /></Button>
                <h2 className="gk-cal__title" aria-live="polite">{title}</h2>
            </div>
            <Segmented label="Calendar view" value={view} onChange={onView} items={[{ id: 'month', label: 'Month' }, { id: 'week', label: 'Week' }]} />
        </div>
        {view === 'month'
            ? <><div className="gk-cal__weekdays" aria-hidden="true">{week.map(day => <span key={day.toISOString()}>{formatDate(day, { weekday: 'short' })}</span>)}</div><div className="gk-cal__month">{monthGrid(date).map(day => {
                const items = on(day), outside = day.getMonth() !== date.getMonth();
                return <div key={day.toISOString()} className="gk-cal__day" data-outside={outside || undefined} data-today={sameDay(day, now) || undefined}>
                    <button type="button" className="gk-cal__date" aria-label={formatDate(day, { weekday: 'long', day: 'numeric', month: 'long' })} onClick={() => { onNavigate(day); onView('week'); }}>{day.getDate()}</button>
                    <div className="gk-cal__events">{items.slice(0, 3).map(event => chip(event, true))}
                        {items.length > 3 && <button type="button" className="gk-cal__more" onClick={() => { onNavigate(day); onView('week'); }}>+{items.length - 3} more</button>}</div>
                </div>;
            })}</div></>
            : <WeekGrid days={week} events={sorted} selected={selected} onSelect={onSelect} now={now} />}
    </section>;
}

/** A week of hours: each event placed at its time, side by side when they overlap, and a line at the current time. */
function WeekGrid({ days, events, selected, onSelect, now }: { days: Date[]; events: CalendarEvent[]; selected?: string | null; onSelect: (event: CalendarEvent) => void; now: Date }) {
    const inWeek = events.filter(event => event.start >= days[0] && event.start < addDays(days[0], 7));
    const first = Math.min(8, ...inWeek.map(event => event.start.getHours()));
    const last = Math.max(21, ...inWeek.map(event => event.end.getHours() + (event.end.getMinutes() ? 1 : 0)));
    const hours = Array.from({ length: last - first }, (_, index) => first + index);
    const minutes = (date: Date) => (date.getHours() - first) * 60 + date.getMinutes();
    return <div className="gk-cal__week" style={{ '--hours': hours.length, '--hour': `${HOUR}px` } as CSSProperties}>
        <div className="gk-cal__hours" aria-hidden="true">{hours.map(hour => <span key={hour}>{String(hour).padStart(2, '0')}:00</span>)}</div>
        {days.map(day => {
            const items = inWeek.filter(event => sameDay(event.start, day));
            // Overlapping events share the column: each takes a lane within its cluster.
            const lanes: { event: CalendarEvent; lane: number; of: number }[] = [];
            let cluster: typeof lanes = [], clusterEnd = 0;
            for (const event of items) {
                if (cluster.length && event.start.getTime() >= clusterEnd) { cluster.forEach(item => { item.of = Math.max(...cluster.map(other => other.lane)) + 1; }); cluster = []; }
                const used = new Set(cluster.filter(item => item.event.end > event.start).map(item => item.lane));
                let lane = 0; while (used.has(lane)) lane += 1;
                const placed = { event, lane, of: 1 }; cluster.push(placed); lanes.push(placed);
                clusterEnd = Math.max(clusterEnd, event.end.getTime());
            }
            cluster.forEach(item => { item.of = Math.max(...cluster.map(other => other.lane)) + 1; });
            const today = sameDay(day, now);
            return <div key={day.toISOString()} className="gk-cal__column" data-today={today || undefined}>
                <span className="gk-cal__column-date"><span>{formatDate(day, { weekday: 'short' })}</span>{day.getDate()}</span>
                {lanes.map(({ event, lane, of }) => {
                    const Icon = event.icon, top = minutes(event.start) / 60 * HOUR, height = Math.max(26, (event.end.getTime() - event.start.getTime()) / 3_600_000 * HOUR - 2);
                    return <button key={event.key} type="button" className="gk-cal__block" aria-pressed={selected === event.key} data-cancelled={event.cancelled || undefined}
                        style={{ ...tint(event.color), top, height, left: `calc(${(lane / of) * 100}% + 2px)`, width: `calc(${100 / of}% - 4px)` }} onClick={() => onSelect(event)}>
                        <span className="gk-cal__block-time">{Icon && <Icon aria-hidden="true" />}{time(event.start)}</span>
                        <span className="gk-cal__block-title">{event.title}</span>
                        {height > 54 && event.note && <span className="gk-cal__block-note">{event.note}</span>}
                    </button>;
                })}
                {today && now.getHours() >= first && now.getHours() < last && <span className="gk-cal__now" style={{ top: minutes(now) / 60 * HOUR }} aria-hidden="true" />}
            </div>;
        })}
    </div>;
}
