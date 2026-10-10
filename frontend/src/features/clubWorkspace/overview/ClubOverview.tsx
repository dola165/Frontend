import { useState } from 'react';
import { CalendarDays, Send, Shield, Trophy, Users } from 'lucide-react';
import { Badge, Button, EmptyNote, FixtureRow, List, PageFrame, PageHeader, Panel, Section, Skeleton, StatTile } from '../../../design/primitives';
import type { TabItem } from '../../../components/workspace/types';
import type { Bootstrap } from '../../clubOperations/api';
import type { RoleView, RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import type { ClubManagementOverview, PlayerAffiliationStatus } from '../../clubs/domain';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { clubOverviewEn } from '../../../locales/clubOverview';
import { useCopy } from '../../../locales/useCopy';
import { formatDate } from '../../../utils/formatting';
import { dayLabel, eventSquadId, kindOf, squadAgenda, timeLabel } from '../fixtures';
import { mySquadIds } from '../coachHub/coachData';
import { OtherWork } from '../coachHub/OtherWork';
import { NeedsYou } from './NeedsYou';
import { FocusChips, PinnedTools, ResponsibilityLine, SquadList, type OverviewFocus } from './OverviewParts';
import { useNow } from '../useNow';
import '../club-workspace.css';
import './overview.css';

export interface ScheduleState {
    events: ScheduleEventOccurrence[]; loading: boolean; error: string | null;
    retry: () => void; open: () => void; openEvent: (event: ScheduleEventOccurrence) => void;
}

interface Props {
    clubId: number; clubName: string | null; overview: ClubManagementOverview | null; roles: RolesWorkspace | null; boot: Bootstrap | null;
    schedule: ScheduleState; unreadInbox: number; inboxAllowed: boolean; tryoutPending: number;
    canManageOperations: boolean; canManageLeadership: boolean;
    tabs: TabItem[]; pinned: TabItem[];
    /** The responsibilities switched on in Coach Hub; "My squads" follows them. Defaults to all of the person's own. */
    focusViews?: RoleView[];
    onOpen: OpenWorkspace; onOpenPlayers?: (status: 'ALL' | PlayerAffiliationStatus) => void;
}

const readFocus = (key: string): OverviewFocus => {
    try {
        const saved = localStorage.getItem(key) ?? 'all';
        // Earlier versions saved a responsibility; its squads are now "My squads".
        return saved.startsWith('view:') ? 'mine' : saved === 'mine' || /^squad:\d+$/.test(saved) ? saved as OverviewFocus : 'all';
    } catch { return 'all'; }
};

/** The club-wide starting point: what needs you, the coming week, totals and your pinned tools. */
export function ClubOverview({ clubId, clubName, overview, roles, boot, schedule, unreadInbox, inboxAllowed, tryoutPending, canManageOperations, canManageLeadership, tabs, pinned, focusViews, onOpen, onOpenPlayers }: Props) {
    const copy = useCopy('clubOverview', clubOverviewEn);
    const preference = `gk-club-overview:${clubId}:${roles?.actorId ?? 'me'}`;
    const [saved, setSaved] = useState(() => readFocus(preference));
    const mine = roles ? roles.squads.filter(squad => mySquadIds(focusViews ?? roles.views).includes(squad.id)) : [];
    const focus: OverviewFocus = saved === 'all' || (saved === 'mine' && mine.length > 1) || mine.some(squad => saved === `squad:${squad.id}`) ? saved : 'all';
    const choose = (value: OverviewFocus) => { setSaved(value); try { localStorage.setItem(preference, value); } catch { /* A presentation preference only. */ } };
    const focusSquads = focus === 'all' ? null : mine.filter(squad => focus === 'mine' || focus === `squad:${squad.id}`);
    const openPlayers = (status: 'ALL' | PlayerAffiliationStatus) => onOpenPlayers ? onOpenPlayers(status) : onOpen('players');
    const now = useNow();

    const stats = focusSquads === null ? <div className="gk-stats" role="group" aria-label={copy('clubTotals')}>
        <StatTile label={copy('activePlayers')} value={overview?.activePlayerCount ?? '–'} onClick={canManageOperations ? () => openPlayers('ACTIVE') : undefined} />
        <StatTile label={copy('trialists')} value={overview?.trialistCount ?? '–'} hint={overview?.overdueTrialistCount ? copy('overdueCount', { count: overview.overdueTrialistCount }) : undefined} tone={overview?.overdueTrialistCount ? 'attention' : undefined} onClick={canManageOperations ? () => openPlayers('TRIALIST') : undefined} />
        <StatTile label={copy('staff')} value={(boot?.leadership ? boot.staff.length : overview?.members.length) ?? '–'} onClick={canManageLeadership ? () => onOpen(boot?.leadership ? 'staff-duties' : 'personnel') : undefined} />
        <StatTile label={copy('inbox')} value={unreadInbox} tone={unreadInbox ? 'good' : undefined} onClick={inboxAllowed ? () => onOpen('inbox') : undefined} />
    </div> : <div className="gk-stats" role="group" aria-label={copy('squadTotals')}>
        <StatTile label={copy('squadsStat', { count: focusSquads.length })} value={focusSquads.length} onClick={() => onOpen('coach-hub')} />
        <StatTile label={copy('playersStat')} value={new Set(roles?.people.filter(p => focusSquads.some(s => s.id === p.squad_id)).map(p => p.id)).size} onClick={() => onOpen('coach-hub', { hub: 'players' })} />
        <StatTile label={copy('trainingStat')} value={roles?.sessions.filter(s => focusSquads.some(squad => squad.id === s.squad_id)).length ?? 0} />
        <StatTile label={copy('inbox')} value={unreadInbox} tone={unreadInbox ? 'good' : undefined} onClick={inboxAllowed ? () => onOpen('inbox') : undefined} />
    </div>;

    const agenda = focusSquads ? squadAgenda(roles?.sessions ?? [], schedule.events, focusSquads, now - 3 * 3_600_000, now + 7 * 86_400_000) : null;
    const clubEvents = schedule.events.filter(event => focusSquads === null || (eventSquadId(event) !== null && focusSquads.some(s => s.id === eventSquadId(event))));
    const squadName = (event: ScheduleEventOccurrence) => roles?.squads.find(s => s.id === eventSquadId(event))?.name;
    let comingUp;
    if (schedule.loading && !agenda?.length) comingUp = <div className="cw-skeleton-rows" role="status" aria-label={copy('scheduleLoading')}>{[0, 1, 2].map(i => <Skeleton key={i} height={52} />)}</div>;
    else if (schedule.error && !agenda?.length) comingUp = <div className="cw-panel-notice"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{copy('scheduleError')}</span><Button size="sm" onClick={schedule.retry}>{copy('retry')}</Button></div></div>;
    else if (agenda) comingUp = agenda.length ? <List label={copy('upcoming')}>{agenda.slice(0, 7).map(entry => entry.event
        ? <FixtureRow key={entry.key} tone={kindOf(entry.event).tone} time={timeLabel(entry.startsAt)} day={dayLabel(entry.startsAt)} title={entry.event.title} meta={[entry.squadName, entry.event.locationName].filter(Boolean).join(' · ')}
            onClick={() => schedule.openEvent(entry.event!)} label={copy('openEvent', { name: entry.event.title })} trail={<Badge tone={kindOf(entry.event).badge}>{kindOf(entry.event).label}</Badge>} />
        : <FixtureRow key={entry.key} tone="training" time={timeLabel(entry.startsAt)} day={dayLabel(entry.startsAt)} title={entry.session!.title} meta={entry.squadName}
            onClick={() => onOpen('squads', { squad: String(entry.squadId), view: 'training', session: String(entry.session!.id) })} label={copy('openSession', { name: entry.session!.title, squad: entry.squadName })} trail={<Badge tone="info">{kindOf({ eventType: 'TRAINING' }).label}</Badge>} />)}</List>
        : <EmptyNote title={copy('squadWeekEmpty')} action={<Button size="sm" onClick={() => onOpen('coach-hub')}>{copy('openCoachHub')}</Button>}>{copy('squadWeekEmptyHint')}</EmptyNote>;
    else comingUp = clubEvents.length ? <List label={copy('upcoming')}>{clubEvents.slice(0, 7).map(event => {
        const kind = kindOf(event), started = new Date(event.startsAt).getTime() <= now && new Date(event.endsAt).getTime() > now;
        // Two squads can play at the same time against the same club; the squad name tells them apart.
        return <FixtureRow key={`${event.eventId}-${event.occurrenceId}`} tone={kind.tone} time={timeLabel(event.startsAt)} day={dayLabel(event.startsAt)} title={event.title}
            meta={[squadName(event), event.locationName || copy('locationMissing')].filter(Boolean).join(' · ')} onClick={() => schedule.openEvent(event)} label={copy('openEvent', { name: event.title })}
            trail={<>{event.conflict && <Badge tone="danger">{copy('scheduleConflict')}</Badge>}{started ? <Badge tone="accent">{copy('inProgress')}</Badge> : <Badge tone={kind.badge}>{kind.label}</Badge>}</>} />;
    })}</List> : <EmptyNote title={copy('scheduleEmpty')} action={<Button size="sm" onClick={schedule.open}>{copy('openCalendar')}</Button>}>{copy('scheduleEmptyHint')}</EmptyNote>;

    const suggestions = [
        ...(tabs.some(tab => tab.id === 'squads') ? [{ id: 'squads', label: copy('squads'), hint: copy('squadsHint'), icon: Shield, open: () => onOpen('squads') }] : []),
        ...(canManageOperations ? [{ id: 'invites', label: copy('invites'), hint: overview?.pendingInvitations.length ? copy('invitesHint', { count: overview.pendingInvitations.length }) : copy('inviteNewHint'), icon: Send, open: () => onOpen('invites') }] : []),
        ...(canManageLeadership ? [{ id: 'personnel', label: copy('staff'), hint: copy('staffHint'), icon: Users, open: () => onOpen('personnel') }] : []),
        { id: 'tournament', label: copy('tournament'), hint: copy('tournamentHint'), icon: Trophy, to: '/tournaments/setup' },
    ];
    const squadsShown = focusSquads ?? (roles?.squads ?? []);
    const today = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });

    // Below the two-column width, the main and side columns dissolve so "Needs you" can come first (see overview.css).
    return <PageFrame className="cw-page">
        <PageHeader title={clubName ?? copy('workspaceTitle')} subtitle={today}
            actions={<Button variant="primary" onClick={schedule.open}><CalendarDays aria-hidden="true" />{copy('openCalendar')}</Button>} />
        <div className="gk-stack">
            {roles && <div className="cw-viewbar">
                <FocusChips value={focus} onChange={choose} allLabel={overview ? copy('wholeClub') : copy('allMyWork')} mySquads={mine} />
                <ResponsibilityLine roles={roles} onManage={() => onOpen('coach-hub', { hub: 'responsibilities' })} />
            </div>}
            {stats}
            <div className="gk-grid gk-grid--split cw-overview">
                <div className="gk-stack cw-overview__column">
                    <Section className="cw-overview__coming" title={copy('upcoming')} hint={copy('nextSevenDays')} action={<button type="button" className="gk-section__action cw-text-button" onClick={schedule.open}>{copy('seeFullWeek')}</button>}>
                        <Panel flush>{comingUp}</Panel>
                    </Section>
                    <PinnedTools className="cw-overview__pins" pinned={pinned} suggestions={suggestions} onOpen={onOpen} />
                </div>
                <div className="gk-stack cw-overview__column">
                    <NeedsYou className="cw-overview__needs" clubId={clubId} overview={overview} roles={roles} squads={focusSquads?.map(s => s.id) ?? null} canManageOperations={canManageOperations} tryoutPending={tryoutPending} onOpen={onOpen} onOpenPlayers={onOpenPlayers} />
                    {roles && squadsShown.length > 0 && <SquadList className="cw-overview__squads" title={focusSquads ? copy('squadsInView') : copy('squads')} squads={squadsShown} sessions={roles.sessions} onOpen={onOpen} />}
                    <OtherWork className="cw-overview__other" />
                </div>
            </div>
            {!roles && !overview && <EmptyNote title={copy('accessPending')}>{copy('accessPendingHint')}</EmptyNote>}
        </div>
    </PageFrame>;
}
