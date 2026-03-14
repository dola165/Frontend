import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Settings, X, UserPlus, SlidersHorizontal, Megaphone, Paintbrush, Network, Trash2, Users, CalendarDays, MapPin } from 'lucide-react';

import { ClubHero } from '../components/club/ClubHero';
import { ClubSidebar } from '../components/club/ClubSidebar';
import { ClubOpportunities } from '../components/club/ClubOpportunities';
import { MatchInviteModal } from '../components/club/MatchInviteModal';
import { PostComposer } from '../components/feed/PostComposer';
import { FeedPost, type FeedPostDto, type CommentDto } from '../components/feed/FeedPost';

// --- INTERFACES ---
interface ClubProfile { id: number; name: string; description: string; type: string; isOfficial: boolean; followerCount: number; memberCount: number; isFollowedByMe: boolean; isMember: boolean; addressText?: string; storeUrl?: string; gofundmeUrl?: string; }
interface ClubRosterDto { id: number; name: string; position: string; number: number; status: string; avatar: string; }
interface ClubStaffDto { id: number; name: string; role: string; clearance: string; }
interface CalendarEventDto { id: string; type: string; title: string; date: string; location: string; status: string; }



export const ClubProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // --- Precise Role State ---
    const [isOwnClubAdmin, setIsOwnClubAdmin] = useState(false);
    const [isOtherClubAdmin, setIsOtherClubAdmin] = useState(false);

    const [club, setClub] = useState<ClubProfile | null>(null);
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [roster, setRoster] = useState<ClubRosterDto[]>([]);
    const [staff, setStaff] = useState<ClubStaffDto[]>([]);
    const [schedule, setSchedule] = useState<CalendarEventDto[]>([]); // <-- NEW STATE
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('our-club');

    // UI Modals
    const [isManageOrgOpen, setIsManageOrgOpen] = useState(false);
    const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
    const [manageTab, setManageTab] = useState<'personnel' | 'squads' | 'recruitment' | 'brand' | 'directives'>('personnel');

    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});

    const fetchClubData = () => {
        apiClient.get(`/clubs/${id}`).then(res => setClub(res.data));
    };

    useEffect(() => {
        Promise.all([
            apiClient.get(`/clubs/${id}`),
            apiClient.get(`/feed/club/${id}`).catch(() => ({ data: { posts: [] } })),
            apiClient.get(`/clubs/${id}/roster`).catch(() => ({ data: [] })),
            apiClient.get(`/clubs/${id}/staff`).catch(() => ({ data: [] })),
            apiClient.get(`/clubs/${id}/calendar`).catch(() => ({ data: [] })), // <-- ADDED FETCH
            apiClient.get('/clubs/my-club').catch(() => ({ data: null })),
            apiClient.get('/users/me').catch(() => ({ data: null }))
        ])
            .then(([clubRes, postsRes, rosterRes, staffRes, scheduleRes, myClubRes, userRes]) => {
                setClub(clubRes.data);
                setPosts(postsRes.data.posts || []);
                setRoster(rosterRes.data || []);
                setStaff(staffRes.data || []);
                setSchedule(scheduleRes.data || []); // <-- SET SCHEDULE DATA

                const isClubAdminRole = userRes.data?.role === 'CLUB_ADMIN';
                const myClubId = myClubRes.data?.clubId || myClubRes.data?.id;

                const isMyClub = String(myClubId) === String(id) || (isClubAdminRole && (!myClubId && id === '1'));

                if (isMyClub) {
                    setIsOwnClubAdmin(true);
                    setIsOtherClubAdmin(false);
                } else if (isClubAdminRole) {
                    setIsOwnClubAdmin(false);
                    setIsOtherClubAdmin(true);
                } else {
                    setIsOwnClubAdmin(false);
                    setIsOtherClubAdmin(false);
                }
            })
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

    const handleSendMatchInvite = async (inviteData: any) => {
        console.log("Sending challenge to", club?.name, "with data:", inviteData);
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                alert(`Challenge issued to ${club?.name}! Awaiting their response.`);
                resolve();
            }, 800);
        });
    };

    if (loading) return <div className="p-10 text-center font-bold text-slate-500 uppercase tracking-widest h-screen bg-[#fdfaf5] dark:bg-[#0a0f13]">Establishing connection...</div>;

    return (
        <div className="w-full min-h-screen bg-[#fdfaf5] dark:bg-[#0a0f13] font-sans pb-20">

            <ClubHero
                club={club}
                isOwnClubAdmin={isOwnClubAdmin}
                isOtherClubAdmin={isOtherClubAdmin}
                onFollowToggle={handleFollowToggle}
                onOpenManageOrg={() => setIsManageOrgOpen(true)}
                onOpenChallengeModal={() => setIsMatchModalOpen(true)}
                onRefresh={fetchClubData} // Pass the refresh function
            />

            <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
                <div className="flex flex-col lg:flex-row gap-6">
                    <ClubSidebar activeTab={activeTab} setActiveTab={setActiveTab} club={club} />

                    <main className="flex-1 w-full lg:max-w-[680px] flex flex-col gap-4">

                        {/* TAB: FEED */}
                        {activeTab === 'our-club' && (
                            <>
                                {isOwnClubAdmin && (
                                    <PostComposer
                                        clubId={club?.id}
                                        authorName={club?.name}
                                        onPostCreated={() => {
                                            apiClient.get(`/feed/club/${id}`).then(res => setPosts(res.data.posts || []));
                                        }}
                                    />
                                )}

                                {posts.length === 0 ? (
                                    <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg p-10 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] text-center flex flex-col items-center justify-center">
                                        <Megaphone className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-4" />
                                        <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-wide mb-1">Silence on the Network</h3>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">No updates have been broadcasted yet.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {posts.map(post => (
                                            <FeedPost
                                                key={post.id} post={post} isCommentsOpen={openComments[post.id]} commentsData={commentsData[post.id]}
                                                onLikeToggle={handleLikeToggle} onToggleComments={toggleComments} onSubmitComment={submitComment}
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* TAB: ROSTER */}
                        {activeTab === 'teams' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {roster.length === 0 ? (
                                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-[#1e293b] rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
                                        <Users className="w-10 h-10 mb-4 opacity-50" />
                                        <p className="font-bold uppercase tracking-widest text-sm text-slate-600 dark:text-white">Roster is empty</p>
                                    </div>
                                ) : (
                                    roster.map(player => (
                                        <div key={player.id} onClick={() => navigate(`/profile/${player.id}`)} className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg p-4 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:-translate-y-1 transition-all cursor-pointer group flex items-center gap-4 hover:border-emerald-500 dark:hover:border-emerald-500/50">
                                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=${player.avatar || '10b981'}&color=fff&bold=true&size=100`} alt={player.name} className="w-16 h-16 rounded-lg border-2 border-slate-200 dark:border-slate-700 shadow-sm transition-transform group-hover:scale-105" />
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white text-lg leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{player.name}</h3>
                                                <div className="flex items-center gap-2 mt-1 text-xs">
                                                    <span className="font-bold text-slate-500 dark:text-slate-400">#{player.number}</span>
                                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-500 rounded font-bold uppercase tracking-widest text-[10px]">{player.position}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* TAB: CALENDAR (NEW!) */}
                        {activeTab === 'calendar' && (
                            <div className="flex flex-col gap-4">
                                {schedule.length === 0 ? (
                                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-[#1e293b] rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
                                        <CalendarDays className="w-10 h-10 mb-4 opacity-50" />
                                        <p className="font-bold uppercase tracking-widest text-sm text-slate-600 dark:text-white">No Upcoming Directives</p>
                                    </div>
                                ) : (
                                    schedule.map(event => {
                                        const eventDate = new Date(event.date);
                                        return (
                                            <div key={event.id} className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg p-5 shadow-sm dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] flex items-center justify-between group hover:-translate-y-1 transition-all hover:border-emerald-500 dark:hover:border-emerald-500/50">
                                                <div className="flex items-center gap-4">
                                                    {/* Calendar Date Block */}
                                                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center shrink-0">
                                                        <span className="text-xs font-bold text-rose-600 dark:text-rose-500 uppercase leading-none mb-1">{eventDate.toLocaleString('default', { month: 'short' })}</span>
                                                        <span className="text-lg font-black text-slate-900 dark:text-white leading-none">{eventDate.getDate()}</span>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="font-black text-slate-900 dark:text-white text-lg">{event.title}</h3>
                                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded font-bold uppercase tracking-widest text-[9px] border border-slate-200 dark:border-slate-700">{event.type}</span>
                                                        </div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-bold flex items-center gap-3">
                                                            <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-emerald-500" /> {event.location}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Status Badge */}
                                                <span className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${
                                                    event.status === 'CONFIRMED' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 border-emerald-200 dark:border-emerald-500/30' :
                                                        event.status === 'PENDING' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-500 border-orange-200 dark:border-orange-500/30' :
                                                            'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                                                }`}>
                                                    {event.status}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* FALLBACK TABS */}
                        {!['our-club', 'teams', 'calendar'].includes(activeTab) && (
                            <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg p-16 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center text-center">
                                <Settings className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-4 animate-spin-slow" />
                                <h3 className="font-black text-slate-900 dark:text-white text-xl uppercase tracking-widest mb-2">Module Initializing</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">The '{activeTab.replace('-', ' ')}' interface is currently undergoing deployment protocols.</p>
                            </div>
                        )}
                    </main>

                    <ClubOpportunities club={club} />
                </div>
            </div>

            {/* MATCH INVITE MODAL */}
            {isMatchModalOpen && (
                <MatchInviteModal
                    targetClubName={club?.name || 'Unknown Club'}
                    onClose={() => setIsMatchModalOpen(false)}
                    onSubmit={handleSendMatchInvite}
                />
            )}

            {/* MANAGE ORG OVERLAY */}
            {isManageOrgOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
                    <div className="w-full max-w-6xl h-full max-h-[85vh] bg-[#0b141a] rounded-lg border-2 border-slate-700 shadow-2xl flex flex-col md:flex-row overflow-hidden relative">
                        <button onClick={() => setIsManageOrgOpen(false)} className="absolute top-4 right-4 z-50 p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-md transition-all">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="w-full md:w-72 bg-[#1e293b] border-r-2 border-black flex flex-col shrink-0">
                            <div className="p-6 border-b-2 border-black bg-slate-900/50">
                                <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2"><Settings className="w-5 h-5 text-emerald-500" /> Command</h2>
                            </div>
                            <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
                                {[ { id: 'personnel', icon: UserPlus, label: 'Personnel & Staff' }, { id: 'squads', icon: Network, label: 'Squad Architecture' }, { id: 'recruitment', icon: SlidersHorizontal, label: 'Recruitment Settings' }, { id: 'brand', icon: Paintbrush, label: 'Brand & Infrastructure' }, { id: 'directives', icon: Megaphone, label: 'Official Directives' } ].map(tab => (
                                    <button key={tab.id} onClick={() => setManageTab(tab.id as any)} className={`flex items-center gap-3 p-3 rounded-lg font-bold text-sm transition-all ${manageTab === tab.id ? 'bg-[#0b141a] text-emerald-500 shadow-inner' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                                        <tab.icon className="w-5 h-5" /> {tab.label}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 md:p-10">
                            {manageTab === 'personnel' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
                                        <div><h3 className="text-2xl font-black text-white">Active Personnel</h3><p className="text-slate-400 text-sm mt-1">Manage staff roles and clearances.</p></div>
                                        <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg transition-all flex items-center gap-2"><UserPlus className="w-4 h-4" /> Invite Staff</button>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        {staff.length === 0 ? <div className="py-8 text-center text-slate-500 bg-[#1e293b] rounded-lg border-2 border-dashed border-slate-700">No active personnel found</div> : staff.map(staffMember => (
                                            <div key={staffMember.id} className="bg-[#1e293b] p-4 rounded-lg border-2 border-black shadow-lg flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-black text-slate-400">{staffMember.name.substring(0,2).toUpperCase()}</div>
                                                    <div><h4 className="font-bold text-white text-base">{staffMember.name}</h4><p className="text-emerald-500 text-xs font-bold uppercase">{staffMember.role}</p></div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <span className="px-3 py-1 bg-slate-800 rounded text-xs font-bold text-slate-400 uppercase">{staffMember.clearance}</span>
                                                    <button className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {manageTab !== 'personnel' && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500"><Settings className="w-12 h-12 mb-4 opacity-50" /><h3 className="text-lg font-black uppercase tracking-widest text-slate-400">Module Initializing</h3><p className="text-sm font-medium mt-2">The {manageTab} configuration interface is currently under construction.</p></div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};