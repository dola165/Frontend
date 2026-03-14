import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import {
    MapPin,  Edit, Ruler, Weight,
    ShieldCheck, ArrowLeft, Activity,
    X, Save, Loader2, Camera
} from 'lucide-react';
import { FeedPost, type FeedPostDto, type CommentDto } from '../components/feed/FeedPost';

interface CareerHistoryDto { id: number; clubName: string; season: string; category: string; appearances: number; goals: number; assists: number; cleanSheets: number; }
interface UserProfile { id: number; username: string; fullName: string; role: string; position: string; preferredFoot: string; bio: string; availabilityStatus: string; heightCm: number; weightKg: number; followerCount: number; followingCount: number; isFollowedByMe: boolean; careerHistory: CareerHistoryDto[]; avatarUrl?: string; bannerUrl?: string; }

export const UserProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // --- Refs & Upload State ---
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<'banner' | 'avatar' | null>(null);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'feed' | 'stats' | 'media'>('feed');

    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
    const [isSaving, setIsSaving] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
        if (!e.target.files || !e.target.files[0]) return;

        const file = e.target.files[0];
        setUploading(type);

        const formData = new FormData();
        formData.append('file', file);

        try {
            // 1. Upload to Media (POST)
            const mediaRes = await apiClient.post('/api/media/upload', formData);
            const imageUrl = mediaRes.data.url;

            // 2. Update User Profile (PUT)
            await apiClient.put(`/api/users/me`, {
                [type === 'avatar' ? 'avatarUrl' : 'bannerUrl']: imageUrl
            });

            // 3. Refresh profile data
            fetchProfile();
        } catch (err) {
            console.error("Upload failed", err);
            alert("Failed to update profile image.");
        } finally {
            setUploading(null);
            if (e.target) e.target.value = '';
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [id]);

    const fetchProfile = () => {
        Promise.all([
            apiClient.get(`/users/${id}`),
            apiClient.get(`/feed/user/${id}`).catch(() => ({ data: { posts: [] } }))
        ])
            .then(([userRes, postsRes]) => {
                setProfile(userRes.data);
                setEditForm(userRes.data);
                setPosts(postsRes.data?.posts || []);
            })
            .catch(err => console.error("Failed to fetch user profile", err))
            .finally(() => setLoading(false));
    };

    const handleFollowToggle = async () => {
        if (!profile) return;
        const prev = profile.isFollowedByMe;
        const prevCount = profile.followerCount;
        setProfile({ ...profile, isFollowedByMe: !prev, followerCount: prev ? prevCount - 1 : prevCount + 1 });
        try { await apiClient.post(`/users/${profile.id}/follow`); }
        catch { setProfile({ ...profile, isFollowedByMe: prev, followerCount: prevCount }); }
    };

    const handleLikeToggle = async (postId: number) => {
        setPosts(current => current.map(post => post.id === postId ? { ...post, isLikedByMe: !post.isLikedByMe, likeCount: post.isLikedByMe ? post.likeCount - 1 : post.likeCount + 1 } : post));
        try { await apiClient.post(`/feed/posts/${postId}/like`); } catch { /* ignore */ }
    };

    const toggleComments = async (postId: number) => {
        const isOpen = openComments[postId];
        setOpenComments(prev => ({ ...prev, [postId]: !isOpen }));
        if (!isOpen && !commentsData[postId]) {
            try {
                const res = await apiClient.get<CommentDto[]>(`/feed/posts/${postId}/comments`);
                setCommentsData(prev => ({ ...prev, [postId]: res.data }));
            } catch (err) { console.error(err); }
        }
    };

    const submitComment = async (postId: number, content: string) => {
        try {
            const res = await apiClient.post<CommentDto>(`/feed/posts/${postId}/comments`, { content });
            setCommentsData(prev => ({ ...prev, [postId]: [...(prev[postId] || []), res.data] }));
            setPosts(current => current.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
        } catch (err) { alert("Failed to post comment."); }
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            const res = await apiClient.put(`/users/${id}`, editForm);
            setProfile(res.data);
            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Failed to save profile", error);
            alert("Failed to save changes.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="p-10 text-center font-bold text-slate-500 uppercase tracking-widest h-screen bg-[#fdfaf5] dark:bg-[#0a0f13]">Establishing connection...</div>;
    if (!profile) return <div className="p-10 text-center font-bold text-xl text-slate-900 dark:text-white h-screen bg-[#fdfaf5] dark:bg-[#0a0f13]">Personnel not found</div>;

    const initials = profile.fullName.substring(0, 2).toUpperCase();
    const bannerUrl = profile.bannerUrl || "https://images.unsplash.com/photo-1518605368461-1ee71161d91a?auto=format&fit=crop&q=80&w=1200&h=400";
    const isMyProfile = String(profile.id) === localStorage.getItem('userId');

    return (
        <div className="w-full min-h-screen bg-[#fdfaf5] dark:bg-[#0a0f13] font-sans pb-20">
            {/* HERO SECTION */}
            <div className="relative bg-white dark:bg-[#151f28] border-b-2 border-slate-300 dark:border-black shadow-sm">
                <div className="relative h-[240px] md:h-[320px] bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 overflow-hidden group">
                    <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover opacity-80 dark:opacity-60 transition-transform duration-700 group-hover:scale-105" />

                    {/* Update Cover Button */}
                    {isMyProfile && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button
                                onClick={() => bannerInputRef.current?.click()}
                                className="bg-black/60 hover:bg-black/80 text-white px-4 py-2 rounded-md border border-white/20 flex items-center gap-2 font-bold text-xs uppercase tracking-widest backdrop-blur-sm"
                            >
                                {uploading === 'banner' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                Update Banner
                            </button>
                            <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'banner')} />
                        </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#151f28] via-transparent to-transparent opacity-80 dark:opacity-100"></div>
                    <button onClick={() => navigate(-1)} className="absolute top-4 left-4 bg-white/80 dark:bg-black/40 hover:bg-white dark:hover:bg-black/60 backdrop-blur-md text-slate-900 dark:text-white px-3 py-1.5 rounded-md border border-slate-300 dark:border-white/10 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all z-20 shadow-sm">
                        <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </button>
                </div>

                <div className="max-w-[1200px] mx-auto px-4 md:px-6 relative">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-4 md:gap-6 -mt-16 md:-mt-20 pb-6">
                        {/* AVATAR SECTION */}
                        <div className="relative shrink-0 group/avatar">
                            <div className="w-28 h-28 md:w-36 md:h-36 bg-slate-100 dark:bg-slate-800 rounded-full border-4 border-white dark:border-[#151f28] shadow-xl flex items-center justify-center overflow-hidden text-4xl md:text-5xl font-black text-slate-400 dark:text-slate-500">
                                {profile.avatarUrl ? <img src={profile.avatarUrl} className="w-full h-full object-cover" /> : initials}
                            </div>

                            {/* Update Avatar Button */}
                            {isMyProfile && (
                                <button
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-full z-10"
                                >
                                    {uploading === 'avatar' ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white" />}
                                </button>
                            )}
                            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} />

                            {profile.role === 'CLUB_ADMIN' && (
                                <div className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 w-8 h-8 md:w-10 md:h-10 bg-blue-500 rounded-full border-4 border-white dark:border-[#151f28] flex items-center justify-center shadow-md">
                                    <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-white" />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 flex flex-col md:flex-row items-center md:items-end justify-between w-full pb-2 gap-4 text-center md:text-left">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{profile.fullName}</h1>
                                <p className="text-emerald-600 dark:text-emerald-500 font-bold text-sm uppercase tracking-widest mt-1">
                                    {profile.role === 'CLUB_ADMIN' ? 'Club Administrator' : profile.position}
                                </p>
                                <div className="flex items-center justify-center md:justify-start gap-4 mt-3 text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">
                                    <span>{profile.followerCount} <span className="uppercase tracking-widest text-[10px] font-medium">Followers</span></span>
                                    <span>{profile.followingCount} <span className="uppercase tracking-widest text-[10px] font-medium">Following</span></span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                {isMyProfile ? (
                                    <button onClick={() => setIsEditModalOpen(true)} className="flex items-center gap-2 px-6 py-2.5 rounded-sm font-bold text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 border-2 border-slate-900">
                                        <Edit className="w-4 h-4" /> Edit Profile
                                    </button>
                                ) : (
                                    <button onClick={handleFollowToggle} className={`flex items-center gap-2 px-8 py-2.5 rounded-sm font-black text-[11px] uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none border-2 ${profile.isFollowedByMe ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-900 hover:bg-slate-300 dark:hover:bg-slate-700' : 'bg-emerald-600 text-white border-emerald-900 hover:bg-emerald-500'}`}>
                                        {profile.isFollowedByMe ? 'Following' : 'Follow'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* REST OF PAGE CONTENT (Bio, Stats, Feed) Stays the same as your snippet */}
            <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
                <div className="flex flex-col lg:flex-row gap-6">
                    <aside className="w-full lg:w-[320px] shrink-0 flex flex-col gap-4">
                        <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg p-5 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-xs mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">Player Bio</h3>
                            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{profile.bio || "No biography provided."}</p>
                            <div className="mt-6 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-sm bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                        <MapPin className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">Location</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">Tbilisi, Georgia</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-sm bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                        <Ruler className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">Height</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{profile.heightCm ? `${profile.heightCm} cm` : 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-sm bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                        <Weight className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">Weight</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{profile.weightKg ? `${profile.weightKg} kg` : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>

                    <div className="flex-1 w-full lg:max-w-[600px]">
                        <div className="flex gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar">
                            <button onClick={() => setActiveTab('feed')} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${activeTab === 'feed' ? 'text-emerald-600 dark:text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Timeline</button>
                            <button onClick={() => setActiveTab('stats')} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${activeTab === 'stats' ? 'text-emerald-600 dark:text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Career Stats</button>
                            <button onClick={() => setActiveTab('media')} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${activeTab === 'media' ? 'text-emerald-600 dark:text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Media Gallery</button>
                        </div>

                        {activeTab === 'feed' && (
                            <div className="flex flex-col gap-4">
                                {posts.length === 0 ? (
                                    <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg p-10 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] text-center">
                                        <Activity className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                                        <h3 className="text-slate-900 dark:text-white font-black uppercase tracking-widest">No Activity Yet</h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium">This user hasn't posted anything to their timeline.</p>
                                    </div>
                                ) : (
                                    posts.map(post => (
                                        <FeedPost
                                            key={post.id} post={post} isCommentsOpen={openComments[post.id]} commentsData={commentsData[post.id]}
                                            onLikeToggle={handleLikeToggle} onToggleComments={toggleComments} onSubmitComment={submitComment}
                                        />
                                    ))
                                )}
                            </div>
                        )}
                        {/* Stats and Media tab content placeholders... */}
                    </div>
                </div>
            </div>

            {/* EDIT PROFILE MODAL */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#1e293b] w-full max-w-lg rounded-lg border-2 border-slate-300 dark:border-black shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 dark:text-white">Edit Profile</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Full Name</label>
                                <input type="text" value={editForm.fullName || ''} onChange={(e) => setEditForm({...editForm, fullName: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Position</label>
                                <input type="text" value={editForm.position || ''} onChange={(e) => setEditForm({...editForm, position: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Height (cm)</label>
                                    <input type="number" value={editForm.heightCm || ''} onChange={(e) => setEditForm({...editForm, heightCm: Number(e.target.value)})} className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Weight (kg)</label>
                                    <input type="number" value={editForm.weightKg || ''} onChange={(e) => setEditForm({...editForm, weightKg: Number(e.target.value)})} className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Biography</label>
                                <textarea rows={4} value={editForm.bio || ''} onChange={(e) => setEditForm({...editForm, bio: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 resize-none" />
                            </div>
                        </div>
                        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 rounded-sm font-bold uppercase text-[10px] tracking-widest text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleSaveProfile} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all border border-transparent disabled:opacity-50 flex items-center gap-2">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Commit Changes</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};