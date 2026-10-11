import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRestoredScroll } from '../directory/useRestoredScroll';

function List() {
    useRestoredScroll(true);
    return null;
}
// The router reports the first entry of a page load as a return (POP), with the key "default".
const open = () => render(<MemoryRouter initialEntries={['/world/clubs']}><List /></MemoryRouter>);

describe('the scroll of a World list', () => {
    afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

    it('starts a page opened from its address at the top, even with a scroll saved for that address', () => {
        sessionStorage.setItem('gk-world-scroll:default:/world/clubs', '500');
        const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
        open();
        expect(scroll).not.toHaveBeenCalled();
    });

    it('returns to where the person was after Back or Forward', () => {
        window.dispatchEvent(new PopStateEvent('popstate'));
        sessionStorage.setItem('gk-world-scroll:default:/world/clubs', '500');
        const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
        open();
        expect(scroll).toHaveBeenCalledWith({ top: 500 });
    });
});
