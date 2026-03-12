import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import {
    MapPin, PlaySquare, Edit, Ruler, Weight,
    Heart, MessageCircle, Share2, MoreHorizontal,
    ShieldCheck, Zap, ArrowLeft, CheckCircle2, Activity,
    Medal, Send, X, Save, Loader2 // <-- Added X, Save, Loader2
} from 'lucide-react';

interface CareerHistoryDto {
    id: number; clubName: string; season: string; category: string; appearances: number; goals: number; assists: number; cleanSheets: number;
}

interface UserProfile {
    id: number; username: string; fullName: string; role: string; position: string; preferredFoot: string; bio: string; availabilityStatus: string; heightCm: number; weightKg: number; followerCount: number; followingCount: number; isFollowedByMe: boolean; careerHistory: CareerHistoryDto[];
}

interface FeedPostDto {
    id: number; content: string; createdAt: string; authorName: string; clubId: number | null; clubName: string | null; likeCount: number; commentCount: number; isLikedByMe: boolean;
}

interface CommentDto {
    id: number; authorName: string; content: string; createdAt: string;
}

const userBannerImages = [ "1518605368461-1ee71161d91a", "1574629810360-7efbb6b6923f", "1522778119026-d108dc1a0a52", "1508098682722-e99c43a406b2" ];

export const UserProfilePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'timeline' | 'stats' | 'intel'>('timeline');
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [bannerError, setBannerError] = useState(false);
    const [loading, setLoading] = useState(true);

    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});

    // --- NEW: Edit Modal State ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        fullName: '', position: '', preferredFoot: '', heightCm: '', weightKg: '', bio: ''
    });

    const isMyProfile = true; // In reality, compare `id` with your currently logged-in user's ID

    useEffect(() => {
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
                // Mock fallback
                setProfile({
                    id: Number(id), username: 'test_user', fullName: 'Beqa Dolidze', role: 'PLAYER', position: 'CDM / CB', preferredFoot: 'Right', bio: "Passionate defensive mid.", availabilityStatus: 'FREE_AGENT', heightCm: 185, weightKg: 78, followerCount: 239, followingCount: 45, isFollowedByMe: false,
                    careerHistory: [
                        { id: 1, clubName: 'Experimentuli', season: '2024/25', category: 'First Team', appearances: 14, goals: 2, assists: 5, cleanSheets: 0 },
                        { id: 2, clubName: 'FC Rustavi', season: '2023/24', category: 'U18', appearances: 22, goals: 8, assists: 3, cleanSheets: 0 }
                    ]
                });
            })
            .finally(() => setLoading(false));
    }, [id]);

    const formatTime = (dateString: string) => new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

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

    // --- NEW: Save Profile Logic ---
    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            // Re-using the endpoint from Onboarding!
            await apiClient.put('/users/me/profile', {
                fullName: editForm.fullName,
                role: profile?.role, // Must send role to satisfy the DTO
                position: editForm.position,
                preferredFoot: editForm.preferredFoot,
                heightCm: parseInt(editForm.heightCm) || null,
                weightKg: parseInt(editForm.weightKg) || null,
                bio: editForm.bio
            });

            // Update local state to immediately show changes without refreshing
            setProfile(prev => prev ? {
                ...prev,
                fullName: editForm.fullName,
                position: editForm.position,
                preferredFoot: editForm.preferredFoot,
                heightCm: parseInt(editForm.heightCm) || 0,
                weightKg: parseInt(editForm.weightKg) || 0,
                bio: editForm.bio
            } : null);

            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Failed to update profile", error);
            alert("Error updating profile. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const openEditModal = () => {
        if (!profile) return;
        setEditForm({
            fullName: profile.fullName || '',
            position: profile.position || '',
            preferredFoot: profile.preferredFoot || 'Right',
            heightCm: profile.heightCm?.toString() || '',
            weightKg: profile.weightKg?.toString() || '',
            bio: profile.bio || ''
        });
        setIsEditModalOpen(true);
    };

    if (loading || !profile) return <div className="p-10 text-center font-bold text-slate-500 uppercase tracking-widest animate-pulse h-screen bg-[#0f172a]">Accessing Dossier...</div>;

    const randomBannerId = userBannerImages[Number(id || 0) % userBannerImages.length];
    const bannerUrl = `https://images.unsplash.com/photo-${randomBannerId}?auto=format&fit=crop&q=80&w=1200&h=400`;

    const renderRoleBadge = () => {
        switch (profile.role) {
            case 'PLAYER': return <span className="bg-emerald-500 text-slate-900 px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest">Player</span>;
            case 'AGENT': return <span className="bg-indigo-500 text-white px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest">Scout / Agent</span>;
            case 'CLUB_ADMIN': return <span className="bg-orange-500 text-slate-900 px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest">Club Director</span>;
            default: return <span className="bg-slate-700 text-white px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest">Supporter</span>;
        }
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

    const profileTabs = [
        { id: 'timeline', label: 'Match Feed' },
        { id: 'stats', label: profile.role === 'PLAYER' ? 'Career Stats' : 'Portfolio' },
        { id: 'intel', label: 'Dossier' }
    ];

    return (
        <div className="w-full min-h-screen bg-[#0f172a] pb-20 font-sans text-slate-300">
            <div className="bg-white dark:bg-[#1e293b] rounded-b-sm border-b-2 border-x-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] overflow-hidden mb-8">

                <div className="h-48 relative bg-slate-900 border-b-2 border-slate-800">
                    {!bannerError ? (
                        <img src={bannerUrl} alt="Banner" onError={() => setBannerError(true)} className="w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 transition-all duration-700" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-slate-800 to-slate-900 opacity-50" />
                    )}
                    <button onClick={() => navigate(-1)} className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-3 py-1.5 rounded-sm border border-white/20 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all z-20">
                        <ArrowLeft className="w-3.5 h-3.5 text-emerald-500" /> Back
                    </button>
                </div>

                <div className="px-6 pb-6 relative">
                    <div className="max-w-5xl mx-auto px-4 sm:px-0">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">

                            <div className="flex flex-col md:flex-row items-center md:items-end gap-4 md:gap-6 -mt-12 md:-mt-16 relative z-10">
                                <div className="relative group shrink-0">
                                    <div className="w-28 h-28 md:w-36 md:h-36 rounded-sm border-4 border-white dark:border-[#1e293b] bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-4xl font-black text-slate-700 dark:text-slate-300 shadow-sm overflow-hidden">
                                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile.fullName)}&background=${profile.role === 'CLUB_ADMIN' ? 'f97316' : '10b981'}&color=fff&bold=true&size=200`} alt={profile.fullName} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-sm shadow-sm border-2 border-white dark:border-[#1e293b]">
                                        <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
                                    </div>
                                </div>

                                <div className="text-center md:text-left pt-2 md:pt-0">
                                    <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                                        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{profile.fullName}</h1>
                                        {renderRoleBadge()}
                                    </div>
                                    <div className="flex items-center justify-center md:justify-start gap-2">
                                        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">
                                            {profile.followerCount} Network {profile.position && `• `}
                                            <span className="text-emerald-600 dark:text-emerald-500">{profile.position || (profile.role === 'CLUB_ADMIN' ? 'FC Dinamo Tbilisi' : '')}</span>
                                        </p>
                                        {profile.role === 'PLAYER' && getStatusBadge(profile.availabilityStatus)}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-4 md:mt-0 w-full md:w-auto justify-center md:justify-end relative z-10">
                                {isMyProfile ? (
                                    <button
                                        onClick={openEditModal} // <-- LINKED OPEN MODAL
                                        className="bg-slate-100 dark:bg-[#0f172a] hover:bg-slate-200 dark:hover:bg-slate-900 text-slate-900 dark:text-white px-5 py-2.5 rounded-sm font-bold uppercase text-xs tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[2px_2px_0px_0px_#020617] border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 active:translate-y-0.5 active:shadow-none transition-all"
                                    >
                                        <Edit className="w-4 h-4 text-emerald-500" /> Settings
                                    </button>
                                ) : (
                                    <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-2.5 rounded-sm font-bold uppercase text-xs tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[2px_2px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all border border-transparent">
                                        {profile.role === 'PLAYER' ? 'Scout Player' : 'Connect'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-1 overflow-x-auto no-scrollbar mt-6 border-t border-slate-200 dark:border-slate-800 pt-2">
                            {profileTabs.map((tab) => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                                        className={`px-6 py-3 font-bold text-xs uppercase tracking-widest transition-colors rounded-t-sm whitespace-nowrap ${
                                            activeTab === tab.id ? "text-emerald-600 dark:text-emerald-400 bg-slate-50 dark:bg-slate-800/50 border-b-2 border-emerald-500" : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                        }`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* LEFT COLUMN */}
                    <div className="lg:col-span-4 flex flex-col gap-6">

                        {profile.role === 'PLAYER' && (
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
                        )}

                        <div className="bg-white dark:bg-[#1e293b] rounded-sm p-5 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                            <h2 className="text-slate-900 dark:text-white font-black uppercase tracking-widest text-xs mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                <Medal className="w-4 h-4 text-emerald-500" /> {profile.role === 'PLAYER' ? 'Player Manifesto' : 'Philosophy'}
                            </h2>
                            <div className="bg-slate-50 dark:bg-[#0f172a] p-3 rounded-sm border border-slate-200 dark:border-slate-800 shadow-inner mb-4">
                                <p className="text-slate-700 dark:text-slate-300 font-medium italic leading-relaxed text-xs">
                                    "{profile.bio || "No summary provided."}"
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="lg:col-span-8 flex flex-col gap-6">

                        {activeTab === 'timeline' && (
                            <>
                                {posts.length === 0 ? (
                                    <div className="bg-white dark:bg-[#1e293b] rounded-sm p-10 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] text-center flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm flex items-center justify-center mb-4 text-slate-400">
                                            <PlaySquare className="w-6 h-6" />
                                        </div>
                                        <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-wide mb-1">Silence on the Network</h3>
                                        <p className="text-slate-500 font-medium text-xs max-w-sm">
                                            This user hasn't broadcasted any updates or footage yet.
                                        </p>
                                    </div>
                                ) : (
                                    posts.map(post => {
                                        const isCommentsOpen = openComments[post.id];
                                        return (
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
                                                                {formatTime(post.createdAt)} {post.clubName && <><ShieldCheck className="w-3 h-3 text-emerald-500" /></>}
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
                                                    <button onClick={() => handleLikeToggle(post.id)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors border-r border-slate-200 dark:border-slate-800 ${post.isLikedByMe ? "text-orange-500 bg-orange-50 dark:bg-orange-900/10" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                                                        <Heart className="w-3.5 h-3.5" fill={post.isLikedByMe ? "currentColor" : "none"} /> ACK
                                                    </button>
                                                    <button onClick={() => toggleComments(post.id)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-800 ${isCommentsOpen ? "text-emerald-500" : ""}`}>
                                                        <MessageCircle className="w-3.5 h-3.5" /> INTEL
                                                    </button>
                                                    <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                        <Share2 className="w-3.5 h-3.5" /> RELAY
                                                    </button>
                                                </div>

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

                        {activeTab === 'stats' && profile.role === 'PLAYER' && (
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
                                        <tr><td colSpan={7} className="p-8 text-center text-slate-500 text-xs font-medium uppercase tracking-widest">No career history documented.</td></tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'intel' && (
                            <div className="bg-white dark:bg-[#1e293b] rounded-sm p-10 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] text-center text-slate-500 font-bold uppercase tracking-widest text-sm">
                                Full Dossier Restricted.
                            </div>
                        )}

                        {activeTab === 'stats' && (profile.role === 'AGENT' || profile.role === 'CLUB_ADMIN') && (
                            <div className="bg-white dark:bg-[#1e293b] rounded-sm p-10 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617] text-center text-slate-500 font-bold uppercase tracking-widest text-sm">
                                {profile.role === 'AGENT' ? 'Client Roster Visibility Restricted.' : 'Club Affiliations Restricted.'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- EDIT PROFILE MODAL --- */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#1e293b] w-full max-w-2xl rounded-sm border-2 border-slate-300 dark:border-slate-800 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[8px_8px_0px_0px_#020617] flex flex-col max-h-[90vh]">

                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                <Edit className="w-5 h-5 text-emerald-500" /> Modify Database Record
                            </h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-slate-500">Full Legal Name</label>
                                <input
                                    type="text"
                                    value={editForm.fullName}
                                    onChange={e => setEditForm({...editForm, fullName: e.target.value})}
                                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                                />
                            </div>

                            {profile.role === 'PLAYER' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-slate-500">Position</label>
                                            <input
                                                type="text"
                                                value={editForm.position}
                                                onChange={e => setEditForm({...editForm, position: e.target.value})}
                                                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-slate-500">Strong Foot</label>
                                            <select
                                                value={editForm.preferredFoot}
                                                onChange={e => setEditForm({...editForm, preferredFoot: e.target.value})}
                                                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white appearance-none"
                                            >
                                                <option value="Right">Right</option>
                                                <option value="Left">Left</option>
                                                <option value="Both">Both</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-slate-500">Height (cm)</label>
                                            <input
                                                type="number"
                                                value={editForm.heightCm}
                                                onChange={e => setEditForm({...editForm, heightCm: e.target.value})}
                                                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-slate-500">Weight (kg)</label>
                                            <input
                                                type="number"
                                                value={editForm.weightKg}
                                                onChange={e => setEditForm({...editForm, weightKg: e.target.value})}
                                                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-slate-500">Manifesto / Bio</label>
                                <textarea
                                    value={editForm.bio}
                                    onChange={e => setEditForm({...editForm, bio: e.target.value})}
                                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 h-24 resize-none text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-5 py-2.5 rounded-sm font-bold uppercase text-[10px] tracking-widest text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveProfile}
                                disabled={isSaving}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all border border-transparent disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Commit Changes</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};