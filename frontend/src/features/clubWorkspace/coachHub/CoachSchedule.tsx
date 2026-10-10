import { useEffect, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ClipboardCheck } from 'lucide-react';
import { ButtonLink, EmptyNote, PageFrame, PageHeader, Panel, Skeleton } from '../../../design/primitives';
import { DataTable, FilterSelect, ListToolbar, PrimaryCell, Status, ViewTabs, type Column, type RowGroup } from '../../../design/DataTable';
import type { SquadSession } from '../../squadCommunication/api';
import { canReadSquad } from '../../clubOperations/squadAccess';
import { activityColors, activityIcons } from '../../schedule/activityIcons';
import { formatDate } from '../../../utils/formatting';
import { isToday, timeLabel } from '../fixtures';
import { kindNames, replies, sessionKind } from './useCoachData';
import type { CoachData } from './CoachWorkspace';
import '../day-agenda.css';
import './coach-hub.css';

const HOUR = 3_600_000, DAY = 86_400_000;
interface SessionRow { squad: number; session: SquadSession; time: number }
const dayKey = (time: number) => new Date(time).toDateString();

/** Who answered what for one session: can't come (and why) first, then unsure, no reply and coming. */
function Replies({ row, data }: { row: SessionRow; data: CoachData }) {
    const reply = replies(row.session), names = (response: string) => reply.players.filter(player => player.response === response);
    const cant = names('NOT_GOING'), unsure = names('UNSURE'), none = reply.asked ? names('UNANSWERED') : [], coming = names('GOING');
    const training = sessionKind(row.session) === 'TRAINING';
    const register = training && row.session.status === 'SCHEDULED' && row.time <= data.now + 2 * HOUR && canReadSquad(data.boot, 'ATTENDANCE', row.squad);
    const line = (label: string, people: typeof cant, withReason = false) => people.length > 0 && <p><strong>{label} ({people.length})</strong> · {people.map(player => withReason && player.reason ? `${player.name} (${player.reason})` : player.name).join(', ')}</p>;
    return <div className="ch-details">
        {row.session.status === 'CANCELLED' && <p className="ch-quiet">Cancelled{row.session.cancellation_reason ? `: ${row.session.cancellation_reason}` : ''}</p>}
        {line('Can’t come', cant, true)}{line('Unsure', unsure)}{line('No reply', none)}{line('Coming', coming)}
        {!reply.asked && !cant.length && <p className="ch-quiet">Families were not asked to reply; everyone is expected unless they say they can’t come.</p>}
        {row.session.description && <p className="ch-quiet">{row.session.description}</p>}
        <div className="gk-row">
            {register && <ButtonLink size="sm" variant="primary" to={data.workHref('attendance', { squad: String(row.squad), session: String(row.session.id) })}><ClipboardCheck aria-hidden="true" />Take register</ButtonLink>}
            <ButtonLink size="sm" to={`/squads/${row.squad}?tab=sessions&sessionId=${row.session.id}&at=${new Date(row.session.starts_at).toISOString()}`}>Open in {data.names.get(row.squad)}</ButtonLink>
        </div>
    </div>;
}

/**
 * My squads' sessions and matches by day, with who's coming. A row opens the replies (who can't come and why,
 * who hasn't answered), the register on the day, and the session in its squad space to change or cancel it.
 */
export function CoachSchedule({ data }: { data: CoachData }) {
    const [params, setParams] = useSearchParams();
    const { now, names } = data;
    const past = params.get('view') === 'past';
    const squadFilter = data.mine.some(squad => String(squad.id) === params.get('squad')) ? Number(params.get('squad')) : null;
    const focus = Number(params.get('session')) || null;
    const set = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
        next.delete('session');
        setParams(next, { replace: true });
    };
    useEffect(() => { if (focus) document.querySelector(`[data-row-key="${focus}"]`)?.scrollIntoView({ block: 'center' }); }, [focus, data.squads]);

    const rows: SessionRow[] = (data.squads ?? []).filter(squad => squadFilter === null || squad.id === squadFilter)
        .flatMap(squad => squad.sessions.map(session => ({ squad: squad.id, session, time: new Date(session.starts_at).getTime() })))
        .filter(row => past ? row.time < now - 3 * HOUR && row.time >= now - 7 * DAY : new Date(row.session.ends_at || row.session.starts_at).getTime() >= now - 3 * HOUR)
        .sort((a, b) => past ? b.time - a.time : a.time - b.time);
    const groups: RowGroup<SessionRow>[] = [];
    for (const row of rows) {
        const key = dayKey(row.time), last = groups[groups.length - 1];
        if (last?.key === key) last.rows.push(row);
        else groups.push({ key, rows: [row], label: `${isToday(row.session.starts_at, now) ? 'Today · ' : dayKey(row.time) === dayKey(now + DAY) ? 'Tomorrow · ' : ''}${formatDate(new Date(row.time), { weekday: 'long', day: 'numeric', month: 'long' })}` });
    }

    const columns: Column<SessionRow>[] = [
        { id: 'time', label: 'Time', width: '104px', render: row => <span className="gk-dt-date">{timeLabel(row.session.starts_at)}{row.session.ends_at ? `–${timeLabel(row.session.ends_at)}` : ''}</span> },
        { id: 'activity', label: 'Activity', width: 'minmax(260px, 3fr)', render: row => {
            const kind = sessionKind(row.session), Icon = activityIcons[kind];
            return <PrimaryCell lead={<span className="cw-agenda__icon" style={{ '--activity': activityColors[kind] } as CSSProperties} aria-hidden="true"><Icon /></span>}
                title={row.session.title} subtitle={[kindNames[kind], row.session.location].filter(Boolean).join(' · ')} />;
        } },
        { id: 'squad', label: 'Squad', width: 'minmax(100px, 1fr)', render: row => names.get(row.squad) },
        { id: 'replies', label: 'Who’s coming', width: 'minmax(190px, 1.6fr)', render: row => {
            if (row.session.status === 'CANCELLED') return <Status tone="danger">Cancelled</Status>;
            const reply = replies(row.session);
            return <Status tone={reply.asked && reply.none ? 'warning' : reply.asked ? 'accent' : reply.cant ? 'info' : 'neutral'}>{reply.text}</Status>;
        } },
    ];

    return <PageFrame className="cw-page ch-page">
        <PageHeader title="Schedule" subtitle="Sessions and matches for your squads, and who’s coming." actions={<ButtonLink to={`/calendar?clubId=${data.clubId}`}><CalendarDays aria-hidden="true" />Open calendar</ButtonLink>} />
        <div className="gk-stack gk-stack--tight">
            <ViewTabs label="Show" value={past ? 'past' : 'next'} onChange={id => set({ view: id === 'past' ? 'past' : null })} views={[{ id: 'next', label: 'Coming up' }, { id: 'past', label: 'Last 7 days' }]} />
            <ListToolbar count={`${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`}>
                {data.mine.length > 1 && <FilterSelect label="Squad" allLabel="All" value={squadFilter ? String(squadFilter) : ''} onChange={value => set({ squad: value || null })}
                    options={data.mine.map(squad => ({ value: String(squad.id), label: squad.name }))} />}
            </ListToolbar>
            {!data.squads ? <Panel><div className="cw-skeleton-rows" role="status" aria-label="Loading the schedule">{[0, 1, 2, 3].map(i => <Skeleton key={i} height={44} />)}</div></Panel>
                : rows.length ? <DataTable key={focus ?? 'all'} label="Schedule" columns={columns} groups={groups} rowKey={row => row.session.id} defaultOpen={focus ? [focus] : undefined}
                    details={row => <Replies row={row} data={data} />} />
                    : <Panel><EmptyNote title={past ? 'Nothing in the last 7 days' : 'Nothing planned yet'}>{past ? 'Past sessions and matches appear here for a week.' : 'Sessions and matches for your squads appear here once they are planned.'}</EmptyNote></Panel>}
        </div>
    </PageFrame>;
}
