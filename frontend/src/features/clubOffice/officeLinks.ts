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
 * listed, so a job whose only tools are attendance or duties still finds them (review, 28 October 2026).
 */
export const MORE_TOOLS = [
    { id: 'my-squads', page: ['My squads', 'ჩემი გუნდები'], tools: ['admissions', 'applications', 'equipment', 'attendance', 'preparation'] },
    { id: 'staff', page: ['Staff', 'პერსონალი'], tools: ['staff-duties', 'specialists'] },
    { id: 'projects', page: ['Projects', 'პროექტები'], tools: ['campaigns'] },
    { id: 'registration', page: ['Registration', 'რეგისტრაცია'], tools: ['players', 'player-cards', 'registration', 'departures', 'credentials'] },
    { id: 'player-file', page: ['Player file', 'მოთამაშის საქმე'], tools: ['development', 'restrictions', 'medical', 'education'] },
    { id: 'safeguarding', page: ['Safeguarding', 'ბავშვთა დაცვა'], tools: ['welfare', 'guardians'] },
    { id: 'money', page: ['Money', 'ფული'], tools: ['finance'] },
    { id: 'club-page', page: ['The club page', 'კლუბის გვერდი'], tools: ['facilities', 'programmes', 'store'] },
    { id: 'scouting', page: ['Scouting', 'სკაუტინგი'], tools: ['tryouts', 'club-approaches'] },
    { id: 'travel', page: ['Travel', 'მგზავრობა'], tools: ['travel'] },
] as const;

export type OfficeTool = typeof MORE_TOOLS[number]['tools'][number];
export const OFFICE_TOOLS: readonly OfficeTool[] = MORE_TOOLS.flatMap(group => group.tools);
export const isOfficeTool = (value: string | null | undefined): value is OfficeTool => OFFICE_TOOLS.includes(value as OfficeTool);

const query = (values: Record<string, string>) => { const text = new URLSearchParams(values).toString(); return text ? `?${text}` : ''; };

/** A Club office place, with what it shows (a squad, a settings section, a date) in the address. */
export const officePath = (club: number, place: OfficePlace = 'staff', context: Record<string, string> = {}) =>
    `/clubs/${club}/office${query({ ...(place === 'staff' ? {} : { tab: place }), ...context })}`;

/** A tool opened inside More tools, with its record, squad, session or person. */
export const officeToolPath = (club: number, tool: OfficeTool, context: Record<string, string> = {}) =>
    officePath(club, 'tools', { tool, ...context });

/** A squad the person coaches, from the server's navigation hints: its own page is My squads. */
const coaches = (capabilities: NavigationCapabilities | undefined, squad: string | null) =>
    squad !== null && (capabilities?.workspaces ?? []).some(item => item.id === 'squad.workspace' && String(item.context.id) === squad);

/**
 * Where an old club workspace address lands (notifications already sent, saved pins, bookmarks): Club office itself
 * when it names no tab, its places, More tools with the record still open, the Inbox only for the old Today, work
 * queue and updates, and My squads for a coach's own squad and the old personal tabs. Every context value but the
 * tab itself travels along.
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
