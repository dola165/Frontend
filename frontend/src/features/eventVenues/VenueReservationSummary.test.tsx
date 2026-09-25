import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { VenueReservationSummary, type VenueReservationSummaryValue } from './VenueReservationSummary';
import { SquadSessionDetails } from '../squadCommunication/SquadSessionDialog';
import { sessionEvent } from '../squadCommunication/useSquadSchedule';
import { TournamentMatchDialog } from '../tournaments/components/TournamentMatchDialog';
import type { TournamentDetail, TournamentFixtureDto } from '../tournaments/domain';
vi.mock('../tournaments/components/TournamentFixtureReferees', () => ({ TournamentFixtureReferees: () => <button>Invite tournament referee</button> }));
const summary: VenueReservationSummaryValue = { venueId: 131, venueName: 'Cardiff Ground', pitchName: 'North Pitch', status: 'CONFIRMED', startsAt: '2027-05-01T10:00:00Z', endsAt: '2027-05-01T11:30:00Z', timezone: 'Europe/London' };
const session = (status: VenueReservationSummaryValue['status']) => sessionEvent({ id: 4, name: 'U12' }, { id: 5, title: 'Training', starts_at: summary.startsAt, ends_at: summary.endsAt, location: 'Outdated meeting point', status: 'SCHEDULED', cancellation_reason: null, revision: 0, attendance: [], venue_reservation: { ...summary, status } });
describe('Family and spectator venue summaries', () => {
    it('shows a confirmed pitch in family session details without exposing staff actions', () => {
        render(<MemoryRouter><SquadSessionDetails event={session('CONFIRMED')} onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);
        expect(screen.getByText('Pitch confirmed')).toBeVisible();
        expect(screen.getByRole('link', { name: 'Cardiff Ground · North Pitch' })).toHaveAttribute('href', '/stadiums/131');
        expect(screen.getByText(/Europe\/London/)).toHaveTextContent('11:00');
        expect(screen.queryByText('Outdated meeting point')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Stadium reservation →/ })).not.toBeInTheDocument();
    });
    it('labels pending explicitly and does not advertise a calendar destination as confirmed', () => {
        const event = session('PENDING');
        expect(event.locationText).toBeNull();
        render(<MemoryRouter><SquadSessionDetails event={event} onClose={vi.fn()} onSaved={vi.fn()}/></MemoryRouter>);
        expect(screen.getByText('Pitch awaiting stadium confirmation')).toBeVisible();
        expect(screen.getByText('This request is not yet a confirmed venue.')).toBeVisible();
    });
    it('suppresses stale destinations when a rental expires, is cancelled or invalidated', () => {
        expect(session('UNAVAILABLE').locationText).toBeNull();
        render(<MemoryRouter><VenueReservationSummary value={{ ...summary, status: 'UNAVAILABLE' }}/></MemoryRouter>);
        expect(screen.getByText('Venue reservation no longer confirmed')).toBeVisible();
        expect(screen.queryByText(/Cardiff Ground/)).not.toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
    it('keeps the supported venue summary while gating unsupported fixture controls', () => {
        const fixture: TournamentFixtureDto = { id: 1, stageId: null, stageName: null, homeEntryId: null, awayEntryId: null, homeLabel: 'Home', awayLabel: 'Away', winnerEntryId: null, homeScore: null, awayScore: null, roundNumber: 1, fixtureOrder: 1, scheduledAt: '2027-05-01T11:00:00', locationId: null, status: 'SCHEDULED', linkedMatchId: null, venueReservation: summary };
        const tournament: TournamentDetail = { id: 1, name: 'Cup', status: 'ACTIVE', organizerOrganizationId: 1, participantScope: 'SQUAD', visibility: 'PUBLIC', staffAssignments: [], entries: [], stages: [], fixtures: [fixture] };
        render(<MemoryRouter><TournamentMatchDialog tournament={tournament} fixture={fixture} canManage canScore={false} onUpdate={vi.fn()} onClose={vi.fn()}/></MemoryRouter>);
        expect(screen.getByText('Pitch confirmed')).toBeVisible();
        expect(screen.getByRole('link', { name: 'Cardiff Ground · North Pitch' })).toBeVisible();
        expect(screen.queryByRole('link', { name: /Stadium reservation ↗/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Invite tournament referee' })).not.toBeInTheDocument();
    });
});
