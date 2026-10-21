import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GkRoot } from '../../design/primitives';
import { getAuthSessionId, setStoredAccessToken, setStoredUserId } from '../../utils/authStorage';
import { emptyDraft, planGet, planPost, type Plan, type PlanContext } from './api';
import { PlanEditorBody } from './planner/PlanEditor';
import { usePlanEditor } from './planner/usePlanEditor';
import type { PlanMap } from './planner/usePlanMap';

vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), planGet: vi.fn(), planPost: vi.fn() }));
const context: PlanContext = { id: 4, name: 'QA club', settings: { timezone: 'Asia/Tbilisi', currency: 'GEL' }, squads: [{ id: 5, name: 'U16', canEdit: true }], participants: [], events: [], sessions: [] };
const record = (id = 8): Plan => ({ id, club_id: 4, squad_id: 5, title: `Plan ${id}`, revision: 3, created_by: 2, published_version: 0, published_revision: null,
    updated_at: '2026-10-17T05:00:00Z', starts_at: '2030-01-01T12:00:00Z', draft: { ...emptyDraft(context), title: `Plan ${id}`, budgetMinor: 30000,
        arrangements: [{ key: 'transport', title: 'Minibus hire', kind: 'TRANSPORT', amountMinor: 10000, notes: '', financeRecordId: null }, { key: 'meals', title: 'Lunch', kind: 'MEALS', amountMinor: 5000, notes: '', financeRecordId: null }] },
    suppliers: {}, totalMinor: 15000, budgetApproved: false, approvedBy: null, rights: { edit: true, travel: true, finance: false, publish: true, leadership: false },
    issues: [], history: [], familyResponses: [], trip_id: null, trip: null, passengers: [], linkedSchedule: [] });
const answer = { arrangementKey: 'transport', status: 'PENDING', source: '  QA supplier, 17 Oct 09:00  ', evidence: 'Reference QA-17\n  Preserve this exact note.  ' };
const acknowledged = (id = 8): Plan => ({ ...record(id), revision: 4, suppliers: { transport: { status: 'PENDING', source: answer.source, evidence: answer.evidence, fingerprint: 'current', actor: 2, at: '2026-10-17T05:00:00Z' } } });
function Harness() {
    const editor = usePlanEditor({ enabled: true, initialClubId: 4 });
    return <GkRoot>
        <output aria-label="Current plan">{editor.plan?.title}</output>
        <button onClick={() => editor.open({ id: 9, club_id: 4, squad_id: 5 })}>Open another plan</button>
        <button onClick={editor.reload}>Read the saved plan</button>
        <PlanEditorBody editor={editor} planMap={{ seed: null } as unknown as PlanMap} onPreview={() => undefined} pendingPlace={null} onPendingDone={() => undefined} />
    </GkRoot>;
}
const element = (id = 8) => <MemoryRouter initialEntries={[`/world/map?plans=staff&plan=${id}&club=4&squad=5&step=costs`]}><Harness /></MemoryRouter>;
const source = () => screen.getByLabelText('Who confirmed, and when');
const evidence = () => screen.getByLabelText('Reference or evidence');
async function openAnswer() {
    const buttons = await screen.findAllByRole('button', { name: 'Record supplier answer' }); fireEvent.click(buttons[0]);
    fireEvent.change(screen.getByLabelText('Supplier’s answer'), { target: { value: answer.status } });
    fireEvent.change(source(), { target: { value: answer.source } }); fireEvent.change(evidence(), { target: { value: answer.evidence } });
    return source().closest('form')!;
}
beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); setStoredUserId(2); setStoredAccessToken('synthetic-supplier-login-a');
    vi.mocked(planGet).mockImplementation(async path => (path === '/context' ? [context] : path === '/8' ? record() : path === '/9' ? record(9) : path.startsWith('?clubId') ? [record(), record(9)] : []) as never);
});
afterEach(cleanup);

it('keeps the exact submitted fields mounted and locked while pending, serializes duplicate submit and closes only on acknowledgment', async () => {
    let resolve!: (plan: Plan) => void;
    vi.mocked(planPost).mockImplementationOnce(() => new Promise<Plan>(done => { resolve = done; }));
    render(element()); const form = await openAnswer(), button = screen.getByRole('button', { name: 'Record the answer' });
    fireEvent.submit(form); fireEvent.submit(form);
    expect(source()).toHaveValue(answer.source); expect(evidence()).toHaveValue(answer.evidence);
    expect(source()).toBeDisabled(); expect(evidence()).toBeDisabled(); expect(button).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Record supplier answer' }).every(item => item.hasAttribute('disabled'))).toBe(true);
    expect(planPost).toHaveBeenCalledExactlyOnceWith('/8/supplier', { revision: 3, ...answer });
    expect(JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })).not.toContain('Preserve this exact note.');
    await act(async () => resolve(acknowledged()));
    await waitFor(() => expect(screen.queryByLabelText('Reference or evidence')).not.toBeInTheDocument());
    expect(screen.getByText('All changes saved')).toBeVisible();
});

it('retains evidence when the real command returns false for an unsaved plan instead of dispatching', async () => {
    render(element()); const form = await openAnswer();
    fireEvent.change(screen.getByLabelText('Budget'), { target: { value: '500' } }); fireEvent.submit(form);
    await screen.findByText('Save your changes before publishing or recording a decision.');
    expect(source()).toHaveValue(answer.source); expect(evidence()).toHaveValue(answer.evidence); expect(source()).toBeEnabled();
    expect(planPost).not.toHaveBeenCalled();
});

it('retains failed or unknown-outcome input and explicitly retries the same evidence and original revision', async () => {
    vi.mocked(planPost).mockRejectedValueOnce(new Error('Confirmation response unavailable')).mockResolvedValueOnce(acknowledged());
    render(element()); fireEvent.submit(await openAnswer()); await screen.findByText('That was not completed. Try again.');
    expect(source()).toHaveValue(answer.source); expect(evidence()).toHaveValue(answer.evidence);
    expect(screen.getByText('Not saved. Your changes are kept.')).toBeVisible();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Record the answer' })).toBeEnabled());
    expect(planPost).toHaveBeenCalledOnce();
    fireEvent.submit(source().closest('form')!);
    await waitFor(() => expect(screen.queryByLabelText('Reference or evidence')).not.toBeInTheDocument());
    expect(planPost).toHaveBeenNthCalledWith(1, '/8/supplier', { revision: 3, ...answer });
    expect(planPost).toHaveBeenNthCalledWith(2, '/8/supplier', { revision: 3, ...answer });
});

it('keeps conflicting evidence and never fetches or guesses a newer revision for an automatic overwrite', async () => {
    vi.mocked(planPost).mockRejectedValue({ response: { status: 409, data: { message: 'The saved plan changed. Review it first.' } } });
    render(element()); fireEvent.submit(await openAnswer()); await screen.findByText('The saved plan changed. Review it first.');
    expect(source()).toHaveValue(answer.source); expect(evidence()).toHaveValue(answer.evidence);
    expect(planPost).toHaveBeenCalledOnce(); expect(vi.mocked(planGet).mock.calls.filter(([path]) => path === '/8')).toHaveLength(1);
    fireEvent.submit(source().closest('form')!);
    await waitFor(() => expect(planPost).toHaveBeenCalledTimes(2));
    expect(planPost).toHaveBeenNthCalledWith(2, '/8/supplier', { revision: 3, ...answer });
    expect(evidence()).toHaveValue(answer.evidence);
});

it.each(['success', 'failure'] as const)('does not let an old plan %s navigate back, close another form or replace its pending state', async outcome => {
    let finishOld!: (plan: Plan) => void, finishNew!: (plan: Plan) => void;
    vi.mocked(planPost).mockImplementationOnce(() => new Promise<Plan>((done, reject) => { finishOld = plan => outcome === 'success' ? done(plan) : reject({ response: { data: { message: 'Retired plan failure' } } }); })).mockImplementationOnce(() => new Promise<Plan>(done => { finishNew = done; }));
    render(element()); fireEvent.submit(await openAnswer());
    fireEvent.click(screen.getByRole('button', { name: 'Open another plan' }));
    await waitFor(() => expect(screen.getByLabelText('Current plan')).toHaveTextContent('Plan 9'));
    fireEvent.click(screen.getByRole('tab', { name: 'Costs' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Record supplier answer' })[0]).toBeEnabled());
    const nextForm = await openAnswer(); fireEvent.change(evidence(), { target: { value: 'Only plan 9 evidence' } }); fireEvent.submit(nextForm);
    await act(async () => finishOld(acknowledged()));
    expect(screen.getByLabelText('Current plan')).toHaveTextContent('Plan 9');
    expect(evidence()).toHaveValue('Only plan 9 evidence'); expect(evidence()).toBeDisabled();
    expect(screen.queryByText('Retired plan failure')).not.toBeInTheDocument();
    expect(planPost).toHaveBeenNthCalledWith(2, '/9/supplier', { revision: 3, ...answer, evidence: 'Only plan 9 evidence' });
    await act(async () => finishNew(acknowledged(9)));
    await waitFor(() => expect(screen.queryByLabelText('Reference or evidence')).not.toBeInTheDocument());
});

it('retires an unsent supplier note as soon as the stored login changes', async () => {
    const view = render(element()); await openAnswer(); const oldSession = getAuthSessionId();
    act(() => { setStoredUserId(3); setStoredAccessToken('synthetic-supplier-login-b'); }); view.rerender(element());
    expect(getAuthSessionId()).not.toBe(oldSession);
    expect(screen.queryByLabelText('Reference or evidence')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(answer.source)).not.toBeInTheDocument(); expect(screen.queryByDisplayValue(answer.evidence)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Record supplier answer' })[0]);
    expect(source()).toHaveValue(''); expect(evidence()).toHaveValue(''); expect(planPost).not.toHaveBeenCalled();
    fireEvent.change(source(), { target: { value: 'Account B source' } }); fireEvent.change(evidence(), { target: { value: 'Account B note' } });
    fireEvent.submit(source().closest('form')!); await screen.findByText('Saving wasn’t confirmed. Your entries are kept here.');
    expect(planPost).not.toHaveBeenCalled(); expect(evidence()).toHaveValue('Account B note');
});

it('retires a command after an explicit reload so its older reply cannot replace the reviewed revision', async () => {
    let finish!: (plan: Plan) => void;
    vi.mocked(planPost).mockImplementationOnce(() => new Promise<Plan>(done => { finish = done; }));
    render(element()); fireEvent.submit(await openAnswer());
    vi.mocked(planGet).mockImplementation(async path => (path === '/context' ? [context] : path === '/8' ? { ...record(), revision: 5 } : path.startsWith('?clubId') ? [record()] : []) as never);
    fireEvent.click(screen.getByRole('button', { name: 'Read the saved plan' })); await screen.findByText('Revision 5');
    await openAnswer(); fireEvent.change(evidence(), { target: { value: 'Note after explicit review' } });
    await act(async () => finish(acknowledged()));
    expect(screen.getByText('Revision 5')).toBeVisible(); expect(evidence()).toHaveValue('Note after explicit review'); expect(evidence()).toBeEnabled();
    expect(planPost).toHaveBeenCalledOnce();
});

it('ignores a retired account’s late response after a different account opens its own plan', async () => {
    let finish!: (plan: Plan) => void;
    vi.mocked(planPost).mockImplementationOnce(() => new Promise<Plan>(done => { finish = done; }));
    const first = render(element()); fireEvent.submit(await openAnswer()); first.unmount();
    act(() => { setStoredUserId(3); setStoredAccessToken('synthetic-supplier-login-b'); });
    render(element(9)); await openAnswer(); fireEvent.change(evidence(), { target: { value: 'Account B private answer' } });
    await act(async () => finish(acknowledged()));
    expect(screen.getByLabelText('Current plan')).toHaveTextContent('Plan 9'); expect(evidence()).toHaveValue('Account B private answer'); expect(evidence()).toBeEnabled();
    expect(planPost).toHaveBeenCalledOnce();
});
