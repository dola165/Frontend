import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { House, Earth } from 'lucide-react';
import { AppHeader } from '../AppHeader';
import { PhoneTabBar } from '../PhoneTabBar';
import { PinsBar } from '../pins/PinsBar';
import type { Pin, usePins } from '../pins/usePins';
import type { PrimaryTab } from '../sections';

vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: null, sessionId: 'guest', status: 'anonymous' }) }));

const pins: Pin[] = Array.from({ length: 8 }, (_, index) => ({ path: `/squads/${index + 1}`, label: `Squad ${index + 1}`, icon: 'squad' }));
const state = (list: Pin[] = pins): ReturnType<typeof usePins> => ({
    pins: list, suggestions: [], isPinned: path => list.some(item => item.path === path), pin: vi.fn(), unpin: vi.fn(), move: vi.fn(), full: false,
});
const page = { path: '/tournaments/301', label: null, icon: 'trophy' as const, pinnable: true };

describe('guest header', () => {
    const renderGuest = () => render(<MemoryRouter initialEntries={['/clubs/3']}><AppHeader user={null} myClubId={null} themePreference="map-light" setThemePreference={vi.fn()} onLogout={vi.fn()} /></MemoryRouter>);
    afterEach(() => { delete (window as { matchMedia?: unknown }).matchMedia; });

    it('reaches World, every public directory, the store and campaigns, and the way in', () => {
        renderGuest();
        expect(screen.getByRole('link', { name: 'World' })).toHaveAttribute('href', '/world');
        expect(screen.queryByRole('link', { name: 'My Club' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
        expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/signup');
        fireEvent.click(screen.getByRole('button', { name: 'Explore' }));
        const menu = screen.getByRole('menu', { name: 'Explore GrassKickZ' });
        const links = within(menu).getAllByRole('menuitem').map(item => [item.textContent, item.getAttribute('href')]);
        expect(links).toEqual([
            ['Clubs', '/world/clubs'], ['People', '/world/people'], ['Venues', '/world/venues'], ['Matches', '/world/matches'],
            ['Tournaments', '/world/tournaments'], ['Opportunities', '/world/opportunities'], ['Map', '/world/map'],
            ['Store', '/store'], ['Campaigns', '/campaigns'],
        ]);
        expect(within(menu).queryByText('Followed clubs')).not.toBeInTheDocument();
    });

    it('holds the language and "Create account" in Explore on phones, where the header has no room for them', () => {
        Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: (query: string) => ({ matches: query.includes('max-width'), media: query, addEventListener() {}, removeEventListener() {} }) });
        renderGuest();
        fireEvent.click(screen.getByRole('button', { name: 'Explore' }));
        const menu = screen.getByRole('menu');
        expect(within(menu).getByRole('menuitemradio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
        expect(within(menu).getByRole('menuitem', { name: 'Create account' })).toHaveAttribute('href', '/signup');
    });

    it('opens Explore from the keyboard and closes it with Escape', () => {
        renderGuest();
        const trigger = screen.getByRole('button', { name: 'Explore' });
        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        expect(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Clubs' })).toHaveFocus();
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });
});

describe('pins bar', () => {
    const original = {
        offsetWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!,
        clientWidth: Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!,
    };
    beforeEach(() => {
        // jsdom has no layout: every pin is 100px, "more" is 90px, buttons 44px, and the bar has 600px.
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) {
            if (this.matches('.gk-pins--measure li')) return 100;
            if (this.matches('.gk-pins--measure > span')) return 90;
            if (this.matches('.gk-header__divider')) return 1;
            return 44;
        } });
        Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get(this: Element) { return this.matches('.gk-header__pins') ? 600 : 0; } });
        vi.stubGlobal('ResizeObserver', class { callback: () => void; constructor(callback: () => void) { this.callback = callback; } observe() { this.callback(); } disconnect() {} });
    });
    afterEach(() => {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', original.offsetWidth);
        Object.defineProperty(Element.prototype, 'clientWidth', original.clientWidth);
        vi.unstubAllGlobals();
    });

    it('shows the pins that fit and keeps the rest one click away in "more"', () => {
        const onCrowdedChange = vi.fn();
        render(<MemoryRouter><PinsBar state={state()} page={page} work={[]} activePath="/squads/7" crowded={false} onCrowdedChange={onCrowdedChange} /></MemoryRouter>);
        const bar = screen.getByRole('list', { name: 'Your pins' });
        expect(within(bar).getAllByRole('link').map(link => link.textContent)).toEqual(['Squad 1', 'Squad 2', 'Squad 3', 'Squad 4']);
        const more = screen.getByRole('button', { name: /4 more/ });
        // The current page is a hidden pin, so "more" carries the current marker.
        expect(more).toHaveAttribute('aria-current', 'page');
        fireEvent.click(more);
        expect(within(screen.getByRole('menu', { name: 'More pins' })).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Squad 5', 'Squad 6', 'Squad 7', 'Squad 8']);
        expect(onCrowdedChange).toHaveBeenLastCalledWith(false);
    });

    it('names the add button by its visible text before anything is pinned, and by what it does after', () => {
        const { unmount } = render(<MemoryRouter><PinsBar state={state([])} page={page} work={[]} activePath={null} crowded={false} onCrowdedChange={vi.fn()} /></MemoryRouter>);
        expect(screen.getByRole('button', { name: 'Pin' })).toBeInTheDocument();
        unmount();
        render(<MemoryRouter><PinsBar state={state()} page={page} work={[]} activePath={null} crowded={false} onCrowdedChange={vi.fn()} /></MemoryRouter>);
        expect(screen.getByRole('button', { name: 'Manage pins' })).toBeInTheDocument();
    });
});

describe('phone pins sheet', () => {
    const tabs: PrimaryTab[] = [
        { id: 'home', to: '/home', label: 'Home', icon: House, current: true },
        { id: 'world', to: '/world', label: 'World', icon: Earth, current: false },
    ];

    it('is a modal dialog that keeps focus inside until it closes', () => {
        render(<MemoryRouter><button type="button">Behind</button><PhoneTabBar tabs={tabs} unreadMessages={2} pins={state(pins.slice(0, 2))} page={page} work={[]} onPinnedPage={false} /></MemoryRouter>);
        const trigger = screen.getByRole('button', { name: /^Pins/ });
        fireEvent.click(trigger);
        const sheet = screen.getByRole('dialog', { name: 'Pins' });
        expect(sheet).toHaveAttribute('aria-modal', 'true');
        expect(sheet.contains(document.activeElement)).toBe(true);

        // Tab from the last control comes back to the first.
        const controls = Array.from(sheet.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), summary'));
        act(() => controls[controls.length - 1].focus());
        fireEvent.keyDown(sheet, { key: 'Tab' });
        expect(controls[0]).toHaveFocus();
        // Focus that escapes (a screen reader, a script) is brought back.
        act(() => screen.getByRole('button', { name: 'Behind' }).focus());
        expect(sheet.contains(document.activeElement)).toBe(true);

        fireEvent.keyDown(sheet, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });
});
