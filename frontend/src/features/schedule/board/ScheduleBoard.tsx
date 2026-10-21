import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { CalendarDays, ChevronLeft, ChevronRight, Columns3, List as ListIcon, Plus, Repeat2, type LucideIcon } from 'lucide-react';
import { Button, FixtureRow, List, Panel, Skeleton, type FixtureTone } from '../../../design/primitives';
import { Segmented } from '../../../design/Tabs';
import { formatTime } from '../../../utils/formatting';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { activityColors, activityIcons, outing } from '../activityIcons';
import type { ScheduleEventType } from '../api';
import { addDays, dayKey, startOfWeek, type BoardPeriod, type BoardView } from './scheduleRange';
import { useScheduleDates } from './useScheduleDates';
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
    /** What kind of activity it is: its symbol and colour (a team trip is an outing). */
    activity?: ScheduleEventType | 'OUTING';
    /** Part of a repeating plan. */
    recurring?: boolean;
    /** Trailing status, for example a type badge or "2 can’t come". */
    trail?: ReactNode;
    cancelled?: boolean;
    /** Can be dragged to another day; the board's `onMove` says what that means. */
    movable?: boolean;
    to?: string;
    onOpen?: () => void;
    /** Accessible name for the open action. */
    label?: string;
}

const toneColors: Record<FixtureTone, string> = { match: activityColors.MATCH, training: activityColors.TRAINING, event: activityColors.ACTIVITY, trial: activityColors.TRYOUT, neutral: 'var(--gk-text-3)' };
const toneIcons: Record<FixtureTone, LucideIcon> = { match: activityIcons.MATCH, training: activityIcons.TRAINING, event: activityIcons.ACTIVITY, trial: activityIcons.TRYOUT, neutral: CalendarDays };
const symbolOf = (entry: BoardEntry) => entry.activity === 'OUTING' ? outing.icon : entry.activity ? activityIcons[entry.activity] : toneIcons[entry.tone];
const colourOf = (entry: BoardEntry) => entry.cancelled ? 'var(--gk-text-3)' : entry.activity === 'OUTING' ? outing.color : entry.activity ? activityColors[entry.activity] : toneColors[entry.tone];
const sameDay = (entry: BoardEntry) => entry.endsAt && dayKey(new Date(entry.endsAt)) === dayKey(new Date(entry.startsAt));

interface Copy { (en: string, ka: string): string }
type Dates = ReturnType<typeof useScheduleDates>;

/**
 * The one schedule look: a week of day columns, a month calendar or a day-by-day agenda, with the same toolbar
 * (‹ Today ›, the period, the view switch and the host's own actions), filters and calm empty states everywhere.
 * With `onMove`, entries marked movable can be dragged to another day; the host confirms what that changes.
 */
export function ScheduleBoard({ entries, range, views = ['week', 'agenda'], loading, error, onRetry, filters, actions, notices, onCreateAt, onMove, empty, label, nav, footer }: {
    entries: BoardEntry[]; range: BoardPeriod; views?: BoardView[]; loading: boolean; error?: string; onRetry?: () => void;
    filters?: ReactNode; actions?: ReactNode; notices?: ReactNode;
    /** Offered on each day when the viewer can add to this schedule. */
    onCreateAt?: (day: Date) => void;
    onMove?: (key: string, day: Date) => void;
    /** One quiet line for a period with nothing in it, with an optional small action. */
    empty: { title: string; body?: ReactNode; action?: ReactNode };
    label: string;
    /** Names a host's tours and tests know the period buttons by, and an optional jump to any date. */
    nav?: { previous?: string; next?: string; jump?: { label: string; value: string; onChange: (date: Date) => void } };
    /** Below the schedule: plans, notes and links of the host's own. */
    footer?: ReactNode;
}) {
    const copy = useJourneyCopy();
    const dates = useScheduleDates();
    const view = views.includes(range.view) ? range.view : views[0];
    const days = Array.from({ length: range.days }, (_, index) => addDays(range.from, index));
    const byDay = new Map<string, BoardEntry[]>();
    for (const entry of [...entries].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
        const key = dayKey(new Date(entry.startsAt));
        byDay.set(key, [...(byDay.get(key) ?? []), entry]);
    }
    const today = dayKey(new Date());
    const nothing = !loading && !error && entries.length === 0;
    const unit = view === 'week' ? copy('week', 'კვირა') : view === 'calendar' ? copy('month', 'თვე') : copy('period', 'პერიოდი');
    const viewItems = { week: { id: 'week' as const, label: copy('Week', 'კვირა'), icon: <Columns3 aria-hidden="true" /> },
        calendar: { id: 'calendar' as const, label: copy('Calendar', 'კალენდარი'), icon: <CalendarDays aria-hidden="true" /> },
        agenda: { id: 'agenda' as const, label: copy('Agenda', 'დღის წესრიგი'), icon: <ListIcon aria-hidden="true" /> } };
    const shared = { byDay, today, dates, copy, onCreateAt, onMove };
    return <section className="gk-board" aria-label={label} aria-busy={loading || undefined}>
        <div className="gk-board__bar">
            <div className="gk-board__period" data-tutorial="calendar-date-nav">
                <Button iconOnly variant="ghost" aria-label={nav?.previous ?? copy(`Previous ${unit}`, `წინა ${unit}`)} onClick={() => range.shift(-1)}><ChevronLeft aria-hidden="true" /></Button>
                <Button size="sm" disabled={range.isCurrent} onClick={range.today}>{copy('Today', 'დღეს')}</Button>
                <Button iconOnly variant="ghost" aria-label={nav?.next ?? copy(`Next ${unit}`, `შემდეგი ${unit}`)} onClick={() => range.shift(1)}><ChevronRight aria-hidden="true" /></Button>
                <h3 className="gk-board__range" aria-live="polite">{view === 'calendar' ? dates.monthYear(range.from) : dates.range(range.from, range.days)}</h3>
                {nav?.jump && <label className="gk-board__jump" title={nav.jump.label}>
                    <CalendarDays aria-hidden="true" />
                    <input type="date" aria-label={nav.jump.label} value={nav.jump.value} onClick={event => { try { event.currentTarget.showPicker?.(); } catch { /* Opened by the browser itself. */ } }}
                        onChange={event => { if (!/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) return; const date = new Date(`${event.target.value}T12:00:00`); if (Number.isFinite(date.getTime())) nav.jump?.onChange(date); }} />
                </label>}
            </div>
            <div className="gk-board__tools">
                {views.length > 1 && <div data-tutorial="calendar-view-mode"><Segmented items={views.map(id => viewItems[id])} value={view} onChange={(value: BoardView) => range.setView(value)} label={copy('Schedule view', 'განრიგის ხედი')} /></div>}
                {actions}
            </div>
        </div>
        {filters && <div className="gk-board__filters" data-tutorial="calendar-event-filters">{filters}</div>}
        {notices}
        {error && <div className="gk-notice gk-notice--danger" role="alert"><span>{error}</span>{onRetry && <Button size="sm" onClick={onRetry}>{copy('Try again', 'ხელახლა ცდა')}</Button>}</div>}
        {nothing && <p className="gk-board__quiet" role="status">{empty.title}{empty.body && <> {empty.body}</>}{empty.action && <> {empty.action}</>}</p>}
        {loading && !entries.length ? <div className="gk-board__loading" role="status" aria-label={copy('Loading schedule', 'განრიგი იტვირთება')}><Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} /></div>
            : view === 'week' ? <MoveArea entries={entries} onMove={onMove}><WeekGrid days={days} quiet={nothing} {...shared} /></MoveArea>
            : view === 'calendar' ? <MoveArea entries={entries} onMove={onMove}><MonthGrid month={range.from} goTo={range.goTo} {...shared} /></MoveArea>
            : !nothing && <Agenda days={range.isCurrent ? days.filter(day => dayKey(day) >= today) : days} {...shared} />}
        {footer}
    </section>;
}

interface Shared { byDay: Map<string, BoardEntry[]>; today: string; dates: Dates; copy: Copy; onCreateAt?: (day: Date) => void; onMove?: (key: string, day: Date) => void }
const dayTitle = (day: Date, { today, dates, copy }: Pick<Shared, 'today' | 'dates' | 'copy'>) => dayKey(day) === today ? `${copy('Today', 'დღეს')}, ${dates.dayMonth(day)}` : dates.day(day);

/** Drag and drop for the week and month: a card dropped on another day asks the host to move it there. */
function MoveArea({ entries, onMove, children }: { entries: BoardEntry[]; onMove?: (key: string, day: Date) => void; children: ReactNode }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
    const [active, setActive] = useState<BoardEntry | null>(null);
    if (!onMove) return children;
    return <DndContext sensors={sensors} onDragStart={event => setActive(entries.find(entry => entry.key === event.active.id) ?? null)} onDragCancel={() => setActive(null)}
        onDragEnd={event => {
            setActive(null);
            const day = event.over?.data.current?.day as Date | undefined;
            const entry = entries.find(item => item.key === event.active.id);
            if (day && entry && dayKey(day) !== dayKey(new Date(entry.startsAt))) onMove(entry.key, day);
        }}>
        {children}
        <DragOverlay dropAnimation={null}>{active && <div className="gk-board__item gk-board__item--ghost" style={{ '--gk-board-tone': colourOf(active) } as CSSProperties}><CardBody entry={active} /></div>}</DragOverlay>
    </DndContext>;
}

/** A day that takes a dropped card, when moving is on; otherwise a plain section. */
function useDropDay(day: Date, enabled: boolean) {
    const { setNodeRef, isOver } = useDroppable({ id: `day-${dayKey(day)}`, data: { day }, disabled: !enabled });
    return { ref: enabled ? setNodeRef : undefined, over: enabled && isOver };
}

function WeekGrid({ days, quiet, ...shared }: Shared & { days: Date[]; quiet: boolean }) {
    return <div className="gk-board__week" data-empty={quiet || undefined}>{days.map(day => <WeekDay key={dayKey(day)} day={day} quiet={quiet} {...shared} />)}</div>;
}

function WeekDay({ day, quiet, byDay, today, dates, copy, onCreateAt, onMove }: Shared & { day: Date; quiet: boolean }) {
    const key = dayKey(day), items = byDay.get(key) ?? [], past = key < today;
    const title = dayTitle(day, { today, dates, copy });
    const { ref, over } = useDropDay(day, Boolean(onMove) && !past);
    return <section ref={ref} className="gk-board__column" data-today={key === today || undefined} data-past={past || undefined} data-over={over || undefined} aria-label={title}>
        <header className="gk-board__column-head"><span className="gk-board__weekday">{dates.weekday(day, 'short')}</span><span className="gk-board__date gk-num">{day.getDate()}</span></header>
        {items.length ? <ul className="gk-board__items">{items.map(entry => <li key={entry.key}><BoardCard entry={entry} movable={Boolean(onMove && entry.movable)} /></li>)}</ul>
            : !quiet && <p className="gk-board__free">{copy('Nothing planned', 'არაფერია დაგეგმილი')}</p>}
        {onCreateAt && !past && <Button size="sm" iconOnly variant="ghost" className="gk-board__add" aria-label={copy(`Add to ${title}`, `დამატება — ${title}`)} onClick={() => onCreateAt(day)}><Plus aria-hidden="true" /></Button>}
    </section>;
}

/** A month of weeks. Each day shows its first few entries; on a narrow screen, coloured dots that open the week. */
function MonthGrid({ month, goTo, ...shared }: Shared & { month: Date; goTo?: (date: Date) => void }) {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = startOfWeek(first);
    const length = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const weeks = Math.ceil((((first.getDay() + 6) % 7) + length) / 7);
    const days = Array.from({ length: weeks * 7 }, (_, index) => addDays(start, index));
    return <div className="gk-board__month">
        <div className="gk-board__month-head" aria-hidden="true">{days.slice(0, 7).map(day => <span key={day.getDay()}>{shared.dates.weekday(day, 'short')}</span>)}</div>
        <div className="gk-board__month-days">{days.map(day => <MonthDay key={dayKey(day)} day={day} inMonth={day.getMonth() === first.getMonth()} goTo={goTo} {...shared} />)}</div>
    </div>;
}

function MonthDay({ day, inMonth, goTo, byDay, today, dates, copy, onCreateAt, onMove }: Shared & { day: Date; inMonth: boolean; goTo?: (date: Date) => void }) {
    const key = dayKey(day), items = inMonth ? byDay.get(key) ?? [] : [], past = key < today;
    const title = dayTitle(day, { today, dates, copy });
    const { ref, over } = useDropDay(day, Boolean(onMove) && !past && inMonth);
    const open = goTo && (() => goTo(day));
    return <section ref={ref} className="gk-board__cell" data-out={!inMonth || undefined} data-today={key === today || undefined} data-past={past || undefined} data-over={over || undefined} aria-label={title}>
        <header className="gk-board__cell-head">
            {open ? <button type="button" className="gk-board__cell-date gk-num" aria-label={copy(`Open the week of ${title}`, `კვირის გახსნა — ${title}`)} onClick={open}>{day.getDate()}</button>
                : <span className="gk-board__cell-date gk-num">{day.getDate()}</span>}
            {open && items.length > 0 && <button type="button" className="gk-board__dots" aria-label={copy(`${title}: ${items.length} planned`, `${title}: ${items.length} დაგეგმილი`)} onClick={open}>
                {items.slice(0, 4).map(entry => <i key={entry.key} style={{ background: colourOf(entry) }} />)}
            </button>}
        </header>
        {items.length > 0 && <ul className="gk-board__items">{items.slice(0, 3).map(entry => <li key={entry.key}><BoardCard entry={entry} movable={Boolean(onMove && entry.movable)} /></li>)}</ul>}
        {items.length > 3 && <button type="button" className="gk-board__more" onClick={open}>{copy(`${items.length - 3} more`, `კიდევ ${items.length - 3}`)}</button>}
        {onCreateAt && inMonth && !past && <Button size="sm" iconOnly variant="ghost" className="gk-board__add" aria-label={copy(`Add to ${title}`, `დამატება — ${title}`)} onClick={() => onCreateAt(day)}><Plus aria-hidden="true" /></Button>}
    </section>;
}

function Agenda({ days, byDay, today, dates, copy }: Shared & { days: Date[] }) {
    const shown = days.filter(day => byDay.has(dayKey(day)));
    if (!shown.length) return <p className="gk-board__quiet" role="status">{copy('Nothing more planned in this period.', 'ამ პერიოდში მეტი არაფერია დაგეგმილი.')}</p>;
    return <div className="gk-board__agenda">{shown.map(day => {
        const title = dayTitle(day, { today, dates, copy });
        return <section key={dayKey(day)} className="gk-board__day" aria-label={title}>
            <h4 className="gk-board__day-title" data-today={dayKey(day) === today || undefined}>{title}</h4>
            <Panel flush><List label={title}>{byDay.get(dayKey(day))!.map(entry => <FixtureRow key={entry.key} tone={entry.cancelled ? 'neutral' : entry.tone}
                icon={symbolOf(entry)} iconColor={colourOf(entry)} time={formatTime(entry.startsAt)} day={sameDay(entry) ? copy(`to ${formatTime(entry.endsAt!)}`, `${formatTime(entry.endsAt!)}-მდე`) : undefined}
                title={entry.title} meta={entry.meta} trail={entry.trail} to={entry.to} onClick={entry.to ? undefined : entry.onOpen} label={entry.label} />)}</List></Panel>
        </section>;
    })}</div>;
}

/** What a card says: the time line with the activity's symbol, a title of up to two lines, where and its state. */
function CardBody({ entry }: { entry: BoardEntry }) {
    const copy = useJourneyCopy();
    const Symbol = entry.activity === 'OUTING' ? outing.icon : entry.activity ? activityIcons[entry.activity] : toneIcons[entry.tone];
    return <>
        <span className="gk-board__when"><Symbol aria-hidden="true" />
            <time className="gk-num" dateTime={entry.startsAt}>{formatTime(entry.startsAt)}{sameDay(entry) ? `–${formatTime(entry.endsAt!)}` : ''}</time>
            {entry.recurring && <Repeat2 className="gk-board__repeat" role="img" aria-label={copy('Repeats', 'მეორდება')} />}
        </span>
        <span className="gk-board__title">{entry.title}</span>
        {entry.meta && <span className="gk-board__meta">{entry.meta}</span>}
        {entry.trail && <span className="gk-board__trail">{entry.trail}</span>}
    </>;
}

function BoardCard({ entry, movable }: { entry: BoardEntry; movable: boolean }) {
    const props = { className: 'gk-board__item', style: { '--gk-board-tone': colourOf(entry) } as CSSProperties, 'data-cancelled': entry.cancelled || undefined, 'aria-label': entry.label };
    if (movable && entry.onOpen) return <MovableCard entry={entry} {...props} />;
    if (entry.to) return <Link {...props} to={entry.to}><CardBody entry={entry} /></Link>;
    if (entry.onOpen) return <button type="button" {...props} onClick={entry.onOpen}><CardBody entry={entry} /></button>;
    return <div {...props}><CardBody entry={entry} /></div>;
}

function MovableCard({ entry, ...props }: { entry: BoardEntry; className: string; style: CSSProperties; 'aria-label'?: string; 'data-cancelled'?: boolean }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.key });
    return <button type="button" ref={setNodeRef} {...attributes} {...listeners} {...props} data-movable data-dragging={isDragging || undefined} onClick={entry.onOpen}><CardBody entry={entry} /></button>;
}
