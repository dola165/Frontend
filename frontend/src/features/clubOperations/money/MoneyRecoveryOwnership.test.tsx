import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RecordDetail } from '../RecordDetail';
import { MoneyFacts } from './MoneyFacts';
import type { Bootstrap, Definition, OperationRecord } from '../api';
import type { MoneyRecord } from './api';
import { getAuthSessionId, setStoredAccessToken } from '../../../utils/authStorage';
import { clearPendingFact, keepPendingFact, type PendingFact } from './pendingFact';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api }));
const row: MoneyRecord = { id: 5, title: 'Synthetic dues', squadId: 9, subjectUserId: 50, dueOn: null, period: 'October', revision: 0, canRecord: true, openingStatus: 'DUE',
    balance: { agreed: '100.00', received: '0.00', waived: '0.00', remaining: '100.00', currency: 'GEL', status: 'DUE', reminderCandidate: false }, history: [] };
const paid = { ...row, revision: 1, balance: { ...row.balance, received: '30.10', remaining: '69.90' } };
const both = { ...paid, revision: 2, balance: { ...paid.balance, received: '40.10', remaining: '59.90' } };
const boot: Bootstrap = { clubId: 10, clubName: 'Synthetic club', actorId: 7, leadership: false, definitions: [], specialisations: [], permissions: [], modules: [],
    settings: { setting: '', playing_level: '', enabled_modules: [], revision: 0 }, people: [], staff: [], guardians: [], squads: [], venues: [], events: [], sessions: [], links: [] };
const record: OperationRecord = { id: 5, club_id: 10, kind: 'INSTALMENT', module: 'FINANCE', title: 'Synthetic dues', status: 'DUE', squad_id: 9, subject_user_id: 50,
    assigned_user_id: null, event_id: null, session_id: null, related_record_id: null, due_on: null, data: {}, revision: 0, transitions: [], canEdit: false, created_at: '', updated_at: '' };
const definition: Definition = { kind: 'INSTALMENT', module: 'FINANCE', label: 'Membership instalment', fields: [], states: [] };
const changed = vi.fn();
function OrdinaryDetail() {
    const [open, setOpen] = useState(true);
    return open ? <RecordDetail club={10} boot={boot} record={record} definition={definition} backLabel="Back to finance" onClose={() => setOpen(false)} onEdit={vi.fn()}
        onChanged={async () => { changed(); setOpen(false); }} /> : <button onClick={() => setOpen(true)}>Open record</button>;
}
function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
type LateReply = typeof replies[number];
const replies = ['write success', 'write refused', 'write unknown', 'recovery recorded', 'recovery not recorded', 'recovery refused', 'recovery unknown'] as const;
function settle(reply: LateReply, late: ReturnType<typeof deferred<unknown>>) {
    if (reply === 'write success') late.resolve({ data: paid });
    else if (reply === 'recovery recorded') late.resolve({ data: { outcome: 'RECORDED', record: paid } });
    else if (reply === 'recovery not recorded') late.resolve({ data: { outcome: 'NOT_RECORDED', record: row } });
    else if (reply.endsWith('refused')) late.reject({ response: { status: reply.startsWith('write') ? 409 : 403, data: { message: 'Late A refusal' } } });
    else late.reject(new Error('Late A acknowledgement lost'));
}
async function fill(amount: string, reference: string) {
    await screen.findByLabelText('Amount · GEL');
    fireEvent.change(screen.getByLabelText('Amount · GEL'), { target: { value: amount } });
    fireEvent.change(screen.getByLabelText('Outside receipt reference'), { target: { value: reference } });
    fireEvent.change(screen.getByLabelText('Reason or details for the family'), { target: { value: `Actual outside receipt ${reference}` } });
}
const scope = () => `gk-money-fact:${getAuthSessionId()}:10:5`;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); api.get.mockReset().mockResolvedValue({ data: row }); api.post.mockReset(); changed.mockReset(); });
afterEach(cleanup);

it.each(replies)('CR2 ordinary Back/reopen: retired A %s cannot erase or overwrite B; B remains recoverable', async reply => {
    const late = deferred<unknown>(), isRecovery = reply.startsWith('recovery');
    const recorded = reply !== 'write refused' && reply !== 'recovery not recorded';
    let current = row, writes = 0, recoveries = 0;
    api.get.mockImplementation(async (path: string) => ({ data: path.endsWith('/money/5') ? current : [] }));
    api.post.mockImplementation((path: string) => {
        if (path.includes('/recovery/')) {
            if (isRecovery && ++recoveries === 1) return late.promise;
            return Promise.resolve({ data: { outcome: writes >= 2 || recorded ? 'RECORDED' : 'NOT_RECORDED', record: current } });
        }
        writes++;
        if (writes === 1) { current = recorded ? paid : row; return isRecovery ? Promise.reject(new Error('A acknowledgement lost')) : late.promise; }
        current = recorded ? both : { ...row, revision: 1, balance: { ...row.balance, received: '10.00', remaining: '90.00' } };
        return writes === 2 ? Promise.reject(new Error('B acknowledgement lost')) : Promise.resolve({ data: current });
    });
    render(<OrdinaryDetail />); await fill('30.10', 'A');
    fireEvent.click(screen.getByRole('button', { name: 'Record outside fact' }));
    const slot = scope(), a = sessionStorage.getItem(slot)!;
    if (isRecovery) {
        await screen.findByRole('button', { name: 'Retry the same fact' });
        fireEvent.click(screen.getByRole('button', { name: 'Resolve previous attempt' }));
        await waitFor(() => expect(recoveries).toBe(1));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Back to finance' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open record' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Resolve previous attempt' }));
    if (!recorded) {
        await screen.findByText('The earlier attempt did not record a money fact and is now closed.');
        fireEvent.click(screen.getByRole('button', { name: 'Back to finance' }));
    }
    fireEvent.click(await screen.findByRole('button', { name: 'Open record' }));
    await fill('10.00', 'B'); fireEvent.click(screen.getByRole('button', { name: 'Record outside fact' }));
    await screen.findByRole('button', { name: 'Retry the same fact' });
    const b = sessionStorage.getItem(slot)!, pendingB = JSON.parse(b), callbacks = changed.mock.calls.length, outcome = screen.getByRole('alert').textContent;
    expect(pendingB.key).not.toBe(JSON.parse(a).key);
    expect(pendingB.body).toMatchObject({ amount: '10.00', reference: 'B', reason: 'Actual outside receipt B', revision: recorded ? 1 : 0 });
    await act(async () => { settle(reply, late); });
    expect(sessionStorage.getItem(slot)).toBe(b);
    expect(screen.getByRole('alert')).toHaveTextContent(outcome!);
    expect(changed).toHaveBeenCalledTimes(callbacks);
    expect(screen.queryByText('Late A refusal')).toBeNull();
    expect(screen.queryByText('Outside fact recorded.')).toBeNull();
    expect(screen.queryByText('The earlier attempt did not record a money fact and is now closed.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry the same fact' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to finance' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open record' }));
    await screen.findByRole('button', { name: 'Retry the same fact' });
    expect(screen.getByLabelText('Amount · GEL')).toHaveValue('10.00');
    expect(screen.getByLabelText('Outside receipt reference')).toHaveValue('B');
    expect(sessionStorage.getItem(slot)).toBe(b);
    const count = api.post.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: isRecovery ? 'Resolve previous attempt' : 'Retry the same fact' }));
    await screen.findByRole('button', { name: 'Open record' });
    expect(api.post).toHaveBeenCalledTimes(count + 1);
    const completion = api.post.mock.calls[count];
    if (isRecovery) expect(completion[0]).toBe(`/clubs/10/operations/money/5/recovery/${pendingB.key}`);
    else { expect(completion[1]).toEqual(pendingB.body); expect(completion[2].headers['Idempotency-Key']).toBe(pendingB.key); }
    expect(completion[2]._authSessionId).toBe(getAuthSessionId());
    expect(sessionStorage.getItem(slot)).toBeNull();
    expect(changed).toHaveBeenCalledTimes(callbacks + 1);
    fireEvent.click(screen.getByRole('button', { name: 'Open record' }));
    await screen.findByText(recorded ? '59.90 GEL' : '90.00 GEL');
    expect(api.post).toHaveBeenCalledTimes(count + 1);
});

it.each(replies)('CR2 account retirement: late A %s cannot clear its pending identity or publish an outcome', async reply => {
    const late = deferred<unknown>(), isRecovery = reply.startsWith('recovery');
    api.post.mockImplementation((path: string) => path.includes('/recovery/') || !isRecovery ? late.promise : Promise.reject(new Error('A acknowledgement lost')));
    render(<MoneyFacts club={10} id={5} revision={0} onChanged={changed} />);
    await fill('30.10', 'A'); fireEvent.click(screen.getByRole('button', { name: 'Record outside fact' }));
    if (isRecovery) {
        await screen.findByRole('button', { name: 'Retry the same fact' });
        fireEvent.click(screen.getByRole('button', { name: 'Resolve previous attempt' }));
    }
    const slot = scope(), pendingA = sessionStorage.getItem(slot);
    setStoredAccessToken('second-synthetic-account');
    await act(async () => { settle(reply, late); });
    expect(sessionStorage.getItem(slot)).toBe(pendingA);
    expect(sessionStorage.getItem(scope())).toBeNull();
    expect(changed).not.toHaveBeenCalled();
    expect(screen.queryByText('Late A refusal')).toBeNull();
    expect(screen.queryByText('Outside fact recorded.')).toBeNull();
    expect(screen.queryByText('The earlier attempt did not record a money fact and is now closed.')).toBeNull();
});

it('CR2 pending ownership: a completed A cannot clear or re-persist over immutable B, including with B’s key', () => {
    const a: PendingFact = { key: crypto.randomUUID(), body: { type: 'RECEIPT', revision: 0, amount: '30.10', happenedOn: '2026-10-30', reference: 'A', reason: 'Actual receipt A', reverses: null } };
    const b: PendingFact = { key: crypto.randomUUID(), body: { ...a.body!, revision: 1, amount: '10.00', reference: 'B' } };
    keepPendingFact(scope(), a); expect(clearPendingFact(scope(), a.key)).toBe(true);
    keepPendingFact(scope(), b); const rawB = sessionStorage.getItem(scope());
    expect(clearPendingFact(scope(), a.key)).toBe(false);
    expect(() => keepPendingFact(scope(), a)).toThrow();
    expect(() => keepPendingFact(scope(), { ...b, body: a.body })).toThrow();
    keepPendingFact(scope(), b); expect(sessionStorage.getItem(scope())).toBe(rawB);
    expect(clearPendingFact(scope(), b.key)).toBe(true); expect(sessionStorage.getItem(scope())).toBeNull();
});

it('CR2 legacy pending ownership: only the matching recovery key can clear an opaque marker', () => {
    const key = crypto.randomUUID(); sessionStorage.setItem(scope(), key);
    expect(clearPendingFact(scope(), crypto.randomUUID())).toBe(false); expect(sessionStorage.getItem(scope())).toBe(key);
    expect(clearPendingFact(scope(), key)).toBe(true); expect(sessionStorage.getItem(scope())).toBeNull();
});
