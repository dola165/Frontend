import type { NavigationCapabilities } from '../../../../context/navigationCapabilities';
import type { PinIcon } from './pinIcons';

/** English and Georgian for one piece of copy, resolved in the current language (`useJourneyCopy`). */
export type Copy = (english: string, georgian: string) => string;
export const english: Copy = text => text;

export interface RouteDescription { path: string; label: string | null; icon: PinIcon; pinnable: boolean }
export interface RouteContext { capabilities?: NavigationCapabilities; userId?: number; myClubPath: string | null; copy?: Copy }

// Query parameters that change what a page shows. Anything else (ids of open dialogs, drafts) is dropped.
const meaningfulParams = ['tab', 'section', 'view', 'kind', 'scope', 'area', 'squad'];
// World keeps its search and filters, but never campaign tracking or context that follows the person around.
const droppedWorldParams = /^(?:utm_.*|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|_ga|near|player)$/;
// Already one click away in the header, or not a destination at all.
const notPinnable = /^\/(?:$|home$|feed$|login|signup|forgot-password|reset-password|verify-email|consent|oauth2|onboarding|dob$|set-password|messages$|notifications$|requests$|assistant$|workspaces$)/;

/** One canonical address per destination, so the same page is never pinned twice. */
export function normalizePath(pathname: string, search: string) {
    const params = new URLSearchParams(search);
    const kept = new URLSearchParams();
    const world = pathname === '/world' || pathname.startsWith('/world/');
    const keys = world ? [...new Set(params.keys())].filter(key => !droppedWorldParams.test(key)).sort() : meaningfulParams;
    for (const key of keys) {
        const value = params.get(key);
        if (value) kept.set(key, value);
    }
    const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    // The workspace opens on its overview, so the overview tab is the workspace itself.
    if (/^\/clubs\/\d+\/workspace$/.test(trimmed) && kept.get('tab') === 'overview') kept.delete('tab');
    return kept.size ? `${trimmed}?${kept}` : trimmed;
}

const capabilityLabel = (capabilities: NavigationCapabilities | undefined, id: string, contextId: number) =>
    capabilities?.workspaces.find(item => item.id === id && item.context.id === contextId)?.context.label ?? null;

type Words = [english: string, georgian: string];
const fixed: Array<[RegExp, Words, PinIcon]> = [
    [/^\/squads$/, ['My squads', 'ჩემი გუნდები'], 'squad'],
    [/^\/parent(?:\/|$)/, ['Parent Hub', 'მშობლის სივრცე'], 'family'],
    [/^\/referees\//, ['Referee workspace', 'მსაჯის სამუშაო სივრცე'], 'flag'],
    [/^\/agent(?:\/|$)/, ['Agent Hub', 'აგენტის სივრცე'], 'briefcase'],
    [/^\/calendar$/, ['My schedule', 'ჩემი განრიგი'], 'calendar'],
    [/^\/store$/, ['Store', 'მაღაზია'], 'store'],
    [/^\/campaigns$/, ['Campaigns', 'კამპანიები'], 'family'],
    [/^\/clubs\/following$/, ['Followed clubs', 'მიყოლილი კლუბები'], 'club'],
    [/^\/admissions$/, ['Joining football', 'ფეხბურთში მონაწილეობა'], 'clipboard'],
    [/^\/my-organizations$/, ['My organizations', 'ჩემი ორგანიზაციები'], 'building'],
    [/^\/club-operations$/, ['My club appointments', 'ჩემი კლუბური დანიშვნები'], 'clipboard'],
    [/^\/account\/roles$/, ['Football roles', 'საფეხბურთო როლები'], 'person'],
    [/^\/account$/, ['Account & settings', 'ანგარიში და პარამეტრები'], 'settings'],
    [/^\/admin$/, ['Administration', 'ადმინისტრირება'], 'admin'],
    // Addresses from before World; they redirect there, but older pins may still hold them.
    [/^\/map$/, ['Map', 'რუკა'], 'map'],
    [/^\/clubs$/, ['Clubs', 'კლუბები'], 'club'],
    [/^\/people$/, ['People', 'ხალხი'], 'people'],
    [/^\/stadiums$/, ['Venues', 'მოედნები'], 'venue'],
    [/^\/matches$/, ['Matches', 'მატჩები'], 'goal'],
    [/^\/match-history$/, ['Results', 'შედეგები'], 'goal'],
    [/^\/tournaments$/, ['Tournaments', 'ტურნირები'], 'trophy'],
    [/^\/tryouts$/, ['Trials', 'გასინჯვები'], 'goal'],
    [/^\/events$/, ['Events', 'ღონისძიებები'], 'calendar'],
    [/^\/(?:jobs|roles)$/, ['Jobs and volunteering', 'სამუშაო და მოხალისეობა'], 'briefcase'],
    [/^\/admissions\/opportunities$/, ['Places to train', 'სავარჯიშო ადგილები'], 'clipboard'],
];

/** World's directories and the tabs inside them, named as World names them. */
const worldSections: Record<string, [Words, PinIcon]> = {
    clubs: [['Clubs', 'კლუბები'], 'club'], people: [['People', 'ხალხი'], 'people'], venues: [['Venues', 'მოედნები'], 'venue'],
    matches: [['Matches', 'მატჩები'], 'goal'], tournaments: [['Tournaments', 'ტურნირები'], 'trophy'], competitions: [['Tournaments', 'ტურნირები'], 'trophy'],
    opportunities: [['Jobs & volunteering', 'სამუშაო და მოხალისეობა'], 'briefcase'], map: [['Journeys', 'მოგზაურობები'], 'map'],
};
const worldTabs: Record<string, Words> = {
    'matches:exchange': ['Open matches', 'ღია მატჩები'], 'matches:mine': ['My arrangements', 'ჩემი შეთანხმებები'], 'matches:events': ['Events', 'ღონისძიებები'],
    'opportunities:jobs': ['Jobs and volunteering', 'სამუშაო და მოხალისეობა'], 'opportunities:trials': ['Trials', 'გასინჯვები'], 'opportunities:groups': ['Places to train', 'სავარჯიშო ადგილები'],
    'tournaments:all': ['All tournaments', 'ყველა ტურნირი'], 'tournaments:mine': ['My tournaments', 'ჩემი ტურნირები'],
    'competitions:all': ['All tournaments', 'ყველა ტურნირი'], 'competitions:mine': ['My tournaments', 'ჩემი ტურნირები'], 'competitions:invitations': ['My tournaments', 'ჩემი ტურნირები'],
    'venues:bookings': ['My reservations', 'ჩემი ჯავშნები'],
};

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

function describeWorld(bare: string, params: URLSearchParams, copy: Copy): { label: string | null; icon: PinIcon } {
    const section = bare.split('/')[2];
    const known = section ? worldSections[section] : undefined;
    if (section && !known) return { label: null, icon: 'world' };
    const tab = known ? worldTabs[`${section}:${params.get(section === 'opportunities' ? 'type' : 'tab')}`] : undefined;
    const words = tab ?? known?.[0] ?? ['World', 'მსოფლიო'];
    const name = copy(...words);
    const query = params.get('q');
    if (query) return { label: `${name}: ${query.slice(0, 32)}`, icon: known?.[1] ?? 'world' };
    const filtered = [...params.keys()].some(key => !['tab', 'type', 'view', 'sort'].includes(key));
    return { label: filtered ? `${name} · ${copy('filtered', 'ფილტრით')}` : name, icon: known?.[1] ?? 'world' };
}

/** Label and icon for a destination, in the current language. A null label means "use the page's own title". */
export function describeRoute(pathname: string, search: string, context: RouteContext): RouteDescription {
    const copy = context.copy ?? english;
    const path = normalizePath(pathname, search);
    const [bare, query = ''] = path.split('?');
    const params = new URLSearchParams(query);
    const pinnable = !notPinnable.test(bare) && path !== context.myClubPath && path !== '/world';
    const { capabilities } = context;
    const id = Number(/\/(\d+)(?:\/|$)/.exec(bare)?.[1]);
    const known = (value: string | null, icon: PinIcon) => ({ path, label: value, icon, pinnable });
    if (/^\/squads\/\d+$/.test(bare)) return known(capabilityLabel(capabilities, 'squad.workspace', id), 'squad');
    if (/^\/clubs\/\d+\/workspace$/.test(bare)) {
        const club = capabilityLabel(capabilities, 'club.workspace', id) ?? capabilityLabel(capabilities, 'club.operations', id);
        if (query) return known(null, 'workspace');
        return known(club ? copy(`Workspace · ${club}`, `სამუშაო სივრცე · ${club}`) : copy('Club workspace', 'კლუბის სამუშაო სივრცე'), 'workspace');
    }
    if (/^\/clubs\/\d+$/.test(bare) && !query) {
        const club = capabilities?.workspaces.find(item => item.context.type === 'club' && item.context.id === id)?.context.label;
        return known(club ?? null, 'club');
    }
    if (/^\/tournaments\/\d+\/workspace$/.test(bare)) return known(capabilityLabel(capabilities, 'tournament.workspace', id), 'trophy');
    if (/^\/organizations\/\d+\/workspace$/.test(bare)) return known(capabilityLabel(capabilities, 'organization.workspace', id), 'building');
    if (/^\/stadiums\/\d+\/manage$/.test(bare)) return known(capabilityLabel(capabilities, 'venue.workspace', id), 'venue');
    if (context.userId && bare === `/profile/${context.userId}`) return known(copy('My profile', 'ჩემი პროფილი'), 'person');
    if (bare === '/world' || bare.startsWith('/world/')) {
        const world = describeWorld(bare, params, copy);
        return known(world.label, world.icon);
    }
    if (bare === '/my-organizations' && params.get('kind') === 'VENUE') return known(copy('My venues', 'ჩემი მოედნები'), 'venue');
    const match = fixed.find(([pattern]) => pattern.test(bare));
    if (match) {
        // A section of a known page ("Account & settings · Security"); other parameters fall back to the page title.
        const part = params.get('section') ?? params.get('tab') ?? params.get('view') ?? params.get('scope') ?? params.get('kind');
        return known(!query ? copy(...match[1]) : part ? `${copy(...match[1])} · ${humanize(part.toLowerCase())}` : null, match[2]);
    }
    return known(null, iconByPrefix.find(([pattern]) => pattern.test(bare))?.[1] ?? 'bookmark');
}

/** The label a stored pin shows now: named from its route in the current language, or the title it was pinned with. */
export function pinLabel(path: string, stored: string | undefined, context: RouteContext): string | null {
    const [pathname, search = ''] = path.split('?');
    return describeRoute(pathname, search ? `?${search}` : '', context).label ?? stored ?? null;
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
