import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Loader2, PlayCircle, Video } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import type { FeedPostDto } from '../../feed/FeedPost';

export type ClubMediaType = 'pictures' | 'videos';

const isVideoUrl = (url: string) => Boolean(url.match(/\.(mp4|mov|webm)$/i));

export const TabMedia = ({ clubId, mediaType }: { clubId: number; mediaType: ClubMediaType }) => {
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const isVideos = mediaType === 'videos';

    const loadMedia = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/posts/club/${clubId}`);
            setPosts(response.data.posts || []);
        } catch (error) {
            console.error('Failed to load club media', error);
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        void loadMedia();
    }, [loadMedia]);

    const mediaItems = useMemo(() => {
        const items = posts
            .flatMap((post) => (post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : post.image ? [post.image] : [])
                .map((url) => ({
                    url,
                    postId: post.id,
                    title: post.content || post.clubName || post.authorName
                })));
        return items.filter((item) => {
            const resolved = resolveMediaUrl(item.url) ?? '';
            return isVideos ? isVideoUrl(resolved) : !isVideoUrl(resolved);
        });
    }, [posts, isVideos]);

    if (loading) {
        return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-[color:var(--club-tone-green)]" /></div>;
    }

    if (mediaItems.length === 0) {
        return (
            <section className="rounded-[24px] border border-[color:var(--club-theme-border-subtle)] bg-[rgba(12,18,27,0.96)] px-5 py-14 text-center shadow-[0_18px_32px_rgba(2,6,12,0.22)]">
                {isVideos ? (
                    <Video className="mx-auto h-10 w-10 text-[color:var(--club-theme-text-secondary)]" />
                ) : (
                    <Camera className="mx-auto h-10 w-10 text-[color:var(--club-theme-text-secondary)]" />
                )}
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[color:var(--club-theme-text-primary)]">
                    {isVideos ? 'No videos published yet' : 'No pictures published yet'}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--club-theme-text-secondary)]">
                    {isVideos
                        ? 'Match highlights and training clips will appear here once the club shares them.'
                        : 'Photos and match-day visuals will appear here once the club shares them.'}
                </p>
            </section>
        );
    }

    return (
        <section className="rounded-[24px] border border-[color:var(--club-theme-border-subtle)] bg-[rgba(12,18,27,0.96)] p-5 shadow-[0_18px_32px_rgba(2,6,12,0.22)]">
            <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold  text-[color:var(--club-tone-green)]">{isVideos ? 'Videos' : 'Pictures'}</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--club-theme-text-primary)]">
                        {isVideos ? 'Club videos' : 'Club pictures'}
                    </h2>
                </div>
                <p className="text-[11px] font-semibold  text-[color:var(--club-theme-text-secondary)]">
                    {mediaItems.length} {isVideos ? 'videos' : 'pictures'}
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {mediaItems.map((item) => {
                    const finalUrl = resolveMediaUrl(item.url);
                    const isVideo = isVideoUrl(finalUrl ?? '');

                    return (
                        <article key={`${item.postId}-${item.url}`} className="group overflow-hidden rounded-[18px] border border-white/6 bg-white/[0.03]">
                            <div className="relative aspect-[4/3] overflow-hidden bg-black/20">
                                {isVideo ? (
                                    <video src={finalUrl} className="h-full w-full object-cover" />
                                ) : (
                                    <img src={finalUrl || ''} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                                )}
                                {isVideo ? (
                                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/54 px-2.5 py-1 text-[10px] font-semibold  text-white">
                                        <PlayCircle className="h-3.5 w-3.5" />
                                        Video
                                    </span>
                                ) : null}
                            </div>
                            <div className="px-4 py-3">
                                <p className="max-h-12 overflow-hidden text-sm leading-6 text-[color:var(--club-theme-text-primary)]">{item.title}</p>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
};
