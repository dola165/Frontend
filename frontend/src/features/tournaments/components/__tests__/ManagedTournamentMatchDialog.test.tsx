import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../../../i18n';
import { ManagedTournamentMatchDialog } from '../ManagedTournamentMatchDialog';
import { getDraw, operation, saveCompetitionResult } from '../../../competitions/api';
import { fetchTournament } from '../../api';
import type { TournamentDetail, TournamentFixtureDto } from '../../domain';
import type { Profile } from '../../../competitions/api';

vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 }, sessionId: 'session-one' }) }));
vi.mock('../../../competitions/api', async original => ({ ...await original<typeof import('../../../competitions/api')>(), getDraw: vi.fn(), operation: vi.fn(), saveCompetitionResult: vi.fn() }));
vi.mock('../../api', () => ({ fetchTournament: vi.fn(), cancelFixture: vi.fn() }));
const fixture = { id: 4, stageId: 1, stageName: 'Cup', status: 'SCHEDULED', homeEntryId: 11, awayEntryId: 12, scheduledAt: '2026-01-10T13:00-05:00', locationId: null } as TournamentFixtureDto;
const tournament = { id: 8, status: 'ACTIVE', startDate: '2026-01-10T10:00-05:00', endDate: '2026-01-10T20:00-05:00', entries: [{ id: 11, displayName: 'Home' }, { id: 12, displayName: 'Away' }], stages: [{ id: 1, stageType: 'KNOCKOUT' }], fixtures: [fixture] } as TournamentDetail;
const profile = { rules: { timezone: 'America/New_York', matchMinutes: 1, pitches: 2 }, revision: 3, legacy: false } as Profile;
const open = (game = fixture) => render(<MemoryRouter><ManagedTournamentMatchDialog tournament={tournament} fixture={game} profile={profile} canManage canScore onUpdate={vi.fn()} onClose={vi.fn()}/></MemoryRouter>);
beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear();
    vi.mocked(getDraw).mockResolvedValue({ slots: [{ fixture_id: 4, pitch_number: 2 }] } as never);
    vi.mocked(operation).mockResolvedValue({} as never); vi.mocked(fetchTournament).mockResolvedValue(tournament);
    vi.mocked(saveCompetitionResult).mockResolvedValue({ ...tournament, fixtures: [{ ...fixture, status: 'COMPLETED' }] });
});
it('saves the competition-zone kickoff through the canonical pitch-slot operation', async () => {
    open();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Pitch allocation' })).toHaveValue('2'));
    fireEvent.change(screen.getByLabelText('Kickoff', { exact: true }), { target: { value: '2026-01-10T14:30' } });
    fireEvent.change(screen.getByLabelText('Reason or result note'), { target: { value: 'Updated published timetable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save kickoff' }));
    await waitFor(() => expect(operation).toHaveBeenCalledWith(8, 'fixtures/postpone', expect.objectContaining({ fixtureId: 4, startsAt: '2026-01-10T19:30:00.000Z', pitch: 2, revision: 3, reason: 'Updated published timetable' })));
});
it('records a tied score without inventing a penalty winner', async () => {
    open(); fireEvent.change(screen.getAllByLabelText(/^Goals for/)[0], { target: { value: '1' } }); fireEvent.change(screen.getAllByLabelText(/^Goals for/)[1], { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm final result' }));
    await waitFor(() => expect(saveCompetitionResult).toHaveBeenCalledWith(8, expect.objectContaining({ fixtureId: 4, action: 'COMPLETE', homeScore: 1, awayScore: 1, winnerEntryId: null, revision: 3 })));
    expect(screen.queryByRole('combobox', { name: 'Winner after penalties' })).not.toBeInTheDocument();
});
it('keeps the original result intent and entered scores after an uncertain response', async () => {
    vi.mocked(saveCompetitionResult).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue(tournament);
    open(); fireEvent.change(screen.getAllByLabelText(/^Goals for/)[0], { target: { value: '2' } }); fireEvent.change(screen.getAllByLabelText(/^Goals for/)[1], { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm final result' }));
    await screen.findByRole('heading', { name: 'Confirm an interrupted submission' });
    expect(screen.getAllByLabelText(/^Goals for/)[0]).toHaveValue('2');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm final result' }));
    await waitFor(() => expect(saveCompetitionResult).toHaveBeenCalledTimes(2));
    expect(vi.mocked(saveCompetitionResult).mock.calls[1][1]).toEqual(vi.mocked(saveCompetitionResult).mock.calls[0][1]);
});
it('keeps future results disabled before full time', async () => {
    open({ ...fixture, scheduledAt: '2099-01-10T13:00-05:00' });
    fireEvent.change(screen.getAllByLabelText(/^Goals for/)[0], { target: { value: '2' } }); fireEvent.change(screen.getAllByLabelText(/^Goals for/)[1], { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Confirm final result' })).toBeDisabled(); expect(saveCompetitionResult).not.toHaveBeenCalled();
});

it('shows the safe allocation summary inside the managed match view', async () => {
    open({ ...fixture, venueReservation: { venueId: 71, venueName: 'Synthetic ground', pitchName: 'Pitch A', status: 'CONFIRMED', startsAt: '2026-01-10T18:00:00Z', endsAt: '2026-01-10T18:01:00Z', timezone: 'America/New_York' } });
    expect(await screen.findByText('Pitch confirmed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Synthetic ground · Pitch A' })).toHaveAttribute('href', '/stadiums/71');
});
