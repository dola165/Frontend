import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LeftSidebar } from '../LeftSidebar';

vi.mock('../../profile/ConnectionsDialog', () => ({
    ConnectionsDialog: ({ onClose }: { onClose: () => void }) => (
        <div role="dialog" aria-label="Following"><button type="button" onClick={onClose}>Close</button></div>
    ),
}));

describe('LeftSidebar', () => {
    it('keeps Following on Home while other shortcuts remain navigation links', async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <LeftSidebar user={{ id: 9, fullName: 'Alex Morgan', role: 'PLAYER' }} />
            </MemoryRouter>
        );

        expect(screen.getByRole('link', { name: /Alex Morgan.*View your profile/ })).toHaveAttribute('href', '/profile/9');
        expect(screen.queryByRole('link', { name: /Following.*People you keep up with/ })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Following.*People you keep up with/ }));
        expect(screen.getByRole('dialog', { name: 'Following' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog', { name: 'Following' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Followed clubs.*Clubs you keep up with/ })).toHaveAttribute('href', '/clubs/following');
        expect(screen.getByRole('link', { name: /Map.*Find football near you/ })).toHaveAttribute('href', '/map');
        expect(screen.getByRole('link', { name: /My Schedule.*Your personal calendar/ })).toHaveAttribute('href', '/calendar?scope=personal');
        expect(screen.getAllByRole('link')).toHaveLength(4);
        expect(screen.queryByRole('link', { name: /My club|Club workspace|Find clubs|Find people/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Events/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Jobs & volunteering/ })).not.toBeInTheDocument();
    });

    it('does not render followed clubs as an embedded club list', () => {
        render(
            <MemoryRouter>
                <LeftSidebar user={{ id: 9, fullName: 'Alex Morgan', role: 'PLAYER' }} />
            </MemoryRouter>
        );

        expect(screen.queryByText('See all')).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Followed clubs' })).not.toBeInTheDocument();
    });
});
