import type { ReactNode } from 'react';
import { CalendarDays, Shield } from 'lucide-react';
import { Badge, Button, ButtonLink, EmptyNote, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../../design/primitives';
import type { TabItem } from '../../../components/workspace/types';
import type { Bootstrap } from '../../clubOperations/api';
import type { RoleView, RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import type { ClubManagementOverview, PlayerAffiliationStatus } from '../../clubs/domain';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { clubOverviewEn } from '../../../locales/clubOverview';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { formatDate } from '../../../utils/formatting';
import { eventSquadId, kindOf } from '../fixtures';
import { DayAgenda } from '../DayAgenda';
import { OtherWork } from '../coachHub/OtherWork';
import { NeedsYou } from './NeedsYou';
import { SquadGrid } from './OverviewParts';
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
    focusViews?: RoleView[];
    onOpen: OpenWorkspace; onOpenPlayers?: (status: 'ALL' | PlayerAffiliationStatus) => void;
}

/**
 * My Club for the people who run it: decisions first, then every squad, with the week alongside.
 * The club's totals are one quiet line under its name; personal squad work lives in My squads.
 */
export function ClubOverview({ clubId, clubName, overview, roles, boot, schedule, unreadInbox, inboxAllowed, tryoutPending, canManageOperations, canManageLeadership, onOpen, onOpenPlayers }: Props) {
    const copy = useCopy('clubOverview', clubOverviewEn);
    const hubCopy = useCopy('coachHub', coachHubEn);
    const openPlayers = (status: 'ALL' | PlayerAffiliationStatus) => onOpenPlayers ? onOpenPlayers(status) : onOpen('players');
    const now = useNow();

    // Each figure opens its list.
    const fact = (key: string, label: string, value: number, open?: () => void, note?: ReactNode) => {
        const body = <><span>{label}</span> <strong className="gk-num">{value}</strong>{note}</>;
        return open ? <button key={key} type="button" className="cw-fact" onClick={open}>{body}</button> : <span key={key} className="cw-fact">{body}</span>;
    };
    const facts = overview && <span className="cw-facts">
        {fact('players', copy('activePlayers'), overview.activePlayerCount ?? 0, canManageOperations ? () => openPlayers('ACTIVE') : undefined)}
        {fact('trialists', copy('trialists'), overview.trialistCount ?? 0, canManageOperations ? () => openPlayers('TRIALIST') : undefined,
            overview.overdueTrialistCount ? <span className="cw-fact__alert">{copy('overdueCount', { count: overview.overdueTrialistCount })}</span> : null)}
        {fact('staff', copy('staff'), (boot?.leadership ? boot.staff.length : overview.members.length) ?? 0, canManageLeadership ? () => onOpen(boot?.leadership ? 'staff-duties' : 'personnel') : undefined)}
        {inboxAllowed && fact('inbox', copy('inbox'), unreadInbox, () => onOpen('inbox'))}
    </span>;

    const squadName = (event: ScheduleEventOccurrence) => roles?.squads.find(s => s.id === eventSquadId(event))?.name;
    let comingUp;
    if (schedule.loading && !schedule.events.length) comingUp = <div className="cw-skeleton-rows" role="status" aria-label={copy('scheduleLoading')}>{[0, 1, 2].map(i => <Skeleton key={i} height={44} />)}</div>;
    else if (schedule.error && !schedule.events.length) comingUp = <div className="cw-panel-notice"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{copy('scheduleError')}</span><Button size="sm" onClick={schedule.retry}>{copy('retry')}</Button></div></div>;
    // Grouped by day, and same-kind entries at the same time merge into one line (DayAgenda).
    else comingUp = schedule.events.length ? <DayAgenda label={copy('upcoming')} items={schedule.events.map(event => {
        const kind = kindOf(event), started = new Date(event.startsAt).getTime() <= now && new Date(event.endsAt).getTime() > now;
        // Two squads can play at the same time against the same club; the squad name tells them apart. Live or clashing entries keep their own line.
        return { key: `${event.eventId}-${event.occurrenceId}`, startsAt: event.startsAt, title: event.title, meta: [squadName(event), event.locationName || copy('locationMissing')].filter(Boolean).join(' · '), tone: kind.tone,
            trail: <>{event.conflict && <Badge tone="danger">{copy('scheduleConflict')}</Badge>}{started ? <Badge tone="accent">{copy('inProgress')}</Badge> : <span className="gk-fixture__tag">{kind.label}</span>}</>,
            onClick: () => schedule.openEvent(event), label: copy('openEvent', { name: event.title }), kind: started || event.conflict ? undefined : event.eventType, squad: squadName(event) };
    })} /> : <EmptyNote title={copy('scheduleEmpty')} action={<Button size="sm" onClick={schedule.open}>{copy('openCalendar')}</Button>}>{copy('scheduleEmptyHint')}</EmptyNote>;

    const today = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });

    // Below the two-column width, the columns dissolve so "Needs you" comes first (see overview.css).
    return <PageFrame className="cw-page cw-club">
        <PageHeader title={clubName ?? copy('workspaceTitle')} subtitle={<><span>{today}</span>{facts}</>}
            actions={<>
                <ButtonLink variant="ghost" to={`/clubs/${clubId}`}><Shield aria-hidden="true" />{hubCopy('clubPage')}</ButtonLink>
                <Button onClick={schedule.open}><CalendarDays aria-hidden="true" />{copy('openCalendar')}</Button>
            </>} />
        <div className="gk-grid gk-grid--split cw-overview">
            <div className="gk-stack cw-overview__column">
                <NeedsYou className="cw-overview__needs" clubId={clubId} overview={overview} roles={roles} squads={null} canManageOperations={canManageOperations} tryoutPending={tryoutPending} onOpen={onOpen} onOpenPlayers={onOpenPlayers} limit={6} />
                {roles && roles.squads.length > 0 && <SquadGrid className="cw-overview__squads" title={copy('squads')} squads={roles.squads} sessions={roles.sessions} onOpen={onOpen} />}
            </div>
            <div className="gk-stack cw-overview__column">
                <Section className="cw-overview__coming" icon={CalendarDays} tone="info" title={copy('upcoming')} hint={copy('nextSevenDays')} action={<button type="button" className="gk-section__action cw-text-button" onClick={schedule.open}>{copy('seeFullWeek')}</button>}>
                    <Panel flush>{comingUp}</Panel>
                </Section>
                <OtherWork className="cw-overview__other" />
            </div>
        </div>
        {!roles && !overview && <EmptyNote title={copy('accessPending')}>{copy('accessPendingHint')}</EmptyNote>}
    </PageFrame>;
}
