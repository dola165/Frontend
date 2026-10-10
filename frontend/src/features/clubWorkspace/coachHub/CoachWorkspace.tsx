import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, LayoutGrid, Megaphone, Shield, Users, UsersRound } from 'lucide-react';
import { WorkspaceShell, type WorkspaceNavItem } from '../../../design/workspace/WorkspaceShell';
import { Button, ButtonLink, EmptyNote, PageFrame, PageHeader, Panel, Skeleton } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { accessibleClubs } from '../../../components/layout/clubAccess';
import type { Bootstrap } from '../../clubOperations/api';
import { useClubOperations } from '../../clubOperations/useClubOperations';
import { useWorkspaceRoles, type RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import { focusableViews, type OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { guardWorkspaceNavigation } from '../../clubOperations/workspaceGuard';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { useClubOverview } from '../useClubOverview';
import { useNow } from '../useNow';
import { mySquadIds, personName } from './coachData';
import { useCoachRecords, useCoachSquads, type CoachSquad } from './useCoachData';
import { CoachOverview } from './CoachOverview';
import { CoachUpdates } from './CoachUpdates';
import { CoachSchedule } from './CoachSchedule';
import { CoachPlayers } from './CoachPlayers';
import { CoachTeam } from './CoachTeam';
import '../club-workspace.css';
import './coach-hub.css';

const TABS = ['updates', 'schedule', 'players', 'team'] as const;
type CoachTab = typeof TABS[number] | 'overview';

/** Everything the coach's pages share: my squads as their squad spaces see them, the records about them, and ways out to the club workspace. */
export interface CoachData {
    clubId: number; roles: RolesWorkspace; boot: Bootstrap | null; now: number;
    /** Squads from my squad-level responsibilities, in the club's order. */
    mine: RolesWorkspace['squads']; names: Map<number, string>;
    squads: CoachSquad[] | null; records: ReturnType<typeof useCoachRecords>; events: ScheduleEventOccurrence[];
    roleOf: (squad: number) => string; person: (id: number | null) => string | null;
    openWork: OpenWorkspace; workHref: (tab: string, context?: Record<string, string>) => string; openEvent: (event: ScheduleEventOccurrence) => void;
    /** Reloads the squads and records after a change made here (an update posted); `refreshRoles` after a responsibility request. */
    refresh: () => void; refreshRoles: () => void;
}

/**
 * My squads: the coach's own workspace, separate from the club's. It gathers the squads a person coaches,
 * their sessions and who's coming, updates to families, players to plan around and the coaching team,
 * and opens club tools in the club workspace when a task needs them. It owns nothing: every item opens
 * the same squad spaces and records the club uses.
 */
export function CoachWorkspace({ clubId }: { clubId: number }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [params] = useSearchParams();
    const club = useClubOverview(clubId);
    const operations = useClubOperations(clubId);
    const workspaceRoles = useWorkspaceRoles(clubId, 'all');
    const roles = workspaceRoles.data;
    const now = useNow();
    const [revision, setRevision] = useState(0);
    const squadIds = mySquadIds(roles?.views ?? []);
    const squads = useCoachSquads(squadIds, revision);
    const records = useCoachRecords(clubId, squadIds, operations.boot, revision);
    const canOpenWorkspace = accessibleClubs(user?.navigationCapabilities).some(item => item.id === clubId && item.canOpenWorkspace);

    const requested = TABS.find(tab => tab === params.get('tab')) ?? 'overview';
    const squadParam = Number(params.get('squad'));
    const tab: CoachTab = requested;
    const squadPage = tab === 'overview' && squadIds.includes(squadParam) ? squadParam : null;
    const active = squadPage ? `squad-${squadPage}` : tab;
    const href = (id: string) => id === 'workspace' ? `/clubs/${clubId}/workspace` : id.startsWith('squad-') ? `/my-squads?squad=${id.slice(6)}` : id === 'overview' ? '/my-squads' : `/my-squads?tab=${id}`;
    const workHref = (target: string, context: Record<string, string> = {}) => {
        const query = new URLSearchParams({ ...(target === 'overview' ? {} : { tab: target }), ...context }).toString();
        return `/clubs/${clubId}/workspace${query ? `?${query}` : ''}`;
    };
    const go = (to: string) => guardWorkspaceNavigation(() => navigate(to));

    const mine = roles?.squads.filter(squad => squadIds.includes(squad.id)) ?? [];
    const responsibilities = focusableViews(roles?.views ?? []);
    const unread = squads?.reduce((total, squad) => total + (squad.overview?.threads.reduce((sum, thread) => sum + thread.unread_count, 0) ?? 0), 0) ?? 0;
    const primary: WorkspaceNavItem[] = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'updates', label: 'Updates', icon: Megaphone, count: unread || undefined },
        { id: 'schedule', label: 'Schedule', icon: CalendarDays },
        { id: 'players', label: 'Players', icon: Users },
        { id: 'team', label: 'Coaching team', icon: UsersRound },
    ];
    const groups = mine.length ? [{ id: 'squads', label: 'My squads', icon: Shield, items: mine.map(squad => ({ id: `squad-${squad.id}`, label: squad.name, icon: Shield })) }] : [];
    const footer: WorkspaceNavItem[] = canOpenWorkspace ? [{ id: 'workspace', label: 'Club workspace', icon: LayoutGrid }] : [];
    const clubName = club.clubName ?? operations.boot?.clubName ?? `Club #${clubId}`;
    const sectionTitle = squadPage ? mine.find(squad => squad.id === squadPage)?.name ?? 'Squad' : primary.find(item => item.id === tab)?.label ?? 'My squads';

    let content;
    if (workspaceRoles.loading) content = <PageFrame className="cw-page"><div className="cw-loading" role="status" aria-label="Loading your squads"><Skeleton height={34} width="30%" /><Skeleton height={18} width="25%" /><Skeleton height={220} /><Skeleton height={280} /></div></PageFrame>;
    else if (!roles) content = <PageFrame className="cw-page"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{workspaceRoles.error || 'Your squads could not be loaded.'}</span><Button size="sm" onClick={workspaceRoles.refresh}>Try again</Button></div></PageFrame>;
    else {
        const roleOf = (squad: number) => responsibilities.filter(view => !view.clubWide && view.squadIds.includes(squad)).map(view => view.label).join(', ');
        const data: CoachData = {
            clubId, roles, boot: operations.boot, now, mine, names: new Map(roles.squads.map(squad => [squad.id, squad.name])), squads, records, events: club.schedule.events,
            roleOf, person: id => personName(roles, operations.boot, id),
            openWork: (target, context) => go(workHref(target, context)), workHref,
            openEvent: event => go(`/calendar?clubId=${clubId}&date=${event.startsAt.slice(0, 10)}&eventId=${event.eventId}`),
            refresh: () => setRevision(value => value + 1), refreshRoles: workspaceRoles.refresh,
        };
        // Without a squad yet, the coaching team page still lets a person ask for one.
        content = !mine.length && tab !== 'team' ? <PageFrame className="cw-page"><PageHeader title="My squads" subtitle={clubName} />
            <Panel><EmptyNote title="No squads yet" action={<ButtonLink size="sm" to="/my-squads?tab=team">Ask for a squad</ButtonLink>}>
                When the club makes you a coach of a squad, it appears here with its sessions, players, families and coaching team.{canOpenWorkspace ? ' Club tools stay in the club workspace.' : ''}
            </EmptyNote></Panel></PageFrame>
            : tab === 'updates' ? <CoachUpdates data={data} />
            : tab === 'schedule' ? <CoachSchedule data={data} />
                : tab === 'players' ? <CoachPlayers data={data} />
                    : tab === 'team' ? <CoachTeam data={data} />
                        : <CoachOverview data={data} squadId={squadPage} />;
    }

    return <WorkspaceShell label="My squads" storageKey={`coach-${clubId}`} guard={guardWorkspaceNavigation}
        context={{ name: clubName, crest: club.clubLogoUrl, role: responsibilities.map(view => view.label).join(', ') || 'Club staff', back: { label: 'Club page', to: `/clubs/${clubId}` } }}
        primary={primary} groups={groups} footer={footer} active={active} onSelect={id => go(href(id))} hrefFor={href} sectionTitle={sectionTitle}>
        {content}
    </WorkspaceShell>;
}
