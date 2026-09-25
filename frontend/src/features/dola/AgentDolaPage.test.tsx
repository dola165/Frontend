import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DolaProvider, DolaLink } from './DolaProvider';
import { AgentDolaPage, DolaDock } from './AgentDolaPage';
import { dolaNavigationState } from './navigation';
import { streamDola, latestDola, clearDola, dolaStatus, dolaWelcome, safeDolaDestination, resolveDolaAction, type DolaAction, type DolaAnswer } from './api';

let session = 'session-a';
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: session, user: { id: 7 } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('./api', async importOriginal => {
    const original = await importOriginal<typeof import('./api')>();
    return { ...original, streamDola: vi.fn(), latestDola: vi.fn(), clearDola: vi.fn(), dolaStatus: vi.fn(), dolaWelcome: vi.fn(), resolveDolaAction: vi.fn() };
});
const answer: DolaAnswer = {
    conversationId: 'conversation-one', requestId: 'request-one', answer: 'Open Parent Hub to see your linked children.',
    destinations: [{ id: 'parent_hub', title: 'Parent Hub', path: '/parent' }], sources: [], toolsUsed: ['offer_destination'], modelCalls: 2, totalTokens: 90,
};
beforeEach(() => {
    vi.clearAllMocks(); vi.mocked(dolaWelcome).mockResolvedValue({ contexts: ['coach', 'discover'] }); vi.mocked(latestDola).mockResolvedValue(null); session = 'session-a'; localStorage.setItem('gk-session-id', session);
    vi.mocked(dolaStatus).mockResolvedValue({ name: 'Agent Dola', available: true, mode: 'READ_ONLY_PILOT', maxMessageLength: 2000, capabilities: [] });
    vi.mocked(streamDola).mockResolvedValue(answer); vi.mocked(clearDola).mockResolvedValue({} as never);
});
afterEach(cleanup);
const page = () => render(<MemoryRouter initialEntries={['/assistant']}><DolaProvider><AgentDolaPage /></DolaProvider></MemoryRouter>);
async function send(text = 'Show Parent Hub') {
    fireEvent.change(screen.getByLabelText('Message Agent Dola'), { target: { value: text } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
}
describe('Agent Dola', () => {
    it('passes the selected venue page as a preference without inferring access', async () => {
        vi.mocked(dolaWelcome).mockResolvedValue({ contexts: ['venue', 'organization', 'discover'] });
        render(<MemoryRouter initialEntries={['/stadiums/133/manage']}><DolaProvider><DolaLink>Open Dola</DolaLink><DolaDock /></DolaProvider></MemoryRouter>);
        fireEvent.click(screen.getByRole('link', { name: 'Open Dola' }));
        await screen.findByRole('button', { name: 'Who is arriving at my venues today?' });
        await send('Who is arriving today?');
        await screen.findByText(answer.answer);
        expect(streamDola).toHaveBeenCalledWith(expect.objectContaining({ venueId: 133, workspaceContext: 'venue', includePersonalContext: false }), session, expect.any(AbortSignal), expect.any(Function));
    });
    it('offers recovery without displaying the old chat until the user continues', async () => {
        vi.mocked(latestDola).mockResolvedValue({ conversationId: answer.conversationId, expiresAt: new Date(Date.now() + 45 * 60000).toISOString(), turns: [{ question: 'Earlier question', result: answer }] });
        page(); await screen.findByRole('button', { name: 'Continue last chat' });
        expect(screen.queryByText(answer.answer)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Continue last chat' }));
        await screen.findByText(answer.answer); expect(screen.getByText('Earlier question')).toBeInTheDocument();
        expect(streamDola).not.toHaveBeenCalled(); expect(screen.getByRole('checkbox')).not.toBeChecked();
    });
    it('does not restore an already expired server snapshot', async () => {
        vi.mocked(latestDola).mockResolvedValue({ conversationId: answer.conversationId, expiresAt: new Date(Date.now() - 1).toISOString(), turns: [{ question: 'Old question', result: answer }] });
        page(); await waitFor(() => expect(screen.queryByText(/Checking availability/)).not.toBeInTheDocument());
        expect(screen.queryByRole('button', { name: 'Continue last chat' })).not.toBeInTheDocument();
        expect(screen.queryByText('Old question')).not.toBeInTheDocument();
    });
    it('answers an intentional search handoff once, without personal context', async () => {
        const state = dolaNavigationState('How do I join a club?', session);
        render(<StrictMode><MemoryRouter initialEntries={[{ pathname: '/assistant', state }]}><DolaProvider><AgentDolaPage /></DolaProvider></MemoryRouter></StrictMode>);
        await screen.findByText(answer.answer);
        expect(streamDola).toHaveBeenCalledTimes(1);
        expect(streamDola).toHaveBeenCalledWith(expect.objectContaining({ message: 'How do I join a club?', requestId: state.dolaQuestion.requestId, includePersonalContext: false }), session, expect.any(AbortSignal), expect.any(Function));
    });
    it('preserves a search question for editing when Dola is unavailable', async () => {
        vi.mocked(dolaStatus).mockResolvedValue({ name: 'Agent Dola', available: false, mode: 'READ_ONLY_PILOT', maxMessageLength: 2000, capabilities: [] });
        render(<MemoryRouter initialEntries={[{ pathname: '/assistant', state: dolaNavigationState('How do I join?', session) }]}><DolaProvider><AgentDolaPage /></DolaProvider></MemoryRouter>);
        await screen.findByText(/not available on this server/);
        expect(screen.getByLabelText('Message Agent Dola')).toHaveValue('How do I join?');
        expect(streamDola).not.toHaveBeenCalled();
    });
    it('does not spend on load or when selecting a suggestion', async () => {
        page(); fireEvent.click(await screen.findByRole('button', { name: 'When is my next squad match?' }));
        expect(screen.getByLabelText('Message Agent Dola')).toHaveValue('When is my next squad match?');
        expect(streamDola).not.toHaveBeenCalled();
    });
    it('keeps personal context off by default and shows verified destination cards', async () => {
        page(); await send();
        expect(await screen.findByRole('link', { name: 'Parent Hub' })).toHaveAttribute('href', '/parent');
        expect(streamDola).toHaveBeenCalledWith(expect.objectContaining({ message: 'Show Parent Hub', includePersonalContext: false }), session, expect.any(AbortSignal), expect.any(Function));
    });
    it('requires an explicit switch for personal reads', async () => {
        page(); fireEvent.click(screen.getByRole('checkbox'));
        await send('What is on my calendar?');
        await screen.findByText(answer.answer);
        expect(streamDola).toHaveBeenCalledWith(expect.objectContaining({ includePersonalContext: true }), session, expect.any(AbortSignal), expect.any(Function));
    });
    it('disables sending if the backend is unavailable', async () => {
        vi.mocked(dolaStatus).mockResolvedValue({ name: 'Agent Dola', available: false, mode: 'READ_ONLY_PILOT', maxMessageLength: 2000, capabilities: [] });
        page(); await screen.findByText(/not available on this server/);
        fireEvent.change(screen.getByLabelText('Message Agent Dola'), { target: { value: 'Hello' } });
        expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled(); expect(streamDola).not.toHaveBeenCalled();
    });
    it('clears server context and resets personal opt-in on a new conversation', async () => {
        page(); fireEvent.click(screen.getByRole('checkbox')); await send(); await screen.findByText(answer.answer);
        fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
        await waitFor(() => expect(clearDola).toHaveBeenCalledWith(answer.conversationId, session, expect.any(AbortSignal)));
        await waitFor(() => expect(screen.queryByText(answer.answer)).not.toBeInTheDocument());
        expect(screen.getByRole('checkbox')).not.toBeChecked();
    });
    it('does not display a late answer after the account changes', async () => {
        let resolve!: (value: DolaAnswer) => void;
        vi.mocked(streamDola).mockReturnValue(new Promise(done => { resolve = done; }));
        const rendered = page(); await send();
        session = 'session-b'; localStorage.setItem('gk-session-id', session);
        rendered.rerender(<MemoryRouter initialEntries={['/assistant']}><DolaProvider><AgentDolaPage /></DolaProvider></MemoryRouter>);
        await act(async () => { resolve(answer); });
        expect(screen.queryByText(answer.answer)).not.toBeInTheDocument();
        expect(screen.getByLabelText('Message Agent Dola')).toHaveValue('');
    });
    it('keeps a failed question editable without automatically retrying', async () => {
        vi.mocked(streamDola).mockRejectedValue({ response: { data: { code: 'DOLA_DAILY_LIMIT', error: 'Daily allowance reached.' }, status: 429 } });
        page(); await send('Explain bookings'); await screen.findByRole('alert');
        expect(screen.getByLabelText('Message Agent Dola')).toHaveValue('Explain bookings'); expect(streamDola).toHaveBeenCalledTimes(1);
    });
    it('never turns arbitrary provider output into clickable links or HTML', async () => {
        vi.mocked(streamDola).mockResolvedValue({ ...answer, answer: '<img src=x onerror=alert(1)>', destinations: [{ id: 'parent_hub', title: 'Unsafe', path: 'https://attacker.test' }] });
        page(); await send(); await screen.findByText('<img src=x onerror=alert(1)>');
        expect(screen.queryByRole('link', { name: 'Unsafe' })).not.toBeInTheDocument(); expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
    it('rejects a valid-looking route with a mismatched semantic ID', () => {
        expect(safeDolaDestination({ id: 'my_schedule', title: 'Go', path: '/account' })).toBe(false);
        expect(safeDolaDestination({ id: 'parent_hub', title: 'Go', path: '/parent' })).toBe(true);
    });
});

const review: DolaAction = { id: '68173ac8-86a7-418a-a496-1e3c98b37e55', kind: 'COACH_UPDATE', state: 'PENDING', title: 'Training cancelled', body: 'Rain today. Please acknowledge.', details: [{ label: 'Squad', value: 'U12 Mixed' }], confirmLabel: 'Publish coach update', expiresAt: new Date(Date.now() + 600000).toISOString(), receipt: '', destination: { id: 'squad_updates:13', title: 'Coach updates', path: '/squads/13' } };
describe('reviewed Dola actions', () => {
    it('shows public challenge effects and opens its exact result only after confirmation', async () => {
        const challenge: DolaAction = { ...review, kind: 'OPEN_CHALLENGE', title: 'U12 friendly', body: 'Development match', details: [{ label: 'Visibility', value: 'Public open challenge' }, { label: 'Format', value: '9_A_SIDE' }] };
        vi.mocked(streamDola).mockResolvedValue({ ...answer, destinations: [], actions: [challenge] });
        vi.mocked(resolveDolaAction).mockResolvedValue({ ...challenge, state: 'COMPLETED', receipt: 'Open challenge published (71).', destination: { id: 'match_challenge:71', title: 'View open challenge', path: '/match-exchange/71' } });
        page(); await send('Create the U12 challenge');
        const button = await screen.findByRole('button', { name: 'Publish open challenge' });
        expect(screen.getByText('Public open challenge')).toBeInTheDocument(); expect(resolveDolaAction).not.toHaveBeenCalled();
        fireEvent.click(button); await screen.findByText('Open challenge published (71).');
        expect(await screen.findByRole('link', { name: 'View open challenge' })).toHaveAttribute('href', '/match-exchange/71');
        expect(resolveDolaAction).toHaveBeenCalledExactlyOnceWith(answer.conversationId, challenge.id, 'confirm', session, expect.any(AbortSignal));
    });
    it('never publishes on generation and submits only the exact reviewed action after a click', async () => {
        vi.mocked(streamDola).mockResolvedValue({ ...answer, actions: [review] });
        vi.mocked(resolveDolaAction).mockResolvedValue({ ...review, state: 'COMPLETED', receipt: 'Coach update published (42). Acknowledgements requested.' });
        page(); await send('Write a coach update for U12 Mixed');
        const button = await screen.findByRole('button', { name: 'Publish coach update' });
        expect(resolveDolaAction).not.toHaveBeenCalled(); expect(screen.getByText(review.body)).toBeInTheDocument();
        fireEvent.click(button);
        await screen.findByText('Coach update published (42). Acknowledgements requested.');
        expect(resolveDolaAction).toHaveBeenCalledExactlyOnceWith(answer.conversationId, review.id, 'confirm', session, expect.any(AbortSignal));
        expect(screen.queryByRole('button', { name: 'Publish coach update' })).not.toBeInTheDocument();
        expect(streamDola).toHaveBeenCalledTimes(1);
    });
    it('expired and superseded drafts have no publish button', async () => {
        vi.mocked(streamDola).mockResolvedValue({ ...answer, actions: [{ ...review, expiresAt: new Date(Date.now() - 1).toISOString() }] });
        page(); await send(); await screen.findByText('Review expired');
        expect(screen.queryByRole('button', { name: 'Publish coach update' })).not.toBeInTheDocument();
        expect(resolveDolaAction).not.toHaveBeenCalled();
    });
    it('draft revision replaces the old confirmation and keeps the new details', async () => {
        vi.mocked(streamDola).mockResolvedValueOnce({ ...answer, actions: [review] }).mockResolvedValueOnce({ ...answer, actions: [{ ...review, id: '18173ac8-86a7-418a-a496-1e3c98b37e55', body: 'Shorter draft.' }] });
        page(); await send(); await screen.findByText(review.body); await send('Make it shorter');
        await screen.findByText('Shorter draft.'); await screen.findByText('Replaced by a newer review');
        expect(screen.getAllByRole('button', { name: 'Publish coach update' })).toHaveLength(1);
        expect(resolveDolaAction).not.toHaveBeenCalled();
    });
    it('does not display a late confirmation after switching accounts', async () => {
        vi.mocked(streamDola).mockResolvedValue({ ...answer, actions: [review] });
        let finish!: (value: DolaAction) => void;
        vi.mocked(resolveDolaAction).mockReturnValue(new Promise(resolve => { finish = resolve; }));
        const rendered = page(); await send(); fireEvent.click(await screen.findByRole('button', { name: 'Publish coach update' }));
        session = 'new-account'; localStorage.setItem('gk-session-id', session);
        rendered.rerender(<MemoryRouter initialEntries={['/assistant']}><DolaProvider><AgentDolaPage /></DolaProvider></MemoryRouter>);
        await act(async () => finish({ ...review, state: 'COMPLETED', receipt: 'Private confirmation' }));
        expect(screen.queryByText('Private confirmation')).not.toBeInTheDocument();
    });
});


describe('workspace welcome', () => {
    it('shows referee starters, switches context without spending, and sends that context', async () => {
        vi.mocked(dolaWelcome).mockResolvedValue({ contexts: ['referee', 'family', 'discover'] });
        page(); await screen.findByRole('button', { name: 'What needs my attention for my children?' });
        expect(screen.queryByRole('button', { name: 'Help me write a coach update.' })).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole('combobox', { name: 'Dola context' }), { target: { value: 'referee' } });
        fireEvent.click(screen.getByRole('button', { name: 'What are my next accepted referee appointments?' }));
        expect(streamDola).not.toHaveBeenCalled();
        await send('Show my referee appointments'); await screen.findByText(answer.answer);
        expect(streamDola).toHaveBeenCalledWith(expect.objectContaining({ workspaceContext: 'referee' }), session, expect.any(AbortSignal), expect.any(Function));
    });
    it('refreshes contexts after focus and removes a revoked role', async () => {
        vi.mocked(dolaWelcome).mockResolvedValue({ contexts: ['referee', 'discover'] });
        page(); await screen.findByRole('button', { name: 'What are my next accepted referee appointments?' });
        vi.mocked(dolaWelcome).mockResolvedValue({ contexts: ['discover'] });
        fireEvent(window, new Event('focus'));
        await screen.findByRole('button', { name: 'Find public volunteering roles.' });
        expect(screen.queryByRole('button', { name: 'What are my next accepted referee appointments?' })).not.toBeInTheDocument();
        expect(streamDola).not.toHaveBeenCalled();
    });
    it('shows a reviewed referee decision and cannot confirm through a suggestion', async () => {
        const action: DolaAction = { ...review, kind: 'REFEREE_DECISION', title: 'Referee invitation', confirmLabel: 'Accept referee appointment', destination: { id: 'referees', path: '/referees/me', title: 'Referee workspace' } };
        vi.mocked(streamDola).mockResolvedValue({ ...answer, actions: [action], followUps: [] });
        vi.mocked(resolveDolaAction).mockResolvedValue({ ...action, state: 'COMPLETED', receipt: 'Appointment accepted.' });
        page(); await send('Accept my referee invitation');
        fireEvent.click(await screen.findByRole('button', { name: 'Accept referee appointment' }));
        await screen.findByText('Appointment accepted.'); expect(resolveDolaAction).toHaveBeenCalledTimes(1);
    });
});
