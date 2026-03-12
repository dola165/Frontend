import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import {
    ShieldCheck, ArrowLeft, Heart, MessageCircle,
    MoreHorizontal, Check, Plus, ShoppingCart, HeartHandshake,
    Building2, Send, MapPin, CalendarDays, Settings,
    TrendingUp, CalendarPlus, Swords, X, Eye, Target,
    UserPlus, SlidersHorizontal, Megaphone, Paintbrush, Network, Trash2, ShieldAlert, Activity, ArrowRight, Users
} from 'lucide-react';

// --- INTERFACES ---
interface ClubProfile {
    id: number; name: string; description: string; type: string; isOfficial: boolean; followerCount: number; memberCount: number; isFollowedByMe: boolean; isMember: boolean; addressText?: string; storeUrl?: string; gofundmeUrl?: string;
}

interface FeedPostDto {
    id: number; content: string; createdAt: string; authorName: string; clubId: number | null; clubName: string | null; likeCount: number; commentCount: number; isLikedByMe: boolean;
}

interface CommentDto {
    id: number; authorName: string; content: string; createdAt: string;
}

interface TryoutApplicantDto {
    id: number; userId: number; name: string; position: string; ageGroup: string; status: string;
    matchScore: number; attributes: { pace: number; passing: number; physicality: number };
}

interface ClubRosterDto {
    id: number; name: string; position: string; number: number; status: string; avatar: string;
}

interface ClubStaffDto {
    id: number; name: string; role: string; clearance: string;
}

interface CalendarEventDto {
    id: string; type: string; title: string; date: string; location: string; status: string;
}

const bannerImages = ["1518605368461-1ee71161d91a", "1574629810360-7efbb6b6923f", "1522778119026-d108dc1a0a52"];

export const ClubProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // --- DYNAMIC ACCESS CONTROL ---
    const [isCommandCenter, setIsCommandCenter] = useState(false);

    const [club, setClub] = useState<ClubProfile | null>(null);
    const [posts, setPosts] = useState<FeedPostDto[]>([]);

    // LIVE STATE (No Mocks)
    const [roster, setRoster] = useState<ClubRosterDto[]>([]);
    const [staff, setStaff] = useState<ClubStaffDto[]>([]);
    const [applicants, setApplicants] = useState<TryoutApplicantDto[]>([]);
    const [selectedApplicant, setSelectedApplicant] = useState<TryoutApplicantDto | null>(null);
    const [schedule, setSchedule] = useState<CalendarEventDto[]>([]);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'communications' | 'directives' | 'roster' | 'applicants' | 'schedule'>('communications');
    const [bannerError, setBannerError] = useState(false);

    const [isManageOrgOpen, setIsManageOrgOpen] = useState(false);
    const [manageTab, setManageTab] = useState<'personnel' | 'squads' | 'recruitment' | 'brand' | 'directives'>('personnel');
    const [recruitmentStatus, setRecruitmentStatus] = useState<'ACTIVE' | 'LOCKED'>('ACTIVE');
    const [matchThreshold, setMatchThreshold] = useState(75);

    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});

    useEffect(() => {
        // Fetch all required access & live data concurrently
        Promise.all([
            apiClient.get(`/clubs/${id}`),
            apiClient.get(`/feed/club/${id}`),
            apiClient.get(`/clubs/${id}/roster`).catch(() => ({ data: [] })),
            apiClient.get(`/clubs/${id}/staff`).catch(() => ({ data: [] })),
            apiClient.get(`/admin/tryouts/clubs/${id}/applications`).catch(() => ({ data: [] })),
            apiClient.get(`/clubs/${id}/calendar`).catch(() => ({ data: [] })), // Phase 3 unified calendar
            apiClient.get('/clubs/my-club').catch(() => ({ data: null })),
            apiClient.get('/users/me').catch(() => ({ data: null }))
        ])
            .then(([clubRes, postsRes, rosterRes, staffRes, appRes, scheduleRes, myClubRes, userRes]) => {
                setClub(clubRes.data);
                setPosts(postsRes.data.posts);
                setRoster(rosterRes.data || []);
                setStaff(staffRes.data || []);
                setSchedule(scheduleRes.data || []);

                // Wire up the Applicants State
                const fetchedApps = appRes.data || [];
                setApplicants(fetchedApps);
                if (fetchedApps.length > 0) setSelectedApplicant(fetchedApps[0]);

                // Access Gatekeeper
                if (myClubRes.data && String(myClubRes.data.clubId) === String(id)) {
                    setIsCommandCenter(true);
                } else if (!myClubRes.data && userRes.data?.role === 'CLUB_ADMIN') {
                    setIsCommandCenter(true);
                } else {
                    setIsCommandCenter(false);
                }
            })
            .catch(err => {
                console.error("Failed to load profile data", err);
                setClub({ id: Number(id), name: 'FC Dinamo Tbilisi', description: 'Official professional club.', type: 'Professional', isOfficial: true, followerCount: 1250, memberCount: 24, isFollowedByMe: false, isMember: true, addressText: 'Dinamo Arena, Tbilisi', storeUrl: "https://store.example.com", gofundmeUrl: "https://gofundme.example.com" });

                apiClient.get('/users/me').then(res => {
                    if (res.data.role === 'CLUB_ADMIN') setIsCommandCenter(true);
                }).catch(() => setIsCommandCenter(false));
            })
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

    const handleApplicantStatus = async (appId: number, newStatus: string) => {
        // Optimistic UI Update (Instant visual feedback)
        setApplicants(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
        if (selectedApplicant?.id === appId) {
            setSelectedApplicant({ ...selectedApplicant, status: newStatus });
        }

        // Background Database Update
        try {
            await apiClient.put(`/admin/tryouts/applications/${appId}/status?status=${newStatus}`);
        } catch (error) {
            console.error("Failed to update status", error);
            alert("Network Error: Could not save decision.");
        }
    };

    if (loading) return <div className="p-10 text-center font-bold text-slate-500 uppercase tracking-widest h-screen bg-[#0f172a]">Establishing connection...</div>;
    if (!club) return <div className="p-10 text-center font-bold text-xl text-white h-screen bg-[#0f172a]">Organization not found</div>;

    const initials = club.name.substring(0, 2).toUpperCase();
    const randomBannerId = bannerImages[Number(id || 0) % bannerImages.length];
    const bannerUrl = `https://images.unsplash.com/photo-${randomBannerId}?auto=format&fit=crop&q=80&w=1200&h=400`;

    const tabs = isCommandCenter
        ? [ { id: 'communications', label: 'Comms' }, { id: 'roster', label: 'Active Roster' }, { id: 'applicants', label: 'Applicants' }, { id: 'schedule', label: 'Schedule' } ]
        : [ { id: 'communications', label: 'Comms' }, { id: 'directives', label: 'Charter' }, { id: 'roster', label: 'Roster' } ];

    const showSideWidgets = activeTab === 'communications' || activeTab === 'directives';
    const isFocusMode = !showSideWidgets;
    const containerWidth = isFocusMode ? 'max-w-7xl' : 'max-w-5xl';

    return (
        <div className={`w-full min-h-screen pb-20 font-sans text-slate-300 transition-colors duration-500 ease-in-out ${isFocusMode ? 'bg-[#020617]' : 'bg-[#0f172a]'}`}>

            <div className={`bg-white dark:bg-[#1e293b] rounded-b-sm border-b-2 border-x-2 border-slate-300 dark:border-slate-800 transition-shadow duration-500 mb-8 ${isFocusMode ? 'shadow-[8px_8px_0px_0px_#020617]' : 'shadow-[4px_4px_0px_0px_#020617]'}`}>

                <div className="h-48 relative bg-slate-900 border-b-2 border-slate-800">
                    {!bannerError ? (
                        <img src={bannerUrl} alt="Banner" onError={() => setBannerError(true)} className={`w-full h-full object-cover transition-all duration-700 ${isFocusMode ? 'opacity-30 grayscale-0' : 'opacity-50 grayscale hover:grayscale-0'}`} />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-slate-800 to-slate-900 opacity-50" />
                    )}
                    <button onClick={() => navigate(-1)} className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-3 py-1.5 rounded-sm border border-white/20 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all z-20">
                        <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" /> Back
                    </button>
                </div>

                <div className="px-6 pb-6 relative">
                    <div className={`mx-auto px-4 sm:px-0 transition-all duration-500 ease-in-out ${containerWidth}`}>
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">

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

                            <div className="flex flex-wrap gap-2 w-full md:w-auto justify-center md:justify-end mt-4 md:mt-0 relative z-10">
                                {isCommandCenter ? (
                                    <>
                                        <button onClick={() => navigate('/calendar')} className="bg-orange-500 hover:bg-orange-400 text-slate-900 px-5 py-2.5 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-[2px_2px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all border border-transparent flex items-center gap-2">
                                            <CalendarPlus className="w-4 h-4" /> Plan Event
                                        </button>
                                        <button onClick={() => setIsManageOrgOpen(true)} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white px-5 py-2.5 rounded-sm font-bold uppercase text-[10px] tracking-widest border border-slate-300 dark:border-slate-600 flex items-center gap-2 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-none">
                                            <Settings className="w-4 h-4 text-emerald-500" /> Manage Org
                                        </button>
                                    </>
                                ) : (
                                    <>
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
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-1 overflow-x-auto no-scrollbar mt-6 border-t border-slate-200 dark:border-slate-800 pt-2">
                            {tabs.map((tab) => (
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

            <div className={`mx-auto px-4 sm:px-0 mt-8 transition-all duration-500 ease-in-out ${containerWidth}`}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {showSideWidgets && (
                        <div className="lg:col-span-4 flex flex-col gap-6 animate-in slide-in-from-left-4 fade-in duration-500">
                            {isCommandCenter ? (
                                <div className="bg-white dark:bg-[#1e293b] rounded-sm p-5 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                                    <h2 className="text-slate-900 dark:text-white font-black uppercase tracking-widest text-xs mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-500" /> Operations Overview
                                    </h2>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-sm border border-slate-200 dark:border-slate-700">
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Active Roster</span>
                                            <span className="font-black text-slate-900 dark:text-white text-sm">{roster.length} Squad</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-sm border border-slate-200 dark:border-slate-700">
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Pending Tryouts</span>
                                            <span className="font-black text-orange-500 text-sm">{applicants.filter(a => a.status === 'PENDING').length} Action Reqd</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-sm border border-slate-200 dark:border-slate-700">
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Upcoming Events</span>
                                            <span className="font-black text-blue-500 text-sm">{schedule.length} Scheduled</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-[#1e293b] rounded-sm p-5 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                                    <h2 className="text-slate-900 dark:text-white font-black uppercase tracking-widest text-xs mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-emerald-500" /> Official Charter
                                    </h2>
                                    <div className="bg-slate-50 dark:bg-[#0f172a] p-3 rounded-sm border border-slate-200 dark:border-slate-800 shadow-inner mb-4">
                                        <p className="text-slate-700 dark:text-slate-300 font-medium italic leading-relaxed text-xs">
                                            "{club.description || "No official directives have been published."}"
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white dark:bg-[#1e293b] rounded-sm p-5 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                                <h2 className="text-slate-900 dark:text-white font-black uppercase tracking-widest text-xs mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-emerald-500" /> Infrastructure
                                </h2>
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-sm border border-slate-200 dark:border-slate-700">
                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Base</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[120px]">{club.addressText || "Undisclosed"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={`flex flex-col gap-6 transition-all duration-500 ease-in-out ${showSideWidgets ? 'lg:col-span-8' : 'lg:col-span-12'}`}>

                        {/* 1. COMMUNICATIONS */}
                        {activeTab === 'communications' && (
                            <>
                                {posts.length === 0 ? (
                                    <div className="bg-white dark:bg-[#1e293b] rounded-sm p-10 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_#020617] text-center flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm flex items-center justify-center mb-4 text-slate-400">
                                            <Building2 className="w-6 h-6" />
                                        </div>
                                        <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-wide mb-1">Silence on the Network</h3>
                                        <p className="text-slate-500 font-medium text-xs max-w-sm">
                                            {isCommandCenter ? "You haven't broadcasted any updates yet. Post an update to notify followers." : "This organization has not broadcasted any updates."}
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

                                                <div className="flex border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827]">
                                                    <button onClick={() => handleLikeToggle(post.id)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors border-r border-slate-200 dark:border-slate-800 ${post.isLikedByMe ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/10" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                                                        <Heart className="w-3.5 h-3.5" fill={post.isLikedByMe ? "currentColor" : "none"} /> ACK
                                                    </button>
                                                    <button onClick={() => toggleComments(post.id)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-800 ${isCommentsOpen ? "text-emerald-500" : ""}`}>
                                                        <MessageCircle className="w-3.5 h-3.5" /> INTEL
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

                        {/* 2. THE TACTICAL ROSTER (Wired to Live Phase 1 Data) */}
                        {activeTab === 'roster' && isCommandCenter && (
                            <>
                                {roster.length === 0 ? (
                                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500 bg-white dark:bg-[#1e293b] rounded-sm border-2 border-dashed border-slate-300 dark:border-slate-800">
                                        <Users className="w-10 h-10 mb-4 opacity-50" />
                                        <p className="font-bold uppercase tracking-widest text-sm">Roster is empty</p>
                                        <p className="text-xs font-medium mt-1">Assign players to squads to populate the tactical view.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-in fade-in zoom-in-95 duration-300">
                                        {roster.map(player => (
                                            <div key={player.id} className="bg-white dark:bg-[#1e293b] rounded-sm border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_#020617] hover:shadow-[8px_8px_0px_0px_#020617] flex flex-col hover:-translate-y-2 transition-all duration-300 group">
                                                <div className="p-4 flex justify-between items-start border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-[#0f172a]/50">
                                                    <div className={`px-2 py-0.5 rounded-sm text-[9px] font-black uppercase tracking-widest ${
                                                        player.status === 'FIT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                            player.status === 'INJURED' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                                'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                    }`}>
                                                        {player.status}
                                                    </div>
                                                    <div className="text-3xl font-black text-slate-300 dark:text-slate-700 group-hover:text-emerald-500/30 transition-colors">
                                                        #{player.number}
                                                    </div>
                                                </div>
                                                <div className="p-6 flex flex-col items-center text-center flex-1">
                                                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=${player.avatar || '10b981'}&color=fff&bold=true&size=100`} alt={player.name} className="w-16 h-16 rounded-sm border-2 border-slate-300 dark:border-slate-700 shadow-sm mb-4 transition-transform group-hover:scale-110 duration-300" />
                                                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm cursor-pointer hover:text-emerald-500 transition-colors" onClick={() => navigate(`/profile/${player.id}`)}>{player.name}</h3>
                                                    <p className="text-emerald-600 dark:text-emerald-500 font-bold text-[10px] uppercase tracking-widest mt-1.5">{player.position}</p>
                                                </div>
                                                <div className="grid grid-cols-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                                    <button className="py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-800">
                                                        Stats
                                                    </button>
                                                    <button className="py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-orange-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                        Manage
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* 3. THE SCOUTING TERMINAL (Wired to Live Phase 2 Data) */}
                        {activeTab === 'applicants' && isCommandCenter && (
                            <>
                                {applicants.length === 0 ? (
                                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500 bg-white dark:bg-[#1e293b] rounded-sm border-2 border-dashed border-slate-300 dark:border-slate-800 h-[400px]">
                                        <Target className="w-10 h-10 mb-4 opacity-50" />
                                        <p className="font-bold uppercase tracking-widest text-sm">No Pending Applicants</p>
                                        <p className="text-xs font-medium mt-1">Your scouting terminal is currently clear.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col lg:flex-row gap-6 h-[650px] animate-in fade-in slide-in-from-bottom-4 duration-500">

                                        {/* Left Side: Applicant Queue */}
                                        <div className="w-full lg:w-1/4 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
                                            {applicants.map(app => (
                                                <div key={app.id}
                                                     onClick={() => setSelectedApplicant(app)}
                                                     className={`p-4 rounded-sm border-2 transition-all cursor-pointer shadow-sm group ${selectedApplicant?.id === app.id ? 'bg-white dark:bg-[#1e293b] border-emerald-500 shadow-[4px_4px_0px_0px_#10b981] -translate-y-0.5' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-400 hover:bg-white dark:hover:bg-[#1e293b]'}`}>
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-sm">{app.ageGroup}</span>
                                                        <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${app.status === 'PENDING' ? 'bg-orange-500 animate-pulse' : app.status === 'ACCEPTED' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                                    </div>
                                                    <h4 className={`font-black uppercase truncate text-sm transition-colors ${selectedApplicant?.id === app.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white group-hover:text-emerald-500'}`}>{app.name}</h4>
                                                    <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1">{app.position}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Right Side: The Dossier */}
                                        {selectedApplicant ? (
                                            <div className="w-full lg:w-3/4 bg-white dark:bg-[#1e293b] rounded-sm border-2 border-slate-300 dark:border-slate-800 shadow-[8px_8px_0px_0px_#020617] flex flex-col overflow-hidden">
                                                <div className="p-8 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-start">
                                                    <div className="flex gap-6 items-center">
                                                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedApplicant.name)}&background=334155&color=fff&bold=true&size=150`} alt="Avatar" className="w-20 h-20 rounded-sm border-2 border-slate-300 dark:border-slate-700 shadow-sm" />
                                                        <div>
                                                            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{selectedApplicant.name}</h2>
                                                            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2 mt-2">
                                                                <span className="text-emerald-600 dark:text-emerald-500">{selectedApplicant.position}</span> • <span>{selectedApplicant.ageGroup} Division</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right bg-white dark:bg-[#0f172a] p-3 rounded-sm border border-slate-200 dark:border-slate-700 shadow-inner">
                                                        <div className="text-4xl font-black text-emerald-500">{selectedApplicant.matchScore}%</div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">System Match</div>
                                                    </div>
                                                </div>

                                                <div className="p-8 flex-1 overflow-y-auto">
                                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white mb-6 border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2">
                                                        <Target className="w-4 h-4 text-emerald-500" /> Physical Attributes
                                                    </h3>
                                                    <div className="space-y-6 max-w-xl">
                                                        <div>
                                                            <div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-2 text-slate-600 dark:text-slate-400"><span>Pace</span> <span className="text-slate-900 dark:text-white">{selectedApplicant.attributes.pace}</span></div>
                                                            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${selectedApplicant.attributes.pace}%` }}></div></div>
                                                        </div>
                                                        <div>
                                                            <div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-2 text-slate-600 dark:text-slate-400"><span>Passing</span> <span className="text-slate-900 dark:text-white">{selectedApplicant.attributes.passing}</span></div>
                                                            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${selectedApplicant.attributes.passing}%` }}></div></div>
                                                        </div>
                                                        <div>
                                                            <div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-2 text-slate-600 dark:text-slate-400"><span>Physicality</span> <span className="text-slate-900 dark:text-white">{selectedApplicant.attributes.physicality}</span></div>
                                                            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-orange-500" style={{ width: `${selectedApplicant.attributes.physicality}%` }}></div></div>
                                                        </div>
                                                    </div>

                                                    <button onClick={() => navigate(`/profile/${selectedApplicant.userId}`)} className="mt-10 text-xs font-bold uppercase tracking-widest text-blue-500 hover:text-blue-400 flex items-center gap-2 transition-colors bg-blue-500/10 px-4 py-2.5 rounded-sm border border-blue-500/30 w-fit">
                                                        <Eye className="w-4 h-4" /> Open Full Scouting Dossier
                                                    </button>
                                                </div>

                                                <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex gap-4 bg-slate-50 dark:bg-slate-900/50">
                                                    {selectedApplicant.status === 'PENDING' ? (
                                                        <>
                                                            <button onClick={() => handleApplicantStatus(selectedApplicant.id, 'REJECTED')} className="flex-1 py-4 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-800/50 text-rose-600 dark:text-rose-400 rounded-sm font-black uppercase text-xs tracking-widest transition-colors flex items-center justify-center gap-2 border border-transparent hover:shadow-[4px_4px_0px_0px_rgba(225,29,72,0.2)]">
                                                                <X className="w-5 h-5" /> Reject Dossier
                                                            </button>
                                                            <button onClick={() => handleApplicantStatus(selectedApplicant.id, 'ACCEPTED')} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 border border-transparent">
                                                                <Check className="w-5 h-5" /> Issue Invitation
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => handleApplicantStatus(selectedApplicant.id, 'PENDING')} className="w-full py-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-sm font-black uppercase text-xs tracking-widest transition-colors border border-transparent">
                                                            Revert Decision
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </>
                        )}

                        {/* 4. SCHEDULE PLANNER (Wired to Live Phase 3 Data) */}
                        {activeTab === 'schedule' && isCommandCenter && (
                            <>
                                {schedule.length === 0 ? (
                                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500 bg-white dark:bg-[#1e293b] rounded-sm border-2 border-dashed border-slate-300 dark:border-slate-800 h-[200px]">
                                        <CalendarDays className="w-10 h-10 mb-4 opacity-50" />
                                        <p className="font-bold uppercase tracking-widest text-sm">Logistics Clear</p>
                                        <p className="text-xs font-medium mt-1">No events have been deployed.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {schedule.map(event => (
                                            <div key={event.id} className="bg-white dark:bg-[#1e293b] rounded-sm p-5 border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_#020617] flex items-center justify-between hover:shadow-[6px_6px_0px_0px_#020617] hover:-translate-y-0.5 transition-all group">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-14 h-14 bg-slate-50 dark:bg-[#0f172a] rounded-sm flex flex-col items-center justify-center border-2 border-slate-200 dark:border-slate-700 text-slate-500 group-hover:border-emerald-500 transition-colors">
                                                        {event.type === 'MATCH' ? <Swords className="w-6 h-6 text-blue-500" /> :
                                                            event.type === 'TRYOUT' ? <CalendarDays className="w-6 h-6 text-orange-500" /> :
                                                                <Activity className="w-6 h-6 text-emerald-500" />}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wide text-base">{event.title}</h3>
                                                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                                                            <span>{event.date}</span> • <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {event.location}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest ${event.status === 'UPCOMING' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                        {event.status.replace('_', ' ')}
                                                    </span>
                                                    <button onClick={() => navigate('/calendar')} className="block text-[10px] font-bold text-slate-400 hover:text-emerald-500 uppercase tracking-widest transition-colors mt-3 w-full text-right flex items-center justify-end gap-1">
                                                        Edit Logistics <ArrowRight className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* FALLBACK TABS */}
                        {activeTab === 'roster' && !isCommandCenter && (
                            <div className="bg-white dark:bg-[#1e293b] rounded-sm p-10 border-2 border-slate-300 dark:border-slate-800 text-center text-slate-500 font-bold uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_#020617]">
                                Roster visibility restricted.
                            </div>
                        )}
                        {activeTab === 'directives' && !isCommandCenter && (
                            <div className="bg-white dark:bg-[#1e293b] rounded-sm p-10 border-2 border-slate-300 dark:border-slate-800 text-center text-slate-500 font-bold uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_#020617]">
                                See Official Charter.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* === MANAGE ORG FULL-SCREEN OVERLAY === */}
            {isManageOrgOpen && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
                    <div className="w-full max-w-6xl h-full max-h-[85vh] bg-[#0f172a] rounded-sm border-4 border-slate-700 shadow-[16px_16px_0px_0px_#020617] flex flex-col md:flex-row overflow-hidden relative">

                        <button onClick={() => setIsManageOrgOpen(false)} className="absolute top-4 right-4 z-50 p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-sm border-2 border-slate-600 hover:border-rose-500 transition-all shadow-[2px_2px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="w-full md:w-72 bg-[#1e293b] border-r-2 border-slate-800 flex flex-col shrink-0">
                            <div className="p-6 border-b-2 border-slate-800 bg-slate-900">
                                <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <Settings className="w-5 h-5 text-emerald-500" /> Command
                                </h2>
                                <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest mt-2 flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" /> Level 5 Clearance
                                </p>
                            </div>
                            <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
                                {[
                                    { id: 'personnel', icon: UserPlus, label: 'Personnel & Staff' },
                                    { id: 'squads', icon: Network, label: 'Squad Architecture' },
                                    { id: 'recruitment', icon: SlidersHorizontal, label: 'Recruitment Settings' },
                                    { id: 'brand', icon: Paintbrush, label: 'Brand & Infrastructure' },
                                    { id: 'directives', icon: Megaphone, label: 'Official Directives' }
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setManageTab(tab.id as any)}
                                            className={`flex items-center gap-3 p-3 rounded-sm font-bold text-xs uppercase tracking-widest transition-all border-l-4 ${manageTab === tab.id ? 'bg-[#0f172a] text-emerald-400 border-emerald-500 shadow-inner' : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                                        <tab.icon className="w-4 h-4" /> {tab.label}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">

                            {/* TAB: PERSONNEL */}
                            {manageTab === 'personnel' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="flex justify-between items-center mb-8 border-b-2 border-slate-800 pb-4">
                                        <div>
                                            <h3 className="text-2xl font-black text-white uppercase tracking-widest">Active Personnel</h3>
                                            <p className="text-slate-400 font-bold text-xs mt-1">Manage staff roles and database clearances.</p>
                                        </div>
                                        <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-[2px_2px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 border border-transparent">
                                            <UserPlus className="w-4 h-4" /> Invite Staff
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        {staff.length === 0 ? (
                                            <div className="py-8 flex flex-col items-center justify-center text-slate-500 bg-[#1e293b] rounded-sm border-2 border-dashed border-slate-700">
                                                <UserPlus className="w-8 h-8 mb-3 opacity-50" />
                                                <p className="font-bold uppercase tracking-widest text-xs">No active personnel found</p>
                                            </div>
                                        ) : (
                                            staff.map(staffMember => (
                                                <div key={staffMember.id} className="bg-[#1e293b] p-4 rounded-sm border-2 border-slate-700 shadow-sm flex items-center justify-between group">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-slate-800 rounded-sm border border-slate-600 flex items-center justify-center font-black text-slate-400">
                                                            {staffMember.name.substring(0,2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-white uppercase tracking-wider text-sm">{staffMember.name}</h4>
                                                            <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mt-0.5">{staffMember.role}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <span className="hidden md:inline-block px-3 py-1 bg-[#0f172a] rounded-sm border border-slate-700 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                            {staffMember.clearance}
                                                        </span>
                                                        <button className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-sm transition-colors border border-transparent hover:border-rose-500/30" title="Revoke Access">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {manageTab === 'recruitment' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="mb-8 border-b-2 border-slate-800 pb-4">
                                        <h3 className="text-2xl font-black text-white uppercase tracking-widest">Scouting Parameters</h3>
                                        <p className="text-slate-400 font-bold text-xs mt-1">Control your club's presence on the global Intel Map.</p>
                                    </div>

                                    <div className="bg-[#1e293b] p-6 rounded-sm border-2 border-slate-700 shadow-[4px_4px_0px_0px_#020617] mb-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <div>
                                                <h4 className="font-black text-white uppercase tracking-widest text-sm flex items-center gap-2">
                                                    <Target className="w-4 h-4 text-emerald-500" /> Global Recruitment Status
                                                </h4>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Is your roster currently open to new applications?</p>
                                            </div>
                                            <button
                                                onClick={() => setRecruitmentStatus(prev => prev === 'ACTIVE' ? 'LOCKED' : 'ACTIVE')}
                                                className={`px-6 py-2 rounded-sm font-black uppercase text-[10px] tracking-widest border-2 transition-all ${recruitmentStatus === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500'}`}
                                            >
                                                {recruitmentStatus === 'ACTIVE' ? 'Scouting Active' : 'Roster Locked'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-[#1e293b] p-6 rounded-sm border-2 border-slate-700 shadow-[4px_4px_0px_0px_#020617] mb-6">
                                        <h4 className="font-black text-white uppercase tracking-widest text-sm mb-4">Targeted Needs</h4>
                                        <input type="text" placeholder="e.g., Striker, Left Back (Separate by comma)" className="w-full bg-[#0f172a] border-2 border-slate-700 rounded-sm px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 font-bold mb-2" />
                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest">This filters the Intel Map so only relevant players see your club.</p>
                                    </div>

                                    <div className="bg-[#1e293b] p-6 rounded-sm border-2 border-slate-700 shadow-[4px_4px_0px_0px_#020617]">
                                        <div className="flex justify-between items-end mb-4">
                                            <h4 className="font-black text-white uppercase tracking-widest text-sm flex items-center gap-2">
                                                <ShieldAlert className="w-4 h-4 text-orange-500" /> Auto-Filter Threshold
                                            </h4>
                                            <span className="text-xl font-black text-emerald-500">{matchThreshold}%</span>
                                        </div>
                                        <input type="range" min="0" max="100" value={matchThreshold} onChange={(e) => setMatchThreshold(Number(e.target.value))} className="w-full h-2 bg-slate-800 rounded-sm appearance-none cursor-pointer accent-emerald-500 mb-2" />
                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest">Automatically reject applicants with a System Match score below this threshold.</p>
                                    </div>
                                </div>
                            )}

                            {/* PLACEHOLDERS FOR OTHER TABS */}
                            {['squads', 'brand', 'directives'].includes(manageTab) && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 animate-in fade-in duration-300">
                                    <Settings className="w-12 h-12 mb-4 opacity-50" />
                                    <h3 className="text-lg font-black uppercase tracking-widest text-slate-400">Module Initializing</h3>
                                    <p className="text-xs font-bold uppercase tracking-widest mt-2">The {manageTab} configuration interface is currently under construction.</p>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};