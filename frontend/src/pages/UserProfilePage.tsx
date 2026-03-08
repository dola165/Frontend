import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import {
    MapPin, PlaySquare, Edit, Ruler, Weight,
    Heart, MessageCircle, Share2, MoreHorizontal,
    Briefcase, ShieldCheck, Zap, ArrowLeft, CheckCircle2, Activity
} from 'lucide-react';

interface CareerHistoryDto {
    id: number;
    clubName: string;
    season: string;
    category: string;
    appearances: number;
    goals: number;
    assists: number;
    cleanSheets: number;
}

interface UserProfile {
    id: number;
    username: string;
    fullName: string;
    position: string;
    preferredFoot: string;
    bio: string;
    availabilityStatus: string;
    heightCm: number;
    weightKg: number;
    followerCount: number;
    followingCount: number;
    isFollowedByMe: boolean;
    careerHistory: CareerHistoryDto[];
}

interface FeedPostDto {
    id: number;
    content: string;
    createdAt: string;
    authorName: string;
    clubId: number | null;
    clubName: string | null;
    likeCount: number;
    commentCount: number;
    isLikedByMe: boolean;
}

const userBannerImages = [
    "1518605368461-1ee71161d91a",
    "1574629810360-7efbb6b6923f",
    "1522778119026-d108dc1a0a52",
    "1508098682722-e99c43a406b2",
    "1431324155629-1a610d6e60d5"
];

export const UserProfilePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'timeline' | 'stats' | 'intel'>('timeline');

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);

    // In a real app, you'd check if `profile.id === currentUser.id`
    const isMyProfile = true;

    useEffect(() => {
        // Fetch Real Data from your Backend
        Promise.all([
            apiClient.get(`/users/${id}`),
            apiClient.get(`/feed/user/${id}`)
        ])
            .then(([profileRes, postsRes]) => {
                setProfile(profileRes.data);
                setPosts(postsRes.data.posts);
            })
            .catch(err => {
                console.error("Failed to load user data", err);
                // Fallback mock data if DB is empty for testing UI
                if (!profile) {
                    setProfile({
                        id: Number(id), username: 'react_dev', fullName: 'Beqa Dolidze',
                        position: 'CDM / CB', preferredFoot: 'Right',
                        bio: "Passionate defensive mid looking for a semi-pro club in the Tbilisi area. Strong tackler, great vision.",
                        availabilityStatus: 'FREE_AGENT', heightCm: 185, weightKg: 78,
                        followerCount: 239, followingCount: 45, isFollowedByMe: false,
                        careerHistory: [
                            { id: 1, clubName: 'Experimentuli', season: '2024/25', category: 'First Team', appearances: 14, goals: 2, assists: 5, cleanSheets: 0 },
                            { id: 2, clubName: 'FC Rustavi Academy', season: '2023/24', category: 'U18', appearances: 22, goals: 8, assists: 3, cleanSheets: 0 }
                        ]
                    });
                }
            })
            .finally(() => setLoading(false));
    }, [id]);

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'FREE_AGENT': return <span className="bg-emerald-500 text-slate-900 px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border border-transparent">Free Agent</span>;
            case 'OPEN_TO_OFFERS': return <span className="bg-orange-500 text-slate-900 px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border border-transparent">Open To Offers</span>;
            case 'IN_CLUB': return <span className="bg-slate-700 text-white px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border border-slate-600">In Club</span>;
            case 'TRIALING': return <span className="bg-blue-500 text-white px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border border-blue-600">On Trial</span>;
            default: return null;
        }
    };

    if (loading || !profile) return <div className="p-10 text-center font-bold text-slate-500 uppercase tracking-widest animate-pulse h-screen bg-[#0f172a]">Accessing Dossier...</div>;
    profile.fullName.substring(0, 2).toUpperCase();
    const randomBannerId = userBannerImages[Number(id || 0) % userBannerImages.length];
    const bannerUrl = `https://images.unsplash.com/photo-${randomBannerId}?auto=format&fit=crop&q=80&w=1200&h=400`;

    return (
        <div className="w-full min-h-screen bg-[#0f172a] pb-20 font-sans text-slate-300">

            {/* === HEADER SECTION === */}
            <div className="bg-white dark:bg-[#1e293b] rounded-b-sm border-b-2 border-x-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] overflow-hidden mb-8">

                <div className="h-48 relative bg-slate-900 border-b-2 border-slate-800">
                    <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 transition-all duration-700" />
                </div>

                <div className="px-6 pb-6 relative">
                    <button onClick={() => navigate(-1)} className="absolute top-4 left-4 bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white px-3 py-1.5 rounded-sm border-2 border-slate-300 dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[2px_2px_0px_0px_#020617] font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:-translate-y-0.5 transition-all">
                        <ArrowLeft className="w-3.5 h-3.5 text-emerald-500" /> Back
                    </button>

                    <div className="max-w-5xl mx-auto px-4 sm:px-0">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">

                            {/* Avatar & Title */}
                            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-16 md:-mt-12 relative z-10">
                                <div className="relative group">
                                    <div className="w-32 h-32 md:w-36 md:h-36 rounded-sm border-4 border-white dark:border-[#1e293b] bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-4xl font-black text-slate-700 dark:text-slate-300 shadow-sm overflow-hidden">
                                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile.fullName)}&background=f97316&color=fff&bold=true&size=200`} alt={profile.fullName} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="absolute -bottom-3 -right-3 bg-emerald-500 text-white p-2 rounded-sm shadow-sm border-2 border-white dark:border-[#1e293b]">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                </div>

                                <div className="text-center md:text-left mb-2 md:mb-4">
                                    <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                                        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                            {profile.fullName}
                                        </h1>
                                        {getStatusBadge(profile.availabilityStatus)}
                                    </div>
                                    <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">
                                        {profile.followerCount} Network • <span className="text-emerald-600 dark:text-emerald-500">{profile.position}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2 mb-2 md:mb-4 w-full md:w-auto justify-center md:justify-end">
                                {isMyProfile ? (
                                    <>
                                        <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-sm font-bold uppercase text-xs tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[2px_2px_0px_0px_#020617] flex items-center justify-center gap-2 border border-transparent active:translate-y-0.5 active:shadow-none transition-all">
                                            <PlaySquare className="w-4 h-4" /> Highlight
                                        </button>
                                        <button className="bg-slate-100 dark:bg-[#0f172a] hover:bg-slate-200 dark:hover:bg-slate-900 text-slate-900 dark:text-white px-5 py-2 rounded-sm font-bold uppercase text-xs tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[2px_2px_0px_0px_#020617] border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 active:translate-y-0.5 active:shadow-none transition-all">
                                            <Edit className="w-4 h-4 text-emerald-500" /> Edit Profile
                                        </button>
                                    </>
                                ) : (
                                    <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-2 rounded-sm font-bold uppercase text-xs tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[2px_2px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all">
                                        Contact Agent
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex gap-1 overflow-x-auto no-scrollbar mt-6 border-t border-slate-200 dark:border-slate-800 pt-2">
                            {['timeline', 'stats', 'intel'].map((tab) => (
                                <button key={tab} onClick={() => setActiveTab(tab as any)}
                                        className={`px-6 py-3 font-bold text-xs uppercase tracking-widest transition-colors rounded-t-sm ${
                                            activeTab === tab ? "text-emerald-600 dark:text-emerald-400 bg-slate-50 dark:bg-slate-800/50 border-b-2 border-emerald-500" : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                        }`}>
                                    {tab === 'timeline' ? 'Match Feed' : tab === 'stats' ? 'Career Stats' : 'Dossier'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* === MAIN CONTENT === */}
            <div className="max-w-5xl mx-auto px-4 sm:px-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* LEFT COLUMN: Physical Metrics & Intel (4 Cols) */}
                    <div className="lg:col-span-4 flex flex-col gap-6">

                        {/* Physical Metrics Grid */}
                        <div className="bg-white dark:bg-[#1e293b] rounded-sm p-5 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                            <h2 className="text-slate-900 dark:text-white font-black uppercase tracking-widest text-xs mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-500" /> Physical Profile
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Ruler className="w-3 h-3"/> Height</p>
                                    <p className="font-black text-slate-900 dark:text-white text-lg mt-0.5">{profile.heightCm ? `${profile.heightCm} cm` : 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Weight className="w-3 h-3"/> Weight</p>
                                    <p className="font-black text-slate-900 dark:text-white text-lg mt-0.5">{profile.weightKg ? `${profile.weightKg} kg` : 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Zap className="w-3 h-3"/> Strong Foot</p>
                                    <p className="font-black text-slate-900 dark:text-white text-lg mt-0.5">{profile.preferredFoot || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><MapPin className="w-3 h-3"/> Region</p>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm mt-1 truncate">Tbilisi, GE</p>
                                </div>
                            </div>
                        </div>

                        {/* Player Manifesto */}
                        <div className="bg-white dark:bg-[#1e293b] rounded-sm p-5 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                            <h2 className="text-slate-900 dark:text-white font-black uppercase tracking-widest text-xs mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-emerald-500" /> Player Manifesto
                            </h2>
                            <div className="bg-slate-50 dark:bg-[#0f172a] p-3 rounded-sm border border-slate-200 dark:border-slate-800 shadow-inner mb-4">
                                <p className="text-slate-700 dark:text-slate-300 font-medium italic leading-relaxed text-xs">
                                    "{profile.bio || "No manifesto provided."}"
                                </p>
                            </div>
                            {isMyProfile && (
                                <button className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold uppercase text-[10px] tracking-widest py-2 rounded-sm border border-slate-300 dark:border-slate-600 transition-colors">
                                    Update Manifesto
                                </button>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Dynamic Content (8 Cols) */}
                    <div className="lg:col-span-8 flex flex-col gap-6">

                        {activeTab === 'timeline' && (
                            <>
                                {posts.length === 0 ? (
                                    <div className="bg-white dark:bg-[#1e293b] rounded-sm p-10 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] text-center flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm flex items-center justify-center mb-4 text-slate-400">
                                            <PlaySquare className="w-6 h-6" />
                                        </div>
                                        <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-wide mb-1">No Match Footage</h3>
                                        <p className="text-slate-500 font-medium text-xs max-w-sm">
                                            When clubs tag this player in match highlights, they will automatically appear here on their timeline.
                                        </p>
                                    </div>
                                ) : (
                                    posts.map(post => (
                                        <div key={post.id} className="bg-white dark:bg-[#1e293b] rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
                                            <div className="p-4 flex justify-between items-start border-b border-slate-100 dark:border-slate-800/50">
                                                <div className="flex gap-3 items-center">
                                                    <div className="w-10 h-10 rounded-sm bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-xs border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                                                        {post.authorName.substring(0,2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold uppercase tracking-wide text-slate-900 dark:text-white text-sm">
                                                            {post.authorName}
                                                            {post.clubName && <span className="text-slate-500"> via {post.clubName}</span>}
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                                            {formatTime(post.createdAt)} • <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="p-5">
                                                <p className="text-slate-800 dark:text-slate-300 whitespace-pre-line leading-relaxed text-sm font-medium">
                                                    {post.content}
                                                </p>
                                            </div>
                                            <div className="flex border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827]">
                                                <button className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors border-r border-slate-200 dark:border-slate-800 ${post.isLikedByMe ? "text-orange-500" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                                                    <Heart className="w-3.5 h-3.5" fill={post.isLikedByMe ? "currentColor" : "none"} /> {post.likeCount || "Like"}
                                                </button>
                                                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-800">
                                                    <MessageCircle className="w-3.5 h-3.5" /> {post.commentCount || "Comment"}
                                                </button>
                                                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                    <Share2 className="w-3.5 h-3.5" /> Share
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </>
                        )}

                        {/* --- NEW: SCOUTING STATS TABLE --- */}
                        {activeTab === 'stats' && (
                            <div className="bg-white dark:bg-[#1e293b] rounded-sm p-1 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] overflow-x-auto">
                                <table className="w-full text-left border-collapse whitespace-nowrap">
                                    <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-900 text-slate-500 text-[10px] uppercase tracking-widest font-black">
                                        <th className="p-3 border-b-2 border-slate-200 dark:border-slate-800">Season</th>
                                        <th className="p-3 border-b-2 border-slate-200 dark:border-slate-800">Squad / Club</th>
                                        <th className="p-3 border-b-2 border-slate-200 dark:border-slate-800">Level</th>
                                        <th className="p-3 border-b-2 border-slate-200 dark:border-slate-800 text-center">Apps</th>
                                        <th className="p-3 border-b-2 border-slate-200 dark:border-slate-800 text-center">G</th>
                                        <th className="p-3 border-b-2 border-slate-200 dark:border-slate-800 text-center">A</th>
                                        <th className="p-3 border-b-2 border-slate-200 dark:border-slate-800 text-center">CS</th>
                                    </tr>
                                    </thead>
                                    <tbody className="text-sm font-bold text-slate-800 dark:text-slate-300">
                                    {profile.careerHistory && profile.careerHistory.length > 0 ? (
                                        profile.careerHistory.map((season, idx) => (
                                            <tr key={season.id} className={`border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-[#1e293b]' : 'bg-slate-50/50 dark:bg-[#0f172a]/30'}`}>
                                                <td className="p-3 text-slate-500 font-black">{season.season}</td>
                                                <td className="p-3 flex items-center gap-2">
                                                    <ShieldCheck className="w-4 h-4 text-emerald-500" /> {season.clubName}
                                                </td>
                                                <td className="p-3 text-[10px] tracking-widest uppercase text-slate-500">{season.category}</td>
                                                <td className="p-3 text-center">{season.appearances}</td>
                                                <td className="p-3 text-center text-emerald-600 dark:text-emerald-400">{season.goals}</td>
                                                <td className="p-3 text-center text-blue-500">{season.assists}</td>
                                                <td className="p-3 text-center text-slate-400">{season.cleanSheets > 0 ? season.cleanSheets : '-'}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-slate-500 text-xs font-medium uppercase tracking-widest">
                                                No career history documented.
                                            </td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'intel' && (
                            <div className="bg-white dark:bg-[#1e293b] rounded-sm p-10 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] text-center text-slate-500 font-bold uppercase tracking-widest text-sm">
                                Full Scouting Dossier Restricted.
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};