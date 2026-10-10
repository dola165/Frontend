import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { Panel, Section, Skeleton } from '../../../design/primitives';
import { activityColors, activityIcons } from '../../schedule/activityIcons';
import { addDays, isoDay, sameDay } from '../../../design/calendar/calendarDates';
import { formatDate } from '../../../utils/formatting';
import { timeLabel } from '../fixtures';
import { coachEvents } from './coachEvents';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

/** The next seven days side by side, each session and match as a coloured chip that opens it in the calendar. */
export function WeekStrip({ data }: { data: CoachData }) {
    const today = new Date(data.now); today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, index) => addDays(today, index));
    const events = coachEvents(data).filter(event => event.start >= today && event.start < addDays(today, 7));
    return <Section boxed icon={CalendarDays} title="This week" action={<Link className="gk-section__action" to={data.link('calendar')}>Calendar</Link>}>
        <Panel flush>{!data.squads ? <div className="cw-skeleton-rows" role="status" aria-label="Loading the week"><Skeleton height={96} /></div>
            : <ol className="ch-week">{days.map(day => {
                const items = events.filter(event => sameDay(event.start, day));
                return <li key={day.toISOString()} className="ch-week__day" data-today={sameDay(day, today) || undefined}>
                    <span className="ch-week__head"><span>{sameDay(day, today) ? 'Today' : formatDate(day, { weekday: 'short' })}</span><strong>{day.getDate()}</strong></span>
                    {items.length ? <ul className="ch-week__items">{items.map(event => {
                        const Icon = activityIcons[event.kind];
                        return <li key={event.key}><Link className="ch-week__item" data-cancelled={event.cancelled || undefined} style={{ '--activity': activityColors[event.kind] } as CSSProperties}
                            to={data.link('calendar', { view: 'week', date: isoDay(day), event: event.key })} title={`${timeLabel(event.start.toISOString())} ${event.title} · ${event.squad}`}>
                            <span className="ch-week__time"><Icon aria-hidden="true" />{timeLabel(event.start.toISOString())}</span><span className="ch-week__title">{event.short}</span>
                        </Link></li>;
                    })}</ul> : <span className="ch-week__free">Free</span>}
                </li>;
            })}</ol>}</Panel>
    </Section>;
}
