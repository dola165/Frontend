import '../../../i18n';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AskParent } from './AskParent';

const links = vi.hoisted(() => ({ remindParents: vi.fn(), addMyParentLink: vi.fn() }));
vi.mock('../../parents/familyLinks', () => links);
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 3, fullName: 'Luka Kapanadze' } }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('reminds the teen’s parent about the place, once', async () => {
    links.remindParents.mockResolvedValue(undefined);
    render(<AskParent caseId={12} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remind my parent' }));
    expect(await screen.findByRole('button', { name: 'Reminder sent' })).toBeDisabled();
    expect(links.remindParents).toHaveBeenCalledWith(12);
});

it('with no parent yet, offers the Add my parent link instead', async () => {
    links.remindParents.mockRejectedValue({ response: { status: 409, data: { code: 'ADD_A_PARENT' } } });
    links.addMyParentLink.mockResolvedValue({ id: 1, kind: 'ADD_PARENT', code: 'c'.repeat(43), path: `/family-link/${'c'.repeat(43)}`, expiresAt: '2026-11-16T00:00:00Z', personId: 3, personName: 'Luka' });
    render(<AskParent caseId={12} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remind my parent' }));
    await waitFor(() => expect(links.addMyParentLink).toHaveBeenCalled());
    expect(await screen.findByDisplayValue(`${window.location.origin}/family-link/${'c'.repeat(43)}`)).toBeInTheDocument();
});
