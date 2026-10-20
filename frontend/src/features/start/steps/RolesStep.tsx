import { Button, EmptyNote, Skeleton } from '../../../design/primitives';
import { RoleGrid } from '../../profiles/account/RoleGrid';
import type { useRoleProfiles } from '../../profiles/account/useRoleProfiles';
import { footballRoles } from '../../roles/domain';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { ADULT_ROLES } from '../welcomeSteps';

/**
 * Step 1: the roles grid from Roles and work, as pictures, several at once. It shapes the profile and the next steps,
 * nothing else. A minor never sees the roles only adults can hold.
 */
export function RolesStep({ roles, adult }: { roles: ReturnType<typeof useRoleProfiles>; adult: boolean }) {
    const copy = useJourneyCopy();
    if (roles.state === 'loading') return <div role="status" aria-label={copy('Loading your roles', 'როლები იტვირთება')} className="gk-welcome__loading"><Skeleton height={140} /><Skeleton height={140} /></div>;
    if (roles.state === 'failed') return <EmptyNote title={copy('Your football roles couldn’t load', 'როლები ვერ ჩაიტვირთა')} action={<Button onClick={roles.retry}>{copy('Retry', 'ხელახლა ცდა')}</Button>} />;
    const offered = adult ? footballRoles : footballRoles.filter(role => !(ADULT_ROLES as readonly string[]).includes(role));
    return <fieldset disabled={roles.saving} className="gk-welcome__roles">
        <legend className="gk-visually-hidden">{copy('What do you do in football?', 'რას აკეთებთ ფეხბურთში?')}</legend>
        <RoleGrid chosen={roles.profiles.map(item => item.role)} onToggle={roles.toggle} copy={copy} roles={offered} pictures />
        {roles.error && <p className="gk-notice gk-notice--danger" role="alert">{copy(roles.error, 'როლები ვერ შეინახა. თქვენი არჩევანი შენარჩუნებულია.')}</p>}
    </fieldset>;
}
