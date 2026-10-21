import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { House, Earth } from 'lucide-react';
import { AppHeader } from '../AppHeader';
import { PhoneTabBar } from '../PhoneTabBar';
import { YouSheet } from '../YouSheet';
import type { AuthUser } from '../../../../context/AuthContext';
import { PinsBar } from '../pins/PinsBar';
import type { Pin, usePins } from '../pins/usePins';
import type { PrimaryTab } from '../sections';
import { normalizeNavigationCapabilities } from '../../../../context/navigationCapabilities';

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
            ['Clubs', '/world/clubs'], ['Jobs & volunteering', '/world/opportunities'], ['Matches', '/world/matches'],
            ['Tournaments', '/world/tournaments'], ['People', '/world/people'],
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
    // The bar measures its room from the centred header row: the row less its two outer columns and the main tabs.
    const inRow = (bar: ReactNode) => <MemoryRouter><div className="gk-header__row">
        <div className="gk-header__start" /><nav className="gk-header__nav"><ul className="gk-header__tabs" />{bar}</nav><div className="gk-header__actions" />
    </div></MemoryRouter>;
    beforeEach(() => {
        // jsdom has no layout: every pin is 100px, "more" is 90px, buttons, outer columns and tabs 44px,
        // and the row is 732px, which leaves the pins 600px.
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) {
            if (this.matches('.gk-pins--measure li')) return 100;
            if (this.matches('.gk-pins--measure > span')) return 90;
            if (this.matches('.gk-header__divider')) return 1;
            return 44;
        } });
        Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get(this: Element) { return this.matches('.gk-header__row') ? 732 : 0; } });
        vi.stubGlobal('ResizeObserver', class { callback: () => void; constructor(callback: () => void) { this.callback = callback; } observe() { this.callback(); } disconnect() {} });
    });
    afterEach(() => {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', original.offsetWidth);
        Object.defineProperty(Element.prototype, 'clientWidth', original.clientWidth);
        vi.unstubAllGlobals();
    });

    it('shows the pins that fit and keeps the rest one click away in "more"', () => {
        const onCrowdedChange = vi.fn();
        render(inRow(<PinsBar state={state()} page={page} work={[]} activePath="/squads/7" crowded={false} onCrowdedChange={onCrowdedChange} />));
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
        const { unmount } = render(inRow(<PinsBar state={state([])} page={page} work={[]} activePath={null} crowded={false} onCrowdedChange={vi.fn()} />));
        expect(screen.getByRole('button', { name: 'Pin' })).toBeInTheDocument();
        unmount();
        render(inRow(<PinsBar state={state()} page={page} work={[]} activePath={null} crowded={false} onCrowdedChange={vi.fn()} />));
        expect(screen.getByRole('button', { name: 'Manage pins' })).toBeInTheDocument();
    });
});

describe('phone navigation', () => {
    const tabs: PrimaryTab[] = [
        { id: 'home', to: '/home', label: 'Home', icon: House, current: true },
        { id: 'world', to: '/world', label: 'World', icon: Earth, current: false },
    ];
    const user = { id: 1, fullName: 'Luka Gelashvili', avatarUrl: null } as unknown as AuthUser;
    const you = (hasClub: boolean) => render(<MemoryRouter><button type="button">Behind</button><PhoneTabBar tabs={tabs} />
        <YouSheet user={user} workspaces={[]} themePreference="map-light" setThemePreference={vi.fn()} onLogout={vi.fn()}
            pins={state(pins.slice(0, 2))} page={page} work={[]} hasClub={hasClub} onPinnedPage={false} /></MemoryRouter>);

    it.each([
        { name: 'a new person who calls themselves a coach', role: 'COACH', links: [], paths: ['/home', '/world'] },
        { name: 'a confirmed squad coach without club-wide access', role: 'FAN', links: ['squad.workspace'], paths: ['/home', '/world', '/my-squads'] },
        { name: 'confirmed family access without personal club membership', role: 'FAN', links: ['club.family'], paths: ['/home', '/world', '/parent'] },
        { name: 'a club administrator with no coached squad', role: 'COACH', links: ['club.workspace'], paths: ['/home', '/world', '/clubs/21'] },
        { name: 'a coach and parent with one club', role: 'FAN', links: ['club.workspace', 'squad.workspace', 'parent.hub'], paths: ['/home', '/world', '/my-squads', '/parent', '/clubs/21'] },
        { name: 'an agent serving a club', role: 'AGENT', links: ['club.agent'], paths: ['/home', '/world'] },
    ])('gives $name the phone destinations their links confirm', ({ role, links, paths }) => {
        const capabilities = normalizeNavigationCapabilities({ version: 1, workspaces: links.map(id => ({ id, context: { type: id.startsWith('club.') ? 'club' : id.startsWith('squad.') ? 'squad' : 'user', id: id.startsWith('club.') || id.startsWith('squad.') ? 21 : 1, label: 'Football' } })) }, 1);
        const { container } = render(<MemoryRouter><AppHeader user={{ ...user, role, navigationCapabilities: capabilities } as AuthUser} myClubId={null}
            themePreference="map-light" setThemePreference={vi.fn()} onLogout={vi.fn()} /></MemoryRouter>);
        const bar = container.querySelector('nav.gk-tabbar')!;
        expect(Array.from(bar.querySelectorAll('a')).map(link => link.getAttribute('href'))).toEqual(paths);
    });

    it('removes a role tab immediately when the confirmed link is revoked', () => {
        const confirmed = normalizeNavigationCapabilities({ version: 1, workspaces: [{ id: 'squad.workspace', context: { type: 'squad', id: 105, label: 'U16' } }] }, 1);
        const header = (navigationCapabilities: AuthUser['navigationCapabilities']) => <MemoryRouter><AppHeader user={{ ...user, navigationCapabilities }} myClubId={null}
            themePreference="map-light" setThemePreference={vi.fn()} onLogout={vi.fn()} /></MemoryRouter>;
        const { container, rerender } = render(header(confirmed));
        expect(container.querySelector('nav.gk-tabbar a[href="/my-squads"]')).toBeInTheDocument();
        rerender(header({ version: 1, workspaces: [] }));
        expect(container.querySelector('nav.gk-tabbar a[href="/my-squads"]')).not.toBeInTheDocument();
    });

    it('keeps only the places in the bottom bar; Messages and pins are not tabs', () => {
        const { container } = you(true);
        // The header stylesheet hides the bar on wide screens (jsdom is wide), so it is read from the markup.
        const bar = container.querySelector<HTMLElement>('nav.gk-tabbar')!;
        expect(bar).toHaveAttribute('aria-label', 'Main');
        expect(Array.from(bar.querySelectorAll('a')).map(link => link.textContent)).toEqual(['Home', 'World']);
    });

    it('opens You from the profile picture: a modal sheet with pins and the account that keeps focus until it closes', () => {
        you(true);
        const trigger = screen.getByRole('button', { name: 'You: Luka Gelashvili' });
        fireEvent.click(trigger);
        const sheet = screen.getByRole('dialog', { name: 'You' });
        expect(sheet).toHaveAttribute('aria-modal', 'true');
        expect(sheet.contains(document.activeElement)).toBe(true);
        expect(within(sheet).getByRole('link', { name: 'Squad 1' })).toBeInTheDocument();
        expect(within(sheet).getByRole('link', { name: /Account & settings/ })).toHaveAttribute('href', '/account');
        expect(within(sheet).getByRole('button', { name: /Sign out/ })).toBeInTheDocument();
        expect(within(sheet).queryByRole('link', { name: /Find or start your club/ })).not.toBeInTheDocument();

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

    it('offers finding or starting a club in You when there is no My Club tab', () => {
        you(false);
        fireEvent.click(screen.getByRole('button', { name: 'You: Luka Gelashvili' }));
        expect(within(screen.getByRole('dialog', { name: 'You' })).getByRole('link', { name: /Find or start your club/ })).toHaveAttribute('href', '/my-club');
    });
});
