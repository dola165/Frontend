import { useMemo, useState, type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListSplit } from '../directory/ListSplit';
import { ResultRow } from '../directory/ResultRow';
import { Drawers } from '../peek/Drawers';
import { StageContext, type StageValue } from '../stage/stageContext';

// What a thing shows is not under test here: where it shows is. Each thing can open who is behind it.
vi.mock('../peek/PeekBody', async () => {
    const { usePeek } = await import('../peek/usePeek');
    function PeekBody({ kind, id, place, back, close }: { kind: string; id: string; place: string; back?: () => void; close: () => void }) {
        const drawers = usePeek();
        return (
            <div data-testid={`${place}:${kind}-${id}`}>
                {back && <button type="button" onClick={back}>Back</button>}
                <button type="button" onClick={close}>Close</button>
                <button type="button" onClick={() => drawers.openSide('person-9')}>Who is behind it</button>
                <textarea aria-label="Note" />
            </div>
        );
    }
    return { PeekBody };
});

/** The screen is wide (the pane shows beside the list) or narrow (a drawer instead). */
function screenWidth(wide: boolean) {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: wide && query.includes('min-width'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined, onchange: null, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }));
}

/** The World stage's pane state, as WorldStage keeps it, around a page and the drawers. */
function Stage({ children }: { children: ReactNode }) {
    const [paneHost, setPaneHost] = useState<HTMLElement | null>(null);
    const value = useMemo<StageValue>(() => ({ inStage: true, head: null, panel: null, dock: null, side: null, top: null, setMap: () => undefined, mapOpen: false, toggleMap: () => undefined,
        panelFolded: false, togglePanel: () => undefined, paneHost, setPaneHost }), [paneHost]);
    return <StageContext.Provider value={value}>{children}<Drawers /></StageContext.Provider>;
}

function Address() {
    const location = useLocation();
    return <><output data-testid="address">{location.search}</output><output data-testid="path">{location.pathname}</output></>;
}
const address = () => screen.getByTestId('address').textContent;
const details = () => screen.getByRole('button', { name: 'Details of Riverside Academy' });
const row = <ResultRow lead={null} title="Riverside Academy" to="/clubs/4" peek="club-4" lines={['Academy · Tbilisi']} />;

const show = (search = '', outside?: ReactNode, state?: unknown) => render(
    <MemoryRouter initialEntries={[{ pathname: '/world/clubs', search, state }]}>
        <Stage>
            <ListSplit><ul>{row}</ul></ListSplit>
            {outside}
        </Stage>
        <Address />
    </MemoryRouter>,
);

describe('the pane beside the list', () => {
    beforeEach(() => screenWidth(true));
    afterEach(() => vi.unstubAllGlobals());

    it('opens what is pressed in the list beside it, as part of the page (no dialog); its name goes to the full page', () => {
        show();
        fireEvent.click(screen.getByText('Academy · Tbilisi'));
        expect(address()).toBe('?peek=club-4');
        expect(screen.getByTestId('pane:club-4')).toBeTruthy();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(details().getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(screen.getByRole('link', { name: 'Riverside Academy' }));
        expect(screen.getByTestId('path').textContent).toBe('/clubs/4');
    });

    it('opens a shared link, and anything pressed outside the list, in a drawer', () => {
        show('?peek=club-4');
        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.getByTestId('drawer:club-4')).toBeTruthy();
    });

    it('shows it beside the list again when coming Back to it from its full page (the history entry remembers)', () => {
        show('?peek=club-4', undefined, { drawers: true, pane: true });
        expect(screen.getByTestId('pane:club-4')).toBeTruthy();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens a drawer on a narrow screen', () => {
        screenWidth(false);
        show();
        fireEvent.click(details());
        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.queryByTestId('pane:club-4')).toBeNull();
    });

    it('stacks who is behind a thing over it, with a way back; Escape closes that first, then the pane', () => {
        show();
        fireEvent.click(details());
        fireEvent.click(screen.getByRole('button', { name: 'Who is behind it' }));
        expect(address()).toBe('?peek=club-4&side=person-9');
        expect(screen.getByTestId('pane:person-9')).toBeTruthy();
        expect(screen.queryByRole('dialog')).toBeNull();
        // A key typed in a field is the field's own.
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Note' }), { key: 'Escape' });
        expect(address()).toBe('?peek=club-4&side=person-9');
        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(address()).toBe('?peek=club-4');
        expect(screen.getByTestId('pane:club-4')).toBeTruthy();
        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(address()).toBe('');
        expect(screen.queryByTestId('pane:club-4')).toBeNull();
    });

    it('closes from its Close, and returns focus to the row that opened it', () => {
        show();
        fireEvent.click(details());
        screen.getByRole('button', { name: 'Close' }).focus();
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(address()).toBe('');
        expect(document.activeElement).toBe(details());
    });
});
