import { describe, expect, it } from 'vitest';
import { decodeJobWorkspaces } from '../api';
import { workspaceTools } from '../registry';
import { scopeBootstrap } from '../scopeBootstrap';
import { workspaceDestinationPath, workspaceRecordPath, workspaceSectionPath } from '../paths';
import { bootstrap, desk, manifest, moduleScope, roles } from './fixtures';

describe('current-actor manifest', () => {
    it('keeps multiple jobs in one deduplicated destination and preserves exact mixed module scopes', () => {
        const item = desk('shared', [moduleScope('FINANCE', { globalRead: true, globalWrite: true }), moduleScope('MEDICAL', { writeSquadIds: [] })]);
        item.jobTitles = ['Fees officer', 'Physio', 'Fees officer'];
        const data = decodeJobWorkspaces(manifest([item]), 7, 9);
        expect(data.workspaces).toHaveLength(1);
        expect(data.workspaces[0].jobTitles).toEqual(['Fees officer', 'Physio']);
        expect(data.workspaces[0].clubWide).toBe(false);
        expect(workspaceTools(data.workspaces[0]).map(t => t.module)).toEqual(['FINANCE', 'MEDICAL']);
        const boot = scopeBootstrap(bootstrap(), data.workspaces[0], roles(), 'MEDICAL');
        expect(boot.modules.find(m => m.id === 'FINANCE')).toMatchObject({ globalRead: true, globalWrite: true });
        expect(boot.modules.find(m => m.id === 'MEDICAL')).toMatchObject({ globalRead: false, globalWrite: false, writable: false, readSquads: [2], writeSquads: [] });
        expect(boot.people.map(p => p.id)).toEqual([4]);
        expect(boot.squads.map(p => p.id)).toEqual([2]);
        expect(boot.sessions.map(p => p.id)).toEqual([6]);
    });
    it.each([
        (data: ReturnType<typeof manifest>) => { data.actorId = 10; },
        (data: ReturnType<typeof manifest>) => { data.clubId = 8; },
        (data: ReturnType<typeof manifest>) => { data.workspaces[0].path = 'https://example.test/'; },
        (data: ReturnType<typeof manifest>) => { data.workspaces[0].path = '/clubs/8/work/money'; },
        (data: ReturnType<typeof manifest>) => { data.workspaces[0].moduleScopes = []; },
        (data: ReturnType<typeof manifest>) => { data.workspaces[0].moduleScopes[0].readSquadIds = [-1]; },
        (data: ReturnType<typeof manifest>) => { data.workspaces[0].clubWide = true; },
        (data: ReturnType<typeof manifest>) => { data.workspaces.push(data.workspaces[0]); },
    ])('rejects a malformed, ambiguous or wrong-context response (%#)', change => {
        const data = manifest(); change(data);
        expect(() => decodeJobWorkspaces(data, 7, 9)).toThrow('Could not confirm');
    });
    it('never infers tools from a job title, unknown module or empty scopes', () => {
        const item = desk('money', []); item.jobTitles = ['Owner', 'Finance officer'];
        expect(decodeJobWorkspaces(manifest([item]), 7, 9).workspaces).toEqual([]);
        expect(workspaceTools(desk('money', [moduleScope('MEDICAL')]))).toEqual([]);
        expect(workspaceTools(desk('shared', [moduleScope('FUTURE_TOOL')]))).toEqual([]);
        const future = { ...item, key: 'new-unknown-desk' };
        expect(decodeJobWorkspaces({ ...manifest(), workspaces: [future] }, 7, 9).workspaces).toEqual([]);
    });
    it('does not promote a module or draft scope using aggregate squadIds', () => {
        const item = desk('shared', [moduleScope('FINANCE', { globalRead: true }), moduleScope('MEDICAL')]);
        const boot = bootstrap(); boot.modules.find(m => m.id === 'MEDICAL')!.globalWrite = false;
        boot.modules.find(m => m.id === 'MEDICAL')!.writeSquads = [];
        const scoped = scopeBootstrap(boot, item, roles(), 'MEDICAL');
        expect(scoped.modules.find(m => m.id === 'MEDICAL')!.writable).toBe(false);
        expect(scoped.squads.map(s => s.id)).toEqual([2]);
    });
});

describe('source navigation', () => {
    it('preserves person/session/squad and source tokens while retiring the previous record on a tool change', () => {
        const context = new URLSearchParams('record=18&person=4&session=6&squad=2&coachReturn=my-squads&coachClub=7&return=squads&source=fixture&tool=finance&q=old&page=4');
        const path = workspaceSectionPath(7, desk(), 'finance', context);
        const query = new URLSearchParams(path.split('?')[1]);
        expect(Object.fromEntries(query)).toEqual({ person: '4', session: '6', squad: '2', coachReturn: 'my-squads', coachClub: '7', return: 'squads', source: 'fixture', tool: 'finance' });
        const record = new URL(workspaceRecordPath(7, desk(), 'finance', { id: 19, squad_id: 2 }, context), 'http://localhost');
        expect(record.searchParams.get('record')).toBe('19');
        expect(record.searchParams.get('session')).toBe('6');
        expect(record.searchParams.get('return')).toBe('squads');
    });
    it('keeps existing destinations and their club rather than nesting their workspace', () => {
        const item = { ...desk('squads', []), path: '/my-squads?clubId=7', maturity: 'working' as const };
        expect(workspaceDestinationPath(item, new URLSearchParams('clubId=8&squad=2&person=4'))).toBe('/my-squads?clubId=7&squad=2&person=4');
    });
});
