import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AddHelperDialog } from './AddHelperDialog';
import type { Helping } from './api';
import { HelpingCard } from './HelpingCard';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const today = new Date(); today.setHours(18, 0, 0, 0);
const session: Helping = { helperId: 4, sessionId: 5640, squadId: 101, squadName: 'U12 Mixed', clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', title: 'Training', kind: 'TRAINING',
    startsAt: today.toISOString(), endsAt: today.toISOString(), location: 'Pitch 2', coach: 'Koba Gvazava', registerOpen: true, players: [
        { id: 1, firstName: 'Nana', response: 'GOING', register: null },
        { id: 2, firstName: 'Gabriel', response: 'NOT_GOING', register: null },
        { id: 3, firstName: 'Ilia', response: 'UNANSWERED', register: null },
    ] };

it('brings a helper today’s session on Home with its register, the likely answer ticked, and saves who came', async () => {
    api.get.mockResolvedValue({ data: [session] });
    api.put.mockResolvedValue({ data: session.players.map(player => ({ ...player, register: player.id === 3 || player.id === 1 ? 'ARRIVED' : 'ABSENT' })) });
    render(<MemoryRouter><HelpingCard /></MemoryRouter>);
    expect(await screen.findByText(/You’re helping today/)).toBeInTheDocument();
    expect(screen.getByText(/with Koba Gvazava/)).toBeInTheDocument();
    // First names only; the families' answers tick those coming.
    expect(screen.getByRole('checkbox', { name: /Nana/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Gabriel/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: /Ilia/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save who came' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/me/helping/sessions/5640/register', expect.objectContaining({ came: [1, 3] })));
    expect(await screen.findByText('Saved: 2 came.')).toBeInTheDocument();
});

it('shows nothing on Home to someone who helps nowhere', async () => {
    api.get.mockResolvedValue({ data: [] });
    const { container } = render(<MemoryRouter><HelpingCard /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/me/helping', expect.anything()));
    expect(container).toBeEmptyDOMElement();
});

it('adds a helper to every week of a repeating session by default, and gives the link to send', async () => {
    api.post.mockResolvedValue({ data: { id: 9, name: 'Dato Kvaratskhelia', link: 'claim.token', linkExpiresAt: '2026-11-05T12:00:00' } });
    const added = vi.fn();
    render(<MemoryRouter><AddHelperDialog squad={103} squadName="U14 Boys" session={{ id: 5623, title: 'Finishing under pressure', starts_at: '2026-10-30T18:00:00', series_id: 'squad-103-training' }}
        onClose={vi.fn()} onAdded={added} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /^Every Friday/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dato Kvaratskhelia' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dato@example.test' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add a helper' }).at(-1)!);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/squad-communication/103/sessions/5623/helpers', expect.objectContaining({
        name: 'Dato Kvaratskhelia', email: 'dato@example.test', repeating: true })));
    expect(added).toHaveBeenCalled();
    expect(await screen.findByRole('dialog', { name: 'Dato Kvaratskhelia is helping' })).toBeInTheDocument();
});
