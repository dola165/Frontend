import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Home, Users } from 'lucide-react';
import { WorkspaceShell } from './WorkspaceShell';

function Where() { const location = useLocation(); return <output aria-label="Location">{location.pathname}</output>; }

const renderShell = (guard?: (proceed: () => void) => void, onSelect = vi.fn()) => render(<MemoryRouter initialEntries={['/clubs/1/office']}>
    <Routes><Route path="*" element={<>
        <WorkspaceShell label="Club office" storageKey="test" guard={guard} context={{ name: 'Test FC', back: { label: 'Club page', to: '/clubs/1' } }}
            primary={[{ id: 'staff', label: 'Staff', icon: Home, count: 3 }]} quiet={[{ id: 'tools', label: 'More tools', icon: Users }]}
            active="staff" onSelect={onSelect} sectionTitle="Staff">
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
        expect(screen.getByRole('status', { name: 'Location' })).toHaveTextContent('/clubs/1/office');
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
        // The menu button shows only below the phone breakpoint, a media query jsdom does not apply.
        fireEvent.click(screen.getByRole('button', { name: 'Club office menu', hidden: true }));
        expect(screen.getByRole('dialog', { name: 'Club office navigation' })).toBeInTheDocument();
        const backdrop = document.querySelector<HTMLButtonElement>('.gk-ws__backdrop')!;
        expect(backdrop.closest('[inert]')).toBeNull();
        expect(document.querySelector('.gk-ws__main')!.hasAttribute('inert')).toBe(true);
        fireEvent.click(backdrop);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(document.querySelector('.gk-ws__main')!.hasAttribute('inert')).toBe(false);
    });

    it('selects places through the page and names waiting counts', () => {
        const onSelect = vi.fn();
        renderShell(undefined, onSelect);
        fireEvent.click(screen.getByRole('button', { name: /Staff/ }));
        expect(onSelect).toHaveBeenCalledWith('staff');
        expect(screen.getByLabelText('3 waiting')).toBeInTheDocument();
    });

    it('keeps the quiet places under a thin line, still reachable collapsed to icons', () => {
        const onSelect = vi.fn();
        renderShell(undefined, onSelect);
        expect(screen.getByRole('button', { name: 'More tools' }).closest('ul')).toHaveClass('gk-ws__items--quiet');
        fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
        fireEvent.click(screen.getByRole('button', { name: 'More tools' }));
        expect(onSelect).toHaveBeenCalledWith('tools');
    });
});
