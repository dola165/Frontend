import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { ProfileLayout } from '../../../design/profile/ProfileLayout';
import { isProfessionalRole, profileRoles } from '../../roles/domain';
import type { PersonProfile, Profession } from '../api';
import { PersonActions } from './PersonActions';
import { PersonOverviewTab } from './PersonOverviewTab';
import { PersonSide } from './PersonSide';
import { personIdentity } from './personIdentity';
import { personTabs } from './personTabs';
import type { PersonView } from './usePersonProfile';
import './person-profile.css';

const nothing = () => undefined;
const nothingAsync = async () => undefined;

/**
 * A person's profile page as other people see it, drawn by the page's own parts from a profile that is not saved yet
 * (the setup's draft). Nothing in it can be pressed: it only shows.
 */
export function PersonProfilePreview({ profile, professions }: { profile: PersonProfile; professions: Profession[] }) {
    const copy = useJourneyCopy();
    const roles = profileRoles(profile);
    const possibleMinor = roles.includes('PLAYER') && !profile.dateOfBirth;
    const view: PersonView = {
        profile, status: 'ready', own: false, roles, hidden: false, possibleMinor, setProfile: nothing,
        professions, professionsFailed: false, reload: nothing, toggleFollow: nothingAsync, updateImage: nothingAsync,
    };
    const tabs = personTabs({ own: false, hidden: false, career: roles.some(isProfessionalRole) }, copy);
    // The same markup as on the page, so the preview reads the same.
    const counts = (kind: 'followers' | 'following', value: number) => <button type="button"><strong>{value.toLocaleString()}</strong>{kind === 'followers' ? copy(value === 1 ? 'follower' : 'followers', 'გამომწერი') : copy('following', 'გამოწერილი')}</button>;
    return <div className="gk-profile-preview" inert>
        <ProfileLayout identity={personIdentity({ profile, roles, own: false, hidden: false, possibleMinor, copy, counts })} banner={profile.bannerUrl}
            actions={<PersonActions profile={profile} own={false} onFollow={nothing} onShare={nothing} onRepresentation={nothing} />}
            tabs={tabs} tab="overview" onTab={nothing} tabsLabel={copy('Profile sections', 'პროფილის სექციები')}
            side={<PersonSide view={view} />} sideLabel={copy(`About ${profile.fullName || profile.username}`, `${profile.fullName || profile.username} — შესახებ`)}>
            <PersonOverviewTab view={view} />
        </ProfileLayout>
    </div>;
}
