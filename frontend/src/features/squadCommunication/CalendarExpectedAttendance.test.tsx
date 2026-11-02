import i18n from '../../i18n';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as api from './api';
import { SessionNextActions } from './SessionNextActions';
import { SquadSessionDetails } from './SquadSessionDialog';
import { SessionAvailability } from './SessionAvailability';
import { availability, availabilityLabel } from './attendance';
import { sessionEvent, type SquadCalendarEvent } from './useSquadSchedule';
import { getAuthSessionId, setStoredAccessToken, setStoredUserId } from '../../utils/authStorage';

vi.mock('./api', async original => ({ ...(await original<typeof import('./api')>()), attendance: vi.fn() }));

const session: api.SquadSession = {
    id: 81, title: 'Retained training', starts_at: '2099-11-01T12:00:00Z', ends_at: '2099-11-01T13:00:00Z',
    location: 'East field', status: 'SCHEDULED', revision: 4, response_revision: 3, cancellation_reason: null,
    response_requested: true, attendance: [{ id: 61, name: 'Nika', active: true, response: 'UNANSWERED' }],
};

function CalendarFlow({ value = session }: { value?: api.SquadSession }) {
    const [selected, setSelected] = useState<SquadCalendarEvent | null>(null);
    return <MemoryRouter>
        <SessionNextActions events={[sessionEvent({ id: 11, name: 'U14' }, value)]} canManage={false} playerId={61} onSelect={setSelected} />
        {selected && <SquadSessionDetails event={selected} playerId={61} onClose={() => setSelected(null)} onSaved={() => undefined} />}
    </MemoryRouter>;
}

beforeEach(async () => {
    vi.clearAllMocks(); localStorage.clear(); setStoredUserId(20); setStoredAccessToken(`e30.${btoa(JSON.stringify({ sub: '20' }))}.synthetic`);
    vi.mocked(api.attendance).mockResolvedValue(undefined as never);
    await i18n.changeLanguage('en');
});
afterEach(cleanup);

it('opens a retained confirmation-requested unanswered session as expected, with only an optional opt-out', async () => {
    render(<CalendarFlow />);
    const next = screen.getByRole('region', { name: 'Session next action' });
    const view = within(next).getByRole('button');
    fireEvent.click(view);
    const details = screen.getByRole('dialog', { name: 'Retained training' });
    expect(within(details).getByText('Nika is expected')).toBeInTheDocument();
    expect(within(details).queryByRole('button', { name: 'Coming' })).not.toBeInTheDocument();
    expect(within(details).getByRole('button', { name: 'Can’t come' })).toBeEnabled();
    expect(within(next).queryAllByText(/coach asked.*confirm|confirm again|to confirm/i)).toHaveLength(0);
    expect(view).toHaveTextContent('View event');
    fireEvent.click(within(details).getByRole('button', { name: 'Can’t come' }));
    await waitFor(() => expect(api.attendance).toHaveBeenCalledOnce());
    expect(api.attendance).toHaveBeenCalledWith(11, 81, 61, 'NOT_GOING', 4, expect.stringMatching(/^[0-9a-f-]{36}$/i), getAuthSessionId(), undefined);
});

it.each([false, true])('keeps coach and calendar summaries expected by default when response_requested=%s', requested => {
    const value = { ...session, response_requested: requested };
    render(<SessionAvailability session={value} canManage busy={false} ended={false} pending={new Set()} onReply={vi.fn()} />);
    expect(screen.getByText('1')).toHaveClass('gk-num');
    expect(screen.getByText('Everyone expected')).toBeInTheDocument();
    expect(screen.queryAllByText(/to confirm|Everyone confirmed|Waiting for/)).toHaveLength(0);
    expect(availability(value)).toMatchObject({ asking: false, expected: 1, toConfirm: [] });
    expect(availabilityLabel(value)).toBe('Everyone expected');
    expect(sessionEvent({ id: 11, name: 'U14' }, value).responseSummary).toMatchObject({ going: 1, cantCome: 0, pending: 0 });
});

it.each([
    { response: 'RECONFIRMATION_REQUIRED', requested: false }, { response: 'RECONFIRMATION_REQUIRED', requested: true },
    { response: 'NOT_GOING', requested: false }, { response: 'NOT_GOING', requested: true },
])('keeps a moved opt-out and reason for wire $response with response_requested=$requested', async ({ response, requested }) => {
    const value = { ...session, response_requested: requested, attendance: [{ id: 61, name: 'Nika', active: true, response, response_status: 'RECONFIRMATION_REQUIRED', response_valid: false, previous_response: 'NOT_GOING', reason: 'School trip' }] };
    render(<CalendarFlow value={value} />);
    fireEvent.click(screen.getByRole('button', { name: 'View event' }));
    const details = screen.getByRole('dialog', { name: 'Retained training' });
    expect(within(details).getByText('The event changed. Keeping the last “can’t come” answer.')).toBeInTheDocument();
    expect(within(details).getByText(/School trip/)).toBeInTheDocument();
    expect(within(details).queryByText(/still expected|is coming/)).not.toBeInTheDocument();
    expect(within(details).queryByRole('button', { name: 'Coming' })).not.toBeInTheDocument();
    expect(availability(value)).toMatchObject({ expected: 0, toConfirm: [], cantCome: [{ id: 61 }] });
    expect(value.attendance[0].response).toBe(response);
    expect(api.attendance).not.toHaveBeenCalled();
    fireEvent.click(within(details).getByRole('button', { name: 'Nika can come after all' }));
    await waitFor(() => expect(api.attendance).toHaveBeenCalledOnce());
    expect(api.attendance).toHaveBeenCalledWith(11, 81, 61, 'GOING', 4, expect.stringMatching(/^[0-9a-f-]{36}$/i), getAuthSessionId(), undefined);
});

it('keeps a current explicit opt-out and reason while excluding withdrawn people from coach totals', () => {
    const value = { ...session, attendance: [
        { id: 61, name: 'Nika', active: true, response: 'NOT_GOING', reason: 'School trip' },
        { id: 62, name: 'Ana', active: false, response: 'GOING' },
    ] };
    render(<SessionAvailability session={value} canManage busy={false} ended={false} pending={new Set()} onReply={vi.fn()} />);
    expect(screen.getByText('0')).toHaveClass('gk-num');
    expect(screen.getByRole('list', { name: 'Can’t come' })).toHaveTextContent('Nika');
    expect(screen.getByRole('list', { name: 'Can’t come' })).toHaveTextContent('School trip');
    expect(availability(value)).toMatchObject({ expected: 0, invited: [{ id: 61 }], toConfirm: [] });
    expect(availabilityLabel(value)).toBe('1 can’t come');
});

it('does not turn a changed prior positive reply into a mandatory confirmation or a new write', () => {
    const value = { ...session, attendance: [{ id: 61, name: 'Nika', active: true, response: 'RECONFIRMATION_REQUIRED', previous_response: 'GOING' }] };
    render(<CalendarFlow value={value} />);
    fireEvent.click(screen.getByRole('button', { name: 'View event' }));
    expect(screen.getByText('It changed. Nika is still expected.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Coming' })).not.toBeInTheDocument();
    expect(api.attendance).not.toHaveBeenCalled();
});

it('keeps the exact UUID/revision/intent when an explicit undo of the retained opt-out needs recovery', async () => {
    vi.mocked(api.attendance).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined as never);
    const value = { ...session, attendance: [{ id: 61, name: 'Nika', active: true, response: 'RECONFIRMATION_REQUIRED', previous_response: 'NOT_GOING' }] };
    render(<CalendarFlow value={value} />);
    fireEvent.click(screen.getByRole('button', { name: 'View event' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nika can come after all' }));
    const retry = await screen.findByRole('button', { name: 'Retry earlier reply' });
    const first = vi.mocked(api.attendance).mock.calls[0];
    expect(first.slice(0, 5)).toEqual([11, 81, 61, 'GOING', 4]);
    expect(screen.getByRole('button', { name: 'Nika can come after all' })).toBeDisabled();
    fireEvent.click(retry);
    await waitFor(() => expect(api.attendance).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.attendance).mock.calls[1]).toEqual(first);
});
