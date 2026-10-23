import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pin, Plus } from 'lucide-react';
import { Button, FixtureRow, Skeleton } from '../../design/primitives';
import { formatTime } from '../../utils/formatting';
import { extractApiErrorMessage } from '../../utils/apiError';
import { AgendaDays } from '../schedule/board/AgendaDays';
import { dayKey } from '../schedule/board/scheduleRange';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { Person, Plan, WorkNode } from './api';
import { byDay, eventIcon, eventMatches, eventWords, rowsOf, statusTone, taskIdOf, wholeDays, type AgendaFilter } from './agendaRows';
import { fetchTimeline, type WorkEvent } from './overviewApi';
import type { Who } from './planPeople';
import { useDayTitle } from './useDayTitle';
import { useFresh } from './useFresh';
import { KeyChip, StatusFilter } from './WorkBits';

/** How many older pages a link to an old day may load to reach it. */
const REACH_PAGES = 6;


/** The agenda's events, page by page; a refresh keeps the older pages already loaded. */
function useTimeline(revision: number) {
    const copy = useJourneyCopy();
    const [data, setData] = useState<{ events: WorkEvent[]; next: string | null } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const loading = useRef(false);
    useEffect(() => {
        const controller = new AbortController();
        fetchTimeline(null, controller.signal).then(page => {
            if (controller.signal.aborted) return;
            const first = wholeDays(page);
            setError('');
            setData(current => {
                const older = first.next && current ? current.events.filter(event => Date.parse(event.at) < Date.parse(first.next!)) : [];
                return { events: [...first.events, ...older], next: older.length && current ? current.next : first.next };
            });
        }).catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, copy('What happened could not load.', 'ისტორია ვერ ჩაიტვირთა.'))); });
        return () => controller.abort();
    }, [revision, retry, copy]);
    const next = data?.next ?? null;
    const more = async () => {
        if (!next || loading.current) return;
        loading.current = true; setBusy(true);
        try { const page = wholeDays(await fetchTimeline(next)); setData(current => ({ events: [...current?.events ?? [], ...page.events], next: page.next })); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('Earlier days could not load.', 'წინა დღეები ვერ ჩაიტვირთა.'))); }
        finally { loading.current = false; setBusy(false); }
    };
    return { events: data?.events ?? null, next, busy, error, more, retry: () => setRetry(value => value + 1) };
}

export interface AgendaContext { nodes: Map<number, WorkNode>; planOf: Map<number, Plan>; planItems: Map<number, Set<number>>; team: Person[] }

/**
 * What happened, day by day, newest first: the schedule's agenda look, with only the days that have something.
 * Each row is one event (added, a move, a question asked or answered) with its time, a symbol in the status's
 * colour, the task's key and name, what changed, who and the plan. Tasks one person added at once fold into one row.
 * The day at the top of the screen goes into `?day=`, so a reload or a shared link comes back to it.
 */
export function Agenda({ revision, filter, context, exclude, scope, showPlan = true, pinned, onOpen, onClear }: {
    revision: number; filter: AgendaFilter; context: AgendaContext;
    /** Tasks that are findings (Ideas, Waiting), never shown. */ exclude: Set<number>;
    /** Only these tasks (a plan's). */ scope?: Set<number>;
    showPlan?: boolean; pinned: (taskId: number) => boolean; onOpen: (taskId: number, stepId: number | null) => void;
    /** Clears the toolbar's filters, offered when they leave nothing. */ onClear?: () => void;
}) {
    const copy = useJourneyCopy();
    const dayTitle = useDayTitle();
    const timeline = useTimeline(revision);
    // Events that arrived with a refresh (a move, an answer, a new task) are marked for a moment.
    const fresh = useFresh(timeline.events?.map(event => event.id) ?? null);
    const [open, setOpen] = useState<Set<string>>(new Set());
    const root = useRef<HTMLDivElement>(null);
    const [params, setParams] = useSearchParams();
    const wanted = params.get('day');
    const reached = useRef(wanted == null);
    const reachTries = useRef(0);

    const shown = (timeline.events ?? []).filter(event => { const task = taskIdOf(event); return !exclude.has(task) && (!scope || scope.has(task)) && eventMatches(event, filter, context); });
    const days = byDay(shown);
    const planName = (event: WorkEvent) => context.planOf.get(taskIdOf(event))?.name;

    // A link to an old day loads older pages until that day is there, then scrolls to it (or the nearest day before).
    useEffect(() => {
        if (reached.current || timeline.events == null) return;
        const loaded = timeline.events.length ? dayKey(new Date(timeline.events[timeline.events.length - 1].at)) : null;
        if (timeline.next && (loaded == null || loaded > wanted!) && reachTries.current < REACH_PAGES) { reachTries.current += 1; void timeline.more(); return; }
        reached.current = true;
        const target = [...root.current?.querySelectorAll<HTMLElement>('[data-day]') ?? []].find(section => (section.dataset.day ?? '') <= wanted!);
        target?.scrollIntoView?.({ block: 'start' });
        // Runs again as pages arrive; `more` itself refuses a second load while one is on its way.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeline.events, timeline.next, wanted]);

    // The day at the top of the screen goes into the link, quietly; the newest day needs none.
    useEffect(() => {
        let waiting = 0;
        const note = () => {
            window.clearTimeout(waiting);
            waiting = window.setTimeout(() => {
                if (!reached.current) return;
                const sections = [...root.current?.querySelectorAll<HTMLElement>('[data-day]') ?? []];
                const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-header-height')) || 64;
                const current = sections.find(section => section.getBoundingClientRect().bottom > top + 24);
                const value = !current || current === sections[0] ? null : current.dataset.day ?? null;
                setParams(previous => {
                    if (previous.get('day') === value) return previous;
                    const changed = new URLSearchParams(previous);
                    if (value) changed.set('day', value); else changed.delete('day');
                    return changed;
                }, { replace: true });
            }, 250);
        };
        window.addEventListener('scroll', note, { passive: true });
        return () => { window.removeEventListener('scroll', note); window.clearTimeout(waiting); };
    }, [setParams]);

    if (timeline.events == null) return timeline.error
        ? <div className="gk-notice gk-notice--danger" role="alert"><span>{timeline.error}</span><Button size="sm" onClick={timeline.retry}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>
        : <div className="tw-agenda__loading" role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={48} /><Skeleton height={48} /><Skeleton height={48} /></div>;

    const eventRow = (event: WorkEvent) => {
        const { what, detail } = eventWords(copy, event);
        const parent = event.parentId != null ? context.nodes.get(event.parentId)?.item : undefined;
        const trail = [event.by?.name, parent && copy(`step of ${parent.key}`, `${parent.key}-ის ნაბიჯი`), showPlan && planName(event)].filter(Boolean).join(' · ');
        return <FixtureRow key={event.id} tone="neutral" time={formatTime(event.at)} icon={eventIcon(event)} iconColor={statusTone[event.status]}
            title={<span title={`${event.task.key} ${event.task.title}`} data-fresh={fresh.has(event.id) || undefined}><KeyChip value={event.task.key} /> {event.task.title}</span>} meta={detail ? `${what} — ${detail}` : what}
            trail={<span className="tw-agenda__trail">{pinned(taskIdOf(event)) && <Pin className="tw-agenda__pinned" aria-label={copy('Pinned', 'მიმაგრებულია')} />}{trail}</span>}
            onClick={() => onOpen(taskIdOf(event), event.parentId != null ? event.task.id : null)} label={`${event.task.key} ${event.task.title}. ${what}`} />;
    };

    const filtered = filter.plan != null || filter.who != null || filter.statuses.length > 0;
    return <div className="tw-agenda tw-fresh-rows" ref={root}>
        {days.length === 0 ? <div className="tw-quiet-row" role="status"><span className="gk-muted">{timeline.events.length === 0 ? copy('Nothing has happened here yet.', 'აქ ჯერ არაფერი მომხდარა.') : timeline.next
            ? copy('Nothing in these days for this filter.', 'ამ ფილტრით ამ დღეებში არაფერია.') : copy('Nothing for this filter.', 'ამ ფილტრით არაფერია.')}</span>
            {filtered && onClear && timeline.events.length > 0 && <Button size="sm" onClick={onClear}>{copy('Clear filters', 'ფილტრების გასუფთავება')}</Button>}</div>
            : <AgendaDays className="tw-agenda__days" days={days.map(([key, events]) => {
                const { label, title, today } = dayTitle(key);
                return { key, title, label, today, rows: rowsOf(events, planName).flatMap(row => {
                    if (row.kind === 'event') return [eventRow(row.event)];
                    const expanded = open.has(row.key), first = row.events[0], names = row.events.map(event => event.task.title);
                    const trail = [first.by?.name, showPlan && planName(first)].filter(Boolean).join(' · ');
                    return [<FixtureRow key={row.key} tone="neutral" time={formatTime(first.at)} icon={Plus} iconColor="var(--gk-text-3)"
                        title={<span data-fresh={row.events.some(event => fresh.has(event.id)) || undefined}>{copy(`Added ${row.events.length} tasks`, `დაემატა ${row.events.length} საქმე`)}</span>} meta={names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '')}
                        trail={<span className="tw-agenda__trail">{trail}<span className="tw-agenda__fold">{expanded ? copy('Fold', 'აკეცვა') : copy('Show all', 'ყველას ნახვა')}</span></span>}
                        onClick={() => setOpen(current => { const changed = new Set(current); if (changed.has(row.key)) changed.delete(row.key); else changed.add(row.key); return changed; })}
                        label={copy(`Added ${row.events.length} tasks. ${expanded ? 'Fold' : 'Show all'}`, `დაემატა ${row.events.length} საქმე. ${expanded ? 'აკეცვა' : 'ყველას ნახვა'}`)} />,
                        ...expanded ? row.events.map(eventRow) : []];
                }) };
            })} />}
        {timeline.error && <div className="gk-notice gk-notice--danger" role="alert"><span>{timeline.error}</span></div>}
        {timeline.next && <div className="tw-agenda__more"><Button size="sm" disabled={timeline.busy} onClick={() => void timeline.more()}>{timeline.busy ? copy('Loading…', 'იტვირთება…') : copy('Show earlier days', 'წინა დღეების ჩვენება')}</Button></div>}
    </div>;
}

/** Plan, person and status for the agenda, in one row. The plan picker is left out on a plan's own page. */
export function AgendaToolbar({ plans, team, filter, onChange }: { plans?: Plan[]; team: Person[]; filter: AgendaFilter; onChange: (change: Partial<AgendaFilter>) => void }) {
    const copy = useJourneyCopy();
    const planId = useId(), whoId = useId();
    const who = (value: string): Who => value === '' ? null : value === 'team' ? 'team' : Number(value);
    return <div className="tw-agenda-bar" role="group" aria-label={copy('Filter', 'ფილტრი')}>
        {plans && <span className="tw-agenda-bar__pick"><label htmlFor={planId} className="gk-visually-hidden">{copy('Plan', 'გეგმა')}</label>
            <select id={planId} className="gk-input tw-plan-filter" value={filter.plan ?? ''} onChange={event => onChange({ plan: event.target.value === '' ? null : event.target.value === 'none' ? 'none' : Number(event.target.value) })}>
                <option value="">{copy('All plans', 'ყველა გეგმა')}</option>
                {plans.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                <option value="none">{copy('No plan', 'გეგმის გარეშე')}</option>
            </select></span>}
        {team.length > 0 && <span className="tw-agenda-bar__pick"><label htmlFor={whoId} className="gk-visually-hidden">{copy('Person', 'ადამიანი')}</label>
            <select id={whoId} className="gk-input tw-plan-filter" value={filter.who ?? ''} onChange={event => onChange({ who: who(event.target.value) })}>
                <option value="">{copy('Everyone', 'ყველა')}</option>
                <option value="team">{copy('Whole team', 'მთელი გუნდი')}</option>
                {team.flatMap(person => person.id == null ? [] : [<option key={person.id} value={person.id}>{person.name ?? '—'}</option>])}
            </select></span>}
        <StatusFilter chosen={filter.statuses} onChange={statuses => onChange({ statuses })} />
    </div>;
}
