import { footballRoles, roleCopy, type FootballRole } from '../../roles/domain';
import { RoleIcon } from '../person/RoleIcon';
import './role-grid.css';

type Copy = (english: string, georgian: string) => string;

/** "What you do in football": one tile per football role, several at once. Used by Roles and work and the welcome. */
export function RoleGrid({ chosen, onToggle, copy }: { chosen: readonly FootballRole[]; onToggle: (role: FootballRole) => void; copy: Copy }) {
    return <div className="gk-roles__options">{footballRoles.map(role => {
        const checked = chosen.includes(role);
        const presentation = roleCopy(role, copy);
        return <label key={role} className="gk-role-option" data-checked={checked || undefined}>
            <input type="checkbox" checked={checked} onChange={() => onToggle(role)} aria-describedby={`role-hint-${role}`} />
            <RoleIcon role={role} />
            <span className="gk-role-option__text"><strong>{presentation.label}</strong><small id={`role-hint-${role}`}>{presentation.description}</small></span>
        </label>;
    })}</div>;
}
