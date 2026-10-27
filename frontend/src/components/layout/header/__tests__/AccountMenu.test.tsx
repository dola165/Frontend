import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import '../../../../i18n';
import type { AuthUser } from '../../../../context/AuthContext';
import { normalizeNavigationCapabilities } from '../../../../context/navigationCapabilities';
import { AccountMenu } from '../AccountMenu';
import type { WorkPlace } from '../pins/pinCatalog';

/** The account menu's "Add my child" asks the rule-checker; its own tests are in features/actions. */
vi.mock('../../../../features/actions/ActionButton', () => ({ ActionButton: () => null }));

const coach = { id: 1, fullName: 'Luka Gelashvili', navigationCapabilities: normalizeNavigationCapabilities({ version: 1, workspaces: [] }, 1) } as unknown as AuthUser;
const admin = { ...coach, navigationCapabilities: normalizeNavigationCapabilities({ version: 1, workspaces: [{ id: 'admin.console', context: { type: 'user', id: 1, label: 'Admin' } }] }, 1) } as unknown as AuthUser;
const squads: WorkPlace[] = [{ path: '/squads/105', label: 'U16 Boys', icon: 'squad', kind: 'Squad' }, { path: '/tournaments/301/workspace', label: 'Tbilisi Cup', icon: 'trophy', kind: 'Tournament' }];

function setup({ user = coach, workspaces = [] as WorkPlace[] } = {}) {
    const onLogout = vi.fn();
    const setThemePreference = vi.fn();
    render(
        <MemoryRouter>
            <AccountMenu user={user} workspaces={workspaces} themePreference="map-light" setThemePreference={setThemePreference} onLogout={onLogout} />
            <button type="button">Club operations</button>
        </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Account menu for Luka Gelashvili' });
    return { trigger, onLogout, setThemePreference };
}

describe('account menu', () => {
    it('opens on the first item and closes on Escape with focus back on the avatar', () => {
        const { trigger } = setup();
        fireEvent.click(trigger);
        const menu = screen.getByRole('menu', { name: 'Account' });
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(within(menu).getAllByRole('menuitem')[0]).toHaveFocus();
        fireEvent.keyDown(menu, { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it('closes when focus moves out of it, leaving focus where the person put it', () => {
        setup();
        fireEvent.click(screen.getByRole('button', { name: /Account menu/ }));
        const outside = screen.getByRole('button', { name: 'Club operations' });
        act(() => outside.focus());
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(outside).toHaveFocus();
    });

    it('opens from the keyboard at the first or last item and moves with the arrow keys', () => {
        const { trigger } = setup();
        fireEvent.keyDown(trigger, { key: 'ArrowUp' });
        const menu = screen.getByRole('menu');
        expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
        fireEvent.keyDown(menu, { key: 'Home' });
        expect(within(menu).getAllByRole('menuitem')[0]).toHaveFocus();
        fireEvent.keyDown(menu, { key: 'ArrowDown' });
        expect(within(menu).getByRole('menuitem', { name: 'My schedule' })).toHaveFocus();
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        expect(within(screen.getByRole('menu')).getAllByRole('menuitem')[0]).toHaveFocus();
    });

    it('offers Administration only to people with the admin console', () => {
        setup();
        fireEvent.click(screen.getByRole('button', { name: /Account menu/ }));
        expect(screen.queryByRole('menuitem', { name: 'Administration' })).not.toBeInTheDocument();
    });

    it('links Administration for administrators', () => {
        setup({ user: admin });
        fireEvent.click(screen.getByRole('button', { name: /Account menu/ }));
        expect(screen.getByRole('menuitem', { name: 'Administration' })).toHaveAttribute('href', '/admin');
    });

    it('keeps workspaces to one line leading to the page that lists them all, not a row each', () => {
        setup({ workspaces: squads });
        fireEvent.click(screen.getByRole('button', { name: /Account menu/ }));
        expect(screen.getByRole('menuitem', { name: 'Your workspaces' })).toHaveAttribute('href', '/my-organizations');
        expect(screen.queryByRole('menuitem', { name: /U16 Boys/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: /Tbilisi Cup/ })).not.toBeInTheDocument();
    });

    it('has no workspaces line without workspaces', () => {
        setup();
        fireEvent.click(screen.getByRole('button', { name: /Account menu/ }));
        expect(screen.queryByRole('menuitem', { name: 'Your workspaces' })).not.toBeInTheDocument();
    });

    it('changes appearance and signs out once, closing the menu', () => {
        const { trigger, onLogout, setThemePreference } = setup();
        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Light' }));
        expect(setThemePreference).toHaveBeenCalledWith('light');
        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
        expect(onLogout).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});
