import { CalendarDays, Link2 } from 'lucide-react';
import { Badge, Button, EmptyNote, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../../design/primitives';
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
import { ActivityLegend, DayAgenda } from '../DayAgenda';
import { OtherWork } from '../coachHub/OtherWork';
import { NeedsYou } from './NeedsYou';
import { ClubNumbers } from './ClubNumbers';
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
    /** Opens the request for a responsibility, for a member who has none yet. */
    onAskAccess?: () => void;
}

/**
 * My Club for the people who run it: decisions first, then every squad, with the week alongside.
 * The club's totals are one quiet line under its name; personal squad work lives in My squads.
 */
export function ClubOverview({ clubId, clubName, overview, roles, boot, schedule, unreadInbox, inboxAllowed, tryoutPending, canManageOperations, canManageLeadership, tabs, onOpen, onOpenPlayers, onAskAccess }: Props) {
    // A member with no responsibilities: nothing waits for them, so the one next step takes the list's place.
    const noResponsibilities = Boolean(roles && boot && !boot.leadership && !boot.modules.length && !canManageOperations);
    const copy = useCopy('clubOverview', clubOverviewEn);
    const hubCopy = useCopy('coachHub', coachHubEn);
    const now = useNow();



    const squadName = (event: ScheduleEventOccurrence) => roles?.squads.find(s => s.id === eventSquadId(event))?.name;
    let comingUp;
    if (schedule.loading && !schedule.events.length) comingUp = <div className="cw-skeleton-rows" role="status" aria-label={copy('scheduleLoading')}>{[0, 1, 2].map(i => <Skeleton key={i} height={44} />)}</div>;
    else if (schedule.error && !schedule.events.length) comingUp = <div className="cw-panel-notice"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{copy('scheduleError')}</span><Button size="sm" onClick={schedule.retry}>{copy('retry')}</Button></div></div>;
    // Grouped by day, and same-kind entries at the same time merge into one line (DayAgenda).
    else comingUp = schedule.events.length ? <DayAgenda label={copy('upcoming')} items={schedule.events.map(event => {
        const kind = kindOf(event), started = new Date(event.startsAt).getTime() <= now && new Date(event.endsAt).getTime() > now;
        // Two squads can play at the same time against the same club; the squad name tells them apart. Live or clashing entries keep their own line.
        return { key: `${event.eventId}-${event.occurrenceId}`, startsAt: event.startsAt, title: event.title, meta: [squadName(event), event.locationName || copy('locationMissing')].filter(Boolean).join(' · '),
            kind: event.eventType, kindLabel: kind.label, squad: squadName(event),
            status: event.conflict || started ? <>{event.conflict && <Badge tone="danger">{copy('scheduleConflict')}</Badge>}{started && <Badge tone="accent">{copy('inProgress')}</Badge>}</> : undefined,
            onClick: () => schedule.openEvent(event), label: copy('openEvent', { name: event.title }) };
    })} /> : <EmptyNote title={copy('scheduleEmpty')} action={<Button size="sm" onClick={schedule.open}>{copy('openCalendar')}</Button>}>{copy('scheduleEmptyHint')}</EmptyNote>;

    const today = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });

    // Below the two-column width, the columns dissolve so "Needs you" comes first (see overview.css).
    return <PageFrame className="cw-page cw-club">
        <PageHeader title={clubName ?? copy('workspaceTitle')} subtitle={today}
            actions={inboxAllowed ? <Button onClick={() => onOpen('inbox')}><Link2 aria-hidden="true" />{hubCopy('clubUpdates')}{unreadInbox ? ` · ${unreadInbox}` : ''}</Button> : undefined} />
        <div className="gk-grid gk-grid--split cw-overview">
            <div className="gk-stack cw-overview__column">
                {noResponsibilities
                    ? <Section className="cw-overview__needs" boxed title={copy('needsYou')}><Panel><EmptyNote title={copy('noResponsibilities')} action={onAskAccess ? <Button size="sm" onClick={onAskAccess}>{copy('askResponsibility')}</Button> : undefined}>{copy('noResponsibilitiesHint')}</EmptyNote></Panel></Section>
                    : <NeedsYou className="cw-overview__needs" clubId={clubId} overview={overview} roles={roles} squads={null} canManageOperations={canManageLeadership} tryoutPending={tryoutPending} onOpen={onOpen} onOpenPlayers={onOpenPlayers} limit={6} />}
                {/* What a bigger club has to keep an eye on, for the people who run it. */}
                {canManageLeadership && <ClubNumbers clubId={clubId} overview={overview} roles={roles} boot={boot} tabs={tabs} tryoutPending={tryoutPending} onOpen={onOpen} onOpenPlayers={onOpenPlayers} />}
                {roles && roles.squads.length > 0 && <SquadGrid className="cw-overview__squads" title={copy('squads')} hint={[roles.season ? copy('season', { season: roles.season }) : null, `${roles.squads.length}`].filter(Boolean).join(' · ')} squads={roles.squads} sessions={roles.sessions} onOpen={onOpen} />}
            </div>
            <div className="gk-stack cw-overview__column">
                <Section className="cw-overview__coming" boxed icon={CalendarDays} title={copy('upcoming')} hint={copy('nextSevenDays')} action={<button type="button" className="gk-section__action cw-text-button" onClick={schedule.open}>{copy('seeFullWeek')}</button>}>
                    <Panel flush>{comingUp}</Panel>
                </Section>
                <OtherWork className="cw-overview__other" />
            </div>
        </div>
        <ActivityLegend />
        {!roles && !overview && <EmptyNote title={copy('accessPending')}>{copy('accessPendingHint')}</EmptyNote>}
    </PageFrame>;
}
