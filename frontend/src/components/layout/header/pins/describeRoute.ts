import type { NavigationCapabilities } from '../../../../context/navigationCapabilities';
import type { PinIcon } from './pinIcons';

export interface RouteDescription { path: string; label: string | null; icon: PinIcon; pinnable: boolean }
export interface RouteContext { capabilities?: NavigationCapabilities; userId?: number; myClubPath: string | null }

// Query parameters that change what a page shows. Anything else (ids of open dialogs, drafts) is dropped.
const meaningfulParams = ['tab', 'section', 'view', 'kind', 'scope', 'area', 'squad'];
// Already one click away in the header, or not a destination at all.
const notPinnable = /^\/(?:$|home$|feed$|login|signup|forgot-password|reset-password|verify-email|consent|oauth2|onboarding|dob$|set-password|messages$|notifications$|requests$|assistant$|workspaces$)/;

/** One canonical address per destination, so the same page is never pinned twice. */
export function normalizePath(pathname: string, search: string) {
    const params = new URLSearchParams(search);
    const kept = new URLSearchParams();
    const keys = pathname === '/world' || pathname.startsWith('/world/') ? [...new Set(params.keys())].sort() : meaningfulParams;
    for (const key of keys) {
        const value = params.get(key);
        if (value) kept.set(key, value);
    }
    const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    return kept.size ? `${trimmed}?${kept}` : trimmed;
}

const label = (capabilities: NavigationCapabilities | undefined, id: string, contextId: number) =>
    capabilities?.workspaces.find(item => item.id === id && item.context.id === contextId)?.context.label ?? null;

const fixed: Array<[RegExp, string, PinIcon]> = [
    [/^\/squads$/, 'My squads', 'squad'],
    [/^\/parent(?:\/|$)/, 'Parent Hub', 'family'],
    [/^\/referees\//, 'Referee workspace', 'flag'],
    [/^\/agent(?:\/|$)/, 'Agent Hub', 'briefcase'],
    [/^\/calendar$/, 'My schedule', 'calendar'],
    [/^\/map$/, 'Map', 'map'],
    [/^\/clubs$/, 'Clubs', 'club'],
    [/^\/clubs\/following$/, 'Followed clubs', 'club'],
    [/^\/people$/, 'People', 'people'],
    [/^\/stadiums$/, 'Venues', 'venue'],
    [/^\/matches$/, 'Matches & competitions', 'goal'],
    [/^\/match-history$/, 'Results & history', 'goal'],
    [/^\/tournaments$/, 'Tournaments', 'trophy'],
    [/^\/tryouts$/, 'Tryouts', 'goal'],
    [/^\/events$/, 'Events', 'calendar'],
    [/^\/(?:jobs|roles)$/, 'Roles', 'briefcase'],
    [/^\/store$/, 'Store', 'store'],
    [/^\/campaigns$/, 'Campaigns', 'family'],
    [/^\/admissions$/, 'Joining football', 'clipboard'],
    [/^\/admissions\/opportunities$/, 'Opportunities', 'clipboard'],
    [/^\/my-organizations$/, 'My organizations', 'building'],
    [/^\/club-operations$/, 'My club appointments', 'clipboard'],
    [/^\/account\/roles$/, 'Football roles', 'person'],
    [/^\/account$/, 'Account & settings', 'settings'],
    [/^\/admin$/, 'Administration', 'admin'],
];

const iconByPrefix: Array<[RegExp, PinIcon]> = [
    [/^\/clubs\/\d+\/workspace/, 'workspace'], [/^\/clubs\//, 'club'], [/^\/squads\//, 'squad'], [/^\/(?:tournaments|tournament-series)\//, 'trophy'],
    [/^\/(?:match-exchange|matches)/, 'goal'], [/^\/stadiums\//, 'venue'], [/^\/organizations\//, 'building'], [/^\/profile\//, 'person'],
    [/^\/(?:jobs|roles)\//, 'briefcase'], [/^\/store\//, 'store'], [/^\/campaigns\//, 'family'], [/^\/tryouts\//, 'goal'],
    [/^\/admissions\//, 'clipboard'], [/^\/world\//, 'world'],
];

const humanize = (value: string) => {
    let decoded = value;
    try { decoded = decodeURIComponent(value); } catch { /* Keep the raw segment. */ }
    const words = decoded.replace(/[-_]+/g, ' ').trim();
    return words ? words[0].toUpperCase() + words.slice(1) : value;
};

/** Label and icon for a destination. A null label means "use the page's own title". */
export function describeRoute(pathname: string, search: string, context: RouteContext): RouteDescription {
    const path = normalizePath(pathname, search);
    const bare = path.split('?')[0];
    const pinnable = !notPinnable.test(bare) && path !== context.myClubPath && path !== '/world';
    const { capabilities } = context;
    const id = Number(/\/(\d+)(?:\/|$)/.exec(bare)?.[1]);
    const known = (value: string | null, icon: PinIcon) => ({ path, label: value, icon, pinnable });
    if (/^\/squads\/\d+$/.test(bare)) return known(label(capabilities, 'squad.workspace', id), 'squad');
    if (/^\/clubs\/\d+\/workspace$/.test(bare)) {
        const club = label(capabilities, 'club.workspace', id) ?? label(capabilities, 'club.operations', id);
        return known(path.includes('tab=') ? null : club ? `Workspace · ${club}` : 'Club workspace', 'workspace');
    }
    if (/^\/clubs\/\d+$/.test(bare) && !path.includes('?')) {
        const club = capabilities?.workspaces.find(item => item.context.type === 'club' && item.context.id === id)?.context.label;
        return known(club ?? null, 'club');
    }
    if (/^\/tournaments\/\d+\/workspace$/.test(bare)) return known(label(capabilities, 'tournament.workspace', id), 'trophy');
    if (/^\/organizations\/\d+\/workspace$/.test(bare)) return known(label(capabilities, 'organization.workspace', id), 'building');
    if (/^\/stadiums\/\d+\/manage$/.test(bare)) return known(label(capabilities, 'venue.workspace', id), 'venue');
    if (context.userId && bare === `/profile/${context.userId}`) return known('My profile', 'person');
    if (bare === '/world' || bare.startsWith('/world/')) {
        const params = new URLSearchParams(path.split('?')[1]);
        const query = params.get('q') ?? params.get('query') ?? params.get('search');
        const part = bare.split('/')[2] ?? params.get('section') ?? params.get('tab') ?? params.get('view') ?? params.get('directory');
        const section = part ? humanize(part) : null;
        if (query) return known(`${section ?? 'World'}: ${query.slice(0, 32)}`, 'world');
        return known(section && !/^\d+$/.test(part ?? '') ? `World · ${section}` : null, 'world');
    }
    const match = fixed.find(([pattern]) => pattern.test(bare));
    if (match) {
        // A section of a known page ("Matches & competitions · Fixtures"); other parameters fall back to the page title.
        const params = new URLSearchParams(path.split('?')[1]);
        const part = params.get('section') ?? params.get('tab') ?? params.get('view') ?? params.get('scope') ?? params.get('kind');
        return known(!path.includes('?') ? match[1] : part ? `${match[1]} · ${humanize(part.toLowerCase())}` : null, match[2]);
    }
    return known(null, iconByPrefix.find(([pattern]) => pattern.test(bare))?.[1] ?? 'bookmark');
}

/** The visible page title, used when the route alone cannot name the page (a club, a tab, a match). */
export function readPageTitle(): string | null {
    const heading = Array.from(document.querySelectorAll<HTMLElement>('main h1, [role="main"] h1, h1'))
        .find(element => !element.closest('.gk-header') && element.offsetParent !== null && element.textContent?.trim());
    const fromHeading = heading?.textContent?.replace(/\s+/g, ' ').trim();
    const fromTitle = document.title.split(' | ')[0]?.trim();
    const value = fromHeading || (fromTitle && !fromTitle.startsWith('GrassKickZ') ? fromTitle : '');
    return value ? value.slice(0, 48) : null;
}
