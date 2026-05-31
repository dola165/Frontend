import { useEffect, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { CheckCircle, ChevronRight, Loader2, MapPin, Megaphone, UserPlus, Users, X } from 'lucide-react';
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
                <div className="rounded-[18px] border border-[color:var(--club-theme-border-subtle)] bg-[rgba(12,18,27,0.96)] p-5 shadow-[0_18px_32px_rgba(2,6,12,0.22)]">
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[color:var(--club-theme-text-primary)]">Setup Checklist</h3>
                            <p className="mt-1 text-xs text-[color:var(--club-theme-text-secondary)]">Complete these steps to get your club ready for action.</p>
                        </div>
                        <button
                            type="button"
                            onClick={dismissChecklist}
                            className="shrink-0 p-1 text-[color:var(--club-theme-text-secondary)] hover:text-[color:var(--club-theme-text-primary)] transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="space-y-1">
                        {[
                            { icon: MapPin, label: 'Add club location', desc: 'Pin your club on the map so players can find you', tab: 'personnel' as ClubManagementTab },
                            { icon: Users, label: 'Create your first squad', desc: 'Set up age-group or competitive squads', tab: 'squads' as ClubManagementTab },
                            { icon: UserPlus, label: 'Invite staff members', desc: 'Bring in coaches, admins, and players', tab: 'invites' as ClubManagementTab },
                            { icon: Megaphone, label: 'Post your first update', desc: 'Share news or welcome message with followers', tab: null }
                        ].map((item) => (
                            <div key={item.label} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors">
                                <item.icon className="h-4 w-4 shrink-0 text-[color:var(--club-theme-text-secondary)]" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-[color:var(--club-theme-text-primary)]">{item.label}</p>
                                    <p className="text-[11px] text-[color:var(--club-theme-text-secondary)]">{item.desc}</p>
                                </div>
                                {item.tab && onOpenManageClub ? (
                                    <button
                                        type="button"
                                        onClick={() => onOpenManageClub(item.tab!)}
                                        className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[color:var(--club-theme-text-secondary)] hover:text-[color:var(--club-theme-text-primary)] transition-colors"
                                    >
                                        Go <ChevronRight className="h-3 w-3" />
                                    </button>
                                ) : (
                                    <CheckCircle className="h-4 w-4 shrink-0 text-[color:var(--club-theme-text-secondary)]" />
                                )}
                            </div>
                        ))}
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
