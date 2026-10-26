import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getMatchHistory, getHistoricalImportOptions, type HistoryMatch } from '../api';
import { ResultSummary } from '../ResultSummary';
import { ScheduleResult } from '../ScheduleResult';
import { getScoreRecord, getScoreSummary, type ScoreSummary } from '../../scores/api';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'session-a' }) }));
vi.mock('../api', async importOriginal => ({ ...(await importOriginal<typeof import('../api')>()), getMatchHistory: vi.fn(), getHistoricalImportOptions: vi.fn() }));
vi.mock('../../scores/api', () => ({ getScoreSummary: vi.fn(), getScoreRecord: vi.fn(), writeScore: vi.fn() }));
vi.mock('../../scores/ExchangeScore', () => ({ ExchangeScore: ({ eventId }: { eventId: number }) => <p>Score card {eventId}</p> }));

const fixture: HistoryMatch = { id: 'event:5', sourceId: 5, source: 'MATCH_EXCHANGE', title: 'Saturday friendly', startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T12:00:00Z', timezone: 'Asia/Tbilisi', homeClubId: 1, homeClubName: 'Home FC', awayClubId: 2, awayClubName: 'Away FC', homeScore: 0, awayScore: 0, resultStatus: 'CONFIRMED', fixtureStatus: 'COMPLETED', legacy: false, detailPath: '/match-exchange/5#result', canRecordResult: true };
const summary = (value: Partial<ScoreSummary>): ScoreSummary => ({ eventId: 5, kind: 'CALENDAR', oneSided: true, status: 'NONE', fixtureStatus: 'SCHEDULED', revision: 0, homeScore: null, awayScore: null, reported: null, disputed: null, official: false, legacy: false, scorePrivate: false, canReadAudit: false, ...value });
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getHistoricalImportOptions).mockResolvedValue({ clubs: [] }); vi.mocked(getMatchHistory).mockResolvedValue({ items: [fixture], total: 1, page: 0, pageSize: 24 }); });

it('keeps a missing score separate from a confirmed goalless draw and an older record', () => {
  const { rerender } = render(<ResultSummary homeScore={null} awayScore={null} status="NONE" />);
  expect(screen.getByText('No score yet')).toBeInTheDocument(); expect(screen.queryByText('0–0')).not.toBeInTheDocument();
  rerender(<ResultSummary homeScore={0} awayScore={0} status="CONFIRMED" />);
  expect(screen.getByLabelText('Score 0–0')).toBeInTheDocument(); expect(screen.getByText('Confirmed')).toBeInTheDocument();
  rerender(<ResultSummary homeScore={2} awayScore={1} status="CONFIRMED" legacy />);
  expect(screen.queryByText('Confirmed')).not.toBeInTheDocument(); expect(screen.getByText('Previously recorded')).toBeInTheDocument();
});

it('names every status in words and shows a reported score as reported, both versions when disputed', () => {
  const { rerender } = render(<ResultSummary status="REPORTED" reported={{ home: 2, away: 1 }} />);
  expect(screen.getByText('2–1')).toBeInTheDocument(); expect(screen.getByText('Reported')).toBeInTheDocument();
  rerender(<ResultSummary status="DISPUTED" reported={{ home: 2, away: 1 }} disputed={{ home: 1, away: 1 }} />);
  expect(screen.getByText('2–1 / 1–1')).toBeInTheDocument(); expect(screen.getByText('Disputed')).toBeInTheDocument();
  rerender(<ResultSummary status="SETTLED" homeScore={1} awayScore={1} />);
  expect(screen.getByText('Settled')).toBeInTheDocument();
  rerender(<ResultSummary status="RECORDED" homeScore={3} awayScore={0} />);
  expect(screen.getByText('Final')).toBeInTheDocument();
  rerender(<ResultSummary status="FINAL" scorePrivate />);
  expect(screen.getByText('Final')).toBeInTheDocument(); expect(screen.queryByText('—')).not.toBeInTheDocument();
});

it('opens a club-calendar match on its own calendar record, with the event’s club at home', async () => {
  vi.mocked(getScoreSummary).mockResolvedValue(summary({ canReadAudit: true }));
  vi.mocked(getScoreRecord).mockReturnValue(new Promise(() => {}));
  render(<ScheduleResult event={{ eventId: 5, eventType: 'MATCH', status: 'SCHEDULED', endsAt: '2020-01-01', canRecordResult: true, opponentClubName: 'Away FC' }} clubId={1} clubName="Home FC" />);
  await waitFor(() => expect(getScoreRecord).toHaveBeenCalledWith({ kind: 'CALENDAR', eventId: 5 }, expect.any(AbortSignal), 'session-a'));
  expect(getScoreSummary).toHaveBeenCalledWith({ kind: 'CALENDAR', eventId: 5 }, expect.any(AbortSignal), 'session-a');
});

it('shows outsiders only the score and its status, and an exchange match its own card', async () => {
  vi.mocked(getScoreSummary).mockResolvedValue(summary({ status: 'FINAL', official: true, homeScore: 2, awayScore: 1, fixtureStatus: 'COMPLETED' }));
  const event = { eventId: 5, eventType: 'MATCH', status: 'COMPLETED', endsAt: '2020-01-01', canRecordResult: false };
  const { rerender } = render(<MemoryRouter><ScheduleResult event={event} clubId={1} /></MemoryRouter>);
  expect(await screen.findByText('Final')).toBeInTheDocument(); expect(screen.getByText('2–1')).toBeInTheDocument();
  expect(getScoreRecord).not.toHaveBeenCalled(); expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(<MemoryRouter><ScheduleResult event={{ ...event, matchExchangeId: 9 }} clubId={1} /></MemoryRouter>);
  expect(screen.getByText('Score card 9')).toBeInTheDocument();
});

it('reads a status it does not know as no score instead of failing', () => {
  render(<ResultSummary status={'PROPOSED' as never} />);
  expect(screen.getByText('No score yet')).toBeInTheDocument();
});
