import { ChoiceTiles } from '../../../design/ChoiceTiles';
import { footballRoles, roleCopy, type FootballRole } from '../../roles/domain';
import { RoleIcon } from '../person/RoleIcon';

type Copy = (english: string, georgian: string) => string;

/** "What you do in football" on Roles and work: one tile per football role, several at once. */
export function RoleGrid({ chosen, onToggle, copy }: { chosen: readonly FootballRole[]; onToggle: (role: FootballRole) => void; copy: Copy }) {
    const items = footballRoles.map(role => {
        const presentation = roleCopy(role, copy);
        return { id: role, label: presentation.label, hint: presentation.description, icon: <RoleIcon role={role} /> };
    });
    return <ChoiceTiles items={items} chosen={chosen} onToggle={id => onToggle(id as FootballRole)} label={copy('Football roles', 'საფეხბურთო როლები')} />;
}
