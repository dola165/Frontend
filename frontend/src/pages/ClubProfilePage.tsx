import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { ClubHero } from '../components/club/ClubHero';
import { ClubProfileInfoPanel } from '../components/club/ClubProfileInfoPanel';
import { ClubOpportunities } from '../components/club/ClubOpportunities';
import { ClubProfileStickyHeader } from '../components/club/ClubProfileStickyHeader';
import type { ClubNavigationTab } from '../components/club/clubNavigation';
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
    type ClubMembershipRole
} from '../features/clubs/domain';
import { fetchMyClubMembershipContext, leaveClubMembership } from '../features/clubs/api';
import { ClubApplicationPanel } from '../features/applications/components/ClubApplicationPanel';
import { createNotificationSearch } from '../utils/notifications';
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
    isMember: boolean;
    myRole?: ClubMembershipRole | null;
    relationshipState?: ClubRelationshipState | null;
    pendingApplicationId?: number | null;
    pendingApplicationRole?: ClubMembershipRole | null;
    addressText?: string;
    logoUrl?: string;
    bannerUrl?: string;
    whatsappNumber?: string | null;
    facebookMessengerUrl?: string | null;
    preferredCommunicationMethod?: string | null;
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
    value === 'personnel' || value === 'invites' || value === 'applications' || value === 'roles' || value === 'squads' || value === 'tryouts'
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

    const ownClubRole = club?.myRole ?? null;
    const isOwnClubAdmin = isLeadershipRole(ownClubRole);
    const canManageOwnClub = canManageClubOperations(ownClubRole);
    const canChallengeOtherClub = Boolean(myClubId && myClubId !== Number(id) && myClubRole && isLeadershipRole(myClubRole));
    const canOpenCalendar = isOwnClubAdmin;
    const communicationOptions = buildClubCommunicationOptions(club?.whatsappNumber, club?.facebookMessengerUrl, club?.preferredCommunicationMethod);
    const showVisitorActions = Boolean(club && !club.isMember);
    const canMessageClub = Boolean(showVisitorActions && canChallengeOtherClub && communicationOptions.length > 0);

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
        if (communicationOptions.length === 1) {
            openClubCommunication(communicationOptions[0]);
            return;
        }
        if (communicationOptions.length > 1) {
            setIsMessageModalOpen(true);
        }
    };

    const handleMembershipLeft = async () => {
        closeManageClub();
        await Promise.all([fetchClubData(), fetchUserContext()]);
        setSquadsRefreshKey((current) => current + 1);
    };

    const handleLeaveOwnClub = async () => {
        if (!club) return;
        await leaveClubMembership(club.id);
        await handleMembershipLeft();
    };

    if (loading) {
        return (
            <div className="club-page-shell bg-base flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent-primary border-t-transparent"></div>
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
        <div className="club-page-shell min-h-full bg-[linear-gradient(180deg,#050910_0%,#070d15_18%,#08111b_100%)]">
            <ClubHero
                club={club}
                canEditClubAssets={isOwnClubAdmin}
                canManageClub={canManageOwnClub}
                canOpenCalendar={canOpenCalendar}
                canChallengeClub={showVisitorActions && canChallengeOtherClub}
                canMessageClub={canMessageClub}
                membershipRole={ownClubRole ?? null}
                showInlineLeaveAction={ownClubRole === 'PLAYER' || ownClubRole === 'COACH'}
                onFollowToggle={handleFollowToggle}
                onOpenCalendar={() => setActiveTab('schedule')}
                onOpenManageClub={() => openManageClub()}
                onOpenChallengeModal={() => setIsChallengeModalOpen(true)}
                onOpenMessage={handleOpenMessage}
                onLeaveClub={handleLeaveOwnClub}
                onRefresh={fetchClubData}
            />

            <ClubProfileStickyHeader
                activeTab={activeTab}
                onTabChange={setActiveTab}
                club={club}
            />

            <div className="mx-auto max-w-[1240px] px-4 pb-10 pt-4 sm:px-6">
                {!club.isMember ? (
                    <div className="mb-4">
                        <ClubApplicationPanel
                            clubId={club.id}
                            clubName={club.name}
                            isAuthenticated={status === 'authenticated'}
                            relationshipState={club.relationshipState ?? null}
                            pendingApplicationId={club.pendingApplicationId ?? null}
                            pendingApplicationRole={club.pendingApplicationRole ?? null}
                            activeClubId={myClubId}
                            onOpenInvites={() => navigate('/my-club')}
                            onSignIn={() => navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash))}
                            onStateChange={(nextState) => {
                                setClub((current) => current ? {
                                    ...current,
                                    relationshipState: nextState.relationshipState,
                                    pendingApplicationId: nextState.pendingApplicationId ?? null,
                                    pendingApplicationRole: nextState.pendingApplicationRole ?? null
                                } : current);
                            }}
                        />
                    </div>
                ) : null}

                <div className="mt-6 grid gap-5 lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,700px)_272px] xl:items-start xl:justify-center">
                    <div className="hidden lg:block">
                        <ClubProfileInfoPanel club={club} />
                    </div>

                    <div className="min-w-0">
                        <div className="mb-6 lg:hidden">
                            <ClubProfileInfoPanel club={club} />
                        </div>

                        {activeTab === 'overview' && <TabOverview club={club} isOwnClubAdmin={isOwnClubAdmin} />}
                        {activeTab === 'honours' && <TabHonours club={club} />}
                        {activeTab === 'teams' && <TabTeams clubId={club.id} refreshKey={squadsRefreshKey} />}
                        {activeTab === 'schedule' && <TabCalendar clubId={club.id} isOwnClubAdmin={isOwnClubAdmin} />}
                        {activeTab === 'media' && <TabMedia clubId={club.id} />}
                        {activeTab === 'events' && <TabEvents clubId={club.id} />}
                        {activeTab === 'contact' && <TabContact club={club} />}
                    </div>

                    <div className="hidden xl:block">
                        {activeTab === 'overview' ? (
                            <ClubOpportunities
                                club={club}
                                onOpenModule={() => setActiveTab('events')}
                                showOpportunityBoard
                            />
                        ) : canManageOwnClub ? (
                            <div className="sticky top-[calc(var(--app-header-height)+18px)] rounded-[18px] border border-[color:var(--club-theme-border-subtle)] bg-[rgba(12,18,27,0.96)] p-4 shadow-[0_18px_34px_rgba(2,6,12,0.24)]">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--club-theme-text-secondary)]">Club Tools</p>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/notifications?${createNotificationSearch('club', club.id, club.name)}`)}
                                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--club-theme-text-secondary)] transition-colors hover:text-[color:var(--club-theme-text-primary)]"
                                >
                                    Club Notifications
                                </button>
                            </div>
                        ) : null}
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
                <ClubMessageModal clubName={club.name} options={communicationOptions} onClose={() => setIsMessageModalOpen(false)} />
            )}
        </div>
    );
};
