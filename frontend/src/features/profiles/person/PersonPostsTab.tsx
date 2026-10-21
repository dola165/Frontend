import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { PostComposer } from '../../../components/feed/PostComposer';
import { Section } from '../../../design/primitives';
import { ProfilePosts } from '../ProfilePosts';
import { useProfilePostFeed } from '../useProfilePostFeed';
import type { PersonView } from './usePersonProfile';

/** A person's posts, newest first. On your own profile you can post from here. */
export function PersonPostsTab({ view }: { view: PersonView }) {
    const { profile, own } = view;
    const copy = useJourneyCopy();
    const feed = useProfilePostFeed(`/posts/user/${profile!.id}`);
    if (!profile) return null;
    const name = profile.fullName || profile.username;
    return <Section title={own ? copy('Your posts', 'თქვენი პოსტები') : copy('Posts', 'პოსტები')}>
        <ProfilePosts feed={feed}
            composer={own ? <PostComposer home compact authorName={name} avatarUrl={profile.avatarUrl} onPostCreated={feed.pages.refresh} /> : undefined}
            empty={{ title: copy('No posts yet', 'პოსტები ჯერ არ არის'), body: own ? copy('Share an update above. Your followers see it on Home.', 'გააზიარეთ სიახლე ზემოთ. გამომწერები მას მთავარ გვერდზე ნახავენ.') : copy(`${name.split(' ')[0]} hasn’t posted anything public yet.`, `${name.split(' ')[0]}-ს საჯარო პოსტი ჯერ არ აქვს.`) }} />
    </Section>;
}
