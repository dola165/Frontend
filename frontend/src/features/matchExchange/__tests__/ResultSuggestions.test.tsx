import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResultSuggestionsPanel } from '../ResultSuggestionsPanel';
import { MatchResultSection } from '../MatchResultSection';
import { getResultSuggestions, suggestMatchResult, reviewResultSuggestion, getPublicMatchResult, getMatchResult, type Match, type ResultSuggestions, type ResultSuggestion } from '../api';

let sessionId = 'session-a';
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId }) }));
vi.mock('../api', async importOriginal => ({ ...(await importOriginal<typeof import('../api')>()), getResultSuggestions: vi.fn(), suggestMatchResult: vi.fn(), reviewResultSuggestion: vi.fn(), getPublicMatchResult: vi.fn(), getMatchResult: vi.fn() }));
const match = { event_id: 12, club_name: 'Home FC', opponent_name: 'Away FC', ends_at_iso: '2020-01-01', event_status: 'COMPLETED' } as Match;
const row: ResultSuggestion = { id: 8, homeScore: 2, awayScore: 1, note: 'Recorded on the scorecard', evidenceUrl: 'https://example.org/report', status: 'PENDING', revision: 1, createdAt: '2026-09-01T12:00:00Z', reviewedAt: null, adoptedResultRevision: null };
const envelope = (override: Partial<ResultSuggestions> = {}): ResultSuggestions => ({ eventId: 12, resultRevision: 3, canSuggest: true, canReview: false, reviewableRoles: [], adoptableRoles: [], ownSuggestions: [], suggestions: [], pendingCount: 0, page: 0, hasMore: false, ...override });
beforeEach(() => { vi.clearAllMocks(); sessionId = 'session-a'; vi.mocked(getResultSuggestions).mockResolvedValue(envelope()); });

it('sends an explicit zero-zero suggestion with evidence, revision and idempotency key without confirming it', async () => {
  vi.mocked(suggestMatchResult).mockResolvedValue(envelope({ canSuggest: false, ownSuggestions: [{ ...row, homeScore: 0, awayScore: 0 }] }));
  render(<ResultSuggestionsPanel match={match} onChanged={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Suggest result' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Home FC score' }), { target: { value: '0' } });
  expect(screen.getByRole('button', { name: 'Send suggestion' })).toBeDisabled();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Away FC score' }), { target: { value: '0' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Supporting link (optional)' }), { target: { value: 'https://example.org/report' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }));
  await waitFor(() => expect(suggestMatchResult).toHaveBeenCalledWith(12, expect.objectContaining({ homeScore: 0, awayScore: 0, evidenceUrl: 'https://example.org/report', revision: 3, requestId: expect.any(String) }), expect.any(AbortSignal), 'session-a'));
  expect(await screen.findByText('Awaiting review')).toBeInTheDocument(); expect(screen.queryByText('Confirmed result')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Suggest result' })).not.toBeInTheDocument();
});

it('offers only server-authorized review actions and requires a reason', async () => {
  vi.mocked(getResultSuggestions).mockResolvedValue(envelope({ canSuggest: false, canReview: true, reviewableRoles: ['HOME'], adoptableRoles: [], suggestions: [row], pendingCount: 1 }));
  vi.mocked(reviewResultSuggestion).mockResolvedValue(envelope({ canSuggest: false, canReview: true, reviewableRoles: ['HOME'] }));
  render(<ResultSuggestionsPanel match={match} onChanged={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Review suggestion' }));
  expect(screen.queryByRole('button', { name: 'Adopt as proposed score' })).not.toBeInTheDocument();
  const dismiss = screen.getByRole('button', { name: 'Dismiss suggestion' }); expect(dismiss).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for review decision' }), { target: { value: 'Scorecard relates to another match' } }); fireEvent.click(dismiss);
  await waitFor(() => expect(reviewResultSuggestion).toHaveBeenCalledWith(12, 8, expect.objectContaining({ action: 'DISMISS', side: 'HOME', reason: 'Scorecard relates to another match', revision: 3, suggestionRevision: 1 }), expect.any(AbortSignal), 'session-a'));
});

it('adopts through a proposed score and never claims final confirmation', async () => {
  vi.mocked(getResultSuggestions).mockResolvedValue(envelope({ canSuggest: false, canReview: true, reviewableRoles: ['AWAY'], adoptableRoles: ['AWAY'], suggestions: [row], pendingCount: 1 }));
  vi.mocked(reviewResultSuggestion).mockResolvedValue(envelope({ canSuggest: false, canReview: true, reviewableRoles: ['AWAY'], resultRevision: 4 }));
  render(<ResultSuggestionsPanel match={match} onChanged={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Review suggestion' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for review decision' }), { target: { value: 'Checked signed scorecard' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adopt as proposed score' }));
  expect(await screen.findByText(/Required confirmations still apply/)).toBeInTheDocument();
  expect(reviewResultSuggestion).toHaveBeenCalledWith(12, 8, expect.objectContaining({ action: 'ADOPT', side: 'AWAY' }), expect.any(AbortSignal), 'session-a');
});

it('refreshes after a revision conflict without replaying the suggestion', async () => {
  vi.mocked(suggestMatchResult).mockRejectedValue({ isAxiosError: true, response: { status: 409 } });
  render(<ResultSuggestionsPanel match={match} onChanged={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Suggest result' }));
  for (const input of screen.getAllByRole('spinbutton')) fireEvent.change(input, { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }));
  expect(await screen.findByText(/Review the latest version/)).toBeInTheDocument();
  await waitFor(() => expect(getResultSuggestions).toHaveBeenCalledTimes(2)); expect(suggestMatchResult).toHaveBeenCalledTimes(1);
});

it('renders a public disputed result without fetching private audit or suggestions by other viewers', async () => {
  vi.mocked(getPublicMatchResult).mockResolvedValue({ eventId: 12, status: 'DISPUTED', fixtureStatus: 'COMPLETED', revision: 3, homeScore: 2, awayScore: 1, official: false, legacy: false, canReadAudit: false });
  render(<MemoryRouter><MatchResultSection match={match} reload={vi.fn()} /></MemoryRouter>);
  expect(await screen.findByText('Disputed · under review')).toBeInTheDocument();
  expect(getMatchResult).not.toHaveBeenCalled(); expect(screen.queryByText('Result history')).not.toBeInTheDocument();
});

it('clears the previous account’s own suggestion immediately on a session change', async () => {
  vi.mocked(getResultSuggestions).mockResolvedValueOnce(envelope({ ownSuggestions: [row], canSuggest: false })).mockImplementationOnce(() => new Promise(() => {}));
  const { rerender } = render(<ResultSuggestionsPanel match={match} onChanged={vi.fn()} />);
  expect(await screen.findByText('Recorded on the scorecard')).toBeInTheDocument();
  sessionId = 'session-b'; rerender(<ResultSuggestionsPanel match={match} onChanged={vi.fn()} />);
  expect(screen.queryByText('Recorded on the scorecard')).not.toBeInTheDocument();
});

it('replaces the staff result exactly once after adopting a suggestion', async () => {
  const authority = { roles: ['HOME' as const], canPropose: true, canCorrect: false, canDispute: false, confirmableRoles: [], correctableRoles: [] };
  const initial = { eventId: 12, status: 'NONE' as const, fixtureStatus: 'COMPLETED' as const, revision: 3, homeScore: null, awayScore: null, proposalSide: null, requiredConfirmations: [], confirmations: [], legacy: false, authority, history: [] };
  const adopted = { ...initial, status: 'PROPOSED' as const, revision: 4, homeScore: 2, awayScore: 1, proposalSide: 'HOME' as const, requiredConfirmations: ['AWAY' as const], authority: { ...authority, canPropose: false } };
  vi.mocked(getPublicMatchResult).mockResolvedValueOnce({ ...initial, official: false, canReadAudit: true }).mockResolvedValue({ ...adopted, official: false, canReadAudit: true });
  vi.mocked(getMatchResult).mockResolvedValueOnce(initial).mockResolvedValue(adopted);
  vi.mocked(getResultSuggestions).mockResolvedValueOnce(envelope({ canSuggest: false, canReview: true, reviewableRoles: ['HOME'], adoptableRoles: ['HOME'], suggestions: [row], pendingCount: 1 })).mockResolvedValue(envelope({ resultRevision: 4, canSuggest: false, canReview: true, reviewableRoles: ['HOME'] }));
  vi.mocked(reviewResultSuggestion).mockResolvedValue(envelope({ resultRevision: 4, canSuggest: false, canReview: true, reviewableRoles: ['HOME'] }));
  render(<MemoryRouter><MatchResultSection match={match} reload={vi.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Review suggestion' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for review decision' }), { target: { value: 'Verified scorecard' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adopt as proposed score' }));
  expect(await screen.findByText('Proposed score: 2 – 1')).toBeInTheDocument();
  expect(document.querySelectorAll('#result')).toHaveLength(1);
  expect(screen.getAllByRole('heading', { name: 'Match result' })).toHaveLength(1);
  expect(screen.queryByText('No result has been proposed.')).not.toBeInTheDocument();
});
