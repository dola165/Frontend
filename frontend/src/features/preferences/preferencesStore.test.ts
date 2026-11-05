import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { applyPreferencesUpdate, loadPreferences, readPreferences, updatePreferences } from './preferencesStore';

// A fake server holding one document per account (the signed-in one is `server.current`), replacing sections as the
// real one does.
const server = vi.hoisted(() => ({ docs: new Map<number, Record<string, unknown>>(), current: 0 }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
const serve = () => {
    vi.mocked(apiClient.get).mockImplementation(async () => ({ data: server.docs.get(server.current) ?? {} }));
    vi.mocked(apiClient.put).mockImplementation(async (_url, body) => {
        const doc = applyPreferencesUpdate(server.docs.get(server.current) ?? {}, body as object);
        server.docs.set(server.current, doc as Record<string, unknown>);
        return { data: doc };
    });
};
let nextUser = 500;
const account = () => { serve(); return (server.current = nextUser++); };
const failure = (status?: number) => Object.assign(new Error('failed'), status ? { response: { status } } : {});

afterEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('preferences', () => {
    it('saves only the section a screen changed, so two screens never undo each other', async () => {
        const user = account();
        server.docs.set(user, { tutorials: { completed: ['calendar'] } });
        await loadPreferences(user);
        await Promise.all([
            updatePreferences(user, { start: { welcome: { state: 'OPEN', at: 'ROLES' } } }),
            updatePreferences(user, { pins: { pins: [] } }),
        ]);
        const bodies = vi.mocked(apiClient.put).mock.calls.map(([, body]) => body);
        expect(bodies.every(body => !('tutorials' in (body as object)))).toBe(true);
        expect(server.docs.get(user)).toEqual({ tutorials: { completed: ['calendar'] }, start: { welcome: { state: 'OPEN', at: 'ROLES' } }, pins: { pins: [] } });
        expect(readPreferences(user)).toMatchObject(server.docs.get(user)!);
    });

    it('replaces only the sections an update names', () => {
        const doc = applyPreferencesUpdate({ tutorials: { completed: ['calendar'] }, pins: { pins: [] } }, { pins: { pins: [{ path: '/calendar', label: 'Calendar', icon: 'calendar' }] } });
        expect(doc).toEqual({ tutorials: { completed: ['calendar'] }, pins: { pins: [{ path: '/calendar', label: 'Calendar', icon: 'calendar' }] } });
    });

    it('shows a change at once, keeps it through a failed save and sends it with the next one', async () => {
        const user = account();
        await loadPreferences(user);
        vi.mocked(apiClient.put).mockRejectedValueOnce(failure());
        const lost = updatePreferences(user, { tutorials: { completed: ['calendar'] } });
        expect(readPreferences(user).tutorials).toEqual({ completed: ['calendar'] });
        await expect(lost).rejects.toThrow('failed');
        expect(JSON.parse(localStorage.getItem(`gk-prefs:v1:${user}`)!).pending).toEqual({ tutorials: { completed: ['calendar'] } });
        await updatePreferences(user, { pins: { pins: [] } });
        expect(apiClient.put).toHaveBeenLastCalledWith('/users/me/preferences', { tutorials: { completed: ['calendar'] }, pins: { pins: [] } });
        expect(server.docs.get(user)).toEqual({ tutorials: { completed: ['calendar'] }, pins: { pins: [] } });
    });

    it('drops a change the server refuses and shows what the server holds', async () => {
        const user = account();
        server.docs.set(user, { pins: { pins: [] } });
        await loadPreferences(user);
        vi.mocked(apiClient.put).mockRejectedValueOnce(failure(400));
        await expect(updatePreferences(user, { pins: { pins: [{ path: '//evil.example', label: 'Away', icon: 'squad' }] } })).rejects.toThrow();
        await vi.waitFor(() => expect(readPreferences(user).pins).toEqual({ pins: [] }));
        expect(JSON.parse(localStorage.getItem(`gk-prefs:v1:${user}`)!).pending).toBeNull();
    });

    it('carries the calendar tour kept only on this device over once, and clears the old workspace rails', async () => {
        const user = account();
        localStorage.setItem(`gk-ws-layout:v1:7:${user}`, JSON.stringify({ tabs: ['store', '<bad>'], areas: [] }));
        localStorage.setItem(`gk-ws-focus:v1:7:${user}`, JSON.stringify(['squad:3']));
        localStorage.setItem(`gk-ws-layout:v1:8:${user + 1}`, JSON.stringify({ tabs: ['jobs'], areas: [] }));
        localStorage.setItem('tutorial.calendar.completed', 'true');
        await loadPreferences(user);
        await vi.waitFor(() => expect(server.docs.get(user)).toEqual({ tutorials: { completed: ['calendar'] } }));
        expect(localStorage.getItem(`gk-ws-layout:v1:7:${user}`)).toBeNull();
        expect(localStorage.getItem(`gk-ws-focus:v1:7:${user}`)).toBeNull();
        expect(localStorage.getItem('tutorial.calendar.completed')).toBeNull();
        // Another account's device choices are left for that account.
        expect(localStorage.getItem(`gk-ws-layout:v1:8:${user + 1}`)).not.toBeNull();
    });
});
