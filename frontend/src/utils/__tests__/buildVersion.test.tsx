import { act, render } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBuildWatch } from '../../hooks/useBuildWatch';
import { announceBuild, BUILD_CHECK_MS, checkBuild, page, reloadForBuild, resetBuildKnowledge, staleBuild } from '../buildVersion';

const served = (id: string) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id }), { status: 200 }));

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetBuildKnowledge();
    vi.spyOn(page, 'reload').mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('the running build', () => {
    it('is never checked while developing', async () => {
        const fetch = served('b2');
        announceBuild();
        expect(await checkBuild()).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
        expect(staleBuild()).toBe(false);
    });

    it('goes out of date when a newer tab starts, or when the server says so, asking at most every few minutes', async () => {
        vi.stubGlobal('__BUILD_ID__', 'b1');
        announceBuild();
        expect(staleBuild()).toBe(false);
        // Another tab started on the new build.
        localStorage.setItem('gk-build', 'b2');
        expect(staleBuild()).toBe(true);

        localStorage.clear();
        resetBuildKnowledge();
        const fetch = served('b1');
        expect(await checkBuild(1_000_000)).toBe(false);
        fetch.mockResolvedValue(new Response(JSON.stringify({ id: 'b3' }), { status: 200 }));
        expect(await checkBuild(1_000_000 + BUILD_CHECK_MS - 1)).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(await checkBuild(1_000_000 + BUILD_CHECK_MS)).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls[1][0]).toMatch(/^\/build\.json\?t=/);
    });

    it('reloads into the new build at most once every few minutes, so two builds served side by side never loop', () => {
        expect(reloadForBuild()).toBe(true);
        expect(reloadForBuild()).toBe(false);
        expect(page.reload).toHaveBeenCalledTimes(1);
    });
});

function Watch({ signedOut }: { signedOut: boolean }) {
    useBuildWatch(signedOut);
    const navigate = useNavigate();
    return <button type="button" onClick={() => navigate('/world')}>go</button>;
}

describe('an open tab across a release', () => {
    it('keeps working until the next navigation, which loads the new build', async () => {
        vi.stubGlobal('__BUILD_ID__', 'b1');
        const view = render(<MemoryRouter initialEntries={['/home']}><Watch signedOut={false} /></MemoryRouter>);
        act(() => { localStorage.setItem('gk-build', 'b2'); window.dispatchEvent(new StorageEvent('storage', { key: 'gk-build' })); });
        expect(page.reload).not.toHaveBeenCalled();
        act(() => view.getByRole('button').click());
        expect(page.reload).toHaveBeenCalledTimes(1);
    });

    it('reloads at once while signed out', () => {
        vi.stubGlobal('__BUILD_ID__', 'b1');
        render(<MemoryRouter initialEntries={['/login']}><Watch signedOut /></MemoryRouter>);
        expect(page.reload).not.toHaveBeenCalled();
        act(() => { localStorage.setItem('gk-build', 'b2'); window.dispatchEvent(new StorageEvent('storage', { key: 'gk-build' })); });
        expect(page.reload).toHaveBeenCalledTimes(1);
    });
});
