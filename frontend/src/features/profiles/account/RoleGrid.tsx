import type { CSSProperties } from 'react';
import { footballRoles, roleCopy, type FootballRole } from '../../roles/domain';
import { RoleIcon } from '../person/RoleIcon';
import './role-grid.css';

type Copy = (english: string, georgian: string) => string;

/** The app's own football photos, one per role, for the picture tiles. */
const PHOTOS: Record<FootballRole, [photo: string, position?: string]> = {
    PLAYER: ['/football/ball-field.jpg', '50% 60%'],
    COACH: ['/football/touchline.jpg', '30% 50%'],
    REFEREE: ['/venue-demo/pitch-aerial.jpg'],
    AGENT: ['/landing/after-the-whistle.png', '70% 40%'],
    CLUB_STAFF: ['/preview/club-ground.png'],
    PARENT: ['/landing/after-the-whistle.png', '30% 60%'],
    ORGANIZER: ['/venue-demo/pitch-sun.jpg'],
    VENUE_MANAGER: ['/venue-demo/pitch-day.jpg'],
    FAN: ['/venue-demo/pitch-indoor.jpg'],
};

/**
 * "What you do in football": one tile per football role, several at once. Used by Roles and work and the welcome;
 * `roles` limits the tiles (a minor never sees adult-only roles) and `pictures` shows each over a football photo.
 */
export function RoleGrid({ chosen, onToggle, copy, roles = footballRoles, pictures = false }: {
    chosen: readonly FootballRole[]; onToggle: (role: FootballRole) => void; copy: Copy; roles?: readonly FootballRole[]; pictures?: boolean;
}) {
    return <div className={`gk-roles__options${pictures ? ' gk-roles__options--pictures' : ''}`}>{roles.map(role => {
        const checked = chosen.includes(role);
        const presentation = roleCopy(role, copy);
        const [photo, position] = PHOTOS[role];
        return <label key={role} className="gk-role-option" data-checked={checked || undefined}
            style={pictures ? { '--role-photo': `url(${photo})`, '--role-position': position ?? 'center' } as CSSProperties : undefined}>
            <input type="checkbox" checked={checked} onChange={() => onToggle(role)} aria-describedby={`role-hint-${role}`} />
            <RoleIcon role={role} />
            <span className="gk-role-option__text"><strong>{presentation.label}</strong><small id={`role-hint-${role}`}>{presentation.description}</small></span>
        </label>;
    })}</div>;
}
