import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AddHelperDialog } from './AddHelperDialog';
import type { Helping } from './api';
import { HelpingCard } from './HelpingCard';
import { SessionHelpers } from './SessionHelpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const today = new Date(); today.setHours(18, 0, 0, 0);
const session: Helping = { helperId: 4, sessionId: 5640, squadId: 101, squadName: 'U12 Mixed', clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', title: 'Training', kind: 'TRAINING',
    startsAt: today.toISOString(), endsAt: today.toISOString(), location: 'Pitch 2', coach: 'Koba Gvazava', registerOpen: true, registerRevision: 3, players: [
        { id: 1, firstName: 'Nana', lastInitial: 'B', response: 'GOING', register: null },
        { id: 2, firstName: 'Gabriel', lastInitial: 'K', response: 'NOT_GOING', register: null },
        { id: 3, firstName: 'Ilia', lastInitial: 'T', response: 'UNANSWERED', register: null },
    ] };
const failure = (status: number, message = 'Request failed') => ({ isAxiosError: true, response: { status, data: { message } } });

it('brings a helper today’s session on Home with its register, the likely answer ticked, and saves who came', async () => {
    api.get.mockResolvedValue({ data: [session] });
    api.put.mockResolvedValue({ data: { revision: 5, players: session.players.map(player => ({ ...player, register: player.id === 3 || player.id === 1 ? 'ARRIVED' : 'ABSENT' })) } });
    render(<MemoryRouter><HelpingCard /></MemoryRouter>);
    expect(await screen.findByText(/You’re helping today/)).toBeInTheDocument();
    expect(screen.getByText(/with Koba Gvazava/)).toBeInTheDocument();
    // First names only; the families' answers tick those coming.
    expect(screen.getByRole('checkbox', { name: /Nana/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Gabriel/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: /Ilia/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save who came' }));
    // The save carries the register's revision the helper saw.
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/me/helping/sessions/5640/register', expect.objectContaining({ came: [1, 3], revision: 3 })));
    expect(await screen.findByText('Saved: 2 came.')).toBeInTheDocument();
});

it('tells two players with the same first name apart by the last name’s initial', async () => {
    api.get.mockResolvedValue({ data: [{ ...session, players: [
        { id: 1, firstName: 'Mako', lastInitial: 'B', response: 'GOING', register: null },
        { id: 2, firstName: 'Mako', lastInitial: 'K', response: 'GOING', register: null },
        { id: 3, firstName: 'Ilia', lastInitial: 'T', response: 'GOING', register: null },
    ] }] });
    render(<MemoryRouter><HelpingCard /></MemoryRouter>);
    expect(await screen.findByRole('checkbox', { name: 'Mako B.' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Mako K.' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Ilia' })).toBeInTheDocument();
});

it('shows the register as it is now when someone saved in between, the coach’s ticks added, to save again', async () => {
    api.get.mockImplementation(async (url: string) => url === '/me/helping' ? { data: [session] }
        : { data: { revision: 4, players: session.players.map(player => ({ ...player, register: player.id === 2 ? 'ARRIVED' : null })) } });
    api.put.mockRejectedValueOnce(failure(409, 'The register changed since you opened it. Check it and save again.'));
    render(<MemoryRouter><HelpingCard /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Save who came' }));
    expect(await screen.findByText('The register changed since you opened it. Check it and save again.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Gabriel/ })).toBeChecked());
    api.put.mockResolvedValue({ data: { revision: 6, players: session.players } });
    fireEvent.click(screen.getByRole('button', { name: 'Save who came' }));
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/me/helping/sessions/5640/register', expect.objectContaining({ revision: 4 })));
});

it('shows nothing on Home to someone who helps nowhere, and says so when Home couldn’t ask', async () => {
    api.get.mockResolvedValue({ data: [] });
    const { container } = render(<MemoryRouter><HelpingCard /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/me/helping', expect.anything()));
    expect(container).toBeEmptyDOMElement();
    cleanup();
    api.get.mockRejectedValueOnce(failure(500)).mockResolvedValueOnce({ data: [session] });
    render(<MemoryRouter><HelpingCard /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/You’re helping today/)).toBeInTheDocument();
});

it('adds a helper to every week of a repeating session by default, and gives the link to send', async () => {
    api.post.mockResolvedValue({ data: { id: 9, name: 'Dato Kvaratskhelia', link: 'claim.token', linkExpiresAt: '2026-11-05T12:00:00', invitationPending: false } });
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

it('leaves someone else’s invitation as it is and says it is pending', async () => {
    api.post.mockResolvedValue({ data: { id: 10, name: 'Nino', link: null, linkExpiresAt: null, invitationPending: true } });
    render(<MemoryRouter><AddHelperDialog squad={103} squadName="U14 Boys" session={{ id: 5623, title: 'Training', starts_at: '2026-10-30T18:00:00' }} onClose={vi.fn()} onAdded={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Nino' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nino@example.test' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add a helper' }).at(-1)!);
    expect(await screen.findByText(/Nino already has an invitation waiting/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
});

const lesson = { id: 5623, title: 'Training', starts_at: '2026-10-30T18:00:00', series_id: 'squad-103-training' };
const helpers = [{ id: 7, name: 'Dato', repeating: true, since: '2026-10-20T10:00:00Z', waiting: false }];

it('shows a session’s helpers to everyone on the squad, Add and Remove only to whoever may add them, and loads once', async () => {
    api.get.mockResolvedValue({ data: helpers });
    render(<MemoryRouter><SessionHelpers squad={103} squadName="U14 Boys" session={lesson} canManage={false} /></MemoryRouter>);
    expect(await screen.findByText('Dato')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a helper' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Dato' })).not.toBeInTheDocument();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(api.get).toHaveBeenCalledTimes(1);
});

it('says Remove takes a weekly helper off every week, and a list that couldn’t load says so', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    api.get.mockResolvedValue({ data: helpers });
    render(<MemoryRouter><SessionHelpers squad={103} squadName="U14 Boys" session={lesson} canManage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Dato' }));
    expect(confirm).toHaveBeenCalledWith('Take Dato off every week of this session?');
    expect(api.delete).not.toHaveBeenCalled();
    cleanup();
    api.get.mockRejectedValueOnce(failure(500)).mockResolvedValueOnce({ data: helpers });
    render(<MemoryRouter><SessionHelpers squad={103} squadName="U14 Boys" session={lesson} canManage={false} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Dato')).toBeInTheDocument();
});
