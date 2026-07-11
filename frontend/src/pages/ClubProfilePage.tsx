import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { chatApi } from '../api/chat';
import { ShieldCheck } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { ClubHero } from '../components/club/ClubHero';
import { ClubProfileInfoPanel } from '../components/club/ClubProfileInfoPanel';
import { ClubOpportunities } from '../components/club/ClubOpportunities';
import { ClubProfileStickyHeader } from '../components/club/ClubProfileStickyHeader';
import type { ClubNavigationTab } from '../components/club/clubNavigation';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { MatchInviteModal, type MatchChallengePayload } from '../components/club/MatchInviteModal';
import { ClubManagementModal, type ClubManagementTab } from '../components/club/ClubManagementModal';
import { ClubMessageModal, buildClubCommunicationOptions, openClubCommunication } from '../components/club/ClubMessageModal';
import { TabTeams } from '../components/club/tabs/TabTeams';
import { TabOverview } from '../components/club/tabs/TabOverview';
import { TabHonours } from '../components/club/tabs/TabHonours';
import { TabCalendar } from '../components/club/tabs/TabCalendar';
import { TabMedia } from '../components/club/tabs/TabMedia';
import { TabEvents } from '../components/club/tabs/TabEvents';
import { TabContact } from '../components/club/tabs/TabContact';
import {
    canManageClubOperations,
    isLeadershipRole,
    type ClubRelationshipState,
    type ClubMembershipRole,
    type PlayerAffiliationStatus,
    type PlayerJoinPolicy
} from '../features/clubs/domain';
import { fetchMyClubMembershipContext, fetchClubManagementOverview } from '../features/clubs/api';
import { ClubApplicationPanel } from '../features/applications/components/ClubApplicationPanel';
import { useAuth } from '../context/AuthContext';
import { buildLoginRedirectPath } from '../utils/authRedirect';

export interface ClubOpportunity {
    id: number;
    type: 'FUNDRAISING' | 'JOB' | 'VOLUNTEER' | 'WISHLIST';
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
}

export type ClubTab = ClubNavigationTab;

const normalizeManagementTab = (value: string | null): ClubManagementTab | null =>
    value === 'personnel' || value === 'players' || value === 'invites' || value === 'applications' || value === 'roles' || value === 'squads' || value === 'tryouts'
        ? value
        : null;

const normalizeTab = (value: string | null): ClubTab =>
    value === 'honours' || value === 'teams' || value === 'schedule' || value === 'media' || value === 'events' || value === 'contact'
        ? value
        : 'overview';

export const ClubProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { status } = useAuth();

    const [club, setClub] = useState<ClubProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [myClubId, setMyClubId] = useState<number | null>(null);
    const [myClubRole, setMyClubRole] = useState<string | null>(null);
    const [squadsRefreshKey, setSquadsRefreshKey] = useState(0);
    const [isManageClubOpen, setIsManageClubOpen] = useState(false);
    const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

    const activeTab = normalizeTab(searchParams.get('tab'));
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
        if (id) {
            void fetchClubData();
        }
    }, [id]);

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

    const isViewingOwnClub = myClubId !== null && myClubId === Number(id);
    const ownClubRole = club?.myRole ?? myClubRole ?? null;
    const debugMode = searchParams.get('debug') === 'true';
    const isOwnClubAdmin = isViewingOwnClub && canManageClubOperations(ownClubRole);
    const canManageOwnClub = isViewingOwnClub && canManageClubOperations(ownClubRole);
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
        setSearchParams(nextSearchParams, { replace: true });
    };

    const setActiveTab = (tab: ClubTab) => updateSearchParam('tab', tab === 'overview' ? null : tab);

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
        if (communicationOptions.length === 0) {
            navigate('/messages');
            return;
        }
        if (communicationOptions.length === 1) {
            openClubCommunication(communicationOptions[0]);
            return;
        }
        setIsMessageModalOpen(true);
    };

    const handleOpenGrassKickZChat = () => {
        setIsMessageModalOpen(false);
        navigate('/messages');
    };

    const handleMembershipLeft = async () => {
        closeManageClub();
        await Promise.all([fetchClubData(), fetchUserContext()]);
        setSquadsRefreshKey((current) => current + 1);
    };

    if (loading) {
        return (
            <div className="club-page-shell bg-base min-h-[calc(100vh-var(--app-header-height))]">
                <div className="mx-auto max-w-[min(1440px,calc(100vw-48px))] px-6 py-8">
                    <div className="mb-8 h-[300px] w-full animate-pulse rounded-md bg-white/[0.02]" />
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
            <div className="club-page-shell bg-base flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center px-6">
                <div className="bg-surface border border-subtle px-8 py-10 text-center">
                    <ShieldCheck className="mx-auto mb-4 h-12 w-12 accent-primary" />
                    <h2 className="text-xl font-black uppercase tracking-[0.18em] text-primary">Club Not Found</h2>
                    <button type="button" onClick={() => navigate(-1)} className="mt-4 text-sm font-black uppercase tracking-[0.16em] accent-primary">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="club-page-shell min-h-full bg-[color:var(--club-theme-base)]">
            <ClubHero
                club={club}
                canEditClubAssets={isOwnClubAdmin}
                canManageClub={canManageOwnClub}
                canOpenCalendar={canOpenCalendar}
                canChallengeClub={showVisitorActions && canChallengeOtherClub}
                canMessageClub={canMessageClub}
                showApplyButton={showVisitorActions && club.playerJoinPolicy !== 'INVITE_ONLY' && !isLeadershipRole(myClubRole)}
                membershipRole={ownClubRole ?? null}
                onFollowToggle={handleFollowToggle}
                onOpenCalendar={() => setActiveTab('schedule')}
                onOpenManageClub={() => openManageClub()}
                onOpenWorkspace={isOwnClubAdmin ? openWorkspace : undefined}
                onOpenChallengeModal={() => setIsChallengeModalOpen(true)}
                onOpenMessage={handleOpenMessage}
                onOpenApply={() => setIsApplyModalOpen(true)}
                onRefresh={fetchClubData}
            />

            <ClubProfileStickyHeader
                activeTab={activeTab}
                onTabChange={setActiveTab}
                club={club}
            />

            <div className="mx-auto w-full px-6 pb-10 pt-4 sm:px-8">
                <div className="mt-6 grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)_320px] lg:items-start lg:justify-center">
                    <div className="hidden lg:block lg:sticky lg:top-[14px] pl-6">
                        <ClubProfileInfoPanel club={club} />
                    </div>

                    <div className="min-w-0">
                        <div className="mb-6 lg:hidden">
                            <ClubProfileInfoPanel club={club} />
                        </div>

                        {activeTab === 'overview' && <TabOverview club={club} isOwnClubAdmin={isOwnClubAdmin} onOpenManageClub={(tab) => openManageClub(tab)} />}
                        {activeTab === 'honours' && <TabHonours club={club} />}
                        {activeTab === 'teams' && <TabTeams clubId={club.id} refreshKey={squadsRefreshKey} />}
                        {activeTab === 'schedule' && <TabCalendar clubId={club.id} isOwnClubAdmin={isOwnClubAdmin} />}
                        {activeTab === 'media' && <TabMedia clubId={club.id} />}
                        {activeTab === 'events' && <TabEvents clubId={club.id} />}
                        {activeTab === 'contact' && <TabContact club={club} />}
                    </div>

                    <div className="hidden lg:block lg:sticky lg:top-[14px]">
                        {activeTab === 'overview' && (
                            <ClubOpportunities
                                club={club}
                                onOpenModule={() => setActiveTab('events')}
                                showOpportunityBoard
                            />
                        )}
                    </div>
                </div>
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
                    onSquadCreated={() => setSquadsRefreshKey((current) => current + 1)}
                    onDataChanged={() => {
                        void fetchClubData();
                        void fetchUserContext();
                        setSquadsRefreshKey((current) => current + 1);
                    }}
                    onMembershipLeft={handleMembershipLeft}
                />
            )}

            {isMessageModalOpen && (
                <ClubMessageModal
                    clubName={club.name}
                    options={communicationOptions}
                    onClose={() => setIsMessageModalOpen(false)}
                    onOpenGrassKickZChat={handleOpenGrassKickZChat}
                />
            )}

            {isApplyModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsApplyModalOpen(false)} />
                    <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
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
        </div>
    );
};
