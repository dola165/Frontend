import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { Link } from 'react-router-dom';
import { ButtonLink, EmptyNote, Panel, Section } from '../../../design/primitives';
import { ProfilePosts } from '../ProfilePosts';
import { useProfilePostFeed } from '../useProfilePostFeed';
import { PersonLayers } from './PersonLayers';
import type { PersonView } from './usePersonProfile';

/** Who this person is (in their own words, their roles, their work, what a club confirmed), then their latest posts. */
export function PersonOverviewTab({ view }: { view: PersonView }) {
    const { profile, own, roles, hidden, professions, professionsFailed } = view;
    const copy = useJourneyCopy();
    const feed = useProfilePostFeed(`/posts/user/${profile!.id}`, 3);
    if (!profile) return null;
    const first = profile.fullName?.split(' ')[0] || profile.username;
    if (hidden) return <Panel><EmptyNote title={copy('This profile is private', 'ეს პროფილი დახურულია')}>{copy('Only basic identity details are shown. Photos, personal details and personal posts are private.', 'ჩანს მხოლოდ ძირითადი მონაცემები. ფოტოები, პირადი დეტალები და პოსტები დახურულია.')}</EmptyNote></Panel>;
    return <>
        <Section title={copy('About', 'შესახებ')} action={own ? <Link className="gk-section__action" to="/account/roles#about">{profile.bio ? copy('Edit', 'შეცვლა') : copy('Add', 'დამატება')}</Link> : undefined}>
            {profile.bio ? <p className="gk-person-bio">{profile.bio}</p>
                : <Panel><EmptyNote title={own ? copy('Introduce yourself', 'წარადგინეთ თავი') : copy(`${first} hasn’t written an introduction yet`, `${first}-ს შესავალი ჯერ არ დაუწერია`)} action={own ? <ButtonLink size="sm" to="/account/roles#about">{copy('Write about yourself', 'დაწერეთ თქვენ შესახებ')}</ButtonLink> : undefined}>
                    {own ? 'A few lines about your football and your work help clubs and parents know who you are.' : undefined}
                </EmptyNote></Panel>}
        </Section>
        <PersonLayers profile={profile} roles={roles} professions={professions} professionsFailed={professionsFailed} own={own} />
        <Section title={own ? copy('Your latest posts', 'თქვენი ბოლო პოსტები') : copy('Latest posts', 'ბოლო პოსტები')}>
            <ProfilePosts feed={feed} preview={{ count: 2, allTo: `/profile/${profile.id}?tab=posts` }}
                empty={{ title: copy('No posts yet', 'პოსტები ჯერ არ არის'), body: own ? copy('Share an update from the Posts tab. Your followers see it on Home.', 'გააზიარეთ სიახლე პოსტების ჩანართიდან. გამომწერები მას მთავარ გვერდზე ნახავენ.') : undefined, action: own ? <ButtonLink size="sm" to={`/profile/${profile.id}?tab=posts`}>{copy('Write a post', 'პოსტის დაწერა')}</ButtonLink> : undefined }} />
        </Section>
    </>;
}
