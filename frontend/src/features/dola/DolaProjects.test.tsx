import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AgentDolaPage } from './AgentDolaPage';
import { DolaProvider } from './DolaProvider';
import { dolaProjectOutcome, dolaStatus, dolaWelcome, latestDola, resolveDolaAction, streamDola, type DolaAction, type DolaAnswer, type DolaProjectOutcome } from './api';

let actor = 7, session = 'project-session';
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: actor }, sessionId: session }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), dolaStatus: vi.fn(), dolaWelcome: vi.fn(), latestDola: vi.fn(), resolveDolaAction: vi.fn(), streamDola: vi.fn(), dolaProjectOutcome: vi.fn() }));
const operationId = '11111111-1111-4111-8111-111111111111';
const conversationId = '22222222-2222-4222-8222-222222222222';
const action: DolaAction = { id: operationId, kind: 'PROJECT_STEP_DAY', state: 'PENDING', title: 'Move project step to 2026-11-03', body: 'Check the goal nets',
    details: [{ label: 'Club', value: 'FC Dinamo Tbilisi Academy (synthetic) (#7)' }, { label: 'Project', value: 'Prepare the training ground (#20)' }, { label: 'Squad', value: 'U14 (#13)' }, { label: 'Assigned to', value: 'Synthetic coach (#10)' }, { label: 'Day before', value: '2026-11-01' }, { label: 'Day after', value: '2026-11-03' }], confirmLabel: 'Confirm day change', expiresAt: new Date(Date.now() + 600000).toISOString(), receipt: '', destination: { id: 'project:20', title: 'Open project', path: '/projects/20' } };
const answer: DolaAnswer = { conversationId, requestId: 'r', answer: 'Review the exact change.', destinations: [], sources: [], toolsUsed: ['read_club_projects', 'prepare_project_step_day'], modelCalls: 0, totalTokens: 0, actions: [action] };
const receipt: DolaProjectOutcome = { operationId, state: 'COMPLETED', receipt: 'Step #30: 2026-11-01 -> 2026-11-03; version 3 -> 4.', context: [{ label: 'Current club', value: 'Synthetic club' }], destination: action.destination };
const tree = () => <MemoryRouter initialEntries={['/assistant']}><DolaProvider><AgentDolaPage /></DolaProvider></MemoryRouter>;
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); actor = 7; session = 'project-session'; localStorage.setItem('gk-session-id', session);
    vi.mocked(dolaStatus).mockResolvedValue({ name: 'Dola', available: true, mode: 'test', maxMessageLength: 2000, capabilities: [] });
    vi.mocked(dolaWelcome).mockResolvedValue({ contexts: ['coach'] }); vi.mocked(latestDola).mockResolvedValue(null); vi.mocked(streamDola).mockResolvedValue(answer);
});
afterEach(cleanup);
async function propose() {
    render(tree());
    fireEvent.change(screen.getByLabelText('Message Agent Dola'), { target: { value: 'Move the goal nets step to November 3' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    return screen.findByRole('button', { name: 'Confirm day change' });
}
it('shows exact object and changes, waits for receipt, and never auto-confirms', async () => {
    const confirm = await propose();
    expect(screen.getByText('FC Dinamo Tbilisi Academy (synthetic) (#7)')).toBeInTheDocument();
    expect(screen.getByText('2026-11-01')).toBeInTheDocument(); expect(resolveDolaAction).not.toHaveBeenCalled();
    let finish!: (a: DolaAction) => void;
    vi.mocked(resolveDolaAction).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(confirm);
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('gk-dola-project-operation:7')!)).toEqual({ operationId, conversationId });
    expect(localStorage.getItem('gk-dola-project-operation:7')).not.toContain('goal nets');
    await act(async () => finish({ ...action, state: 'COMPLETED', receipt: receipt.receipt }));
    expect(await screen.findByText('Completed')).toBeInTheDocument(); expect(screen.getByText(receipt.receipt)).toBeInTheDocument();
    expect(localStorage.getItem('gk-dola-project-operation:7')).toBeNull();
});
it('preserves uncertain identity on reload and checks receipt without re-sending a write', async () => {
    vi.mocked(resolveDolaAction).mockRejectedValue(new Error('Connection lost'));
    fireEvent.click(await propose());
    await screen.findByRole('button', { name: 'Check result' });
    await waitFor(() => expect(screen.queryByText('Check the goal nets')).not.toBeInTheDocument());
    cleanup(); render(tree());
    expect(await screen.findByText(`Operation: ${operationId}`)).toBeInTheDocument();
    expect(resolveDolaAction).toHaveBeenCalledTimes(1); expect(dolaProjectOutcome).not.toHaveBeenCalled();
    vi.mocked(dolaProjectOutcome).mockResolvedValue(receipt);
    fireEvent.click(screen.getByRole('button', { name: 'Check result' }));
    expect(await screen.findByText(receipt.receipt)).toBeInTheDocument();
    expect(dolaProjectOutcome).toHaveBeenCalledWith(operationId, conversationId, session, expect.any(AbortSignal));
    expect(resolveDolaAction).toHaveBeenCalledTimes(1);
});
it('isolates identifiers and late private receipts across account switches', async () => {
    localStorage.setItem('gk-dola-project-operation:7', JSON.stringify({ operationId, conversationId }));
    const view = render(tree()); let finish!: (v: DolaProjectOutcome) => void;
    vi.mocked(dolaProjectOutcome).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(await screen.findByRole('button', { name: 'Check result' }));
    actor = 8; session = 'another-session'; localStorage.setItem('gk-session-id', session); view.rerender(tree());
    await act(async () => finish(receipt));
    expect(screen.queryByText(receipt.receipt)).not.toBeInTheDocument(); expect(screen.queryByText(`Operation: ${operationId}`)).not.toBeInTheDocument();
    expect(localStorage.getItem('gk-dola-project-operation:7')).not.toBeNull();
    actor = 7; session = 'return-session'; localStorage.setItem('gk-session-id', session); view.rerender(tree());
    expect(await screen.findByText(`Operation: ${operationId}`)).toBeInTheDocument();
});
it('permission loss or conflict removes old preview content and keeps the unresolved operation', async () => {
    vi.mocked(resolveDolaAction).mockRejectedValue({ response: { data: { code: 'DOLA_PROJECT_UNAVAILABLE', error: 'This action is no longer available.' } } });
    fireEvent.click(await propose()); await screen.findByText('This action is no longer available.');
    expect(screen.queryByText('FC Dinamo Tbilisi Academy (synthetic) (#7)')).not.toBeInTheDocument();
    vi.mocked(dolaProjectOutcome).mockRejectedValue({ response: { status: 404 } });
    fireEvent.click(screen.getByRole('button', { name: 'Check result' }));
    await screen.findByText(/result is still unconfirmed or no longer accessible/);
    expect(localStorage.getItem('gk-dola-project-operation:7')).not.toBeNull();
});
it('discard waits for server acknowledgement and does not call confirm', async () => {
    await propose(); vi.mocked(resolveDolaAction).mockResolvedValue({ ...action, state: 'DISCARDED', title: 'Project step review', body: '', details: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(await screen.findByText('Discarded')).toBeInTheDocument();
    expect(resolveDolaAction).toHaveBeenCalledWith(conversationId, operationId, 'discard', session, expect.any(AbortSignal));
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
});
it('a conversational yes retains the exact pending operation and still requires its confirmation button', async () => {
    await propose();
    const reminder = 'Review the exact project step and day change below. Nothing has changed yet. Use Confirm day change to apply it, or Discard.';
    let finish!: (value: DolaAnswer) => void;
    vi.mocked(streamDola).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.change(screen.getByLabelText('Message Agent Dola'), { target: { value: 'yes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(resolveDolaAction).not.toHaveBeenCalled(); expect(screen.queryByText('Completed')).not.toBeInTheDocument();
    await act(async () => finish({ ...answer, requestId: 'followup', answer: reminder, toolsUsed: [] }));
    expect(await screen.findByText(reminder)).toBeInTheDocument();
    const pending = screen.getByRole('button', { name: 'Confirm day change' }).closest('section')!;
    expect(within(pending).getByText('2026-11-03')).toBeInTheDocument();
    expect(resolveDolaAction).not.toHaveBeenCalled(); expect(screen.queryByText('Completed')).not.toBeInTheDocument();
    vi.mocked(resolveDolaAction).mockResolvedValue({ ...action, state: 'COMPLETED', receipt: receipt.receipt });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm day change' }));
    expect(await within(pending).findByText('Completed')).toBeInTheDocument();
    expect(resolveDolaAction).toHaveBeenCalledWith(conversationId, operationId, 'confirm', session, expect.any(AbortSignal));
});
it('a rejected project follow-up clears the retained private preview and performs no mutation', async () => {
    await propose();
    vi.mocked(streamDola).mockRejectedValue({ response: { data: { code: 'DOLA_CONVERSATION_UNAVAILABLE', error: 'This conversation has expired or is unavailable. Start a new conversation.' } } });
    fireEvent.change(screen.getByLabelText('Message Agent Dola'), { target: { value: 'Remind me what that step was' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('This conversation has expired or is unavailable. Start a new conversation.');
    expect(screen.queryByText('FC Dinamo Tbilisi Academy (synthetic) (#7)')).not.toBeInTheDocument();
    expect(screen.queryByText('Check the goal nets')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm day change' })).not.toBeInTheDocument();
    expect(resolveDolaAction).not.toHaveBeenCalled();
});
