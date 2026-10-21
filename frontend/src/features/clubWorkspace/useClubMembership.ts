import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import {
    acceptClubApplication, bulkDecideClubApplications, cancelClubInvitation, createClubInvitation, declineClubApplication,
    fetchAllClubJobs, fetchClubPlayers, type ClubJob, leaveClubMembership, prepareStaffDeparture, removeClubMember, searchClubInviteCandidates,
    sendParentalConsentEmail, transferClubOwnership, updateClubMemberRole, updateClubPlayerStatus,
} from '../clubs/api';
import {
    clubRoleLabel, type ClubManagedMember, type ClubManagementOverview, type ClubMembershipApplication, type ClubMembershipRole,
    type ClubPlayerAffiliation, type PageResult, type PlayerAffiliationStatus,
} from '../clubs/domain';
import type { ApplicationFilters } from './recruitment/ApplicationsPage';
import type { TryoutApplicantDto, UserSearchDto, WorkspaceTab } from '../../components/workspace/types';
import { extractApiErrorMessage } from '../../utils/apiError';

interface Input {
    clubId: number; activeTab: WorkspaceTab; overview: ClubManagementOverview | null; reloadOverview: () => Promise<void>;
    canChangePlayerStatus: boolean; focusedApplicationId: number | null;
}

const fresh = (cache: { key: string; loadedAt: number }, key: string) => cache.key === key && Date.now() - cache.loadedAt < 30_000;

/**
 * Players, invitations, applications, tryouts and membership decisions for the club workspace.
 * Every list discards answers that arrive after a newer request, and every action reports its
 * own result; the page decides only what to show.
 */
export function useClubMembership({ clubId, activeTab, overview, reloadOverview, canChangePlayerStatus, focusedApplicationId }: Input) {
    const navigate = useNavigate();
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const runAction = async (key: string, action: () => Promise<void>) => {
        setPendingKey(key); setErrorMessage(null); setSuccessMessage(null);
        try { await action(); } catch (error) { setErrorMessage(extractApiErrorMessage(error, 'Request failed.')); } finally { setPendingKey(null); }
    };

    // ── players ──
    const [playerStatusFilter, setPlayerStatusFilter] = useState<'ALL' | PlayerAffiliationStatus>('ALL');
    const [playerPage, setPlayerPage] = useState(0);
    const [playerDirectory, setPlayerDirectory] = useState<PageResult<ClubPlayerAffiliation> | null>(null);
    const [playerLoading, setPlayerLoading] = useState(false);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const playersRequest = useRef(0);
    const playersCache = useRef({ key: '', loadedAt: 0 });
    // Trialists come first the first time any exist.
    const trialistAutoSelect = useRef(false);
    const loadPlayers = async (force = false) => {
        const cacheKey = `${clubId}:${playerStatusFilter}:${playerPage}`;
        if (!force && playerDirectory && fresh(playersCache.current, cacheKey)) return;
        const request = ++playersRequest.current;
        setPlayerLoading(true); setPlayerError(null);
        try {
            const response = await fetchClubPlayers(clubId, playerStatusFilter === 'ALL' ? null : playerStatusFilter, playerPage, 20);
            if (request !== playersRequest.current) return;
            setPlayerDirectory(response);
            playersCache.current = { key: cacheKey, loadedAt: Date.now() };
            if (!trialistAutoSelect.current && playerStatusFilter === 'ALL' && response.content.some(p => p.status === 'TRIALIST')) {
                trialistAutoSelect.current = true;
                setPlayerStatusFilter('TRIALIST');
            }
        } catch (error) {
            if (request === playersRequest.current) setPlayerError(extractApiErrorMessage(error, 'Failed to load player affiliations.'));
        } finally {
            if (request === playersRequest.current) setPlayerLoading(false);
        }
    };
    const invalidatePlayers = () => { playersCache.current = { key: '', loadedAt: 0 }; };
    const showPlayers = (status: 'ALL' | PlayerAffiliationStatus) => { trialistAutoSelect.current = true; setPlayerStatusFilter(status); setPlayerPage(0); };

    // ── tryouts ──
    const [tryoutApplicants, setTryoutApplicants] = useState<TryoutApplicantDto[]>([]);
    const [tryoutsLoading, setTryoutsLoading] = useState(false);
    const tryoutsRequest = useRef(0);
    const tryoutsCache = useRef({ key: '', loadedAt: 0 });
    const loadTryouts = async (force = false) => {
        if (!force && tryoutApplicants.length > 0 && fresh(tryoutsCache.current, String(clubId))) return;
        const request = ++tryoutsRequest.current;
        setTryoutsLoading(true);
        try {
            const response = await apiClient.get<TryoutApplicantDto[]>(`/admin/tryouts/clubs/${clubId}/applications`);
            if (request !== tryoutsRequest.current) return;
            setTryoutApplicants(response.data || []);
            tryoutsCache.current = { key: String(clubId), loadedAt: Date.now() };
        } catch { /* Tryouts are optional context; the tab shows its own empty state. */ }
        finally { if (request === tryoutsRequest.current) setTryoutsLoading(false); }
    };
    const tryoutPendingCount = useMemo(() => tryoutApplicants.filter(a => a.status === 'PENDING' || a.status === 'SHORTLISTED').length, [tryoutApplicants]);

    // ── applications ──
    const [applicationsList, setApplicationsList] = useState<ClubMembershipApplication[]>([]);
    const [applicationsLoading, setApplicationsLoading] = useState(false);
    const [applicationsError, setApplicationsError] = useState<string | null>(null);
    const [applicationsFilters, setApplicationsFilters] = useState<ApplicationFilters>({ position: '', ageGroup: '', status: 'PENDING', jobId: '' });
    const [applicationPage, setApplicationPage] = useState(0), [applicationTotal, setApplicationTotal] = useState(0);
    const applicationsRequest = useRef(0);
    const applicationsCache = useRef({ key: '', loadedAt: 0 });
    const loadApplications = async (force = false) => {
        const f = applicationsFilters;
        const cacheKey = `${clubId}:${focusedApplicationId}:${applicationPage}:${f.position}:${f.ageGroup}:${f.status}:${f.jobId}`;
        if (!force && applicationsList.length > 0 && fresh(applicationsCache.current, cacheKey)) return;
        const request = ++applicationsRequest.current;
        setApplicationsLoading(true); setApplicationsError(null);
        try {
            const response = await apiClient.get<ClubMembershipApplication[]>(`/clubs/${clubId}/management/applications`, { params: focusedApplicationId != null ? { applicationId: focusedApplicationId } : {
                position: f.position || null, ageGroup: f.ageGroup || null, status: f.status || null, jobId: f.jobId ? Number(f.jobId) : null, page: applicationPage, size: 100,
            } });
            if (request !== applicationsRequest.current) return;
            setApplicationsList(response.data);
            setApplicationTotal(Number(response.headers['x-total-count'] ?? response.data.length));
            applicationsCache.current = { key: cacheKey, loadedAt: Date.now() };
        } catch (error) {
            if (request === applicationsRequest.current) setApplicationsError(extractApiErrorMessage(error, 'Failed to load applications.'));
        } finally {
            if (request === applicationsRequest.current) setApplicationsLoading(false);
        }
    };

    const [jobs, setJobs] = useState<ClubJob[]>([]);
    useEffect(() => {
        if (activeTab !== 'applications') return;
        let current = true;
        void fetchAllClubJobs(clubId).then(list => { if (current) setJobs(list); }).catch(() => { if (current) setJobs([]); });
        return () => { current = false; };
    }, [activeTab, clubId]);

    // ── invitations ──
    const [searchQuery, setSearchQuery] = useState('');
    const [searchPage, setSearchPage] = useState(0);
    const [searchResults, setSearchResults] = useState<PageResult<UserSearchDto> | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedInviteRole, setSelectedInviteRole] = useState<ClubMembershipRole>('COACH');
    const invitedUserIds = useMemo(() => new Set(overview?.pendingInvitations.map(i => i.userId) || []), [overview]);
    useEffect(() => {
        const roles = overview?.assignableInviteRoles ?? [];
        if (roles.length > 0 && !roles.includes(selectedInviteRole)) setSelectedInviteRole(roles[0]);
    }, [overview, selectedInviteRole]);

    // ── loading by tab ──
    useEffect(() => { if (activeTab === 'players') void loadPlayers(); }, [activeTab, clubId, playerPage, playerStatusFilter]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        // Player cards are trialist affiliations, and page 0 of a large directory can hold only active players,
        // so the authoritative overview count decides whether trialists come first.
        if (activeTab !== 'players' || playerStatusFilter !== 'ALL' || trialistAutoSelect.current) return;
        if ((overview?.trialistCount ?? 0) > 0) { trialistAutoSelect.current = true; setPlayerStatusFilter('TRIALIST'); setPlayerPage(0); }
    }, [activeTab, overview?.trialistCount, playerStatusFilter]);
    useEffect(() => { if (activeTab === 'applications') void loadApplications(); }, [activeTab, clubId, applicationsFilters, focusedApplicationId, applicationPage]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (activeTab === 'tryouts') void loadTryouts(); }, [activeTab, clubId]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (activeTab !== 'invites') return;
        if (searchQuery.trim().length < 2) { setSearchResults(null); return; }
        const timeoutId = window.setTimeout(async () => {
            setSearchLoading(true);
            try { setSearchResults(await searchClubInviteCandidates(clubId, searchQuery, searchPage, 8) as PageResult<UserSearchDto>); }
            catch { setSearchResults(null); }
            finally { setSearchLoading(false); }
        }, 300);
        return () => window.clearTimeout(timeoutId);
    }, [activeTab, clubId, searchPage, searchQuery]);

    // ── decisions ──
    const [acceptTarget, setAcceptTarget] = useState<ClubMembershipApplication | null>(null);
    const [declineTarget, setDeclineTarget] = useState<ClubMembershipApplication | null>(null);
    const [tryoutAcceptTarget, setTryoutAcceptTarget] = useState<TryoutApplicantDto | null>(null);
    const [tryoutDeclineTarget, setTryoutDeclineTarget] = useState<TryoutApplicantDto | null>(null);
    const [releaseMessage, setReleaseMessage] = useState('');
    const [showStatusConfirm, setShowStatusConfirm] = useState(false);
    const pendingStatus = useRef<{ userId: number; status: PlayerAffiliationStatus; playerName?: string } | null>(null);
    const [confirmingRemovalUserId, setConfirmingRemovalUserId] = useState<number | null>(null);
    const [confirmingOwnershipTransferUserId, setConfirmingOwnershipTransferUserId] = useState<number | null>(null);
    const [confirmingSelfLeave, setConfirmingSelfLeave] = useState(false);
    const selfDeparture = useRef<{ requestId: string; snapshot: string } | null>(null);

    const decideTryout = async (target: TryoutApplicantDto, status: 'ACCEPTED' | 'REJECTED', message: string | null) => runAction(`tryout-${target.id}-${status}`, async () => {
        await apiClient.put(`/admin/tryouts/clubs/${clubId}/applications/${target.id}/status`, { message: message ?? null }, { params: { status } });
        await loadTryouts(true);
        setSuccessMessage(status === 'ACCEPTED' ? 'Tryout accepted.' : 'Tryout declined.');
        if (status === 'ACCEPTED') setTryoutAcceptTarget(null); else setTryoutDeclineTarget(null);
    });
    const executeStatusChange = async (userId: number, status: PlayerAffiliationStatus, message?: string | null) => {
        if (!canChangePlayerStatus) { setErrorMessage('Only club owners and admins can change player status.'); return; }
        await runAction(`player-${userId}-${status}`, async () => {
            await updateClubPlayerStatus(clubId, userId, status, undefined, message);
            await Promise.all([reloadOverview(), loadPlayers(true)]);
            setSuccessMessage(`Player status updated to ${status}.`);
        });
    };

    const actions = {
        roleChange: (userId: number, role: ClubMembershipRole) => runAction(`role-${userId}`, async () => { await updateClubMemberRole(clubId, userId, role); await reloadOverview(); setSuccessMessage(`Role updated to ${clubRoleLabel(role)}.`); }),
        removeMember: (member: ClubManagedMember) => runAction(`remove-${member.userId}`, async () => { await removeClubMember(clubId, member.userId); await reloadOverview(); setConfirmingRemovalUserId(null); setSuccessMessage(`${member.fullName || member.username} was removed.`); }),
        invite: (userId: number) => runAction(`invite-${userId}`, async () => { await createClubInvitation(clubId, userId, selectedInviteRole); await reloadOverview(); setSuccessMessage('Invitation sent.'); }),
        cancelInvite: (inviteId: number) => runAction(`cancel-${inviteId}`, async () => { await cancelClubInvitation(clubId, inviteId); await reloadOverview(); setSuccessMessage('Invitation cancelled.'); }),
        acceptApplication: (id: number) => setAcceptTarget(applicationsList.find(a => a.id === id) ?? overview?.pendingApplications.find(a => a.id === id) ?? null),
        acceptConfirm: async (message: string | null) => {
            if (!acceptTarget) return;
            const target = acceptTarget;
            await runAction(`accept-${target.id}`, async () => {
                const result = await acceptClubApplication(clubId, target.id, message);
                await Promise.all([reloadOverview(), loadApplications(true)]);
                setSuccessMessage(result.activeElsewhere ? 'Application accepted as a trialist. Warning: this player is still active at another club.' : 'Application accepted.');
                setAcceptTarget(null);
            });
        },
        declineApplication: (id: number) => setDeclineTarget(applicationsList.find(a => a.id === id) ?? null),
        declineConfirm: async (message: string | null) => {
            if (!declineTarget) return;
            const target = declineTarget;
            await runAction(`decline-${target.id}`, async () => { await declineClubApplication(clubId, target.id, message); await Promise.all([reloadOverview(), loadApplications(true)]); setSuccessMessage('Application declined.'); setDeclineTarget(null); });
        },
        // Clears the tab's selection only when the request went through.
        bulkDecide: async (applicationIds: number[], action: 'ACCEPT' | 'DECLINE', message: string | null): Promise<boolean> => {
            let completed = false;
            await runAction(`bulk-${action}`, async () => {
                const response = await bulkDecideClubApplications(clubId, { applicationIds, action, message });
                await Promise.all([reloadOverview(), loadApplications(true)]);
                const decided = response.results.filter(r => r.status === action).length;
                const skipped = response.results.filter(r => r.status === 'SKIPPED').length;
                const warnings = response.results.filter(r => r.status === action && !!r.reason).length;
                setSuccessMessage(`${decided} application(s) ${action === 'ACCEPT' ? 'accepted' : 'declined'}${skipped > 0 ? `, ${skipped} skipped` : ''}${warnings > 0 ? `, ${warnings} active-elsewhere warning${warnings === 1 ? '' : 's'}` : ''}.`);
                completed = true;
            });
            return completed;
        },
        playerStatusChange: async (userId: number, status: PlayerAffiliationStatus, playerName?: string) => {
            if (!canChangePlayerStatus) { setErrorMessage('Only club owners and admins can change player status.'); return; }
            if (status === 'PAST' || status === 'REMOVED') { pendingStatus.current = { userId, status, playerName }; setReleaseMessage(''); setShowStatusConfirm(true); return; }
            await executeStatusChange(userId, status);
        },
        confirmStatus: async () => {
            setShowStatusConfirm(false);
            const pending = pendingStatus.current;
            if (!pending) return;
            await executeStatusChange(pending.userId, pending.status, releaseMessage.trim() || null);
            pendingStatus.current = null; setReleaseMessage('');
        },
        cancelStatus: () => { setShowStatusConfirm(false); pendingStatus.current = null; setReleaseMessage(''); },
        sendConsentEmail: async (userId: number, parentEmail?: string | null) => {
            let sent = false;
            await runAction(`consent-${userId}`, async () => { await sendParentalConsentEmail(clubId, userId, parentEmail); sent = true; setSuccessMessage('Consent email sent. Waiting for the parent’s response.'); await loadPlayers(true); });
            return sent;
        },
        trialEndsChange: async (userId: number, trialEndsOn: string) => {
            if (!canChangePlayerStatus) { setErrorMessage('Only club owners and admins can change trial dates.'); return; }
            await runAction(`trial-ends-${userId}`, async () => { await updateClubPlayerStatus(clubId, userId, 'TRIALIST', trialEndsOn || null); await loadPlayers(true); setSuccessMessage('Trial deadline updated.'); });
        },
        transferOwnership: (member: ClubManagedMember) => runAction(`transfer-${member.userId}`, async () => {
            await transferClubOwnership(clubId, member.userId);
            setConfirmingOwnershipTransferUserId(null);
            setSuccessMessage('Ownership transferred. Redirecting...');
            setTimeout(() => navigate(`/clubs/${clubId}`), 1500);
        }),
        leaveClub: () => runAction('leave-club', async () => {
            if (!selfDeparture.current) throw new Error('Refresh your club responsibilities before confirming departure.');
            try { await leaveClubMembership(clubId, selfDeparture.current); }
            catch (error) {
                if ((error as { response?: { status?: number } }).response?.status === 409) { selfDeparture.current = null; setConfirmingSelfLeave(false); }
                throw error;
            }
            selfDeparture.current = null; setConfirmingSelfLeave(false);
            navigate(`/clubs/${clubId}`);
        }),
        confirmSelfLeave: (confirm: boolean) => {
            if (!confirm) { selfDeparture.current = null; setConfirmingSelfLeave(false); return; }
            void runAction('prepare-leave', async () => { selfDeparture.current = await prepareStaffDeparture(clubId); setConfirmingSelfLeave(true); });
        },
        // Both decisions open the note dialog (accept: invitation instructions, decline: the kind note); the change happens on confirm.
        tryoutStatus: (applicationId: number, status: 'ACCEPTED' | 'REJECTED') => {
            const target = tryoutApplicants.find(a => a.id === applicationId) ?? null;
            if (status === 'ACCEPTED') setTryoutAcceptTarget(target); else setTryoutDeclineTarget(target);
        },
        tryoutAcceptConfirm: async (message: string | null) => { if (tryoutAcceptTarget) await decideTryout(tryoutAcceptTarget, 'ACCEPTED', message); },
        tryoutDeclineConfirm: async (message: string | null) => { if (tryoutDeclineTarget) await decideTryout(tryoutDeclineTarget, 'REJECTED', message); },
    };

    return {
        pendingKey, errorMessage, successMessage, setErrorMessage, setSuccessMessage, actions,
        players: { filter: playerStatusFilter, setFilter: setPlayerStatusFilter, page: playerPage, setPage: setPlayerPage, directory: playerDirectory, loading: playerLoading, error: playerError, reload: () => loadPlayers(true), invalidate: invalidatePlayers, show: showPlayers },
        tryouts: { applicants: tryoutApplicants, loading: tryoutsLoading, pendingCount: tryoutPendingCount },
        applications: { jobs, list: applicationsList, loading: applicationsLoading, error: applicationsError, filters: applicationsFilters, setFilters: setApplicationsFilters, page: applicationPage, setPage: setApplicationPage, total: applicationTotal, reload: () => loadApplications(true) },
        invites: { query: searchQuery, setQuery: setSearchQuery, page: searchPage, setPage: setSearchPage, results: searchResults, loading: searchLoading, role: selectedInviteRole, setRole: setSelectedInviteRole, invitedUserIds },
        decisions: {
            acceptTarget, setAcceptTarget, declineTarget, setDeclineTarget, tryoutAcceptTarget, setTryoutAcceptTarget, tryoutDeclineTarget, setTryoutDeclineTarget,
            releaseMessage, setReleaseMessage, showStatusConfirm, pendingStatus: pendingStatus.current,
            confirmingRemovalUserId, setConfirmingRemovalUserId, confirmingOwnershipTransferUserId, setConfirmingOwnershipTransferUserId, confirmingSelfLeave,
        },
    };
}
export type ClubMembership = ReturnType<typeof useClubMembership>;
