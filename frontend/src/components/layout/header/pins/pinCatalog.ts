import { accessibleClubs } from '../../clubAccess';
import { connectedWorkspaces, type ConnectedWorkspace } from '../../connectedWorkspaces';
import { hasNavigationCapability, type NavigationCapabilities } from '../../../../context/navigationCapabilities';
import { describeRoute, english, type Copy } from './describeRoute';
import type { PinIcon } from './pinIcons';
import type { Pin } from './pinStore';

/** A place the person works in, with what kind of place it is. */
export interface WorkPlace extends Pin { kind: string }

const groupIcon: Record<ConnectedWorkspace['group'], PinIcon> = {
    Clubs: 'workspace', 'Personal work': 'workspace', Teams: 'squad', Organizations: 'building', Venues: 'venue', Tournaments: 'trophy',
};
const personal: Record<string, [english: string, georgian: string, PinIcon]> = {
    '/parent': ['Parent Hub', 'მშობლის სივრცე', 'family'],
    '/referees/me': ['Referee workspace', 'მსაჯის სამუშაო სივრცე', 'flag'],
    '/agent': ['Agent Hub', 'აგენტის სივრცე', 'briefcase'],
    '/club-operations': ['My club appointments', 'ჩემი კლუბური დანიშვნები', 'clipboard'],
};

function kindOf(item: ConnectedWorkspace, copy: Copy) {
    switch (item.group) {
        case 'Teams': return copy('Squad', 'გუნდი');
        case 'Tournaments': return copy('Tournament', 'ტურნირი');
        case 'Organizations': return copy('Organization', 'ორგანიზაცია');
        case 'Venues': return copy('Venue', 'მოედანი');
        case 'Clubs': return copy('Club workspace', 'კლუბის სამუშაო სივრცე');
        default: return copy('Your work', 'თქვენი საქმე');
    }
}

/**
 * Every workspace the person can open: squads, tournaments, organizations, venues, other clubs and their own hubs.
 * The My Club tab and Administration (in the account menu) already have a place, so they are left out.
 */
export function workspaceDestinations(capabilities: NavigationCapabilities | undefined, myClubPath: string | null, copy: Copy = english): WorkPlace[] {
    return connectedWorkspaces(capabilities)
        .filter(item => item.path !== myClubPath && item.path !== '/admin')
        .map(item => {
            const own = personal[item.path];
            if (own) return { path: item.path, label: copy(own[0], own[1]), icon: own[2], kind: copy('Your work', 'თქვენი საქმე') };
            const label = item.group === 'Clubs' && item.path.endsWith('/workspace') ? copy(`Workspace · ${item.label}`, `სამუშაო სივრცე · ${item.label}`) : item.label;
            return { path: item.path, label, icon: groupIcon[item.group], kind: kindOf(item, copy) };
        });
}

/** Everything a person can open from their own work, so nothing is lost when it is not a tab. */
export function workDestinations(capabilities: NavigationCapabilities | undefined, myClubPath: string | null, copy: Copy = english): Pin[] {
    const work: Pin[] = workspaceDestinations(capabilities, myClubPath, copy).map(({ path, label, icon }) => ({ path, label, icon }));
    for (const club of accessibleClubs(capabilities)) {
        if (club.canOpenWorkspace) work.push({ path: `/clubs/${club.id}`, label: club.name, icon: 'club' });
    }
    if (capabilities === undefined || hasNavigationCapability(capabilities, 'squad.workspace')) work.push({ path: '/squads', label: copy('My squads', 'ჩემი გუნდები'), icon: 'squad' });
    work.push(
        { path: '/calendar', label: copy('My schedule', 'ჩემი განრიგი'), icon: 'calendar' },
        { path: '/admissions', label: copy('Joining football', 'ფეხბურთში მონაწილეობა'), icon: 'clipboard' },
    );
    return work.filter((item, index, all) => all.findIndex(other => other.path === item.path) === index);
}

export interface ExploreDestination extends Pin { group: 'world' | 'more' | 'support'; signedIn?: boolean }

const explore: Array<[path: string, group: ExploreDestination['group'], signedIn?: boolean]> = [
    ['/world/clubs', 'world'], ['/world/opportunities', 'world'], ['/world/matches', 'world'],
    ['/world/tournaments', 'world'], ['/world/people', 'world'], ['/world/map', 'world'],
    ['/world/opportunities?type=trials', 'more'], ['/world/matches?tab=events', 'more'],
    ['/store', 'support'], ['/campaigns', 'support'], ['/clubs/following', 'support', true],
];

/**
 * Public football destinations: World's directories (in World's own order), a few useful views inside them,
 * and the places that support clubs. Named by `describeRoute`, so a destination has one name everywhere.
 */
export function exploreDestinations(copy: Copy = english): ExploreDestination[] {
    return explore.map(([path, group, signedIn]) => {
        const [pathname, search = ''] = path.split('?');
        const { label, icon } = describeRoute(pathname, search && `?${search}`, { myClubPath: null, copy });
        return { path, label: label ?? path, icon, group, ...(signedIn ? { signedIn } : {}) };
    });
}
