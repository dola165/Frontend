import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DolaProvider } from './DolaProvider';
import { AgentDolaPage } from './AgentDolaPage';
import { streamDola, latestDola, clearDola, dolaStatus, dolaWelcome, resolveDolaAction, type DolaAction, type DolaAnswer } from './api';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'wave2-session', user: { id: 7 } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('./api', async importOriginal => {
    const original = await importOriginal<typeof import('./api')>();
    return { ...original, streamDola: vi.fn(), latestDola: vi.fn(), clearDola: vi.fn(), dolaStatus: vi.fn(), dolaWelcome: vi.fn(), resolveDolaAction: vi.fn() };
});
it.each(['confirm', 'discard'] as const)('clears private action details after unavailable %s and preserves the current draft', async decision => {
    const action: DolaAction = { id: '68173ac8-86a7-418a-a496-1e3c98b37e55', kind: 'COACH_UPDATE', state: 'PENDING',
        title: 'Private squad update', body: 'Private coaching instructions.', details: [{ label: 'Squad', value: 'Private squad' }],
        confirmLabel: 'Publish coach update', expiresAt: new Date(Date.now() + 600000).toISOString(), receipt: '',
        destination: { id: 'squad_updates:13', title: 'Coach updates', path: '/squads/13' } };
    vi.mocked(latestDola).mockResolvedValue({ conversationId: privateAnswer.conversationId, expiresAt: new Date(Date.now() + 45 * 60000).toISOString(),
        turns: [{ question: 'Private family question', result: { ...privateAnswer, actions: [action] } }] });
    vi.mocked(resolveDolaAction).mockRejectedValue(unavailable);
    render(<MemoryRouter initialEntries={['/assistant']}><DolaProvider><AgentDolaPage /></DolaProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue last chat' }));
    await screen.findByText(action.body);
    fireEvent.change(screen.getByLabelText('Message Agent Dola'), { target: { value: 'My unsent follow-up' } });
    fireEvent.click(screen.getByRole('button', { name: decision === 'confirm' ? 'Publish coach update' : 'Discard' }));
    await waitFor(() => expect(screen.queryByText(action.body)).not.toBeInTheDocument());
    expect(screen.queryByText(privateAnswer.answer)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Message Agent Dola')).toHaveValue('My unsent follow-up');
    expect(resolveDolaAction).toHaveBeenCalledExactlyOnceWith(privateAnswer.conversationId, action.id, decision, 'wave2-session', expect.any(AbortSignal));
    expect(streamDola).not.toHaveBeenCalled();
});
const privateAnswer: DolaAnswer = {
    conversationId: 'private-conversation', requestId: 'saved-request', answer: 'Private child pickup details.',
    destinations: [], sources: [], toolsUsed: ['read_family_attention'], modelCalls: 2, totalTokens: 50,
};
const unavailable = { response: { status: 404, data: { code: 'DOLA_CONVERSATION_UNAVAILABLE', error: 'This conversation is unavailable. Start a new conversation.' } } };
beforeEach(() => {
    vi.clearAllMocks(); localStorage.setItem('gk-session-id', 'wave2-session');
    vi.mocked(dolaWelcome).mockResolvedValue({ contexts: ['family', 'discover'] });
    vi.mocked(dolaStatus).mockResolvedValue({ name: 'Agent Dola', available: true, mode: 'REVIEWED_ACTIONS_PILOT', maxMessageLength: 2000, capabilities: [] });
    vi.mocked(latestDola).mockResolvedValue({ conversationId: privateAnswer.conversationId, expiresAt: new Date(Date.now() + 45 * 60000).toISOString(), turns: [{ question: 'Private family question', result: privateAnswer }] });
    vi.mocked(streamDola).mockRejectedValue(unavailable);
    vi.mocked(clearDola).mockResolvedValue({} as never);
});
afterEach(cleanup);
it('clears recovered private history after the server rejects its authority and retains the unsent draft', async () => {
    render(<MemoryRouter initialEntries={['/assistant']}><DolaProvider><AgentDolaPage /></DolaProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue last chat' }));
    await screen.findByText(privateAnswer.answer);
    fireEvent.change(screen.getByLabelText('Message Agent Dola'), { target: { value: 'Check training again' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(screen.queryByText(privateAnswer.answer)).not.toBeInTheDocument());
    expect(screen.queryByText('Private family question')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Message Agent Dola')).toHaveValue('Check training again');
    expect(streamDola).toHaveBeenCalledTimes(1);
    expect(resolveDolaAction).not.toHaveBeenCalled();
});
