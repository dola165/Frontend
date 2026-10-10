import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CircleHelp, ClipboardCheck, Goal, HeartPulse, Megaphone, MessageCircle, PenLine, type LucideIcon } from 'lucide-react';
import { Avatar, Button, ButtonLink, EmptyNote, List, ListRow, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../../design/primitives';
import { formatDate } from '../../../utils/formatting';
import { ActivityLegend } from '../DayAgenda';
import { coachNeeds, type CoachNeed, type NeedKind } from './coachNeeds';
import { CoachSquads } from './CoachSquads';
import { CoachPlayers } from './CoachPlayers';
import { NextUp } from './NextUp';
import { WeekStrip } from './WeekStrip';
import { SquadSwitch } from './CoachVisuals';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

const needIcons: Record<NeedKind, LucideIcon> = { reply: CircleHelp, message: MessageCircle, update: Megaphone, restriction: HeartPulse, consent: PenLine, development: Goal, task: ClipboardCheck };

/**
 * The coach's overview: what's next and who's coming, the week at a glance, the squads, and everything waiting
 * for me. The squad switcher narrows it to one squad, whose players then take the squads' place.
 */
export function CoachOverview({ data }: { data: CoachData }) {
    const { now, names } = data;
    const squads = data.squads?.filter(item => data.shown.includes(item.id)) ?? null;
    const needs = squads ? coachNeeds({ club: data.clubId, squads, names, now, person: data.person,
        records: data.records.rows.filter(record => record.squad_id !== null && data.shown.includes(record.squad_id)),
        mine: data.focus ? data.records.mine.filter(record => record.squad_id === data.focus) : data.records.mine }) : [];
    const squad = data.focus ? data.mine.find(item => item.id === data.focus) : null;

    return <PageFrame className="cw-page ch-page">
        <PageHeader title={squad?.name ?? 'My squads'} subtitle={formatDate(new Date(now), { weekday: 'long', day: 'numeric', month: 'long' })}
            actions={<ButtonLink variant="primary" to={data.link('updates', { compose: '1' })}><Megaphone aria-hidden="true" />Post an update</ButtonLink>} />
        <SquadSwitch data={data} />
        {/* On narrow screens the columns dissolve: next up, what needs me, the week, the squads, the coaches. */}
        <div className="gk-grid gk-grid--split ch-overview">
            <div className="gk-stack ch-overview__column">
                <div className="ch-slot" data-slot="next"><NextUp data={data} /></div>
                <div className="ch-slot" data-slot="week"><WeekStrip data={data} /></div>
                <div className="ch-slot" data-slot="squads">{squad ? <CoachPlayers data={data} embedded /> : <CoachSquads data={data} />}</div>
            </div>
            <div className="gk-stack ch-overview__column">
                <div className="ch-slot" data-slot="needs"><NeedsYou needs={needs} loading={!squads || data.records.loading} error={data.records.error} /></div>
                <div className="ch-slot" data-slot="coaches"><CoachFaces data={data} /></div>
            </div>
        </div>
        <ActivityLegend />
    </PageFrame>;
}

/** Everything waiting for me, most urgent first: what kind it is at a glance, what it is, and its state in a word or two. */
function NeedsYou({ needs, loading, error, limit = 6 }: { needs: CoachNeed[]; loading: boolean; error: string; limit?: number }) {
    const [all, setAll] = useState(false);
    const shown = all ? needs : needs.slice(0, limit);
    return <Section boxed title="Needs you" hint={!loading && needs.length ? `${needs.length}` : undefined}>
        <Panel flush>
            {error && <div className="cw-panel-notice"><div className="gk-notice gk-notice--danger" role="alert">{error}</div></div>}
            {loading ? <div className="cw-skeleton-rows" role="status" aria-label="Loading what needs you">{[0, 1, 2].map(i => <Skeleton key={i} height={44} />)}</div>
                : shown.length ? <List label="Needs you">{shown.map(need => {
                    const Icon = needIcons[need.kind];
                    return <ListRow key={need.key} to={need.to} lead={<span className="ch-need" data-tone={need.tone}><Icon aria-hidden="true" /></span>} title={need.title} meta={need.meta}
                        trail={<><span className={`cw-status cw-status--${need.tone}`}>{need.status}</span><ChevronRight className="cw-chevron" aria-hidden="true" /></>} />;
                })}</List>
                    : <EmptyNote title="All clear">Nothing is waiting for you.</EmptyNote>}
            {needs.length > limit && <div className="gk-panel__foot"><Button size="sm" variant="ghost" onClick={() => setAll(value => !value)}>{all ? 'Show fewer' : `Show all ${needs.length}`}</Button></div>}
        </Panel>
    </Section>;
}

/** The coaches on these squads as faces, each a message away. */
function CoachFaces({ data }: { data: CoachData }) {
    const coaches = new Map<number, { name: string; head: boolean }>();
    for (const squad of data.squads ?? []) {
        if (!data.shown.includes(squad.id)) continue;
        for (const coach of squad.overview?.coaches ?? []) coaches.set(coach.user_id, { name: coach.full_name, head: (coaches.get(coach.user_id)?.head ?? false) || squad.overview?.head_coach_id === coach.user_id });
    }
    return <Section boxed title="Coaches" action={<Link className="gk-section__action" to={data.link('coaches')}>All</Link>}>
        <Panel>{!data.squads ? <Skeleton height={64} />
            : <ul className="ch-faces">{[...coaches].map(([id, coach]) => {
                const me = id === data.roles.actorId;
                const body = <><Avatar name={coach.name} size={44} /><strong>{me ? 'You' : coach.name}</strong><span>{coach.head ? 'Head coach' : 'Coach'}</span></>;
                return <li key={id}>{me ? <span className="ch-faces__person">{body}</span> : <Link className="ch-faces__person" to={`/messages?chatWith=${id}`} title={`Message ${coach.name}`}>{body}</Link>}</li>;
            })}</ul>}</Panel>
    </Section>;
}
