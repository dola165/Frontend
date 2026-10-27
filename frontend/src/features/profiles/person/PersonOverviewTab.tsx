import { Link } from 'react-router-dom';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { ButtonLink, EmptyNote, Panel, Section } from '../../../design/primitives';
import { AboutInPlace } from '../football/AboutInPlace';
import { ProfilePosts } from '../ProfilePosts';
import { useProfilePostFeed } from '../useProfilePostFeed';
import { PersonLayers } from './PersonLayers';
import type { EditRequest } from './PersonProfilePage';
import type { PersonView } from './usePersonProfile';

/**
 * Who this person is (in their own words, where they are in football, their career, what they do), then their latest
 * posts. On their own profile a quiet "Change what brings you here" opens the welcome at step 1, even after it ended.
 */
/** `edit` (from `?edit=about|work`) opens that part in place; each new request reopens it, without touching the other. */
export function PersonOverviewTab({ view, edit = null }: { view: PersonView; edit?: EditRequest | null }) {
    const { profile, own, hidden, professions, professionsFailed } = view;
    const copy = useJourneyCopy();
    const feed = useProfilePostFeed(`/posts/user/${profile!.id}`, 3);
    if (!profile) return null;
    if (hidden) return <Panel><EmptyNote title={copy('This profile is private', 'ეს პროფილი დახურულია')}>{copy('Only basic identity details are shown. Photos, personal details and personal posts are private.', 'ჩანს მხოლოდ ძირითადი მონაცემები. ფოტოები, პირადი დეტალები და პოსტები დახურულია.')}</EmptyNote></Panel>;
    return <>
        {/* The tab is already called About: the words come without another heading. Nothing shows for someone who wrote none. */}
        {own ? <div id="about"><AboutInPlace key={`${profile.id}:${edit?.counts.about ?? 0}`} bio={profile.bio ?? ''} open={edit?.part === 'about'} onSaved={bio => view.setProfile(current => current ? { ...current, bio } : current)} /></div>
            : profile.bio && <p className="gk-person-bio">{profile.bio}</p>}
        <PersonLayers key={`work:${edit?.counts.work ?? 0}`} profile={profile} football={view.football} professions={professions} professionsFailed={professionsFailed} own={own} editWork={edit?.part === 'work'} onRetryProfessions={view.reload} onProfessionsChanged={view.reload} />
        <Section title={own ? copy('Your latest posts', 'თქვენი ბოლო პოსტები') : copy('Latest posts', 'ბოლო პოსტები')}>
            <ProfilePosts feed={feed} preview={{ count: 2, allTo: `/profile/${profile.id}?tab=posts` }}
                empty={{ title: copy('No posts yet', 'პოსტები ჯერ არ არის'), body: own ? copy('Share an update from the Posts tab. Your followers see it on Home.', 'გააზიარეთ სიახლე პოსტების ჩანართიდან. გამომწერები მას მთავარ გვერდზე ნახავენ.') : undefined, action: own ? <ButtonLink size="sm" to={`/profile/${profile.id}?tab=posts`}>{copy('Write a post', 'პოსტის დაწერა')}</ButtonLink> : undefined }} />
        </Section>
        {own && <Link className="gk-person-rewelcome" to="/home?welcome=start">{copy('Change what brings you here', 'შეცვალეთ, რამ მოგიყვანათ აქ')}</Link>}
    </>;
}
