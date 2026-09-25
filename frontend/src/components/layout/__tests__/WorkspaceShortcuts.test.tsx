import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceShortcuts } from '../WorkspaceShortcuts';
import { normalizeNavigationCapabilities } from '../../../context/navigationCapabilities';

describe('WorkspaceShortcuts', () => {
    it('collapses the navigation projection into one authorized club workspace', () => {
        const navigationCapabilities = normalizeNavigationCapabilities({ version: 1, workspaces: [
            { id: 'parent.hub', context: { type: 'user', id: 7, label: 'Parent Hub' } },
            { id: 'club.workspace', context: { type: 'club', id: 21, label: 'Academy' } },
            { id: 'tournament.create', context: { type: 'organization', id: 33, label: 'Community' } },
        ] }, 7);
        const { rerender } = render(<MemoryRouter><WorkspaceShortcuts navigationCapabilities={navigationCapabilities} /></MemoryRouter>);
        expect(screen.getAllByRole('link')).toHaveLength(1);
        expect(screen.getByRole('link', { name: 'Club workspace' })).toHaveAttribute('href', '/clubs/21/workspace');
        rerender(<MemoryRouter><WorkspaceShortcuts navigationCapabilities={{ version: 1, workspaces: [] }} clubs={[{ clubId: 21, clubName: 'Stale club' }]} /></MemoryRouter>);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
    it('shows no management links without authorized memberships', () => {
        const { container } = render(<MemoryRouter><WorkspaceShortcuts clubs={[]} /></MemoryRouter>);
        expect(container).toBeEmptyDOMElement();
    });
    it('opens the single managed club directly', () => {
        render(<MemoryRouter><WorkspaceShortcuts clubs={[{ clubId: 7, clubName: 'Academy' }]} /></MemoryRouter>);
        expect(screen.getByRole('link', { name: 'Club workspace' })).toHaveAttribute('href', '/clubs/7/workspace');
    });
    it('keeps one shortcut for the current managed club', () => {
        render(<MemoryRouter><WorkspaceShortcuts clubs={[{ clubId: 7, clubName: 'Academy' }, { clubId: 8, clubName: 'First Team' }]} /></MemoryRouter>);
        expect(screen.getAllByRole('link')).toHaveLength(1);
        expect(screen.getByRole('link')).toHaveAttribute('href', '/clubs/7/workspace');
    });
});
