import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { useAuth } from '../../../context/AuthContext';
import { CreateLink } from '../../pages/create/CreateLink';
import { hasOwnPage } from '../../pages/create/entry';
import { pt } from '../../pages/copy';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Flag, Settings, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { Button, ButtonLink, List, ListRow } from '../../../design/primitives';
import { Fact, SideBlock } from '../../../design/profile/ProfileLayout';
import { Crest } from '../../world/Crest';
import { RepresentationPanel } from '../../agents/RepresentationPanel';
import { ClubApproachesPanel } from '../../agents/ClubApproachesPanel';
import { isAdult } from '../../../utils/age';
import type { EditRequest } from './PersonProfilePage';
import { PhoneInPlace } from './PhoneInPlace';
import type { PersonView } from './usePersonProfile';

interface FollowedClub { id: number; name: string; logoUrl?: string | null; cityName?: string | null; countryName?: string | null }

/**
 * Side facts for a person: about, playing details for players, and for yourself your phone for colleagues, your clubs
 * and account links. `edit` (`?edit=phone`) opens the phone in place.
 */
export function PersonSide({ view, edit = null }: { view: PersonView; edit?: EditRequest | null }) {
    const { profile, own, roles, hidden, possibleMinor } = view;
    const copy = useJourneyCopy();
    const { user } = useAuth();
    if (!profile) return null;
    const player = roles.includes('PLAYER') && !hidden;
    const history = profile.careerHistory ?? [];
    const totals = history.reduce((sum, item) => ({ apps: sum.apps + item.appearances, goals: sum.goals + item.goals, assists: sum.assists + item.assists }), { apps: 0, goals: 0, assists: 0 });
    // Body measurements stay off other people's view of a possible minor.
    const measurements = own || !possibleMinor;
    return <>
        {hidden && <SideBlock title={copy('Private profile', 'დახურული პროფილი')}><p>{copy('Only basic identity details are shown. Photos, personal details and personal posts are private.', 'ჩანს მხოლოდ ძირითადი მონაცემები. ფოტოები, პირადი დეტალები და პოსტები დახურულია.')}</p></SideBlock>}
        {player && <SideBlock title={copy('Player', 'მოთამაშე')}>
            <dl>
                {profile.position && <Fact label={copy('Position', 'პოზიცია')}>{[profile.position, profile.secondaryPosition].filter(Boolean).join(', ')}</Fact>}
                {profile.preferredFoot && <Fact label={copy('Preferred foot', 'წამყვანი ფეხი')}>{profile.preferredFoot}</Fact>}
                {measurements && profile.heightCm && <Fact label={copy('Height', 'სიმაღლე')}>{profile.heightCm} cm</Fact>}
                {measurements && profile.weightKg && <Fact label={copy('Weight', 'წონა')}>{profile.weightKg} kg</Fact>}
                {profile.availabilityStatus && <Fact label={copy('Availability', 'ხელმისაწვდომობა')}>{profile.availabilityStatus}</Fact>}
            </dl>
            {history.length > 0 && <>
                <div className="gk-person-record" aria-label={copy('Playing record', 'სათამაშო სტატისტიკა')}>
                    <span><strong className="gk-num">{totals.apps}</strong>{copy('Appearances', 'მატჩი')}</span>
                    <span><strong className="gk-num">{totals.goals}</strong>{copy('Goals', 'გოლი')}</span>
                    <span><strong className="gk-num">{totals.assists}</strong>{copy('Assists', 'საგოლე გადაცემა')}</span>
                </div>
                <List label={copy('Seasons', 'სეზონები')}>{history.slice(0, 4).map(item => <ListRow key={item.id} title={`${item.season} · ${item.clubName}`}
                    meta={`${item.category} · ${copy(`${item.appearances} apps · ${item.goals} goals`, `${item.appearances} მატჩი · ${item.goals} გოლი`)}${item.cleanSheets ? copy(` · ${item.cleanSheets} clean sheets`, ` · ${item.cleanSheets} მშრალი მატჩი`) : ''}`} />)}</List>
                <p className="gk-faint">{copy('Recorded by the clubs.', 'კლუბების ჩანაწერი.')}</p>
            </>}
        </SideBlock>}
        {/* Adults only: an account without a birth date is asked for it first; a child sees no phone box. */}
        {own && (isAdult(user?.dob) || !user?.dob) && <PhoneInPlace key={`phone:${edit?.counts.phone ?? 0}`} phone={profile.phone ?? null} open={edit?.part === 'phone'}
            needsBirthDate={!user?.dob} onSaved={phone => view.setProfile(current => current ? { ...current, phone } : current)} />}
        {own && <FollowedClubs />}
        {own && user?.navigationCapabilities !== undefined && !hasOwnPage(user.navigationCapabilities) && <SideBlock title={pt('Your club')}><CreateLink kind="CLUB" from="profile" size="sm">{pt('Add your club')}</CreateLink></SideBlock>}
        {(roles.includes('AGENT') || (roles.includes('PLAYER') && !possibleMinor)) && <RepresentationPanel profileId={profile.id} own={own} roles={roles} />}
        {own && (roles.includes('PLAYER') || roles.includes('PARENT')) && <ClubApproachesPanel mode="participant" />}
        {own && <SideBlock title={copy('Your account', 'თქვენი ანგარიში')}>
            <List label={copy('Account links', 'ანგარიშის ბმულები')}>
                <ListRow to="/account?tab=profile" lead={<Settings size={18} aria-hidden="true" />} title={copy('Account settings', 'ანგარიშის პარამეტრები')} meta={copy('Name, photos, privacy and sign-in', 'სახელი, ფოტოები, კონფიდენციალურობა და შესვლა')} />
                <ListRow to="/requests?view=updates&scope=personal" lead={<BellRing size={18} aria-hidden="true" />} title={copy('Notifications', 'შეტყობინებები')} />
                <ListRow to="/reports" lead={<Flag size={18} aria-hidden="true" />} title={copy('Reports and safety', 'საჩივრები და უსაფრთხოება')} />
            </List>
        </SideBlock>}
        {!own && !hidden && (view.football?.lines.length ?? 0) === 0 && (profile.footballProfile?.appointments.length ?? 0) === 0 && <SideBlock title={copy('How this profile is checked', 'როგორ მოწმდება ეს პროფილი')}>
            <p className="gk-row"><ShieldCheck size={16} aria-hidden="true" />{copy('No club has confirmed anything here yet. What they do is in their own words.', 'ამ პროფილზე კლუბს ჯერ არაფერი დაუდასტურებია. საქმიანობა თავად არის მითითებული.')}</p>
        </SideBlock>}
    </>;
}

function FollowedClubs() {
    const copy = useJourneyCopy();
    const [revision, setRevision] = useState(0);
    const [result, setResult] = useState<{ revision: number; clubs: FollowedClub[]; failed: boolean } | null>(null);
    const current = result?.revision === revision ? result : null;
    const clubs = current?.clubs ?? null;
    useEffect(() => {
        const controller = new AbortController();
        void apiClient.get<FollowedClub[]>('/clubs/followed', { signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) setResult({ revision, clubs: response.data, failed: false }); })
            .catch(() => { if (!controller.signal.aborted) setResult({ revision, clubs: [], failed: true }); });
        return () => controller.abort();
    }, [revision]);
    return <SideBlock title={copy('Clubs you follow', 'გამოწერილი კლუბები')} action={clubs?.length ? <Link className="gk-section__action" to="/world/clubs?view=following">{copy('See all', 'ყველა')}</Link> : undefined}>
        {current?.failed ? <><p role="alert">{copy('Followed clubs couldn’t load.', 'გამოწერილი კლუბები ვერ ჩაიტვირთა.')}</p><Button size="sm" onClick={() => setRevision(value => value + 1)}>{copy('Try again', 'ხელახლა ცდა')}</Button></>
            : clubs === null ? <p role="status">{copy('Loading…', 'იტვირთება…')}</p> : clubs.length ? <List label={copy('Followed clubs', 'გამოწერილი კლუბები')}>{clubs.slice(0, 5).map(club => <ListRow key={club.id} to={`/clubs/${club.id}`}
            lead={<Crest src={club.logoUrl} name={club.name} size={36} />} title={club.name} meta={[club.cityName, club.countryName].filter(Boolean).join(', ')} />)}</List>
            : <><p>{copy('Follow clubs to see their posts on Home.', 'გამოიწერეთ კლუბები და მათი პოსტები მთავარ გვერდზე გამოჩნდება.')}</p><ButtonLink size="sm" to="/world/clubs">{copy('Find clubs', 'კლუბების მოძებნა')}</ButtonLink></>}
    </SideBlock>;
}
