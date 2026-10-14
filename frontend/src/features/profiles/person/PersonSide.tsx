import { useAuth } from '../../../context/AuthContext';
import { CreateLink } from '../../pages/create/CreateLink';
import { hasOwnPage } from '../../pages/create/entry';
import { pt } from '../../pages/copy';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Flag, Settings, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { ButtonLink, List, ListRow } from '../../../design/primitives';
import { Fact, SideBlock } from '../../../design/profile/ProfileLayout';
import { Crest } from '../../world/Crest';
import { RepresentationPanel } from '../../agents/RepresentationPanel';
import { ClubApproachesPanel } from '../../agents/ClubApproachesPanel';
import type { PersonView } from './usePersonProfile';

interface FollowedClub { id: number; name: string; logoUrl?: string | null; cityName?: string | null; countryName?: string | null }

/** Side facts for a person: about, playing details for players, and for yourself your clubs and account links. */
export function PersonSide({ view }: { view: PersonView }) {
    const { profile, own, roles, hidden, possibleMinor } = view;
    const { user } = useAuth();
    if (!profile) return null;
    const player = roles.includes('PLAYER') && !hidden;
    const history = profile.careerHistory ?? [];
    const totals = history.reduce((sum, item) => ({ apps: sum.apps + item.appearances, goals: sum.goals + item.goals, assists: sum.assists + item.assists }), { apps: 0, goals: 0, assists: 0 });
    // Body measurements stay off other people's view of a possible minor.
    const measurements = own || !possibleMinor;
    return <>
        {hidden && <SideBlock title="Private profile"><p>Only basic identity details are shown. Photos, personal details and personal posts are private.</p></SideBlock>}
        {player && <SideBlock title="Player">
            <dl>
                {profile.position && <Fact label="Position">{[profile.position, profile.secondaryPosition].filter(Boolean).join(', ')}</Fact>}
                {profile.preferredFoot && <Fact label="Preferred foot">{profile.preferredFoot}</Fact>}
                {measurements && profile.heightCm && <Fact label="Height">{profile.heightCm} cm</Fact>}
                {measurements && profile.weightKg && <Fact label="Weight">{profile.weightKg} kg</Fact>}
                {profile.availabilityStatus && <Fact label="Availability">{profile.availabilityStatus}</Fact>}
            </dl>
            {history.length > 0 && <>
                <div className="gk-person-record" aria-label="Playing record">
                    <span><strong className="gk-num">{totals.apps}</strong>Appearances</span>
                    <span><strong className="gk-num">{totals.goals}</strong>Goals</span>
                    <span><strong className="gk-num">{totals.assists}</strong>Assists</span>
                </div>
                <List label="Seasons">{history.slice(0, 4).map(item => <ListRow key={item.id} title={`${item.season} · ${item.clubName}`}
                    meta={`${item.category} · ${item.appearances} apps · ${item.goals} goals${item.cleanSheets ? ` · ${item.cleanSheets} clean sheets` : ''}`} />)}</List>
                <p className="gk-faint">Recorded by the clubs.</p>
            </>}
        </SideBlock>}
        {own && <FollowedClubs />}
        {own && user?.navigationCapabilities !== undefined && !hasOwnPage(user.navigationCapabilities) && <SideBlock title={pt('Your club')}><CreateLink kind="CLUB" from="profile" size="sm">{pt('Add your club')}</CreateLink></SideBlock>}
        {(roles.includes('AGENT') || (roles.includes('PLAYER') && !possibleMinor)) && <RepresentationPanel profileId={profile.id} own={own} roles={roles} />}
        {own && (roles.includes('PLAYER') || roles.includes('PARENT')) && <ClubApproachesPanel mode="participant" />}
        {own && <SideBlock title="Your account">
            <List label="Account links">
                <ListRow to="/account?tab=profile" lead={<Settings size={18} aria-hidden="true" />} title="Account settings" meta="Name, photos, privacy and sign-in" />
                <ListRow to="/notifications?scope=personal" lead={<BellRing size={18} aria-hidden="true" />} title="Notifications" />
                <ListRow to="/reports" lead={<Flag size={18} aria-hidden="true" />} title="Reports and safety" />
            </List>
        </SideBlock>}
        {!own && !hidden && (profile.footballProfile?.appointments.length ?? 0) === 0 && <SideBlock title="How this profile is checked">
            <p className="gk-row"><ShieldCheck size={16} aria-hidden="true" />Nothing on this profile has been confirmed by a club yet. Roles and skills are self-reported.</p>
        </SideBlock>}
    </>;
}

function FollowedClubs() {
    const [clubs, setClubs] = useState<FollowedClub[] | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        void apiClient.get<FollowedClub[]>('/clubs/followed', { signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) setClubs(response.data); })
            .catch(() => { if (!controller.signal.aborted) setClubs([]); });
        return () => controller.abort();
    }, []);
    return <SideBlock title="Clubs you follow" action={clubs?.length ? <Link className="gk-section__action" to="/clubs/following">See all</Link> : undefined}>
        {clubs === null ? <p>Loading…</p> : clubs.length ? <List label="Followed clubs">{clubs.slice(0, 5).map(club => <ListRow key={club.id} to={`/clubs/${club.id}`}
            lead={<Crest src={club.logoUrl} name={club.name} size={36} />} title={club.name} meta={[club.cityName, club.countryName].filter(Boolean).join(', ')} />)}</List>
            : <><p>Follow clubs to see their posts on Home.</p><ButtonLink size="sm" to="/world/clubs">Find clubs</ButtonLink></>}
    </SideBlock>;
}
