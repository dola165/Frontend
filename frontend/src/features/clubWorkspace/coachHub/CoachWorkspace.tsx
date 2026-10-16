import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, LayoutGrid, Megaphone, ShieldCheck, Trophy, Users, UsersRound } from 'lucide-react';
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
import { useCoachRecords, useCoachSquads, useSquadRosters, type CoachSquad, type SquadRoster } from './useCoachData';
import { MySquads } from './MySquads';
import { CoachCalendar } from './CoachCalendar';
import { CoachPlayers } from './CoachPlayers';
import { CoachUpdates } from './CoachUpdates';
import { CoachTeam } from './CoachTeam';
import { CoachMatches } from './CoachMatches';
import { SquadPage } from './SquadPage';
import { LoadProblems } from './LoadProblems';
import '../club-workspace.css';
import './coach-hub.css';

const TABS = ['calendar', 'players', 'updates', 'coaches', 'matches'] as const;
type CoachTab = typeof TABS[number] | 'overview';

/** Everything the coach's pages share: my squads as their squad spaces see them, the records about them, and ways out to the club workspace. */
export interface CoachData {
    clubId: number; clubName: string; clubLogo: string | null; roles: RolesWorkspace; boot: Bootstrap | null; now: number;
    /** Squads from my squad-level responsibilities, in the club's order. */
    mine: RolesWorkspace['squads']; names: Map<number, string>;
    /** The squad picked in the switcher, or null for all of mine; `shown` is what every page shows. */
    focus: number | null; shown: number[];
    squads: CoachSquad[] | null; rosters: SquadRoster[] | null;
    /** Reads a squad's parts again after some failed (`CoachSquad.failed`); `retrying` holds the squads being read. */
    retrySquad: (squad: number) => void; retrying: number[]; revision: number; records: ReturnType<typeof useCoachRecords>; events: ScheduleEventOccurrence[];
    roleOf: (squad: number) => string; person: (id: number | null) => string | null;
    /** A My squads page, keeping the squad picked in the switcher. */
    link: (tab: string, extra?: Record<string, string>) => string;
    openWork: OpenWorkspace; workHref: (tab: string, context?: Record<string, string>) => string; openEvent: (event: ScheduleEventOccurrence) => void;
    /** Reloads the squads and records after a change made here (an update posted); `refreshRoles` after a responsibility request. */
    refresh: () => void; refreshRoles: () => void;
}

/**
 * My squads: the coach's own workspace, separate from the club's. It gathers the squads a person coaches,
 * their calendar and who's coming, players, updates to parents and the coaching team, and opens club tools
 * in the club workspace when a task needs them. It owns nothing: every item opens the same squad spaces and
 * records the club uses. One squad switcher at the top narrows every page.
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
    const { squads, retry: retrySquad, retrying } = useCoachSquads(squadIds, revision);
    const records = useCoachRecords(clubId, squadIds, operations.boot, revision);
    const rosters = useSquadRosters(clubId, squadIds, revision);
    const canOpenWorkspace = accessibleClubs(user?.navigationCapabilities).some(item => item.id === clubId && item.canOpenWorkspace);

    // Older links named the schedule and the team differently.
    const raw = params.get('tab'), tab: CoachTab = raw === 'schedule' ? 'calendar' : raw === 'team' ? 'coaches' : TABS.find(item => item === raw) ?? 'overview';
    // On the first page a chosen squad opens its own page; on the others the switcher narrows the list.
    const focus = squadIds.find(id => String(id) === params.get('squad')) ?? null;
    // The first tab always returns to all squads; the other tabs keep the squad picked in the switcher.
    const href = (id: string) => id === 'workspace' ? `/clubs/${clubId}/workspace` : id === 'overview' ? '/my-squads' : `/my-squads?tab=${id}${focus ? `&squad=${focus}` : ''}`;
    const workHref = (target: string, context: Record<string, string> = {}) => {
        const query = new URLSearchParams({ ...(target === 'overview' ? {} : { tab: target }), ...context }).toString();
        return `/clubs/${clubId}/workspace${query ? `?${query}` : ''}`;
    };
    const go = (to: string) => guardWorkspaceNavigation(() => navigate(to));

    const mine = roles?.squads.filter(squad => squadIds.includes(squad.id)) ?? [];
    const responsibilities = focusableViews(roles?.views ?? []);
    const unread = squads?.reduce((total, squad) => total + (squad.overview?.threads.reduce((sum, thread) => sum + thread.unread_count, 0) ?? 0), 0) ?? 0;
    const primary: WorkspaceNavItem[] = [
        { id: 'overview', label: 'My squads', icon: ShieldCheck },
        { id: 'players', label: 'Players', icon: Users },
        { id: 'updates', label: 'Updates', icon: Megaphone, count: unread || undefined },
        { id: 'coaches', label: 'Coaches', icon: UsersRound },
        { id: 'matches', label: 'Matches', icon: Trophy },
    ];
    // The calendar sits with the club workspace at the bottom: most coaches keep their timetable on paper (the owner, 14 October).
    const footer: WorkspaceNavItem[] = [{ id: 'calendar', label: 'Calendar', icon: CalendarDays }, ...(canOpenWorkspace ? [{ id: 'workspace', label: 'Club workspace', icon: LayoutGrid }] : [])];
    const clubName = club.clubName ?? operations.boot?.clubName ?? `Club #${clubId}`;

    let content;
    if (workspaceRoles.loading) content = <PageFrame className="cw-page"><div className="cw-loading" role="status" aria-label="Loading your squads"><Skeleton height={34} width="30%" /><Skeleton height={220} /><Skeleton height={280} /></div></PageFrame>;
    else if (!roles) content = <PageFrame className="cw-page"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{workspaceRoles.error || 'Your squads could not be loaded.'}</span><Button size="sm" onClick={workspaceRoles.refresh}>Try again</Button></div></PageFrame>;
    else {
        const data: CoachData = {
            clubId, clubName, clubLogo: club.clubLogoUrl, roles, boot: operations.boot, now, mine, names: new Map(roles.squads.map(squad => [squad.id, squad.name])),
            focus, shown: focus ? [focus] : squadIds, squads, rosters, retrySquad, retrying, revision, records, events: club.schedule.events,
            roleOf: squad => responsibilities.filter(view => !view.clubWide && view.squadIds.includes(squad)).map(view => view.label).join(', '),
            person: id => personName(roles, operations.boot, id),
            link: (target, extra = {}) => { const query = new URLSearchParams({ ...(target === 'overview' ? {} : { tab: target }), ...(focus ? { squad: String(focus) } : {}), ...extra }).toString(); return `/my-squads${query ? `?${query}` : ''}`; },
            openWork: (target, context) => go(workHref(target, context)), workHref,
            openEvent: event => go(`/calendar?clubId=${clubId}&date=${event.startsAt.slice(0, 10)}&eventId=${event.eventId}`),
            refresh: () => setRevision(value => value + 1), refreshRoles: workspaceRoles.refresh,
        };
        // Without a squad yet, the coaches page still lets a person ask for one.
        const page = !mine.length && tab !== 'coaches' ?<PageFrame className="cw-page"><PageHeader title="My squads" subtitle={clubName} />
            <Panel><EmptyNote title="No squads yet" action={<ButtonLink size="sm" to="/my-squads?tab=coaches">Ask for a squad</ButtonLink>}>
                When the club makes you a coach of a squad, it appears here with its calendar, players, parents and coaches.
            </EmptyNote></Panel></PageFrame>
            : tab === 'calendar' ? <CoachCalendar data={data} />
                : tab === 'players' ? <CoachPlayers data={data} />
                    : tab === 'updates' ? <CoachUpdates data={data} />
                        : tab === 'coaches' ? <CoachTeam data={data} />
                            : tab === 'matches' ? <CoachMatches data={data} />
                            : focus ? <SquadPage data={data} squad={focus} />
                            : <MySquads data={data} />;
        // A part that failed to load is said once above the page, with its retry; the parts that loaded stay usable.
        content = <><LoadProblems data={data} />{page}</>;
    }

    return <WorkspaceShell label="My squads" storageKey={`coach-${clubId}`} guard={guardWorkspaceNavigation}
        context={{ name: clubName, crest: club.clubLogoUrl, role: responsibilities.map(view => view.label).join(', ') || 'Club staff', back: { label: 'Club page', to: `/clubs/${clubId}` } }}
        primary={primary} groups={[]} footer={footer} active={tab} onSelect={id => go(href(id))} hrefFor={href} sectionTitle={primary.find(item => item.id === tab)?.label ?? 'My squads'}>
        {content}
    </WorkspaceShell>;
}
