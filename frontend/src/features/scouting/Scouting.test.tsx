import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Scouting } from './Scouting';
import type { Prospect } from './api';

const mocks = vi.hoisted(() => ({
    scope: vi.fn(), list: vi.fn(), adults: vi.fn(), applications: vi.fn(), get: vi.fn(),
    watch: vi.fn(), command: vi.fn(), contact: vi.fn(),
}));
vi.mock('./api', () => ({ scoutingApi: () => mocks }));
let record: Prospect;
beforeEach(() => {
    vi.resetAllMocks();
    localStorage.setItem('gk-session-id', 'scouting-test');
    record = { id: 11, squadId: 2, personId: 9, name: 'Synthetic player', source: 'PUBLIC_ADULT', applicationId: null,
        sourceStatus: 'PUBLIC_ADULT', status: 'WATCHING', outcome: null, revision: 0, restricted: false,
        actions: ['OBSERVE', 'FOLLOW_UP', 'NO_FURTHER_ACTION', 'CONTACT'], observations: [], history: [] };
    mocks.scope.mockResolvedValue({ clubWide: false, squads: [{ id: 2, name: 'Academy squad' }] });
    mocks.list.mockResolvedValue({ items: [], page: 0, hasMore: false });
    mocks.adults.mockResolvedValue({ items: [{ id: 9, fullName: 'Synthetic player' }], page: 0, hasMore: false });
    mocks.applications.mockResolvedValue([]);
    mocks.get.mockImplementation(async () => ({ ...record }));
    mocks.watch.mockImplementation(async () => ({ ...record }));
});
afterEach(() => { cleanup(); localStorage.clear(); window.dispatchEvent(new Event('gk-auth-changed')); });
const mount = (suffix = '') => render(<MemoryRouter initialEntries={['/clubs/1/office?tab=tools&tool=scouting&squad=2' + suffix]}>
    <Scouting clubId={1} sessionId="scouting-test" />
</MemoryRouter>);
const observation = async () => {
    await screen.findByLabelText('Football observation');
    fireEvent.change(screen.getByLabelText('Observed on'), { target: { value: '2026-10-29' } });
    fireEvent.change(screen.getByLabelText('Match, session or source'), { target: { value: 'Saturday match' } });
    fireEvent.change(screen.getByLabelText('Football observation'), { target: { value: 'Found space on the right.' } });
};

it('completes discovery, watch, observation and reasoned outcome without a rating', async () => {
    mocks.command.mockImplementation(async (_id, input) => {
        record = { ...record, revision: record.revision + 1,
            ...(input.action === 'OBSERVE' ? { observations: [{ id: 12, summary: input.note, source: input.source, observedOn: input.observedOn, recordedAt: '2026-10-30' }] }
                : { status: 'CLOSED', outcome: input.action, actions: ['REOPEN'] }) };
        return record;
    });
    mount('&view=adults');
    fireEvent.click(await screen.findByRole('button', { name: 'Watch' }));
    await observation();
    fireEvent.click(screen.getByRole('button', { name: 'Save to record' }));
    await screen.findByText('Saturday match · 2026-10-29');
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'FOLLOW_UP' } });
    fireEvent.change(screen.getByLabelText('Reason for this decision'), { target: { value: 'Observe another match before an offer.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save to record' }));
    await screen.findByText('Optional continuation');
    expect(screen.getByText('Follow up recommended')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open adult conversation' })).not.toBeInTheDocument();
    expect(mocks.watch).toHaveBeenCalledWith(2, 9, null, expect.any(String));
    expect(mocks.command.mock.calls[1][1]).toMatchObject({ revision: 1, action: 'FOLLOW_UP', note: 'Observe another match before an offer.' });
    expect(screen.queryByText(/rating/i)).not.toBeInTheDocument();
});

it('retains exact uncertain command and draft through a refresh and explicitly retries once', async () => {
    mocks.command.mockRejectedValueOnce(new Error('connection lost')).mockImplementationOnce(async () => {
        record = { ...record, revision: 1 }; return record;
    });
    mount('&prospect=11');
    await observation();
    fireEvent.click(screen.getByRole('button', { name: 'Save to record' }));
    await screen.findByRole('button', { name: 'Retry saved action' });
    expect(screen.getByLabelText('Football observation')).toBeDisabled();
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(screen.getByLabelText('Football observation')).toHaveValue('Found space on the right.'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry saved action' }));
    await waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(2));
    expect(mocks.command.mock.calls[1]).toEqual(mocks.command.mock.calls[0]);
    await waitFor(() => expect(screen.getByLabelText('Football observation')).toHaveValue(''));
});

it('preserves draft through a conflict and reloads the new revision before a new command', async () => {
    mocks.command.mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Scouting changed.' } } });
    mount('&prospect=11'); await observation();
    fireEvent.click(screen.getByRole('button', { name: 'Save to record' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reload record' }));
    await waitFor(() => expect(screen.getByLabelText('Football observation')).toHaveValue('Found space on the right.'));
    expect(mocks.command).toHaveBeenCalledTimes(1);
});

it('a failed load has retry and never pretends the watchlist is empty', async () => {
    mocks.list.mockRejectedValueOnce(new Error('unavailable'));
    mount();
    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.queryByText('No scouting records in this scope')).not.toBeInTheDocument();
    fireEvent.click(retry);
    await screen.findByText('No scouting records in this scope');
});

it('shows no child direct contact or private notes after family authority changes', async () => {
    record = { ...record, personId: null, name: 'Retained scouting record', source: 'RESTRICTED', sourceStatus: 'UNAVAILABLE',
        restricted: true, actions: [], observations: [], history: [] };
    mount('&prospect=11');
    await screen.findByText('Retained record · current access unavailable');
    expect(screen.queryByRole('button', { name: 'Open adult conversation' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Football observation')).not.toBeInTheDocument();
});

it('family applications stay a separate permitted source with no speculative child search', async () => {
    mount('&view=applications');
    await screen.findByText('No current family applications in your scope');
    expect(mocks.adults).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Find a public adult player')).not.toBeInTheDocument();
    expect(mocks.applications).toHaveBeenCalledWith(2, expect.any(AbortSignal));
});

it('a missing accepted job shows no discovery or setup pressure', async () => {
    mocks.scope.mockResolvedValue({ clubWide: false, squads: [] });
    mount();
    await screen.findByText('No current Scout job here');
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.adults).not.toHaveBeenCalled();
});

it('does not display another team and does not call the domain for it', async () => {
    render(<MemoryRouter initialEntries={['/?squad=99']}><Scouting clubId={1} sessionId="scouting-test" /></MemoryRouter>);
    await screen.findByText('This team is outside your current job');
    expect(mocks.list).not.toHaveBeenCalled();
});

it('late watch completion cannot navigate after the scoped work unmounts', async () => {
    let finish!: (result: Prospect) => void;
    mocks.watch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const mounted = mount('&view=adults');
    fireEvent.click(await screen.findByRole('button', { name: 'Watch' }));
    mounted.unmount();
    await act(async () => { finish(record); });
    expect(mocks.get).not.toHaveBeenCalled();
});

it('does not present another permitted team record under the selected scope', async () => {
    mocks.scope.mockResolvedValue({ clubWide: false, squads: [{ id: 2, name: 'Academy squad' }, { id: 3, name: 'Other squad' }] });
    record = { ...record, squadId: 3 };
    mount('&prospect=11');
    await screen.findByText('This record belongs to another team scope');
    expect(screen.queryByText('Synthetic player')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save to record' })).not.toBeInTheDocument();
});

it('clears record content while refreshing revoked authority', async () => {
    mount('&prospect=11');
    await screen.findByText('Synthetic player');
    mocks.get.mockRejectedValue({ response: { status: 403, data: { detail: 'Current Scout job required.' } } });
    act(() => window.dispatchEvent(new Event('focus')));
    await screen.findByRole('button', { name: 'Try again' });
    expect(screen.queryByText('Synthetic player')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Football observation')).not.toBeInTheDocument();
});

it('retains the existing tryouts and club approaches links', async () => {
    mount(); await screen.findByText('No scouting records in this scope');
    expect(screen.getByRole('link', { name: 'Tryouts' })).toHaveAttribute('href', '/clubs/1/office?tab=tools&tool=tryouts');
    expect(screen.getByRole('link', { name: 'Representation and club approaches' })).toHaveAttribute('href', '/clubs/1/office?tab=tools&tool=club-approaches');
});
