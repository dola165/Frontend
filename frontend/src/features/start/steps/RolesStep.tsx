import { Button, EmptyNote, Skeleton } from '../../../design/primitives';
import { RoleIcon } from '../../profiles/person/RoleIcon';
import type { useRoleProfiles } from '../../profiles/account/useRoleProfiles';
import type { FootballRole } from '../../roles/domain';
import { SETUP_ROLES } from '../setupWords';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { ADULT_ROLES } from '../welcomeSteps';

/** The roles as small checks, one line each. A minor never sees the roles only adults can hold. */
export function RoleChecklist({ chosen, onToggle, adult, label }: { chosen: readonly string[]; onToggle: (role: FootballRole) => void; adult: boolean; label: string }) {
    const copy = useJourneyCopy();
    const offered = adult ? SETUP_ROLES : SETUP_ROLES.filter(item => !(ADULT_ROLES as readonly string[]).includes(item.role));
    return <ul className="gk-setup-roles" aria-label={label}>
        {offered.map(item => <li key={item.role}>
            <label className="gk-setup-role">
                <input type="checkbox" checked={chosen.includes(item.role)} onChange={() => onToggle(item.role)} />
                <RoleIcon role={item.role} size="sm" />
                <span className="gk-setup-role__text"><strong>{copy(item.en[0], item.ka[0])}</strong><small>{copy(item.en[1], item.ka[1])}</small></span>
            </label>
        </li>)}
    </ul>;
}

/** Step 1: what the person does in football. It shapes the profile and what comes next, nothing else. */
export function RolesStep({ roles, adult }: { roles: ReturnType<typeof useRoleProfiles>; adult: boolean }) {
    const copy = useJourneyCopy();
    if (roles.state === 'loading') return <div role="status" aria-label={copy('Loading your roles', 'როლები იტვირთება')} className="gk-stack gk-stack--tight"><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div>;
    if (roles.state === 'failed') return <EmptyNote title={copy('Your football roles couldn’t load', 'როლები ვერ ჩაიტვირთა')} action={<Button onClick={roles.retry}>{copy('Retry', 'ხელახლა ცდა')}</Button>} />;
    return <fieldset disabled={roles.saving} className="gk-setup__fieldset">
        <legend className="gk-visually-hidden">{copy('What do you do in football?', 'რას აკეთებთ ფეხბურთში?')}</legend>
        <RoleChecklist chosen={roles.profiles.map(item => item.role)} onToggle={roles.toggle} adult={adult} label={copy('Football roles', 'საფეხბურთო როლები')} />
        {roles.error && <p className="gk-notice gk-notice--danger" role="alert">{copy(roles.error, 'როლები ვერ შეინახა. თქვენი არჩევანი შენარჩუნებულია.')}</p>}
    </fieldset>;
}
