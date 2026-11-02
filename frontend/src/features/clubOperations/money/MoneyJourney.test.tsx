import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MoneyFacts } from './MoneyFacts';
import { MoneyHistory } from './MoneyHistory';
import { FamilyMoneyHistory } from '../../parents/hub/FamilyMoneyHistory';
import { KitStockPanel } from '../KitStockPanel';
import { moneyText, type MoneyRecord } from './api';
import { setStoredAccessToken } from '../../../utils/authStorage';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api }));
const row: MoneyRecord = { id: 5, title: 'October dues', squadId: 9, subjectUserId: 50, dueOn: '2026-10-01', period: 'October', revision: 0, canRecord: true,
    balance: { agreed: '100.00', received: '0.00', waived: '0.00', remaining: '100.00', currency: 'GEL', status: 'OVERDUE', reminderCandidate: true }, history: [] };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); api.get.mockReset().mockResolvedValue({ data: row }); api.post.mockReset(); });
afterEach(cleanup);
function fill() {
    fireEvent.change(screen.getByLabelText('Amount · GEL'), { target: { value: '30.10' } });
    fireEvent.change(screen.getByLabelText('Outside receipt reference'), { target: { value: 'Cash book 12' } });
    fireEvent.change(screen.getByLabelText('Reason or details for the family'), { target: { value: 'Cash received at training' } });
}
it('preserves the exact outside fact and key after a lost response; refresh never resubmits', async () => {
    api.post.mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce({ data: { ...row, revision: 1, balance: { ...row.balance, received: '30.10', remaining: '69.90' } } });
    const refresh = vi.fn().mockRejectedValue(new Error('page offline'));
    render(<MoneyFacts club={10} id={5} revision={0} onChanged={refresh} />);
    await screen.findByLabelText('Amount · GEL'); fill(); fireEvent.click(screen.getByRole('button', { name: 'Record outside fact' }));
    await screen.findByRole('button', { name: 'Retry the same fact' });
    expect(screen.getByLabelText('Amount · GEL')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry the same fact' }));
    await screen.findByText('Outside fact recorded.');
    expect(screen.getByText('69.90 GEL')).toBeVisible();
    expect(api.post.mock.calls[0]).toEqual(api.post.mock.calls[1]);
    expect(api.post.mock.calls[0][1].amount).toBe('30.10');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh saved record' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2)); expect(api.post).toHaveBeenCalledTimes(2);
});
it('keeps refused facts editable and does not claim payment or a saved receipt', async () => {
    api.post.mockRejectedValue({ response: { status: 409, data: { message: 'Record changed' } } });
    render(<MoneyFacts club={10} id={5} revision={0} onChanged={vi.fn()} />); await screen.findByLabelText('Amount · GEL'); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Record outside fact' })); await screen.findByText('Record changed');
    expect(screen.getByLabelText('Amount · GEL')).toHaveValue('30.10'); expect(screen.getByLabelText('Amount · GEL')).toBeEnabled();
    expect(screen.queryByText('Outside fact recorded.')).toBeNull();
});
it('switching children retires the previous request and never displays its late receipt', async () => {
    let old!: (value: { data: MoneyRecord[] }) => void;
    api.get.mockImplementation((path: string) => path.endsWith('child=50') ? new Promise(resolve => { old = resolve; }) : Promise.resolve({ data: [{ ...row, title: 'Second child dues', subjectUserId: 51 }] }));
    const view = render(<FamilyMoneyHistory club={10} child={50} />); view.rerender(<FamilyMoneyHistory club={10} child={51} />);
    await screen.findByRole('heading', { name: 'Second child dues' });
    await act(async () => old({ data: [{ ...row, title: 'First child private receipt' }] }));
    expect(screen.queryByText('First child private receipt')).toBeNull();
    expect(api.get.mock.calls[0][1].signal.aborted).toBe(true);
});
it('a changed account cannot expose a late family response', async () => {
    let resolve!: (value: { data: MoneyRecord[] }) => void;
    api.get.mockImplementation(() => new Promise(yes => { resolve = yes; }));
    render(<FamilyMoneyHistory club={10} child={50} />); setStoredAccessToken('second-synthetic-account');
    await act(async () => resolve({ data: [row] })); expect(screen.queryByRole('heading', { name: 'October dues' })).toBeNull();
});
it('family money recovers from a failed load without turning the failure into zero', async () => {
    api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [row] });
    render(<FamilyMoneyHistory club={10} child={50} />);
    await screen.findByRole('alert'); expect(screen.queryByText('0.00 GEL')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry money records' }));
    await screen.findByRole('heading', { name: 'October dues' }); expect(screen.queryByRole('alert')).toBeNull();
});
it('kit availability recovers after a failed load and keeps unknown stock distinct', async () => {
    api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [{ id: 11, title: 'Training balls', count: { total: null, issued: null, lost: null, available: null, shortage: null, status: 'UNKNOWN' } }] });
    render(<KitStockPanel club={10} revision={0} />); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry stock' }));
    await screen.findByRole('heading', { name: 'Training balls' }); expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByText('Unknown')).toHaveLength(5); expect(screen.queryByText('No stock available for another issue.')).toBeNull();
});
it('unknown amounts and currencies stay unknown, and history keeps reversals visible', () => {
    expect(moneyText(null, 'GEL')).toBe('Amount not known'); expect(moneyText('0', null)).toBe('Amount not known');
    render(<MoneyHistory record={{ ...row, history: [{ id: 2, type: 'CORRECTION', amount: null, currency: 'GEL', happenedOn: '2026-10-29', reference: null, reason: 'Wrong receipt reversed', reverses: 1, recordedAt: '2026-10-30' }] }} />);
    expect(screen.getByText('Correction · reverses #1')).toBeInTheDocument();
    expect(screen.getByText('Wrong receipt reversed')).toBeInTheDocument();
});
