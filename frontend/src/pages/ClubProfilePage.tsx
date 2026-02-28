import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { ShieldCheck, MapPin, ArrowLeft, Heart, MessageCircle, Share2, MoreHorizontal, Check, Plus } from 'lucide-react';

interface ClubProfile {
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
}

// Reusing your FeedPostDto type
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

export const ClubProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [club, setClub] = useState<ClubProfile | null>(null);
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'squad'>('posts');

    useEffect(() => {
        // Fetch both the Profile details AND the Club's posts in parallel
        Promise.all([
            apiClient.get(`/clubs/${id}`),
            apiClient.get(`/feed/club/${id}`)
        ])
            .then(([clubRes, postsRes]) => {
                setClub(clubRes.data);
                setPosts(postsRes.data.posts);
            })
            .catch(err => console.error("Failed to load profile data", err))
            .finally(() => setLoading(false));
    }, [id]);

    const handleFollowToggle = async () => {
        if (!club) return;
        const prev = club.isFollowedByMe;
        const prevCount = club.followerCount;
        setClub({ ...club, isFollowedByMe: !prev, followerCount: prev ? prevCount - 1 : prevCount + 1 });

        try {
            await apiClient.post(`/clubs/${club.id}/follow`);
        } catch {
            setClub({ ...club, isFollowedByMe: prev, followerCount: prevCount });
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-500 animate-pulse">Loading club profile...</div>;
    if (!club) return <div className="p-10 text-center font-bold text-xl dark:text-white">Club not found</div>;

    const clubInitials = club.name.substring(0, 2).toUpperCase();

    return (
        <div className="max-w-4xl mx-auto pb-24">

            {/* Back Button */}
            <div className="py-4">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-semibold transition-colors">
                    <ArrowLeft className="w-5 h-5" /> Back
                </button>
            </div>

            {/* MAIN HEADER CARD (LinkedIn Style) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6 transition-colors">
                {/* Banner Photo */}
                <div className="h-40 bg-slate-800 dark:bg-slate-900 relative">
                    <img src={`https://images.unsplash.com/photo-1518605368461-1ee71161d91a?auto=format&fit=crop&q=80&w=1000&h=300`} alt="banner" className="w-full h-full object-cover opacity-60" />
                </div>

                {/* Profile Info Section */}
                <div className="px-6 pb-6 relative">
                    {/* Floating Avatar */}
                    <div className="absolute -top-16 w-32 h-32 bg-white dark:bg-gray-800 rounded-xl border-4 border-white dark:border-gray-800 shadow-lg flex items-center justify-center text-4xl font-extrabold text-blue-600 dark:text-blue-400">
                        {clubInitials}
                    </div>

                    {/* Action Buttons (Right Aligned) */}
                    <div className="flex justify-end pt-4 gap-3">
                        <button className="px-5 py-1.5 font-bold text-blue-600 dark:text-blue-400 border-2 border-blue-600 dark:border-blue-400 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                            Apply
                        </button>
                        <button
                            onClick={handleFollowToggle}
                            className={`px-5 py-1.5 font-bold rounded-full border-2 transition-colors flex items-center gap-1 ${
                                club.isFollowedByMe
                                    ? "bg-gray-100 dark:bg-gray-700 border-transparent text-gray-700 dark:text-gray-300"
                                    : "bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700"
                            }`}
                        >
                            {club.isFollowedByMe ? <><Check className="w-4 h-4"/> Following</> : <><Plus className="w-4 h-4"/> Follow</>}
                        </button>
                    </div>

                    {/* Club Details */}
                    <div className="mt-2">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {club.name} {club.isOfficial && <ShieldCheck className="text-blue-500 w-6 h-6" />}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 font-medium text-sm mt-1">{club.type} Sports Organization</p>

                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-3">
                            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {club.addressText || "Georgia"}</span>
                            <span>•</span>
                            <span className="font-bold text-gray-900 dark:text-white">{club.followerCount} <span className="font-normal text-gray-500 dark:text-gray-400">followers</span></span>
                            <span>•</span>
                            <span className="font-bold text-gray-900 dark:text-white">{club.memberCount} <span className="font-normal text-gray-500 dark:text-gray-400">squad members</span></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABS (LinkedIn Style) */}
            <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
                {['posts', 'about', 'squad'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-6 py-3 font-semibold capitalize transition-all border-b-2 ${
                            activeTab === tab
                                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                        } rounded-t-lg`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT */}
            <div>
                {/* POSTS TAB */}
                {activeTab === 'posts' && (
                    <div className="flex flex-col gap-5">
                        {posts.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 p-10 text-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-medium">
                                No posts to display yet.
                            </div>
                        ) : (
                            posts.map(post => (
                                <div key={post.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
                                    <div className="p-4 flex justify-between items-start">
                                        <div className="flex gap-3 items-center">
                                            <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm bg-blue-600 text-white shadow-inner">
                                                {clubInitials}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white text-lg">{post.clubName || post.authorName}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                                                    {new Date(post.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                            <MoreHorizontal className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="px-4 pb-3">
                                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-line leading-relaxed">
                                            {post.content}
                                        </p>
                                    </div>
                                    <div className="px-2 py-1 border-t border-gray-100 dark:border-gray-700 flex justify-between">
                                        <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                            <Heart className="w-5 h-5" /> Like
                                        </button>
                                        <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                            <MessageCircle className="w-5 h-5" /> Comment
                                        </button>
                                        <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                            <Share2 className="w-5 h-5" /> Share
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ABOUT TAB */}
                {activeTab === 'about' && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Overview</h3>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                            {club.description || "No description provided."}
                        </p>
                    </div>
                )}

                {/* SQUAD TAB */}
                {activeTab === 'squad' && (
                    <div className="bg-white dark:bg-gray-800 p-10 text-center rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
                        <p className="font-bold text-gray-900 dark:text-white">Active Squad Roster</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Player cards coming soon!</p>
                    </div>
                )}
            </div>
        </div>
    );
};