import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MoneyFacts } from './MoneyFacts';
import { FamilyMoneyConnections } from './FamilyMoneyConnections';
import { FamilyClubWork } from '../FamilyClubWork';
import { getAuthSessionId, setStoredAccessToken } from '../../../utils/authStorage';
import type { MoneyRecord } from './api';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api }));
const row: MoneyRecord = { id: 5, title: 'Old unpaid dues', squadId: 9, subjectUserId: 50, dueOn: '2026-10-01', period: 'October', revision: 0, canRecord: true, openingStatus: 'DUE',
    balance: { agreed: '100.00', received: '0.00', waived: '0.00', remaining: '100.00', currency: 'GEL', status: 'OVERDUE', reminderCandidate: true }, history: [] };
const paid = { ...row, revision: 1, balance: { ...row.balance, received: '30.10', remaining: '69.90' } };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); api.get.mockReset().mockResolvedValue({ data: row }); api.post.mockReset(); });
afterEach(cleanup);
const show = () => render(<MoneyFacts club={10} id={5} revision={0} onChanged={vi.fn().mockResolvedValue(undefined)} />);
async function enter() {
    await screen.findByLabelText('Amount · GEL');
    fireEvent.change(screen.getByLabelText('Amount · GEL'), { target: { value: '30.10' } });
    fireEvent.change(screen.getByLabelText('Outside receipt reference'), { target: { value: 'cash-12' } });
    fireEvent.change(screen.getByLabelText('Reason or details for the family'), { target: { value: 'Actual cash received' } });
}
it.each(['before append', 'after append'])('CR2: lost acknowledgement %s survives remount and resolves the exact operation once', async stage => {
    let current = row, appends = 0, calls = 0;
    const receipts = new Set<string>();
    api.get.mockImplementation(() => Promise.resolve({ data: current }));
    api.post.mockImplementation((_path: string, _body: unknown, config: { headers: Record<string, string> }) => {
        const key = config.headers['Idempotency-Key']; calls++;
        if (calls === 1 && stage === 'before append') return Promise.reject(new Error('lost before append'));
        if (!receipts.has(key)) { receipts.add(key); appends++; current = paid; }
        return calls === 1 ? Promise.reject(new Error('ack lost')) : Promise.resolve({ data: current });
    });
    const first = show(); await enter(); fireEvent.click(screen.getByRole('button', { name: 'Record outside fact' }));
    await screen.findByRole('button', { name: 'Retry the same fact' }); const sent = api.post.mock.calls[0]; first.unmount();
    show(); await screen.findByRole('button', { name: 'Retry the same fact' }); expect(screen.getByLabelText('Amount · GEL')).toHaveValue('30.10');
    fireEvent.click(screen.getByRole('button', { name: 'Retry the same fact' })); await screen.findByText('Outside fact recorded.');
    expect(api.post.mock.calls[1]).toEqual(sent); expect(appends).toBe(1);
    expect(sessionStorage.getItem(`gk-money-fact:${getAuthSessionId()}:10:5`)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh saved record' })); await screen.findByRole('button', { name: 'Record outside fact' });
});
it.each(['RECORDED', 'NOT_RECORDED'])('CR2: authenticated resolution of an old opaque marker returns %s without inventing a fact', async outcome => {
    const key = crypto.randomUUID(); sessionStorage.setItem(`gk-money-fact:${getAuthSessionId()}:10:5`, key);
    api.post.mockResolvedValue({ data: { outcome, record: outcome === 'RECORDED' ? paid : row } });
    show(); fireEvent.click(await screen.findByRole('button', { name: 'Resolve previous attempt' }));
    if (outcome === 'RECORDED') await screen.findByText('Outside fact recorded.');
    else { await screen.findByText('The earlier attempt did not record a money fact and is now closed.'); expect(screen.getByRole('button', { name: 'Record outside fact' })).toBeEnabled(); }
    expect(api.post).toHaveBeenCalledTimes(1); expect(api.post.mock.calls[0][0]).toBe(`/clubs/10/operations/money/5/recovery/${key}`);
    expect(sessionStorage.getItem(`gk-money-fact:${getAuthSessionId()}:10:5`)).toBeNull();
});
it('CR2: a full pending request can resolve a recorded acknowledgement even when new recording is disabled', async () => {
    sessionStorage.setItem(`gk-money-fact:${getAuthSessionId()}:10:5`, JSON.stringify({ version: 1, key: crypto.randomUUID(), body: { type: 'RECEIPT', revision: 0, amount: '30.10', happenedOn: '2026-10-30', reference: 'cash', reason: 'Actual receipt', reverses: null } }));
    api.get.mockResolvedValue({ data: { ...paid, canRecord: false } });
    api.post.mockResolvedValue({ data: { outcome: 'RECORDED', record: { ...paid, canRecord: false } } });
    show(); fireEvent.click(await screen.findByRole('button', { name: 'Resolve previous attempt' }));
    await screen.findByText('Outside fact recorded.'); expect(api.post.mock.calls[0][0]).toContain('/recovery/');
    expect(sessionStorage.getItem(`gk-money-fact:${getAuthSessionId()}:10:5`)).toBeNull();
});
it('CR2: another account never loads/replays a pending financial body; revoked authority cannot resolve it', async () => {
    const first = show(); await enter(); api.post.mockRejectedValue(new Error('lost')); fireEvent.click(screen.getByRole('button', { name: 'Record outside fact' }));
    await screen.findByRole('button', { name: 'Retry the same fact' }); first.unmount();
    setStoredAccessToken('second-synthetic-account'); show(); await screen.findByLabelText('Amount · GEL');
    expect(screen.getByLabelText('Amount · GEL')).toHaveValue(''); expect(screen.queryByRole('button', { name: 'Retry the same fact' })).toBeNull(); expect(api.post).toHaveBeenCalledTimes(1);
    cleanup(); sessionStorage.setItem(`gk-money-fact:${getAuthSessionId()}:10:5`, crypto.randomUUID());
    api.post.mockRejectedValue({ response: { status: 403, data: { message: 'Current job ended' } } }); show();
    fireEvent.click(await screen.findByRole('button', { name: 'Resolve previous attempt' })); await screen.findByText('Current job ended');
    expect(screen.queryByText('Outside fact recorded.')).toBeNull(); expect(screen.queryByRole('button', { name: 'Record outside fact' })).toBeNull();
});
it('CR3: a definitive stale refusal retains fields, refreshes read-only, then resubmits only on request with the new revision', async () => {
    api.get.mockResolvedValueOnce({ data: row }).mockResolvedValue({ data: paid });
    api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Record changed' } } }).mockResolvedValueOnce({ data: { ...paid, revision: 2 } });
    show(); await enter(); fireEvent.click(screen.getByRole('button', { name: 'Record outside fact' })); await screen.findByText('Record changed');
    expect(screen.getByRole('button', { name: 'Record outside fact' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh balance' })); await screen.findByText('69.90 GEL');
    expect(screen.getByLabelText('Amount · GEL')).toHaveValue('30.10'); expect(api.post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Record outside fact' })); await screen.findByText('Outside fact recorded.');
    expect(api.post.mock.calls.map(call => call[1].revision)).toEqual([0, 1]);
    expect(api.post.mock.calls[0][2].headers['Idempotency-Key']).not.toBe(api.post.mock.calls[1][2].headers['Idempotency-Key']);
});
it('CR4: money older than the mixed 100-record cap is reached per connection, including self, using the same endpoint', async () => {
    const connections = [{ club_id: 10, user_id: 50, name: 'Current child', club_name: 'Dinamo' }, { club_id: 10, user_id: 7, name: 'Self player', club_name: 'Dinamo' }];
    const mixed = Array.from({ length: 100 }, (_, id) => ({ id, club_id: 10, kind: 'ATTENDANCE', title: `New attendance ${id}`, person_name: 'Current child', club_name: 'Dinamo', status: 'EXPECTED', data: {}, feedback: [], canFeedback: false }));
    api.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/club-operations/family' ? { connections, shared: mixed, schedule: [], reports: [] } : [{ ...paid, subjectUserId: path.endsWith('child=7') ? 7 : 50 }] }));
    render(<MemoryRouter initialEntries={['/parent?tab=connections']}><FamilyClubWork staffClubs={[]} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Money: Current child · Dinamo' })); await screen.findByRole('heading', { name: 'Old unpaid dues' });
    expect(screen.getByText('69.90 GEL')).toBeVisible(); expect(api.get.mock.calls.filter(call => call[0].includes('family-money')).map(call => call[0])).toEqual(['/clubs/10/operations/family-money?child=50']);
    fireEvent.click(screen.getByRole('button', { name: 'Money: Self player · Dinamo' })); await waitFor(() => expect(api.get).toHaveBeenCalledWith('/clubs/10/operations/family-money?child=7', expect.anything()));
});
it('CR4: an unrecognized child in the URL never reads a money ledger and late data is retired on selection changes', async () => {
    let resolve!: (value: { data: MoneyRecord[] }) => void;
    api.get.mockImplementation(() => new Promise(yes => { resolve = yes; }));
    const c = [{ club_id: 10, user_id: 50, name: 'Current child', club_name: 'Dinamo' }];
    render(<MemoryRouter initialEntries={['/parent?tab=connections&moneyFor=10:999']}><FamilyMoneyConnections connections={c} revision={0} /></MemoryRouter>);
    expect(api.get).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Money: Current child · Dinamo' }));
    cleanup(); await act(async () => resolve({ data: [paid] })); expect(screen.queryByText('69.90 GEL')).toBeNull();
});
