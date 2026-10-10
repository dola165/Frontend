import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, Megaphone } from 'lucide-react';
import { Avatar, Button, ButtonLink, EmptyNote, List, ListRow, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../../design/primitives';
import { formatDate } from '../../../utils/formatting';
import { canReadSquad } from '../../clubOperations/squadAccess';
import { ActivityLegend } from '../DayAgenda';
import { isToday } from '../fixtures';
import { coachNeeds, type CoachNeed } from './coachNeeds';
import { CoachSquads } from './CoachSquads';
import { CoachWeek } from './CoachWeek';
import { CoachPlayers } from './CoachPlayers';
import { sessionKind, type CoachSquad } from './useCoachData';
import type { CoachData } from './CoachWorkspace';
import '../overview/overview.css';
import './coach-hub.css';

/**
 * The coach's overview, or one squad's page when `squadId` is set: what needs me, then my squads (or the
 * squad's players), with the coming week and the coaching team beside them.
 */
export function CoachOverview({ data, squadId }: { data: CoachData; squadId: number | null }) {
    const { now, names } = data;
    const squad = squadId === null ? null : data.mine.find(item => item.id === squadId) ?? null;
    const ids = squad ? [squad.id] : data.mine.map(item => item.id);
    const squads = data.squads?.filter(item => ids.includes(item.id)) ?? null;
    const needs = squads ? coachNeeds({ club: data.clubId, squads, names, now, person: data.person,
        records: data.records.rows.filter(record => record.squad_id !== null && ids.includes(record.squad_id)),
        mine: squad ? data.records.mine.filter(record => record.squad_id === squad.id) : data.records.mine }) : [];
    const players = new Set(data.roles.people.filter(person => ids.includes(person.squad_id)).map(person => person.id)).size;
    const colleagues = squad ? squads?.[0]?.overview?.coaches.filter(coach => coach.user_id !== data.roles.actorId).map(coach => coach.full_name) ?? [] : [];
    // A training session today offers the register straight away, where the person may take it.
    const register = squads?.flatMap(item => item.sessions.map(session => ({ squad: item.id, session })))
        .find(({ squad: id, session }) => session.status === 'SCHEDULED' && sessionKind(session) === 'TRAINING' && isToday(session.starts_at, now) && canReadSquad(data.boot, 'ATTENDANCE', id));
    const fact = (label: string, value: number) => <span className="cw-fact"><span>{label}</span> <strong className="gk-num">{value}</strong></span>;

    return <PageFrame className="cw-page ch-page">
        <PageHeader title={squad?.name ?? 'My squads'} subtitle={<>
            <span>{squad ? data.roleOf(squad.id) || 'Coach' : formatDate(new Date(now), { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <span className="cw-facts">{!squad && fact('Squads', data.mine.length)}{fact('Players', players)}{colleagues.length > 0 && <span className="cw-fact">With {colleagues.join(', ')}</span>}</span>
        </>} actions={<>
            {register && <ButtonLink to={data.workHref('attendance', { squad: String(register.squad), session: String(register.session.id) })}><ClipboardCheck aria-hidden="true" />Take register</ButtonLink>}
            <ButtonLink variant="primary" to={`?tab=updates&compose=1${squad ? `&squad=${squad.id}` : ''}`}><Megaphone aria-hidden="true" />Post an update</ButtonLink>
        </>} />
        <div className="gk-grid gk-grid--split cw-overview">
            <div className="gk-stack cw-overview__column">
                <NeedsYou needs={needs} loading={!squads || data.records.loading} error={data.records.error} />
                {squad ? <CoachPlayers data={data} squadId={squad.id} embedded /> : <CoachSquads data={data} />}
            </div>
            <div className="gk-stack cw-overview__column">
                <CoachWeek data={data} squads={squads} />
                <TeamGlance data={data} squads={squads} />
            </div>
        </div>
        <ActivityLegend />
    </PageFrame>;
}

/** Everything waiting for me, most urgent first: a dot, what it is, its state in words, an arrow. */
function NeedsYou({ needs, loading, error, limit = 7 }: { needs: CoachNeed[]; loading: boolean; error: string; limit?: number }) {
    const [all, setAll] = useState(false);
    const shown = all ? needs : needs.slice(0, limit);
    return <Section boxed className="cw-overview__needs" title="Needs you" hint={!loading && needs.length ? `${needs.length} waiting` : undefined}>
        <Panel flush>
            {error && <div className="cw-panel-notice"><div className="gk-notice gk-notice--danger" role="alert">{error}</div></div>}
            {loading ? <div className="cw-skeleton-rows" role="status" aria-label="Loading what needs you">{[0, 1, 2].map(i => <Skeleton key={i} height={44} />)}</div>
                : shown.length ? <List label="Needs you">{shown.map(need => <ListRow key={need.key} to={need.to}
                    lead={<span className={`cw-dot cw-dot--${need.tone}`} aria-hidden="true" />} title={need.title} meta={need.meta}
                    trail={<><span className={`cw-status cw-status--${need.tone}`}>{need.status}</span><ChevronRight className="cw-chevron" aria-hidden="true" /></>} />)}</List>
                    : <EmptyNote title="All clear">Replies to chase, family messages and players to plan around appear here.</EmptyNote>}
            {needs.length > limit && <div className="gk-panel__foot"><Button size="sm" variant="ghost" onClick={() => setAll(value => !value)}>{all ? 'Show fewer' : `Show all ${needs.length}`}</Button></div>}
        </Panel>
    </Section>;
}

/** The coaches on these squads, each a message away. */
function TeamGlance({ data, squads }: { data: CoachData; squads: CoachSquad[] | null }) {
    const coaches = new Map<number, { name: string; squads: string[]; head: boolean }>();
    for (const squad of squads ?? []) for (const coach of squad.overview?.coaches ?? []) {
        const entry = coaches.get(coach.user_id) ?? { name: coach.full_name, squads: [], head: false };
        entry.squads.push(data.names.get(squad.id) ?? '');
        entry.head ||= squad.overview?.head_coach_id === coach.user_id;
        coaches.set(coach.user_id, entry);
    }
    return <Section boxed title="Coaching team" hint={coaches.size ? `${coaches.size}` : undefined} action={<Link className="gk-section__action" to="?tab=team">Team</Link>}>
        <Panel flush>{!squads ? <div className="cw-skeleton-rows" role="status" aria-label="Loading the coaching team">{[0, 1].map(i => <Skeleton key={i} height={40} />)}</div>
            : coaches.size ? <List label="Coaching team">{[...coaches].map(([id, coach]) => {
                const me = id === data.roles.actorId;
                return <ListRow key={id} to={me ? undefined : `/messages?chatWith=${id}`} lead={<Avatar name={coach.name} size={28} />} title={me ? `${coach.name} (you)` : coach.name}
                    meta={[coach.head ? 'Head coach' : 'Coach', coach.squads.join(', ')].join(' · ')} trail={me ? undefined : <span className="ch-quiet">Message</span>} />;
            })}</List>
                : <EmptyNote title="No other coaches yet">Coaches the club adds to your squads appear here.</EmptyNote>}</Panel>
    </Section>;
}
