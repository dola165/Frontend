import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { EmptyNote, Skeleton } from '../../../design/primitives';
import { MediaImage } from '../../../components/ui/MediaImage';
import type { FeedPostDto } from '../../../components/feed/FeedPost';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { formatDate } from '../../../utils/formatting';
import './club-post-strip.css';

/** The latest posts as one horizontal strip, read like Facebook, ending in a clear way to every post. */
export function ClubPostStrip({ posts, loading, allTo, empty }: { posts: FeedPostDto[]; loading: boolean; allTo: string; empty: { title: string; body: string } }) {
    if (loading && !posts.length) return <div className="gk-post-strip" role="status" aria-label="Loading posts">{[0, 1, 2].map(i => <Skeleton key={i} height={196} />)}</div>;
    if (!posts.length) return <EmptyNote title={empty.title}>{empty.body}</EmptyNote>;
    return <ul className="gk-post-strip" aria-label="Latest posts">
        {posts.map(post => {
            const media = post.mediaUrls?.[0] ?? post.image;
            const reactions = post.reactionCount ?? post.likeCount;
            return <li key={post.id}><Link className={`gk-post-card${media ? '' : ' gk-post-card--text'}`} to={`/posts/${post.id}`}>
                {media && <MediaImage src={resolveMediaUrl(media)} alt="" className="gk-post-card__media" />}
                <span className="gk-post-card__text">{post.content}</span>
                <span className="gk-post-card__meta">{[formatDate(post.createdAt, { day: 'numeric', month: 'short' }), reactions ? `${reactions} reactions` : null, post.commentCount ? `${post.commentCount} comments` : null].filter(Boolean).join(' · ')}</span>
            </Link></li>;
        })}
        <li><Link className="gk-post-card gk-post-card--all" to={allTo}>See all posts<ArrowRight aria-hidden="true" /></Link></li>
    </ul>;
}
