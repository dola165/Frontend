import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Settings, X, UserPlus, SlidersHorizontal, Megaphone, Paintbrush, Network, Trash2, Users, ShieldCheck } from 'lucide-react';

import { ClubHero } from '../components/club/ClubHero';
import { ClubSidebar } from '../components/club/ClubSidebar';
import { ClubOpportunities } from '../components/club/ClubOpportunities';
import { MatchInviteModal } from '../components/club/MatchInviteModal';
import { PostComposer } from '../components/feed/PostComposer';
import {TabTeams} from "../components/club/tabs/TabTeams.tsx";
import {TabOurClub} from "../components/club/tabs/TabOurClub.tsx";

export interface ClubProfile {
    id: number;
    name: string;
    description: string;
    type: string;
    isOfficial: boolean;
    followerCount: number;
    memberCount: number;
    isFollowedByMe: boolean;
    isMember: boolean;
    addressText?: string;
    storeUrl?: string;
    gofundmeUrl?: string;
    logoUrl?: string;
    bannerUrl?: string;
    latitude?: number;
    longitude?: number;
}
interface ClubStaffDto { id: number; name: string; role: string; clearance: string; }

export const ClubProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [club, setClub] = useState<ClubProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('our-club');

    // Context States
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [myClubId, setMyClubId] = useState<number | null>(null);

    // Management & Modal States
    const [isManageOrgOpen, setIsManageOrgOpen] = useState(false);
    const [manageTab, setManageTab] = useState('general');
    const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
    const [staff, setStaff] = useState<ClubStaffDto[]>([]);

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

    // Grab exactly who you are and what club you manage directly from the DB
    const fetchUserContext = async () => {
        try {
            const [userRes, myClubRes] = await Promise.all([
                apiClient.get('/users/me').catch(() => ({ data: null })),
                apiClient.get('/clubs/my-club').catch(() => ({ data: null }))
            ]);

            if (userRes.data) setCurrentUser(userRes.data);
            if (myClubRes.data?.clubId) setMyClubId(myClubRes.data.clubId);
        } catch (error) {
            console.error("Failed to fetch user context", error);
        }
    };

    const fetchStaffData = async () => {
        if (!isOwnClubAdmin) return;
        try {
            const response = await apiClient.get(`/clubs/${id}/staff`);
            setStaff(response.data);
        } catch (error) {
            console.error("Failed to fetch staff", error);
        }
    };

    useEffect(() => {
        if (id) {
            fetchClubData();
            fetchUserContext();
        }
    }, [id]);

    // ======= BULLETPROOF ROLE EVALUATION =======
    const roleValue = currentUser?.role || currentUser?.systemRole;
    const isUserClubAdmin = roleValue === 'CLUB_ADMIN' || String(roleValue) === '3';

    // It's your club if the API says you're a member, OR if your global `my-club` lookup matches this ID.
    const isOwnClubAdmin = isUserClubAdmin && (club?.isMember === true || myClubId === Number(id));
    const isOtherClubAdmin = isUserClubAdmin && !isOwnClubAdmin;
    // ============================================

    useEffect(() => {
        if (isManageOrgOpen) fetchStaffData();
    }, [isManageOrgOpen, isOwnClubAdmin]);

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

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#fdfaf5] dark:bg-[#0a0f13] min-h-screen">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!club) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#fdfaf5] dark:bg-[#0a0f13] min-h-screen text-slate-500">
                <ShieldCheck className="w-16 h-16 mb-4 opacity-50 text-emerald-500/50" />
                <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 dark:text-white">Club Not Found</h2>
                <button onClick={() => navigate(-1)} className="mt-4 text-emerald-600 hover:text-emerald-500 font-bold text-sm uppercase">Go Back</button>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-[#fdfaf5] dark:bg-[#0a0f13] min-h-screen">

            <ClubHero
                club={club}
                isOwnClubAdmin={isOwnClubAdmin}
                isOtherClubAdmin={isOtherClubAdmin}
                onFollowToggle={handleFollowToggle}
                onOpenManageOrg={() => setIsManageOrgOpen(true)}
                onOpenChallengeModal={() => setIsChallengeModalOpen(true)}
                onRefresh={fetchClubData}
            />

            {/* WIDE FIGMA LAYOUT STRUCTURE */}
            <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-8 py-8 flex flex-col lg:flex-row gap-6 lg:gap-8">

                {/* Left Column: Sidebar Map & Nav */}
                <div className="w-full lg:w-[280px] xl:w-[320px] shrink-0">
                    <ClubSidebar activeTab={activeTab} setActiveTab={setActiveTab} club={club} />
                </div>

                {/* Center Column: Main Content Area */}
                <div className="flex-1 min-w-0">
                    {activeTab === 'our-club' && (
                        <div className="space-y-6">
                            {isOwnClubAdmin && (
                                <div className="mb-6">
                                    <PostComposer contextType="CLUB" contextId={club.id} onPostCreated={() => {
                                        setActiveTab('teams');
                                        setTimeout(() => setActiveTab('our-club'), 10);
                                    }} />
                                </div>
                            )}
                            <TabOurClub clubId={club.id} isOwnClubAdmin={isOwnClubAdmin} />
                        </div>
                    )}

                    {activeTab === 'teams' && (
                        <TabTeams clubId={club.id} />
                    )}

                    {['honours', 'training', 'calendar', 'store', 'media'].includes(activeTab) && (
                        <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center shadow-sm">
                            <Megaphone className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-4 mx-auto" />
                            <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-wide mb-1">Coming Soon</h3>
                            <p className="text-slate-500 font-medium text-sm">The {activeTab} section is currently under development.</p>
                        </div>
                    )}
                </div>

                {/* Right Column: Opportunities Panel */}
                <div className="w-full lg:w-[300px] xl:w-[320px] shrink-0">
                    <ClubOpportunities club={club} />
                </div>
            </div>

            {/* Match / Challenge Modal */}
            {isChallengeModalOpen && (
                <MatchInviteModal
                    targetClubName={club.name}
                    onClose={() => setIsChallengeModalOpen(false)}
                    onSubmit={handleChallengeSubmit}
                />
            )}

            {/* Full Manage Org Modal Array */}
            {isManageOrgOpen && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#0f172a] w-full max-w-5xl h-[80vh] rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-200">

                        {/* Manage Sidebar */}
                        <div className="w-full md:w-64 bg-slate-50 dark:bg-[#1e293b] border-r border-slate-200 dark:border-slate-800 shrink-0 flex flex-col">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-sm flex items-center gap-2"><Settings className="w-4 h-4 text-emerald-500" /> Manage Org</h2>
                                <button onClick={() => setIsManageOrgOpen(false)} className="md:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-2 flex-1 overflow-y-auto space-y-1">
                                {[
                                    { id: 'general', icon: SlidersHorizontal, label: 'General Info' },
                                    { id: 'customization', icon: Paintbrush, label: 'Customization' },
                                    { id: 'socials', icon: Network, label: 'Social Links' },
                                    { id: 'personnel', icon: Users, label: 'Personnel Access' },
                                    { id: 'opportunities', icon: Megaphone, label: 'Opportunities' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setManageTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-bold uppercase tracking-wide transition-colors ${manageTab === tab.id ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                                    >
                                        <tab.icon className="w-4 h-4" /> {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Manage Content Display */}
                        <div className="flex-1 bg-white dark:bg-[#0f172a] overflow-y-auto relative">
                            <button onClick={() => setIsManageOrgOpen(false)} className="hidden md:flex absolute top-4 right-4 w-8 h-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors z-10"><X className="w-4 h-4" /></button>

                            {manageTab === 'personnel' && (
                                <div className="p-6 md:p-8 animate-in fade-in duration-300">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Personnel Access</h3>
                                            <p className="text-sm text-slate-500 font-medium mt-1">Manage staff roles and security clearance.</p>
                                        </div>
                                        <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest shadow-sm transition-all"><UserPlus className="w-3 h-3" /> Add Staff</button>
                                    </div>

                                    <div className="space-y-3">
                                        {staff.length === 0 ? (
                                            <div className="text-center py-8 text-slate-500 text-sm font-medium border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">No staff members found.</div>
                                        ) : (
                                            staff.map(staffMember => (
                                                <div key={staffMember.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg group hover:border-emerald-500/50 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-[#0f172a] flex items-center justify-center font-black text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700">{staffMember.name.charAt(0)}</div>
                                                        <div><p className="font-bold text-slate-900 dark:text-white text-sm">{staffMember.name}</p><p className="text-emerald-600 dark:text-emerald-500 text-[10px] font-bold uppercase tracking-widest">{staffMember.role}</p></div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <span className="px-3 py-1 bg-slate-200 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">{staffMember.clearance}</span>
                                                        <button className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {manageTab !== 'personnel' && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                                    <Settings className="w-12 h-12 mb-4 opacity-50 text-emerald-500/50" />
                                    <h3 className="text-lg font-black uppercase tracking-widest text-slate-400">Module Initializing</h3>
                                    <p className="text-sm font-medium mt-2">The {manageTab} configuration interface is currently under construction.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};