import { Link } from 'react-router-dom';
import { ButtonLink, EmptyNote, Panel, Section } from '../../../design/primitives';
import { ProfilePosts } from '../ProfilePosts';
import { useProfilePostFeed } from '../useProfilePostFeed';
import { PersonLayers } from './PersonLayers';
import type { PersonView } from './usePersonProfile';

/** Who this person is (in their own words, their roles, their work, what a club confirmed), then their latest posts. */
export function PersonOverviewTab({ view }: { view: PersonView }) {
    const { profile, own, roles, hidden, professions, professionsFailed } = view;
    const feed = useProfilePostFeed(`/posts/user/${profile!.id}`, 3);
    if (!profile) return null;
    const first = profile.fullName?.split(' ')[0] || profile.username;
    if (hidden) return <Panel><EmptyNote title="This profile is private">Only basic identity details are shown. Photos, personal details and personal posts are private.</EmptyNote></Panel>;
    return <>
        <Section title="About" action={own ? <Link className="gk-section__action" to="/account/roles#about">{profile.bio ? 'Edit' : 'Add'}</Link> : undefined}>
            {profile.bio ? <p className="gk-person-bio">{profile.bio}</p>
                : <Panel><EmptyNote title={own ? 'Introduce yourself' : `${first} hasn’t written an introduction yet`} action={own ? <ButtonLink size="sm" to="/account/roles#about">Write about yourself</ButtonLink> : undefined}>
                    {own ? 'A few lines about your football and your work help clubs and parents know who you are.' : undefined}
                </EmptyNote></Panel>}
        </Section>
        <PersonLayers profile={profile} roles={roles} professions={professions} professionsFailed={professionsFailed} own={own} />
        <Section title={own ? 'Your latest posts' : 'Latest posts'}>
            <ProfilePosts feed={feed} preview={{ count: 2, allTo: `/profile/${profile.id}?tab=posts` }}
                empty={{ title: 'No posts yet', body: own ? 'Share an update from the Posts tab. Your followers see it on Home.' : undefined, action: own ? <ButtonLink size="sm" to={`/profile/${profile.id}?tab=posts`}>Write a post</ButtonLink> : undefined }} />
        </Section>
    </>;
}
