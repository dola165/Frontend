import { normalizeNavigationCapabilities, workspaceLinks } from '../navigationCapabilities';

const entry = (id: string, type: string, contextId: unknown = 7) => ({ id, context: { type, id: contextId, label: 'Academy' } });

describe('server navigation contract', () => {
    it('keeps organization settings reachable in their explicit authorized context', () => {
        const projection = normalizeNavigationCapabilities({ version: 1, workspaces: [
            entry('organization.settings', 'organization', 35), entry('organization.settings', 'user'),
            entry('venue.workspace', 'organization', 35), entry('tournament.create', 'organization', 35),
        ] }, 7);
        expect(workspaceLinks(projection).map(link => link.path)).toEqual([
            '/organizations/35/workspace?tab=settings', '/stadiums/35/manage', '/tournaments/setup?organizer=35',
        ]);
    });
    it('opens only the current actor read-only Agent Hub and ignores unrelated agent capabilities', () => {
        const projection = normalizeNavigationCapabilities({ version: 1, workspaces: [
            entry('agent.hub', 'user'), entry('agent.hub', 'user', 99),
            entry('agent.hub', 'organization'), entry('agent.marketplace', 'user'),
        ] }, 7);
        expect(workspaceLinks(projection)).toEqual([
            { key: 'agent.hub:user:7', capability: 'agent.hub', path: '/agent', label: 'Agent Hub' },
        ]);
    });
    it('distinguishes an old response from an explicit empty, invalid or unsupported projection', () => {
        expect(normalizeNavigationCapabilities(undefined, 7)).toBeUndefined();
        for (const value of [null, {}, { version: 2, workspaces: [entry('club.workspace', 'club')] }, { version: 1, workspaces: [] }]) {
            expect(normalizeNavigationCapabilities(value, 7)).toEqual({ version: 1, workspaces: [] });
        }
    });

    it('accepts simultaneous scoped responsibilities with stable keys and explicit destinations', () => {
        const projection = normalizeNavigationCapabilities({ version: 1, workspaces: [
            entry('parent.hub', 'user'), entry('club.workspace', 'club', 21), entry('club.workspace', 'club', 22),
            entry('referee.workspace', 'user'), entry('tournament.create', 'organization', 35),
        ] }, 7);
        const links = workspaceLinks(projection);
        expect(links.map(link => link.path)).toEqual(['/parent', '/clubs/21/workspace', '/clubs/22/workspace', '/referees/me', '/tournaments/setup?organizer=35']);
        expect(new Set(links.map(link => link.key)).size).toBe(5);
    });

    it('ignores unknown capabilities, incorrect scopes, another identity, invalid ids and duplicate entries', () => {
        const projection = normalizeNavigationCapabilities({ version: 1, workspaces: [
            entry('club.workspace', 'club', 21), entry('club.workspace', 'club', 21),
            entry('club.workspace', 'organization'), entry('parent.hub', 'user', 99),
            entry('club.workspace', 'club', -1), entry('club.workspace', 'club', '7'),
            entry('club.workspace', 'club', 1.5), entry('club.workspace', 'club', Number.MAX_SAFE_INTEGER + 1),
            entry('future.workspace', 'club'), entry('__proto__', 'club'), null,
        ] }, 7);
        expect(workspaceLinks(projection).map(link => link.path)).toEqual(['/clubs/21/workspace']);
    });

    it('uses only known destinations, never a supplied URL or role label', () => {
        const projection = normalizeNavigationCapabilities({ version: 1, role: 'SYSTEM_ADMIN', workspaces: [
            { ...entry('club.workspace', 'club'), path: 'https://attacker.invalid', context: { type: 'club', id: 7, label: 'SYSTEM_ADMIN' } },
        ] }, 7);
        expect(workspaceLinks(projection)).toEqual([{ key: 'club.workspace:club:7', capability: 'club.workspace', path: '/clubs/7/workspace', label: 'Workspace — SYSTEM_ADMIN' }]);
    });
});
