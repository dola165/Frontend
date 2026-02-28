import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import {
    ArrowLeft, MapPin, Briefcase, Footprints, Info,
    UserPlus, UserCheck, MessageSquare, Share2, MoreHorizontal,
    Heart, MessageCircle, Calendar
} from 'lucide-react';

interface PublicUserProfileDto {
    id: number;
    username: string;
    fullName: string;
    position: string;
    preferredFoot: string;
    bio: string;
    followerCount: number;
    followingCount: number;
    isFollowedByMe: boolean;
}

interface FeedPostDto {
    id: number;
    content: string;
    createdAt: string;
    authorId: number;
    authorName: string;
    clubId: number | null;
    clubName: string | null;
    likeCount: number;
    commentCount: number;
    isLikedByMe: boolean;
}

export const UserProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [user, setUser] = useState<PublicUserProfileDto | null>(null);
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'posts' | 'media' | 'achievements'>('posts');

    useEffect(() => {
        setLoading(true);
        // Parallel fetch for Profile + User's specific posts
        Promise.all([
            apiClient.get(`/users/${id}`),
            apiClient.get(`/feed/user/${id}`)
        ])
            .then(([userRes, postsRes]) => {
                setUser(userRes.data);
                setPosts(postsRes.data.posts || []);
            })
            .catch(err => {
                console.error("Failed to load user profile", err);
            })
            .finally(() => setLoading(false));
    }, [id]);

    const handleFollowToggle = async () => {
        if (!user) return;
        const prevFollowed = user.isFollowedByMe;
        const prevCount = user.followerCount;

        // Optimistic update
        setUser({
            ...user,
            isFollowedByMe: !prevFollowed,
            followerCount: prevFollowed ? prevCount - 1 : prevCount + 1
        });

        try {
            await apiClient.post(`/users/${user.id}/follow`);
        } catch (err) {
            // Revert on error
            setUser({
                ...user,
                isFollowedByMe: prevFollowed,
                followerCount: prevCount
            });
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Loading player profile...</p>
        </div>
    );

    if (!user) return (
        <div className="p-10 text-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">User not found</h2>
            <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 font-bold hover:underline">Go Back</button>
        </div>
    );
    
    const userInitials = user.fullName ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : user.username.substring(0, 2).toUpperCase();

    return (
        <div className="max-w-4xl mx-auto pb-24 px-4">
            {/* Header / Back Button */}
            <div className="py-4 flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="flex gap-2">
                   <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                   </button>
                   <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <MoreHorizontal className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                   </button>
                </div>
            </div>

            {/* Profile Card */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl shadow-blue-500/5 overflow-hidden border border-gray-100 dark:border-gray-700 transition-colors">
                {/* Visual Header / Banner Area */}
                <div className="h-48 bg-gradient-to-br from-indigo-500 via-blue-600 to-violet-700 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl"></div>
                </div>

                <div className="px-8 pb-10">
                    <div className="relative flex justify-between items-end -mt-16 mb-8">
                        {/* Avatar */}
                        <div className="w-32 h-32 rounded-[2rem] bg-white dark:bg-gray-800 p-2 shadow-2xl">
                            <div className="w-full h-full rounded-[1.5rem] bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-4xl font-black text-blue-600 dark:text-blue-400 shadow-inner">
                                {userInitials}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 mb-2">
                            <button
                                onClick={handleFollowToggle}
                                className={`px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95 flex items-center gap-2 ${
                                    user.isFollowedByMe
                                        ? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                                        : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
                            >
                                {user.isFollowedByMe ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
                            </button>
                            <button className="p-3.5 rounded-2xl bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all shadow-md hover:shadow-lg active:scale-95">
                                <MessageSquare className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Name & Bio */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{user.fullName || user.username}</h1>
                            <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase rounded-full shadow-sm">Player</span>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 font-bold text-lg">@{user.username}</p>
                    </div>

                    {user.bio && (
                        <div className="mt-6 p-5 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border border-gray-100/50 dark:border-gray-700/30">
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium italic">
                                "{user.bio}"
                            </p>
                        </div>
                    )}

                    {/* Attributes Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                        <div className="group flex items-center gap-4 p-4 rounded-[1.5rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                <Briefcase className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">Position</p>
                                <p className="text-base font-black text-gray-800 dark:text-gray-200">{user.position || 'Unknown'}</p>
                            </div>
                        </div>

                        <div className="group flex items-center gap-4 p-4 rounded-[1.5rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                                <Footprints className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">Strong Foot</p>
                                <p className="text-base font-black text-gray-800 dark:text-gray-200">{user.preferredFoot || 'Both'}</p>
                            </div>
                        </div>

                        <div className="group flex items-center gap-4 p-4 rounded-[1.5rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">Location</p>
                                <p className="text-base font-black text-gray-800 dark:text-gray-200">Tbilisi, GE</p>
                            </div>
                        </div>
                    </div>

                    {/* Stats Bar */}
                    <div className="flex justify-around sm:justify-start sm:gap-16 mt-10 pt-8 border-t border-gray-100 dark:border-gray-700">
                        <div className="text-center sm:text-left">
                            <p className="text-2xl font-black text-gray-900 dark:text-white">{user.followerCount}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-tighter">Followers</p>
                        </div>
                        <div className="text-center sm:text-left">
                            <p className="text-2xl font-black text-gray-900 dark:text-white">{user.followingCount}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-tighter">Following</p>
                        </div>
                        <div className="text-center sm:text-left">
                            <p className="text-2xl font-black text-gray-900 dark:text-white">{posts.length}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-tighter">Posts</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <div className="mt-12">
                <div className="flex gap-10 border-b border-gray-200 dark:border-gray-700 mb-8 overflow-x-auto no-scrollbar">
                    {['posts', 'media', 'achievements'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${
                                activeTab === tab
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            }`}
                        >
                            {tab}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-full"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'posts' && (
                    <div className="space-y-6">
                        {posts.length > 0 ? (
                            posts.map(post => (
                                <div key={post.id} className="bg-white dark:bg-gray-800 rounded-3xl p-7 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20">
                                                {userInitials}
                                            </div>
                                            <div>
                                                <p className="font-black text-gray-900 dark:text-white text-lg">{post.authorName}</p>
                                                <p className="text-xs text-gray-400 font-bold flex items-center gap-1.5 mt-0.5">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {new Date(post.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-8 text-lg font-medium">
                                        {post.content}
                                    </p>
                                    <div className="flex items-center gap-8 pt-6 border-t border-gray-50 dark:border-gray-700/50">
                                        <button className="flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors group">
                                            <div className="p-2 rounded-xl group-hover:bg-red-50 dark:group-hover:bg-red-900/20 transition-colors">
                                                <Heart className={`w-5 h-5 ${post.isLikedByMe ? 'fill-red-500 text-red-500' : ''}`} />
                                            </div>
                                            <span className="text-sm font-black">{post.likeCount}</span>
                                        </button>
                                        <button className="flex items-center gap-2 text-gray-400 hover:text-blue-500 transition-colors group">
                                            <div className="p-2 rounded-xl group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                                                <MessageCircle className="w-5 h-5" />
                                            </div>
                                            <span className="text-sm font-black">{post.commentCount}</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-16 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
                                <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                    <Info className="w-10 h-10 text-gray-300" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">No posts yet</h3>
                                <p className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest text-xs">When they post, it will appear here.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab !== 'posts' && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <Info className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} section is coming soon!</p>
                    </div>
                )}
            </div>
        </div>
    );
};
