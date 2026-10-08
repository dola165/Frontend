import { ClubAdmissionWorkspace } from '../features/admissions/club/ClubAdmissionWorkspace';
import { useClubAdmissions } from '../features/admissions/club/useClubAdmissions';
import { useClubAdmissionCopy } from '../features/admissions/club/copy';
import { ClubStaffTeam } from '../features/clubOperations/ClubStaffTeam';
import { WorkspaceOverview } from '../features/clubOperations/WorkspaceOverview';
import { WorkspaceTools } from '../features/clubOperations/WorkspaceHome';
import { WorkspaceSquads } from '../features/clubOperations/WorkspaceSquads';
import { areaFor, canonicalWorkspaceTab, useWorkspaceShortcuts } from '../features/clubOperations/workspaceStructure';
import { WorkspaceOperations } from '../features/clubOperations/WorkspaceOperations';
import { useWorkspaceRoles } from '../features/clubOperations/useWorkspaceRoles';
import { WorkspaceRolesPanel } from '../features/clubOperations/WorkspaceRoleViews';
import { useClubOperations } from '../features/clubOperations/useClubOperations';
import { availableOperationTabs, operationModule } from '../features/clubOperations/workspaceNavigation';
import {CampaignsTab} from '../components/workspace/tabs/CampaignsTab';
import { ClubApproachesPanel } from '../features/agents/ClubApproachesPanel';
import { StoreTab } from '../components/workspace/tabs/StoreTab';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Briefcase,
    CheckCircle2,
    CreditCard,
    Crown,
    LayoutDashboard,
    Menu,
    PanelRight,
    Settings,
    ShoppingBag,
    HeartHandshake,
    ShieldCheck,
    UserPlus,
    Users,
    X
} from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import {
    clubRoleLabel,
    canManageClubOperations,
    canManagePlayerStatuses,
    canReviewTryouts,
    isLeadershipRole,
    type ClubManagedMember,
    type ClubManagementOverview,
    type ClubMembershipApplication,
    type ClubMembershipRole,
    type ClubPlayerAffiliation,
    type PlayerAffiliationStatus,
    type PageResult
} from '../features/clubs/domain';
import {
    acceptClubApplication,
    bulkDecideClubApplications,
    cancelClubInvitation,
    createClubInvitation,
    declineClubApplication,
    fetchAllClubJobs,
    fetchClubPlayers,
    fetchClubManagementOverview,
    leaveClubMembership,
    prepareStaffDeparture,
    removeClubMember,
    searchClubInviteCandidates,
    sendParentalConsentEmail,
    updateClubPlayerStatus,
    transferClubOwnership,
    updateClubMemberRole,
    type ClubJob
} from '../features/clubs/api';
import {
    fetchNotifications,
    fetchUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead
} from '../api/notifications';
import type { NotificationItem } from '../types/notifications';
import {
    emitNotificationsChanged,
    subscribeNotificationsChanged,
    buildNotificationDestination
} from '../utils/notifications';
import { extractApiErrorMessage } from '../utils/apiError';
import { getStoredUserId, isCurrentAuthSession, type AuthSessionId } from '../utils/authStorage';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ErrorBlock, PageSpinner } from '../components/workspace/helpers';
import { WorkspaceSidebar } from '../components/workspace/WorkspaceSidebar';
import { ContextPanel } from '../components/workspace/ContextPanel';
import { OverviewTab } from '../components/workspace/tabs/OverviewTab';
import { PersonnelTab } from '../components/workspace/tabs/PersonnelTab';
import { PlayersTab } from '../components/workspace/tabs/PlayersTab';
import { DecisionNoteModal } from '../components/workspace/tabs/DecisionNoteModal';
import { InvitesTab } from '../components/workspace/tabs/InvitesTab';
import { ApplicationsTab, type ApplicationFilters } from '../components/workspace/tabs/ApplicationsTab';
import { RolesTab } from '../components/workspace/tabs/RolesTab';
import { JobsTab } from '../components/workspace/tabs/JobsTab';
import { SettingsTab } from '../components/workspace/tabs/SettingsTab';
import { SquadsTab } from '../components/workspace/tabs/SquadsTab';
import { PlayerCardsTab } from '../components/workspace/tabs/PlayerCardsTab';
import { TryoutsTab } from '../components/workspace/tabs/TryoutsTab';
import { InboxTab } from '../components/workspace/tabs/InboxTab';
import '../components/workspace/workspace-design-theme.css';
import '../features/clubOperations/workspace-experience.css';
import { fetchClubSchedule, type ScheduleEventOccurrence } from '../features/schedule/api';
import { parseWorkspaceTab, type WorkspaceTab, type TabItem, type UserSearchDto, type TryoutApplicantDto } from '../components/workspace/types';

const toScheduleDateTime = (value: Date) => {
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:00`;
};

// ── page ──

export default function ClubWorkspacePage({ darkMode }: { darkMode: boolean }) {
    const { id } = useParams();
    const { isAuthenticated, sessionId } = useAuth();
    if (!isAuthenticated) return null;
    // A new club/account must establish access afresh and must not inherit inbox state.
    return <ClubWorkspaceSession key={`${sessionId}:${id}`} darkMode={darkMode} sessionId={sessionId} />;
}

function ClubWorkspaceSession({ darkMode, sessionId }: { darkMode: boolean; sessionId: AuthSessionId }) {
    const { t } = useTranslation();
    const { id: clubIdParam } = useParams<{ id: string }>();
    const clubId = Number(clubIdParam);
    const navigate = useNavigate();
    const operations = useClubOperations(clubId);
    const { c: admissionCopy } = useClubAdmissionCopy();
    const [showHiddenSections, setShowHiddenSections] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const currentUserId = Number(getStoredUserId() || 0) || null;
    const workspaceRoles = useWorkspaceRoles(clubId, 'all');

    // ── tab state ──
    const initialTab = canonicalWorkspaceTab(parseWorkspaceTab(searchParams.get('tab'))) ?? 'overview';
    const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
    const admissions = useClubAdmissions(clubId, sessionId, activeTab === 'admissions');

    const navigateWorkspace = (proceed: () => void) => {
        const event = new CustomEvent('club-workspace-navigate', { cancelable: true, detail: { proceed } });
        if (window.dispatchEvent(event)) proceed();
    };
    const switchTab = (requested: WorkspaceTab) => navigateWorkspace(() => {
        const tab=canonicalWorkspaceTab(requested)!;
        if (overview && !allowedTabIds.has(tab)) return;
        setActiveTab(tab);
        const next = new URLSearchParams(searchParams);
        if (tab !== activeTab) { ['applicationId','case','admissionView','admissionGroup','record','approach','squad','session','person','kind','q','mine','state','view','playerSearch','position','return'].forEach(key=>next.delete(key)); }
        next.delete('module');next.delete('role');
        if (tab === 'overview') {
            next.delete('tab');
        } else {
            next.set('tab', tab);
        }
        setSearchParams(next);
    });

    // ── theme (driven by global TopNav toggle) ──

    // ── confirmation dialogs ──
    const [showStatusConfirm, setShowStatusConfirm] = useState(false);
    const pendingStatusRef = useRef<{ userId: number; status: PlayerAffiliationStatus; playerName?: string } | null>(null);

    // ── data ──
    const [overview, setOverview] = useState<ClubManagementOverview | null>(null);
    const [overviewLoading, setOverviewLoading] = useState(true);
    const [overviewError, setOverviewError] = useState<string | null>(null);
    const overviewRequestRef = useRef(0);
    const [clubName, setClubName] = useState<string | null>(null);
    const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
    const clubSummaryRequestRef = useRef(0);
    const [upcomingEvents, setUpcomingEvents] = useState<ScheduleEventOccurrence[]>([]);
    const [scheduleLoading, setScheduleLoading] = useState(true);
    const [scheduleError, setScheduleError] = useState<string | null>(null);
    const scheduleRequestRef = useRef(0);
    const [workspaceNavOpen, setWorkspaceNavOpen] = useState(false);
    const [contextOpen, setContextOpen] = useState(false);
    const [tryoutApplicants, setTryoutApplicants] = useState<TryoutApplicantDto[]>([]);
    const [tryoutsLoading, setTryoutsLoading] = useState(false);
    const tryoutsRequestRef = useRef(0);
    const tryoutsCacheRef = useRef<{ key: string; loadedAt: number }>({ key: '', loadedAt: 0 });

    // Phase A3 — dedicated applications list with filters + bulk decisions.
    const [applicationsList, setApplicationsList] = useState<ClubMembershipApplication[]>([]);
    const [applicationsLoading, setApplicationsLoading] = useState(false);
    const [applicationsError, setApplicationsError] = useState<string | null>(null);
    const [applicationsFilters, setApplicationsFilters] = useState<ApplicationFilters>({ position: '', ageGroup: '', status: 'PENDING', jobId: '' });
    const [applicationPage, setApplicationPage] = useState(0), [applicationTotal, setApplicationTotal] = useState(0);
    const rawApplicationId = searchParams.get('applicationId');
    const focusedApplicationId = rawApplicationId && /^[1-9]\d*$/.test(rawApplicationId) && Number.isSafeInteger(Number(rawApplicationId)) ? Number(rawApplicationId) : null;
    const clearApplicationFocus = () => { const next = new URLSearchParams(searchParams); next.delete('applicationId'); setSearchParams(next); };
    const applicationsRequestRef = useRef(0);
    const applicationsCacheRef = useRef<{ key: string; loadedAt: number }>({ key: '', loadedAt: 0 });
    const [workspaceJobs, setWorkspaceJobs] = useState<ClubJob[]>([]);
    const jobsRequestRef = useRef(0);

    const [playerStatusFilter, setPlayerStatusFilter] = useState<'ALL' | PlayerAffiliationStatus>('ALL');
    const [playerPage, setPlayerPage] = useState(0);
    const [playerDirectory, setPlayerDirectory] = useState<PageResult<ClubPlayerAffiliation> | null>(null);
    const [playerLoading, setPlayerLoading] = useState(false);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const playersRequestRef = useRef(0);
    const playersCacheRef = useRef<{ key: string; loadedAt: number }>({ key: '', loadedAt: 0 });
    // Phase A1 — trialists filter defaults on the first time trialists exist.
    const trialistAutoSelectRef = useRef(false);
    // Phase A2 — decision-note modal targets + release gentle message.
    const [acceptTarget, setAcceptTarget] = useState<ClubMembershipApplication | null>(null);
    const [declineTarget, setDeclineTarget] = useState<ClubMembershipApplication | null>(null);
    const [tryoutAcceptTarget, setTryoutAcceptTarget] = useState<TryoutApplicantDto | null>(null);
    const [tryoutDeclineTarget, setTryoutDeclineTarget] = useState<TryoutApplicantDto | null>(null);
    const [releaseMessage, setReleaseMessage] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [searchPage, setSearchPage] = useState(0);
    const [searchResults, setSearchResults] = useState<PageResult<UserSearchDto> | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedInviteRole, setSelectedInviteRole] = useState<ClubMembershipRole>('COACH');

    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [confirmingRemovalUserId, setConfirmingRemovalUserId] = useState<number | null>(null);
    const [confirmingOwnershipTransferUserId, setConfirmingOwnershipTransferUserId] = useState<number | null>(null);
    const [confirmingSelfLeave, setConfirmingSelfLeave] = useState(false);
    const selfDepartureRef = useRef<{ requestId: string; snapshot: string } | null>(null);

    // ── inbox state ──
    const [inboxNotifications, setInboxNotifications] = useState<NotificationItem[]>([]);
    const [inboxPage, setInboxPage] = useState(0);
    const [inboxTotalElements, setInboxTotalElements] = useState(0);
    const [inboxLoading, setInboxLoading] = useState(true);
    const [inboxLoadingMore, setInboxLoadingMore] = useState(false);
    const [inboxError, setInboxError] = useState<string | null>(null);
    const [inboxBusyId, setInboxBusyId] = useState<number | null>(null);
    const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
    const inboxActiveRef = useRef(true);
    useEffect(() => { inboxActiveRef.current = true; return () => { inboxActiveRef.current = false; }; }, []);
    const inboxRequests = useRef(new Set<AbortController>());
    const canReadInbox = overview !== null && overviewError === null
        && ['OWNER', 'CLUB_ADMIN', 'COACH'].includes(overview.currentUserRole ?? '');
    useEffect(() => {
        const requests = inboxRequests.current;
        return () => {
            requests.forEach(controller => controller.abort());
            requests.clear();
        };
    }, [canReadInbox]);

    const currentRole: string | null = overview?.currentUserRole ?? null;
    const canManageLeadership = isLeadershipRole(currentRole);
    const canManageOperations = canManageClubOperations(currentRole);
    const canChangePlayerStatus = canManagePlayerStatuses(currentRole);
    const canManageTryouts = canReviewTryouts(currentRole);
    const isOwner = currentRole === 'OWNER';
    const tryoutPendingCount = useMemo(
        () => tryoutApplicants.filter((applicant) => applicant.status === 'PENDING' || applicant.status === 'SHORTLISTED').length,
        [tryoutApplicants]
    );
    const authoritativeTryoutPendingCount = overview?.pendingTryoutCount ?? tryoutPendingCount;

    const invitedUserIds = useMemo(() => new Set(overview?.pendingInvitations.map((i) => i.userId) || []), [overview]);
    const overdueTrialistCount = overview?.overdueTrialistCount ?? 0;

    // ── data loading ──

    const loadOverview = async () => {
        const requestId = ++overviewRequestRef.current;
        setOverviewLoading(true);
        setOverviewError(null);
        try {
            const response = await fetchClubManagementOverview(clubId);
            if (requestId !== overviewRequestRef.current) return;
            setOverview(response);
            if (response.assignableInviteRoles.length > 0 && !response.assignableInviteRoles.includes(selectedInviteRole)) {
                setSelectedInviteRole(response.assignableInviteRoles[0]);
            }
        } catch (error) {
            if (requestId !== overviewRequestRef.current) return;
            setOverviewError(extractApiErrorMessage(error, 'Failed to load club management data.'));
        } finally {
            if (requestId === overviewRequestRef.current) setOverviewLoading(false);
        }
    };

    const loadClubSummary = useCallback(async () => {
        const requestId = ++clubSummaryRequestRef.current;
        try {
            const response = await apiClient.get<{ name?: string; logoUrl?: string | null }>(`/clubs/${clubId}`);
            if (requestId !== clubSummaryRequestRef.current) return;
            setClubName(response.data.name ?? null);
            setClubLogoUrl(response.data.logoUrl ?? null);
        } catch {
            // The management overview remains usable if the public club summary is unavailable.
        }
    }, [clubId]);

    const loadUpcomingSchedule = useCallback(async () => {
        const requestId = ++scheduleRequestRef.current;
        setScheduleLoading(true);
        setScheduleError(null);
        const from = new Date();
        const to = new Date(from);
        to.setDate(to.getDate() + 7);
        try {
            const events = await fetchClubSchedule(clubId, toScheduleDateTime(from), toScheduleDateTime(to));
            if (requestId !== scheduleRequestRef.current) return;
            const now = Date.now();
            setUpcomingEvents(events
                .filter((event) => event.status?.toUpperCase() !== 'CANCELLED' && new Date(event.endsAt).getTime() >= now)
                .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
        } catch (error) {
            if (requestId !== scheduleRequestRef.current) return;
            setUpcomingEvents([]);
            setScheduleError(extractApiErrorMessage(error, 'Failed to load upcoming schedule.'));
        } finally {
            if (requestId === scheduleRequestRef.current) setScheduleLoading(false);
        }
    }, [clubId]);

    const loadPlayers = async (force = false) => {
        const cacheKey = `${clubId}:${playerStatusFilter}:${playerPage}`;
        if (!force && playerDirectory && playersCacheRef.current.key === cacheKey && Date.now() - playersCacheRef.current.loadedAt < 30_000) return;
        const requestId = ++playersRequestRef.current;
        setPlayerLoading(true);
        setPlayerError(null);
        try {
            const response = await fetchClubPlayers(clubId, playerStatusFilter === 'ALL' ? null : playerStatusFilter, playerPage, 20);
            if (requestId !== playersRequestRef.current) return;
            setPlayerDirectory(response);
            playersCacheRef.current = { key: cacheKey, loadedAt: Date.now() };
            // Phase A1 — default the filter to TRIALIST once, when any exist.
            if (!trialistAutoSelectRef.current
                && playerStatusFilter === 'ALL'
                && response.content.some((p) => p.status === 'TRIALIST')) {
                trialistAutoSelectRef.current = true;
                setPlayerStatusFilter('TRIALIST');
            }
        } catch (error) {
            if (requestId !== playersRequestRef.current) return;
            setPlayerError(extractApiErrorMessage(error, 'Failed to load player affiliations.'));
        } finally {
            if (requestId === playersRequestRef.current) setPlayerLoading(false);
        }
    };

    const loadTryouts = async (force = false) => {
        const cacheKey = String(clubId);
        if (!force && tryoutApplicants.length > 0 && tryoutsCacheRef.current.key === cacheKey && Date.now() - tryoutsCacheRef.current.loadedAt < 30_000) return;
        const requestId = ++tryoutsRequestRef.current;
        setTryoutsLoading(true);
        try {
            const response = await apiClient.get<TryoutApplicantDto[]>(`/admin/tryouts/clubs/${clubId}/applications`);
            if (requestId !== tryoutsRequestRef.current) return;
            setTryoutApplicants(response.data || []);
            tryoutsCacheRef.current = { key: cacheKey, loadedAt: Date.now() };
        } catch {
            // non-critical
        } finally {
            if (requestId === tryoutsRequestRef.current) setTryoutsLoading(false);
        }
    };

    const loadApplications = async (force = false) => {
        const cacheKey = `${clubId}:${focusedApplicationId}:${applicationPage}:${applicationsFilters.position}:${applicationsFilters.ageGroup}:${applicationsFilters.status}:${applicationsFilters.jobId}`;
        if (!force && applicationsList.length > 0 && applicationsCacheRef.current.key === cacheKey && Date.now() - applicationsCacheRef.current.loadedAt < 30_000) return;
        const requestId = ++applicationsRequestRef.current;
        setApplicationsLoading(true);
        setApplicationsError(null);
        try {
            const response = await apiClient.get<ClubMembershipApplication[]>(`/clubs/${clubId}/management/applications`, { params: focusedApplicationId != null ? { applicationId: focusedApplicationId } : {
                position: applicationsFilters.position || null,
                ageGroup: applicationsFilters.ageGroup || null,
                status: applicationsFilters.status || null,
                jobId: applicationsFilters.jobId ? Number(applicationsFilters.jobId) : null,
                page: applicationPage, size: 100,
            } });
            if (requestId !== applicationsRequestRef.current) return;
            setApplicationsList(response.data);
            setApplicationTotal(Number(response.headers['x-total-count'] ?? response.data.length));
            applicationsCacheRef.current = { key: cacheKey, loadedAt: Date.now() };
        } catch (error) {
            if (requestId !== applicationsRequestRef.current) return;
            setApplicationsError(extractApiErrorMessage(error, 'Failed to load applications.'));
        } finally {
            if (requestId === applicationsRequestRef.current) setApplicationsLoading(false);
        }
    };

    const loadWorkspaceJobs = useCallback(async () => {
        const requestId = ++jobsRequestRef.current;
        try {
            const jobs = await fetchAllClubJobs(clubId);
            if (requestId === jobsRequestRef.current) setWorkspaceJobs(jobs);
        } catch {
            if (requestId === jobsRequestRef.current) setWorkspaceJobs([]);
        }
    }, [clubId]);

    useEffect(() => {
        void loadOverview();
        void loadClubSummary();
        void loadUpcomingSchedule();
    }, [clubId, loadClubSummary, loadUpcomingSchedule]);
    useEffect(() => {
        if (activeTab === 'players') void loadPlayers();
    }, [activeTab, clubId, playerPage, playerStatusFilter]);
    useEffect(() => {
        // Player cards are trialist affiliations, but page 0 of a large player
        // directory can contain only active players. Use the authoritative
        // overview count so card-backed players are visible without requiring
        // the manager to discover the filter manually.
        if (activeTab !== 'players' || playerStatusFilter !== 'ALL' || trialistAutoSelectRef.current) return;
        if ((overview?.trialistCount ?? 0) > 0) {
            trialistAutoSelectRef.current = true;
            setPlayerStatusFilter('TRIALIST');
            setPlayerPage(0);
        }
    }, [activeTab, overview?.trialistCount, playerStatusFilter]);
    useEffect(() => {
        if (activeTab === 'applications') void loadApplications();
    }, [activeTab, clubId, applicationsFilters, focusedApplicationId, applicationPage]);
    useEffect(() => {
        if (activeTab === 'tryouts') void loadTryouts();
    }, [activeTab, clubId]);

    useEffect(() => {
        if (activeTab === 'applications') void loadWorkspaceJobs();
    }, [activeTab, loadWorkspaceJobs]);

    useEffect(() => {
        if (activeTab !== 'invites') return;
        if (searchQuery.trim().length < 2) { setSearchResults(null); return; }
        const timeoutId = window.setTimeout(async () => {
            setSearchLoading(true);
            try {
                const response = await searchClubInviteCandidates(clubId, searchQuery, searchPage, 8);
                setSearchResults(response as PageResult<UserSearchDto>);
            } catch {
                setSearchResults(null);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
        return () => window.clearTimeout(timeoutId);
    }, [activeTab, clubId, searchPage, searchQuery]);

    // ── inbox data loading ──

    const PAGE_SIZE = 20;

    const loadInbox = useCallback(async (page: number, append: boolean) => {
        if (!canReadInbox || !isCurrentAuthSession(sessionId) || !inboxActiveRef.current) return;
        const controller = new AbortController();
        inboxRequests.current.add(controller);
        setInboxError(null);
        if (page === 0 && !append) setInboxLoading(true);
        else setInboxLoadingMore(true);
        try {
            const response = await fetchNotifications({ page, size: PAGE_SIZE, scope: 'club', clubId }, { signal: controller.signal, _authSessionId: sessionId });
            if (!controller.signal.aborted && inboxActiveRef.current && isCurrentAuthSession(sessionId)) {
                setInboxPage(response.pageNumber);
                setInboxTotalElements(response.totalElements);
                setInboxNotifications(prev => append ? [...prev, ...response.content] : response.content);
            }
        } catch (error) {
            if (!controller.signal.aborted && inboxActiveRef.current && isCurrentAuthSession(sessionId)) setInboxError(extractApiErrorMessage(error, 'Could not load club inbox.'));
        } finally {
            inboxRequests.current.delete(controller);
            if (!controller.signal.aborted && inboxActiveRef.current && isCurrentAuthSession(sessionId)) {
                setInboxLoading(false);
                setInboxLoadingMore(false);
            }
        }
    }, [clubId, canReadInbox, sessionId]);

    const loadInboxUnreadCount = useCallback(async () => {
        if (!canReadInbox || !isCurrentAuthSession(sessionId) || !inboxActiveRef.current) return;
        const controller = new AbortController();
        inboxRequests.current.add(controller);
        try {
            const response = await fetchUnreadNotificationCount({ scope: 'club', clubId }, { signal: controller.signal, _authSessionId: sessionId });
            if (!controller.signal.aborted && inboxActiveRef.current && isCurrentAuthSession(sessionId)) {
                setInboxUnreadCount(response.unreadCount);
            }
        } catch { /* silent */ }
        finally { inboxRequests.current.delete(controller); }
    }, [clubId, canReadInbox, sessionId]);

    useEffect(() => {
        if (activeTab !== 'inbox') return;
        setInboxPage(0);
        setInboxNotifications([]);
        void loadInbox(0, false);
    }, [activeTab, clubId, loadInbox]);

    useEffect(() => {
        void loadInboxUnreadCount();
    }, [loadInboxUnreadCount]);

    useEffect(() => {
        const closeOverlays = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setWorkspaceNavOpen(false);
            setContextOpen(false);
        };
        window.addEventListener('keydown', closeOverlays);
        return () => window.removeEventListener('keydown', closeOverlays);
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeNotificationsChanged(() => {
            void loadInboxUnreadCount();
            if(activeTab==='inbox')void loadInbox(0,false);
        });
        return () => unsubscribe();
    }, [loadInboxUnreadCount,loadInbox,activeTab]);

    // ── actions ──

    const runAction = async (key: string, action: () => Promise<void>) => {
        setPendingKey(key);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            await action();
        } catch (error) {
            setErrorMessage(extractApiErrorMessage(error, 'Request failed.'));
        } finally {
            setPendingKey(null);
        }
    };

    const handleRoleChange = async (userId: number, role: ClubMembershipRole) => {
        await runAction(`role-${userId}`, async () => {
            await updateClubMemberRole(clubId, userId, role);
            await loadOverview();
            setSuccessMessage(`Role updated to ${clubRoleLabel(role)}.`);
        });
    };

    const handleRemoveMember = async (member: ClubManagedMember) => {
        await runAction(`remove-${member.userId}`, async () => {
            await removeClubMember(clubId, member.userId);
            await loadOverview();
            setConfirmingRemovalUserId(null);
            setSuccessMessage(`${member.fullName || member.username} was removed.`);
        });
    };

    const handleInvite = async (userId: number) => {
        await runAction(`invite-${userId}`, async () => {
            await createClubInvitation(clubId, userId, selectedInviteRole);
            await loadOverview();
            setSuccessMessage('Invitation sent.');
        });
    };

    const handleCancelInvite = async (inviteId: number) => {
        await runAction(`cancel-${inviteId}`, async () => {
            await cancelClubInvitation(clubId, inviteId);
            await loadOverview();
            setSuccessMessage('Invitation cancelled.');
        });
    };

    const handleAcceptApplication = (applicationId: number) => {
        const target = applicationsList.find((a) => a.id === applicationId)
            ?? overview?.pendingApplications.find((a) => a.id === applicationId)
            ?? null;
        setAcceptTarget(target);
    };

    const handleAcceptConfirm = async (message: string | null) => {
        if (!acceptTarget) return;
        const target = acceptTarget;
        await runAction(`accept-${target.id}`, async () => {
            const result = await acceptClubApplication(clubId, target.id, message);
            await Promise.all([loadOverview(), loadApplications(true)]);
            setSuccessMessage(result.activeElsewhere
                ? 'Application accepted as a trialist. Warning: this player is still active at another club.'
                : 'Application accepted.');
            setAcceptTarget(null);
        });
    };

    // Phase A6 — single decline opens the note modal (gentle rejection).
    const handleDeclineApplication = (applicationId: number) => {
        const target = applicationsList.find((a) => a.id === applicationId) ?? null;
        setDeclineTarget(target);
    };

    const handleDeclineConfirm = async (message: string | null) => {
        if (!declineTarget) return;
        const target = declineTarget;
        await runAction(`decline-${target.id}`, async () => {
            await declineClubApplication(clubId, target.id, message);
            await Promise.all([loadOverview(), loadApplications(true)]);
            setSuccessMessage('Application declined.');
            setDeclineTarget(null);
        });
    };

    const handleTryoutDeclineConfirm = async (message: string | null) => {
        if (!tryoutDeclineTarget) return;
        const target = tryoutDeclineTarget;
        await runAction(`tryout-${target.id}-REJECTED`, async () => {
            await apiClient.put(
                `/admin/tryouts/clubs/${clubId}/applications/${target.id}/status`,
                { message: message ?? null },
                { params: { status: 'REJECTED' } }
            );
            await loadTryouts(true);
            setSuccessMessage('Tryout declined.');
            setTryoutDeclineTarget(null);
        });
    };

    // Phase A3 — bulk accept/decline; returns true on completion so the tab
    // clears its selection only when the request actually went through.
    const handleBulkDecide = async (
        applicationIds: number[],
        action: 'ACCEPT' | 'DECLINE',
        message: string | null
    ): Promise<boolean> => {
        let completed = false;
        await runAction(`bulk-${action}`, async () => {
            const response = await bulkDecideClubApplications(clubId, { applicationIds, action, message });
            await Promise.all([loadOverview(), loadApplications(true)]);
            const decided = response.results.filter((r) => r.status === action).length;
            const skipped = response.results.filter((r) => r.status === 'SKIPPED').length;
            const warnings = response.results.filter((r) => r.status === action && !!r.reason).length;
            setSuccessMessage(
                `${decided} application(s) ${action === 'ACCEPT' ? 'accepted' : 'declined'}${skipped > 0 ? `, ${skipped} skipped` : ''}${warnings > 0 ? `, ${warnings} active-elsewhere warning${warnings === 1 ? '' : 's'}` : ''}.`
            );
            completed = true;
        });
        return completed;
    };

    const handlePlayerStatusChange = async (userId: number, status: PlayerAffiliationStatus, playerName?: string) => {
        if (!canChangePlayerStatus) {
            setErrorMessage('Only club owners and admins can change player status.');
            return;
        }
        if (status === 'PAST' || status === 'REMOVED') {
            pendingStatusRef.current = { userId, status, playerName };
            setReleaseMessage('');
            setShowStatusConfirm(true);
            return;
        }
        await executeStatusChange(userId, status);
    };

    const executeStatusChange = async (userId: number, status: PlayerAffiliationStatus, message?: string | null) => {
        if (!canChangePlayerStatus) {
            setErrorMessage('Only club owners and admins can change player status.');
            return;
        }
        await runAction(`player-${userId}-${status}`, async () => {
            await updateClubPlayerStatus(clubId, userId, status, undefined, message);
            await Promise.all([loadOverview(), loadPlayers(true)]);
            setSuccessMessage(`Player status updated to ${status}.`);
        });
    };

    const handleSendConsentEmail = async (userId: number, parentEmail?: string | null) => {
        let sent = false;
        await runAction(`consent-${userId}`, async () => {
            await sendParentalConsentEmail(clubId, userId, parentEmail);
            sent = true;
            setSuccessMessage('Consent email sent. Waiting for the parent’s response.');
            await loadPlayers(true);
        });
        return sent;
    };

    // ── phase A1: promote + trial deadline ──

    const handleTrialEndsChange = async (userId: number, trialEndsOn: string) => {
        if (!canChangePlayerStatus) {
            setErrorMessage('Only club owners and admins can change trial dates.');
            return;
        }
        await runAction(`trial-ends-${userId}`, async () => {
            await updateClubPlayerStatus(clubId, userId, 'TRIALIST', trialEndsOn || null);
            await loadPlayers(true);
            setSuccessMessage('Trial deadline updated.');
        });
    };

    const handleConfirmStatus = async () => {
        setShowStatusConfirm(false);
        const pending = pendingStatusRef.current;
        if (!pending) return;
        await executeStatusChange(pending.userId, pending.status, releaseMessage.trim() || null);
        pendingStatusRef.current = null;
        setReleaseMessage('');
    };

    const handleTransferOwnership = async (member: ClubManagedMember) => {
        await runAction(`transfer-${member.userId}`, async () => {
            await transferClubOwnership(clubId, member.userId);
            setConfirmingOwnershipTransferUserId(null);
            setSuccessMessage('Ownership transferred. Redirecting...');
            setTimeout(() => navigate(`/clubs/${clubId}`), 1500);
        });
    };

    const handleLeaveClub = async () => {
        await runAction('leave-club', async () => {
            if (!selfDepartureRef.current) throw new Error('Refresh your club responsibilities before confirming departure.');
            try {
                await leaveClubMembership(clubId, selfDepartureRef.current);
            } catch (error) {
                if ((error as { response?: { status?: number } }).response?.status === 409) {
                    selfDepartureRef.current = null;
                    setConfirmingSelfLeave(false);
                }
                throw error;
            }
            selfDepartureRef.current = null;
            setConfirmingSelfLeave(false);
            navigate(`/clubs/${clubId}`);
        });
    };

    const handleConfirmSelfLeave = (confirm: boolean) => {
        if (!confirm) { selfDepartureRef.current = null; setConfirmingSelfLeave(false); return; }
        void runAction('prepare-leave', async () => {
            selfDepartureRef.current = await prepareStaffDeparture(clubId);
            setConfirmingSelfLeave(true);
        });
    };

    const handleTryoutStatus = (applicationId: number, status: 'ACCEPTED' | 'REJECTED') => {
        // Phase A2/A6 — both decisions open the note modal (accept = invitation
        // instructions, reject = the kind note); the mutation happens on confirm.
        const target = tryoutApplicants.find((a) => a.id === applicationId) ?? null;
        if (status === 'ACCEPTED') {
            setTryoutAcceptTarget(target);
        } else {
            setTryoutDeclineTarget(target);
        }
    };

    const handleTryoutAcceptConfirm = async (message: string | null) => {
        if (!tryoutAcceptTarget) return;
        const target = tryoutAcceptTarget;
        await runAction(`tryout-${target.id}-ACCEPTED`, async () => {
            await apiClient.put(
                `/admin/tryouts/clubs/${clubId}/applications/${target.id}/status`,
                { message: message ?? null },
                { params: { status: 'ACCEPTED' } }
            );
            await loadTryouts(true);
            setSuccessMessage('Tryout accepted.');
            setTryoutAcceptTarget(null);
        });
    };

    // ── inbox actions ──

    const handleInboxOpen = useCallback(async (notification: NotificationItem) => {
        setInboxBusyId(notification.id);
        try {
            if (!notification.isRead) {
                await markNotificationAsRead(notification.id);
                setInboxNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
                setInboxUnreadCount(prev => Math.max(0, prev - 1));
                emitNotificationsChanged();
            }
            navigate(buildNotificationDestination(notification));
        } catch {
            navigate(buildNotificationDestination(notification));
        } finally {
            setInboxBusyId(null);
        }
    }, [navigate]);

    const handleInboxLoadMore = useCallback(() => {
        const nextPage = inboxPage + 1;
        void loadInbox(nextPage, true);
    }, [inboxPage, loadInbox]);

    const handleInboxMarkAllRead = useCallback(async () => {
        try {
            await markAllNotificationsAsRead({ scope: 'club', clubId });
            setInboxNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setInboxUnreadCount(0);
            emitNotificationsChanged();
        } catch { /* silent */ }
    }, [clubId]);

    // ── tabs ──

    const tabs = useMemo<TabItem[]>(() => {
        const items: TabItem[] = [
            ...(overview || workspaceRoles.data ? [{ id: 'overview' as const, label: 'Overview', icon: LayoutDashboard }] : [])
        ];
        if (canManageLeadership || operations.boot?.modules.some(m=>m.id==='STAFF')) {
            items.push({ id: 'personnel', label: 'Staff', icon: Users, badge: operations.boot ? String(operations.boot.staff.length) : null });
        }
        if (canManageOperations) {
            items.push({ id: 'players', label: 'Players', icon: Users, badge: overview ? String((overview.activePlayerCount || 0) + (overview.trialistCount || 0)) : null });
        }
        if (canManageOperations) {
            items.push({ id: 'invites', label: 'Invites', icon: UserPlus, badge: overview && overview.pendingInvitations.length > 0 ? String(overview.pendingInvitations.length) : null });
        }
        if (admissions.data) items.push({ id: 'admissions', label: admissionCopy('title'), icon: UserPlus, badge: String(admissions.data.cases.filter(row => row.nextAction.owner === 'CLUB').length || '') });
        if (canManageOperations) {
            items.push({ id: 'applications', label: 'Applications', icon: CheckCircle2, badge: overview && overview.pendingApplications.length > 0 ? String(overview.pendingApplications.length) : null });
        }
        if (canManageLeadership) {
            items.push({ id: 'roles', label: 'Ownership & access', icon: Crown });
            items.push({ id: 'club-approaches', label: 'Agent approaches', icon: HeartHandshake });
        }
        if (canManageOperations) {
            items.push({ id: 'jobs', label: 'Open roles', icon: Briefcase });
        }
        if (canManageLeadership) {
            items.push({ id: 'store', label: 'Store', icon: ShoppingBag });
            items.push({ id: 'campaigns', label: 'Campaigns', icon: HeartHandshake });
            items.push({ id: 'settings', label: 'Settings', icon: Settings });
        }
        if (canManageOperations) {
            items.push({ id: 'squads', label: 'Squads', icon: ShieldCheck });
            items.push({ id: 'player-cards', label: 'Player Cards', icon: CreditCard });
        }
        if (canManageTryouts) {
            items.push({ id: 'tryouts', label: 'Tryouts', icon: CheckCircle2, badge: tryoutApplicants.length > 0 ? String(tryoutApplicants.length) : null });
        }
        if (operations.boot) items.push(...availableOperationTabs(operations.boot));
        if (workspaceRoles.data) {
            items.push({id:'tools',label:'All tools',icon:LayoutDashboard},{id:'my-role',label:'My responsibilities',icon:UserPlus});
            if (workspaceRoles.data.squads.length && !canManageOperations) items.push({id:'squads',label:'Squads',icon:ShieldCheck});
            if (workspaceRoles.data.people.length && !canManageOperations) items.push({id:'my-people',label:'Players',icon:Users});
            if (workspaceRoles.data.leadership) items.push({id:'role-requests',label:'Staff roles & requests',icon:UserPlus,badge:String(workspaceRoles.data.requests.filter(r=>r.status==='PENDING').length||'')});
        }
        return items;
    }, [canManageLeadership, canManageOperations, canManageTryouts, overview, tryoutApplicants.length, operations.boot, workspaceRoles.data, admissions.data, admissionCopy]);
    const sidebarTabs = tabs.filter(tab => { const module = operationModule(tab.id); return !module || ['HOME', 'SETTINGS'].includes(module) || showHiddenSections || activeTab === tab.id || operations.boot?.settings.enabled_modules.includes(module); });
    const selectedOperation = operationModule(activeTab);
    const shortcuts = useWorkspaceShortcuts(clubId,currentUserId,sidebarTabs);
    const openWork = (requested:WorkspaceTab,context:Record<string,string>={}) => navigateWorkspace(()=>{
        const tab=canonicalWorkspaceTab(requested)!;
        if(!allowedTabIds.has(tab))return;
        const next=new URLSearchParams();next.set('tab',tab);
        if(activeTab==='squads' && tab!=='squads'){const back=new URLSearchParams(searchParams);back.set('tab','squads');back.delete('return');if(context.squad)back.set('squad',context.squad);next.set('return',back.toString());}
        Object.entries(context).forEach(([key,value])=>next.set(key,value));
        setActiveTab(tab);setSearchParams(next);
    });
    const workSquad = searchParams.get('squad')??'';
    const chooseWorkSquad=(squad:string)=>navigateWorkspace(()=>{const next=new URLSearchParams(searchParams);if(squad)next.set('squad',squad);else next.delete('squad');next.delete('session');next.delete('person');next.delete('record');setSearchParams(next);});
    const showLegacyContext = !['inbox','invites','squads','players','personnel','player-cards'].includes(activeTab) && !selectedOperation && !['tools','my-day','my-people','my-squads','my-role','role-requests','overview', 'admissions', 'applications', 'tryouts', 'store', 'campaigns', 'jobs', 'club-approaches'].includes(activeTab);

    const allowedTabIds = useMemo(() => new Set<WorkspaceTab>([
        ...tabs.map((tab) => tab.id),
        ...(canReadInbox ? ['inbox' as const] : []),
    ]), [tabs, canReadInbox]);

    const openPlayerWorkflow = (status: 'ALL' | PlayerAffiliationStatus = 'TRIALIST') => {
        if (!allowedTabIds.has('players')) return;
        trialistAutoSelectRef.current = true;
        setPlayerStatusFilter(status);
        setPlayerPage(0);
        switchTab('players');
    };

    useEffect(() => {
        // A stale or hand-edited URL must not expose a tab outside the current
        // role. Wait for the overview so a valid deep link is not rejected
        // while the role is still loading.
        if (workspaceRoles.loading || !overview && (overviewLoading || operations.loading || !operations.boot && !workspaceRoles.data)) return;
        const requestedTab = canonicalWorkspaceTab(parseWorkspaceTab(searchParams.get('tab')));
        if (requestedTab === 'admissions' && admissions.loading) return;
        if (requestedTab && operationModule(requestedTab) && operations.loading) return;
        const nextTab = requestedTab && allowedTabIds.has(requestedTab) ? requestedTab : workspaceRoles.data || overview ? 'overview' : 'actions';
        if (nextTab !== activeTab) {
            setActiveTab(nextTab);
        }

        const nextParams = new URLSearchParams(searchParams);
        if (nextTab === 'overview') nextParams.delete('tab');
        else nextParams.set('tab', nextTab);
        if (nextParams.toString() !== searchParams.toString()) {
            setSearchParams(nextParams, { replace: true });
        }
    }, [activeTab, allowedTabIds, overview, overviewLoading, operations.boot, operations.loading, workspaceRoles.loading, workspaceRoles.data, admissions.loading, searchParams, setSearchParams]);

    const totalPlayerPages = playerDirectory ? Math.max(1, Math.ceil(playerDirectory.totalElements / Math.max(playerDirectory.pageSize, 1))) : 1;
    const totalSearchPages = searchResults ? Math.max(1, Math.ceil(searchResults.totalElements / Math.max(searchResults.pageSize, 1))) : 1;
    const inboxHasMore = inboxTotalElements > (inboxPage + 1) * PAGE_SIZE;

    // ── render ──

    if (!clubId) {
        return (
            <div className="flex min-h-screen items-center justify-center workspace-page-shell">
                <div className="text-center">
                    <p className="text-lg font-semibold text-[var(--fc-text-primary)]">Invalid Club</p>
                    <p className="mt-2 text-sm text-[var(--fc-text-secondary)]">No club ID provided.</p>
                </div>
            </div>
        );
    }

    return (<>
            <div data-workspace-area={areaFor(activeTab)?.id ?? 'overview'} data-workspace-page={activeTab} className={`flex h-[calc(100dvh-var(--app-header-height))] workspace-page-shell club-workspace-shell workspace-refresh ${!darkMode ? 'workspace-light' : ''}`}>
            <WorkspaceSidebar
                clubId={clubId}
                overview={overview}
                activeTab={activeTab}
                tabs={sidebarTabs}
                shortcuts={shortcuts.ids}
                showHidden={showHiddenSections}
                onShowHidden={setShowHiddenSections}
                hasHidden={Boolean(operations.boot?.modules.some(m => !operations.boot?.settings.enabled_modules.includes(m.id)))}
                unreadInboxCount={inboxUnreadCount}
                clubName={clubName}
                clubLogoUrl={clubLogoUrl}
                mobileOpen={workspaceNavOpen}
                onTabChange={switchTab}
                onNavigate={path => navigateWorkspace(() => navigate(path))}
                onClose={() => setWorkspaceNavOpen(false)}
            />

            {/* ── main content ── */}
            <main className="workspace-page-main min-w-0 flex-1 overflow-y-auto">
                <div className="workspace-mobile-bar sticky top-0 z-20 items-center justify-between gap-3 border-b border-[var(--fc-border)] bg-[var(--fc-page-bg)] px-4 py-3">
                    <button type="button" onClick={() => setWorkspaceNavOpen(true)} aria-expanded={workspaceNavOpen} aria-controls="workspace-navigation" className="inline-flex items-center gap-2 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 py-2 text-xs font-semibold text-[var(--fc-text-primary)] hover:bg-[var(--fc-surface-hover)]">
                        <Menu className="h-4 w-4" />
                        {t('clubWorkspace.menu')}
                    </button>
                    <div className="min-w-0 flex-1 text-center">
                        <p className="truncate text-sm font-semibold text-[var(--fc-text-primary)]">{clubName || `Club #${clubId}`}</p>
                        <p className="truncate text-[11px] text-[var(--fc-text-muted)]">{activeTab === 'overview' ? 'Club workspace' : tabs.find((tab) => tab.id === activeTab)?.label || 'Workspace'}</p>
                    </div>
                    {showLegacyContext && <button type="button" onClick={() => setContextOpen(true)} aria-expanded={contextOpen} aria-controls="workspace-context" className="inline-flex items-center gap-2 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 py-2 text-xs font-semibold text-[var(--fc-text-primary)]" aria-label={t('clubWorkspace.openContext')}>
                        <PanelRight className="h-4 w-4" />
                        {t('clubWorkspace.context')}
                    </button>}
                </div>
                <div className="workspace-alert-stack sticky top-0 z-10 space-y-2 px-6 pt-4">
                    {errorMessage && (
                        <div role="alert" aria-live="assertive" className="rounded-xl border border-[var(--fc-state-danger-soft)] bg-[var(--fc-state-danger-soft)] px-4 py-2.5 text-sm flex items-center justify-between">
                            <span className="font-medium text-[var(--fc-text-primary)]">{errorMessage}</span>
                            <button type="button" aria-label="Dismiss error" onClick={() => setErrorMessage(null)} className="text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]"><X className="h-4 w-4" /></button>
                        </div>
                    )}
                    {successMessage && (
                        <div role="status" aria-live="polite" className="rounded-xl border border-[var(--fc-accent-soft)] bg-[var(--fc-accent-soft)] px-4 py-2.5 text-sm flex items-center justify-between">
                            <span className="font-medium text-[var(--fc-text-primary)]">{successMessage}</span>
                            <button type="button" aria-label="Dismiss confirmation" onClick={() => setSuccessMessage(null)} className="text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]"><X className="h-4 w-4" /></button>
                        </div>
                    )}
                </div>

                <div className="work-breadcrumb"><span><button type="button" onClick={()=>openWork('overview')}>Workspace</button><span aria-hidden>/</span><b>{areaFor(activeTab)?.label??(activeTab==='tools'?'All tools':activeTab==='actions'?'Work queue':activeTab==='inbox'?'Inbox':'Overview')}</b></span>{workspaceRoles.data&&<button type="button" onClick={()=>openWork('my-role')}>My responsibilities</button>}</div>
                {selectedOperation && workSquad && <button type="button" className="wo-return" onClick={()=>navigateWorkspace(()=>{const back=new URLSearchParams(searchParams.get('return')??'');back.set('tab','squads');back.set('squad',workSquad);back.delete('return');setSearchParams(back);})}>← Back to {workspaceRoles.data?.squads.find(s=>String(s.id)===workSquad)?.name??'squad'}</button>}
                <div className="workspace-tab-content px-6 py-5">
                    {workspaceRoles.error && <p role="alert" className="role-muted">{workspaceRoles.error} <button onClick={workspaceRoles.refresh}>Retry</button></p>}
                    {workspaceRoles.loading || (overviewLoading && !overview && !operations.boot) || (selectedOperation && operations.loading) ? (
                        <PageSpinner />
                    ) : overviewError && !overview && !operations.boot && !workspaceRoles.data ? (
                        <ErrorBlock message={overviewError} onRetry={() => { void loadOverview(); }} />
                    ) : (
                        <div className="space-y-4">

                            {activeTab==='tools'&&<WorkspaceTools tabs={sidebarTabs} shortcuts={shortcuts.ids} onToggle={shortcuts.toggle} onOpen={openWork} showHidden={showHiddenSections} onShowHidden={setShowHiddenSections} hasHidden={Boolean(operations.boot?.modules.some(m=>!operations.boot?.settings.enabled_modules.includes(m.id)))}/>}
                            {(activeTab==='my-people'||activeTab==='squads'&&!canManageOperations)&&workspaceRoles.data&&<WorkspaceSquads key={activeTab} data={workspaceRoles.data} boot={operations.boot} squad={workSquad} onSquad={chooseWorkSquad} onOpen={openWork} canManage={canManageOperations} playersOnly={activeTab==='my-people'}/>}
                            {['my-role','role-requests'].includes(activeTab)&&workspaceRoles.data&&<WorkspaceRolesPanel key={activeTab} club={clubId} data={workspaceRoles.data} admin={activeTab==='role-requests'} onChanged={()=>{workspaceRoles.refresh();void operations.refresh();}}/>}
                            {selectedOperation && operations.boot && <WorkspaceOperations key={`${clubId}-${selectedOperation}-${workSquad}-${searchParams.get('session')??''}-${searchParams.get('person')??''}`} boot={{...operations.boot,peopleBySquad:workspaceRoles.data?.people}} module={selectedOperation} onRefresh={operations.refresh} />}
                            {selectedOperation && !operations.boot && !operations.loading && <ErrorBlock message={operations.error || 'This section is unavailable for your account.'} onRetry={() => { void operations.refresh(); }} />}
                            {activeTab === 'overview' && (workspaceRoles.data ? <WorkspaceOverview data={workspaceRoles.data} boot={operations.boot} tabs={sidebarTabs} shortcuts={shortcuts} onOpen={openWork} overviewProps={{
                                overview, clubId, onTabChange:switchTab, overdueTrialistCount, canManageLeadership, canManageOperations,
                                upcomingEvents, scheduleLoading, scheduleError, tryoutPendingCount, unreadInboxCount:inboxUnreadCount,
                                onOpenSchedule:()=>navigate(`/calendar?clubId=${clubId}`),
                                onOpenScheduleEvent:(event)=>{const date=event.startsAt.slice(0,10);navigate(`/calendar?clubId=${clubId}&date=${date}&eventId=${event.eventId}`);},
                                onRetrySchedule:()=>{void loadUpcomingSchedule();}, onOpenPlayers:allowedTabIds.has('players')?openPlayerWorkflow:undefined,
                            }}/> : <OverviewTab
                                    overview={overview}
                                    clubId={clubId}
                                    onTabChange={switchTab}
                                    overdueTrialistCount={overdueTrialistCount}
                                    canManageLeadership={canManageLeadership}
                                    canManageOperations={canManageOperations}
                                    upcomingEvents={upcomingEvents}
                                    scheduleLoading={scheduleLoading}
                                    scheduleError={scheduleError}
                                    tryoutPendingCount={tryoutPendingCount}
                                    unreadInboxCount={inboxUnreadCount}
                                    onOpenSchedule={() => { setContextOpen(false); navigate(`/calendar?clubId=${clubId}`); }}
                                    onOpenScheduleEvent={(event) => {
                                        const startsAt = new Date(event.startsAt);
                                        const date = `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, '0')}-${String(startsAt.getDate()).padStart(2, '0')}`;
                                        setContextOpen(false);
                                        navigate(`/calendar?clubId=${clubId}&date=${date}&eventId=${event.eventId}`);
                                    }}
                                    onRetrySchedule={() => { void loadUpcomingSchedule(); }}
                                    onOpenPlayers={allowedTabIds.has('players') ? openPlayerWorkflow : undefined}
                            />)}

                            {activeTab === 'personnel' && operations.boot && <ClubStaffTeam key={clubId} boot={operations.boot} members={overview?.members} roles={workspaceRoles.data?.catalog} onChanged={()=>{void operations.refresh();}} renderAdministration={canManageLeadership ? member=>(<PersonnelTab
                                    clubId={clubId}
                                    onProfileSaved={loadOverview}
                                    overview={overview ? {...overview,members:[member]} : null}
                                    currentUserId={currentUserId}
                                    currentRole={currentRole}
                                    canManageLeadership={canManageLeadership}
                                    pendingKey={pendingKey}
                                    confirmingRemovalUserId={confirmingRemovalUserId}
                                    onRoleChange={handleRoleChange}
                                    onRemoveMember={handleRemoveMember}
                                    onConfirmRemoval={setConfirmingRemovalUserId}
                                /> ) : undefined}/>}

                            {activeTab === 'players' && (
                                <PlayersTab
                                    playerDirectory={playerDirectory}
                                    playerLoading={playerLoading}
                                    playerError={playerError}
                                    playerStatusFilter={playerStatusFilter}
                                    playerCounts={overview ? {
                                        ACTIVE: overview.activePlayerCount,
                                        TRIALIST: overview.trialistCount,
                                        PAST: overview.pastPlayerCount ?? 0,
                                        REMOVED: overview.removedPlayerCount ?? 0,
                                        ALL: (overview.activePlayerCount ?? 0)
                                            + (overview.trialistCount ?? 0)
                                            + (overview.pastPlayerCount ?? 0)
                                            + (overview.removedPlayerCount ?? 0),
                                    } : undefined}
                                    pendingKey={pendingKey}
                                    canManagePlayerStatuses={canChangePlayerStatus && Boolean(admissions.data)}
                                    canInvitePlayer={Boolean(admissions.data)}
                                    joiningUnavailableReason={admissions.data ? undefined : admissions.loading ? admissionCopy('loading') : admissions.error || admissionCopy('revoked')}
                                    totalPlayerPages={totalPlayerPages}
                                    onStatusFilterChange={(f) => { setPlayerStatusFilter(f); setPlayerPage(0); }}
                                    onPlayerStatusChange={handlePlayerStatusChange}
                                    onReviewJoining={admissions.data ? userId => {
                                        const record = admissions.data?.cases.find(row => row.playerId === userId && row.stage !== 'CLOSED');
                                        openWork('admissions', record ? { caseId: String(record.id) } : { person: String(userId) });
                                    } : undefined}
                                    joiningPlayerIds={admissions.data?.cases.filter(row => row.stage !== 'CLOSED').map(row => row.playerId)}
                                    onTrialEndsChange={handleTrialEndsChange}
                                    onRetry={() => { void loadPlayers(true); }}
                                    onPageChange={setPlayerPage}
                                    onMessagePlayer={(userId) => navigate(`/messages?chatWith=${userId}`)}
                                    onSendConsentEmail={handleSendConsentEmail}
                                    onTabChange={tab => tab === 'admissions' ? openWork('admissions', { intake: '1' }) : switchTab(tab)}
                                />
                            )}

                            {activeTab === 'invites' && (operations.boot?.leadership ? <ClubStaffTeam key={clubId} boot={operations.boot} members={overview?.members} roles={workspaceRoles.data?.catalog} mode="invites" onChanged={()=>{void operations.refresh();}}><details className="staff-administration" open={Boolean(overview?.pendingInvitations.length)}><summary>Management invitations{overview?.pendingInvitations.length ? ` · ${overview.pendingInvitations.length} pending` : ''}</summary><p>Use this for club administrators or existing broad coaching access. Specialist appointments above keep access limited to the person’s duties.</p><InvitesTab
                                    overview={overview}
                                    searchQuery={searchQuery}
                                    searchPage={searchPage}
                                    searchResults={searchResults}
                                    searchLoading={searchLoading}
                                    selectedInviteRole={selectedInviteRole}
                                    pendingKey={pendingKey}
                                    invitedUserIds={invitedUserIds}
                                    totalSearchPages={totalSearchPages}
                                    onSearchQueryChange={setSearchQuery}
                                    onSearchPageChange={setSearchPage}
                                    onInviteRoleChange={setSelectedInviteRole}
                                    onInvite={handleInvite}
                                    onCancelInvite={handleCancelInvite}
                                /></details></ClubStaffTeam> : <InvitesTab
                                    overview={overview}
                                    searchQuery={searchQuery}
                                    searchPage={searchPage}
                                    searchResults={searchResults}
                                    searchLoading={searchLoading}
                                    selectedInviteRole={selectedInviteRole}
                                    pendingKey={pendingKey}
                                    invitedUserIds={invitedUserIds}
                                    totalSearchPages={totalSearchPages}
                                    onSearchQueryChange={setSearchQuery}
                                    onSearchPageChange={setSearchPage}
                                    onInviteRoleChange={setSelectedInviteRole}
                                    onInvite={handleInvite}
                                    onCancelInvite={handleCancelInvite}
                                /> )}

                            {activeTab === 'admissions' && <ClubAdmissionWorkspace state={admissions} sessionId={sessionId} existingPeople={workspaceRoles.data?.people} onOpen={openWork} onRosterChanged={() => { playersCacheRef.current = { key: '', loadedAt: 0 }; void loadOverview(); workspaceRoles.refresh(); }} />}
                            {activeTab === 'applications' && (
                                <>
                                {focusedApplicationId != null && <p className="p-3" role="status">Showing the application from your notification. <button type="button" className="app-text-action" onClick={clearApplicationFocus}>Show all applications</button></p>}
                                <ApplicationsTab
                                    applications={focusedApplicationId != null ? applicationsList.filter(a => a.id === focusedApplicationId) : applicationsList}
                                    applicationsLoading={applicationsLoading}
                                    applicationsError={applicationsError}
                                    jobs={workspaceJobs}
                                    filters={focusedApplicationId != null ? { position: '', ageGroup: '', status: '', jobId: '' } : applicationsFilters}
                                    bulkPending={!!pendingKey && pendingKey.startsWith('bulk-')}
                                    onFiltersChange={(f) => { clearApplicationFocus(); setApplicationPage(0); setApplicationsFilters(f); }}
                                    pagination={focusedApplicationId == null ? {page:applicationPage,total:applicationTotal,size:100,onChange:setApplicationPage} : undefined}
                                    onAcceptApplication={handleAcceptApplication}
                                    onDeclineApplication={handleDeclineApplication}
                                    onBulkDecide={handleBulkDecide}
                                    onRetry={() => { void loadApplications(true); }}
                                    onOpenTryouts={allowedTabIds.has('tryouts') ? () => switchTab('tryouts') : undefined}
                                    onOpenPlayers={allowedTabIds.has('players') ? () => openPlayerWorkflow() : undefined}
                                    onOpenSquads={allowedTabIds.has('squads') ? () => switchTab('squads') : undefined}
                                />
                                </>
                            )}

                            {activeTab === 'roles' && overview && (
                                <RolesTab
                                    overview={overview}
                                    currentUserId={currentUserId}
                                    currentRole={currentRole}
                                    pendingKey={pendingKey}
                                    confirmingOwnershipTransferUserId={confirmingOwnershipTransferUserId}
                                    confirmingSelfLeave={confirmingSelfLeave}
                                    isOwner={isOwner}
                                    onConfirmOwnershipTransfer={setConfirmingOwnershipTransferUserId}
                                    onTransferOwnership={handleTransferOwnership}
                                    onConfirmSelfLeave={handleConfirmSelfLeave}
                                    onLeaveClub={handleLeaveClub}
                                    onOpenJobs={() => switchTab('jobs')}
                                />
                            )}

                            {activeTab === 'club-approaches' && canManageLeadership && (
                                <ClubApproachesPanel mode="club" clubId={clubId} />
                            )}

                            {activeTab === 'jobs' && (
                                <JobsTab
                                    clubId={clubId}
                                    pendingKey={pendingKey}
                                    currentUserId={currentUserId}
                                    canReviewAllApplications={canManageLeadership}
                                />
                            )}

                            {activeTab === 'store' && canManageLeadership && <StoreTab key={clubId} clubId={clubId} />}
                            {activeTab === 'campaigns' && canManageLeadership && <CampaignsTab key={clubId} clubId={clubId} />}
                            {activeTab === 'settings' && (
                                <SettingsTab clubId={clubId} pendingKey={pendingKey} />
                            )}

                            {activeTab === 'squads' && canManageOperations && (
                                <SquadsTab
                                    workspace={workspaceRoles.data?{data:workspaceRoles.data,boot:operations.boot,onOpen:openWork}:undefined}
                            key={clubId}
                                    clubId={clubId}
                                    overview={overview}
                                    setParentError={setErrorMessage}
                                    setParentSuccess={setSuccessMessage}
                                />
                            )}

                            {activeTab === 'player-cards' && (
                                <PlayerCardsTab
                                    clubId={clubId}
                                    setParentError={setErrorMessage}
                                    setParentSuccess={setSuccessMessage}
                                />
                            )}

                            {activeTab === 'tryouts' && (
                                <>
                                {focusedApplicationId != null && <p className="p-3" role="status">{!tryoutsLoading && !tryoutApplicants.some(a => a.id === focusedApplicationId) ? 'This application is unavailable or you no longer have access.' : 'Showing the application from your notification.'} <button type="button" className="app-text-action" onClick={clearApplicationFocus}>Show all applications</button></p>}
                                <TryoutsTab
                                    clubId={clubId}
                                    tryoutApplicants={focusedApplicationId != null ? tryoutApplicants.filter(a => a.id === focusedApplicationId) : tryoutApplicants}
                                    tryoutsLoading={tryoutsLoading}
                                    pendingKey={pendingKey}
                                    onTryoutStatus={handleTryoutStatus}
                                    onOpenApplications={allowedTabIds.has('applications') ? () => switchTab('applications') : undefined}
                                    onOpenPlayers={allowedTabIds.has('players') ? () => openPlayerWorkflow() : undefined}
                                    onOpenSquads={allowedTabIds.has('squads') ? () => switchTab('squads') : undefined}
                                />
                                </>
                            )}

                            {activeTab === 'inbox' && (
                                <InboxTab
                                    notifications={inboxNotifications}
                                    loading={inboxLoading}
                                    loadingMore={inboxLoadingMore}
                                    busyId={inboxBusyId}
                                    hasMore={inboxHasMore}
                                    unreadCount={inboxUnreadCount}
                                    error={inboxError}
                                    onOpen={handleInboxOpen}
                                    onLoadMore={handleInboxLoadMore}
                                    onMarkAllRead={handleInboxMarkAllRead}
                                    onRetry={() => { void loadInbox(0, false); }}
                                />
                            )}
                        </div>
                    )}
                </div>
            </main>

            {showLegacyContext && <ContextPanel
                activeTab={activeTab}
                overview={overview}
                playerDirectory={playerDirectory}
                tryoutApplicants={tryoutApplicants}
                pendingTryoutCount={authoritativeTryoutPendingCount}
                upcomingEvents={upcomingEvents}
                scheduleLoading={scheduleLoading}
                scheduleError={scheduleError}
                currentRole={currentRole}
                onTabChange={switchTab}
                onOpenSchedule={() => { setContextOpen(false); navigate(`/calendar?clubId=${clubId}`); }}
                onRetrySchedule={() => { void loadUpcomingSchedule(); }}
                mobileOpen={contextOpen}
                onClose={() => setContextOpen(false)}
            />}
        </div>
        {acceptTarget && (
            <DecisionNoteModal
                title={t('decisions.acceptTitle')}
                subtitle={t(acceptTarget.role === 'PLAYER' ? 'decisions.acceptSubtitle' : 'decisions.staffAcceptSubtitle', { name: acceptTarget.fullName || acceptTarget.username })}
                templateKey={acceptTarget.role === 'PLAYER' ? 'decisions.template' : 'decisions.staffTemplate'}
                saving={!!pendingKey && pendingKey.startsWith('accept-')}
                onClose={() => setAcceptTarget(null)}
                onConfirm={(message) => void handleAcceptConfirm(message)}
            />
        )}
        {tryoutAcceptTarget && (
            <DecisionNoteModal
                title={t('decisions.tryoutAcceptTitle')}
                subtitle={t('decisions.acceptSubtitle', { name: tryoutAcceptTarget.name })}
                saving={!!pendingKey && pendingKey.startsWith('tryout-')}
                onClose={() => setTryoutAcceptTarget(null)}
                onConfirm={(message) => void handleTryoutAcceptConfirm(message)}
            />
        )}
        {declineTarget && (
            <DecisionNoteModal
                title={t('decisions.declineTitle')}
                subtitle={t('decisions.declineSubtitle', { name: declineTarget.fullName || declineTarget.username })}
                saving={!!pendingKey && pendingKey.startsWith('decline-')}
                confirmLabel={t('applications.declineConfirm')}
                danger
                templateKey={declineTarget.role === 'PLAYER' ? 'decisions.declineTemplate' : 'decisions.declineApplicationTemplate'}
                onClose={() => setDeclineTarget(null)}
                onConfirm={(message) => void handleDeclineConfirm(message)}
            />
        )}
        {tryoutDeclineTarget && (
            <DecisionNoteModal
                title={t('decisions.tryoutDeclineTitle')}
                subtitle={t('decisions.declineSubtitle', { name: tryoutDeclineTarget.name })}
                saving={!!pendingKey && pendingKey.startsWith('tryout-')}
                confirmLabel={t('applications.declineConfirm')}
                danger
                templateKey="decisions.declineTemplate"
                onClose={() => setTryoutDeclineTarget(null)}
                onConfirm={(message) => void handleTryoutDeclineConfirm(message)}
            />
        )}
        <ConfirmDialog
            open={showStatusConfirm}
            title={pendingStatusRef.current?.status === 'PAST' ? 'Mark as Past Player' : 'Remove Player'}
            message={pendingStatusRef.current?.status === 'PAST'
                ? `Mark "${pendingStatusRef.current?.playerName || 'this player'}" as a past player? They will be removed from ALL squads.`
                : `Remove "${pendingStatusRef.current?.playerName || 'this player'}" from the club? They will be removed from ALL squads.`}
            confirmLabel={pendingStatusRef.current?.status === 'PAST' ? 'Mark as Past' : 'Remove'}
            variant="danger"
            noteField={{
                label: t('decisions.releaseNoteLabel'),
                placeholder: t('decisions.releaseNotePlaceholder'),
                maxLength: 1000,
                value: releaseMessage,
                onChange: setReleaseMessage,
            }}
            onConfirm={handleConfirmStatus}
            onCancel={() => { setShowStatusConfirm(false); pendingStatusRef.current = null; setReleaseMessage(''); }}
        />
    </>);
}
