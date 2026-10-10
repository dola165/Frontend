import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Home, Users } from 'lucide-react';
import { WorkspaceShell } from './WorkspaceShell';

function Where() { const location = useLocation(); return <output aria-label="Location">{location.pathname}</output>; }

const renderShell = (guard?: (proceed: () => void) => void, onSelect = vi.fn(), more: { id: string; label: string; items: { id: string; label: string; icon: typeof Home }[] }[] = []) => render(<MemoryRouter initialEntries={['/clubs/1/workspace']}>
    <Routes><Route path="*" element={<>
        <WorkspaceShell label="Club workspace" storageKey="test" guard={guard} context={{ name: 'Test FC', back: { label: 'Club page', to: '/clubs/1' } }}
            primary={[{ id: 'overview', label: 'Overview', icon: Home }]} groups={[{ id: 'people', label: 'People', items: [{ id: 'players', label: 'Players', icon: Users, count: 3 }] }]}
            more={more} active="overview" onSelect={onSelect} sectionTitle="Overview">
            <p>Page content</p>
        </WorkspaceShell>
        <Where />
    </>} /></Routes>
</MemoryRouter>);

afterEach(() => { cleanup(); localStorage.clear(); });

describe('WorkspaceShell', () => {
    it('asks open editors before the club page link leaves the workspace', () => {
        let pending: (() => void) | null = null;
        renderShell(proceed => { pending = proceed; });
        fireEvent.click(screen.getByRole('link', { name: 'Club page' }));
        expect(screen.getByRole('status', { name: 'Location' })).toHaveTextContent('/clubs/1/workspace');
        expect(pending).not.toBeNull();
        act(() => pending!());
        expect(screen.getByRole('status', { name: 'Location' })).toHaveTextContent(/^\/clubs\/1$/);
    });

    it('leaves straight away when no editor objects', () => {
        renderShell(proceed => proceed());
        fireEvent.click(screen.getByRole('link', { name: 'Club page' }));
        expect(screen.getByRole('status', { name: 'Location' })).toHaveTextContent(/^\/clubs\/1$/);
    });

    it('closes the phone drawer from the backdrop, which stays outside the inert page', () => {
        renderShell();
        fireEvent.click(screen.getByRole('button', { name: 'Club workspace menu' }));
        expect(screen.getByRole('dialog', { name: 'Club workspace navigation' })).toBeInTheDocument();
        const backdrop = document.querySelector<HTMLButtonElement>('.gk-ws__backdrop')!;
        expect(backdrop.closest('[inert]')).toBeNull();
        expect(document.querySelector('.gk-ws__main')!.hasAttribute('inert')).toBe(true);
        fireEvent.click(backdrop);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(document.querySelector('.gk-ws__main')!.hasAttribute('inert')).toBe(false);
    });

    it('selects rail destinations through the page and names waiting counts', () => {
        const onSelect = vi.fn();
        renderShell(undefined, onSelect);
        fireEvent.click(screen.getByRole('button', { name: /Players/ }));
        expect(onSelect).toHaveBeenCalledWith('players');
        expect(screen.getByLabelText('3 waiting')).toBeInTheDocument();
    });

    it('keeps the remaining tools one tap away when the rail is collapsed to icons', () => {
        renderShell(undefined, vi.fn(), [{ id: 'business', label: 'Club business', items: [{ id: 'store', label: 'Store', icon: Users }] }]);
        fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
        fireEvent.click(screen.getByRole('button', { name: 'More tools' }));
        expect(screen.getByRole('button', { name: 'Collapse' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'Store' })).toBeVisible();
    });
});
