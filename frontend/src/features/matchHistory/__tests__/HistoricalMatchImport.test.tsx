import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HistoricalMatchImport } from '../HistoricalMatchImport';
import { getHistoricalImportOptions, searchHistoricalOpponents, importHistoricalMatch } from '../api';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ sessionId: 'session-a' }) }));
vi.mock('../api', async importOriginal => ({ ...(await importOriginal<typeof import('../api')>()), getHistoricalImportOptions: vi.fn(), searchHistoricalOpponents: vi.fn(), importHistoricalMatch: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getHistoricalImportOptions).mockResolvedValue({ clubs: [{ id: 1, name: 'My Club', squads: [{ id: 7, name: 'U16' }] }] });
  vi.mocked(searchHistoricalOpponents).mockResolvedValue({ content: [{ id: 2, name: 'Opponents' }], totalElements: 1 });
  vi.mocked(importHistoricalMatch).mockResolvedValue({ eventId: 90, detailPath: '/calendar?eventId=90', historicalImport: true, resultStatus: 'RECORDED', homeScore: 0, awayScore: 2 });
});

async function fill(away = false) {
  fireEvent.click(await screen.findByRole('button', { name: 'Add past match' }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Find the opponent club' }), { target: { value: 'Opponents' } });
  await screen.findByRole('option', { name: 'Opponents' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Registered opponent' }), { target: { value: '2' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Your squad (optional)' }), { target: { value: '7' } });
  if (away) fireEvent.change(screen.getByRole('combobox', { name: 'Your club played' }), { target: { value: 'AWAY' } });
  fireEvent.change(screen.getByLabelText('Local kickoff date & time'), { target: { value: '2020-09-20T14:00' } });
  fireEvent.change(screen.getByLabelText('Local end date & time'), { target: { value: '2020-09-20T15:30' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Home score' }), { target: { value: '0' } });
  expect(screen.getByRole('button', { name: 'Add historical record' })).toBeDisabled();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Away score' }), { target: { value: '2' } });
  expect(screen.getByRole('button', { name: 'Add historical record' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Record source / reason' }), { target: { value: 'Signed club scorebook, 20 September 2020' } });
}

it('offers historical entry only to clubs returned by the authorized options endpoint', async () => {
  vi.mocked(getHistoricalImportOptions).mockResolvedValue({ clubs: [] });
  render(<MemoryRouter><HistoricalMatchImport onSaved={vi.fn()} /></MemoryRouter>);
  await waitFor(() => expect(getHistoricalImportOptions).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: 'Add past match' })).not.toBeInTheDocument();
});

it('preserves actual home/away sides and uses private visibility and a source note', async () => {
  render(<MemoryRouter><HistoricalMatchImport onSaved={vi.fn()} /></MemoryRouter>);
  await fill(true);
  expect(screen.getByRole('combobox', { name: 'Visibility' })).toHaveValue('PRIVATE');
  fireEvent.click(screen.getByRole('button', { name: 'Add historical record' }));
  await waitFor(() => expect(importHistoricalMatch).toHaveBeenCalledWith(expect.objectContaining({ clubId: 2, opponentClubId: 1, awaySquadId: 7, homeSquadId: undefined, homeScore: 0, awayScore: 2, visibility: 'PRIVATE', reason: 'Signed club scorebook, 20 September 2020', startsAt: '2020-09-20T14:00:00', endsAt: '2020-09-20T15:30:00', requestId: expect.any(String) }), expect.any(AbortSignal), 'session-a'));
  expect(await screen.findByRole('link', { name: /Open recorded match/ })).toHaveAttribute('href', '/calendar?eventId=90');
  expect(screen.queryByText('Confirmed result')).not.toBeInTheDocument();
});

it('retains the idempotency key on retry and links a duplicate to its existing fixture', async () => {
  vi.mocked(importHistoricalMatch).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { detail: 'A matching fixture exists', existingDetailPath: '/match-exchange/12#result' } } });
  render(<MemoryRouter><HistoricalMatchImport onSaved={vi.fn()} /></MemoryRouter>);
  await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Add historical record' }));
  expect(await screen.findByRole('link', { name: 'Open existing match' })).toHaveAttribute('href', '/match-exchange/12#result');
  const requestId = vi.mocked(importHistoricalMatch).mock.calls[0][0].requestId;
  fireEvent.click(screen.getByRole('button', { name: 'Add historical record' }));
  await waitFor(() => expect(importHistoricalMatch).toHaveBeenCalledTimes(2));
  expect(vi.mocked(importHistoricalMatch).mock.calls[1][0].requestId).toBe(requestId);
});
