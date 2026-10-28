import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NoSquadsYet } from './NoSquadsYet';
import '../../../i18n';

afterEach(() => { cleanup(); localStorage.clear(); });
it('takes a club leader to the squads in Club office', () => {
    render(<MemoryRouter><NoSquadsYet clubId={400} leadership /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Open squad lists' })).toHaveAttribute('href', '/clubs/400/office?tab=squads');
    expect(screen.queryByRole('link', { name: 'Ask for a squad' })).not.toBeInTheDocument();
    expect(screen.getByText(/create a squad or choose its coach/)).toBeVisible();
});
it('shows a coach with no squad nothing to ask for and no management entrance', () => {
    render(<MemoryRouter><NoSquadsYet clubId={400} leadership={false} /></MemoryRouter>);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/When the club makes you a coach of a squad/)).toBeVisible();
});
