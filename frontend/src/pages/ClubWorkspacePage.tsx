import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useClubAdmissions } from '../features/admissions/club/useClubAdmissions';
import { useClubAdmissionCopy } from '../features/admissions/club/copy';
import { WorkspaceOperations } from '../features/clubOperations/WorkspaceOperations';
import { WorkspaceSquads } from '../features/clubOperations/WorkspaceSquads';
import { WorkspaceRolesPanel } from '../features/clubOperations/WorkspaceRoleViews';
import { useClubOperations } from '../features/clubOperations/useClubOperations';
import { useWorkspaceRoles, type RoleView } from '../features/clubOperations/useWorkspaceRoles';
import { operationModule } from '../features/clubOperations/workspaceNavigation';
import { canonicalWorkspaceTab, legacyTabTarget, useResponsibilityFocus, type OpenWorkspace } from '../features/clubOperations/workspaceStructure';
import { canManageClubOperations, canManagePlayerStatuses, canReviewTryouts, clubRoleLabel, isLeadershipRole, type PlayerAffiliationStatus } from '../features/clubs/domain';
import { AllTools } from '../features/clubWorkspace/AllTools';
import { ClubDecisionDialogs } from '../features/clubWorkspace/ClubDecisionDialogs';
import { ClubTools } from '../features/clubWorkspace/ClubTools';
import { WorkspaceNotices } from '../features/clubWorkspace/WorkspaceNotices';
import { buildClubTabs, clubNavigation, navLabel, visibleTabs } from '../features/clubWorkspace/clubTabs';
import { guardWorkspaceNavigation } from '../features/clubOperations/workspaceGuard';
import { useCopy } from '../locales/useCopy';
import { workspaceNavEn } from '../locales/workspaceDesign';
import { CoachHub } from '../features/clubWorkspace/coachHub/CoachHub';
import { ClubOverview } from '../features/clubWorkspace/overview/ClubOverview';
import { ClubSettingsPage, ProgrammesPage } from '../features/clubWorkspace/settings/ClubSettingsPages';
import { useClubInbox } from '../features/clubWorkspace/useClubInbox';
import { useClubMembership } from '../features/clubWorkspace/useClubMembership';
import { useClubOverview } from '../features/clubWorkspace/useClubOverview';
import { SquadsPage } from '../features/clubWorkspace/squads/SquadsPage';
import { useWorkspacePins } from '../features/clubWorkspace/useWorkspacePins';
import { parseWorkspaceTab, type WorkspaceTab } from '../components/workspace/types';
import { useAuth } from '../context/AuthContext';
import { WorkspaceShell } from '../design/workspace/WorkspaceShell';
import { Button, EmptyNote, GkRoot, PageFrame, Skeleton } from '../design/primitives';
import { accessibleClubs } from '../components/layout/clubAccess';
import { getStoredUserId, type AuthSessionId } from '../utils/authStorage';
import '../features/clubWorkspace/club-workspace.css';

const NO_VIEWS: RoleView[] = [];
// Tools already built on the design system bring their own page frame.
// Context that belongs to one tool and must not follow the person to another.
const TOOL_CONTEXT = ['applicationId', 'case', 'caseId', 'admissionView', 'admissionGroup', 'record', 'approach', 'squad', 'session', 'person', 'kind', 'q', 'mine', 'state', 'view', 'playerSearch', 'position', 'return', 'from', 'hub', 'section', 'page', 'intake'];

export default function ClubWorkspacePage() {
    const { id } = useParams();
    const { isAuthenticated, sessionId } = useAuth();
    if (!isAuthenticated) return null;
    // A new club or account establishes access afresh and never inherits inbox state.
    return <ClubWorkspaceSession key={`${sessionId}:${id}`} sessionId={sessionId} />;
}

/** My squads: Coach Hub on its own page, for the club where the person has staff responsibilities. */
export function CoachHubPage() {
    const { isAuthenticated, sessionId, user } = useAuth();
    if (!isAuthenticated) return null;
    const clubId = accessibleClubs(user?.navigationCapabilities).find(club => club.canOpenWorkspace)?.id;
    if (!clubId) return <GkRoot><PageFrame><EmptyNote title="No squads yet">When a club gives you a squad, it appears here.</EmptyNote></PageFrame></GkRoot>;
    return <ClubWorkspaceSession key={`${sessionId}:${clubId}:hub`} sessionId={sessionId} hubClubId={clubId} />;
}

/** `hubClubId` renders only Coach Hub for that club, outside the workspace shell (My squads). */
function ClubWorkspaceSession({ sessionId, hubClubId }: { sessionId: AuthSessionId; hubClubId?: number }) {
    const { id: clubIdParam } = useParams<{ id: string }>();
    const hub = hubClubId !== undefined;
    const clubId = hubClubId ?? Number(clubIdParam);
    const navigate = useNavigate();
    const copy = useCopy('workspaceNav', workspaceNavEn);
    const [searchParams, setSearchParams] = useSearchParams();
    const currentUserId = Number(getStoredUserId() || 0) || null;
    const club = useClubOverview(clubId);
    const operations = useClubOperations(clubId);
    const workspaceRoles = useWorkspaceRoles(clubId, 'all');
    const roles = workspaceRoles.data;
    const { c: admissionCopy } = useClubAdmissionCopy();
    const [showHiddenSections, setShowHiddenSections] = useState(false);
    // The URL decides the open tool; until access is known, the requested one is shown as loading.
    const parsedTab = parseWorkspaceTab(searchParams.get('tab'));
    // An old "my squads" link that named a squad opens that squad; without one it opens Coach Hub.
    const requestedTab = hub ? 'coach-hub' as const : (parsedTab === 'my-squads' && searchParams.get('squad') ? 'squads' : canonicalWorkspaceTab(parsedTab)) ?? 'overview';
    const admissions = useClubAdmissions(clubId, sessionId, requestedTab === 'admissions');

    const { overview } = club;
    const currentRole = overview?.currentUserRole ?? null;
    const can = { leadership: isLeadershipRole(currentRole), operations: canManageClubOperations(currentRole), playerStatus: canManagePlayerStatuses(currentRole), owner: currentRole === 'OWNER' };
    const canReadInbox = overview !== null && club.error === null && ['OWNER', 'CLUB_ADMIN', 'COACH'].includes(currentRole ?? '');
    const inbox = useClubInbox(clubId, sessionId, canReadInbox, requestedTab === 'inbox');
    const rawApplicationId = searchParams.get('applicationId');
    const focusedApplicationId = rawApplicationId && /^[1-9]\d*$/.test(rawApplicationId) && Number.isSafeInteger(Number(rawApplicationId)) ? Number(rawApplicationId) : null;
    const membership = useClubMembership({ clubId, activeTab: requestedTab, overview, reloadOverview: club.reload, canChangePlayerStatus: can.playerStatus, focusedApplicationId });

    const tabs = buildClubTabs({
        overview, roles, boot: operations.boot, canManageLeadership: can.leadership, canManageOperations: can.operations, canManageTryouts: canReviewTryouts(currentRole),
        tryoutCount: membership.tryouts.applicants.length, admissionsLabel: admissions.data ? admissionCopy('title') : null,
        admissionsWaiting: admissions.data?.cases.filter(row => row.nextAction.owner === 'CLUB').length ?? 0,
    });
    const allowedTabIds = new Set<WorkspaceTab>([...tabs.map(tab => tab.id), ...(canReadInbox ? ['inbox' as const] : [])]);
    // A stale or hand-edited URL never opens a tool outside the current role. Access is known once the
    // roles have loaded and either the overview or the operations bootstrap has answered.
    const accessKnown = !workspaceRoles.loading && !(!overview && (club.loading || operations.loading || !operations.boot && !roles))
        && !(requestedTab === 'admissions' && admissions.loading) && !(operationModule(requestedTab) && operations.loading);
    const activeTab: WorkspaceTab = !accessKnown || allowedTabIds.has(requestedTab) ? requestedTab : roles || overview ? 'overview' : 'actions';
    const shownTabs = visibleTabs(tabs, operations.boot, activeTab, showHiddenSections);
    const focus = useResponsibilityFocus(clubId, currentUserId, roles?.views ?? NO_VIEWS);
    const settled = !workspaceRoles.loading && !operations.loading && !club.loading;
    const pins = useWorkspacePins(clubId, shownTabs, settled);
    const nav = clubNavigation(shownTabs, { focus: focus.tabs, pins: pins.pinned, inbox: { allowed: canReadInbox, unread: inbox.unreadCount } });

    // Editors with unsaved work can cancel navigation inside the workspace.
    const navigateWorkspace = guardWorkspaceNavigation;
    const switchTab = (requested: WorkspaceTab) => navigateWorkspace(() => {
        const tab = canonicalWorkspaceTab(requested)!;
        if (overview && !allowedTabIds.has(tab)) return;
        const next = new URLSearchParams(searchParams);
        if (tab !== activeTab) TOOL_CONTEXT.forEach(key => next.delete(key));
        next.delete('module'); next.delete('role');
        if (tab === 'overview') next.delete('tab'); else next.set('tab', tab);
        setSearchParams(next);
    });
    // Opening a tool from another page remembers that page, so the tool can offer the way back to it.
    const openWork: OpenWorkspace = (requested, context = {}) => navigateWorkspace(() => {
        const tab = canonicalWorkspaceTab(requested)!;
        if (!allowedTabIds.has(tab)) return;
        const next = new URLSearchParams();
        if (tab !== 'overview') next.set('tab', tab);
        // My squads is its own page: its links open the same tools inside the club workspace.
        if (hub) { Object.entries(context).forEach(([key, value]) => next.set(key, value)); navigate(`/clubs/${clubId}/workspace${next.toString() ? `?${next}` : ''}`); return; }
        if (tab !== activeTab) {
            const back = new URLSearchParams(searchParams);
            ['return', 'from', 'record'].forEach(key => back.delete(key));
            if (activeTab === 'overview') back.delete('tab'); else back.set('tab', activeTab);
            if (activeTab === 'squads' && context.squad) back.set('squad', context.squad);
            next.set('return', back.toString());
        }
        Object.entries(context).forEach(([key, value]) => next.set(key, value));
        setSearchParams(next);
    });
    const openPlayers = (status: 'ALL' | PlayerAffiliationStatus = 'TRIALIST') => {
        if (!allowedTabIds.has('players')) return;
        membership.players.show(status);
        switchTab('players');
    };
    const workSquad = searchParams.get('squad') ?? '';
    const chooseWorkSquad = (squad: string) => navigateWorkspace(() => {
        const next = new URLSearchParams(searchParams);
        if (squad) next.set('squad', squad); else next.delete('squad');
        ['session', 'person', 'record'].forEach(key => next.delete(key));
        setSearchParams(next);
    });
    const selectedOperation = operationModule(activeTab);
    const openCalendar = () => navigate(`/calendar?clubId=${clubId}`);
    const openEvent = (event: { startsAt: string; eventId: number }) => navigate(`/calendar?clubId=${clubId}&date=${event.startsAt.slice(0, 10)}&eventId=${event.eventId}`);

    useEffect(() => {
        // Keep the address in step with what is shown: rejected tools fall back, old personal tabs open Coach Hub.
        if (!accessKnown || hub) return;
        const parsed = parseWorkspaceTab(searchParams.get('tab'));
        const legacy = legacyTabTarget(parsed);
        const next = new URLSearchParams(searchParams);
        if (activeTab === 'overview') next.delete('tab'); else next.set('tab', activeTab);
        if (legacy?.hub && activeTab === legacy.tab) next.set('hub', legacy.hub);
        if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }, [accessKnown, activeTab, searchParams, setSearchParams]);

    if (!clubId) return <PageFrame><EmptyNote title="This club workspace does not exist">Check the address, or open the workspace from your club’s page.</EmptyNote></PageFrame>;

    const loading = workspaceRoles.loading || (club.loading && !overview && !operations.boot) || (selectedOperation && operations.loading);
    const failed = club.error && !overview && !operations.boot && !roles;
    // The way back only exists when the tool was opened from somewhere (never just because a squad is in the address).
    const returnTo = searchParams.get('return');
    const origin = returnTo !== null ? (() => {
        const back = new URLSearchParams(returnTo);
        const from = canonicalWorkspaceTab(parseWorkspaceTab(back.get('tab'))) ?? 'overview';
        const squadName = from === 'squads' ? roles?.squads.find(s => String(s.id) === back.get('squad'))?.name : undefined;
        return { label: copy('backTo', { name: squadName ?? navLabel(from) }), onBack: () => navigateWorkspace(() => setSearchParams(back)) };
    })() : undefined;

    let content: ReactNode;
    if (loading) content = <PageFrame className="cw-page"><div className="cw-loading" role="status" aria-label="Loading the workspace"><Skeleton height={34} width="40%" /><Skeleton height={18} width="25%" /><Skeleton height={96} /><Skeleton height={280} /></div></PageFrame>;
    else if (failed) content = <PageFrame className="cw-page"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{club.error}</span><Button size="sm" onClick={() => { void club.reload(); }}>Try again</Button></div></PageFrame>;
    else if (activeTab === 'overview') content = <ClubOverview clubId={clubId} clubName={club.clubName ?? operations.boot?.clubName ?? null} overview={overview} roles={roles} boot={operations.boot}
        schedule={{ ...club.schedule, open: openCalendar, openEvent }} unreadInbox={inbox.unreadCount} inboxAllowed={canReadInbox} tryoutPending={membership.tryouts.pendingCount}
        canManageOperations={can.operations} canManageLeadership={can.leadership} tabs={shownTabs} pinned={pins.pinned} focusViews={focus.selectedViews} onOpen={openWork} onOpenPlayers={allowedTabIds.has('players') ? openPlayers : undefined} />;
    else if (activeTab === 'coach-hub') content = roles && <CoachHub page={hub ? { clubName: club.clubName ?? operations.boot?.clubName ?? `Club #${clubId}`, workspace: allowedTabIds.has('overview') } : undefined} clubId={clubId} roles={roles} boot={operations.boot} focus={focus} events={club.schedule.events} legacyHub={legacyTabTarget(parseWorkspaceTab(searchParams.get('tab')))?.hub}
        onOpenCalendar={openCalendar} onOpenEvent={openEvent} onOpen={openWork} onChanged={() => { workspaceRoles.refresh(); void operations.refresh(); }} />;
    else if (activeTab === 'tools') content = <AllTools tabs={shownTabs} pins={pins} focus={focus.tabs} onOpen={openWork} showHidden={showHiddenSections} onShowHidden={setShowHiddenSections}
        hasHidden={Boolean(operations.boot?.modules.some(m => !operations.boot?.settings.enabled_modules.includes(m.id)))} />;
    else if (activeTab === 'settings') content = <ClubSettingsPage clubId={clubId} busy={membership.pendingKey != null} />;
    else if (activeTab === 'programmes') content = <ProgrammesPage clubId={clubId} />;
    else if (activeTab === 'squads' && can.operations) content = <SquadsPage key={clubId} clubId={clubId} overview={overview} setParentError={membership.setErrorMessage} setParentSuccess={membership.setSuccessMessage}
        workspace={roles ? { data: roles, boot: operations.boot, onOpen: openWork } : undefined} />;
    else if (activeTab === 'squads') content = roles && <WorkspaceSquads data={roles} boot={operations.boot} squad={workSquad} onSquad={chooseWorkSquad} onOpen={openWork} />;
    else if (activeTab === 'role-requests') content = roles && (<WorkspaceRolesPanel club={clubId} data={roles} onChanged={() => { workspaceRoles.refresh(); void operations.refresh(); }} />);
    else if (selectedOperation) content = operations.boot
        ? <WorkspaceOperations key={`${clubId}-${selectedOperation}-${workSquad}-${searchParams.get('session') ?? ''}-${searchParams.get('person') ?? ''}`} boot={{ ...operations.boot, peopleBySquad: roles?.people }} module={selectedOperation} onRefresh={operations.refresh} origin={origin} />
        : <PageFrame className="cw-page"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{operations.error || 'This section is unavailable for your account.'}</span><Button size="sm" onClick={() => { void operations.refresh(); }}>Try again</Button></div></PageFrame>;
    else content = <ClubTools tab={activeTab} clubId={clubId} sessionId={sessionId} currentUserId={currentUserId} overview={overview} reloadOverview={club.reload}
        roles={roles} refreshRoles={workspaceRoles.refresh} boot={operations.boot} refreshBoot={() => { void operations.refresh(); }} admissions={admissions} admissionCopy={admissionCopy}
        membership={membership} inbox={inbox} can={can} allowed={tab => allowedTabIds.has(tab)} focusedApplicationId={focusedApplicationId}
        clearApplicationFocus={() => { const next = new URLSearchParams(searchParams); next.delete('applicationId'); setSearchParams(next); }}
        switchTab={switchTab} openWork={openWork} openPlayers={openPlayers} />;

    if (hub) return <>
        <GkRoot className="cw-hub-page">
            <WorkspaceNotices error={membership.errorMessage} success={membership.successMessage} rolesError={workspaceRoles.error || null}
                onDismissError={() => membership.setErrorMessage(null)} onDismissSuccess={() => membership.setSuccessMessage(null)} onRetryRoles={workspaceRoles.refresh} />
            {content}
        </GkRoot>
        <ClubDecisionDialogs membership={membership} />
    </>;

    const clubName = club.clubName ?? operations.boot?.clubName ?? `Club #${clubId}`;
    const current = [...nav.primary, ...nav.groups.flatMap(g => g.items), ...nav.more.flatMap(g => g.items), ...nav.footer].find(item => item.id === activeTab);
    return <>
        <WorkspaceShell label={copy('workspace')} storageKey={`club-${clubId}`} guard={navigateWorkspace}
            context={{ name: clubName, crest: club.clubLogoUrl, role: currentRole ? clubRoleLabel(currentRole) : roles ? focus.available.map(v => v.label).join(', ') || copy('clubStaff') : null, back: { label: copy('clubPage'), to: `/clubs/${clubId}` } }}
            primary={nav.primary} pinned={nav.pinned} groups={nav.groups} more={nav.more} footer={nav.footer}
            active={activeTab} onSelect={id => switchTab(id as WorkspaceTab)} hrefFor={id => `/clubs/${clubId}/workspace${id === 'overview' ? '' : `?tab=${id}`}`}
            sectionTitle={current?.label ?? copy('workspace')}>
            <WorkspaceNotices error={membership.errorMessage} success={membership.successMessage} rolesError={workspaceRoles.error || null}
                onDismissError={() => membership.setErrorMessage(null)} onDismissSuccess={() => membership.setSuccessMessage(null)} onRetryRoles={workspaceRoles.refresh} />
            {content}
        </WorkspaceShell>
        <ClubDecisionDialogs membership={membership} />
    </>;
}
