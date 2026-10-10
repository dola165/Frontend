import { PostComposer } from '../../../components/feed/PostComposer';
import { Section } from '../../../design/primitives';
import { ProfilePosts } from '../ProfilePosts';
import { useProfilePostFeed } from '../useProfilePostFeed';
import type { PersonView } from './usePersonProfile';

/** A person's posts, newest first. On your own profile you can post from here. */
export function PersonPostsTab({ view }: { view: PersonView }) {
    const { profile, own } = view;
    const feed = useProfilePostFeed(`/posts/user/${profile!.id}`);
    if (!profile) return null;
    const name = profile.fullName || profile.username;
    return <Section title={own ? 'Your posts' : 'Posts'}>
        <ProfilePosts feed={feed}
            composer={own ? <PostComposer home compact authorName={name} avatarUrl={profile.avatarUrl} onPostCreated={feed.pages.refresh} /> : undefined}
            empty={{ title: 'No posts yet', body: own ? 'Share an update above. Your followers see it on Home.' : `${name.split(' ')[0]} hasn’t posted anything public yet.` }} />
    </Section>;
}
