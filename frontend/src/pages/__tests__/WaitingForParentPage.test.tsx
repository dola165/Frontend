import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '../../i18n';

const api = vi.hoisted(() => ({ fetchParentApproval: vi.fn() }));
const links = vi.hoisted(() => ({ addMyParentLink: vi.fn() }));
vi.mock('../../api/parentApproval', () => api);
vi.mock('../../features/parents/familyLinks', () => links);
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 3, email: 'teen@example.test', fullName: 'Luka Kapanadze' }, bootstrapSession: vi.fn(), logout: vi.fn() }) }));
vi.mock('../../components/layout/GrasskickzLogo', () => ({ GrasskickzLogo: () => <span>GrassKickZ</span> }));

import { WaitingForParentPage } from '../WaitingForParentPage';

beforeEach(() => { vi.clearAllMocks(); void i18n.changeLanguage('en'); });

const link = { id: 1, kind: 'ADD_PARENT', code: 'c'.repeat(43), path: `/family-link/${'c'.repeat(43)}`, expiresAt: '2026-11-09T00:00:00Z', personId: 3, personName: 'Luka Kapanadze' };

it('offers Try again when the status cannot be read, then the link to send, never an email form', async () => {
    api.fetchParentApproval.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ status: 'PARENT_EMAIL_NEEDED' });
    links.addMyParentLink.mockResolvedValue(link);
    render(<MemoryRouter><WaitingForParentPage /></MemoryRouter>);
    expect(await screen.findByText('This could not be loaded. Check your connection and try again.')).toBeInTheDocument();
    expect(links.addMyParentLink).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByDisplayValue(`${window.location.origin}${link.path}`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Your parent’s email')).toBeNull();
});

it('lets the teen in once a parent has opened the link', async () => {
    api.fetchParentApproval.mockResolvedValue({ status: 'NOT_NEEDED' });
    render(<MemoryRouter><WaitingForParentPage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(links.addMyParentLink).not.toHaveBeenCalled();
});
