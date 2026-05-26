import { useEffect, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { Loader2, Megaphone } from 'lucide-react';
import { PostComposer } from '../../feed/PostComposer';
import { type FeedPostDto, type CommentDto } from '../../feed/FeedPost';
import { FeedList } from '../../feed/FeedList';
import { PostTheaterModal } from '../../PostTheaterModal';
import type { ClubProfile } from '../../../pages/ClubProfilePage';

interface TabOverviewProps {
    club: ClubProfile;
    isOwnClubAdmin: boolean;
}

export const TabOverview = ({ club, isOwnClubAdmin }: TabOverviewProps) => {
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);

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
        } catch {
            alert('Failed to post comment.');
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

            {posts.length === 0 ? (
                <div className="flex min-h-[180px] items-center justify-center rounded-[18px] border border-[color:var(--club-theme-border-subtle)] bg-[rgba(12,18,27,0.96)] px-5 py-10 text-center shadow-[0_18px_32px_rgba(2,6,12,0.22)]">
                    <div>
                        <Megaphone className="mx-auto h-8 w-8 text-[color:var(--club-theme-text-secondary)]" />
                        <h3 className="mt-4 text-lg font-black uppercase tracking-[0.14em] text-[color:var(--club-theme-text-primary)]">Silence On The Network</h3>
                        <p className="mt-2 text-sm text-[color:var(--club-theme-text-secondary)]">No transmissions intercepted yet.</p>
                    </div>
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
