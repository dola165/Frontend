import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { applyPreferencesUpdate, type Preferences } from '../preferences/preferencesStore';
import { useResponsibilityFocus, useWorkspaceLayout } from './workspaceStructure';
import type { RoleView } from './useWorkspaceRoles';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
const view = (id: string): RoleView => ({ id, label: id, modules: [], squadIds: [3], clubWide: false, appointmentId: null, revision: null });

afterEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('a person’s own workspace rail', () => {
    it('starts from the saved layout and focus, and saves each change for that club only', async () => {
        let saved: Preferences = { workspaces: { 7: { hiddenTabs: ['store'], hiddenResponsibilities: ['coaching'] } } };
        vi.mocked(apiClient.get).mockImplementation(async () => ({ data: saved }));
        vi.mocked(apiClient.put).mockImplementation(async (_url, body) => ({ data: (saved = applyPreferencesUpdate(saved, body as Preferences)) }));
        const views = [view('coaching'), view('welfare')];
        const { result } = renderHook(() => ({ layout: useWorkspaceLayout(7, 41), focus: useResponsibilityFocus(7, 41, views) }));
        await waitFor(() => expect(result.current.layout.isHidden('store')).toBe(true));
        expect(result.current.focus.selected).toEqual(['welfare']);

        act(() => result.current.layout.toggleArea('club'));
        expect(result.current.layout.hiddenAreas.has('club')).toBe(true);
        await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/users/me/preferences', { workspaces: { 7: { hiddenTabs: ['store'], hiddenAreas: ['club'] } } }));
        // Hiding the last responsibility would empty the rail, so it is refused rather than saved.
        act(() => result.current.focus.toggle('welfare'));
        expect(result.current.focus.selected).toEqual(['welfare']);
        act(() => result.current.focus.showAll());
        expect(result.current.focus.selected).toEqual(['coaching', 'welfare']);
        await waitFor(() => expect(apiClient.put).toHaveBeenLastCalledWith('/users/me/preferences', { workspaces: { 7: { hiddenResponsibilities: [] } } }));
    });
});
