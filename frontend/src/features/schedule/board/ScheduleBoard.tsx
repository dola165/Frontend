import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, List as ListIcon, Plus } from 'lucide-react';
import { Button, EmptyNote, FixtureRow, List, Panel, Skeleton, type FixtureTone } from '../../../design/primitives';
import { Segmented } from '../../../design/Tabs';
import { formatDate, formatTime } from '../../../utils/formatting';
import { addDays, dayKey, type BoardView, type ScheduleRange } from './scheduleRange';
import './schedule-board.css';

/** One thing on a schedule, already described for people: what, when, where and its state. */
export interface BoardEntry {
    key: string;
    startsAt: string;
    endsAt?: string | null;
    title: string;
    /** Squad, place or who it is for. */
    meta?: string;
    tone: FixtureTone;
    /** Trailing status, for example a type badge or "2 can’t come". */
    trail?: ReactNode;
    cancelled?: boolean;
    to?: string;
    onOpen?: () => void;
    /** Accessible name for the open action. */
    label?: string;
}

const views = [{ id: 'week' as const, label: 'Week', icon: <CalendarDays aria-hidden="true" /> }, { id: 'agenda' as const, label: 'Agenda', icon: <ListIcon aria-hidden="true" /> }];

/**
 * A schedule for any audience: a week board or a day-by-day agenda with the fixture line,
 * period navigation, the host's filters and actions, and honest loading, empty and error states.
 */
export function ScheduleBoard({ entries, range, loading, error, onRetry, filters, actions, notices, onCreateAt, empty, label }: {
    entries: BoardEntry[]; range: ScheduleRange; loading: boolean; error?: string; onRetry?: () => void;
    filters?: ReactNode; actions?: ReactNode; notices?: ReactNode;
    /** Offered on each day when the viewer can add to this schedule. */
    onCreateAt?: (day: Date) => void;
    empty: { title: string; body?: ReactNode; action?: ReactNode };
    label: string;
}) {
    const days = Array.from({ length: range.days }, (_, index) => addDays(range.from, index));
    const byDay = new Map<string, BoardEntry[]>();
    for (const entry of [...entries].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
        const key = dayKey(new Date(entry.startsAt));
        byDay.set(key, [...(byDay.get(key) ?? []), entry]);
    }
    const today = dayKey(new Date());
    const nothing = !loading && !error && entries.length === 0;
    return <section className="gk-board" aria-label={label}>
        <div className="gk-board__bar">
            <div className="gk-board__period">
                <Button iconOnly variant="ghost" aria-label={range.view === 'week' ? 'Previous week' : 'Previous four weeks'} onClick={() => range.shift(-1)}><ChevronLeft aria-hidden="true" /></Button>
                <Button size="sm" disabled={range.isCurrent} onClick={range.today}>Today</Button>
                <Button iconOnly variant="ghost" aria-label={range.view === 'week' ? 'Next week' : 'Next four weeks'} onClick={() => range.shift(1)}><ChevronRight aria-hidden="true" /></Button>
                <h3 className="gk-board__range" aria-live="polite">{range.label}</h3>
            </div>
            <div className="gk-board__tools">
                <Segmented items={views} value={range.view} onChange={(value: BoardView) => range.setView(value)} label="Schedule view" />
                {actions}
            </div>
        </div>
        {filters && <div className="gk-board__filters">{filters}</div>}
        {notices}
        {error && <div className="gk-notice gk-notice--danger" role="alert"><span>{error}</span>{onRetry && <Button size="sm" onClick={onRetry}>Try again</Button>}</div>}
        {loading && !entries.length ? <div className="gk-board__loading" role="status" aria-label="Loading schedule"><Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} /></div>
            : nothing ? <Panel><EmptyNote title={empty.title} action={empty.action}>{empty.body}</EmptyNote></Panel>
            : range.view === 'week' ? <WeekGrid days={days} byDay={byDay} today={today} onCreateAt={onCreateAt} />
            : <Agenda days={range.isCurrent ? days.filter(day => dayKey(day) >= today) : days} byDay={byDay} today={today} />}
    </section>;
}

const dayTitle = (day: Date, today: string) => dayKey(day) === today ? `Today, ${formatDate(day, { day: 'numeric', month: 'short' })}` : formatDate(day, { weekday: 'long', day: 'numeric', month: 'short' });
const endLabel = (entry: BoardEntry) => entry.endsAt && dayKey(new Date(entry.endsAt)) === dayKey(new Date(entry.startsAt)) ? `to ${formatTime(entry.endsAt)}` : undefined;

function Agenda({ days, byDay, today }: { days: Date[]; byDay: Map<string, BoardEntry[]>; today: string }) {
    const shown = days.filter(day => byDay.has(dayKey(day)));
    if (!shown.length) return <Panel><EmptyNote title="Nothing more planned in this period">Earlier days are in the previous period.</EmptyNote></Panel>;
    return <div className="gk-board__agenda">{shown.map(day => <section key={dayKey(day)} className="gk-board__day" aria-label={dayTitle(day, today)}>
        <h4 className="gk-board__day-title" data-today={dayKey(day) === today || undefined}>{dayTitle(day, today)}</h4>
        <Panel flush><List label={dayTitle(day, today)}>{byDay.get(dayKey(day))!.map(entry => <FixtureRow key={entry.key} tone={entry.cancelled ? 'neutral' : entry.tone}
            time={formatTime(entry.startsAt)} day={endLabel(entry)} title={entry.title} meta={entry.meta} trail={entry.trail}
            to={entry.to} onClick={entry.to ? undefined : entry.onOpen} label={entry.label} />)}</List></Panel>
    </section>)}</div>;
}

function WeekGrid({ days, byDay, today, onCreateAt }: { days: Date[]; byDay: Map<string, BoardEntry[]>; today: string; onCreateAt?: (day: Date) => void }) {
    return <div className="gk-board__week">{days.map(day => {
        const key = dayKey(day), items = byDay.get(key) ?? [];
        const past = key < today;
        return <section key={key} className="gk-board__column" data-today={key === today || undefined} data-past={past || undefined} aria-label={dayTitle(day, today)}>
            <header className="gk-board__column-head">
                <span><span className="gk-board__weekday">{formatDate(day, { weekday: 'short' })}</span><span className="gk-board__date gk-num">{day.getDate()}</span></span>
                {onCreateAt && !past && <Button size="sm" iconOnly variant="ghost" aria-label={`Add to ${dayTitle(day, today)}`} onClick={() => onCreateAt(day)}><Plus aria-hidden="true" /></Button>}
            </header>
            {items.length ? <ul className="gk-board__items">{items.map(entry => <li key={entry.key}><BoardItem entry={entry} /></li>)}</ul>
                : <p className="gk-board__free">Nothing planned</p>}
        </section>;
    })}</div>;
}

function BoardItem({ entry }: { entry: BoardEntry }) {
    const body = <>
        <span className="gk-board__time gk-num">{formatTime(entry.startsAt)}{entry.endsAt && dayKey(new Date(entry.endsAt)) === dayKey(new Date(entry.startsAt)) ? `–${formatTime(entry.endsAt)}` : ''}</span>
        <span className="gk-board__title">{entry.title}</span>
        {entry.meta && <span className="gk-board__meta">{entry.meta}</span>}
        {entry.trail && <span className="gk-board__trail">{entry.trail}</span>}
    </>;
    const props = { className: 'gk-board__item', 'data-tone': entry.cancelled ? 'neutral' : entry.tone, 'data-cancelled': entry.cancelled || undefined, 'aria-label': entry.label };
    if (entry.to) return <Link {...props} to={entry.to}>{body}</Link>;
    if (entry.onOpen) return <button type="button" {...props} onClick={entry.onOpen}>{body}</button>;
    return <div {...props}>{body}</div>;
}
