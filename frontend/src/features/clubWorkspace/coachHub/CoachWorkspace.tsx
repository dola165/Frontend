import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Contact, Megaphone, ShieldCheck, Trophy, Users, UsersRound } from 'lucide-react';
import { WorkspaceShell, type WorkspaceNavItem } from '../../../design/workspace/WorkspaceShell';
import { Button, PageFrame, PageHeader, Panel, Skeleton } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import type { Bootstrap } from '../../clubOperations/api';
import { useClubOperations } from '../../clubOperations/useClubOperations';
import { useWorkspaceRoles, type RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import { focusableViews, type OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { isOfficeTool, legacyWorkspaceTarget, officePath, officeToolPath } from '../../clubOffice/officeLinks';
import { guardWorkspaceNavigation } from '../../clubOperations/workspaceGuard';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { useClubOverview } from '../useClubOverview';
import { useNow } from '../useNow';
import { coachTrainingContext, jobsOn, mySquadIds, personName } from './coachData';
import { useCoachRecords, useCoachSquads, useSquadRosters, type CoachSquad, type SquadRoster } from './useCoachData';
import { useMatchCards, useWantToJoin, type WantToJoinItem } from './useSquadCards';
import type { MatchCard } from './squadApi';
import { MySquads } from './MySquads';
import { CoachCalendar } from './CoachCalendar';
import { CoachPlayers } from './CoachPlayers';
import { CoachUpdates } from './CoachUpdates';
import { CoachTeam } from './CoachTeam';
import { CoachMatches } from './CoachMatches';
import { SquadPage } from './SquadPage';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { LoadProblems } from './LoadProblems';
import { WorkspaceGuide } from '../WorkspaceGuide';
import { NoSquadsYet } from './NoSquadsYet';
import '../club-workspace.css';
import './coach-hub.css';

const TABS = ['calendar', 'players', 'updates', 'coaches', 'matches'] as const;
type CoachTab = typeof TABS[number] | 'overview';

/** Everything the coach's pages share: my squads as their squad spaces see them, the records about them, and ways out to Club office. */
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
    /** Each squad's next match card (`null` when it could not be read); the same card for everyone on the squad. */
    cards: Map<number, MatchCard | null> | null;
    /** Want to join for the squads shown: only those who decide get any (decision 2). */
    joining: { items: WantToJoinItem[] | null; failed: boolean; refresh: () => void };
    /** A My squads page, keeping the squad picked in the switcher. */
    link: (tab: string, extra?: Record<string, string>) => string;
    openWork: OpenWorkspace; workHref: (tab: string, context?: Record<string, string>) => string; openEvent: (event: ScheduleEventOccurrence) => void;
    /** Reloads the squads and records after a change made here (an update posted); `refreshRoles` after a responsibility request. */
    refresh: () => void; refreshRoles: () => void;
}

/**
 * My squads: one page for everyone on a squad (step 3, 29 October 2026). Head and assistant coaches, team managers,
 * specialist coaches and travel coordinators see the same places, the same week and the same next match; the head of
 * coaching is on every squad. A job decides which squads someone is on and which buttons work, never what the page
 * looks like; Needs you is personal. It owns nothing: every item opens the same squad spaces and records the club uses.
 * One squad switcher at the top narrows every page.
 */
export function CoachWorkspace({ clubId }: { clubId: number }) {
    const navigate = useNavigate();
    const copy = useCopy('coachHub', coachHubEn);
    const { user } = useAuth();
    const [params] = useSearchParams();
    const club = useClubOverview(clubId);
    const operations = useClubOperations(clubId);
    const workspaceRoles = useWorkspaceRoles(clubId, 'all', user?.id ?? null);
    const roles = workspaceRoles.data;
    const now = useNow();
    const [revision, setRevision] = useState(0);
    const squadIds = mySquadIds(roles?.views ?? []);
    const { squads, retry: retrySquad, retrying } = useCoachSquads(squadIds, revision);
    const records = useCoachRecords(clubId, squadIds, operations.boot, revision);
    const rosters = useSquadRosters(clubId, squadIds, revision);
    const matchCards = useMatchCards(squadIds, revision);

    // Older links named the schedule and the team differently.
    const raw = params.get('tab'), tab: CoachTab = raw === 'schedule' ? 'calendar' : raw === 'team' ? 'coaches' : TABS.find(item => item === raw) ?? 'overview';
    // On the first page a chosen squad opens its own page; on the others the switcher narrows the list.
    const focus = squadIds.find(id => String(id) === params.get('squad')) ?? null;
    const joining = useWantToJoin(clubId, focus ? [focus] : squadIds, !focus, revision);
    const toDecide = joining.items?.filter(item => item.state === 'DECIDE').length ?? 0;
    // The first tab always returns to all squads; the other tabs keep the squad picked in the switcher.
    const coachHref = (context: Record<string, string> = {}) => {
        const query = new URLSearchParams({ ...context, ...(params.has('clubId') ? { clubId: String(clubId) } : {}) }).toString();
        return `/my-squads${query ? `?${query}` : ''}`;
    };
    const href = (id: string) => id === 'staff' ? officePath(clubId) : coachHref(id === 'overview' ? {} : { tab: id, ...(focus ? { squad: String(focus) } : {}) });
    // A club tool opens in Club office's More tools; anything else where it lives now (the calendar on its date, a
    // squad the person coaches in My squads), as an old club workspace address would.
    const workHref = (target: string, context: Record<string, string> = {}) => isOfficeTool(target) ? officeToolPath(clubId, target, context)
        : legacyWorkspaceTarget(clubId, new URLSearchParams({ tab: target, ...context }), user?.navigationCapabilities);
    const go = (to: string) => guardWorkspaceNavigation(() => navigate(to));

    const mine = roles?.squads.filter(squad => squadIds.includes(squad.id)) ?? [];
    const responsibilities = focusableViews(roles?.views ?? []);
    const unread = squads?.reduce((total, squad) => total + (squad.overview?.threads.reduce((sum, thread) => sum + thread.unread_count, 0) ?? 0), 0) ?? 0;
    const primary: WorkspaceNavItem[] = [
        { id: 'overview', label: copy('mySquads'), icon: ShieldCheck },
        { id: 'players', label: copy('players'), icon: Users, count: toDecide || undefined },
        { id: 'updates', label: copy('updates'), icon: Megaphone, count: unread || undefined },
        { id: 'coaches', label: copy('coaches'), icon: UsersRound },
        { id: 'matches', label: copy('matches'), icon: Trophy },
    ];
    // The calendar and Staff sit at the bottom: most coaches keep their timetable on paper (the owner, 14 October), and
    // Staff is the same list everyone on the staff reads in Club office (28 October).
    const footer: WorkspaceNavItem[] = [{ id: 'calendar', label: copy('calendar'), icon: CalendarDays }, { id: 'staff', label: copy('staff'), icon: Contact }];
    const clubName = club.clubName ?? operations.boot?.clubName ?? `Club #${clubId}`;

    let content;
    if (workspaceRoles.loading && !roles) content = <PageFrame className="cw-page"><div className="cw-loading" role="status" aria-label={copy('loadingSquads')}><Skeleton height={34} width="30%" /><Skeleton height={220} /><Skeleton height={280} /></div></PageFrame>;
    else if (!roles) content = <PageFrame className="cw-page"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{workspaceRoles.error || copy('squadsLoadError')}</span><Button size="sm" onClick={workspaceRoles.refresh}>{copy('tryAgain')}</Button></div></PageFrame>;
    else {
        const data: CoachData = {
            clubId, clubName, clubLogo: club.clubLogoUrl, roles, boot: operations.boot, now, mine, names: new Map(roles.squads.map(squad => [squad.id, squad.name])),
            focus, shown: focus ? [focus] : squadIds, squads, rosters, retrySquad, retrying, revision, records, events: club.schedule.events,
            roleOf: squad => jobsOn(roles.views, squad).join(', '),
            person: id => personName(roles, operations.boot, id), cards: matchCards.cards, joining,
            link: (target, extra = {}) => coachHref({ ...(target === 'overview' ? {} : { tab: target }), ...(focus ? { squad: String(focus) } : {}), ...extra }),
            openWork: (target, context) => go(workHref(target, context)), workHref,
            openEvent: event => go(`/calendar?clubId=${clubId}&date=${event.startsAt.slice(0, 10)}&eventId=${event.eventId}`),
            refresh: () => setRevision(value => value + 1), refreshRoles: workspaceRoles.refresh,
        };
        // Without a squad yet, the coaches page still lets a person ask for one.
        const page = !mine.length && tab !== 'coaches' ?<PageFrame className="cw-page"><PageHeader title={copy('mySquads')} subtitle={clubName} />
            <Panel><NoSquadsYet clubId={clubId} leadership={roles.leadership} /></Panel></PageFrame>
            : tab === 'calendar' ? <CoachCalendar data={data} />
                : tab === 'players' ? <CoachPlayers data={data} />
                    : tab === 'updates' ? <CoachUpdates data={data} />
                        : tab === 'coaches' ? <CoachTeam data={data} />
                            : tab === 'matches' ? <CoachMatches data={data} />
                            : focus ? <SquadPage squad={focus} backTo={href('overview')} />
                            : <MySquads data={data} />;
        // A part that failed to load is said once above the page, with its retry; the parts that loaded stay usable.
        content = <>{operations.boot && <WorkspaceGuide boot={operations.boot} roles={roles} suspended={tab !== 'overview' || Boolean(focus)}
            training={coachTrainingContext(clubId, operations.boot.actorId, mine, squads, now)}
            onOpenSchedule={next => go(coachHref(next ? { squad: String(next.squadId), view: 'schedule', session: String(next.session.id), at: next.session.starts_at } : { tab: 'calendar' }))}
            onRefresh={() => { data.refresh(); data.refreshRoles(); return operations.refresh(); }} />}
            <LoadProblems data={data} />{page}</>;
    }

    return <WorkspaceShell label={copy('mySquads')} storageKey={`coach-${clubId}`} guard={guardWorkspaceNavigation}
        context={{ name: clubName, crest: club.clubLogoUrl, role: responsibilities.map(view => view.label).join(', ') || copy('clubStaff'), back: { label: copy('clubPage'), to: `/clubs/${clubId}` } }}
        primary={primary} footer={footer} active={tab} onSelect={id => go(href(id))} hrefFor={href} sectionTitle={primary.find(item => item.id === tab)?.label ?? copy('mySquads')}>
        {roles && workspaceRoles.error && <div className="gk-notice gk-notice--warning" role="alert">
            <span>{copy('squadsLoadError')}</span><Button size="sm" onClick={workspaceRoles.refresh}>{copy('tryAgain')}</Button>
        </div>}
        {content}
    </WorkspaceShell>;
}
