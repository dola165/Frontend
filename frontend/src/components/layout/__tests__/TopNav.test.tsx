import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TopNav } from '../TopNav';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? ({
            'nav.explore': 'Explore',
            'nav.mobileNavigation': 'Explore GrassKickZ',
            'nav.preview': 'Preview',
        } as Record<string, string>)[_key] ?? _key,
        i18n: {
            language: 'en',
            resolvedLanguage: 'en',
            changeLanguage: vi.fn(),
        },
    }),
}));

vi.mock('../../search/GlobalSearchBar', () => ({
    GlobalSearchBar: () => <div data-testid="global-search" />,
}));

vi.mock('../../notifications/NotificationBell', () => ({
    NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock('../GrasskickzLogo', () => ({
    GrasskickzLogo: () => <span>GrassKickZ</span>,
}));

vi.mock('../AppPageShell', () => ({
    AppPageFrame: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

const renderTopNav = (user: { id: number; username: string; role: string } | null) => render(
    <MemoryRouter>
        <TopNav
            user={user}
            myClubId={null}
            themePreference="dark"
            setThemePreference={vi.fn()}
            handleLogout={vi.fn()}
        />
    </MemoryRouter>
);

describe('TopNav secondary navigation', () => {
    it('supports keyboard opening, arrow navigation, Escape and focus return', async () => {
        const user = userEvent.setup();
        renderTopNav(null);
        const trigger = screen.getByRole('button', { name: 'Explore' });
        trigger.focus();
        await user.keyboard('{Enter}');
        const first = screen.getByRole('menuitem', { name: 'Tournaments — Preview' });
        const last = screen.getByRole('menuitem', { name: 'Jobs & volunteering — Preview' });
        expect(first).toHaveFocus();
        await user.keyboard('{ArrowDown}');
        expect(last).toHaveFocus();
        await user.keyboard('{ArrowDown}');
        expect(first).toHaveFocus();
        await user.keyboard('{End}');
        expect(last).toHaveFocus();
        await user.keyboard('{Home}');
        expect(first).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu', { name: 'Explore' })).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
        await user.keyboard('{ArrowUp}');
        expect(screen.getByRole('menuitem', { name: 'Jobs & volunteering — Preview' })).toHaveFocus();
        await user.tab();
        expect(screen.queryByRole('menu', { name: 'Explore' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'nav.signIn' })).toHaveFocus();
    });

    it('closes after choosing a destination and can reopen on that destination', async () => {
        const user = userEvent.setup();
        renderTopNav(null);
        await user.click(screen.getByRole('button', { name: 'Explore' }));
        await user.keyboard('{Enter}');
        expect(screen.queryByRole('menu', { name: 'Explore' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Explore' }));
        await user.click(screen.getByRole('menuitem', { name: 'Tournaments — Preview' }));
        expect(screen.queryByRole('menu', { name: 'Explore' })).not.toBeInTheDocument();
    });

    it('gives guests an Explore menu with public preview destinations', async () => {
        const user = userEvent.setup();
        renderTopNav(null);

        const trigger = screen.getByRole('button', { name: 'Explore' });
        expect(trigger.className).not.toContain('hidden');
        await user.click(trigger);

        const menu = screen.getByRole('menu', { name: 'Explore' });
        const tournaments = within(menu).getByRole('menuitem', { name: 'Tournaments — Preview' });
        const jobs = within(menu).getByRole('menuitem', { name: 'Jobs & volunteering — Preview' });
        expect(tournaments).toHaveAttribute('href', '/tournaments');
        expect(jobs).toHaveAttribute('href', '/jobs');
        expect(within(menu).queryByRole('menuitem', { name: 'Messages' })).not.toBeInTheDocument();
    });

    it('keeps signed-in secondary destinations in the same Explore menu', async () => {
        const user = userEvent.setup();
        renderTopNav({ id: 9, username: 'alex', role: 'PLAYER' });

        await user.click(screen.getByRole('button', { name: 'Explore' }));
        const menu = screen.getByRole('menu', { name: 'Explore' });
        expect(within(menu).getByRole('menuitem', { name: 'Messages' })).toHaveAttribute('href', '/messages');
        expect(within(menu).getByRole('menuitem', { name: 'Tournaments — Preview' })).toHaveAttribute('href', '/tournaments');
    });
});
