import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Briefcase,
    CheckCircle2,
    CreditCard,
    Crown,
    Handshake,
    LayoutDashboard,
    Settings,
    ShieldCheck,
    ShoppingBag,
    UserPlus,
    Users,
    X
} from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import {
    clubRoleLabel,
    canReviewTryouts,
    isLeadershipRole,
    isLegacyAgentMembershipRole,
    type ClubManagedMember,
    type ClubManagementOverview,
    type ClubMembershipRole,
    type ClubPlayerAffiliation,
    type PlayerAffiliationStatus,
    type PageResult
} from '../features/clubs/domain';
import {
    acceptClubApplication,
    cancelClubInvitation,
    createClubInvitation,
    declineClubApplication,
    fetchClubPlayers,
    fetchClubManagementOverview,
    leaveClubMembership,
    removeClubMember,
    searchClubInviteCandidates,
    sendParentalConsentEmail,
    updateClubPlayerStatus,
    transferClubOwnership,
    updateClubMemberRole
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
import { getStoredUserId } from '../utils/authStorage';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ErrorBlock, PageSpinner } from '../components/workspace/helpers';
import { WorkspaceSidebar } from '../components/workspace/WorkspaceSidebar';
import { ContextPanel } from '../components/workspace/ContextPanel';
import { OverviewTab } from '../components/workspace/tabs/OverviewTab';
import { PersonnelTab } from '../components/workspace/tabs/PersonnelTab';
import { PlayersTab } from '../components/workspace/tabs/PlayersTab';
import { InvitesTab } from '../components/workspace/tabs/InvitesTab';
import { ApplicationsTab } from '../components/workspace/tabs/ApplicationsTab';
import { RolesTab } from '../components/workspace/tabs/RolesTab';
import { JobsTab } from '../components/workspace/tabs/JobsTab';
import { SettingsTab } from '../components/workspace/tabs/SettingsTab';
import { StoreTab } from '../components/workspace/tabs/StoreTab';
import { SquadsTab } from '../components/workspace/tabs/SquadsTab';
import { PlayerCardsTab } from '../components/workspace/tabs/PlayerCardsTab';
import { TryoutsTab } from '../components/workspace/tabs/TryoutsTab';
import { InboxTab } from '../components/workspace/tabs/InboxTab';
import { AgentEngagementsTab } from '../components/workspace/tabs/AgentEngagementsTab';
import type { WorkspaceTab, TabItem, UserSearchDto, TryoutApplicantDto } from '../components/workspace/types';

// ── page ──

export default function ClubWorkspacePage({ darkMode }: { darkMode: boolean }) {
    const { id: clubIdParam } = useParams<{ id: string }>();
    const clubId = Number(clubIdParam);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentUserId = Number(getStoredUserId() || 0) || null;

    // ── tab state ──
    const initialTab = (searchParams.get('tab') as WorkspaceTab) || 'overview';
    const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);

    useEffect(() => {
        const urlTab = searchParams.get('tab') as WorkspaceTab | null;
        if (urlTab && urlTab !== activeTab) {
            setActiveTab(urlTab);
        }
    }, [searchParams]);

    const switchTab = (tab: WorkspaceTab) => {
        setActiveTab(tab);
        const next = new URLSearchParams(searchParams);
        if (tab === 'overview') {
            next.delete('tab');
        } else {
            next.set('tab', tab);
        }
        setSearchParams(next, { replace: true });
    };

    // ── theme (driven by global TopNav toggle) ──

    // ── confirmation dialogs ──
    const [showStatusConfirm, setShowStatusConfirm] = useState(false);
    const pendingStatusRef = useRef<{ userId: number; status: PlayerAffiliationStatus; playerName?: string } | null>(null);

    // ── data ──
    const [overview, setOverview] = useState<ClubManagementOverview | null>(null);
    const [overviewLoading, setOverviewLoading] = useState(true);
    const [overviewError, setOverviewError] = useState<string | null>(null);
    const [tryoutApplicants, setTryoutApplicants] = useState<TryoutApplicantDto[]>([]);
    const [tryoutsLoading, setTryoutsLoading] = useState(false);

    const [playerStatusFilter, setPlayerStatusFilter] = useState<'ALL' | PlayerAffiliationStatus>('ALL');
    const [playerPage, setPlayerPage] = useState(0);
    const [playerDirectory, setPlayerDirectory] = useState<PageResult<ClubPlayerAffiliation> | null>(null);
    const [playerLoading, setPlayerLoading] = useState(false);
    const [playerError, setPlayerError] = useState<string | null>(null);

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

    // ── inbox state ──
    const [inboxNotifications, setInboxNotifications] = useState<NotificationItem[]>([]);
    const [inboxPage, setInboxPage] = useState(0);
    const [inboxTotalElements, setInboxTotalElements] = useState(0);
    const [inboxLoading, setInboxLoading] = useState(true);
    const [inboxLoadingMore, setInboxLoadingMore] = useState(false);
    const [inboxBusyId, setInboxBusyId] = useState<number | null>(null);
    const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
    const inboxActiveRef = useRef(true);
    useEffect(() => { inboxActiveRef.current = true; return () => { inboxActiveRef.current = false; }; }, []);

    const currentRole: string | null = overview?.currentUserRole ?? null;
    const canManageLeadership = isLeadershipRole(currentRole);
    const canManageTryouts = canReviewTryouts(currentRole);
    const isOwner = currentRole === 'OWNER';

    const invitedUserIds = useMemo(() => new Set(overview?.pendingInvitations.map((i) => i.userId) || []), [overview]);
    const transferCandidates = useMemo(
        () => (overview?.members || []).filter((m) => isOwner && m.userId !== currentUserId && m.role !== 'OWNER' && !isLegacyAgentMembershipRole(m.role)),
        [overview, isOwner, currentUserId]
    );
    const overdueTrialistCount = overview?.overdueTrialistCount ?? 0;

    // ── data loading ──

    const loadOverview = async () => {
        setOverviewLoading(true);
        setOverviewError(null);
        try {
            const response = await fetchClubManagementOverview(clubId);
            setOverview(response);
            if (response.assignableInviteRoles.length > 0 && !response.assignableInviteRoles.includes(selectedInviteRole)) {
                setSelectedInviteRole(response.assignableInviteRoles[0]);
            }
        } catch (error) {
            setOverviewError(extractApiErrorMessage(error, 'Failed to load club management data.'));
        } finally {
            setOverviewLoading(false);
        }
    };

    const loadPlayers = async () => {
        setPlayerLoading(true);
        setPlayerError(null);
        try {
            const response = await fetchClubPlayers(clubId, playerStatusFilter === 'ALL' ? null : playerStatusFilter, playerPage, 20);
            setPlayerDirectory(response);
        } catch (error) {
            setPlayerError(extractApiErrorMessage(error, 'Failed to load player affiliations.'));
        } finally {
            setPlayerLoading(false);
        }
    };

    const loadTryouts = async () => {
        setTryoutsLoading(true);
        try {
            const response = await apiClient.get<TryoutApplicantDto[]>(`/admin/tryouts/clubs/${clubId}/applications`);
            setTryoutApplicants(response.data || []);
        } catch {
            // non-critical
        } finally {
            setTryoutsLoading(false);
        }
    };

    useEffect(() => { void loadOverview(); void loadTryouts(); }, [clubId]);
    useEffect(() => { void loadPlayers(); }, [clubId, playerPage, playerStatusFilter]);

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
        if (page === 0 && !append) setInboxLoading(true);
        else setInboxLoadingMore(true);
        try {
            const response = await fetchNotifications({ page, size: PAGE_SIZE, scope: 'club', clubId });
            if (inboxActiveRef.current) {
                setInboxPage(response.pageNumber);
                setInboxTotalElements(response.totalElements);
                setInboxNotifications(prev => append ? [...prev, ...response.content] : response.content);
            }
        } catch {
            // non-critical
        } finally {
            if (inboxActiveRef.current) {
                setInboxLoading(false);
                setInboxLoadingMore(false);
            }
        }
    }, [clubId]);

    const loadInboxUnreadCount = useCallback(async () => {
        try {
            const response = await fetchUnreadNotificationCount({ scope: 'club', clubId });
            if (inboxActiveRef.current) {
                setInboxUnreadCount(response.unreadCount);
            }
        } catch { /* silent */ }
    }, [clubId]);

    useEffect(() => {
        if (activeTab !== 'inbox') return;
        setInboxPage(0);
        setInboxNotifications([]);
        void loadInbox(0, false);
        void loadInboxUnreadCount();
    }, [activeTab, clubId, loadInbox, loadInboxUnreadCount]);

    useEffect(() => {
        const unsubscribe = subscribeNotificationsChanged(() => {
            void loadInboxUnreadCount();
        });
        return () => unsubscribe();
    }, [loadInboxUnreadCount]);

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

    const handleAcceptApplication = async (applicationId: number) => {
        await runAction(`accept-${applicationId}`, async () => {
            await acceptClubApplication(clubId, applicationId);
            await loadOverview();
            setSuccessMessage('Application accepted.');
        });
    };

    const handleDeclineApplication = async (applicationId: number) => {
        await runAction(`decline-${applicationId}`, async () => {
            await declineClubApplication(clubId, applicationId);
            await loadOverview();
            setSuccessMessage('Application declined.');
        });
    };

    const handlePlayerStatusChange = async (userId: number, status: PlayerAffiliationStatus, playerName?: string) => {
        if (status === 'PAST' || status === 'REMOVED') {
            pendingStatusRef.current = { userId, status, playerName };
            setShowStatusConfirm(true);
            return;
        }
        await executeStatusChange(userId, status);
    };

    const executeStatusChange = async (userId: number, status: PlayerAffiliationStatus) => {
        await runAction(`player-${userId}-${status}`, async () => {
            await updateClubPlayerStatus(clubId, userId, status);
            await Promise.all([loadOverview(), loadPlayers()]);
            setSuccessMessage(`Player status updated to ${status}.`);
        });
    };

    const handleSendConsentEmail = async (userId: number, parentEmail?: string | null) => {
        await runAction(`consent-${userId}`, async () => {
            await sendParentalConsentEmail(clubId, userId, parentEmail);
            setSuccessMessage('Consent email queued to the parent.');
        });
    };

    const handleConfirmStatus = async () => {
        setShowStatusConfirm(false);
        const pending = pendingStatusRef.current;
        if (!pending) return;
        await executeStatusChange(pending.userId, pending.status);
        pendingStatusRef.current = null;
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
            await leaveClubMembership(clubId);
            setConfirmingSelfLeave(false);
            navigate(`/clubs/${clubId}`);
        });
    };

    const handleTryoutStatus = async (applicationId: number, status: 'ACCEPTED' | 'REJECTED') => {
        await runAction(`tryout-${applicationId}-${status}`, async () => {
            await apiClient.put(`/admin/tryouts/clubs/${clubId}/applications/${applicationId}/status`, null, { params: { status } });
            await loadTryouts();
            setSuccessMessage(`Tryout ${status === 'ACCEPTED' ? 'accepted' : 'declined'}.`);
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
            { id: 'overview', label: 'Overview', icon: LayoutDashboard }
        ];
        if (canManageLeadership) {
            items.push({ id: 'personnel', label: 'Personnel', icon: Users, badge: overview ? String(overview.members.length) : null });
            items.push({ id: 'players', label: 'Players', icon: Users, badge: overview ? String((overview.activePlayerCount || 0) + (overview.trialistCount || 0)) : null });
            items.push({ id: 'invites', label: 'Invites', icon: UserPlus, badge: overview && overview.pendingInvitations.length > 0 ? String(overview.pendingInvitations.length) : null });
            items.push({ id: 'applications', label: 'Applications', icon: CheckCircle2, badge: overview && overview.pendingApplications.length > 0 ? String(overview.pendingApplications.length) : null });
            items.push({ id: 'roles', label: 'Roles', icon: Crown });
        items.push({ id: 'jobs', label: 'Jobs', icon: Briefcase });
        items.push({ id: 'store', label: 'Store', icon: ShoppingBag });
        items.push({ id: 'settings', label: 'Settings', icon: Settings });
            items.push({ id: 'squads', label: 'Squads', icon: ShieldCheck });
            items.push({ id: 'player-cards', label: 'Player Cards', icon: CreditCard });
        }
        if (canManageTryouts) {
            items.push({ id: 'tryouts', label: 'Tryouts', icon: CheckCircle2, badge: tryoutApplicants.length > 0 ? String(tryoutApplicants.length) : null });
        }
        if (canManageLeadership) {
            items.push({ id: 'engagements', label: 'Agents', icon: Handshake });
        }
        return items;
    }, [canManageLeadership, canManageTryouts, overview, tryoutApplicants.length]);

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
        <div className={`flex h-[calc(100dvh-var(--app-header-height))] workspace-page-shell ${!darkMode ? 'workspace-light' : ''}`}>
            <WorkspaceSidebar
                clubId={clubId}
                overview={overview}
                activeTab={activeTab}
                tabs={tabs}
                unreadInboxCount={inboxUnreadCount}
                onTabChange={switchTab}
                onNavigate={navigate}
            />

            {/* ── main content ── */}
            <main className="flex-1 overflow-y-auto">
                <div className="sticky top-0 z-10 space-y-2 px-6 pt-4">
                    {errorMessage && (
                        <div className="rounded-xl border border-[var(--fc-state-danger-soft)] bg-[var(--fc-state-danger-soft)] px-4 py-2.5 text-sm flex items-center justify-between">
                            <span className="font-medium text-[var(--fc-text-primary)]">{errorMessage}</span>
                            <button type="button" onClick={() => setErrorMessage(null)} className="text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]"><X className="h-4 w-4" /></button>
                        </div>
                    )}
                    {successMessage && (
                        <div className="rounded-xl border border-[var(--fc-accent-soft)] bg-[var(--fc-accent-soft)] px-4 py-2.5 text-sm flex items-center justify-between">
                            <span className="font-medium text-[var(--fc-text-primary)]">{successMessage}</span>
                            <button type="button" onClick={() => setSuccessMessage(null)} className="text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]"><X className="h-4 w-4" /></button>
                        </div>
                    )}
                </div>

                <div className="px-6 py-5">
                    {overviewLoading && !overview ? (
                        <PageSpinner />
                    ) : overviewError && !overview ? (
                        <ErrorBlock message={overviewError} onRetry={() => { void loadOverview(); }} />
                    ) : (
                        <div className="space-y-4">
                            {activeTab === 'overview' && (
                                <OverviewTab overview={overview} clubId={clubId} onTabChange={switchTab} overdueTrialistCount={overdueTrialistCount} />
                            )}

                            {activeTab === 'personnel' && (
                                <PersonnelTab
                                    overview={overview}
                                    currentUserId={currentUserId}
                                    currentRole={currentRole}
                                    pendingKey={pendingKey}
                                    confirmingRemovalUserId={confirmingRemovalUserId}
                                    onRoleChange={handleRoleChange}
                                    onRemoveMember={handleRemoveMember}
                                    onConfirmRemoval={setConfirmingRemovalUserId}
                                />
                            )}

                            {activeTab === 'players' && (
                                <PlayersTab
                                    playerDirectory={playerDirectory}
                                    playerLoading={playerLoading}
                                    playerError={playerError}
                                    playerStatusFilter={playerStatusFilter}
                                    pendingKey={pendingKey}
                                    totalPlayerPages={totalPlayerPages}
                                    onStatusFilterChange={(f) => { setPlayerStatusFilter(f); setPlayerPage(0); }}
                                    onPlayerStatusChange={handlePlayerStatusChange}
                                    onRetry={() => { void loadPlayers(); }}
                                    onPageChange={setPlayerPage}
                                    onMessagePlayer={(userId) => navigate(`/messages?chatWith=${userId}`)}
                                    onSendConsentEmail={handleSendConsentEmail}
                                    onTabChange={switchTab}
                                />
                            )}

                            {activeTab === 'invites' && (
                                <InvitesTab
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
                                />
                            )}

                            {activeTab === 'applications' && (
                                <ApplicationsTab
                                    overview={overview}
                                    pendingKey={pendingKey}
                                    onAcceptApplication={handleAcceptApplication}
                                    onDeclineApplication={handleDeclineApplication}
                                />
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
                                    transferCandidates={transferCandidates}
                                    onConfirmOwnershipTransfer={setConfirmingOwnershipTransferUserId}
                                    onTransferOwnership={handleTransferOwnership}
                                    onConfirmSelfLeave={setConfirmingSelfLeave}
                                    onLeaveClub={handleLeaveClub}
                                    onOpenJobs={() => switchTab('jobs')}
                                />
                            )}

                            {activeTab === 'jobs' && (
                                <JobsTab clubId={clubId} pendingKey={pendingKey} />
                            )}

                            {activeTab === 'store' && (
                                <StoreTab clubId={clubId} pendingKey={pendingKey} />
                            )}

                            {activeTab === 'settings' && (
                                <SettingsTab clubId={clubId} pendingKey={pendingKey} />
                            )}

                            {activeTab === 'squads' && (
                                <SquadsTab
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
                                <TryoutsTab
                                    tryoutApplicants={tryoutApplicants}
                                    tryoutsLoading={tryoutsLoading}
                                    pendingKey={pendingKey}
                                    onTryoutStatus={handleTryoutStatus}
                                />
                            )}

                            {activeTab === 'engagements' && (
                                <AgentEngagementsTab clubId={clubId} />
                            )}

                            {activeTab === 'inbox' && (
                                <InboxTab
                                    notifications={inboxNotifications}
                                    loading={inboxLoading}
                                    loadingMore={inboxLoadingMore}
                                    busyId={inboxBusyId}
                                    hasMore={inboxHasMore}
                                    unreadCount={inboxUnreadCount}
                                    onOpen={handleInboxOpen}
                                    onLoadMore={handleInboxLoadMore}
                                    onMarkAllRead={handleInboxMarkAllRead}
                                />
                            )}
                        </div>
                    )}
                </div>
            </main>

            <ContextPanel
                activeTab={activeTab}
                overview={overview}
                playerDirectory={playerDirectory}
                tryoutApplicants={tryoutApplicants}
                currentRole={currentRole}
                onTabChange={switchTab}
            />
        </div>
        <ConfirmDialog
            open={showStatusConfirm}
            title={pendingStatusRef.current?.status === 'PAST' ? 'Mark as Past Player' : 'Remove Player'}
            message={pendingStatusRef.current?.status === 'PAST'
                ? `Mark "${pendingStatusRef.current?.playerName || 'this player'}" as a past player? They will be removed from ALL squads.`
                : `Remove "${pendingStatusRef.current?.playerName || 'this player'}" from the club? They will be removed from ALL squads.`}
            confirmLabel={pendingStatusRef.current?.status === 'PAST' ? 'Mark as Past' : 'Remove'}
            variant="danger"
            onConfirm={handleConfirmStatus}
            onCancel={() => { setShowStatusConfirm(false); pendingStatusRef.current = null; }}
        />
    </>);
}
