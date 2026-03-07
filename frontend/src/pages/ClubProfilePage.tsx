import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import {
    ShieldCheck,  ArrowLeft, Heart, MessageCircle, Share2,
    MoreHorizontal, Check, Plus, ShoppingCart, HeartHandshake,
    Users, Building2, ExternalLink
} from 'lucide-react';

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
    storeUrl?: string;
    gofundmeUrl?: string;
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

const bannerImages = [
    "1518605368461-1ee71161d91a",
    "1574629810360-7efbb6b6923f",
    "1522778119026-d108dc1a0a52",
    "1508098682722-e99c43a406b2",
    "1431324155629-1a610d6e60d5"
];

export const ClubProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [club, setClub] = useState<ClubProfile | null>(null);
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'communications' | 'directives' | 'roster'>('communications');

    useEffect(() => {
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

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (loading) return <div className="p-10 text-center font-bold text-gray-500 uppercase tracking-widest h-screen bg-[#111827]">Establishing connection...</div>;
    if (!club) return <div className="p-10 text-center font-bold text-xl text-white h-screen bg-[#111827]">Organization not found</div>;

    // Use a slightly sharper radius for the club's "institutional" look vs the player's squircle
    const initials = club.name.substring(0, 2).toUpperCase();
    const randomBannerId = bannerImages[Number(id || 0) % bannerImages.length];
    const bannerUrl = `https://images.unsplash.com/photo-${randomBannerId}?auto=format&fit=crop&q=80&w=1200&h=400`;

    return (
        <div className="w-full min-h-screen bg-[#111827] pb-20 font-sans">

            {/* === HEADER SECTION === */}
            <div className="bg-[#1e293b] rounded-b-3xl border-b-2 border-x-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] overflow-hidden mb-8">

                {/* DYNAMIC BANNER */}
                <div className="h-48 relative bg-gray-900 border-b-2 border-gray-800">
                    <img src={bannerUrl} alt="banner" className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700" />
                </div>

                <div className="px-6 pb-6 relative">
                    {/* Back Button */}
                    <button
                        onClick={() => navigate(-1)}
                        className="absolute top-4 left-4 bg-[#1e293b] text-white px-4 py-2 rounded-xl border-2 border-gray-800 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] font-black uppercase text-xs tracking-wide flex items-center gap-2 hover:bg-gray-800 transition-all active:translate-y-1 active:shadow-none z-20"
                    >
                        <ArrowLeft className="w-4 h-4 text-emerald-400" /> Back
                    </button>

                    <div className="max-w-5xl mx-auto px-4 sm:px-0">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">

                            {/* Avatar & Title */}
                            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-16 md:-mt-12 relative z-10">
                                {/* Institutional Badge Avatar */}
                                <div className="relative group">
                                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl border-4 border-[#1e293b] bg-emerald-600 flex items-center justify-center text-5xl font-black text-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] overflow-hidden tracking-tighter">
                                        {initials}
                                    </div>
                                    {club.isOfficial && (
                                        <div className="absolute -bottom-3 -right-3 bg-blue-500 text-white p-2.5 rounded-xl shadow-sm border-2 border-[#1e293b]">
                                            <ShieldCheck className="w-6 h-6" />
                                        </div>
                                    )}
                                </div>

                                <div className="text-center md:text-left mb-2 md:mb-4">
                                    <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center justify-center md:justify-start gap-2">
                                        {club.name}
                                    </h1>
                                    <p className="text-gray-400 font-bold mt-1 uppercase text-sm tracking-widest">
                                        {club.followerCount} Followers • <span className="text-emerald-400">{club.type}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Effortlessly Cool Actions */}
                            <div className="flex flex-wrap gap-3 mb-2 md:mb-4 w-full md:w-auto justify-center md:justify-end">
                                <button
                                    onClick={handleFollowToggle}
                                    className={`px-8 py-2.5 rounded-xl font-black uppercase text-sm tracking-wide shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-2 border-2 transition-all active:translate-y-1 active:shadow-none ${
                                        club.isFollowedByMe
                                            ? 'bg-[#1e293b] hover:bg-gray-800 text-white border-gray-700'
                                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 border-transparent'
                                    }`}
                                >
                                    {club.isFollowedByMe ? <Check className="w-5 h-5 text-emerald-400" /> : <Plus className="w-5 h-5" />}
                                    {club.isFollowedByMe ? 'Following' : 'Follow Club'}
                                </button>

                                {club.storeUrl && (
                                    <a
                                        href={club.storeUrl} target="_blank" rel="noopener noreferrer"
                                        className="bg-[#1e293b] hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl font-black uppercase text-sm tracking-wide shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] border-2 border-gray-700 flex items-center justify-center gap-2 transition-all active:translate-y-1 active:shadow-none"
                                    >
                                        <ShoppingCart className="w-4 h-4 text-orange-400" /> Store
                                    </a>
                                )}

                                {club.gofundmeUrl && (
                                    <a
                                        href={club.gofundmeUrl} target="_blank" rel="noopener noreferrer"
                                        className="bg-[#1e293b] hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl font-black uppercase text-sm tracking-wide shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] border-2 border-gray-700 flex items-center justify-center gap-2 transition-all active:translate-y-1 active:shadow-none"
                                    >
                                        <HeartHandshake className="w-4 h-4 text-rose-400" /> Support
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-8 border-t-2 border-gray-800 pt-2">
                            {['communications', 'directives', 'roster'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`px-6 py-4 font-black text-xs sm:text-sm uppercase tracking-widest transition-colors ${
                                        activeTab === tab
                                            ? "text-emerald-400 border-b-4 border-emerald-500 bg-gray-800/30"
                                            : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/30"
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* === MAIN CONTENT GRID === */}
            <div className="max-w-5xl mx-auto px-4 sm:px-0 mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* LEFT COLUMN: Intel & Infrastructure */}
                    <div className="lg:col-span-1 flex flex-col gap-6">

                        {/* Club Directives (Bio) */}
                        <div className="bg-[#1e293b] rounded-3xl p-6 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
                            <h2 className="text-emerald-400 font-black italic uppercase tracking-wider mb-4 flex items-center gap-2">
                                Official Charter
                            </h2>
                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                                <p className="text-gray-300 font-medium leading-relaxed text-sm">
                                    {club.description || "No official directives have been published by this organization."}
                                </p>
                            </div>
                        </div>

                        {/* Headquarters (Location & Stats) */}
                        <div className="bg-[#1e293b] rounded-3xl p-6 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
                            <h2 className="text-emerald-400 font-black italic uppercase tracking-wider mb-5">Infrastructure</h2>
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-emerald-500 shrink-0 border border-gray-700">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Headquarters</p>
                                        <p className="font-bold text-white uppercase text-sm truncate">{club.addressText || "Undisclosed"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-blue-400 shrink-0 border border-gray-700">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active Roster</p>
                                        <p className="font-bold text-white uppercase text-sm">{club.memberCount} Players</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* External Portals */}
                        {(club.storeUrl || club.gofundmeUrl) && (
                            <div className="bg-[#1e293b] rounded-3xl p-6 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
                                <h2 className="text-emerald-400 font-black italic uppercase tracking-wider mb-5">External Portals</h2>
                                <div className="flex flex-col gap-3">
                                    {club.storeUrl && (
                                        <a href={club.storeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 p-3 rounded-xl border border-gray-700 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <ShoppingCart className="w-4 h-4 text-orange-400" />
                                                <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Official Store</span>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                                        </a>
                                    )}
                                    {club.gofundmeUrl && (
                                        <a href={club.gofundmeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 p-3 rounded-xl border border-gray-700 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <HeartHandshake className="w-4 h-4 text-rose-400" />
                                                <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Support Campaign</span>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Feed & Content */}
                    <div className="lg:col-span-2 flex flex-col gap-6">

                        {activeTab === 'communications' && (
                            <>
                                {posts.length === 0 ? (
                                    <div className="bg-[#1e293b] rounded-3xl p-10 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] text-center flex flex-col items-center justify-center">
                                        <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6 text-gray-600 border-2 border-gray-700">
                                            <Building2 className="w-8 h-8" />
                                        </div>
                                        <h3 className="font-black text-white text-xl uppercase tracking-wide mb-2">No Communications Yet</h3>
                                        <p className="text-gray-400 font-medium text-sm max-w-sm">
                                            This organization has not broadcasted any updates to the network.
                                        </p>
                                    </div>
                                ) : (
                                    posts.map(post => (
                                        <div key={post.id} className="bg-[#1e293b] rounded-3xl border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] overflow-hidden">

                                            {/* Post Header */}
                                            <div className="p-5 flex justify-between items-start">
                                                <div className="flex gap-4 items-center">
                                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm bg-emerald-600 text-slate-900 border-2 border-emerald-700">
                                                        {initials}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-white text-sm uppercase tracking-wide flex items-center gap-1.5">
                                                            {post.clubName || post.authorName}
                                                            {club.isOfficial && <ShieldCheck className="w-4 h-4 text-blue-500" />}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1 mt-1">
                                                            {formatTime(post.createdAt)} • Official Broadcast
                                                        </div>
                                                    </div>
                                                </div>
                                                <button className="text-gray-500 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
                                                    <MoreHorizontal className="w-5 h-5" />
                                                </button>
                                            </div>

                                            {/* Post Body */}
                                            <div className="px-5 pb-4">
                                                <p className="text-gray-300 whitespace-pre-line leading-relaxed text-sm font-medium">
                                                    {post.content}
                                                </p>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="px-3 py-2 border-t-2 border-gray-800 flex justify-between bg-gray-800/30">
                                                <button className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors ${post.isLikedByMe ? "text-emerald-400 bg-gray-800" : "text-gray-400 hover:text-emerald-400 hover:bg-gray-800"}`}>
                                                    <Heart className="w-4 h-4" fill={post.isLikedByMe ? "currentColor" : "none"} /> {post.likeCount || "Acknowledge"}
                                                </button>
                                                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                                                    <MessageCircle className="w-4 h-4" /> {post.commentCount || "Intel"}
                                                </button>
                                                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                                                    <Share2 className="w-4 h-4" /> Relay
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </>
                        )}

                        {activeTab === 'directives' && (
                            <div className="bg-[#1e293b] rounded-3xl p-10 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] text-center text-gray-500 font-bold uppercase tracking-widest">
                                See Official Charter.
                            </div>
                        )}

                        {activeTab === 'roster' && (
                            <div className="bg-[#1e293b] rounded-3xl p-10 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] text-center text-gray-500 font-bold uppercase tracking-widest">
                                Roster visibility restricted.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};