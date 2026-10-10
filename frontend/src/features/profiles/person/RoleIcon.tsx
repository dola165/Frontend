import { Building2, ClipboardList, Flag, Handshake, Heart, MapPin, Shirt, Trophy, Users, type LucideIcon } from 'lucide-react';
import './role-icon.css';

const icons: Record<string, LucideIcon> = { PLAYER: Shirt, COACH: ClipboardList, REFEREE: Flag, AGENT: Handshake, CLUB_STAFF: Building2, PARENT: Users, ORGANIZER: Trophy, VENUE_MANAGER: MapPin, FAN: Heart };

/** A football role's mark, used on profiles and in the roles editor. */
export function RoleIcon({ role }: { role: string }) {
    const Icon = icons[role] ?? Users;
    return <span className="gk-person-role" data-role={role}><Icon aria-hidden="true" /></span>;
}
