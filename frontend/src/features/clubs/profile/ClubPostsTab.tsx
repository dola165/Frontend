import { PostComposer } from '../../../components/feed/PostComposer';
import { Section } from '../../../design/primitives';
import { ProfilePosts } from '../../profiles/ProfilePosts';
import { useProfilePostFeed } from '../../profiles/useProfilePostFeed';
import type { ClubPermissions } from './useClubProfile';
import type { ClubProfile } from './types';

/** Everything the club has posted, newest first, in the Home feed style. Club staff can post from here. */
export function ClubPostsTab({ club, can }: { club: ClubProfile; can: ClubPermissions }) {
    const feed = useProfilePostFeed(`/posts/club/${club.id}`);
    return <Section title="Posts" hint={`News, results and photos from ${club.name}`}>
        <ProfilePosts feed={feed}
            composer={can.canPost ? <PostComposer home compact clubId={club.id} authorName={club.name} avatarUrl={club.logoUrl} onPostCreated={feed.pages.refresh} /> : undefined}
            empty={{ title: 'No posts yet', body: can.canPost ? 'Share the first update above. It appears on this page and in your followers’ Home feed.' : 'When the club shares news, photos and results, they appear here.' }} />
    </Section>;
}
