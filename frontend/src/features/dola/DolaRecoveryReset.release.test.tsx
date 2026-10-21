import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DolaProvider } from './DolaProvider';
import { AgentDolaPage } from './AgentDolaPage';
import { clearDola, dolaStatus, dolaWelcome, latestDola, resolveDolaAction, streamDola, type DolaAction, type DolaAnswer } from './api';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'reset-session', user: { id: 7 } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof import('./api')>(), clearDola: vi.fn(), dolaStatus: vi.fn(), dolaWelcome: vi.fn(), latestDola: vi.fn(), resolveDolaAction: vi.fn(), streamDola: vi.fn() }));
const action: DolaAction = { id: '68173ac8-86a7-418a-a496-1e3c98b37e55', kind: 'COACH_UPDATE', state: 'PENDING', title: 'Private update', body: 'Private coaching instructions.', details: [], confirmLabel: 'Publish coach update', expiresAt: new Date(Date.now() + 600000).toISOString(), receipt: '', destination: { id: 'squad_updates:13', title: 'Coach updates', path: '/squads/13' } };
const old: DolaAnswer = { conversationId: 'old-private', requestId: 'old-request', answer: 'Private child pickup details.', destinations: [], sources: [], toolsUsed: ['read_family_attention'], modelCalls: 2, totalTokens: 50, actions: [action] };
const fresh: DolaAnswer = { ...old, conversationId: 'fresh-conversation', requestId: 'fresh-request', answer: 'Fresh public answer.', actions: [] };
const unavailable = { response: { status: 404, data: { code: 'DOLA_CONVERSATION_UNAVAILABLE', error: 'This conversation is unavailable. Start a new conversation.' } } };
beforeEach(() => {
    vi.resetAllMocks(); localStorage.setItem('gk-session-id', 'reset-session');
    vi.mocked(dolaStatus).mockResolvedValue({ name: 'Agent Dola', available: true, mode: 'REVIEWED_ACTIONS_PILOT', maxMessageLength: 2000, capabilities: [] });
    vi.mocked(dolaWelcome).mockResolvedValue({ contexts: ['coach', 'discover'] });
    vi.mocked(latestDola).mockResolvedValue({ conversationId: old.conversationId, expiresAt: new Date(Date.now() + 45 * 60000).toISOString(), turns: [{ question: 'Old private question', result: old }] });
    vi.mocked(clearDola).mockResolvedValue({} as never);
    vi.mocked(streamDola).mockResolvedValue(fresh);
    vi.mocked(resolveDolaAction).mockRejectedValue(unavailable);
});
afterEach(cleanup);
it.each(['send', 'confirm', 'discard'] as const)('starts a clean usable conversation after authority is unavailable during %s', async trigger => {
    render(<MemoryRouter initialEntries={['/assistant']}><DolaProvider><AgentDolaPage /></DolaProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue last chat' }));
    await screen.findByText(old.answer);
    fireEvent.change(screen.getByLabelText('Message Agent Dola'), { target: { value: 'My editable follow-up' } });
    if (trigger === 'send') {
        vi.mocked(streamDola).mockRejectedValueOnce(unavailable);
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    } else fireEvent.click(screen.getByRole('button', { name: trigger === 'confirm' ? action.confirmLabel : 'Discard' }));
    await waitFor(() => expect(screen.queryByText(old.answer)).not.toBeInTheDocument());
    expect(screen.queryByText(action.body)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Message Agent Dola')).toHaveValue('My editable follow-up');
    const previousCalls = vi.mocked(streamDola).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(clearDola).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('Message Agent Dola'), { target: { value: 'Fresh question' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText(fresh.answer);
    expect(streamDola).toHaveBeenCalledTimes(previousCalls + 1);
    expect(vi.mocked(streamDola).mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ message: 'Fresh question', conversationId: undefined, includePersonalContext: false }));
});
