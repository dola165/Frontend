import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, MapPin, Users, Check, Plus } from 'lucide-react';
import {apiClient} from "../api/axiosConfig.ts";

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
}

export const BrowseClubsPage = () => {
    const [clubs, setClubs] = useState<ClubProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get<ClubProfile[]>('/clubs')
            .then(res => setClubs(res.data))
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

    if (loading) return <div className="p-10 text-center text-gray-500 animate-pulse">Loading directory...</div>;

    return (
        <div className="w-full pb-24">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Browse Clubs</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Discover local teams, academies, and semi-pro organizations.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {clubs.map(club => (
                    <Link
                        to={`/clubs/${club.id}`}
                        key={club.id}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all group"
                    >
                        {/* Card Banner */}
                        <div className="h-16 bg-slate-800 dark:bg-slate-900 relative">
                            <img src={`https://images.unsplash.com/photo-1518605368461-1ee71161d91a?auto=format&fit=crop&q=80&w=600&h=150`} alt="banner" className="w-full h-full object-cover opacity-50" />
                        </div>

                        <div className="p-5 pt-0 relative">
                            {/* Floating Avatar & Follow Button Row */}
                            <div className="flex justify-between items-end mb-3">
                                <div className="w-16 h-16 -mt-8 bg-white dark:bg-gray-800 rounded-xl border-4 border-white dark:border-gray-800 shadow-md flex items-center justify-center text-xl font-extrabold text-blue-600 dark:text-blue-400 relative z-10">
                                    {club.name.substring(0, 2).toUpperCase()}
                                </div>
                                <button
                                    onClick={(e) => handleFollowToggle(e, club.id)}
                                    className={`px-4 py-1.5 font-bold rounded-full border-2 text-sm transition-colors flex items-center gap-1 ${
                                        club.isFollowedByMe
                                            ? "bg-gray-100 dark:bg-gray-700 border-transparent text-gray-700 dark:text-gray-300"
                                            : "bg-white dark:bg-gray-800 border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                    }`}
                                >
                                    {club.isFollowedByMe ? <><Check className="w-3.5 h-3.5"/> Following</> : <><Plus className="w-3.5 h-3.5"/> Follow</>}
                                </button>
                            </div>

                            {/* Info */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1.5 group-hover:text-blue-600 transition-colors">
                                    {club.name} {club.isOfficial && <ShieldCheck className="text-blue-500 w-5 h-5" />}
                                </h3>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">{club.type}</p>
                            </div>

                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 line-clamp-2 leading-relaxed">
                                {club.description}
                            </p>

                            {/* Footer Stats */}
                            <div className="flex items-center gap-4 mt-5 text-xs text-gray-500 dark:text-gray-400 font-medium">
                                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {club.addressText?.split(',')[0] || "Tbilisi"}</span>
                                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {club.followerCount} followers</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};