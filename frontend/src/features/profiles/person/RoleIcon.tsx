import { Building2, ClipboardList, Flag, Handshake, Heart, MapPin, Shirt, Trophy, Users, type LucideIcon } from 'lucide-react';
import './role-icon.css';

const icons: Record<string, LucideIcon> = { PLAYER: Shirt, COACH: ClipboardList, REFEREE: Flag, AGENT: Handshake, CLUB_STAFF: Building2, PARENT: Users, ORGANIZER: Trophy, VENUE_MANAGER: MapPin, FAN: Heart };

/** A football role's mark, used on profiles, in the roles editor and (small) beside a role's name in World. */
export function RoleIcon({ role, size }: { role: string; size?: 'sm' }) {
    const Icon = icons[role] ?? Users;
    return <span className="gk-person-role" data-role={role} data-size={size}><Icon aria-hidden="true" /></span>;
}
