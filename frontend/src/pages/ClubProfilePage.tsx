import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { ShieldCheck } from 'lucide-react';

import { ClubHero } from '../components/club/ClubHero';
import { ClubSidebar } from '../components/club/ClubSidebar';
import { ClubOpportunities } from '../components/club/ClubOpportunities';
import { MatchInviteModal } from '../components/club/MatchInviteModal';
import { ClubManagementModal } from '../components/club/ClubManagementModal';
import { ClubMessageModal, buildClubCommunicationOptions, openClubCommunication } from '../components/club/ClubMessageModal';
import { TabTeams } from '../components/club/tabs/TabTeams';
import { TabOverview } from '../components/club/tabs/TabOverview';
import { TabHonours } from '../components/club/tabs/TabHonours';
import { TabOpportunities } from '../components/club/tabs/TabOpportunities';
import { TabCalendar } from '../components/club/tabs/TabCalendar';
import { createNotificationSearch } from '../utils/notifications';

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
    myRole?: string; // 'OWNER', 'CLUB_ADMIN', 'COACH'
    addressText?: string;
    logoUrl?: string;
    bannerUrl?: string;
    whatsappNumber?: string | null;
    facebookMessengerUrl?: string | null;
    preferredCommunicationMethod?: string | null;
    latitude?: number;
    longitude?: number;
    trustedByClubs: Array<{ clubId: number; clubName: string }>;
    honours: ClubHonour[];
    opportunities: ClubOpportunity[]; // STRICT BINDING: Array instead of flat URLs
}

interface ClubMembershipContext {
    hasClubMembership: boolean;
    canCreateClub: boolean;
    clubId?: number | null;
    clubName?: string | null;
    myRole?: string | null;
}

type ClubTab = 'overview' | 'squads' | 'honours' | 'opportunities' | 'calendar';

export const ClubProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [club, setClub] = useState<ClubProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ClubTab>('overview');

    const [myClubId, setMyClubId] = useState<number | null>(null);
    const [myClubRole, setMyClubRole] = useState<string | null>(null);
    const [squadsRefreshKey, setSquadsRefreshKey] = useState(0);

    // Management & Modal States
    const [isManageClubOpen, setIsManageClubOpen] = useState(false);
    const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

    const fetchClubData = async () => {
        try {
            const response = await apiClient.get(`/clubs/${id}`);
            setClub(response.data);
        } catch (error) {
            console.error("Failed to fetch club", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserContext = async () => {
        try {
            const membershipResponse = await apiClient.get<ClubMembershipContext>('/clubs/my-membership-context').catch(() => ({ data: null }));

            if (membershipResponse.data?.clubId) {
                setMyClubId(membershipResponse.data.clubId);
                setMyClubRole(membershipResponse.data.myRole ?? null);
            } else {
                setMyClubId(null);
                setMyClubRole(null);
            }
        } catch (error) {
            console.error("Failed to fetch user context", error);
        }
    };

    useEffect(() => {
        if (id) {
            fetchClubData();
            fetchUserContext();
        }
    }, [id]);

    const adminRoles = new Set(['OWNER', 'CLUB_ADMIN']);
    const managementRoles = new Set(['OWNER', 'CLUB_ADMIN', 'COACH']);
    const ownClubRole = club?.myRole;
    const isOwnClubAdmin = Boolean(ownClubRole && adminRoles.has(ownClubRole));
    const canManageOwnClub = Boolean(ownClubRole && managementRoles.has(ownClubRole));
    const canChallengeOtherClub = Boolean(
        myClubId &&
        myClubId !== Number(id) &&
        myClubRole &&
        adminRoles.has(myClubRole)
    );
    const canOpenCalendar = isOwnClubAdmin;
    const communicationOptions = buildClubCommunicationOptions(
        club?.whatsappNumber,
        club?.facebookMessengerUrl,
        club?.preferredCommunicationMethod
    );
    const canMessageClub = Boolean(!club?.isMember && communicationOptions.length > 0);

    const handleFollowToggle = async () => {
        try {
            await apiClient.post(`/clubs/${id}/follow`);
            fetchClubData();
        } catch (error) {
            console.error("Failed to toggle follow", error);
        }
    };

    const handleChallengeSubmit = async (inviteData: any) => {
        try {
            await apiClient.post(`/clubs/${id}/challenge`, inviteData);
            setIsChallengeModalOpen(false);
        } catch (error) {
            console.error("Failed to send challenge", error);
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

    if (loading) {
        return (
            <div className="theme-page flex-1 flex items-center justify-center min-h-screen">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!club) {
        return (
            <div className="theme-page flex-1 flex flex-col items-center justify-center min-h-screen text-slate-500">
                <ShieldCheck className="w-16 h-16 mb-4 opacity-50 text-emerald-500/50" />
                <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 dark:text-white">Club Not Found</h2>
                <button onClick={() => navigate(-1)} className="mt-4 text-emerald-600 hover:text-emerald-500 font-bold text-sm uppercase">Go Back</button>
            </div>
        );
    }

    return (
        <div className="theme-page flex-1 overflow-y-auto min-h-screen">

            <ClubHero
                club={club}
                canEditClubAssets={isOwnClubAdmin}
                canManageClub={canManageOwnClub}
                canOpenCalendar={canOpenCalendar}
                canChallengeClub={canChallengeOtherClub}
                canMessageClub={canMessageClub}
                onFollowToggle={handleFollowToggle}
                onOpenCalendar={() => setActiveTab('calendar')}
                onOpenManageClub={() => setIsManageClubOpen(true)}
                onOpenChallengeModal={() => setIsChallengeModalOpen(true)}
                onOpenMessage={handleOpenMessage}
                onRefresh={fetchClubData}
            />

            <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-8 py-8 flex flex-col lg:flex-row gap-6 lg:gap-8">
                <div className="w-full lg:w-[280px] xl:w-[320px] shrink-0">
                    <ClubSidebar
                        activeTab={activeTab}
                        setActiveTab={(tab) => setActiveTab(tab as ClubTab)}
                        club={club}
                        canManageClub={canManageOwnClub}
                        onOpenNotifications={canManageOwnClub
                            ? () => navigate(`/notifications?${createNotificationSearch('club', club.id, club.name)}`)
                            : undefined}
                    />
                </div>

                <div className="flex-1 min-w-0">
                    {activeTab === 'overview' && (
                        <TabOverview
                            club={club}
                            isOwnClubAdmin={isOwnClubAdmin}
                            onOpenTab={(tab) => setActiveTab(tab)}
                        />
                    )}

                    {activeTab === 'squads' && (
                        <TabTeams clubId={club.id} refreshKey={squadsRefreshKey} />
                    )}

                    {activeTab === 'honours' && (
                        <TabHonours club={club} />
                    )}

                    {activeTab === 'opportunities' && (
                        <TabOpportunities club={club} isOwnClubAdmin={isOwnClubAdmin} />
                    )}

                    {activeTab === 'calendar' && (
                        <TabCalendar clubId={club.id} isOwnClubAdmin={isOwnClubAdmin} />
                    )}

                </div>

                <div className="w-full lg:w-[300px] xl:w-[320px] shrink-0">
                    <ClubOpportunities
                        club={club}
                        onOpenModule={() => setActiveTab('opportunities')}
                        showOpportunityBoard={!['overview', 'opportunities'].includes(activeTab)}
                    />
                </div>
            </div>

            {isChallengeModalOpen && (
                <MatchInviteModal
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
                    onClose={() => setIsManageClubOpen(false)}
                    onSquadCreated={() => setSquadsRefreshKey((current) => current + 1)}
                />
            )}

            {isMessageModalOpen && (
                <ClubMessageModal
                    clubName={club.name}
                    options={communicationOptions}
                    onClose={() => setIsMessageModalOpen(false)}
                />
            )}
        </div>
    );
};
