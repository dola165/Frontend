import { ClubProfilePreviews } from '../features/clubs/ClubProfilePreviews';
import { clubViewerRole } from '../components/club/clubViewerRole';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/axiosConfig';
import { ClubHero } from '../components/club/ClubHero';
import { ClubProfileInfoPanel } from '../components/club/ClubProfileInfoPanel';
import { ClubSponsors } from '../components/club/ClubPresentation';
import type { ClubPresentation } from '../features/clubs/presentation';
import { ClubOpportunities } from '../components/club/ClubOpportunities';
import { ClubProfileStickyHeader } from '../components/club/ClubProfileStickyHeader';
import { normalizeClubNavigationTab, type ClubNavigationTab } from '../components/club/clubNavigation';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { MatchInviteModal, type MatchChallengePayload } from '../components/club/MatchInviteModal';
import { ClubManagementModal, type ClubManagementTab } from '../components/club/ClubManagementModal';
import { ClubMessageModal, buildClubCommunicationOptions } from '../components/club/ClubMessageModal';
import { ClubEnquiryModal } from '../components/club/ClubEnquiryModal';
import type { ClubEnquiryContext } from '../features/clubs/publicJourney';
import { TabTraining } from '../components/club/tabs/TabTraining';
import '../components/club/club-public.css';
import { TabFacilities } from '../components/club/tabs/TabFacilities';
import { TabOverview } from '../components/club/tabs/TabOverview';
import { TabHonours } from '../components/club/tabs/TabHonours';
import { TabPeople } from '../components/club/tabs/TabPeople';
import { TabCalendar } from '../components/club/tabs/TabCalendar';
import { TabEvents } from '../components/club/tabs/TabEvents';
import { TabMedia } from '../components/club/tabs/TabMedia';
import { TabContact } from '../components/club/tabs/TabContact';
import { ClubBusinessTab } from '../components/club/ClubBusinessTab';
import {
    canManageClubOperations,
    isLeadershipRole,
    type ClubRelationshipState,
    type ClubMembershipRole,
    type PlayerAffiliationStatus,
    type PlayerJoinPolicy
} from '../features/clubs/domain';
import { fetchMyClubMembershipContext, fetchClubManagementOverview, dissolveClub } from '../features/clubs/api';
import { ClubApplicationPanel } from '../features/applications/components/ClubApplicationPanel';
import { useAuth } from '../context/AuthContext';
import { buildLoginRedirectPath } from '../utils/authRedirect';
import { extractApiErrorMessage } from '../utils/apiError';

export interface ClubOpportunity {
    id: number;
    type: 'FUNDRAISING' | 'JOB' | 'VOLUNTEER';
    title: string;
    externalLink: string;
}

export interface ClubHonour {
    id: number;
    title: string;
    yearWon: number;
    description?: string | null;
}

export interface ClubProfile {
    presentation?: ClubPresentation | null;
    id: number;
    name: string;
    description: string;
    type: string;
    isOfficial: boolean;
    statusLabel: string;
    followerCount: number;
    memberCount: number;
    isFollowedByMe: boolean;
    isStaffMember: boolean;
    isMember: boolean;
    myRole?: ClubMembershipRole | null;
    playerJoinPolicy?: PlayerJoinPolicy | null;
    playerAffiliationStatus?: PlayerAffiliationStatus | null;
    relationshipState?: ClubRelationshipState | null;
    pendingApplicationId?: number | null;
    pendingApplicationRole?: ClubMembershipRole | null;
    addressText?: string;
    logoUrl?: string;
    bannerUrl?: string;
    whatsappNumber?: string | null;
    facebookMessengerUrl?: string | null;
    preferredCommunicationMethod?: string | null;
    cityName?: string | null;
    countryName?: string | null;
    email?: string | null;
    websiteUrl?: string | null;
    instagramUrl?: string | null;
    foundedYear?: number | null;
    level?: string | null;
    latitude?: number;
    longitude?: number;
    trustedByClubs: Array<{ clubId: number; clubName: string }>;
    honours: ClubHonour[];
    opportunities: ClubOpportunity[];
    category?: string | null;
    pendingApplicationJobId?: number | null;
}

export type ClubTab = ClubNavigationTab;

const normalizeManagementTab = (value: string | null): ClubManagementTab | null =>
    value === 'personnel' || value === 'players' || value === 'invites' || value === 'applications' || value === 'roles' || value === 'squads' || value === 'tryouts'
        ? value
        : null;

export const ClubProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const { sessionId, status } = useAuth();
    return <ClubProfileContent key={`${id}:${sessionId}:${status}`} />;
};

const ClubProfileContent = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { status, user, sessionId } = useAuth();

    const [club, setClub] = useState<ClubProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [myClubId, setMyClubId] = useState<number | null>(null);
    const [myClubRole, setMyClubRole] = useState<string | null>(null);
    const [squadsRefreshKey, setSquadsRefreshKey] = useState(0);
    const [isManageClubOpen, setIsManageClubOpen] = useState(false);
    const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [enquiry, setEnquiry] = useState<ClubEnquiryContext | null>(null);
    const [workspaceEntry, setWorkspaceEntry] = useState<{ key: string; canOpenWorkspace: boolean; canEditFacilities: boolean; canManageStaff: boolean } | null>(null);
    const entryKey = `${id}:${sessionId}:${status}`;
    const entry = workspaceEntry?.key === entryKey ? workspaceEntry : null;
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [isDissolveDialogOpen, setIsDissolveDialogOpen] = useState(false);
    const [isDissolving, setIsDissolving] = useState(false);
    useEffect(() => { setIsMessageModalOpen(false); setEnquiry(null); }, [id, sessionId]);
    useEffect(() => {
        if (status !== 'authenticated' || !id) return;
        const c = new AbortController();
        void apiClient.get(`/clubs/${id}/workspace-entry`, { signal: c.signal }).then(r => {
            if (!c.signal.aborted) setWorkspaceEntry({ ...r.data, key: entryKey });
        }).catch(() => { if (!c.signal.aborted) setWorkspaceEntry(null); });
        return () => c.abort();
    }, [id, status, entryKey]);
    useEffect(() => {
        if (status !== 'authenticated' || !club || searchParams.get('enquire') !== '1') return;
        const p = club.presentation?.programmes.find(p => p.published && String(p.id) === searchParams.get('programme'));
        const c = new AbortController();
        const finish = () => { const next = new URLSearchParams(searchParams); next.delete('enquire'); setSearchParams(next, { replace: true }); };
        if (p) { setEnquiry({ name: p.name, path: `/clubs/${club.id}?tab=teams&programme=${p.id}`, squadIds: p.squadIds ?? [] }); finish(); }
        else if (searchParams.get('squad')) void apiClient.get<Array<{ id: number; name: string }>>(`/clubs/${club.id}/squads`, { signal: c.signal }).then(r => {
            if (c.signal.aborted) return;
            const s = r.data.find(s => String(s.id) === searchParams.get('squad'));
            if (s) setEnquiry({ name: s.name, path: `/clubs/${club.id}?tab=teams&squad=${s.id}`, squadIds: [s.id] });
            finish();
        }).catch(() => { if (!c.signal.aborted) finish(); });
        else finish();
        return () => c.abort();
    }, [status, club, searchParams, setSearchParams]);

    const activeTab = normalizeClubNavigationTab(searchParams.get('tab'));
    const requestedManagementTab = useMemo(() => normalizeManagementTab(searchParams.get('managementTab')), [searchParams]);

    const fetchClubData = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/clubs/${id}`);
            setClub(response.data);
        } catch (error) {
            console.error('Failed to fetch club', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserContext = async () => {
        try {
            const membershipResponse = await fetchMyClubMembershipContext().catch(() => null);
            if (membershipResponse?.clubId) {
                setMyClubId(membershipResponse.clubId);
                setMyClubRole(membershipResponse.myRole ?? null);
            } else {
                setMyClubId(null);
                setMyClubRole(null);
            }
        } catch (error) {
            console.error('Failed to fetch user context', error);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        setClub(null); setLoading(true);
        if (id) void apiClient.get(`/clubs/${id}`, { signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) setClub(response.data); })
            .catch(() => { if (!controller.signal.aborted) setClub(null); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [id, sessionId]);

    useEffect(() => {
        if (!id) return;
        if (status !== 'authenticated') {
            setMyClubId(null);
            setMyClubRole(null);
            return;
        }
        void fetchUserContext();
    }, [id, status]);

    // Cross-verify membership: if viewing own club but profile shows no role,
    // attempt a recovery fetch via the management endpoint.
    useEffect(() => {
        if (!id || !club || status !== 'authenticated') return;
        if (myClubId !== Number(id)) return;
        if (club.myRole) return; // role already resolved — nothing to fix

        let cancelled = false;
        const verifyRole = async () => {
            try {
                const overview = await fetchClubManagementOverview(Number(id));
                if (!cancelled && overview.currentUserRole) {
                    setClub((prev) => prev ? { ...prev, myRole: overview.currentUserRole } : prev);
                }
            } catch {
                // non-critical — the modal will show "Verifying membership…" instead
            }
        };
        void verifyRole();
        return () => { cancelled = true; };
    }, [id, club, myClubId, status]);

    const isViewingOwnClub = Boolean(club?.isStaffMember || club?.myRole || entry?.canOpenWorkspace || myClubId !== null && myClubId === Number(id));
    const ownClubRole = clubViewerRole(Number(id), club?.myRole, myClubId, myClubRole);
    const debugMode = searchParams.get('debug') === 'true';
    const isOwnClubAdmin = isViewingOwnClub && canManageClubOperations(ownClubRole);
    const canManageOwnClub = isViewingOwnClub && canManageClubOperations(ownClubRole);
    const canDissolveClub = isViewingOwnClub && isLeadershipRole(ownClubRole);
    const canChallengeOtherClub = Boolean(myClubId && myClubId !== Number(id) && myClubRole && canManageClubOperations(myClubRole));
    const canOpenCalendar = isOwnClubAdmin;
    const hasPlayerAffiliation = club?.playerAffiliationStatus === 'TRIALIST' || club?.playerAffiliationStatus === 'ACTIVE';
    const communicationOptions = buildClubCommunicationOptions(club?.whatsappNumber, club?.facebookMessengerUrl, club?.preferredCommunicationMethod);
    const showVisitorActions = Boolean(club && !club.isStaffMember && !hasPlayerAffiliation);
    const canMessageClub = Boolean(showVisitorActions);

    useEffect(() => {
        if (searchParams.get('manageClub') !== '1' || !canManageOwnClub) {
            return;
        }
        setIsManageClubOpen(true);
    }, [canManageOwnClub, searchParams]);

    const updateSearchParam = (key: string, value?: string | null) => {
        const nextSearchParams = new URLSearchParams(searchParams);
        if (value) {
            nextSearchParams.set(key, value);
        } else {
            nextSearchParams.delete(key);
        }
        if (key === 'tab') for (const filter of ['programme','squad','age','q','staff','enquire']) nextSearchParams.delete(filter);
        setSearchParams(nextSearchParams, { replace: false });
    };

    const setActiveTab = (tab: ClubTab) => (tab === 'store' || tab === 'campaigns') ? navigate(`/clubs/${id}/${tab}`) : updateSearchParam('tab', tab === 'overview' ? null : tab);
    useEffect(() => { if (['store','campaigns'].includes(searchParams.get('tab') ?? '') && id) navigate(`/clubs/${id}/${searchParams.get('tab')}`, { replace: true }); }, [searchParams, id, navigate]);

    const openManageClub = (tab?: ClubManagementTab | null) => {
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.set('manageClub', '1');
        if (tab) {
            nextSearchParams.set('managementTab', tab);
        } else {
            nextSearchParams.delete('managementTab');
        }
        setSearchParams(nextSearchParams, { replace: true });
        setIsManageClubOpen(true);
    };

    const openWorkspace = () => {
        navigate(`/clubs/${id}/workspace`);
    };

    const closeManageClub = () => {
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.delete('manageClub');
        nextSearchParams.delete('managementTab');
        setSearchParams(nextSearchParams, { replace: true });
        setIsManageClubOpen(false);
    };

    const handleFollowToggle = async () => {
        if (status !== 'authenticated') {
            navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
            return;
        }

        try {
            await apiClient.post(`/clubs/${id}/follow`);
            await fetchClubData();
        } catch (error) {
            console.error('Failed to toggle follow', error);
        }
    };

    const handleChallengeSubmit = async (inviteData: MatchChallengePayload) => {
        try {
            await apiClient.post(`/clubs/${id}/challenge`, inviteData);
            setIsChallengeModalOpen(false);
        } catch (error) {
            console.error('Failed to send challenge', error);
            throw error;
        }
    };

    const handleOpenMessage = () => {
        setIsMessageModalOpen(true);
    };

    const handleOpenGrassKickZChat = (userId: number) => {
        setIsMessageModalOpen(false);
        const query = `?chatWith=${userId}`;
        navigate(status === 'authenticated' ? `/messages${query}` : buildLoginRedirectPath('/messages', query, ''));
    };

    const handleMembershipLeft = async () => {
        closeManageClub();
        await Promise.all([fetchClubData(), fetchUserContext()]);
        setSquadsRefreshKey((current) => current + 1);
    };

    const handleDissolveConfirm = async () => {
        if (!club || isDissolving) return;
        setIsDissolving(true);
        try {
            await dissolveClub(club.id);
            setIsDissolveDialogOpen(false);
            setMyClubId(null);
            setMyClubRole(null);
            toast.success('Club dissolved');
            navigate('/clubs', { replace: true });
        } catch (error) {
            toast.error(extractApiErrorMessage(error, 'Failed to dissolve club'));
        } finally {
            setIsDissolving(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-[#0f1117] min-h-[calc(100vh-var(--app-header-height))]">
                <div className="w-full py-8">
                    <div className="mb-8 h-[300px] w-full animate-pulse rounded-xl bg-white/[0.02]" />
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr_320px]">
                        <div className="space-y-4">
                            <SkeletonCard lines={5} />
                        </div>
                        <div className="space-y-5">
                            <SkeletonCard lines={3} />
                            <SkeletonCard lines={4} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!club) {
        return (
            <div className="bg-[#0f1117] flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center px-6">
                <div className="bg-[#16181d] border border-[#ffffff0d] rounded-xl px-8 py-10 text-center">
                    <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-[#16a34a]" />
                    <h2 className="text-xl font-semibold text-[#f4f4f5]">Club Not Found</h2>
                    <button type="button" onClick={() => navigate(-1)} className="mt-4 text-sm font-semibold text-[#16a34a] hover:text-[#22c55e]">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <ClubProfilePreviews club={club}><div className={`club-page-shell${activeTab === 'overview' ? '' : ' club-page-shell--section'} min-h-full bg-[color:var(--club-theme-base)]`}>
            <ClubHero
                club={club}
                canEditClubAssets={isLeadershipRole(ownClubRole)}
                canManageClub={isLeadershipRole(ownClubRole)}
                canOpenCalendar={canOpenCalendar}
                canChallengeClub={showVisitorActions && canChallengeOtherClub}
                canMessageClub={canMessageClub}
                showApplyButton={showVisitorActions && club.playerJoinPolicy !== 'INVITE_ONLY' && !isLeadershipRole(myClubRole)}
                membershipRole={ownClubRole ?? null}
                onFollowToggle={handleFollowToggle}
                onOpenCalendar={() => setActiveTab('schedule')}
                onOpenManageClub={() => openManageClub()}
                onOpenWorkspace={openWorkspace}
                onOpenChallengeModal={() => setIsChallengeModalOpen(true)}
                onOpenMessage={handleOpenMessage}
                canOpenWorkspace={Boolean(entry?.canOpenWorkspace || canManageOwnClub)}
                onOpenApply={() => setIsApplyModalOpen(true)}
                onRefresh={fetchClubData}
            />

            <ClubProfileStickyHeader
                activeTab={activeTab}
                onTabChange={setActiveTab}
                club={club}
            />

            <div className="club-profile-frame mx-auto w-full pb-10 pt-4">
                <div
                    className={`club-profile-main-grid ${activeTab === 'business' ? 'club-profile-main-grid--business' : ['teams', 'facilities', 'people'].includes(activeTab) ? 'club-profile-main-grid--wide' : ''} mt-6 grid gap-4 xl:items-start`}
                >
                    {!['business', 'teams', 'facilities', 'people'].includes(activeTab) && <div className="hidden xl:block xl:sticky xl:top-[14px]">
                        <ClubProfileInfoPanel club={club} />
                    </div>}

                    <div className="min-w-0">
                        {!['business', 'teams', 'facilities', 'people'].includes(activeTab) && <details className="mb-5 rounded-xl border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-surface)] xl:hidden">
                            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[color:var(--club-theme-text-primary)]">Club information & contact</summary>
                            <ClubProfileInfoPanel club={club} />
                        </details>}

                        {activeTab === 'overview' && (
                            <div className="space-y-5">
                                <TabOverview club={club} isOwnClubAdmin={isOwnClubAdmin} onOpenManageClub={(tab) => openManageClub(tab)} />

                            </div>
                        )}
                        {activeTab === 'honours' && <TabHonours club={club} />}
                        {activeTab === 'people' && <TabPeople clubId={club.id} clubName={club.name} isOwnClubAdmin={Boolean(entry?.canManageStaff)} />}
                        {activeTab === 'teams' && <TabTraining club={club} refreshKey={squadsRefreshKey} onContact={setEnquiry} isAuthenticated={status === 'authenticated'} />}
                        {activeTab === 'facilities' && <TabFacilities club={club} isOwnClubAdmin={Boolean(entry?.canEditFacilities)} />}
                        {activeTab === 'schedule' && <TabCalendar clubId={club.id} isOwnClubAdmin={isOwnClubAdmin} />}
                        {activeTab === 'events' && <TabEvents clubId={club.id} isOwnClubAdmin={isOwnClubAdmin} />}
                        {activeTab === 'media' && <div className="space-y-5"><TabMedia clubId={club.id} mediaType="pictures" /><TabMedia clubId={club.id} mediaType="videos" /></div>}
                        {activeTab === 'business' && (
                            <ClubBusinessTab
                                club={club}
                                ownClubRole={ownClubRole as ClubMembershipRole | null}
                                isAuthenticated={status === 'authenticated'}
                                currentUserId={user?.id ?? null}
                                onDataChanged={() => {
                                    void fetchClubData();
                                    void fetchUserContext();
                                }}
                            />
                        )}
                        {activeTab === 'contact' && <TabContact club={club} />}
                    </div>

                    {!['business', 'teams', 'facilities', 'people'].includes(activeTab) && (
                        <div className="hidden space-y-4 xl:block xl:sticky xl:top-[14px]">
                            <ClubSponsors presentation={club.presentation} />
                            <ClubOpportunities
                                club={club}
                                onOpenModule={() => setActiveTab('business')}
                                showOpportunityBoard
                            />
                        </div>
                    )}
                </div>
                {activeTab === 'overview' && <div className="mt-5 xl:hidden"><ClubSponsors presentation={club.presentation} /></div>}
            </div>

            {isChallengeModalOpen && (
                <MatchInviteModal
                    sourceClubId={myClubId as number}
                    targetClubId={club.id}
                    targetClubName={club.name}
                    onClose={() => setIsChallengeModalOpen(false)}
                    onSubmit={handleChallengeSubmit}
                />
            )}

            {isManageClubOpen && (
                <ClubManagementModal
                    clubId={club.id}
                    clubName={club.name}
                    currentRole={ownClubRole ?? null}
                    initialTab={requestedManagementTab}
                    debugMode={debugMode}
                    onClose={closeManageClub}
                    onDissolveClub={canDissolveClub ? () => { closeManageClub(); setIsDissolveDialogOpen(true); } : undefined}
                    onSquadCreated={() => setSquadsRefreshKey((current) => current + 1)}
                    onDataChanged={() => {
                        void fetchClubData();
                        void fetchUserContext();
                        setSquadsRefreshKey((current) => current + 1);
                    }}
                    onMembershipLeft={handleMembershipLeft}
                />
            )}

            {enquiry && <ClubEnquiryModal key={`${club.id}:${sessionId}:${enquiry.path}`} clubId={club.id} clubName={club.name} context={enquiry} onClose={() => setEnquiry(null)} />}
            {isMessageModalOpen && (
                <ClubMessageModal
                    key={`${club.id}:${sessionId}`}
                    clubId={club.id}
                    clubName={club.name}
                    options={communicationOptions}
                    onClose={() => setIsMessageModalOpen(false)}
                    onOpenGrassKickZChat={handleOpenGrassKickZChat}
                />
            )}

            {isApplyModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsApplyModalOpen(false)} />
                    <div className="relative z-10 max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl">
                        <ClubApplicationPanel
                            clubId={club.id}
                            clubName={club.name}
                            isAuthenticated={status === 'authenticated'}
                            playerJoinPolicy={club.playerJoinPolicy ?? 'APPLICATION_REQUIRED'}
                            playerAffiliationStatus={club.playerAffiliationStatus ?? null}
                            relationshipState={club.relationshipState ?? null}
                            pendingApplicationId={club.pendingApplicationId ?? null}
                            pendingApplicationRole={club.pendingApplicationRole ?? null}
                            onOpenInvites={() => navigate('/my-club')}
                            onSignIn={() => navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash))}
                            onClose={() => setIsApplyModalOpen(false)}
                            onStateChange={(nextState) => {
                                setClub((current) => current ? {
                                    ...current,
                                    relationshipState: nextState.relationshipState,
                                    playerAffiliationStatus: nextState.playerAffiliationStatus ?? current.playerAffiliationStatus ?? null,
                                    pendingApplicationId: nextState.pendingApplicationId ?? null,
                                    pendingApplicationRole: nextState.pendingApplicationRole ?? null
                                } : current);
                            }}
                        />
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={isDissolveDialogOpen}
                variant="danger"
                title="Dissolve this club?"
                message="Dissolving is permanent. Club memberships end, pending invitations and applications close, and recruitment stops. Accounts and club history are preserved. Members and followers will be notified. Finish or cancel tournaments the club hosts or organizes, and withdraw its unfinished entries before continuing."
                confirmLabel={isDissolving ? 'Dissolving…' : 'Dissolve Club'}
                onConfirm={() => void handleDissolveConfirm()}
                onCancel={() => {
                    if (isDissolving) return;
                    setIsDissolveDialogOpen(false);
                    // The settings dialog was closed before confirmation; return to its stable trigger.
                    requestAnimationFrame(() => document.getElementById('club-settings-trigger')?.focus());
                }}
            />
        </div></ClubProfilePreviews>
    );
};
