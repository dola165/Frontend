import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Goal, HeartPulse, LayoutGrid, List as ListIcon, PenLine } from 'lucide-react';
import { Avatar, EmptyNote, PageFrame, PageHeader, Panel, SearchInput, Section, Skeleton, type BadgeTone } from '../../../design/primitives';
import { Segmented } from '../../../design/Tabs';
import { DataTable, EMPTY_CELL, ListToolbar, PrimaryCell, Status, ViewTabs, type Column } from '../../../design/DataTable';
import { nextSort, sortRows, type TableSort } from '../../../design/tableSort';
import type { OperationRecord } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { SquadSession } from '../../squadCommunication/api';
import { WorkspacePlayerPanel } from '../../clubOperations/WorkspacePlayerPanel';
import { dayLabel, dueWords, timeLabel } from '../fixtures';
import { sessionKind, upcoming } from './useCoachData';
import { SquadSwitch } from './CoachVisuals';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

type Person = RolesWorkspace['people'][number];
interface PlayerRow { person: Person; match?: SquadSession; training?: SquadSession; restriction?: OperationRecord; consent?: OperationRecord; review?: OperationRecord }

const answer = (session: SquadSession | undefined, player: number) => session?.attendance.find(entry => entry.id === player);
/** A player's answer for a session as a word and a colour: coming, can't come, unsure, no reply or expected. */
function replyOf(session: SquadSession | undefined, player: number): { text: string; tone?: BadgeTone; reason?: string | null } | null {
    const entry = answer(session, player);
    if (!session || !entry) return null;
    if (entry.response === 'GOING') return { text: 'Coming', tone: 'accent' };
    if (entry.response === 'NOT_GOING') return { text: 'Can’t come', tone: 'danger', reason: entry.reason };
    if (entry.response === 'UNSURE') return { text: 'Unsure', tone: 'info' };
    return session.response_requested ? { text: 'No reply', tone: 'warning' } : { text: 'Expected' };
}

const FILTERS: { id: string; label: string; test: (row: PlayerRow) => boolean }[] = [
    { id: 'all', label: 'Everyone', test: () => true },
    { id: 'cant', label: 'Can’t come', test: row => [row.match, row.training].some(session => answer(session, row.person.id)?.response === 'NOT_GOING') },
    { id: 'noreply', label: 'No reply', test: row => Boolean(row.match?.response_requested) && answer(row.match, row.person.id)?.response === 'UNANSWERED' },
    { id: 'restricted', label: 'Restricted', test: row => Boolean(row.restriction) },
    { id: 'consent', label: 'Consent', test: row => Boolean(row.consent) },
];

/**
 * My players as faces: each ringed by their answer for the next match, with small signs for a restriction,
 * consent waiting on a parent and a development review. Quick filters answer "who can't come" and "who hasn't
 * replied"; the table view keeps every column for sorting. A player opens their notes and tools.
 */
export function CoachPlayers({ data, embedded }: { data: CoachData; embedded?: boolean }) {
    const [params, setParams] = useSearchParams();
    const [open, setOpen] = useState<Person | null>(null);
    const { now } = data;
    const query = embedded ? '' : params.get('q') ?? '';
    const filter = (!embedded && FILTERS.find(item => item.id === params.get('view'))) || FILTERS[0];
    const table = !embedded && params.get('layout') === 'table';
    const sortBy = params.get('sort'), descending = params.get('dir') === 'desc';
    const sort = useMemo<TableSort | null>(() => sortBy ? { by: sortBy, descending } : null, [sortBy, descending]);
    const set = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
        setParams(next, { replace: true });
    };

    // Each squad's next match (which asks for replies) and next training.
    const sessions = new Map(data.squads?.map(squad => {
        const next = upcoming(squad, now);
        return [squad.id, { match: next.find(session => sessionKind(session) !== 'TRAINING' && session.response_requested), training: next.find(session => sessionKind(session) === 'TRAINING') }];
    }) ?? []);
    const rows = data.roles.people.filter(person => data.shown.includes(person.squad_id)).map((person): PlayerRow => {
        const about = data.records.rows.filter(record => record.subject_user_id === person.id), next = sessions.get(person.squad_id);
        return { person, match: next?.match, training: next?.training,
            restriction: about.find(record => record.module === 'AVAILABILITY'), consent: about.find(record => record.module === 'GUARDIANS' && record.status === 'PENDING'),
            review: about.filter(record => record.module === 'DEVELOPMENT').sort((a, b) => (a.data.reviewOn ?? a.due_on ?? '9999').localeCompare(b.data.reviewOn ?? b.due_on ?? '9999'))[0] };
    });
    const needle = query.trim().toLocaleLowerCase();
    const shown = sortRows(rows.filter(row => filter.test(row) && (!needle || row.person.name.toLocaleLowerCase().includes(needle))), sort, (row, by) => ({
        name: row.person.name.toLocaleLowerCase(), match: answer(row.match, row.person.id)?.response ?? '', training: answer(row.training, row.person.id)?.response ?? '',
        care: row.restriction ? 0 : 1, consent: row.consent ? 0 : 1, development: row.review?.data.reviewOn ?? row.review?.due_on ?? '9999',
    } as Record<string, string | number>)[by] ?? '');
    const several = data.shown.length > 1;

    const signs = (row: PlayerRow) => {
        const due = row.review && dueWords(row.review.data.reviewOn ?? row.review.due_on, now);
        return <>
            {row.restriction && <span className="ch-sign" data-tone="warning" title={`Restricted: ${row.restriction.data.restrictions || row.restriction.title}`}><HeartPulse aria-hidden="true" /><span className="gk-visually-hidden">Restricted</span></span>}
            {row.consent && <span className="ch-sign" data-tone="info" title={`Consent awaiting a parent: ${row.consent.title}`}><PenLine aria-hidden="true" /><span className="gk-visually-hidden">Consent awaiting a parent</span></span>}
            {row.review && <span className="ch-sign" data-tone={due?.late ? 'danger' : undefined} title={`${row.review.title}${due ? ` · ${due.late ? due.text : `review ${due.text}`}` : ''}`}><Goal aria-hidden="true" /><span className="gk-visually-hidden">Development review</span></span>}
        </>;
    };
    const cards = <ul className="ch-players">{shown.map(row => {
        const next = replyOf(row.match, row.person.id) ?? replyOf(row.training, row.person.id), when = row.match ?? row.training;
        return <li key={`${row.person.id}-${row.person.squad_id}`}><button type="button" className="ch-player" onClick={() => setOpen(row.person)}
            title={when ? `${when.title} · ${dayLabel(when.starts_at, now)} ${timeLabel(when.starts_at)}` : undefined}>
            <span className="ch-player__face" data-tone={next?.tone}><Avatar name={row.person.name} size={52} /></span>
            <strong className="ch-player__name">{row.person.name}</strong>
            <span className="ch-player__line">{next ? <span className={`ch-player__reply${next.tone ? ` ch-player__reply--${next.tone}` : ''}`}>{next.text}</span> : <span className="ch-quiet">—</span>}
                {several && <span className="ch-quiet"> · {row.person.squad_name}</span>}</span>
            <span className="ch-player__signs">{signs(row)}</span>
        </button></li>;
    })}</ul>;

    const columns: Column<PlayerRow>[] = [
        { id: 'name', label: 'Player', width: 'minmax(200px, 1.6fr)', sortable: true, render: row => <PrimaryCell lead={<Avatar name={row.person.name} size={30} />}
            title={<button type="button" className="gk-dt-primary__title" onClick={() => setOpen(row.person)}>{row.person.name}</button>} subtitle={several ? row.person.squad_name : undefined} /> },
        ...(['match', 'training'] as const).map((key): Column<PlayerRow> => ({ id: key, label: key === 'match' ? 'Next match' : 'Next training', width: 'minmax(120px, 1fr)', sortable: true, render: row => {
            const value = replyOf(row[key], row.person.id);
            return value ? <Status tone={value.tone} title={value.reason ?? undefined}>{value.text}{value.reason && <span className="gk-dt-muted"> · {value.reason}</span>}</Status> : EMPTY_CELL;
        } })),
        { id: 'care', label: 'Signs', width: 'minmax(120px, 1fr)', sortable: true, render: row => <span className="ch-player__signs">{signs(row)}</span> },
    ];
    const loading = !data.squads || data.records.loading;
    const body: ReactNode = loading ? <Panel><div className="cw-skeleton-rows" role="status" aria-label="Loading players">{[0, 1, 2].map(i => <Skeleton key={i} height={64} />)}</div></Panel>
        : !shown.length ? <Panel><EmptyNote title={needle ? 'No players match' : filter.id === 'all' ? 'No players yet' : `Nobody: ${filter.label.toLowerCase()}`}>{needle ? 'Try another name.' : filter.id === 'all' ? 'Players appear here when they join your squads.' : 'Good news.'}</EmptyNote></Panel>
            : table ? <DataTable label="Players" columns={columns} rows={shown} rowKey={row => `${row.person.id}-${row.person.squad_id}`} sort={sort}
                onSort={by => { const value = nextSort(sort, by); set({ sort: value?.by ?? null, dir: value?.descending ? 'desc' : null }); }}
                onOpen={row => setOpen(row.person)} actions={() => <ChevronRight className="gk-dt__chevron gk-dt__keep" aria-hidden="true" />} />
                : cards;
    const panel = open && <WorkspacePlayerPanel key={`${open.id}-${open.squad_id}`} player={open} squad={open.squad_id} squadName={open.squad_name} boot={data.boot} onClose={() => setOpen(null)} onOpen={data.openWork} />;

    if (embedded) return <Section boxed title="Players" hint={`${rows.length}`}>{body}{panel}</Section>;
    return <PageFrame className="cw-page ch-page">
        <PageHeader title="Players" subtitle={`${rows.length} in ${several ? 'your squads' : data.names.get(data.shown[0])}`} />
        <SquadSwitch data={data} />
        <div className="gk-stack gk-stack--tight">
            <ViewTabs label="Show" value={filter.id} onChange={id => set({ view: id === 'all' ? null : id })} views={FILTERS.map(item => ({ id: item.id, label: item.label, count: rows.filter(item.test).length }))} />
            <ListToolbar>
                <SearchInput aria-label="Find a player" placeholder="Find a player" value={query} onChange={event => set({ q: event.target.value })} />
                <span className="ch-toolbar-end"><Segmented label="Layout" value={table ? 'table' : 'cards'} onChange={value => set({ layout: value === 'table' ? 'table' : null })}
                    items={[{ id: 'cards', label: 'Cards', icon: <LayoutGrid aria-hidden="true" /> }, { id: 'table', label: 'Table', icon: <ListIcon aria-hidden="true" /> }]} /></span>
            </ListToolbar>
            {body}
        </div>
        {panel}
    </PageFrame>;
}
