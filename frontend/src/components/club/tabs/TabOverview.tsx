import { useEffect, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { ArrowRight, CheckCircle, Loader2, MapPin, Megaphone, Sparkles, UserPlus, Users, X } from 'lucide-react';
import { PostComposer } from '../../feed/PostComposer';
import { type FeedPostDto, type CommentDto } from '../../feed/FeedPost';
import { FeedList } from '../../feed/FeedList';
import { PostTheaterModal } from '../../PostTheaterModal';
import type { ClubProfile } from '../../../pages/ClubProfilePage';
import type { ClubManagementTab } from '../../club/ClubManagementModal';

const SETUP_CHECKLIST_KEY = 'club_setup_checklist_dismissed';

interface TabOverviewProps {
    club: ClubProfile;
    isOwnClubAdmin: boolean;
    onOpenManageClub?: (tab: ClubManagementTab) => void;
}

export const TabOverview = ({ club, isOwnClubAdmin, onOpenManageClub }: TabOverviewProps) => {
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);
    const [checklistDismissed, setChecklistDismissed] = useState(() => {
        try {
            return localStorage.getItem(`${SETUP_CHECKLIST_KEY}_${club.id}`) === 'true';
        } catch {
            return false;
        }
    });

    const dismissChecklist = () => {
        setChecklistDismissed(true);
        try {
            localStorage.setItem(`${SETUP_CHECKLIST_KEY}_${club.id}`, 'true');
        } catch { /* localStorage unavailable */ }
    };

    const loadFeed = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/posts/club/${club.id}`);
            setPosts(response.data.posts || []);
        } catch (error) {
            console.error('Failed to load club feed', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadFeed();
    }, [club.id]);

    const handleLikeToggle = async (postId: number) => {
        setPosts((current) =>
            current.map((post) =>
                post.id === postId
                    ? { ...post, isLikedByMe: !post.isLikedByMe, likeCount: post.isLikedByMe ? post.likeCount - 1 : post.likeCount + 1 }
                    : post
            )
        );

        if (selectedPost?.id === postId) {
            setSelectedPost((prev) =>
                prev ? { ...prev, isLikedByMe: !prev.isLikedByMe, likeCount: prev.isLikedByMe ? prev.likeCount - 1 : prev.likeCount + 1 } : null
            );
        }

        try {
            await apiClient.post(`/posts/${postId}/like`);
        } catch {
            // Keep optimistic UI.
        }
    };

    const toggleComments = async (postId: number) => {
        const isOpen = openComments[postId];
        setOpenComments((prev) => ({ ...prev, [postId]: !isOpen }));
        if (!isOpen && !commentsData[postId]) {
            try {
                const response = await apiClient.get<CommentDto[]>(`/posts/${postId}/comments`);
                setCommentsData((prev) => ({ ...prev, [postId]: response.data }));
            } catch (error) {
                console.error(error);
            }
        }
    };

    const submitComment = async (postId: number, content: string) => {
        try {
            const response = await apiClient.post<CommentDto>(`/posts/${postId}/comments`, { content });
            setCommentsData((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), response.data] }));
            setPosts((current) => current.map((post) => (post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post)));
            if (selectedPost?.id === postId) {
                setSelectedPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : null));
            }
        } catch (error) {
            console.error('Failed to post comment', error);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin accent-primary" />
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
            {isOwnClubAdmin && <PostComposer clubId={club.id} authorName={club.name} onPostCreated={loadFeed} compact />}

            {isOwnClubAdmin && !checklistDismissed && (
                <div className="relative overflow-hidden rounded-[18px] border-2 border-amber-400/40 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-5 shadow-[0_8px_32px_rgba(251,191,36,0.15)] dark:border-amber-500/30 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-rose-950/40 dark:shadow-[0_8px_32px_rgba(251,191,36,0.08)]">
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-400/20 dark:bg-amber-400/10" />
                    <div className="absolute -left-4 -bottom-4 h-16 w-16 rounded-full bg-rose-300/20 dark:bg-rose-400/10" />
                    <div className="relative">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-amber-900 shadow-[0_2px_8px_rgba(251,191,36,0.4)]">
                                    <Sparkles className="h-4 w-4" />
                                </span>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">Getting Started</h3>
                                    <p className="mt-0.5 text-xs font-medium text-amber-700/70 dark:text-amber-300/60">Follow these steps to set up your club — it only takes a minute!</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={dismissChecklist}
                                className="shrink-0 rounded-full p-1.5 text-amber-500 hover:bg-amber-200/50 hover:text-amber-700 dark:hover:bg-amber-800/40 dark:hover:text-amber-300 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {[
                                { step: 1, icon: MapPin, label: 'Add club location', desc: 'Pin your club on the map so players can find you', tab: 'personnel' as ClubManagementTab },
                                { step: 2, icon: Users, label: 'Create your first squad', desc: 'Set up age-group or competitive squads', tab: 'squads' as ClubManagementTab },
                                { step: 3, icon: UserPlus, label: 'Invite staff members', desc: 'Bring in coaches, admins, and players', tab: 'invites' as ClubManagementTab },
                                { step: 4, icon: Megaphone, label: 'Post your first update', desc: 'Share news or welcome message with followers', tab: null }
                            ].map((item) => (
                                <div key={item.label} className="flex items-center gap-3 rounded-xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-amber-200/50 transition-all hover:bg-white hover:shadow-md hover:ring-amber-300/60 dark:bg-white/5 dark:ring-amber-700/30 dark:hover:bg-white/8 dark:hover:ring-amber-600/40">
                                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-black text-amber-900 shadow-[0_1px_4px_rgba(251,191,36,0.5)]">
                                        {item.step}
                                    </span>
                                    <item.icon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</p>
                                    </div>
                                    {item.tab && onOpenManageClub ? (
                                        <button
                                            type="button"
                                            onClick={() => onOpenManageClub(item.tab!)}
                                            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-900 shadow-[0_2px_6px_rgba(251,191,36,0.35)] transition-all hover:bg-amber-500 hover:shadow-[0_4px_10px_rgba(251,191,36,0.45)] active:translate-y-0.5"
                                        >
                                            Go <ArrowRight className="h-3 w-3" />
                                        </button>
                                    ) : (
                                        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-wider text-amber-600/60 dark:text-amber-400/40">
                            You can skip this and set things up later from Manage Club
                        </p>
                    </div>
                </div>
            )}

            {posts.length === 0 ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center gap-4 rounded-[18px] border border-[color:var(--club-theme-border-subtle)] bg-[rgba(12,18,27,0.96)] px-5 py-10 text-center shadow-[0_18px_32px_rgba(2,6,12,0.22)]">
                    <Megaphone className="h-8 w-8 text-[color:var(--club-theme-text-secondary)]" />
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-[0.14em] text-[color:var(--club-theme-text-primary)]">No Posts Yet</h3>
                        <p className="mt-2 text-sm text-[color:var(--club-theme-text-secondary)]">Share your first update with the club using the composer above.</p>
                    </div>
                    {isOwnClubAdmin && onOpenManageClub && (
                        <button
                            type="button"
                            onClick={() => onOpenManageClub('squads')}
                            className="mt-2 inline-flex items-center gap-2 border border-[color:var(--club-theme-border-subtle)] bg-white/[0.04] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--club-theme-text-secondary)] transition-colors hover:text-[color:var(--club-theme-text-primary)] hover:border-white/20"
                        >
                            <Users className="h-3.5 w-3.5" />
                            Create Your First Squad
                        </button>
                    )}
                </div>
            ) : (
                <FeedList
                    posts={posts}
                    openComments={openComments}
                    commentsData={commentsData}
                    onLikeToggle={handleLikeToggle}
                    onToggleComments={toggleComments}
                    onSubmitComment={submitComment}
                    onSelectPost={(post) => {
                        setSelectedPost(post);
                        if (!commentsData[post.id]) {
                            void toggleComments(post.id);
                        }
                    }}
                    compact
                />
            )}

            <PostTheaterModal
                isOpen={!!selectedPost}
                post={selectedPost}
                onClose={() => setSelectedPost(null)}
                commentsData={selectedPost ? commentsData[selectedPost.id] : undefined}
                onSubmitComment={submitComment}
                onLikeToggle={handleLikeToggle}
            />
        </div>
    );
};
