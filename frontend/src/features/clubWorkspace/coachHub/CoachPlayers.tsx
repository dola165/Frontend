import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Avatar, EmptyNote, PageFrame, PageHeader, Panel, SearchInput, Section, Skeleton } from '../../../design/primitives';
import { DataTable, EMPTY_CELL, FilterSelect, ListToolbar, PrimaryCell, Status, ViewTabs, type Column } from '../../../design/DataTable';
import { nextSort, sortRows, type TableSort } from '../../../design/tableSort';
import type { OperationRecord } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { SquadSession } from '../../squadCommunication/api';
import { WorkspacePlayerPanel } from '../../clubOperations/WorkspacePlayerPanel';
import { dayLabel, dueWords, timeLabel } from '../fixtures';
import { sessionKind, upcoming } from './useCoachData';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

type Person = RolesWorkspace['people'][number];
interface PlayerRow { person: Person; match?: SquadSession; training?: SquadSession; restriction?: OperationRecord; consent?: OperationRecord; review?: OperationRecord; attention: boolean }

const reply = (session: SquadSession | undefined, player: number) => session?.attendance.find(entry => entry.id === player);

/** A player's answer for a session, with the session in the tooltip: coming, can't come (and why), unsure, no reply or expected. */
function ReplyCell({ session, player, now }: { session?: SquadSession; player: number; now: number }) {
    const entry = reply(session, player);
    if (!session || !entry) return EMPTY_CELL;
    const when = `${session.title} · ${dayLabel(session.starts_at, now)} ${timeLabel(session.starts_at)}`;
    if (entry.response === 'GOING') return <Status tone="accent" title={when}>Coming</Status>;
    if (entry.response === 'NOT_GOING') return <Status tone="danger" title={[when, entry.reason].filter(Boolean).join(' — ')}>Can’t come{entry.reason && <span className="gk-dt-muted"> · {entry.reason}</span>}</Status>;
    if (entry.response === 'UNSURE') return <Status tone="warning" title={when}>Unsure</Status>;
    return session.response_requested ? <Status tone="warning" title={when}>No reply</Status> : <Status title={when}>Expected</Status>;
}

/**
 * Everyone in my squads as one table for planning the week: their answer for the next match and training,
 * restrictions, consent waiting on a parent, and development reviews. A row opens the player's notes and tools.
 * On a squad's page it shows that squad only, without the toolbar.
 */
export function CoachPlayers({ data, squadId, embedded }: { data: CoachData; squadId?: number; embedded?: boolean }) {
    const [params, setParams] = useSearchParams();
    const [open, setOpen] = useState<Person | null>(null);
    const { now } = data;
    const query = embedded ? '' : params.get('q') ?? '', view = !embedded && params.get('view') === 'attention' ? 'attention' : 'all';
    const squadFilter = squadId ?? (Number(params.get('squad')) || null);
    const sortBy = params.get('sort'), descending = params.get('dir') === 'desc';
    const sort = useMemo<TableSort | null>(() => sortBy ? { by: sortBy, descending } : null, [sortBy, descending]);
    const set = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
        setParams(next, { replace: true });
    };
    const ids = data.mine.map(squad => squad.id);

    // Each squad's next match (which asks for replies) and next training.
    const sessions = new Map(data.squads?.map(squad => {
        const next = upcoming(squad, now);
        return [squad.id, { match: next.find(session => sessionKind(session) !== 'TRAINING' && session.response_requested), training: next.find(session => sessionKind(session) === 'TRAINING') }];
    }) ?? []);
    const rows = data.roles.people.filter(person => ids.includes(person.squad_id)).map((person): PlayerRow => {
        const about = data.records.rows.filter(record => record.subject_user_id === person.id);
        const next = sessions.get(person.squad_id);
        const restriction = about.find(record => record.module === 'AVAILABILITY');
        const consent = about.find(record => record.module === 'GUARDIANS' && record.status === 'PENDING');
        const review = about.filter(record => record.module === 'DEVELOPMENT').sort((a, b) => (a.data.reviewOn ?? a.due_on ?? '9999').localeCompare(b.data.reviewOn ?? b.due_on ?? '9999'))[0];
        const due = review && dueWords(review.data.reviewOn ?? review.due_on, now);
        const answers = [reply(next?.match, person.id), reply(next?.training, person.id)];
        const attention = answers.some(answer => answer?.response === 'NOT_GOING' || answer?.response === 'UNSURE') || answers[0]?.response === 'UNANSWERED'
            || Boolean(restriction || consent) || Boolean(due && due.days <= 14);
        return { person, match: next?.match, training: next?.training, restriction, consent, review, attention };
    });

    const needle = query.trim().toLocaleLowerCase();
    const inSquad = rows.filter(row => squadFilter === null || row.person.squad_id === squadFilter);
    const shown = sortRows(inSquad.filter(row => (view === 'all' || row.attention) && (!needle || row.person.name.toLocaleLowerCase().includes(needle))), sort, (row, by) => ({
        name: row.person.name.toLocaleLowerCase(), squad: row.person.squad_name, match: reply(row.match, row.person.id)?.response ?? '', training: reply(row.training, row.person.id)?.response ?? '',
        care: row.restriction ? 0 : 1, consent: row.consent ? 0 : 1, development: row.review?.data.reviewOn ?? row.review?.due_on ?? '9999',
    } as Record<string, string | number>)[by] ?? '');

    const columns: Column<PlayerRow>[] = [
        { id: 'name', label: 'Player', width: 'minmax(200px, 1.6fr)', sortable: true, render: row => <PrimaryCell lead={<Avatar name={row.person.name} size={30} />}
            title={<button type="button" className="gk-dt-primary__title" onClick={() => setOpen(row.person)}>{row.person.name}</button>} subtitle={squadFilter === null && data.mine.length > 1 ? row.person.squad_name : undefined} /> },
        { id: 'match', label: 'Next match', width: 'minmax(130px, 1.1fr)', sortable: true, render: row => <ReplyCell session={row.match} player={row.person.id} now={now} /> },
        { id: 'training', label: 'Next training', width: 'minmax(120px, 1fr)', sortable: true, render: row => <ReplyCell session={row.training} player={row.person.id} now={now} /> },
        { id: 'care', label: 'Restrictions', width: 'minmax(140px, 1.3fr)', sortable: true, render: row => row.restriction
            ? <Status tone="warning" title={row.restriction.data.restrictions || row.restriction.title}>Restricted<span className="gk-dt-muted"> · {row.restriction.data.restrictions || row.restriction.title}</span></Status> : EMPTY_CELL },
        { id: 'consent', label: 'Consent', width: 'minmax(120px, 1fr)', sortable: true, render: row => row.consent ? <Status tone="info" title={row.consent.title}>Awaiting parent</Status> : EMPTY_CELL },
        { id: 'development', label: 'Development', width: 'minmax(120px, 1fr)', sortable: true, render: row => {
            if (!row.review) return EMPTY_CELL;
            if (row.review.status === 'DRAFT') return <span title={row.review.title}>Draft</span>;
            const due = dueWords(row.review.data.reviewOn ?? row.review.due_on, now);
            return due ? <span className={`gk-dt-date${due.late ? ' gk-dt-date--late' : ''}`} title={row.review.title}>{due.late ? due.text : `Review ${due.text}`}</span> : <span title={row.review.title}>In progress</span>;
        } },
    ];
    const attentionCount = inSquad.filter(row => row.attention).length;
    const loading = !data.squads || data.records.loading;
    const table: ReactNode = loading ? <Panel><div className="cw-skeleton-rows" role="status" aria-label="Loading players">{[0, 1, 2, 3].map(i => <Skeleton key={i} height={44} />)}</div></Panel>
        : shown.length ? <DataTable label="Players" columns={columns} rows={shown} rowKey={row => `${row.person.id}-${row.person.squad_id}`} sort={sort}
            onSort={by => { const value = nextSort(sort, by); set({ sort: value?.by ?? null, dir: value?.descending ? 'desc' : null }); }}
            onOpen={row => setOpen(row.person)} actions={() => <ChevronRight className="gk-dt__chevron gk-dt__keep" aria-hidden="true" />} />
            : <Panel><EmptyNote title={needle ? 'No players match' : view === 'attention' ? 'Nobody needs attention' : 'No players yet'}>
                {needle ? 'Try another name.' : view === 'attention' ? 'Every player is expected, cleared and up to date.' : 'Players appear here when they join your squads.'}</EmptyNote></Panel>;
    const panel = open && <WorkspacePlayerPanel key={`${open.id}-${open.squad_id}`} player={open} squad={open.squad_id} squadName={open.squad_name} boot={data.boot} onClose={() => setOpen(null)} onOpen={data.openWork} />;

    if (embedded) return <Section boxed title="Players" hint={`${inSquad.length}${attentionCount ? ` · ${attentionCount} need attention` : ''}`}>{table}{panel}</Section>;
    return <PageFrame className="cw-page ch-page">
        <PageHeader title="Players" subtitle="Everyone in your squads: who’s coming, who’s restricted and what’s due." />
        <div className="gk-stack gk-stack--tight">
            <ViewTabs label="Show" value={view} onChange={id => set({ view: id === 'all' ? null : id })}
                views={[{ id: 'all', label: 'All players', count: inSquad.length }, { id: 'attention', label: 'Need attention', count: attentionCount }]} />
            <ListToolbar count={`${shown.length} shown`} onClear={query || (squadFilter && !squadId) ? () => set({ q: null, squad: null }) : undefined}>
                <SearchInput aria-label="Find a player" placeholder="Find a player" value={query} onChange={event => set({ q: event.target.value })} />
                {data.mine.length > 1 && <FilterSelect label="Squad" allLabel="All" value={squadFilter ? String(squadFilter) : ''} onChange={value => set({ squad: value || null })}
                    options={data.mine.map(squad => ({ value: String(squad.id), label: squad.name }))} />}
            </ListToolbar>
            {table}
        </div>
        {panel}
    </PageFrame>;
}
