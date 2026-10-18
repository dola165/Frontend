import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../../../i18n';
import type { AuthUser } from '../../../../context/AuthContext';
import { normalizeNavigationCapabilities } from '../../../../context/navigationCapabilities';
import { YouSheet } from '../YouSheet';
import type { WorkPlace } from '../pins/pinCatalog';
import type { Pin, usePins } from '../pins/usePins';

vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: null, sessionId: 'guest', status: 'anonymous' }) }));
const user = { id: 1, fullName: 'Synthetic Coach', navigationCapabilities: normalizeNavigationCapabilities({ version: 1, workspaces: [] }, 1) } as AuthUser;
const places: WorkPlace[] = ['Pinned squad', 'Suggested squad', 'Other squad', 'Fallback squad'].map((label, index) => ({ path: `/squads/${101 + index}`, label, icon: 'squad', kind: 'Squad' }));
const state = (pins: Pin[] = [places[0]], suggestions = [places[1]]): ReturnType<typeof usePins> => ({ pins,
    suggestions: suggestions.map(item => ({ ...item, visits: null })), isPinned: path => pins.some(pin => pin.path === path),
    pin: vi.fn(), unpin: vi.fn(), move: vi.fn(), full: false });
const props = () => ({ user, workspaces: places, work: places.slice(0, 3), pins: state(), hasClub: true, onPinnedPage: false,
    page: { path: '/home', label: 'Home', icon: 'trophy' as const, pinnable: false }, themePreference: 'map-light' as const,
    setThemePreference: vi.fn(), onLogout: vi.fn() });

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(async () => { cleanup(); await i18n.changeLanguage('en'); });

it('puts Account beside the profile and keeps every pinned, suggested, other and fallback workspace once', () => {
    const initial = props();
    render(<MemoryRouter><YouSheet {...initial} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'You: Synthetic Coach' }));
    const sheet = screen.getByRole('dialog', { name: 'You' });
    expect(Array.from(sheet.querySelectorAll('a')).slice(0, 2).map(link => link.getAttribute('href'))).toEqual(['/profile/1', '/account']);
    expect(within(sheet).getAllByRole('link', { name: 'Account & settings' })).toHaveLength(1);
    for (const place of places) expect(sheet.querySelectorAll(`a[href="${place.path}"]`)).toHaveLength(1);
    expect(within(sheet).getByRole('button', { name: 'Unpin Pinned squad' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Pin Suggested squad' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('link', { name: 'Account & settings' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(initial.onLogout).not.toHaveBeenCalled(); expect(initial.pins.pin).not.toHaveBeenCalled(); expect(initial.pins.unpin).not.toHaveBeenCalled();
});

it('keeps the single early Account link and all workspace choices after changing language and reopening', async () => {
    render(<MemoryRouter><YouSheet {...props()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'You: Synthetic Coach' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ქართული' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'თქვენ: Synthetic Coach' })).toHaveAttribute('aria-expanded', 'false'));
    fireEvent.click(screen.getByRole('button', { name: 'თქვენ: Synthetic Coach' }));
    const sheet = screen.getByRole('dialog', { name: 'თქვენ' });
    expect(Array.from(sheet.querySelectorAll('a')).slice(0, 2).map(link => link.getAttribute('href'))).toEqual(['/profile/1', '/account']);
    expect(within(sheet).getAllByRole('link', { name: 'ანგარიში და პარამეტრები' })).toHaveLength(1);
    for (const place of places) expect(sheet.querySelectorAll(`a[href="${place.path}"]`)).toHaveLength(1);
    expect(within(sheet).getByRole('button', { name: 'ქართული' })).toHaveAttribute('aria-pressed', 'true');
});

it('uses only the replacement person’s destinations and retains the no-club entrance and admin gate', () => {
    const admin = { ...user, navigationCapabilities: normalizeNavigationCapabilities({ version: 1, workspaces: [{ id: 'admin.console', context: { type: 'user', id: 1, label: 'Admin' } }] }, 1) };
    const initial = { ...props(), user: admin };
    const view = render(<MemoryRouter><YouSheet {...initial} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'You: Synthetic Coach' }));
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'Administration' })).toHaveAttribute('href', '/admin');
    const nextUser = { ...user, id: 2, fullName: 'Synthetic Newcomer', navigationCapabilities: normalizeNavigationCapabilities({ version: 1, workspaces: [] }, 2) };
    view.rerender(<MemoryRouter><YouSheet {...initial} user={nextUser} pins={state([], [])} work={[]} workspaces={[]} hasClub={false} /></MemoryRouter>);
    const sheet = screen.getByRole('dialog', { name: 'You' });
    expect(sheet.querySelector('a[href="/profile/2"]')).toHaveTextContent('Synthetic Newcomer');
    expect(within(sheet).getByRole('link', { name: 'Find or start your club' })).toHaveAttribute('href', '/my-club');
    expect(within(sheet).queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument();
    for (const place of places) expect(sheet.querySelector(`a[href="${place.path}"]`)).not.toBeInTheDocument();
    expect(within(sheet).getAllByRole('link', { name: 'Account & settings' })).toHaveLength(1);
});
