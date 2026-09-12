import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceShortcuts } from '../WorkspaceShortcuts';

describe('WorkspaceShortcuts', () => {
    it('shows no management links without authorized memberships', () => {
        const { container } = render(<MemoryRouter><WorkspaceShortcuts clubs={[]} /></MemoryRouter>);
        expect(container).toBeEmptyDOMElement();
    });
    it('opens the single managed club directly', () => {
        render(<MemoryRouter><WorkspaceShortcuts clubs={[{ clubId: 7, clubName: 'Academy' }]} /></MemoryRouter>);
        expect(screen.getByRole('link', { name: 'Workspace — Academy' })).toHaveAttribute('href', '/clubs/7/workspace');
    });
    it('offers explicit destinations when more than one club is managed', () => {
        render(<MemoryRouter><WorkspaceShortcuts clubs={[{ clubId: 7, clubName: 'Academy' }, { clubId: 8, clubName: 'First Team' }]} /></MemoryRouter>);
        expect(screen.getByText('Workspaces')).toBeInTheDocument();
        const links = screen.getAllByRole('link', { hidden: true });
        expect(links.map(link => link.getAttribute('href'))).toEqual(['/clubs/7/workspace', '/clubs/8/workspace']);
    });
});
