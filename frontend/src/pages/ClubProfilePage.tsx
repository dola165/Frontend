import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import {
    ShieldCheck, ArrowLeft, Heart, MessageCircle, Share2,
    MoreHorizontal, Check, Plus, ShoppingCart, HeartHandshake,
    Building2, Send, MapPin
} from 'lucide-react';

interface ClubProfile {
    id: number; name: string; description: string; type: string; isOfficial: boolean; followerCount: number; memberCount: number; isFollowedByMe: boolean; isMember: boolean; addressText?: string; storeUrl?: string; gofundmeUrl?: string;
}

interface FeedPostDto {
    id: number; content: string; createdAt: string; authorName: string; clubId: number | null; clubName: string | null; likeCount: number; commentCount: number; isLikedByMe: boolean;
}

interface CommentDto {
    id: number; authorName: string; content: string; createdAt: string;
}

const bannerImages = ["1518605368461-1ee71161d91a", "1574629810360-7efbb6b6923f", "1522778119026-d108dc1a0a52", "1508098682722-e99c43a406b2", "1431324155629-1a610d6e60d5"];

export const ClubProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [club, setClub] = useState<ClubProfile | null>(null);
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'communications' | 'directives' | 'roster'>('communications');
    const [bannerError, setBannerError] = useState(false);

    // Feed Interaction States
    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});

    useEffect(() => {
        Promise.all([ apiClient.get(`/clubs/${id}`), apiClient.get(`/feed/club/${id}`) ])
            .then(([clubRes, postsRes]) => { setClub(clubRes.data); setPosts(postsRes.data.posts); })
            .catch(err => console.error("Failed to load profile data", err))
            .finally(() => setLoading(false));
    }, [id]);

    const handleFollowToggle = async () => {
        if (!club) return;
        const prev = club.isFollowedByMe;
        const prevCount = club.followerCount;
        setClub({ ...club, isFollowedByMe: !prev, followerCount: prev ? prevCount - 1 : prevCount + 1 });
        try { await apiClient.post(`/clubs/${club.id}/follow`); }
        catch { setClub({ ...club, isFollowedByMe: prev, followerCount: prevCount }); }
    };

    const formatTime = (dateString: string) => new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    // --- FEED INTERACTIONS ---
    const handleLikeToggle = async (postId: number) => {
        setPosts(current => current.map(post => post.id === postId ? { ...post, isLikedByMe: !post.isLikedByMe, likeCount: post.isLikedByMe ? post.likeCount - 1 : post.likeCount + 1 } : post));
        try { await apiClient.post(`/feed/posts/${postId}/like`); } catch { /* ignore */ }
    };

    const toggleComments = async (postId: number) => {
        const isOpen = openComments[postId];
        setOpenComments(prev => ({ ...prev, [postId]: !isOpen }));
        if (!isOpen && !commentsData[postId]) {
            try { const res = await apiClient.get<CommentDto[]>(`/feed/posts/${postId}/comments`); setCommentsData(prev => ({ ...prev, [postId]: res.data })); } catch (err) { console.error(err); }
        }
    };

    const submitComment = async (postId: number) => {
        const text = commentInputs[postId]?.trim();
        if (!text) return;
        try {
            const res = await apiClient.post<CommentDto>(`/feed/posts/${postId}/comments`, { content: text });
            setCommentsData(prev => ({ ...prev, [postId]: [...(prev[postId] || []), res.data] }));
            setPosts(current => current.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
            setCommentInputs(prev => ({ ...prev, [postId]: "" }));
        } catch (err) { alert("Failed to post comment."); }
    };

    if (loading) return <div className="p-10 text-center font-bold text-slate-500 uppercase tracking-widest h-screen bg-[#0f172a]">Establishing connection...</div>;
    if (!club) return <div className="p-10 text-center font-bold text-xl text-white h-screen bg-[#0f172a]">Organization not found</div>;

    const initials = club.name.substring(0, 2).toUpperCase();
    const randomBannerId = bannerImages[Number(id || 0) % bannerImages.length];
    const bannerUrl = `https://images.unsplash.com/photo-${randomBannerId}?auto=format&fit=crop&q=80&w=1200&h=400`;

    return (
        <div className="w-full min-h-screen bg-[#0f172a] pb-20 font-sans text-slate-300">
            {/* === HEADER SECTION === */}
            <div className="bg-white dark:bg-[#1e293b] rounded-b-sm border-b-2 border-x-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] overflow-hidden mb-8">

                <div className="h-48 relative bg-slate-900 border-b-2 border-slate-800">
                    {!bannerError ? (
                        <img src={bannerUrl} alt="Banner" onError={() => setBannerError(true)} className="w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 transition-all duration-700" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-slate-800 to-slate-900 opacity-50" />
                    )}
                    <button onClick={() => navigate(-1)} className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-3 py-1.5 rounded-sm border border-white/20 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all z-20">
                        <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" /> Back
                    </button>
                </div>

                <div className="px-6 pb-6 relative">
                    <div className="max-w-5xl mx-auto px-4 sm:px-0">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">

                            {/* Avatar & Title */}
                            <div className="flex flex-col md:flex-row items-center md:items-end gap-4 md:gap-6 -mt-12 md:-mt-16 relative z-10">
                                <div className="relative group shrink-0">
                                    <div className="w-28 h-28 md:w-36 md:h-36 rounded-sm border-4 border-white dark:border-[#1e293b] bg-emerald-600 flex items-center justify-center text-4xl md:text-5xl font-black text-slate-900 shadow-sm overflow-hidden tracking-tighter">
                                        {initials}
                                    </div>
                                    {club.isOfficial && (
                                        <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white p-1.5 rounded-sm shadow-sm border-2 border-white dark:border-[#1e293b]">
                                            <ShieldCheck className="w-4 h-4 md:w-5 md:h-5" />
                                        </div>
                                    )}
                                </div>

                                <div className="text-center md:text-left pt-2 md:pt-0">
                                    <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center justify-center md:justify-start gap-2">
                                        {club.name}
                                    </h1>
                                    <p className="text-slate-500 font-bold mt-1 uppercase text-xs tracking-widest">
                                        {club.followerCount} Followers • <span className="text-emerald-600 dark:text-emerald-500">{club.type}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2 w-full md:w-auto justify-center md:justify-end mt-4 md:mt-0 relative z-10">
                                <button onClick={handleFollowToggle} className={`px-6 py-2.5 rounded-sm font-bold uppercase text-xs tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[2px_2px_0px_0px_#020617] flex items-center justify-center gap-2 transition-all active:translate-y-0.5 active:shadow-none border border-transparent ${club.isFollowedByMe ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
                                    {club.isFollowedByMe ? <Check className="w-4 h-4 text-emerald-500" /> : <Plus className="w-4 h-4" />}
                                    {club.isFollowedByMe ? 'Following' : 'Follow Club'}
                                </button>
                                {club.storeUrl && (
                                    <a href={club.storeUrl} target="_blank" rel="noopener noreferrer" className="bg-slate-100 dark:bg-[#0f172a] hover:bg-slate-200 dark:hover:bg-slate-900 text-slate-900 dark:text-white px-5 py-2.5 rounded-sm font-bold uppercase text-xs tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[2px_2px_0px_0px_#020617] border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 active:translate-y-0.5 active:shadow-none transition-all">
                                        <ShoppingCart className="w-4 h-4 text-orange-500" /> Store
                                    </a>
                                )}
                                {club.gofundmeUrl && (
                                    <a href={club.gofundmeUrl} target="_blank" rel="noopener noreferrer" className="bg-slate-100 dark:bg-[#0f172a] hover:bg-slate-200 dark:hover:bg-slate-900 text-slate-900 dark:text-white px-5 py-2.5 rounded-sm font-bold uppercase text-xs tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[2px_2px_0px_0px_#020617] border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 active:translate-y-0.5 active:shadow-none transition-all">
                                        <HeartHandshake className="w-4 h-4 text-rose-500" /> Support
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex gap-1 overflow-x-auto no-scrollbar mt-6 border-t border-slate-200 dark:border-slate-800 pt-2">
                            {['communications', 'directives', 'roster'].map((tab) => (
                                <button key={tab} onClick={() => setActiveTab(tab as any)}
                                        className={`px-6 py-3 font-bold text-xs uppercase tracking-widest transition-colors rounded-t-sm whitespace-nowrap ${
                                            activeTab === tab ? "text-emerald-600 dark:text-emerald-400 bg-slate-50 dark:bg-slate-800/50 border-b-2 border-emerald-500" : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                        }`}>
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* === MAIN CONTENT GRID === */}
            <div className="max-w-5xl mx-auto px-4 sm:px-0 mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* LEFT COLUMN */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="bg-white dark:bg-[#1e293b] rounded-sm p-5 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                            <h2 className="text-slate-900 dark:text-white font-black uppercase tracking-widest text-xs mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-emerald-500" /> Official Charter
                            </h2>
                            <div className="bg-slate-50 dark:bg-[#0f172a] p-3 rounded-sm border border-slate-200 dark:border-slate-800 shadow-inner mb-4">
                                <p className="text-slate-700 dark:text-slate-300 font-medium italic leading-relaxed text-xs">
                                    "{club.description || "No official directives have been published by this organization."}"
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1e293b] rounded-sm p-5 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                            <h2 className="text-slate-900 dark:text-white font-black uppercase tracking-widest text-xs mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-emerald-500" /> Infrastructure
                            </h2>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-sm border border-slate-200 dark:border-slate-700">
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Base</span>
                                    <span className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[120px]">{club.addressText || "Undisclosed"}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-sm border border-slate-200 dark:border-slate-700">
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Members</span>
                                    <span className="font-black text-slate-900 dark:text-white">{club.memberCount}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        {activeTab === 'communications' && (
                            <>
                                {posts.length === 0 ? (
                                    <div className="bg-white dark:bg-[#1e293b] rounded-sm p-10 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] text-center flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm flex items-center justify-center mb-4 text-slate-400">
                                            <Building2 className="w-6 h-6" />
                                        </div>
                                        <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-wide mb-1">Silence on the Network</h3>
                                        <p className="text-slate-500 font-medium text-xs max-w-sm">
                                            This organization has not broadcasted any updates to the network.
                                        </p>
                                    </div>
                                ) : (
                                    posts.map(post => {
                                        const isCommentsOpen = openComments[post.id];
                                        return (
                                            <div key={post.id} className="bg-white dark:bg-[#1e293b] rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
                                                <div className="p-4 flex justify-between items-start border-b border-slate-100 dark:border-slate-800/50">
                                                    <div className="flex gap-3 items-center">
                                                        <div className="w-10 h-10 rounded-sm bg-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-700 text-white">
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold uppercase tracking-wide text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                                                                {post.clubName || post.authorName}
                                                                {club.isOfficial && <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />}
                                                            </div>
                                                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                                {formatTime(post.createdAt)} • Official Broadcast
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

                                                {(post.likeCount > 0 || post.commentCount > 0) && (
                                                    <div className="px-5 pb-3 flex gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                        {post.likeCount > 0 && <span className="text-orange-500">{post.likeCount} Acknowledged</span>}
                                                        {post.commentCount > 0 && <span className="text-emerald-500">{post.commentCount} Intel</span>}
                                                    </div>
                                                )}

                                                <div className="flex border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827]">
                                                    <button onClick={() => handleLikeToggle(post.id)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors border-r border-slate-200 dark:border-slate-800 ${post.isLikedByMe ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/10" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                                                        <Heart className="w-3.5 h-3.5" fill={post.isLikedByMe ? "currentColor" : "none"} /> ACK
                                                    </button>
                                                    <button onClick={() => toggleComments(post.id)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-800 ${isCommentsOpen ? "text-emerald-500" : ""}`}>
                                                        <MessageCircle className="w-3.5 h-3.5" /> INTEL
                                                    </button>
                                                    <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                        <Share2 className="w-3.5 h-3.5" /> RELAY
                                                    </button>
                                                </div>

                                                {/* INLINE COMMENTS FOR CLUB FEED */}
                                                {isCommentsOpen && (
                                                    <div className="bg-slate-50 dark:bg-[#111827] p-4 border-t border-slate-200 dark:border-slate-800">
                                                        <div className="flex flex-col gap-3 mb-4 max-h-60 overflow-y-auto pr-1">
                                                            {!commentsData[post.id] ? (
                                                                <div className="text-[10px] uppercase tracking-widest font-bold text-center text-slate-400">Loading intel...</div>
                                                            ) : commentsData[post.id].length === 0 ? (
                                                                <div className="text-[10px] uppercase tracking-widest font-bold text-center text-slate-400">No intel available.</div>
                                                            ) : (
                                                                commentsData[post.id].map(comment => (
                                                                    <div key={comment.id} className="flex gap-3">
                                                                        <div className="w-8 h-8 rounded-sm bg-slate-200 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                                                                            {comment.authorName.substring(0, 2).toUpperCase()}
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                                <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">{comment.authorName}</span>
                                                                                <span className="text-[9px] uppercase tracking-widest text-slate-400">{formatTime(comment.createdAt)}</span>
                                                                            </div>
                                                                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{comment.content}</p>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <input type="text" placeholder="Add intel..." value={commentInputs[post.id] || ""} onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && submitComment(post.id)} className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-sm px-3 py-2 outline-none focus:border-emerald-500 font-medium" />
                                                            <button onClick={() => submitComment(post.id)} disabled={!commentInputs[post.id]?.trim()} className="px-3 bg-emerald-600 text-white rounded-sm disabled:opacity-50 transition-opacity"><Send className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </>
                        )}
                        {activeTab === 'directives' && (
                            <div className="bg-white dark:bg-[#1e293b] rounded-sm p-10 border-2 border-slate-300 dark:border-slate-800 text-center text-slate-500 font-bold uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                                See Official Charter.
                            </div>
                        )}
                        {activeTab === 'roster' && (
                            <div className="bg-white dark:bg-[#1e293b] rounded-sm p-10 border-2 border-slate-300 dark:border-slate-800 text-center text-slate-500 font-bold uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                                Roster visibility restricted.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};