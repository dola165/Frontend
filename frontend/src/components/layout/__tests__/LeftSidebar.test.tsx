import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LeftSidebar } from '../LeftSidebar';

describe('LeftSidebar', () => {
    it('renders the profile and social destinations as simple navigation links', () => {
        render(
            <MemoryRouter>
                <LeftSidebar user={{ id: 9, fullName: 'Alex Morgan', role: 'PLAYER' }} />
            </MemoryRouter>
        );

        expect(screen.getByRole('link', { name: /Alex Morgan.*View your profile/ })).toHaveAttribute('href', '/profile/9');
        expect(screen.getByRole('link', { name: /Following.*People you keep up with/ })).toHaveAttribute('href', '/people');
        expect(screen.getByRole('link', { name: /Followed clubs.*Clubs you keep up with/ })).toHaveAttribute('href', '/clubs/following');
        expect(screen.getByRole('link', { name: /My club.*Your football home/ })).toHaveAttribute('href', '/my-club');
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
