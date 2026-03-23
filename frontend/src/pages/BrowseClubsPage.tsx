import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, MapPin, Users, Check, Plus, Building2 } from 'lucide-react';
import { apiClient } from "../api/axiosConfig.ts";
import { resolveMediaUrl } from "../utils/resolveMediaUrl.ts";
import { CreateClubModal } from '../components/club/CreateClubModal.tsx';

interface ClubProfile {
    id: number;
    name: string;
    description: string;
    type: string;
    isOfficial: boolean;
    followerCount: number;
    memberCount: number;
    isFollowedByMe: boolean;
    addressText?: string;
    logoUrl?: string;
    bannerUrl?: string;
}

interface ClubMembershipContext {
    hasClubMembership: boolean;
    canCreateClub: boolean;
    clubId?: number | null;
    clubName?: string | null;
    myRole?: string | null;
}

export const BrowseClubsPage = () => {
    const navigate = useNavigate();
    const [clubs, setClubs] = useState<ClubProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [membershipContext, setMembershipContext] = useState<ClubMembershipContext | null>(null);
    const [isCreateClubOpen, setIsCreateClubOpen] = useState(false);

    useEffect(() => {
        Promise.all([
            apiClient.get<ClubProfile[]>('/clubs'),
            apiClient.get<ClubMembershipContext>('/clubs/my-membership-context')
        ])
            .then(([clubsResponse, membershipResponse]) => {
                setClubs(clubsResponse.data);
                setMembershipContext(membershipResponse.data);
            })
            .catch(err => console.error("Failed to load clubs", err))
            .finally(() => setLoading(false));
    }, []);

    const handleFollowToggle = async (e: React.MouseEvent, clubId: number) => {
        e.preventDefault(); // Prevent navigating to the club page when clicking the follow button

        // Optimistic ui update
        setClubs(currentClubs => currentClubs.map(c => {
            if (c.id === clubId) {
                return { ...c, isFollowedByMe: !c.isFollowedByMe, followerCount: c.isFollowedByMe ? c.followerCount - 1 : c.followerCount + 1 };
            }
            return c;
        }));

        try {
            await apiClient.post(`/clubs/${clubId}/follow`);
        } catch {
            alert("Failed to toggle follow status");
            // Revert changes on error would go here for production
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-500 animate-pulse">Loading directory...</div>;

    return (
        <div className="w-full pb-24">
            <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Browse Clubs</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Discover local teams, academies, and semi-pro organizations.</p>
                </div>

                <div className="theme-surface theme-border rounded-2xl border px-5 py-4 shadow-sm dark:shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">My Club</p>
                            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                                {membershipContext?.clubName || 'Not attached yet'}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        {membershipContext?.canCreateClub && (
                            <button
                                onClick={() => setIsCreateClubOpen(true)}
                                className="rounded-xl border-2 border-slate-900 bg-emerald-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[4px_4px_0px_0px_#020617] transition-all hover:bg-emerald-500 active:translate-y-0.5 active:shadow-none"
                            >
                                Create Club
                            </button>
                        )}
                        {membershipContext?.clubId && (
                            <Link
                                to={`/clubs/${membershipContext.clubId}`}
                                className="theme-surface-muted theme-border rounded-xl border px-4 py-2.5 text-center text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
                            >
                                Open My Club
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {clubs.map(club => (
                    <Link
                        to={`/clubs/${club.id}`}
                        key={club.id}
                        className="bg-white dark:bg-[#151f28] rounded-xl shadow-sm border border-slate-300 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-all group"
                    >
                        {/* Card Banner */}
                        <div className="h-20 bg-[#121b22] relative overflow-hidden">
                            {resolveMediaUrl(club.bannerUrl) ? (
                                <img src={resolveMediaUrl(club.bannerUrl)} alt={`${club.name} banner`} className="w-full h-full object-cover opacity-65" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-r from-emerald-700/60 via-teal-700/50 to-sky-700/60" />
                            )}
                        </div>

                        <div className="p-5 pt-0 relative">
                            {/* Floating Avatar & Follow Button Row */}
                            <div className="flex justify-between items-end mb-3">
                                <div className="w-16 h-16 -mt-8 bg-white dark:bg-[#151f28] rounded-xl border-4 border-white dark:border-[#151f28] shadow-md flex items-center justify-center text-xl font-extrabold text-emerald-600 dark:text-emerald-400 relative z-10 overflow-hidden">
                                    {resolveMediaUrl(club.logoUrl) ? (
                                        <img src={resolveMediaUrl(club.logoUrl)} alt={`${club.name} logo`} className="w-full h-full object-cover" />
                                    ) : (
                                        club.name.substring(0, 2).toUpperCase()
                                    )}
                                </div>
                                <button
                                    onClick={(e) => handleFollowToggle(e, club.id)}
                                    className={`px-4 py-1.5 font-bold rounded-full border-2 text-sm transition-colors flex items-center gap-1 ${
                                        club.isFollowedByMe
                                            ? "bg-emerald-50 dark:bg-emerald-900/20 border-transparent text-emerald-700 dark:text-emerald-300"
                                            : "bg-white dark:bg-[#151f28] border-emerald-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                    }`}
                                >
                                    {club.isFollowedByMe ? <><Check className="w-3.5 h-3.5"/> Following</> : <><Plus className="w-3.5 h-3.5"/> Follow</>}
                                </button>
                            </div>

                            {/* Info */}
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5 group-hover:text-emerald-500 transition-colors">
                                    {club.name} {club.isOfficial && <ShieldCheck className="text-emerald-500 w-5 h-5" />}
                                </h3>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{club.type}</p>
                            </div>

                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 line-clamp-2 leading-relaxed">
                                {club.description}
                            </p>

                            {/* Footer Stats */}
                            <div className="flex items-center gap-4 mt-5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {club.addressText?.split(',')[0] || "Tbilisi"}</span>
                                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {club.followerCount} followers</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            <CreateClubModal
                isOpen={isCreateClubOpen}
                onClose={() => setIsCreateClubOpen(false)}
                onCreated={(clubId) => navigate(`/clubs/${clubId}`)}
            />
        </div>
    );
};
