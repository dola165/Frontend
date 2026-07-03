import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    BellRing,
    CheckCircle2,
    Crown,
    Loader2,
    Search,
    Settings,
    ShieldCheck,
    UserPlus,
    Users,
    X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import {
    clubApplicationStatusLabel,
    clubInviteStatusLabel,
    canReviewTryouts,
    clubRoleLabel,
    isLegacyAgentMembershipRole,
    isLeadershipRole,
    type ClubManagedMember,
    type ClubManagementOverview,
    type ClubPlayerAffiliation,
    type ClubMembershipRole,
    type PlayerAffiliationStatus,
    type PageResult
} from '../../features/clubs/domain';
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
    updateClubPlayerStatus,
    transferClubOwnership,
    updateClubMemberRole
} from '../../features/clubs/api';
import { extractApiErrorMessage } from '../../utils/apiError';
import { getStoredUserId } from '../../utils/authStorage';
import { createNotificationSearch } from '../../utils/notifications';

export type ClubManagementTab = 'personnel' | 'players' | 'invites' | 'applications' | 'roles' | 'squads' | 'tryouts';

interface ClubManagementModalProps {
    clubId: number;
    clubName: string;
    currentRole: string | null;
    initialTab?: ClubManagementTab | null;
    onClose: () => void;
    onSquadCreated?: () => void;
    onDataChanged?: () => void;
    onMembershipLeft?: () => Promise<void> | void;
}

interface UserSearchDto {
    id: number;
    fullName?: string | null;
    username: string;
    position?: string | null;
    userType?: string | null;
}

interface TryoutApplicantDto {
    id: number;
    userId: number;
    name: string;
    position?: string | null;
    ageGroup?: string | null;
    status: string;
    profilePictureUrl?: string | null;
    matchScore: number;
    attributes: Record<string, number>;
}

interface TabItem {
    id: ClubManagementTab;
    label: string;
    icon: LucideIcon;
    badge?: string | null;
}

const avatarLetter = (value?: string | null) => (value?.trim()?.charAt(0) || '?').toUpperCase();

const formatMetaTime = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const sectionLead = (eyebrow: string, title: string, description: string, action?: ReactNode) => (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">{eyebrow}</p>
            <h3 className="mt-3 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-600 dark:text-slate-300">{description}</p>
        </div>
        {action}
    </div>
);

export const ClubManagementModal = ({
    clubId,
    clubName,
    currentRole,
    initialTab = null,
    onClose,
    onSquadCreated,
    onDataChanged,
    onMembershipLeft
}: ClubManagementModalProps) => {
    const navigate = useNavigate();
    const currentUserId = Number(getStoredUserId() || 0) || null;
    const canManageLeadership = isLeadershipRole(currentRole);
    const canManageTryouts = canReviewTryouts(currentRole);
    const [activeTab, setActiveTab] = useState<ClubManagementTab>(initialTab ?? (canManageLeadership ? 'personnel' : 'tryouts'));
    const [overview, setOverview] = useState<ClubManagementOverview | null>(null);
    const [overviewLoading, setOverviewLoading] = useState(canManageLeadership);
    const [overviewError, setOverviewError] = useState<string | null>(null);
    const [tryoutApplicants, setTryoutApplicants] = useState<TryoutApplicantDto[]>([]);
    const [tryoutsLoading, setTryoutsLoading] = useState(canManageTryouts);
    const [tryoutsError, setTryoutsError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchPage, setSearchPage] = useState(0);
    const [searchResults, setSearchResults] = useState<PageResult<UserSearchDto> | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedInviteRole, setSelectedInviteRole] = useState<ClubMembershipRole>('COACH');
    const [playerStatusFilter, setPlayerStatusFilter] = useState<'ALL' | PlayerAffiliationStatus>('ALL');
    const [playerPage, setPlayerPage] = useState(0);
    const [playerDirectory, setPlayerDirectory] = useState<PageResult<ClubPlayerAffiliation> | null>(null);
    const [playerLoading, setPlayerLoading] = useState(false);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const [squadForm, setSquadForm] = useState({ name: '', category: 'SENIOR', gender: 'MALE' });
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [confirmingRemovalUserId, setConfirmingRemovalUserId] = useState<number | null>(null);
    const [confirmingOwnershipTransferUserId, setConfirmingOwnershipTransferUserId] = useState<number | null>(null);
    const [confirmingSelfLeave, setConfirmingSelfLeave] = useState(false);

    const loadOverview = async () => {
        if (!canManageLeadership) return;
        setOverviewLoading(true);
        setOverviewError(null);
        try {
            const response = await fetchClubManagementOverview(clubId);
            setOverview(response);
            if (response.assignableInviteRoles.length > 0) {
                setSelectedInviteRole((current) => response.assignableInviteRoles.includes(current) ? current : response.assignableInviteRoles[0]);
            }
        } catch (error) {
            setOverviewError(extractApiErrorMessage(error, 'Failed to load club management.'));
        } finally {
            setOverviewLoading(false);
        }
    };

    const loadPlayers = async () => {
        if (!canManageLeadership) return;
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
        if (!canManageTryouts) return;
        setTryoutsLoading(true);
        setTryoutsError(null);
        try {
            const response = await apiClient.get<TryoutApplicantDto[]>(`/admin/tryouts/clubs/${clubId}/applications`);
            setTryoutApplicants(response.data || []);
        } catch (error) {
            setTryoutsError(extractApiErrorMessage(error, 'Failed to load tryout applications.'));
        } finally {
            setTryoutsLoading(false);
        }
    };

    useEffect(() => {
        void loadOverview();
        void loadTryouts();
    }, [clubId, canManageLeadership, canManageTryouts]);

    useEffect(() => {
        if (!canManageLeadership || activeTab !== 'players') {
            return;
        }
        void loadPlayers();
    }, [activeTab, canManageLeadership, clubId, playerPage, playerStatusFilter]);

    useEffect(() => {
        if (!canManageLeadership || activeTab !== 'invites') return;
        if (searchQuery.trim().length < 2) {
            setSearchResults(null);
            return;
        }
        const timeoutId = window.setTimeout(async () => {
            setSearchLoading(true);
            try {
                const response = await searchClubInviteCandidates(clubId, searchQuery, searchPage, 8);
                setSearchResults(response as PageResult<UserSearchDto>);
            } catch (error) {
                setErrorMessage(extractApiErrorMessage(error, 'Failed to search users.'));
                setSearchResults(null);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
        return () => window.clearTimeout(timeoutId);
    }, [activeTab, canManageLeadership, clubId, searchPage, searchQuery]);

    const tabs = useMemo<TabItem[]>(() => {
        const items: TabItem[] = [];
        if (canManageLeadership) {
            items.push({ id: 'personnel', label: 'Personnel', icon: Users, badge: overview ? String(overview.members.length) : null });
            items.push({ id: 'players', label: 'Players', icon: Users, badge: overview ? String((overview.activePlayerCount || 0) + (overview.trialistCount || 0)) : null });
            items.push({ id: 'invites', label: 'Invites', icon: UserPlus, badge: overview && overview.pendingInvitations.length > 0 ? String(overview.pendingInvitations.length) : null });
            items.push({ id: 'applications', label: 'Applications', icon: CheckCircle2, badge: overview && overview.pendingApplications.length > 0 ? String(overview.pendingApplications.length) : null });
            items.push({ id: 'roles', label: 'Roles', icon: Crown });
            items.push({ id: 'squads', label: 'Squads', icon: ShieldCheck });
        }
        if (canManageTryouts) items.push({ id: 'tryouts', label: 'Tryouts', icon: CheckCircle2, badge: tryoutApplicants.length > 0 ? String(tryoutApplicants.length) : null });
        return items;
    }, [canManageLeadership, canManageTryouts, overview, tryoutApplicants.length]);

    useEffect(() => {
        const allowedTabs = new Set<ClubManagementTab>();
        if (canManageLeadership) {
            allowedTabs.add('personnel');
            allowedTabs.add('players');
            allowedTabs.add('invites');
            allowedTabs.add('applications');
            allowedTabs.add('roles');
            allowedTabs.add('squads');
        }
        if (canManageTryouts) {
            allowedTabs.add('tryouts');
        }

        setActiveTab((current) => {
            if (initialTab && allowedTabs.has(initialTab)) {
                return initialTab;
            }

            if (allowedTabs.has(current)) {
                return current;
            }

            return canManageLeadership ? 'personnel' : 'tryouts';
        });
    }, [initialTab, canManageLeadership, canManageTryouts]);

    const totalSearchPages = searchResults ? Math.max(1, Math.ceil(searchResults.totalElements / Math.max(searchResults.pageSize, 1))) : 1;
    const totalPlayerPages = playerDirectory ? Math.max(1, Math.ceil(playerDirectory.totalElements / Math.max(playerDirectory.pageSize, 1))) : 1;
    const invitedUserIds = useMemo(() => new Set(overview?.pendingInvitations.map((invite) => invite.userId) || []), [overview]);
    const transferCandidates = useMemo(() => (overview?.members || []).filter((member) => currentRole === 'OWNER' && member.userId !== currentUserId && member.role !== 'OWNER' && !isLegacyAgentMembershipRole(member.role)), [overview, currentRole, currentUserId]);
    const playerMemberCount = overview?.activePlayerCount ?? 0;

    const canRemoveMember = (member: ClubManagedMember) => {
        if (!currentUserId || member.userId === currentUserId || member.role === 'OWNER') return false;
        if (currentRole === 'OWNER') return !isLegacyAgentMembershipRole(member.role);
        return currentRole === 'CLUB_ADMIN' && member.role !== 'CLUB_ADMIN';
    };

    const memberLockReason = (member: ClubManagedMember) => {
        if (member.userId === currentUserId) return 'Your own role stays locked here. Use the membership exit action in the club operations flow when you need to step away.';
        if (member.role === 'OWNER') return 'Club ownership is protected. Handle ownership transfer from the Roles tab before any departure.';
        if (isLegacyAgentMembershipRole(member.role)) return 'Legacy agent memberships remain read-only in this club model.';
        if (currentRole === 'CLUB_ADMIN' && member.role === 'CLUB_ADMIN') return 'Club admins cannot change another club admin.';
        return member.roleEditable ? null : 'This role is locked by the current club authority rules.';
    };

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

    const handleOpenNotifications = () => {
        onClose();
        navigate(`/notifications?${createNotificationSearch('club', clubId, clubName)}`);
    };

    const handleOpenSquadsWorkspace = () => {
        onClose();
        navigate(`/clubs/${clubId}/squads`);
    };

    const retryState = (title: string, description: string, onRetry: () => void) => (
        <div className="theme-surface theme-border rounded-2xl border px-6 py-12 text-center">
            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">{title}</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm font-medium text-slate-600 dark:text-slate-300">{description}</p>
            <button type="button" onClick={onRetry} className="mt-6 inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-slate-200 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-900 shadow-[4px_4px_0px_0px_#020617] transition-all hover:bg-slate-300 active:translate-y-0.5 active:shadow-none dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700">
                Retry
            </button>
        </div>
    );

    const handleInvite = async (userId: number) => {
        await runAction(`invite-${userId}`, async () => {
            await createClubInvitation(clubId, userId, selectedInviteRole);
            await loadOverview();
            setSuccessMessage('Invitation sent.');
        });
    };

    const handleRoleChange = async (userId: number, role: ClubMembershipRole) => {
        await runAction(`role-${userId}`, async () => {
            await updateClubMemberRole(clubId, userId, role);
            await loadOverview();
            onDataChanged?.();
            setSuccessMessage(`Role updated to ${clubRoleLabel(role)}.`);
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
        await runAction(`application-accept-${applicationId}`, async () => {
            await acceptClubApplication(clubId, applicationId);
            await loadOverview();
            onDataChanged?.();
            onSquadCreated?.();
            setSuccessMessage('Membership application accepted.');
        });
    };

    const handleDeclineApplication = async (applicationId: number) => {
        await runAction(`application-decline-${applicationId}`, async () => {
            await declineClubApplication(clubId, applicationId);
            await loadOverview();
            setSuccessMessage('Membership application declined.');
        });
    };

    const handlePlayerStatusChange = async (userId: number, status: PlayerAffiliationStatus, playerName?: string) => {
        // Confirm destructive actions that remove player from all squads
        if ((status === 'PAST' || status === 'REMOVED')) {
            const actionLabel = status === 'PAST' ? 'mark as past' : 'remove';
            const warning = status === 'PAST'
                ? `Mark "${playerName || 'this player'}" as a past player? They will be removed from ALL squads.`
                : `Remove "${playerName || 'this player'}" from the club? They will be removed from ALL squads.`;
            if (!window.confirm(warning)) return;
        }
        await runAction(`player-${userId}-${status}`, async () => {
            await updateClubPlayerStatus(clubId, userId, status);
            await Promise.all([loadOverview(), loadPlayers()]);
            onDataChanged?.();
            onSquadCreated?.();
            setSuccessMessage(`Player status updated to ${status}.`);
        });
    };

    const handleRemoveMember = async (member: ClubManagedMember) => {
        await runAction(`remove-${member.userId}`, async () => {
            await removeClubMember(clubId, member.userId);
            await loadOverview();
            onSquadCreated?.();
            onDataChanged?.();
            setConfirmingRemovalUserId(null);
            setSuccessMessage(`${member.fullName || member.username} was removed from the club.`);
        });
    };

    const handleTransferOwnership = async (member: ClubManagedMember) => {
        await runAction(`transfer-${member.userId}`, async () => {
            await transferClubOwnership(clubId, member.userId);
            setConfirmingOwnershipTransferUserId(null);
            onDataChanged?.();
            onClose();
        });
    };

    const handleLeaveClub = async () => {
        await runAction('leave-club', async () => {
            await leaveClubMembership(clubId);
            setConfirmingSelfLeave(false);
            if (onMembershipLeft) {
                await onMembershipLeft();
                return;
            }
            onClose();
        });
    };

    const handleCreateSquad = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await runAction('create-squad', async () => {
            await apiClient.post(`/clubs/${clubId}/squads`, squadForm);
            setSquadForm({ name: '', category: 'SENIOR', gender: 'MALE' });
            onSquadCreated?.();
            setSuccessMessage('Squad created.');
        });
    };

    const handleTryoutStatus = async (applicationId: number, status: 'ACCEPTED' | 'REJECTED') => {
        await runAction(`tryout-${applicationId}-${status}`, async () => {
            await apiClient.put(`/admin/tryouts/clubs/${clubId}/applications/${applicationId}/status`, null, { params: { status } });
            await loadTryouts();
            setSuccessMessage(`Tryout application ${status === 'ACCEPTED' ? 'accepted' : 'declined'}.`);
        });
    };

    return (
        <div className="theme-overlay-strong fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="theme-surface theme-border flex h-[86vh] w-full max-w-6xl overflow-hidden rounded-2xl border shadow-2xl">
                <aside className="theme-surface-strong theme-border flex w-full max-w-[250px] shrink-0 flex-col border-r">
                    <div className="theme-border border-b px-5 py-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                            <Settings className="h-3.5 w-3.5" />
                            Club Operations
                        </div>
                        <h2 className="mt-4 text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">{clubName}</h2>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Current clearance: {currentRole ? clubRoleLabel(currentRole) : 'Visitor'}</p>
                    </div>

                    <div className="flex-1 space-y-2 p-3">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm font-black uppercase tracking-wide transition-colors ${isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}>
                                    <span className="flex items-center gap-3"><Icon className="h-4 w-4" />{tab.label}</span>
                                    {tab.badge && <span className={`rounded-full px-2 py-0.5 text-[10px] font-black tracking-[0.18em] ${isActive ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'theme-surface theme-border border'}`}>{tab.badge}</span>}
                                </button>
                            );
                        })}
                        <button type="button" onClick={handleOpenNotifications} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                            <BellRing className="h-4 w-4" />
                            Notifications
                        </button>
                    </div>

                    <div className="theme-border border-t p-3">
                        <button type="button" onClick={onClose} className="theme-surface-muted theme-border flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white">
                            <X className="h-4 w-4" />
                            Close
                        </button>
                    </div>
                </aside>

                <section className="theme-surface-muted flex-1 overflow-y-auto px-6 py-6">
                    {errorMessage && <div className="mb-5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300">{errorMessage}</div>}
                    {successMessage && <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{successMessage}</div>}
                    <div className="space-y-6">
                        <section className="theme-surface theme-border rounded-2xl border p-5">
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Operating Console</p>
                                    <h3 className="mt-3 text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Club management stays in one place</h3>
                                    <p className="mt-2 max-w-3xl text-sm font-medium text-slate-600 dark:text-slate-300">
                                        Members, invites, applications, squads, tryouts, and ownership rules all stay inside this existing club workspace.
                                    </p>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    {canManageLeadership && (
                                        <>
                                            <div className="theme-surface-muted theme-border min-w-[130px] rounded-2xl border px-4 py-3">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Members</p>
                                                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{overviewLoading && !overview ? '...' : overview?.members.length ?? 0}</p>
                                            </div>
                                            <div className="theme-surface-muted theme-border min-w-[130px] rounded-2xl border px-4 py-3">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Invites</p>
                                                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{overviewLoading && !overview ? '...' : overview?.pendingInvitations.length ?? 0}</p>
                                            </div>
                                            <div className="theme-surface-muted theme-border min-w-[130px] rounded-2xl border px-4 py-3">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Applications</p>
                                                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{overviewLoading && !overview ? '...' : overview?.pendingApplications.length ?? 0}</p>
                                            </div>
                                        </>
                                    )}
                                    {canManageTryouts && (
                                        <div className="theme-surface-muted theme-border min-w-[130px] rounded-2xl border px-4 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Tryouts</p>
                                            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{tryoutsLoading && tryoutApplicants.length === 0 ? '...' : tryoutApplicants.length}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-2">
                                <button type="button" onClick={handleOpenNotifications} className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-slate-200 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-900 shadow-[4px_4px_0px_0px_#020617] transition-all hover:bg-slate-300 active:translate-y-0.5 active:shadow-none dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700">
                                    <BellRing className="h-4 w-4" />
                                    Open Club Inbox
                                </button>
                                {canManageLeadership && (
                                    <button type="button" onClick={handleOpenSquadsWorkspace} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-500 hover:text-white dark:text-emerald-300">
                                        <ArrowRight className="h-4 w-4" />
                                        Open Squad Workspace
                                    </button>
                                )}
                                {canManageLeadership && activeTab !== 'roles' && (
                                    <button type="button" onClick={() => setActiveTab('roles')} className="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700 transition-colors hover:bg-amber-500 hover:text-white dark:text-amber-300">
                                        <Crown className="h-4 w-4" />
                                        Ownership And Roles
                                    </button>
                                )}
                            </div>
                        </section>

                        {activeTab === 'personnel' && (
                            <>
                                {overviewLoading ? (
                                    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
                                ) : overview ? (
                                    <section className="theme-surface theme-border rounded-2xl border p-5">
                                        {sectionLead('Personnel', 'Staff members and active club roles', 'This workspace is now staff-only. Owners, club admins, and coaches stay here, while player affiliations are managed in their own tab.')}
                                        <div className="mt-6 space-y-3">
                                            {overview.members.length === 0 ? (
                                                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">No active staff members are attached to this club yet.</div>
                                            ) : overview.members.map((member) => {
                                                const isSelf = member.userId === currentUserId;
                                                const lockReason = memberLockReason(member);
                                                return (
                                                    <div key={member.userId} className="theme-surface-muted theme-border rounded-2xl border px-4 py-4">
                                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                            <div className="flex min-w-0 items-start gap-3">
                                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-sm font-black text-emerald-700 dark:text-emerald-400">{avatarLetter(member.fullName || member.username)}</div>
                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <p className="truncate text-sm font-black text-slate-900 dark:text-white">{member.fullName || member.username}</p>
                                                                        <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{clubRoleLabel(member.role)}</span>
                                                                        {isSelf && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">You</span>}
                                                                    </div>
                                                                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">@{member.username}</p>
                                                                    {lockReason && <p className="mt-3 max-w-2xl text-sm font-medium text-slate-600 dark:text-slate-300">{lockReason}</p>}
                                                                </div>
                                                            </div>

                                                            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[280px] lg:items-end">
                                                                {member.roleEditable ? (
                                                                    <select value={member.role} onChange={(event) => {
                                                                        const nextRole = event.target.value as ClubMembershipRole;
                                                                        if (nextRole !== member.role) void handleRoleChange(member.userId, nextRole);
                                                                    }} disabled={pendingKey === `role-${member.userId}`} className="theme-surface-strong theme-border w-full rounded-xl border px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-900 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-70 dark:text-white lg:w-auto">
                                                        {Array.from(new Set([member.role, ...overview.assignableStaffRoles])).map((role) => (
                                                            <option key={`${member.userId}-${role}`} value={role}>{clubRoleLabel(role)}</option>
                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <div className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Role locked</div>
                                                                )}

                                                                {canRemoveMember(member) && (
                                                                    <div className="flex flex-wrap gap-2 lg:justify-end">
                                                                        {confirmingRemovalUserId === member.userId ? (
                                                                            <>
                                                                                <button type="button" onClick={() => setConfirmingRemovalUserId(null)} disabled={pendingKey === `remove-${member.userId}`} className="rounded-xl border border-slate-300 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:text-white">Cancel</button>
                                                                                <button type="button" onClick={() => void handleRemoveMember(member)} disabled={pendingKey === `remove-${member.userId}`} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-700 transition-colors hover:bg-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-300">{pendingKey === `remove-${member.userId}` ? '...' : 'Confirm Remove'}</button>
                                                                            </>
                                                                        ) : (
                                                                            <button type="button" onClick={() => setConfirmingRemovalUserId(member.userId)} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-700 transition-colors hover:bg-rose-500 hover:text-white dark:text-rose-300">Remove Member</button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                ) : retryState('Club Personnel Unavailable', overviewError || 'The leadership workspace could not be loaded right now. Try again to restore members and club role controls.', () => { void loadOverview(); })}
                            </>
                        )}

                        {activeTab === 'invites' && (
                            <>
                                {overviewLoading ? (
                                    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
                                ) : overview ? (
                                    <div className="space-y-6">
                                        <section className="theme-surface theme-border rounded-2xl border p-5">
                                            {sectionLead('Invites', 'Search and invite new club members', 'Invite by name or username, choose the starting club role, and keep current invitations in one clean queue.')}
                                            <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                                <div className="flex-1">
                                                    <div className="relative">
                                                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                        <input type="text" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchPage(0); }} placeholder="Search users to invite into this club" className="theme-surface-muted theme-border w-full rounded-xl border py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 dark:text-white" />
                                                    </div>
                                                </div>
                                                <select value={selectedInviteRole} onChange={(event) => setSelectedInviteRole(event.target.value as ClubMembershipRole)} disabled={overview.assignableInviteRoles.length === 0} className="theme-surface-muted theme-border rounded-xl border px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-900 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-white">
                                                    {overview.assignableInviteRoles.map((role) => <option key={role} value={role}>{clubRoleLabel(role)}</option>)}
                                                </select>
                                            </div>

                                            <div className="mt-5 space-y-3">
                                                {searchQuery.trim().length < 2 ? (
                                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Type at least two characters to search.</p>
                                                ) : searchLoading ? (
                                                    <div className="flex justify-center py-8"><Loader2 className="h-7 w-7 animate-spin text-emerald-500" /></div>
                                                ) : searchResults?.content.length ? (
                                                    <>
                                                        {searchResults.content.map((user) => {
                                                            const alreadyInvited = invitedUserIds.has(user.id);
                                                            return (
                                                                <div key={user.id} className="theme-surface-muted theme-border flex flex-col gap-4 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-sm font-black text-slate-900 dark:text-white">{user.fullName || user.username}</p>
                                                                        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">@{user.username}{user.position ? ` / ${user.position}` : ''}{user.userType ? ` / ${user.userType}` : ''}</p>
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                                                        {alreadyInvited && <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Invite already pending</span>}
                                                        <button type="button" onClick={() => void handleInvite(user.id)} disabled={pendingKey === `invite-${user.id}` || alreadyInvited || overview.assignableInviteRoles.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-emerald-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[4px_4px_0px_0px_#020617] transition-all hover:bg-emerald-500 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-70">
                                                                            {pendingKey === `invite-${user.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                                                            {alreadyInvited ? 'Already Invited' : `Invite As ${clubRoleLabel(selectedInviteRole)}`}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {searchResults.totalElements > searchResults.pageSize && (
                                                            <div className="flex items-center justify-between pt-2">
                                                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Page {searchResults.pageNumber + 1} of {totalSearchPages}</p>
                                                                <div className="flex gap-2">
                                                                    <button type="button" onClick={() => setSearchPage((current) => Math.max(0, current - 1))} disabled={searchResults.pageNumber === 0} className="theme-surface-muted theme-border rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:text-white">Prev</button>
                                                                    <button type="button" onClick={() => setSearchPage((current) => current + 1)} disabled={searchResults.pageNumber + 1 >= totalSearchPages} className="theme-surface-muted theme-border rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:text-white">Next</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">No eligible users matched this query.</div>
                                                )}
                                            </div>
                                        </section>

                                        <section className="theme-surface theme-border rounded-2xl border p-5">
                                            {sectionLead('Sent Invites', 'Current invitation queue', 'This management contract currently exposes open invitations. Accepted, declined, cancelled, and expired history can plug in later when the broader lifecycle feed is available.')}
                                            <div className="mt-6 space-y-3">
                                                {overview.pendingInvitations.length === 0 ? (
                                                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">No pending invitations right now.</div>
                                                ) : overview.pendingInvitations.map((invite) => (
                                                    <div key={invite.id} className="theme-surface-muted theme-border rounded-2xl border px-4 py-4">
                                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                            <div>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <p className="text-sm font-black text-slate-900 dark:text-white">{invite.fullName || invite.username}</p>
                                                                    <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">{clubInviteStatusLabel(invite.status)}</span>
                                                                    <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{clubRoleLabel(invite.role)}</span>
                                                                </div>
                                                                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">@{invite.username}</p>
                                                                {(formatMetaTime(invite.createdAt) || formatMetaTime(invite.expiresAt)) && (
                                                                    <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                                                                        {formatMetaTime(invite.createdAt) ? `Sent ${formatMetaTime(invite.createdAt)}` : 'Sent recently'}
                                                                        {formatMetaTime(invite.expiresAt) ? ` • Expires ${formatMetaTime(invite.expiresAt)}` : ''}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <button type="button" onClick={() => void handleCancelInvite(invite.id)} disabled={pendingKey === `cancel-${invite.id}`} className="rounded-xl border border-slate-300 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-rose-400 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:text-rose-300">
                                                                {pendingKey === `cancel-${invite.id}` ? '...' : 'Cancel Invite'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    </div>
                                ) : retryState('Invites Unavailable', overviewError || 'The invitation workspace could not be loaded right now.', () => { void loadOverview(); })}
                            </>
                        )}

                        {activeTab === 'players' && (
                            <>
                                {overviewLoading && !overview ? (
                                    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
                                ) : overview ? (
                                    <section className="theme-surface theme-border rounded-2xl border p-5">
                                        {sectionLead(
                                            'Players',
                                            'Track trialists and active players',
                                            'Player affiliations are managed separately from staff roles. Promote, wind down, or remove player relationships here without crowding the staff workspace.'
                                        )}

                                        <div className="mt-6 flex flex-wrap gap-2">
                                            {(['ALL', 'TRIALIST', 'ACTIVE', 'PAST', 'REMOVED'] as const).map((status) => {
                                                const isActive = playerStatusFilter === status;
                                                return (
                                                    <button
                                                        key={status}
                                                        type="button"
                                                        onClick={() => {
                                                            setPlayerStatusFilter(status);
                                                            setPlayerPage(0);
                                                        }}
                                                        className={`rounded-xl border px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] transition-colors ${
                                                            isActive
                                                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                                                : 'theme-surface-muted theme-border text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'
                                                        }`}
                                                    >
                                                        {status === 'ALL' ? 'All Players' : status.replace('_', ' ')}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-6 grid gap-4 lg:grid-cols-3">
                                            <div className="theme-surface-muted theme-border rounded-2xl border px-4 py-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Active Players</p>
                                                <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{overview.activePlayerCount}</p>
                                                <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">These players count toward club membership totals and are eligible for squad planning.</p>
                                            </div>
                                            <div className="theme-surface-muted theme-border rounded-2xl border px-4 py-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Trialists</p>
                                                <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{overview.trialistCount}</p>
                                                <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">Open-trial joins, accepted invites, and approved player applications land here first.</p>
                                            </div>
                                            <div className="theme-surface-muted theme-border rounded-2xl border px-4 py-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Current Filter</p>
                                                <p className="mt-3 text-lg font-black text-slate-900 dark:text-white">{playerStatusFilter === 'ALL' ? 'All player relationships' : playerStatusFilter.replace('_', ' ')}</p>
                                                <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">Use the filter to focus on players who need action instead of scrolling one giant combined directory.</p>
                                            </div>
                                        </div>

                                        <div className="mt-6 space-y-3">
                                            {playerLoading ? (
                                                <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
                                            ) : playerError && !playerDirectory ? (
                                                retryState('Player Directory Unavailable', playerError, () => { void loadPlayers(); })
                                            ) : playerDirectory && playerDirectory.content.length === 0 ? (
                                                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">No player affiliations matched this view yet.</div>
                                            ) : playerDirectory?.content.map((player) => {
                                                const metaItems = [
                                                    player.source ? `Source: ${player.source.replace(/_/g, ' ')}` : null,
                                                    formatMetaTime(player.joinedAt) ? `Joined ${formatMetaTime(player.joinedAt)}` : null,
                                                    formatMetaTime(player.endedAt) ? `Ended ${formatMetaTime(player.endedAt)}` : null
                                                ].filter(Boolean);

                                                return (
                                                    <div key={`${player.userId}-${player.status}`} className="theme-surface-muted theme-border rounded-2xl border px-4 py-4">
                                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                            <div className="flex min-w-0 items-start gap-3">
                                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-sm font-black text-emerald-700 dark:text-emerald-400">
                                                                    {avatarLetter(player.fullName || player.username)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <p className="truncate text-sm font-black text-slate-900 dark:text-white">{player.fullName || player.username || `Player #${player.userId}`}</p>
                                                                        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">{player.status.replace('_', ' ')}</span>
                                                                        {player.primary && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Primary Club</span>}
                                                                    </div>
                                                                    {player.username && <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">@{player.username}</p>}
                                                                    {metaItems.length > 0 && (
                                                                        <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">{metaItems.join(' • ')}</p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap gap-2 lg:justify-end">
                                                                {player.status === 'TRIALIST' && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => void handlePlayerStatusChange(player.userId, 'ACTIVE')}
                                                                            disabled={pendingKey === `player-${player.userId}-ACTIVE`}
                                                                            className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-70 dark:text-emerald-300"
                                                                        >
                                                                            {pendingKey === `player-${player.userId}-ACTIVE` ? '...' : 'Promote to Active Player'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => void handlePlayerStatusChange(player.userId, 'REMOVED')}
                                                                            disabled={pendingKey === `player-${player.userId}-REMOVED`}
                                                                            className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-rose-700 transition-colors hover:bg-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-70 dark:text-rose-300"
                                                                        >
                                                                            {pendingKey === `player-${player.userId}-REMOVED` ? '...' : 'Remove from Club'}
                                                                        </button>
                                                                    </>
                                                                )}

                                                                {player.status === 'ACTIVE' && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => void handlePlayerStatusChange(player.userId, 'TRIALIST')}
                                                                            disabled={pendingKey === `player-${player.userId}-TRIALIST`}
                                                                            className="rounded-xl border border-slate-300 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:text-white"
                                                                        >
                                                                            {pendingKey === `player-${player.userId}-TRIALIST` ? '...' : 'Demote to Trialist'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => void handlePlayerStatusChange(player.userId, 'PAST')}
                                                                            disabled={pendingKey === `player-${player.userId}-PAST`}
                                                                            className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700 transition-colors hover:bg-amber-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-300"
                                                                        >
                                                                            {pendingKey === `player-${player.userId}-PAST` ? '...' : 'Mark as Past Player'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => void handlePlayerStatusChange(player.userId, 'REMOVED')}
                                                                            disabled={pendingKey === `player-${player.userId}-REMOVED`}
                                                                            className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-rose-700 transition-colors hover:bg-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-300"
                                                                        >
                                                                            {pendingKey === `player-${player.userId}-REMOVED` ? '...' : 'Remove from Club'}
                                                                        </button>
                                                                    </>
                                                                )}

                                                                {(player.status === 'PAST' || player.status === 'REMOVED') && (
                                                                    <span className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                                                        Historical Record
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {playerDirectory && playerDirectory.totalElements > playerDirectory.pageSize && (
                                            <div className="mt-6 flex items-center justify-between">
                                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Page {playerDirectory.pageNumber + 1} of {totalPlayerPages}</p>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPlayerPage((current) => Math.max(0, current - 1))}
                                                        disabled={playerDirectory.pageNumber === 0}
                                                        className="theme-surface-muted theme-border rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:text-white"
                                                    >
                                                        Prev
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPlayerPage((current) => current + 1)}
                                                        disabled={playerDirectory.pageNumber + 1 >= totalPlayerPages}
                                                        className="theme-surface-muted theme-border rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:text-white"
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                ) : retryState('Player Workspace Unavailable', overviewError || 'The player affiliation workspace could not be loaded right now.', () => { void loadOverview(); void loadPlayers(); })}
                            </>
                        )}

                        {activeTab === 'applications' && (
                            <>
                                {overviewLoading ? (
                                    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
                                ) : overview ? (
                                    <section className="theme-surface theme-border rounded-2xl border p-5">
                                        {sectionLead('Applications', 'Review club membership requests', 'This queue shows active club applications that still need a decision. Historical accepted, declined, and cancelled items are not exposed by the current management endpoint yet.', canManageTryouts ? <button type="button" onClick={() => setActiveTab('tryouts')} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-emerald-400 dark:hover:text-emerald-400">Open Tryouts</button> : undefined)}
                                        <div className="mt-6 space-y-3">
                                            {overview.pendingApplications.length === 0 ? (
                                                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">No pending applications need review right now.</div>
                                            ) : overview.pendingApplications.map((application) => (
                                                <div key={application.id} className="theme-surface-muted theme-border rounded-2xl border px-4 py-4">
                                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="text-sm font-black text-slate-900 dark:text-white">{application.fullName || application.username}</p>
                                                                <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">{clubApplicationStatusLabel(application.status)}</span>
                                                                <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{clubRoleLabel(application.role)}</span>
                                                            </div>
                                                            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">@{application.username}</p>
                                                            {formatMetaTime(application.createdAt) && <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">Submitted {formatMetaTime(application.createdAt)}</p>}
                                                            {application.message && <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">{application.message}</p>}
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 lg:justify-end">
                                                            <button type="button" onClick={() => void handleAcceptApplication(application.id)} disabled={pendingKey === `application-accept-${application.id}` || pendingKey === `application-decline-${application.id}`} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-70 dark:text-emerald-300">
                                                                {pendingKey === `application-accept-${application.id}` ? '...' : 'Accept'}
                                                            </button>
                                                            <button type="button" onClick={() => void handleDeclineApplication(application.id)} disabled={pendingKey === `application-accept-${application.id}` || pendingKey === `application-decline-${application.id}`} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-rose-700 transition-colors hover:bg-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-70 dark:text-rose-300">
                                                                {pendingKey === `application-decline-${application.id}` ? '...' : 'Decline'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                ) : retryState('Applications Unavailable', overviewError || 'The application review queue could not be loaded right now.', () => { void loadOverview(); })}
                            </>
                        )}

                        {activeTab === 'roles' && (
                            <>
                                {overviewLoading ? (
                                    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
                                ) : overview ? (
                                    <div className="space-y-6">
                                        <section className="theme-surface theme-border rounded-2xl border p-5">
                                            {sectionLead('Roles And Ownership', 'Authority rules for this club', 'Role changes follow club membership authority, not a global user type. Ownership transfer stays separate from standard role edits so the club can never be orphaned.')}
                                            <div className="mt-6 grid gap-4 xl:grid-cols-3">
                                                <div className="theme-surface-muted theme-border rounded-2xl border px-4 py-4">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Current Clearance</p>
                                                    <p className="mt-3 text-lg font-black text-slate-900 dark:text-white">{clubRoleLabel(overview.currentUserRole || currentRole)}</p>
                                                    <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">Your available member-role actions come from this club-scoped clearance.</p>
                                                </div>
                                                <div className="theme-surface-muted theme-border rounded-2xl border px-4 py-4">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Assignable Roles</p>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {overview.assignableStaffRoles.length === 0 ? <span className="text-sm font-medium text-slate-500 dark:text-slate-400">No role changes available from this clearance.</span> : overview.assignableStaffRoles.map((role) => <span key={role} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">{clubRoleLabel(role)}</span>)}
                                                    </div>
                                                    <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">Self role changes and owner role reassignment stay blocked from the normal personnel flow.</p>
                                                </div>
                                                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-amber-800 dark:text-amber-300">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em]">Membership Exit</p>
                                                    <p className="mt-3 text-sm font-medium">{currentRole === 'OWNER' ? 'Transfer ownership here before you leave. The owner path stays protected so the club can never be orphaned.' : 'Leaving this club is handled inside the operations flow so membership lifecycle actions stay in one place.'}</p>
                                                </div>
                                            </div>
                                        </section>

                                        <section className="theme-surface theme-border rounded-2xl border p-5">
                                            {sectionLead('Ownership Transfer', 'Protected owner handoff', currentRole === 'OWNER' ? 'Select the next owner from current eligible members. Once confirmed, your current owner role steps down to club admin automatically.' : 'Only the current owner can transfer ownership. Use the personnel tab for the role updates your clearance already allows.')}
                                            {currentRole !== 'OWNER' ? (
                                                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">Ownership transfer stays available only to the current club owner.</div>
                                            ) : transferCandidates.length === 0 ? (
                                                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">No eligible ownership transfer targets are available yet. Add or promote an active non-owner member first.</div>
                                            ) : (
                                                <div className="mt-6 space-y-3">
                                                    {transferCandidates.map((member) => (
                                                        <div key={member.userId} className="theme-surface-muted theme-border rounded-2xl border px-4 py-4">
                                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                                <div>
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <p className="text-sm font-black text-slate-900 dark:text-white">{member.fullName || member.username}</p>
                                                                        <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{clubRoleLabel(member.role)}</span>
                                                                    </div>
                                                                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">@{member.username}</p>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2 lg:justify-end">
                                                                    {confirmingOwnershipTransferUserId === member.userId ? (
                                                                        <>
                                                                            <button type="button" onClick={() => setConfirmingOwnershipTransferUserId(null)} disabled={pendingKey === `transfer-${member.userId}`} className="rounded-xl border border-slate-300 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:text-white">Cancel</button>
                                                                            <button type="button" onClick={() => void handleTransferOwnership(member)} disabled={pendingKey === `transfer-${member.userId}`} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 transition-colors hover:bg-amber-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-300">{pendingKey === `transfer-${member.userId}` ? '...' : 'Confirm Transfer'}</button>
                                                                        </>
                                                                    ) : (
                                                                        <button type="button" onClick={() => setConfirmingOwnershipTransferUserId(member.userId)} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 transition-colors hover:bg-amber-500 hover:text-white dark:text-amber-300">Transfer Ownership</button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </section>

                                        <section className="theme-surface theme-border rounded-2xl border p-5">
                                            {sectionLead('Membership Exit', 'Leave this club safely', currentRole === 'OWNER' ? 'The current owner cannot leave from this step. Transfer ownership first, then complete your own exit from the updated leadership state.' : 'Leaving from here follows the same protected cleanup rules as member removal: club-scoped access is revoked immediately and the operations console closes.' )}
                                            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-5 dark:border-slate-700">
                                                {currentRole === 'OWNER' ? (
                                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Ownership must be handed off before the owner account can leave this club.</p>
                                                ) : confirmingSelfLeave ? (
                                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Leaving removes your active club role immediately and closes leadership access for this club.</p>
                                                        <div className="flex flex-wrap gap-2 lg:justify-end">
                                                            <button type="button" onClick={() => setConfirmingSelfLeave(false)} disabled={pendingKey === 'leave-club'} className="rounded-xl border border-slate-300 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:text-white">Cancel</button>
                                                            <button type="button" onClick={() => void handleLeaveClub()} disabled={pendingKey === 'leave-club'} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-700 transition-colors hover:bg-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-300">{pendingKey === 'leave-club' ? '...' : 'Confirm Leave'}</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Use this when you are ready to step away from this club’s operator role.</p>
                                                        <button type="button" onClick={() => setConfirmingSelfLeave(true)} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-rose-700 transition-colors hover:bg-rose-500 hover:text-white dark:text-rose-300">Leave Club</button>
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    </div>
                                ) : retryState('Roles Workspace Unavailable', overviewError || 'Role and ownership rules could not be loaded right now.', () => { void loadOverview(); })}
                            </>
                        )}

                        {activeTab === 'squads' && (
                            <section className="theme-surface theme-border rounded-2xl border p-5">
                                {sectionLead('Squads', 'Create and link squad structure', 'Squad personnel now follow active player affiliations. Promote trialists into active players first, then assign them through the dedicated squad workspace.', <button type="button" onClick={handleOpenSquadsWorkspace} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-emerald-400 dark:hover:text-emerald-400"><ArrowRight className="h-4 w-4" />Full Squads View</button>)}
                    <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                                    <form onSubmit={handleCreateSquad} className="grid gap-4 md:grid-cols-3">
                                        <input type="text" value={squadForm.name} onChange={(event) => setSquadForm((current) => ({ ...current, name: event.target.value }))} placeholder="First Team" required className="theme-surface-muted theme-border rounded-xl border px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 dark:text-white" />
                                        <input type="text" value={squadForm.category} onChange={(event) => setSquadForm((current) => ({ ...current, category: event.target.value.toUpperCase() }))} placeholder="SENIOR or U17" required className="theme-surface-muted theme-border rounded-xl border px-4 py-3 text-sm font-semibold uppercase text-slate-900 outline-none focus:border-emerald-500 dark:text-white" />
                                        <select value={squadForm.gender} onChange={(event) => setSquadForm((current) => ({ ...current, gender: event.target.value }))} className="theme-surface-muted theme-border rounded-xl border px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-900 outline-none focus:border-emerald-500 dark:text-white">
                                            <option value="MALE">Male</option>
                                            <option value="FEMALE">Female</option>
                                            <option value="MIXED">Mixed</option>
                                        </select>
                                        <div className="md:col-span-3">
                                            <button type="submit" disabled={pendingKey === 'create-squad'} className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-emerald-600 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[4px_4px_0px_0px_#020617] transition-all hover:bg-emerald-500 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-70">
                                                {pendingKey === 'create-squad' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                                Create Squad
                                            </button>
                                        </div>
                                    </form>
                                    <div className="space-y-3">
                                        <div className="theme-surface-muted theme-border rounded-2xl border px-4 py-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Roster Integrity</p>
                                            <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">Only active player affiliations can move into squad personnel views under the current club rules.</p>
                                        </div>
                                        <div className="theme-surface-muted theme-border rounded-2xl border px-4 py-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Player Pool</p>
                                            <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{canManageLeadership && overview ? playerMemberCount : 0}</p>
                                            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">Current active player affiliations available to squad planning.</p>
                                        </div>
                                        <div className="theme-surface-muted theme-border rounded-2xl border px-4 py-4">
                                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Use the full squads page for roster tables, grouped positions, and squad-specific personnel assignments.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeTab === 'tryouts' && (
                            <section className="theme-surface theme-border rounded-2xl border p-5">
                                {sectionLead('Tryouts', 'Review incoming trial applicants', 'Tryout review stays connected to club operations without bypassing membership rules. Use this queue for direct applicant decisions, then continue with personnel or squad work as needed.', <div className="flex flex-wrap gap-2">{canManageLeadership && <button type="button" onClick={() => setActiveTab('personnel')} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-emerald-400 dark:hover:text-emerald-400">Personnel</button>}<button type="button" onClick={handleOpenNotifications} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-emerald-400 dark:hover:text-emerald-400">Club Inbox</button></div>)}
                                {tryoutsLoading ? (
                                    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
                                ) : tryoutsError && tryoutApplicants.length === 0 ? (
                                    retryState('Tryout Queue Unavailable', tryoutsError, () => { void loadTryouts(); })
                                ) : tryoutApplicants.length === 0 ? (
                                    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">No tryout applications need review right now.</div>
                                ) : (
                                    <div className="mt-6 space-y-3">
                                        {tryoutApplicants.map((application) => (
                                            <div key={application.id} className="theme-surface-muted theme-border flex flex-col gap-4 rounded-2xl border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                                                <div>
                                                    <p className="text-sm font-black text-slate-900 dark:text-white">{application.name}</p>
                                                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{application.position || 'Profile pending'} / {application.ageGroup || 'OPEN'} / {application.status}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <button type="button" onClick={() => void handleTryoutStatus(application.id, 'ACCEPTED')} disabled={pendingKey === `tryout-${application.id}-ACCEPTED`} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-70 dark:text-emerald-400">Accept</button>
                                                    <button type="button" onClick={() => void handleTryoutStatus(application.id, 'REJECTED')} disabled={pendingKey === `tryout-${application.id}-REJECTED`} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-rose-700 transition-colors hover:bg-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-70 dark:text-rose-300">Decline</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};
