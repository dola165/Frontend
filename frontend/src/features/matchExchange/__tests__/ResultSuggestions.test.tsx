import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResultSuggestionsPanel } from '../ResultSuggestionsPanel';
import { MatchResultSection } from '../MatchResultSection';
import { getResultSuggestions, suggestMatchResult, reviewResultSuggestion, type Match, type ResultSuggestions, type ResultSuggestion } from '../api';
import { getScoreRecord, getScoreSummary, type ScoreRecord, type ScoreSummary } from '../../scores/api';

let sessionId = 'session-a';
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId }) }));
vi.mock('../api', async importOriginal => ({ ...(await importOriginal<typeof import('../api')>()), getResultSuggestions: vi.fn(), suggestMatchResult: vi.fn(), reviewResultSuggestion: vi.fn() }));
vi.mock('../../scores/api', () => ({ getScoreSummary: vi.fn(), getScoreRecord: vi.fn(), writeScore: vi.fn() }));
const match = { event_id: 12, club_name: 'Home FC', opponent_name: 'Away FC', ends_at_iso: '2020-01-01', event_status: 'COMPLETED' } as Match;
const row: ResultSuggestion = { id: 8, homeScore: 2, awayScore: 1, note: 'Recorded on the scorecard', evidenceUrl: 'https://example.org/report', status: 'PENDING', revision: 1, createdAt: '2026-09-01T12:00:00Z', reviewedAt: null, adoptedResultRevision: null };
const envelope = (override: Partial<ResultSuggestions> = {}): ResultSuggestions => ({ eventId: 12, resultRevision: 3, canSuggest: true, canReview: false, reviewableRoles: [], adoptableRoles: [], ownSuggestions: [], suggestions: [], pendingCount: 0, page: 0, hasMore: false, ...override });
const summary = (value: Partial<ScoreSummary>): ScoreSummary => ({ eventId: 12, kind: 'EXCHANGE', oneSided: false, status: 'NONE', fixtureStatus: 'COMPLETED', revision: 3, homeScore: null, awayScore: null, reported: null, disputed: null, official: false, legacy: false, scorePrivate: false, canReadAudit: false, ...value });
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
  expect(await screen.findByText('Awaiting review')).toBeInTheDocument(); expect(screen.queryByText('Confirmed')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Suggest result' })).not.toBeInTheDocument();
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

it('adopts as the first report and never claims final confirmation', async () => {
  vi.mocked(getResultSuggestions).mockResolvedValue(envelope({ canSuggest: false, canReview: true, reviewableRoles: ['AWAY'], adoptableRoles: ['AWAY'], suggestions: [row], pendingCount: 1 }));
  vi.mocked(reviewResultSuggestion).mockResolvedValue(envelope({ canSuggest: false, canReview: true, reviewableRoles: ['AWAY'], resultRevision: 4 }));
  render(<ResultSuggestionsPanel match={match} onChanged={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Review suggestion' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for review decision' }), { target: { value: 'Checked signed scorecard' } });
  fireEvent.click(screen.getByRole('button', { name: 'Report this score' }));
  expect(await screen.findByText(/The other side can confirm or dispute it/)).toBeInTheDocument();
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
  vi.mocked(getScoreSummary).mockResolvedValue(summary({ status: 'DISPUTED', reported: { home: 2, away: 1 }, disputed: { home: 1, away: 1 } }));
  render(<MemoryRouter><MatchResultSection match={match} reload={vi.fn()} /></MemoryRouter>);
  expect(await screen.findByText('Disputed')).toBeInTheDocument();
  expect(getScoreRecord).not.toHaveBeenCalled(); expect(screen.queryByText('History')).not.toBeInTheDocument();
});

it('clears the previous account’s own suggestion immediately on a session change', async () => {
  vi.mocked(getResultSuggestions).mockResolvedValueOnce(envelope({ ownSuggestions: [row], canSuggest: false })).mockImplementationOnce(() => new Promise(() => {}));
  const { rerender } = render(<ResultSuggestionsPanel match={match} onChanged={vi.fn()} />);
  expect(await screen.findByText('Recorded on the scorecard')).toBeInTheDocument();
  sessionId = 'session-b'; rerender(<ResultSuggestionsPanel match={match} onChanged={vi.fn()} />);
  expect(screen.queryByText('Recorded on the scorecard')).not.toBeInTheDocument();
});

it('shows the adopted suggestion once, as the first report', async () => {
  const record = (value: Partial<ScoreRecord>): ScoreRecord => ({ eventId: 12, kind: 'EXCHANGE', oneSided: false, status: 'NONE', fixtureStatus: 'COMPLETED', revision: 3, homeScore: null, awayScore: null, official: false, legacy: false,
    reported: null, disputed: null, settled: null, responders: [], confirmations: [], settler: null, deadlines: { refereeOnlyUntil: null, disputeUntil: null, correctUntil: null },
    permissions: { parties: ['HOME'], report: ['HOME'], respond: [], settle: [], correct: [] }, history: [], ...value });
  const initial = record({});
  const adopted = record({ status: 'REPORTED', revision: 4, reported: { homeScore: 2, awayScore: 1, side: 'HOME', at: '2020-01-01T12:00:00Z' }, responders: ['AWAY'],
    deadlines: { refereeOnlyUntil: null, disputeUntil: '2099-01-01T00:00:00Z', correctUntil: null }, permissions: { parties: ['HOME'], report: [], respond: [], settle: [], correct: [] } });
  vi.mocked(getScoreSummary).mockResolvedValueOnce(summary({ canReadAudit: true })).mockResolvedValue(summary({ status: 'REPORTED', revision: 4, reported: { home: 2, away: 1 }, canReadAudit: true }));
  vi.mocked(getScoreRecord).mockResolvedValueOnce(initial).mockResolvedValue(adopted);
  vi.mocked(getResultSuggestions).mockResolvedValueOnce(envelope({ canSuggest: false, canReview: true, reviewableRoles: ['HOME'], adoptableRoles: ['HOME'], suggestions: [row], pendingCount: 1 })).mockResolvedValue(envelope({ resultRevision: 4, canSuggest: false, canReview: true, reviewableRoles: ['HOME'] }));
  vi.mocked(reviewResultSuggestion).mockResolvedValue(envelope({ resultRevision: 4, canSuggest: false, canReview: true, reviewableRoles: ['HOME'] }));
  render(<MemoryRouter><MatchResultSection match={match} reload={vi.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Review suggestion' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for review decision' }), { target: { value: 'Verified scorecard' } });
  fireEvent.click(screen.getByRole('button', { name: 'Report this score' }));
  expect(await screen.findByText('Reported by Home FC', { exact: false })).toBeInTheDocument();
  expect(screen.getByText('Waiting for Away FC to confirm')).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { name: 'Score' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Report score' })).not.toBeInTheDocument();
});
