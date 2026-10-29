import { matchPath } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Bootstrap } from '../clubOperations/api';
import { operationModule } from '../clubOperations/workspaceNavigation';
import { bareLink, inClubOffice, isMovedTool, isOfficeTool, legacyWorkspaceTarget, MORE_TOOLS, MOVED_TOOLS, movedToolPath, OFFICE_PLACES, OFFICE_TOOLS, type MovedTool } from './officeLinks';
import { moreToolGroups, toolStates } from './officeTools';
import app from '../../App.tsx?raw';

/** Every tab the club workspace answered to (release 13), and the personal tabs that had already moved to My squads. */
const OLD_TABS = ['overview', 'calendar', 'personnel', 'players', 'invites', 'admissions', 'applications', 'jobs', 'settings', 'programmes', 'squads',
    'player-cards', 'tryouts', 'inbox', 'store', 'campaigns', 'club-approaches', 'actions', 'staff-duties', 'credentials', 'specialists', 'guardians',
    'attendance', 'registration', 'departures', 'development', 'education', 'facilities', 'preparation', 'equipment', 'finance', 'travel',
    'restrictions', 'medical', 'welfare', 'workspace-settings', 'tools', 'coach-hub', 'my-day', 'my-squads', 'my-people', 'my-role'];
/** The tools of the older club screens, which Club office opens through ClubTools rather than by module. */
const SCREENS = ['admissions', 'applications', 'players', 'player-cards', 'campaigns', 'programmes', 'store', 'tryouts', 'club-approaches'];
/** Where each old tab that isn't a tool lands, with a record open; every other one opens as its tool with the record. */
const PLACES: Record<string, string> = {
    overview: '/requests', actions: '/requests', inbox: '/requests?view=updates',
    personnel: '/clubs/7/office?record=5', invites: '/clubs/7/office?record=5', jobs: '/clubs/7/office?record=5&view=jobs',
    squads: '/clubs/7/office?tab=squads&record=5', settings: '/clubs/7/office?tab=settings&record=5',
    'workspace-settings': '/clubs/7/office?tab=settings&section=details&record=5', calendar: '/clubs/7/office?tab=calendar&record=5', tools: '/clubs/7/office?tab=tools',
    'coach-hub': '/my-squads', 'my-day': '/my-squads', 'my-squads': '/my-squads', 'my-people': '/my-squads?tab=players', 'my-role': '/my-squads?tab=coaches',
    // The campaigns manager is Projects (step 4).
    campaigns: '/projects?club=7',
};
const expected = (tab: string) => PLACES[tab] ?? `/clubs/7/office?tab=tools&tool=${tab}&record=5`;

// The catch-all route answers every address, so it proves nothing about where one lands.
const mounted = [...app.matchAll(/<Route path="([^"]+)"/g)].map(match => match[1]).filter(path => path !== '*');
const at = (target: string) => new URL(target, 'http://fixture.invalid');
const lands = (target: string) => mounted.some(path => matchPath({ path, end: true }, at(target).pathname));
const coach = { version: 1 as const, workspaces: [{ id: 'squad.workspace', context: { type: 'squad', id: 105, label: 'U16 Boys' } }] };

describe('old club workspace addresses', () => {
    it.each(OLD_TABS)('?tab=%s lands where it should, on a mounted route that shows it', tab => {
        const target = legacyWorkspaceTarget(7, new URLSearchParams({ tab, record: '5' }));
        expect(target).toBe(expected(tab));
        expect(lands(target), target).toBe(true);
        const url = at(target);
        if (url.pathname !== '/clubs/7/office') return;
        const place = url.searchParams.get('tab'), tool = url.searchParams.get('tool');
        expect(place === null || (OFFICE_PLACES as readonly string[]).includes(place), target).toBe(true);
        if (tool) {
            expect(isOfficeTool(tool), target).toBe(true);
            expect(url.searchParams.get('record'), 'the record stays open').toBe('5');
        }
    });

    it('opens Club office itself for a bare club workspace address', () => {
        expect(legacyWorkspaceTarget(7, new URLSearchParams())).toBe('/clubs/7/office');
        expect(legacyWorkspaceTarget(7, new URLSearchParams('view=jobs'))).toBe('/clubs/7/office?view=jobs');
        expect(inClubOffice('/clubs/7/workspace')).toBe('/clubs/7/office');
        expect(inClubOffice('/clubs/7/workspace?tab=player-cards&squad=106')).toBe('/clubs/7/office?tab=tools&tool=player-cards&squad=106');
        expect(inClubOffice('/clubs/7/squads')).toBe('/clubs/7/squads');
        expect(lands('/clubs/7/workspace')).toBe(true);
        expect(lands('/clubs/7/office')).toBe(true);
    });

    it('sends each kind of place where it lives now', () => {
        const to = (query: string) => legacyWorkspaceTarget(7, new URLSearchParams(query), coach);
        expect(to('')).toBe('/clubs/7/office');
        expect(to('tab=actions')).toBe('/requests');
        expect(to('tab=inbox')).toBe('/requests?view=updates');
        expect(to('tab=personnel&q=nino')).toBe('/clubs/7/office?q=nino');
        expect(to('tab=invites')).toBe('/clubs/7/office');
        expect(to('tab=jobs')).toBe('/clubs/7/office?view=jobs');
        expect(to('tab=squads&squad=105')).toBe('/my-squads?clubId=7&squad=105');
        expect(to('tab=squads&squad=106')).toBe('/clubs/7/office?tab=squads&squad=106');
        expect(to('tab=player-cards&squad=106')).toBe('/clubs/7/office?tab=tools&tool=player-cards&squad=106');
        expect(to('tab=settings&section=profile')).toBe('/clubs/7/office?tab=settings&section=profile');
        expect(to('tab=workspace-settings')).toBe('/clubs/7/office?tab=settings&section=details');
        expect(to('tab=calendar&date=2026-10-30')).toBe('/clubs/7/office?tab=calendar&date=2026-10-30');
        expect(to('tab=tools')).toBe('/clubs/7/office?tab=tools');
        expect(to('tab=finance&record=12')).toBe('/clubs/7/office?tab=tools&tool=finance&record=12');
        expect(to('tab=applications&applicationId=3')).toBe('/clubs/7/office?tab=tools&tool=applications&applicationId=3');
        expect(to('tab=my-people')).toBe('/my-squads?tab=players');
        expect(to('tab=not-a-tab')).toBe('/clubs/7/office');
    });

    it('opens every More tools entry as a tool screen', () => {
        for (const tool of OFFICE_TOOLS) expect(Boolean(operationModule(tool)) || SCREENS.includes(tool), tool).toBe(true);
        // Whatever a job opens today is listed: duties and specialists wait for Staff, equipment for Kit. Applications,
        // attendance and preparation moved into My squads (step 3); setting up joining stays here.
        const group = (id: string) => MORE_TOOLS.find(item => item.id === id)?.tools;
        expect(group('kit')).toEqual(['equipment']);
        expect(group('staff')).toEqual(['staff-duties', 'specialists']);
        expect(group('joining')).toEqual(['admissions']);
        expect(group('registration')).toEqual(expect.arrayContaining(['players', 'player-cards']));
        for (const tool of Object.keys(MOVED_TOOLS)) expect(MORE_TOOLS.flatMap(item => item.tools as readonly string[])).not.toContain(tool);
    });
});

describe('tools that moved into My squads (step 3)', () => {
    it.each(Object.entries(MOVED_TOOLS))('?tab=%s opens in Club office, which sends a bare link on to My squads › %s', (tab, place) => {
        // Only Club office knows whether the person is on a squad at this club (a coach at one club may be an admin at
        // another), so the old address goes there whatever the navigation hints say.
        const target = legacyWorkspaceTarget(7, new URLSearchParams({ tab, squad: '105' }), coach);
        expect(target).toBe(`/clubs/7/office?tab=tools&tool=${tab}&squad=105`);
        expect(bareLink(at(target).searchParams)).toBe(true);
        expect(movedToolPath(7, tab as MovedTool, { squad: '105' })).toBe(`/my-squads?clubId=7&tab=${place}&squad=105`);
        expect(lands(movedToolPath(7, tab as MovedTool))).toBe(true);
    });

    it('opens every backend admissions link in Club office with its request, case, group or setup', () => {
        const to = (query: string) => inClubOffice(`/clubs/7/workspace?${query}`);
        expect(isMovedTool('admissions')).toBe(false);
        // JoiningService's staff destination, AdmissionInquiries' request and setup links, AdmissionCaseViews' group.
        expect(to('tab=admissions')).toBe('/clubs/7/office?tab=tools&tool=admissions');
        expect(to('tab=admissions&inquiryId=9')).toBe('/clubs/7/office?tab=tools&tool=admissions&inquiryId=9');
        expect(to('tab=admissions&caseId=3')).toBe('/clubs/7/office?tab=tools&tool=admissions&caseId=3');
        expect(to('tab=admissions&inquiryId=9&joiningSetup=1')).toBe('/clubs/7/office?tab=tools&tool=admissions&inquiryId=9&joiningSetup=1');
        expect(to('tab=admissions&admissionView=groups&group=4')).toBe('/clubs/7/office?tab=tools&tool=admissions&admissionView=groups&group=4');
    });

    it('sends only a bare link on: anything it names more opens the tool here', () => {
        expect(bareLink(new URLSearchParams('tab=tools&tool=applications&squad=105'))).toBe(true);
        expect(bareLink(new URLSearchParams('tab=tools&tool=applications&applicationId=3'))).toBe(false);
        expect(bareLink({ tool: 'attendance', record: '12' })).toBe(false);
        expect(bareLink({ tool: 'attendance', person: '40' })).toBe(false);
        // A session's register stays in the tool (My squads finds only its own squads' sessions of the coming weeks),
        // and Squads' way back to itself is Club office's own.
        expect(bareLink({ tool: 'attendance', squad: '105', session: '7' })).toBe(false);
        expect(bareLink({ tool: 'attendance', squad: '105', return: 'squads' })).toBe(false);
        expect(legacyWorkspaceTarget(7, new URLSearchParams('tab=attendance&squad=105&session=7'), coach)).toBe('/clubs/7/office?tab=tools&tool=attendance&squad=105&session=7');
        expect(legacyWorkspaceTarget(7, new URLSearchParams('tab=attendance&record=12'), coach)).toBe('/clubs/7/office?tab=tools&tool=attendance&record=12');
    });
});

const boot = (modules: Bootstrap['modules'], leadership = false): Bootstrap => ({ clubId: 7, clubName: 'Club', actorId: 1, leadership, definitions: [], specialisations: [], permissions: [],
    settings: { setting: 'CLUB', playing_level: 'AMATEUR', enabled_modules: ['MEDICAL', 'AVAILABILITY', 'FINANCE', 'TRAVEL', 'WELFARE'], revision: 0 },
    modules, squads: [], people: [], staff: [], venues: [], guardians: [], events: [], sessions: [], links: [] });
const module = (id: string, writable = true) => ({ id, writable, globalWrite: writable, writeSquads: [], readSquads: [], globalRead: true });

describe('More tools for each person', () => {
    it('shows a physio only the tools their job opens', () => {
        const states = toolStates({ boot: boot([module('MEDICAL'), module('AVAILABILITY')]), role: null, admissions: false });
        expect([...states.keys()].sort()).toEqual(['medical', 'restrictions']);
        expect(moreToolGroups(states, boot([]), false).map(group => group.id)).toEqual(['player-file']);
    });

    it('shows admins every group, the locked drawers locked and the older screens open', () => {
        const states = toolStates({ boot: boot([module('FINANCE'), module('TRAVEL', false)], true), role: 'CLUB_ADMIN', admissions: true });
        expect(states.get('medical')).toBe('locked');
        expect(states.get('welfare')).toBe('locked');
        expect(states.get('travel')).toBe('view');
        expect(states.get('store')).toBe('open');
        expect(states.get('admissions')).toBe('open');
        // A tool the club switched off leaves the list (its old links still open it).
        expect(moreToolGroups(states, boot([], true), true).flatMap(group => group.tools)).not.toContain('equipment');
        expect(moreToolGroups(states, boot([], true), true).map(group => group.id)).toEqual(expect.arrayContaining(['money', 'joining']));
    });

    it('keeps an older coach membership’s players and their cards, applications and tryouts', () => {
        const states = toolStates({ boot: boot([]), role: 'COACH', admissions: false });
        expect([...states.keys()].sort()).toEqual(['applications', 'player-cards', 'players', 'tryouts']);
    });

    it('keeps Attendance in More tools for a Custom job with only Attendance, which is on no squad', () => {
        const states = toolStates({ boot: boot([module('ATTENDANCE')]), role: null, admissions: false });
        expect([...states.entries()]).toEqual([['attendance', 'open']]);
        const club = { ...boot([]), settings: { ...boot([]).settings, enabled_modules: ['ATTENDANCE'] } };
        expect(moreToolGroups(states, club, false, false).map(item => [item.id, item.tools])).toEqual([['my-squads', ['attendance']]]);
        // On a squad, attendance is the session's register in My squads.
        expect(moreToolGroups(states, club, false, true)).toEqual([]);
    });

    it('doesn\'t lock an admin\'s tools before the club\'s tools have loaded', () => {
        const states = toolStates({ boot: null, role: 'CLUB_ADMIN', admissions: false });
        expect([...states.values()].includes('locked')).toBe(false);
    });
});

describe('Projects (step 4)', () => {
    it('takes the campaigns manager out of More tools and lands its old links in Projects', () => {
        expect(MORE_TOOLS.flatMap(group => group.tools)).not.toContain('campaigns');
        expect(isOfficeTool('campaigns')).toBe(false);
        expect(legacyWorkspaceTarget(4, new URLSearchParams('tab=campaigns&campaign=9'))).toBe('/projects?club=4');
        expect(inClubOffice('/clubs/4/workspace?tab=campaigns')).toBe('/projects?club=4');
    });
});
