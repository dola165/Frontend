import type { NavigationCapabilities } from '../../context/navigationCapabilities';
import { personalWorkspaceTarget } from '../clubOperations/workspaceStructure';

/**
 * Club office (step 2 of the club plan, owner, 28 October 2026): Staff, Squads and Settings, the quiet More tools
 * and the calendar. Staff is the first place, so its address carries no tab.
 */
export const OFFICE_PLACES = ['staff', 'squads', 'settings', 'tools', 'calendar'] as const;
export type OfficePlace = typeof OFFICE_PLACES[number];

/**
 * Every tool that has no page of its own yet waits in More tools, grouped by the page it will move to. As each page
 * is built, its group leaves. `page` names that page in English and Georgian. Whatever someone opens today is
 * listed, so a job whose only tools are duties still finds them (review, 28 October 2026). My squads' group left with
 * step 3 (29 October 2026, see MOVED_TOOLS); equipment waits in a group of its own until Kit has a page. Joining's
 * setup (groups, terms, visitors, history) stays here: My squads answers requests, Admissions sets up how they join.
 */
export const MORE_TOOLS = [
    { id: 'kit', page: ['Kit', 'ეკიპირება'], tools: ['equipment'] },
    { id: 'staff', page: ['Staff', 'პერსონალი'], tools: ['staff-duties', 'specialists'] },
    { id: 'projects', page: ['Projects', 'პროექტები'], tools: ['campaigns'] },
    { id: 'joining', page: ['Joining', 'გაწევრიანება'], tools: ['admissions'] },
    { id: 'registration', page: ['Registration', 'რეგისტრაცია'], tools: ['players', 'player-cards', 'registration', 'departures', 'credentials'] },
    { id: 'player-file', page: ['Player file', 'მოთამაშის საქმე'], tools: ['development', 'restrictions', 'medical', 'education'] },
    { id: 'safeguarding', page: ['Safeguarding', 'ბავშვთა დაცვა'], tools: ['welfare', 'guardians'] },
    { id: 'money', page: ['Money', 'ფული'], tools: ['finance'] },
    { id: 'club-page', page: ['The club page', 'კლუბის გვერდი'], tools: ['facilities', 'programmes', 'store'] },
    { id: 'scouting', page: ['Scouting', 'სკაუტინგი'], tools: ['tryouts', 'club-approaches'] },
    { id: 'travel', page: ['Travel', 'მგზავრობა'], tools: ['travel'] },
] as const;

/**
 * The tools that moved into My squads (step 3): applications are Players' Want to join, attendance the session's
 * register, preparation the next match card. For someone on a squad at the link's club a bare link lands there; a link
 * that names anything more (a record, an application, a person) still opens it here. Someone on no squad (a Custom job
 * with only Attendance) has no My squads, so for them the tools stay in More tools, in MOVED_GROUP.
 */
export const MOVED_TOOLS = { applications: 'players', attendance: 'calendar', preparation: 'matches' } as const;
export type MovedTool = keyof typeof MOVED_TOOLS;
export const isMovedTool = (value: string | null | undefined): value is MovedTool => value != null && value in MOVED_TOOLS;
export const MOVED_GROUP = { id: 'my-squads', page: ['My squads', 'ჩემი გუნდები'], tools: Object.keys(MOVED_TOOLS) as MovedTool[] } as const;

export type OfficeTool = typeof MORE_TOOLS[number]['tools'][number] | MovedTool;
/** Every tool Club office opens: those More tools lists, and the moved ones for links to their records. */
export const OFFICE_TOOLS: readonly OfficeTool[] = [...MORE_TOOLS.flatMap(group => group.tools), ...Object.keys(MOVED_TOOLS) as MovedTool[]];
export const isOfficeTool = (value: string | null | undefined): value is OfficeTool => OFFICE_TOOLS.includes(value as OfficeTool);

/**
 * A bare link to a moved tool, which My squads shows: it names only the club, the squad, the place and, for
 * attendance, the session (whose register opens there). Anything else (a record, an application, a person, a filter)
 * is something only the tool shows, so that link opens the tool here.
 */
const BARE_KEYS = ['tab', 'tool', 'module', 'clubId', 'squad', 'return'];
export const bareLink = (tool: MovedTool, context: Record<string, string> | URLSearchParams) =>
    [...(context instanceof URLSearchParams ? context.keys() : Object.keys(context))]
        .every(key => BARE_KEYS.includes(key) || (tool === 'attendance' && key === 'session'));

const query = (values: Record<string, string>) => { const text = new URLSearchParams(values).toString(); return text ? `?${text}` : ''; };

/** A Club office place, with what it shows (a squad, a settings section, a date) in the address. */
export const officePath = (club: number, place: OfficePlace = 'staff', context: Record<string, string> = {}) =>
    `/clubs/${club}/office${query({ ...(place === 'staff' ? {} : { tab: place }), ...context })}`;

/** A tool opened inside More tools, with its record, squad, session or person. */
export const officeToolPath = (club: number, tool: OfficeTool, context: Record<string, string> = {}) =>
    officePath(club, 'tools', { tool, ...context });

/**
 * Where a moved tool lives now: its place in My squads, on the squad the link named. A session's register opens on My
 * squads' first page, as the session's summary (`activity`), which a squad's own page doesn't show.
 */
export function movedToolPath(club: number, tool: MovedTool, context: Record<string, string> = {}) {
    const squad: Record<string, string> = context.squad ? { squad: context.squad } : {};
    if (tool === 'attendance' && context.session) return `/my-squads${query({ clubId: String(club), activity: `s-${context.session}` })}`;
    return `/my-squads${query({ clubId: String(club), tab: MOVED_TOOLS[tool], ...squad })}`;
}

/** A squad the person coaches, from the server's navigation hints: its own page is My squads. */
const coaches = (capabilities: NavigationCapabilities | undefined, squad: string | null) =>
    squad !== null && (capabilities?.workspaces ?? []).some(item => item.id === 'squad.workspace' && String(item.context.id) === squad);

/**
 * Where an old club workspace address lands (notifications already sent, saved pins, bookmarks): Club office itself
 * when it names no tab, its places, More tools with the record still open, the Inbox only for the old Today, work
 * queue and updates, and My squads for a coach's own squad and the old personal tabs. Every context value but the
 * tab itself travels along. A moved tool opens in Club office, which knows whether the person is on a squad at this
 * club and sends a bare link on to My squads.
 */
export function legacyWorkspaceTarget(club: number, search: URLSearchParams, capabilities?: NavigationCapabilities): string {
    const tab = search.get('tab');
    const context = Object.fromEntries([...search].filter(([key]) => key !== 'tab' && key !== 'module'));
    const squad = search.get('squad');
    // My squads' old tabs inside the workspace, and an old "my squads" link naming one of the person's squads.
    if (tab === 'my-squads' && squad) return `/my-squads${query({ clubId: String(club), squad })}`;
    if (tab === null) return officePath(club, 'staff', context);
    const personal = personalWorkspaceTarget(tab, search.get('hub'));
    if (personal) return personal;
    switch (tab) {
        case 'overview': case 'actions': return '/requests';
        case 'inbox': return '/requests?view=updates';
        case 'personnel': case 'invites': return officePath(club, 'staff', context);
        case 'jobs': return officePath(club, 'staff', { ...context, view: 'jobs' });
        case 'squads':
            return coaches(capabilities, squad) ? `/my-squads${query({ clubId: String(club), squad: squad! })}` : officePath(club, 'squads', context);
        case 'settings': return officePath(club, 'settings', context);
        case 'workspace-settings': return officePath(club, 'settings', { section: 'details', ...context });
        case 'calendar': return officePath(club, 'calendar', context);
        case 'tools': return officePath(club, 'tools');
        default: return isOfficeTool(tab) ? officeToolPath(club, tab, context) : officePath(club);
    }
}

/** Any address: an old club workspace one moves to where it lives now, everything else stays as it is. */
export function inClubOffice(address: string): string {
    const workspace = /^\/clubs\/([1-9]\d*)\/workspace(?:\?([^#]*))?$/.exec(address);
    return workspace ? legacyWorkspaceTarget(Number(workspace[1]), new URLSearchParams(workspace[2] ?? '')) : address;
}
