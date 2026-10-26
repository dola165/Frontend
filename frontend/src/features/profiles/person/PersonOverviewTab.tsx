import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { ButtonLink, EmptyNote, Panel, Section } from '../../../design/primitives';
import { AboutInPlace } from '../football/AboutInPlace';
import { ProfilePosts } from '../ProfilePosts';
import { useProfilePostFeed } from '../useProfilePostFeed';
import { PersonLayers } from './PersonLayers';
import type { PersonView } from './usePersonProfile';

/** Who this person is (in their own words, where they are in football, their career, what they do), then their latest posts. */
export function PersonOverviewTab({ view, edit = null }: { view: PersonView; /** `?edit=about|work` opens that part in place. */ edit?: string | null }) {
    const { profile, own, hidden, professions, professionsFailed } = view;
    const copy = useJourneyCopy();
    const feed = useProfilePostFeed(`/posts/user/${profile!.id}`, 3);
    if (!profile) return null;
    if (hidden) return <Panel><EmptyNote title={copy('This profile is private', 'ეს პროფილი დახურულია')}>{copy('Only basic identity details are shown. Photos, personal details and personal posts are private.', 'ჩანს მხოლოდ ძირითადი მონაცემები. ფოტოები, პირადი დეტალები და პოსტები დახურულია.')}</EmptyNote></Panel>;
    return <>
        {/* The tab is already called About: the words come without another heading. Nothing shows for someone who wrote none. */}
        {own ? <div id="about"><AboutInPlace key={profile.id} bio={profile.bio ?? ''} open={edit === 'about'} onSaved={bio => view.setProfile(current => current ? { ...current, bio } : current)} /></div>
            : profile.bio && <p className="gk-person-bio">{profile.bio}</p>}
        <PersonLayers profile={profile} football={view.football} professions={professions} professionsFailed={professionsFailed} own={own} editWork={edit === 'work'} onRetryProfessions={view.reload} onProfessionsChanged={view.reload} />
        <Section title={own ? copy('Your latest posts', 'თქვენი ბოლო პოსტები') : copy('Latest posts', 'ბოლო პოსტები')}>
            <ProfilePosts feed={feed} preview={{ count: 2, allTo: `/profile/${profile.id}?tab=posts` }}
                empty={{ title: copy('No posts yet', 'პოსტები ჯერ არ არის'), body: own ? copy('Share an update from the Posts tab. Your followers see it on Home.', 'გააზიარეთ სიახლე პოსტების ჩანართიდან. გამომწერები მას მთავარ გვერდზე ნახავენ.') : undefined, action: own ? <ButtonLink size="sm" to={`/profile/${profile.id}?tab=posts`}>{copy('Write a post', 'პოსტის დაწერა')}</ButtonLink> : undefined }} />
        </Section>
    </>;
}
