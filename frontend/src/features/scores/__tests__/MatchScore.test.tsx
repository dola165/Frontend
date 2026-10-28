import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MatchScore } from '../MatchScore';
import { getScoreRecord, writeScore, type ScoreRecord } from '../api';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'session-a' }) }));
vi.mock('../../matchExchange/hooks', () => ({ useClock: () => Date.parse('2026-10-26T12:00:00Z') }));
vi.mock('../api', () => ({ getScoreRecord: vi.fn(), writeScore: vi.fn() }));

const teams = { home: { name: 'Dinamo' }, away: { name: 'Saburtalo' } };
const record = (value: Partial<ScoreRecord>): ScoreRecord => ({ eventId: 12, kind: 'EXCHANGE', oneSided: false, status: 'NONE', fixtureStatus: 'COMPLETED', revision: 0, homeScore: null, awayScore: null, official: false, legacy: false,
  reported: null, disputed: null, settled: null, responders: [], confirmations: [], settler: null, deadlines: { refereeOnlyUntil: null, disputeUntil: null, correctUntil: null },
  permissions: { parties: [], report: [], respond: [], settle: [], correct: [] }, history: [], ...value });
const reported = record({ status: 'REPORTED', revision: 1, reported: { homeScore: 2, awayScore: 1, side: 'HOME', at: '2026-10-26T10:00:00Z' }, responders: ['AWAY'],
  deadlines: { refereeOnlyUntil: null, disputeUntil: '2026-10-27T19:30:00Z', correctUntil: null },
  history: [{ id: 1, action: 'REPORT', actorId: 4, actorName: 'Nika B.', side: 'HOME', homeScore: 2, awayScore: 1, previousHomeScore: null, previousAwayScore: null, previousStatus: 'NONE', status: 'REPORTED', reason: null, createdAt: '2026-10-26T10:00:00Z', revision: 1 }] });
beforeEach(() => vi.clearAllMocks());

it('reports a score with two numbers under the record’s own revision and side', async () => {
  vi.mocked(getScoreRecord).mockResolvedValue(record({ permissions: { parties: ['HOME'], report: ['HOME'], respond: [], settle: [], correct: [] } }));
  vi.mocked(writeScore).mockResolvedValue({ ...reported, permissions: { parties: ['HOME'], report: [], respond: [], settle: [], correct: [] } });
  render(<MatchScore eventId={12} {...teams} />);
  fireEvent.change(await screen.findByRole('textbox', { name: 'Goals for Dinamo' }), { target: { value: '2' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Goals for Saburtalo' }), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Report score' }));
  await waitFor(() => expect(writeScore).toHaveBeenCalledWith({ kind: 'EXCHANGE', eventId: 12 }, { action: 'report', body: { homeScore: 2, awayScore: 1, side: 'HOME', revision: 0, requestId: expect.any(String) } }, expect.any(AbortSignal), 'session-a'));
  expect(await screen.findByText('Reported by Dinamo · Can be disputed for 31 h')).toBeInTheDocument();
  expect(screen.getByText('Waiting for Saburtalo to confirm')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /edit|correct/i })).not.toBeInTheDocument();
});

it('lets the other club confirm, or dispute only with a different score of its own', async () => {
  vi.mocked(getScoreRecord).mockResolvedValue({ ...reported, permissions: { parties: ['AWAY'], report: [], respond: ['AWAY'], settle: [], correct: [] } });
  vi.mocked(writeScore).mockResolvedValue(record({ status: 'DISPUTED', revision: 2 }));
  render(<MatchScore eventId={12} {...teams} />);
  expect(await screen.findByText('Is 2–1 right?')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Dispute with my score' }));
  const send = screen.getByRole('button', { name: 'Send my score' });
  expect(send).toBeDisabled();
  expect(screen.getByText('That is their score too. Confirm it instead.')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Goals for Dinamo' }), { target: { value: '1' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Note (optional)' }), { target: { value: 'Second goal was offside' } });
  fireEvent.click(send);
  await waitFor(() => expect(writeScore).toHaveBeenCalledWith({ kind: 'EXCHANGE', eventId: 12 }, { action: 'dispute', body: { homeScore: 1, awayScore: 1, side: 'AWAY', note: 'Second goal was offside', revision: 1, requestId: expect.any(String) } }, expect.any(AbortSignal), 'session-a'));
});

it('shows both versions of a friendly dispute that nobody can settle', async () => {
  vi.mocked(getScoreRecord).mockResolvedValue({ ...reported, status: 'DISPUTED', disputed: { homeScore: 1, awayScore: 1, side: 'AWAY', at: '2026-10-26T11:00:00Z' }, permissions: { parties: ['HOME'], report: [], respond: [], settle: [], correct: [] } });
  render(<MatchScore eventId={12} {...teams} />);
  expect(await screen.findByText('Dinamo\'s score')).toBeInTheDocument();
  expect(screen.getByText('Saburtalo\'s score')).toBeInTheDocument();
  expect(screen.getByText('No referee or organiser can settle this friendly, so both scores stay.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Settle' })).not.toBeInTheDocument();
});

it('lets the referee settle with a corrected score and a required reason', async () => {
  vi.mocked(getScoreRecord).mockResolvedValue({ ...reported, status: 'DISPUTED', revision: 2, settler: 'REFEREE', disputed: { homeScore: 1, awayScore: 1, side: 'AWAY', at: '2026-10-26T11:00:00Z' }, permissions: { parties: ['REFEREE'], report: [], respond: [], settle: ['REFEREE'], correct: [] } });
  vi.mocked(writeScore).mockResolvedValue(record({ status: 'SETTLED', revision: 3, official: true, homeScore: 3, awayScore: 1 }));
  render(<MatchScore eventId={12} {...teams} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Settle' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Another score' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Goals for Dinamo' }), { target: { value: '3' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Goals for Saburtalo' }), { target: { value: '1' } });
  const settle = screen.getByRole('button', { name: 'Settle score' });
  expect(settle).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), { target: { value: 'Match report shows 3–1' } });
  fireEvent.click(settle);
  await waitFor(() => expect(writeScore).toHaveBeenCalledWith({ kind: 'EXCHANGE', eventId: 12 }, { action: 'settle', body: { settlement: 'CORRECTED', homeScore: 3, awayScore: 1, side: 'REFEREE', reason: 'Match report shows 3–1', revision: 2, requestId: expect.any(String) } }, expect.any(AbortSignal), 'session-a'));
  expect(await screen.findByText('Settled')).toBeInTheDocument();
});

it('lists who did what, when and why under History', async () => {
  vi.mocked(getScoreRecord).mockResolvedValue({ ...reported, permissions: { parties: ['HOME'], report: [], respond: [], settle: [], correct: [] } });
  render(<MatchScore eventId={12} {...teams} />);
  fireEvent.click(await screen.findByText('History'));
  const history = screen.getByRole('listitem');
  expect(history).toHaveTextContent('Reported 2–1');
  expect(screen.getByText(/Nika B\. · Dinamo/)).toBeInTheDocument();
});

it('reloads instead of overwriting when the record moved on meanwhile', async () => {
  vi.mocked(getScoreRecord).mockResolvedValueOnce({ ...reported, permissions: { parties: ['AWAY'], report: [], respond: ['AWAY'], settle: [], correct: [] } }).mockResolvedValue({ ...reported, status: 'CONFIRMED', revision: 2, official: true, homeScore: 2, awayScore: 1 });
  vi.mocked(writeScore).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { code: 'RECORD_STALE' } } });
  render(<MatchScore eventId={12} {...teams} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
  expect(await screen.findByText('The score changed meanwhile. This is the latest.')).toBeInTheDocument();
  expect(await screen.findByText('Confirmed')).toBeInTheDocument();
  expect(writeScore).toHaveBeenCalledTimes(1);
});

it('lets the club correct a one-sided calendar score for 48 h, with a reason, through the calendar address', async () => {
  const final = record({ kind: 'CALENDAR', oneSided: true, status: 'FINAL', official: true, homeScore: 3, awayScore: 0, revision: 1,
    reported: { homeScore: 3, awayScore: 0, side: 'HOME', at: '2026-10-26T10:00:00Z' }, deadlines: { refereeOnlyUntil: null, disputeUntil: null, correctUntil: '2026-10-28T10:30:00Z' },
    permissions: { parties: ['HOME'], report: [], respond: [], settle: [], correct: ['HOME'] } });
  vi.mocked(getScoreRecord).mockResolvedValue(final);
  vi.mocked(writeScore).mockResolvedValue({ ...final, revision: 2, homeScore: 3, awayScore: 1 });
  render(<MatchScore kind="CALENDAR" eventId={40} {...teams} />);
  expect(await screen.findByText('Reported by Dinamo · Can be corrected for 46 h')).toBeInTheDocument();
  expect(getScoreRecord).toHaveBeenCalledWith({ kind: 'CALENDAR', eventId: 40 }, expect.any(AbortSignal), 'session-a');
  fireEvent.click(screen.getByRole('button', { name: 'Correct the score' }));
  const save = screen.getByRole('button', { name: 'Save correction' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Goals for Saburtalo' }), { target: { value: '1' } });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), { target: { value: 'Late goal missed' } });
  fireEvent.click(save);
  await waitFor(() => expect(writeScore).toHaveBeenCalledWith({ kind: 'CALENDAR', eventId: 40 }, { action: 'correct', body: { homeScore: 3, awayScore: 1, side: 'HOME', reason: 'Late goal missed', revision: 1, requestId: expect.any(String) } }, expect.any(AbortSignal), 'session-a'));
});

it('never offers a correction for a two-sided score', async () => {
  vi.mocked(getScoreRecord).mockResolvedValue({ ...reported, status: 'FINAL', official: true, homeScore: 2, awayScore: 1, permissions: { parties: ['HOME'], report: [], respond: [], settle: [], correct: [] } });
  render(<MatchScore eventId={12} {...teams} />);
  expect(await screen.findByText('Final')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Correct the score' })).not.toBeInTheDocument();
});

it('tells the clubs’ staff why a score is private, and links an unknown age group to that squad', async () => {
  const privateFinal = { ...reported, status: 'FINAL' as const, official: true, homeScore: 2, awayScore: 1 };
  vi.mocked(getScoreRecord).mockResolvedValue({ ...privateFinal, hiddenReason: 'AGE_UNKNOWN', ageUnknownSquadIds: [41], permissions: { parties: ['AWAY'], report: [], respond: [], settle: [], correct: [] } });
  const { unmount } = render(<MemoryRouter><MatchScore eventId={12} home={{ name: 'Dinamo', clubId: 1 }} away={{ name: 'Saburtalo', clubId: 7 }} /></MemoryRouter>);
  expect(await screen.findByText(/Only your club sees this/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Set the age group' })).toHaveAttribute('href', '/clubs/7/office?tab=squads&squad=41&edit=1');
  unmount();
  vi.mocked(getScoreRecord).mockResolvedValue({ ...privateFinal, hiddenReason: 'UNDER_ELEVEN', ageUnknownSquadIds: [] });
  render(<MemoryRouter><MatchScore eventId={12} {...teams} /></MemoryRouter>);
  expect(await screen.findByText('Under-11 results are private to the two clubs and their families.')).toBeInTheDocument();
});

it('says nothing about privacy to anyone the server tells no reason', async () => {
  vi.mocked(getScoreRecord).mockResolvedValue({ ...reported, hiddenReason: null, ageUnknownSquadIds: [] });
  render(<MemoryRouter><MatchScore eventId={12} {...teams} /></MemoryRouter>);
  expect(await screen.findByText(/Reported by Dinamo/)).toBeInTheDocument();
  expect(screen.queryByText(/private|Only your club/)).not.toBeInTheDocument();
});
