import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MatchHistoryPage, HistoryCard } from '../../../pages/MatchHistoryPage';
import { getMatchHistory, getHistoricalImportOptions, type HistoryMatch } from '../api';
import { ResultSummary } from '../ResultSummary';
import { ScheduleResult } from '../ScheduleResult';
import { completeClubEventWithResult, correctClubEventResult } from '../../schedule/api';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'session-a' }) }));
vi.mock('../api', async importOriginal => ({ ...(await importOriginal<typeof import('../api')>()), getMatchHistory: vi.fn(), getHistoricalImportOptions: vi.fn() }));
vi.mock('../../schedule/api', () => ({ completeClubEventWithResult: vi.fn(), correctClubEventResult: vi.fn() }));

const fixture: HistoryMatch = { id: 'event:5', sourceId: 5, source: 'MATCH_EXCHANGE', title: 'Saturday friendly', startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T12:00:00Z', timezone: 'Asia/Tbilisi', homeClubId: 1, homeClubName: 'Home FC', awayClubId: 2, awayClubName: 'Away FC', homeScore: 0, awayScore: 0, resultStatus: 'CONFIRMED', fixtureStatus: 'COMPLETED', legacy: false, detailPath: '/match-exchange/5#result', canRecordResult: true };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getHistoricalImportOptions).mockResolvedValue({ clubs: [] }); vi.mocked(getMatchHistory).mockResolvedValue({ items: [fixture], total: 1, page: 0, pageSize: 24 }); });

it('keeps missing results separate from a confirmed goalless draw and legacy provenance', () => {
  const { rerender } = render(<ResultSummary homeScore={null} awayScore={null} status="NONE" />);
  expect(screen.getByText('Result not recorded')).toBeInTheDocument(); expect(screen.queryByText('0 – 0')).not.toBeInTheDocument();
  rerender(<ResultSummary homeScore={0} awayScore={0} status="CONFIRMED" />);
  expect(screen.getByLabelText('Score 0 to 0')).toBeInTheDocument(); expect(screen.getByText('Confirmed result')).toBeInTheDocument();
  rerender(<ResultSummary homeScore={2} awayScore={1} status="CONFIRMED" legacy />);
  expect(screen.queryByText('Confirmed result')).not.toBeInTheDocument(); expect(screen.getByText(/Confirmation evidence is unavailable/)).toBeInTheDocument();
});

it('shows tournament byes and unscheduled dates without inventing a score or kickoff', () => {
  render(<MemoryRouter><HistoryCard match={{ ...fixture, source: 'TOURNAMENT', startsAt: null, endsAt: null, homeScore: null, awayScore: null, resultStatus: 'BYE', detailPath: '/tournaments/8?fixtureId=5' }} upcoming={false} /></MemoryRouter>);
  expect(screen.getByText('Date to be confirmed')).toBeInTheDocument(); expect(screen.getByText(/advances without a match/)).toBeInTheDocument(); expect(screen.queryByText('Result not recorded')).not.toBeInTheDocument();
});

it('preserves Dola/team filters, switches period with page reset and follows the canonical result path', async () => {
  render(<MemoryRouter initialEntries={['/match-history?period=NEEDS_RESULT&mine=true&clubId=1&squadId=7&q=friendly&page=2']}><MatchHistoryPage /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: /Review result/ })).toHaveAttribute('href', '/match-exchange/5#result');
  expect(getMatchHistory).toHaveBeenCalledWith(expect.stringContaining('period=NEEDS_RESULT'), expect.any(AbortSignal), 'session-a');
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  await waitFor(() => { const query = new URLSearchParams(vi.mocked(getMatchHistory).mock.calls.at(-1)![0]); expect(query.get('period')).toBe('HISTORY'); expect(query.get('page')).toBe('0'); expect(query.get('mine')).toBe('true'); expect(query.get('clubId')).toBe('1'); expect(query.get('squadId')).toBe('7'); expect(query.get('q')).toBe('friendly'); });
});

it('retains actionable error and retry instead of stale history when the request fails', async () => {
  vi.mocked(getMatchHistory).mockRejectedValueOnce(new Error('offline'));
  render(<MemoryRouter><MatchHistoryPage /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load match history');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Saturday friendly')).toBeInTheDocument();
});

it('requires two explicit scores and a reason when recovering a completed legacy result', async () => {
  const onSaved = vi.fn();
  render(<ScheduleResult event={{ eventId: 5, eventType: 'MATCH', status: 'COMPLETED', endsAt: '2020-01-01', canRecordResult: true, opponentClubId: 2 }} clubId={1} clubName="Home FC" onSaved={onSaved} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add or correct result' }));
  const save = screen.getByRole('button', { name: 'Save result' });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Home FC score' }), { target: { value: '0' } });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Away team score' }), { target: { value: '0' } });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for result update' }), { target: { value: 'Recovered signed match record' } });
  fireEvent.click(save);
  await waitFor(() => expect(correctClubEventResult).toHaveBeenCalledWith(1, 5, { homeScore: 0, awayScore: 0, winnerClubId: null, reason: 'Recovered signed match record' }));
  expect(completeClubEventWithResult).not.toHaveBeenCalled(); expect(onSaved).toHaveBeenCalled();
});

it('never exposes a calendar score editor for an exchange match or an ordinary viewer', () => {
  const event = { eventId: 5, eventType: 'MATCH', status: 'COMPLETED', endsAt: '2020-01-01', canRecordResult: true, matchExchangeId: 5 };
  const { rerender } = render(<MemoryRouter><ScheduleResult event={event} clubId={1} /></MemoryRouter>);
  expect(screen.getByRole('link')).toHaveAttribute('href', '/match-exchange/5#result');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(<MemoryRouter><ScheduleResult event={{ ...event, canRecordResult: false, matchExchangeId: null }} clubId={1} /></MemoryRouter>);
  expect(within(document.body).queryByRole('button')).not.toBeInTheDocument();
});

it('routes an away reporting club correction through the server-projected club authority', async () => {
  render(<ScheduleResult event={{ eventId: 5, eventType: 'MATCH', status: 'COMPLETED', endsAt: '2020-01-01', canRecordResult: true, opponentClubId: 2, resultClubId: 2 }} clubId={1} clubName="Home FC" />);
  fireEvent.click(screen.getByRole('button', { name: 'Add or correct result' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Home FC score' }), { target: { value: '0' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Away team score' }), { target: { value: '2' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for result update' }), { target: { value: 'Checked club archive' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save result' }));
  await waitFor(() => expect(correctClubEventResult).toHaveBeenCalledWith(2, 5, { homeScore: 0, awayScore: 2, winnerClubId: 2, reason: 'Checked club archive' }));
});
