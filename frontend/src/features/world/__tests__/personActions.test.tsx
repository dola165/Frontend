import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { MessageLink } from '../directories/people/PersonResult';
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
afterEach(cleanup);

it('opens your role editor instead of offering a conversation with yourself', () => {
    render(<MemoryRouter><MessageLink id={1} name="Me" /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: /Message/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit roles' })).toHaveAttribute('href', '/account/roles');
});
it('retains messaging for another person', () => {
    render(<MemoryRouter><MessageLink id={26} name="Nika" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Message Nika' })).toHaveAttribute('href', '/messages?chatWith=26');
});
