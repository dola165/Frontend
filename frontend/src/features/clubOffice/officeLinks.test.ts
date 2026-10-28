import { matchPath } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Bootstrap } from '../clubOperations/api';
import { operationModule } from '../clubOperations/workspaceNavigation';
import { isOfficeTool, legacyWorkspaceTarget, MORE_TOOLS, OFFICE_PLACES, OFFICE_TOOLS } from './officeLinks';
import { moreToolGroups, toolStates } from './officeTools';
import app from '../../App.tsx?raw';

/** Every tab the club workspace answered to (release 13), and the personal tabs that had already moved to My squads. */
const OLD_TABS = ['overview', 'calendar', 'personnel', 'players', 'invites', 'admissions', 'applications', 'jobs', 'settings', 'programmes', 'squads',
    'player-cards', 'tryouts', 'inbox', 'store', 'campaigns', 'club-approaches', 'actions', 'staff-duties', 'credentials', 'specialists', 'guardians',
    'attendance', 'registration', 'departures', 'development', 'education', 'facilities', 'preparation', 'equipment', 'finance', 'travel',
    'restrictions', 'medical', 'welfare', 'workspace-settings', 'tools', 'coach-hub', 'my-day', 'my-squads', 'my-people', 'my-role'];
/** The tools of the older club screens, which Club office opens through ClubTools rather than by module. */
const SCREENS = ['admissions', 'applications', 'players', 'campaigns', 'programmes', 'store', 'tryouts', 'club-approaches'];

const mounted = [...app.matchAll(/<Route path="([^"]+)"/g)].map(match => match[1]);
const at = (target: string) => new URL(target, 'http://fixture.invalid');
const lands = (target: string) => mounted.some(path => matchPath({ path, end: true }, at(target).pathname));
const coach = { version: 1 as const, workspaces: [{ id: 'squad.workspace', context: { type: 'squad', id: 105, label: 'U16 Boys' } }] };

describe('old club workspace addresses', () => {
    it.each(OLD_TABS)('?tab=%s lands on a mounted route that shows it', tab => {
        const target = legacyWorkspaceTarget(7, new URLSearchParams({ tab, record: '5' }));
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

    it('sends each kind of place where it lives now', () => {
        const to = (query: string) => legacyWorkspaceTarget(7, new URLSearchParams(query), coach);
        expect(to('')).toBe('/requests');
        expect(to('tab=actions')).toBe('/requests');
        expect(to('tab=inbox')).toBe('/requests?view=updates');
        expect(to('tab=personnel&q=nino')).toBe('/clubs/7/office?q=nino');
        expect(to('tab=invites')).toBe('/clubs/7/office');
        expect(to('tab=jobs')).toBe('/clubs/7/office?view=jobs');
        expect(to('tab=squads&squad=105')).toBe('/my-squads?clubId=7&squad=105');
        expect(to('tab=squads&squad=106')).toBe('/clubs/7/office?tab=squads&squad=106');
        expect(to('tab=player-cards')).toBe('/clubs/7/office?tab=squads');
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
        expect(MORE_TOOLS.flatMap(group => group.tools)).not.toContain('staff-duties');
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
        expect(moreToolGroups(states, boot([], true), true).map(group => group.id)).toContain('money');
    });

    it('keeps an older coach membership’s players, applications and tryouts', () => {
        const states = toolStates({ boot: boot([]), role: 'COACH', admissions: false });
        expect([...states.keys()].sort()).toEqual(['applications', 'players', 'tryouts']);
    });
});
