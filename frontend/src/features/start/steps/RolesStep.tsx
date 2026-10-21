import { Skeleton } from '../../../design/primitives';
import { ChoiceTiles } from '../../../design/ChoiceTiles';
import { RoleIcon } from '../../profiles/person/RoleIcon';
import type { FootballRole } from '../../roles/domain';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { SETUP_CHOICES } from '../setupWords';
import type { SetupDraft } from '../useSetupProfile';
import { ADULT_ROLES } from '../welcomeSteps';

/**
 * Step 1: tiles, as on Roles and work, plus "Business or sponsor". Nothing is ticked for a new account; the first real
 * role ticked leads. A minor never sees the roles only adults can hold, nor the business answer.
 */
export function RolesStep({ draft, onChange, adult }: { draft: SetupDraft | null; onChange: (draft: SetupDraft) => void; adult: boolean }) {
    const copy = useJourneyCopy();
    if (!draft) return <div role="status" aria-label={copy('Loading your roles', 'როლები იტვირთება')} className="gk-setup__loading"><Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} /></div>;
    const offered = adult ? SETUP_CHOICES : SETUP_CHOICES.filter(item => item.id !== 'BUSINESS' && !(ADULT_ROLES as readonly string[]).includes(item.id));
    const items = offered.map(item => ({ id: item.id, label: copy(item.en[0], item.ka[0]), hint: copy(item.en[1], item.ka[1]), icon: <RoleIcon role={item.id} /> }));
    const chosen = [...draft.roles, ...(draft.business ? ['BUSINESS'] : [])];
    const toggle = (id: string) => onChange(id === 'BUSINESS'
        ? { ...draft, business: !draft.business }
        : { ...draft, roles: draft.roles.includes(id as FootballRole) ? draft.roles.filter(role => role !== id) : [...draft.roles, id as FootballRole] });
    return <ChoiceTiles compact items={items} chosen={chosen} onToggle={toggle} label={copy('What do you do in football?', 'რას აკეთებთ ფეხბურთში?')} />;
}
