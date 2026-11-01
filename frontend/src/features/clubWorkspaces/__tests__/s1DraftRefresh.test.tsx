import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../../context/AuthContext';
import ClubJobWorkspacePage from '../../../pages/ClubJobWorkspacePage';
import { setStoredAccessToken } from '../../../utils/authStorage';
import { announceAccessRefresh } from '../../../hooks/accessRefresh';
import { bootstrap, desk, manifest, moduleScope, roles } from './fixtures';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), manifest: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({
    apiClient: { get: mocks.get, post: mocks.post }, ensureCsrfToken: async () => undefined, refreshAccessToken: vi.fn(),
    setAccountRestrictionHandler: vi.fn(), setAuthFailureHandler: vi.fn(), setDisplayedAuthSession: vi.fn(),
}));

const deferred = () => {
    let resolve!: (value: ReturnType<typeof manifest>) => void;
    const promise = new Promise<ReturnType<typeof manifest>>(done => { resolve = done; });
    return { promise, resolve };
};
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    setStoredAccessToken('synthetic-s1-session');
    mocks.manifest.mockImplementation(async () => manifest());
    const boot = bootstrap(); boot.definitions = [{ module: 'FINANCE', kind: 'BUDGET', label: 'Budget', states: ['DRAFT'], fields: [] }];
    mocks.get.mockImplementation(async (url: string) => {
        if (url === '/users/me') return { data: { id: 9, role: 'COACH', profileComplete: true, emailVerified: true, navigationCapabilities: { version: 1, workspaces: [] } } };
        if (url === '/clubs/7/job-workspaces') return { data: await mocks.manifest() };
        if (url === '/clubs/7/operations') return { data: boot };
        if (url === '/clubs/7/workspace-roles?view=all') return { data: roles() };
        if (url === '/access/clubs/7') return { data: { allowed: [], refused: [] } };
        if (url.startsWith('/clubs/7/workspace-roles/work?') || url === '/clubs/7/operations/finance-summary') return { data: [] };
        throw new Error('Unexpected S1 regression API request: ' + url);
    });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });

async function dirtyEditor() {
    render(<MemoryRouter initialEntries={['/clubs/7/work/money?tool=finance&squad=2']}><AuthProvider><Routes>
        <Route path="/clubs/:id/work/:workspace" element={<ClubJobWorkspacePage />} />
        <Route path="/requests" element={<h1>Canonical Inbox</h1>} />
    </Routes></AuthProvider></MemoryRouter>);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add budget' }))[0]);
    const input = await screen.findByRole('textbox', { name: 'Title' });
    fireEvent.change(input, { target: { value: 'Unfinished record — S1' } });
    return input;
}

it.each(['interval', 'focus'] as const)('S1 keeps the real canonical editor through the actual AuthContext %s refresh and identical manifest', async signal => {
    if (signal === 'interval') vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const input = await dirtyEditor(), form = input.closest('form');
    const pending = deferred(); mocks.manifest.mockReturnValueOnce(pending.promise);
    const userReads = mocks.get.mock.calls.filter(([url]) => url === '/users/me').length;
    if (signal === 'interval') await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    else fireEvent(window, new Event('focus'));
    await waitFor(() => expect(mocks.manifest).toHaveBeenCalledTimes(2));
    expect(mocks.get.mock.calls.filter(([url]) => url === '/users/me')).toHaveLength(userReads + 1);
    expect(input.isConnected).toBe(true);
    expect(input).not.toBeVisible();
    expect(input.closest('[inert]')).not.toBeNull();
    await act(async () => { pending.resolve(manifest()); });
    await waitFor(() => expect(input).toBeVisible());
    expect(screen.getByRole('textbox', { name: 'Title' })).toBe(input);
    expect(input.closest('form')).toBe(form);
    expect(input).toHaveValue('Unfinished record — S1');
    fireEvent.click(screen.getByRole('link', { name: 'Inbox' }));
    await screen.findByRole('group', { name: 'Discard edits' });
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(input).toHaveValue('Unfinished record — S1');
    expect(JSON.stringify(localStorage) + JSON.stringify(sessionStorage)).not.toContain('Unfinished record — S1');
});

it('S1 preserves the draft through a retryable revalidation failure and successful retry', async () => {
    const input = await dirtyEditor(); mocks.manifest.mockRejectedValueOnce({ response: { status: 503, data: { detail: 'Temporarily unavailable' } } });
    act(() => announceAccessRefresh());
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporarily unavailable');
    expect(input.isConnected).toBe(true); expect(input).not.toBeVisible(); expect(input.closest('[inert]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(input).toBeVisible());
    expect(screen.getByRole('textbox', { name: 'Title' })).toBe(input); expect(input).toHaveValue('Unfinished record — S1');
});

it('S1 preserves the editor for reordered identical scopes and changed display-only job labels', async () => {
    const current = () => manifest([desk('money', [moduleScope('FINANCE', { readSquadIds: [2, 3], writeSquadIds: [2, 3] })])]);
    mocks.manifest.mockImplementation(async () => current());
    const input = await dirtyEditor(), next = current();
    next.workspaces[0].moduleScopes[0].readSquadIds.reverse(); next.workspaces[0].moduleScopes[0].writeSquadIds.reverse();
    next.workspaces[0].jobTitles = ['Updated title']; mocks.manifest.mockResolvedValueOnce(next);
    await act(async () => announceAccessRefresh());
    await waitFor(() => expect(input).toBeVisible());
    expect(screen.getByRole('textbox', { name: 'Title' })).toBe(input); expect(input).toHaveValue('Unfinished record — S1');
});

it('S1 preserves the canonical unresolved-save retry and its idempotency key through revalidation', async () => {
    const input = await dirtyEditor(); mocks.post.mockRejectedValue(new Error('Uncertain connection'));
    fireEvent.click(screen.getByRole('button', { name: 'Save budget' }));
    await screen.findByRole('button', { name: 'Retry same save' });
    const original = mocks.post.mock.calls[0]; expect(original[2].headers['Idempotency-Key']).toBeTruthy();
    const pending = deferred(); mocks.manifest.mockReturnValueOnce(pending.promise);
    act(() => announceAccessRefresh()); await waitFor(() => expect(mocks.manifest).toHaveBeenCalledTimes(2));
    expect(input.isConnected).toBe(true);
    await act(async () => { pending.resolve(manifest()); });
    fireEvent.click(await screen.findByRole('button', { name: 'Retry same save' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
    expect(mocks.post.mock.calls[1]).toEqual(original);
    expect(JSON.stringify(localStorage) + JSON.stringify(sessionStorage)).not.toContain('Unfinished record — S1');
});

it.each([401, 403, 404])('S1 retires the draft after a confirmed %s refusal', async status => {
    const input = await dirtyEditor(); mocks.manifest.mockRejectedValueOnce({ response: { status, data: { detail: 'Current access ended' } } });
    act(() => announceAccessRefresh());
    expect(await screen.findByRole('alert')).toHaveTextContent('Current access ended');
    expect(input.isConnected).toBe(false); expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
});

it('S1 retires the draft when the current squad scope is lost', async () => {
    const input = await dirtyEditor(); mocks.manifest.mockResolvedValueOnce(manifest([desk('money', [moduleScope('FINANCE', { readSquadIds: [3], writeSquadIds: [3] })])]));
    act(() => announceAccessRefresh()); await screen.findByText('This squad is outside this tool’s current scope');
    expect(input.isConnected).toBe(false);
});

it('S1 retires a writer’s editor when only read scope remains', async () => {
    const input = await dirtyEditor(); mocks.manifest.mockResolvedValueOnce(manifest([desk('money', [moduleScope('FINANCE', { writeSquadIds: [] })])]));
    act(() => announceAccessRefresh()); await screen.findByRole('heading', { name: 'Finance' });
    expect(input.isConnected).toBe(false); expect(screen.queryByRole('button', { name: 'Add budget' })).not.toBeInTheDocument();
});

it('S1 does not retain a draft or accept a late refresh after the same actor starts a new session', async () => {
    const input = await dirtyEditor(), pending = deferred(); mocks.manifest.mockReturnValueOnce(pending.promise);
    act(() => announceAccessRefresh()); await waitFor(() => expect(mocks.manifest).toHaveBeenCalledTimes(2));
    act(() => setStoredAccessToken('synthetic-new-s1-session'));
    expect(input.isConnected).toBe(false);
    await screen.findByRole('heading', { name: 'Finance' });
    await act(async () => { pending.resolve(manifest()); });
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
});
