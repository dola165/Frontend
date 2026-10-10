import { accessibleClubs } from '../../clubAccess';
import { connectedWorkspaces, type ConnectedWorkspace } from '../../connectedWorkspaces';
import { hasNavigationCapability, type NavigationCapabilities } from '../../../../context/navigationCapabilities';
import type { PinIcon } from './pinIcons';
import type { Pin } from './pinStore';

const groupIcon: Record<ConnectedWorkspace['group'], PinIcon> = {
    Clubs: 'workspace', 'Personal work': 'workspace', Teams: 'squad', Organizations: 'building', Venues: 'venue', Tournaments: 'trophy',
};
const personalIcon: Record<string, PinIcon> = { '/parent': 'family', '/referees/me': 'flag', '/agent': 'briefcase', '/club-operations': 'clipboard', '/admin': 'admin' };

/** Everything a person can open from their own work, so nothing is lost when it is not a tab. */
export function workDestinations(capabilities: NavigationCapabilities | undefined, myClubPath: string | null): Pin[] {
    const work: Pin[] = connectedWorkspaces(capabilities)
        .filter(item => item.path !== myClubPath)
        .map(item => ({ path: item.path, label: item.group === 'Clubs' ? `Workspace · ${item.label}` : item.label, icon: personalIcon[item.path] ?? groupIcon[item.group] }));
    for (const club of accessibleClubs(capabilities)) {
        if (club.canOpenWorkspace) work.push({ path: `/clubs/${club.id}`, label: club.name, icon: 'club' });
    }
    if (capabilities === undefined || hasNavigationCapability(capabilities, 'squad.workspace')) work.push({ path: '/squads', label: 'My squads', icon: 'squad' });
    work.push({ path: '/calendar', label: 'My schedule', icon: 'calendar' }, { path: '/admissions', label: 'Joining football', icon: 'clipboard' });
    return work.filter((item, index, all) => all.findIndex(other => other.path === item.path) === index);
}

/** Public football destinations. They also live in World; pinning one keeps it a click away. */
export const exploreDestinations: Pin[] = [
    { path: '/world/clubs', label: 'Clubs', icon: 'club' },
    { path: '/world/matches', label: 'Matches', icon: 'goal' },
    { path: '/world/competitions', label: 'Competitions', icon: 'trophy' },
    { path: '/world/venues', label: 'Venues', icon: 'venue' },
    { path: '/world/people', label: 'People', icon: 'people' },
    { path: '/world/opportunities?type=trials', label: 'Trials', icon: 'goal' },
    { path: '/world/matches?tab=events', label: 'Events', icon: 'calendar' },
    { path: '/world/opportunities', label: 'Jobs and volunteering', icon: 'briefcase' },
    { path: '/store', label: 'Store', icon: 'store' },
    { path: '/campaigns', label: 'Campaigns', icon: 'family' },
    { path: '/clubs/following', label: 'Followed clubs', icon: 'club' },
    { path: '/world/map', label: 'Map', icon: 'map' },
];
